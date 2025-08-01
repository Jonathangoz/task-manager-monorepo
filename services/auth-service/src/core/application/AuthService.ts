// src/core/application/AuthService.ts
import {
  IAuthService,
  LoginCredentials,
  RegisterData,
  AuthResult,
  AuthTokens,
  TokenPayload,
  SessionInfo,
  LoginAttemptData,
} from '@/core/domain/interfaces/IAuthService';
import { IUserRepository } from '@/core/interfaces/IUserRepository';
import { ITokenService } from '@/core/interfaces/ITokenService';
import { ICacheService } from '@/core/interfaces/ICacheService';
import { User } from '@/core/entities/User';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@/utils/crypto';
import { logger, authLogger } from '@/utils/logger';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  SECURITY_CONFIG,
  CACHE_TTL,
  CACHE_KEYS,
} from '@/utils/constants';
import { db } from '@/config/database';

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly cacheService: ICacheService,
  ) {}

  /**
   * Autentica un usuario con email y contraseña
   */
  public async login(
    credentials: LoginCredentials,
    sessionInfo: SessionInfo,
  ): Promise<AuthResult> {
    const { email, password } = credentials;

    try {
      authLogger.info(
        { email, ip: sessionInfo.ipAddress },
        'Login attempt started',
      );

      const ipAddress = sessionInfo.ipAddress || 'unknown';
      await this.checkLoginAttempts(email, ipAddress);

      // Buscar usuario con password incluido para verificación
      const user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          isVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        await this.recordLoginAttempt({
          email,
          ipAddress,
          success: false,
          reason: ERROR_MESSAGES.INVALID_CREDENTIALS,
        });
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Crear instancia User usando fromPrisma
      const userInstance = User.fromPrisma(user);

      if (!userInstance.isActive) {
        await this.recordLoginAttempt({
          email,
          userId: userInstance.id,
          ipAddress,
          success: false,
          reason: ERROR_MESSAGES.USER_INACTIVE,
        });
        throw new Error(ERROR_CODES.USER_INACTIVE);
      }

      // Verificar password usando el método toPrisma() para acceder al password
      const isPasswordValid = await verifyPassword(
        userInstance.toPrisma().password,
        password,
      );
      if (!isPasswordValid) {
        await this.recordLoginAttempt({
          email,
          userId: userInstance.id,
          ipAddress,
          success: false,
          reason: ERROR_MESSAGES.INVALID_CREDENTIALS,
        });
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      const sessionId = await this.createSession(userInstance.id, sessionInfo);

      const tokens = await this.generateAuthTokens(userInstance, sessionId);

      await this.userRepository.updateLastLogin(userInstance.id);

      await this.clearLoginAttempts(email);

      await this.recordLoginAttempt({
        email,
        userId: userInstance.id,
        ipAddress,
        success: true,
      });

      authLogger.info(
        {
          userId: userInstance.id,
          email: userInstance.email,
          sessionId,
          ip: ipAddress,
        },
        'Login successful',
      );

      return {
        user: userInstance,
        tokens,
        sessionId,
      };
    } catch (error) {
      authLogger.error(
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: sessionInfo.ipAddress,
        },
        'Login failed',
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

      const existingUser = await this.userRepository.exists(email, username);
      if (existingUser) {
        throw new Error(ERROR_CODES.USER_ALREADY_EXISTS);
      }

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(ERROR_CODES.PASSWORD_TOO_WEAK);
      }

      const hashedPassword = await hashPassword(password);

      // Crear usuario directamente en la base de datos para tener acceso completo
      const user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          password: hashedPassword,
          firstName,
          lastName,
        },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          isVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      authLogger.info(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
        'User registered successfully',
      );

      return User.fromPrisma(user);
    } catch (error) {
      authLogger.error(
        {
          email,
          username,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'User registration failed',
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
      await this.terminateSession(sessionId);
      authLogger.info({ userId, sessionId }, 'Logout successful');
    } catch (error) {
      authLogger.error(
        {
          userId,
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Logout failed',
      );
      throw error;
    }
  }

  /**
   * Cierra todas las sesiones de un usuario
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      authLogger.info({ userId }, 'Logout all sessions started');
      await this.terminateAllSessions(userId);
      authLogger.info({ userId }, 'All sessions terminated successfully');
    } catch (error) {
      authLogger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to terminate all sessions',
      );
      throw error;
    }
  }

  /**
   * Refresca un access token usando un refresh token
   */
  async refreshToken(
    refreshToken: string,
    sessionInfo: SessionInfo,
  ): Promise<AuthTokens> {
    try {
      authLogger.info({ ip: sessionInfo.ipAddress }, 'Token refresh started');

      const tokenPayload =
        await this.tokenService.validateRefreshToken(refreshToken);

      const storedToken = await db.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              password: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isActive: true,
              isVerified: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (
        !storedToken ||
        storedToken.isRevoked ||
        storedToken.expiresAt < new Date()
      ) {
        throw new Error(ERROR_CODES.REFRESH_TOKEN_INVALID);
      }

      const userInstance = User.fromPrisma(storedToken.user);
      if (!userInstance.isActive) {
        throw new Error(ERROR_CODES.USER_INACTIVE);
      }

      await db.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      const tokens = await this.generateAuthTokens(
        userInstance,
        tokenPayload.sessionId,
      );

      authLogger.info(
        {
          userId: userInstance.id,
          sessionId: tokenPayload.sessionId,
        },
        'Token refresh successful',
      );

      return tokens;
    } catch (error) {
      authLogger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: sessionInfo.ipAddress,
        },
        'Token refresh failed',
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

      const isSessionValid = await this.validateSession(payload.sessionId);
      if (!isSessionValid) {
        throw new Error(ERROR_CODES.SESSION_INVALID);
      }

      return payload;
    } catch (error) {
      authLogger.debug(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Token validation failed',
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
        data: { isRevoked: true },
      });

      authLogger.info({ tokenId }, 'Refresh token revoked');
    } catch (error) {
      authLogger.error(
        {
          tokenId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to revoke refresh token',
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
        data: { isRevoked: true },
      });

      authLogger.info(
        {
          userId,
          revokedCount: result.count,
        },
        'All refresh tokens revoked',
      );
    } catch (error) {
      authLogger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to revoke all tokens',
      );
      throw error;
    }
  }

  /**
   * Cambia la contraseña de un usuario
   * Implementa la interfaz correcta de IAuthService
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      authLogger.info({ userId }, 'Password update started');

      // Buscar usuario con password para verificación
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          isVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new Error(ERROR_CODES.USER_NOT_FOUND);
      }

      const userInstance = User.fromPrisma(user);

      const isCurrentPasswordValid = await verifyPassword(
        userInstance.toPrisma().password,
        currentPassword,
      );
      if (!isCurrentPasswordValid) {
        throw new Error(ERROR_CODES.INVALID_CREDENTIALS);
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(ERROR_CODES.PASSWORD_TOO_WEAK);
      }

      const newHashedPassword = await hashPassword(newPassword);

      await this.userRepository.updatePassword(userId, newHashedPassword);

      await this.terminateAllSessions(userId);

      authLogger.info(
        { userId },
        'Password updated successfully and all sessions terminated',
      );
    } catch (error) {
      authLogger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Password update failed',
      );
      throw error;
    }
  }

  /**
   * Registra un intento de login (implementación de la interfaz)
   */
  async recordLoginAttempt(data: LoginAttemptData): Promise<void> {
    return this.recordLoginAttemptInternal(data);
  }

  /**
   * Implementa terminateAllSessions con parámetro opcional excludeSessionId
   */
  async terminateAllSessions(
    userId: string,
    excludeSessionId?: string,
  ): Promise<void> {
    try {
      const whereCondition: any = { userId, isActive: true };

      // Si se proporciona excludeSessionId, excluir esa sesión
      if (excludeSessionId) {
        whereCondition.sessionId = { not: excludeSessionId };
      }

      const sessions = await db.userSession.findMany({
        where: whereCondition,
        select: { sessionId: true },
      });

      await db.userSession.updateMany({
        where: whereCondition,
        data: { isActive: false },
      });

      // CORRECCIÓN: Llamar a la función CACHE_KEYS.USER_SESSION con cada sessionId
      if (sessions.length > 0) {
        for (const session of sessions) {
          const cacheKey = CACHE_KEYS.USER_SESSION(session.sessionId);
          await this.cacheService.del(cacheKey);
        }
      }

      await this.revokeAllTokens(userId);

      authLogger.info(
        { userId, count: sessions.length, excludedSession: excludeSessionId },
        'Sessions terminated',
      );
    } catch (error) {
      authLogger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to terminate sessions',
      );
      throw error;
    }
  }

  /**
   * Métodos de forgot/reset password - implementación básica
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Por seguridad, no revelar si el email existe o no
        authLogger.info(
          { email },
          'Password reset requested for non-existent email',
        );
        return;
      }

      // TODO: Implementar lógica de envío de email
      authLogger.info(
        { email, userId: user.id },
        'Password reset email would be sent',
      );
    } catch (error) {
      authLogger.error(
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Forgot password failed',
      );
      throw error;
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    email: string,
  ): Promise<void> {
    try {
      // TODO: Implementar validación de token y reset de password
      authLogger.info({ email }, 'Password reset attempted');
      throw new Error('Not implemented');
    } catch (error) {
      authLogger.error(
        {
          token,
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Password reset failed',
      );
      throw error;
    }
  }

  /**
   * Crea una nueva sesión de usuario
   */
  async createSession(
    userId: string,
    sessionInfo: SessionInfo,
  ): Promise<string> {
    try {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + CACHE_TTL.USER_SESSION * 1000); // Convertir a milisegundos
      const ipAddress = sessionInfo.ipAddress || 'unknown';
      const userAgent = sessionInfo.userAgent || 'unknown';

      await db.userSession.create({
        data: {
          userId,
          sessionId,
          ipAddress,
          userAgent,
          device: sessionInfo.device,
          location: sessionInfo.location,
          expiresAt,
          isActive: true,
        },
      });

      await this.cacheService.setJson(
        CACHE_KEYS.USER_SESSION(sessionId),
        {
          userId,
          sessionId,
          ipAddress,
          userAgent,
          isActive: true,
          expiresAt: expiresAt.toISOString(),
        },
        CACHE_TTL.USER_SESSION,
      );

      authLogger.info({ userId, sessionId, ip: ipAddress }, 'Session created');

      return sessionId;
    } catch (error) {
      authLogger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to create session',
      );
      throw error;
    }
  }

  /**
   * Valida si una sesión está activa
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const cachedSession = await this.cacheService.getJson<{
        expiresAt: string;
        isActive: boolean;
      }>(CACHE_KEYS.USER_SESSION(sessionId));
      if (cachedSession) {
        const expiresAt = new Date(cachedSession.expiresAt);
        return cachedSession.isActive && expiresAt > new Date();
      }

      const session = await db.userSession.findUnique({
        where: { sessionId },
      });
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return false;
      }

      await this.cacheService.setJson(
        CACHE_KEYS.USER_SESSION(sessionId),
        {
          userId: session.userId,
          sessionId: session.sessionId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          isActive: session.isActive,
          expiresAt: session.expiresAt.toISOString(),
        },
        CACHE_TTL.USER_SESSION,
      );
      return true;
    } catch (error) {
      authLogger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Session validation failed',
      );
      return false;
    }
  }

  /**
   * Termina una sesión específica
   */
  async terminateSession(sessionId: string): Promise<void> {
    try {
      await db.userSession.update({
        where: { sessionId },
        data: { isActive: false },
      });

      await this.cacheService.del(CACHE_KEYS.USER_SESSION(sessionId));

      authLogger.info({ sessionId }, 'Session terminated');
    } catch (error) {
      authLogger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to terminate session',
      );
      throw error;
    }
  }

  /**
   * Genera tokens de autenticación para un usuario
   */
  private async generateAuthTokens(
    user: User,
    sessionId: string,
  ): Promise<AuthTokens> {
    const accessTokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      sessionId,
    };

    const accessToken =
      await this.tokenService.generateAccessToken(accessTokenPayload);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user.id,
      sessionId,
    );

    // Obtener tiempo de expiración con el parámetro requerido
    const expirationTime = this.tokenService.getTokenExpirationTime('15m'); // 15 minutos por defecto

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: expirationTime,
    };
  }

  /**
   * Verifica el número de intentos de login fallidos
   */
  private async checkLoginAttempts(
    email: string,
    ipAddress: string,
  ): Promise<void> {
    const attempts = await this.cacheService.getLoginAttempts(email);
    if (attempts && attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      authLogger.warn(
        { email, ipAddress, attempts },
        'Too many login attempts, user is rate-limited',
      );
      await this.recordLoginAttemptInternal({
        email,
        ipAddress,
        success: false,
        reason: ERROR_MESSAGES.TOO_MANY_LOGIN_ATTEMPTS,
      });
      throw new Error(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS);
    }
  }

  /**
   * Registra un intento de login (método interno)
   */
  private async recordLoginAttemptInternal(
    data: LoginAttemptData,
  ): Promise<void> {
    const { email, success, ipAddress, reason } = data;
    try {
      if (success) {
        await this.cacheService.clearLoginAttempts(email);
        return;
      }

      const currentAttempts = await this.cacheService.recordLoginAttempt(email);

      // Crear el objeto sin attemptCount ya que no está en el schema
      await db.loginAttempt.create({
        data: {
          email,
          ipAddress: ipAddress || 'unknown',
          userAgent: data.userAgent,
          success,
          reason,
        },
      });

      authLogger.info(
        { email, ipAddress, success, reason, attemptCount: currentAttempts },
        'Login attempt recorded',
      );
    } catch (error) {
      authLogger.error(
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to record login attempt',
      );
    }
  }

  /**
   * Limpia el contador de intentos de login fallidos
   */
  private async clearLoginAttempts(email: string): Promise<void> {
    try {
      await this.cacheService.clearLoginAttempts(email);
    } catch (error) {
      authLogger.error(
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to clear login attempts',
      );
    }
  }
}
