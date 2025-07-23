// src/core/application/AuthService.ts
import { 
  IAuthService, 
  LoginCredentials, 
  RegisterData, 
  AuthResult, 
  AuthTokens, 
  TokenPayload,
  SessionInfo 
} from '@/core/domain/interfaces/IAuthService';
import { IUserRepository } from '@/core/domain/interfaces/IUserRepository';
import { ITokenService } from '@/core/domain/interfaces/ITokenService';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { User } from '@/core/domain/entities/User';
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/utils/crypto';
import { logger, authLogger } from '@/utils/logger';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  SECURITY_CONFIG,
  EVENT_TYPES,
  CACHE_TTL 
} from '@/utils/constants';
import { db } from '@/config/database';

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly cacheService: ICacheService
  ) {}

  /**
   * Autentica un usuario con email y contraseña
   */
  async login(credentials: LoginCredentials, sessionInfo: SessionInfo): Promise<AuthResult> {
    const { email, password } = credentials;
    
    try {
      authLogger.info({ email, ip: sessionInfo.ipAddress }, 'Login attempt started');

      // Verificar intentos de login fallidos
      await this.checkLoginAttempts(email, sessionInfo.ipAddress || 'unknown');

      // Buscar usuario por email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        await this.recordLoginAttempt(email, sessionInfo.ipAddress || 'unknown', false);
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Verificar que el usuario esté activo
      if (!user.isActive) {
        await this.recordLoginAttempt(email, sessionInfo.ipAddress || 'unknown', false);
        throw new Error(ERROR_CODES.USER_INACTIVE);
      }

      // Verificar contraseña
      const isPasswordValid = await verifyPassword(user.password, password);
      if (!isPasswordValid) {
        await this.recordLoginAttempt(email, sessionInfo.ipAddress || 'unknown', false);
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Crear sesión
      const sessionId = await this.createSession(user.id, sessionInfo);

      // Generar tokens
      const tokens = await this.generateAuthTokens(user, sessionId);

      // Actualizar último login
      await this.userRepository.updateLastLogin(user.id);

      // Limpiar intentos de login fallidos
      await this.clearLoginAttempts(email);

      // Registrar login exitoso
      await this.recordLoginAttempt(email, sessionInfo.ipAddress || 'unknown', true);

      authLogger.info(
        { 
          userId: user.id, 
          email: user.email, 
          sessionId,
          ip: sessionInfo.ipAddress 
        }, 
        'Login successful'
      );

      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId
      };

    } catch (error) {
      authLogger.error(
        { 
          email, 
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: sessionInfo.ipAddress 
        }, 
        'Login failed'
      );
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario
   */
  async register(data: RegisterData): Promise<User> {
    const { email, username, password, firstName, lastName } = data;

    try {
      authLogger.info({ email, username }, 'User registration started');

      // Verificar si el usuario ya existe
      const existingUser = await this.userRepository.exists(email, username);
      if (existingUser) {
        throw new Error(ERROR_CODES.USER_ALREADY_EXISTS);
      }

      // Validar fortaleza de la contraseña
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(ERROR_CODES.PASSWORD_TOO_WEAK);
      }

      // Hashear contraseña
      const hashedPassword = await hashPassword(password);

      // Crear usuario
      const user = await this.userRepository.create({
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName
      });

      authLogger.info(
        { 
          userId: user.id, 
          email: user.email, 
          username: user.username 
        }, 
        'User registered successfully'
      );

      return this.sanitizeUser(user);

    } catch (error) {
      authLogger.error(
        { 
          email, 
          username, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'User registration failed'
      );
      throw error;
    }
  }

  /**
   * Cierra sesión de un usuario
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    try {
      authLogger.info({ userId, sessionId }, 'Logout started');

      // Terminar sesión
      await this.terminateSession(sessionId);

      // Revocar todos los refresh tokens de la sesión
      await db.refreshToken.updateMany({
        where: {
          userId,
          userAgent: { contains: sessionId } // Asumiendo que guardamos sessionId en userAgent
        },
        data: {
          isRevoked: true
        }
      });

      authLogger.info({ userId, sessionId }, 'Logout successful');

    } catch (error) {
      authLogger.error(
        { 
          userId, 
          sessionId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Logout failed'
      );
      throw error;
    }
  }

  /**
   * Refresca un access token usando un refresh token
   */
  async refreshToken(refreshToken: string, sessionInfo: SessionInfo): Promise<AuthTokens> {
    try {
      authLogger.info({ ip: sessionInfo.ipAddress }, 'Token refresh started');

      // Validar refresh token
      const tokenPayload = await this.tokenService.validateRefreshToken(refreshToken);

      // Buscar el refresh token en la base de datos
      const storedToken = await db.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });

      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        throw new Error(ERROR_CODES.REFRESH_TOKEN_INVALID);
      }

      // Verificar que el usuario esté activo
      if (!storedToken.user.isActive) {
        throw new Error(ERROR_CODES.USER_INACTIVE);
      }

      // Revocar el refresh token usado
      await db.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true }
      });

      // Generar nuevos tokens
      const tokens = await this.generateAuthTokens(storedToken.user, tokenPayload.sessionId);

      authLogger.info(
        { 
          userId: storedToken.user.id, 
          sessionId: tokenPayload.sessionId 
        }, 
        'Token refresh successful'
      );

      return tokens;

    } catch (error) {
      authLogger.error(
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: sessionInfo.ipAddress 
        }, 
        'Token refresh failed'
      );
      throw error;
    }
  }

  /**
   * Valida un access token
   */
  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.tokenService.validateAccessToken(token);
      
      // Verificar que la sesión esté activa
      const isSessionValid = await this.validateSession(payload.sessionId);
      if (!isSessionValid) {
        throw new Error(ERROR_CODES.SESSION_INVALID);
      }

      return payload;

    } catch (error) {
      authLogger.debug(
        { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Token validation failed'
      );
      throw error;
    }
  }

  /**
   * Revoca un refresh token específico
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    try {
      await db.refreshToken.update({
        where: { id: tokenId },
        data: { isRevoked: true }
      });

      authLogger.info({ tokenId }, 'Refresh token revoked');

    } catch (error) {
      authLogger.error(
        { 
          tokenId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Failed to revoke refresh token'
      );
      throw error;
    }
  }

  /**
   * Revoca todos los refresh tokens de un usuario
   */
  async revokeAllTokens(userId: string): Promise<void> {
    try {
      const result = await db.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      authLogger.info(
        { 
          userId, 
          revokedCount: result.count 
        }, 
        'All refresh tokens revoked'
      );

    } catch (error) {
      authLogger.error(
        { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Failed to revoke all tokens'
      );
      throw error;
    }
  }

  /**
   * Crea una nueva sesión de usuario
   */
  async createSession(userId: string, sessionInfo: SessionInfo): Promise<string> {
    try {
      // Generar ID de sesión único
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calcular fecha de expiración (24 horas)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Crear sesión en la base de datos
      await db.userSession.create({
        data: {
          userId,
          sessionId,
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.userAgent,
          device: sessionInfo.device,
          location: sessionInfo.location,
          expiresAt,
          isActive: true
        }
      });

      // Guardar sesión en cache para acceso rápido
      await this.cacheService.setJson(
        `session:${sessionId}`,
        {
          userId,
          sessionId,
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.userAgent,
          isActive: true,
          expiresAt: expiresAt.toISOString()
        },
        CACHE_TTL.USER_SESSION
      );

      authLogger.info(
        { 
          userId, 
          sessionId, 
          ip: sessionInfo.ipAddress 
        }, 
        'Session created'
      );

      return sessionId;

    } catch (error) {
      authLogger.error(
        { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Failed to create session'
      );
      throw error;
    }
  }

  /**
   * Valida si una sesión está activa
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      // Buscar en cache primero
      const cachedSession = await this.cacheService.getJson(`session:${sessionId}`);
      if (cachedSession) {
        const expiresAt = new Date(cachedSession.expiresAt);
        return cachedSession.isActive && expiresAt > new Date();
      }

      // Si no está en cache, buscar en base de datos
      const session = await db.userSession.findUnique({
        where: { sessionId }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return false;
      }

      // Actualizar cache
      await this.cacheService.setJson(
        `session:${sessionId}`,
        {
          userId: session.userId,
          sessionId: session.sessionId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          isActive: session.isActive,
          expiresAt: session.expiresAt.toISOString()
        },
        CACHE_TTL.USER_SESSION
      );

      return true;

    } catch (error) {
      authLogger.error(
        { 
          sessionId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Session validation failed'
      );
      return false;
    }
  }

  /**
   * Termina una sesión específica
   */
  async terminateSession(sessionId: string): Promise<void> {
    try {
      // Desactivar sesión en base de datos
      await db.userSession.update({
        where: { sessionId },
        data: { isActive: false }
      });

      // Eliminar de cache
      await this.cacheService.del(`session:${sessionId}`);

      authLogger.info({ sessionId }, 'Session terminated');

    } catch (error) {
      authLogger.error(
        { 
          sessionId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Failed to terminate session'
      );
      throw error;
    }
  }

  /**
   * Termina todas las sesiones de un usuario
   */
  async terminateAllSessions(userId: string): Promise<void> {
    try {
      // Obtener todas las sesiones activas del usuario
      const sessions = await db.userSession.findMany({
        where: { userId, isActive: true },
        select: { sessionId: true }
      });

      // Desactivar todas las sesiones
      await db.userSession.updateMany({
        where: { userId },
        data: { isActive: false }
      });

      // Eliminar de cache
      for (const session of sessions) {
        await this.cacheService.del(`session:${session.sessionId}`);
      }

      authLogger.info(
        { 
          userId, 
          terminatedCount: sessions.length 
        }, 
        'All sessions terminated'
      );

    } catch (error) {
      authLogger.error(
        { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Failed to terminate all sessions'
      );
      throw error;
    }
  }

  /**
   * Cambia la contraseña de un usuario
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      authLogger.info({ userId }, 'Password change started');

      // Buscar usuario
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error(ERROR_CODES.USER_NOT_FOUND);
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await verifyPassword(user.password, currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Validar nueva contraseña
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(ERROR_CODES.PASSWORD_TOO_WEAK);
      }

      // Hashear nueva contraseña
      const hashedNewPassword = await hashPassword(newPassword);

      // Actualizar contraseña
      await this.userRepository.updatePassword(userId, hashedNewPassword);

      // Revocar todos los tokens existentes por seguridad
      await this.revokeAllTokens(userId);
      await this.terminateAllSessions(userId);

      authLogger.info({ userId }, 'Password changed successfully');

    } catch (error) {
      authLogger.error(
        { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 
        'Password change failed'
      );
      throw error;
    }
  }

  // Métodos privados de utilidad

  /**
   * Genera tokens de autenticación para un usuario
   */
  private async generateAuthTokens(user: User, sessionId: string): Promise<AuthTokens> {
    // Generar access token
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username,
      sessionId
    });

    // Generar refresh token
    const refreshTokenData = await this.tokenService.generateRefreshToken(user.id, sessionId);

    // Guardar refresh token en base de datos
    await db.refreshToken.create({
      data: {
        id: refreshTokenData.tokenId,
        token: refreshTokenData.token,
        userId: user.id,
        expiresAt: refreshTokenData.expiresAt,
        userAgent: sessionId, // Usamos sessionId como identificador
        ipAddress: 'unknown' // Se puede mejorar pasando esta info
      }
    });

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: this.tokenService.getTokenExpirationTime('15m')
    };
  }

  /**
   * Verifica intentos de login fallidos
   */
  private async checkLoginAttempts(email: string, ipAddress: string): Promise<void> {
    const cacheKey = `login_attempts:${email}:${ipAddress}`;
    const attempts = await this.cacheService.get(cacheKey);
    
    if (attempts && parseInt(attempts) >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      throw new Error(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS);
    }
  }

  /**
   * Registra un intento de login
   */
  private async recordLoginAttempt(email: string, ipAddress: string, success: boolean): Promise<void> {
    // Registrar en base de datos para auditoria
    await db.loginAttempt.create({
      data: {
        email,
        ipAddress,
        success,
        userAgent: 'unknown' // Se puede mejorar
      }
    });

    // Si falló, incrementar contador en cache
    if (!success) {
      const cacheKey = `login_attempts:${email}:${ipAddress}`;
      const currentAttempts = await this.cacheService.get(cacheKey);
      const newAttempts = currentAttempts ? parseInt(currentAttempts) + 1 : 1;
      
      await this.cacheService.set(
        cacheKey, 
        newAttempts.toString(), 
        SECURITY_CONFIG.LOGIN_ATTEMPT_WINDOW / 1000
      );
    }
  }

  /**
   * Limpia intentos de login fallidos
   */
  private async clearLoginAttempts(email: string): Promise<void> {
    // Obtener todas las claves que coincidan con el patrón
    // Nota: Esta es una implementación simplificada
    const pattern = `login_attempts:${email}:*`;
    await this.cacheService.del(pattern);
  }

  /**
   * Sanitiza un objeto User removiendo información sensible
   */
  private sanitizeUser(user: User): User {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser as User;
  }
}