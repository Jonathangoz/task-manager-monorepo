// src/core/application/TokenService.ts - Servicio de aplicación para manejo de tokens JWT/JWE

import { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { 
  ITokenService, 
  TokenPayload, 
  RefreshTokenPayload, 
  SessionInfo, 
  TokenOptions 
} from '@/core/interfaces/ITokenService';
import { IUserRepository } from '@/core/interfaces/IUserRepository';
import { ICacheService } from '@/core/interfaces/ICacheService';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  TOKEN_CONFIG,
  CACHE_KEYS,
  CACHE_TTL 
} from '@/utils/constants';
import { db } from '@/config/database';

export class TokenService implements ITokenService {
  private readonly jwtSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  private readonly jweSecret: Uint8Array;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cacheService: ICacheService
  ) {
    // Preparar las claves como Uint8Array para jose
    this.jwtSecret = new TextEncoder().encode(config.jwt.secret);
    this.refreshSecret = new TextEncoder().encode(config.refreshToken.secret);
    this.jweSecret = new TextEncoder().encode(config.jwe.secret);
  }

  /**
   * Generar Access Token (JWT)
   */
  async generateAccessToken(
    payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>, 
    options?: TokenOptions
  ): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = options?.expiresIn || config.jwt.expiresIn;
      const expiration = now + this.getTokenExpirationTime(expiresIn);

      const jwt = new SignJWT({
        sub: payload.sub,
        email: payload.email,
        username: payload.username,
        sessionId: payload.sessionId,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(expiration)
        .setIssuer(options?.issuer || config.jwt.issuer);

      if (options?.audience) {
        jwt.setAudience(options.audience);
      }

      const token = await jwt.sign(this.jwtSecret);

      logger.debug({ 
        userId: payload.sub, 
        sessionId: payload.sessionId,
        expiresAt: new Date(expiration * 1000).toISOString()
      }, 'Access token generated');

      return token;
    } catch (error) {
      logger.error({ error, payload }, 'Failed to generate access token');
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * Validar Access Token
   */
  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        issuer: config.jwt.issuer,
      });

      const tokenPayload: TokenPayload = {
        sub: payload.sub as string,
        email: payload.email as string,
        username: payload.username as string,
        sessionId: payload.sessionId as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
        iss: payload.iss as string,
      };

      logger.debug({ 
        userId: tokenPayload.sub, 
        sessionId: tokenPayload.sessionId 
      }, 'Access token validated successfully');

      return tokenPayload;
    } catch (error) {
      logger.warn({ error: error.message }, 'Access token validation failed');
      
      if (error.code === 'ERR_JWT_EXPIRED') {
        throw new Error(ERROR_CODES.TOKEN_EXPIRED);
      }
      
      throw new Error(ERROR_CODES.TOKEN_INVALID);
    }
  }

  /**
   * Generar Refresh Token
   */
  async generateRefreshToken(
    userId: string, 
    sessionId: string, 
    options?: TokenOptions
  ): Promise<{
    token: string;
    tokenId: string;
    expiresAt: Date;
  }> {
    try {
      const tokenId = this.generateTokenId();
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = options?.expiresIn || config.refreshToken.expiresIn;
      const expiration = now + this.getTokenExpirationTime(expiresIn);
      const expiresAt = new Date(expiration * 1000);

      // Crear el payload del refresh token
      const jwt = new SignJWT({
        sub: userId,
        tokenId,
        sessionId,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(expiration)
        .setIssuer(options?.issuer || config.jwt.issuer);

      const token = await jwt.sign(this.refreshSecret);

      // Guardar el refresh token en la base de datos
      await db.refreshToken.create({
        data: {
          id: tokenId,
          token: createHash('sha256').update(token).digest('hex'),
          userId,
          expiresAt,
          userAgent: '', // Se actualizará desde el controlador con sessionInfo
          ipAddress: '', // Se actualizará desde el controlador con sessionInfo
        },
      });

      // Cachear el token
      await this.cacheRefreshToken(tokenId, userId, sessionId, expiresAt);

      logger.debug({ 
        userId, 
        sessionId, 
        tokenId,
        expiresAt: expiresAt.toISOString()
      }, 'Refresh token generated');

      return { token, tokenId, expiresAt };
    } catch (error) {
      logger.error({ error, userId, sessionId }, 'Failed to generate refresh token');
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * Validar Refresh Token
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret, {
        issuer: config.jwt.issuer,
      });

      const tokenPayload: RefreshTokenPayload = {
        sub: payload.sub as string,
        tokenId: payload.tokenId as string,
        sessionId: payload.sessionId as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
        iss: payload.iss as string,
      };

      // Verificar que el token existe en la base de datos y no está revocado
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const storedToken = await db.refreshToken.findFirst({
        where: {
          id: tokenPayload.tokenId,
          token: tokenHash,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        logger.warn({ tokenId: tokenPayload.tokenId }, 'Refresh token not found or revoked');
        throw new Error(ERROR_CODES.REFRESH_TOKEN_INVALID);
      }

      logger.debug({ 
        userId: tokenPayload.sub, 
        tokenId: tokenPayload.tokenId,
        sessionId: tokenPayload.sessionId 
      }, 'Refresh token validated successfully');

      return tokenPayload;
    } catch (error) {
      logger.warn({ error: error.message }, 'Refresh token validation failed');
      
      if (error.code === 'ERR_JWT_EXPIRED') {
        throw new Error(ERROR_CODES.REFRESH_TOKEN_EXPIRED);
      }
      
      if (error.message === ERROR_CODES.REFRESH_TOKEN_INVALID) {
        throw error;
      }
      
      throw new Error(ERROR_CODES.REFRESH_TOKEN_INVALID);
    }
  }

  /**
   * Encriptar token usando JWE
   */
  async encryptToken(token: string): Promise<string> {
    try {
      const jwe = new EncryptJWT({ token })
        .setProtectedHeader({ 
          alg: config.jwe.algorithm, 
          enc: config.jwe.encryption 
        })
        .setIssuedAt()
        .setExpirationTime('15m'); // Tokens encriptados tienen vida corta

      const encryptedToken = await jwe.encrypt(this.jweSecret);

      logger.debug('Token encrypted successfully');
      return encryptedToken;
    } catch (error) {
      logger.error({ error }, 'Failed to encrypt token');
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * Desencriptar token JWE
   */
  async decryptToken(encryptedToken: string): Promise<string> {
    try {
      const { payload } = await jwtDecrypt(encryptedToken, this.jweSecret);
      
      const token = payload.token as string;
      if (!token) {
        throw new Error('Invalid encrypted token payload');
      }

      logger.debug('Token decrypted successfully');
      return token;
    } catch (error) {
      logger.warn({ error: error.message }, 'Failed to decrypt token');
      throw new Error(ERROR_CODES.TOKEN_INVALID);
    }
  }

  /**
   * Extraer token del header Authorization
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Verificar si un token está expirado (sin validar firma)
   */
  isTokenExpired(token: string): boolean {
    try {
      // Decodificar el payload sin verificar la firma
      const [, payloadBase64] = token.split('.');
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf8')
      );

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch (error) {
      logger.warn({ error }, 'Failed to check token expiration');
      return true; // Asumir expirado si no se puede decodificar
    }
  }

  /**
   * Convertir string de tiempo a segundos
   */
  getTokenExpirationTime(expiresIn: string): number {
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
    };

    const match = expiresIn.match(/^(\d+)([smhdw]?)$/);
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiresIn}`);
    }

    const [, value, unit = 's'] = match;
    return parseInt(value, 10) * units[unit];
  }

  /**
   * Revocar refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    try {
      await db.refreshToken.update({
        where: { id: tokenId },
        data: { isRevoked: true },
      });

      // Remover del cache
      await this.removeCachedRefreshToken(tokenId);

      logger.info({ tokenId }, 'Refresh token revoked');
    } catch (error) {
      logger.error({ error, tokenId }, 'Failed to revoke refresh token');
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * Revocar todos los refresh tokens de un usuario
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      await db.refreshToken.updateMany({
        where: { 
          userId,
          isRevoked: false 
        },
        data: { isRevoked: true },
      });

      // Limpiar cache relacionado
      await this.clearUserTokenCache(userId);

      logger.info({ userId }, 'All user refresh tokens revoked');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to revoke all user tokens');
      throw new Error(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * Actualizar información de sesión en refresh token
   */
  async updateRefreshTokenSessionInfo(
    tokenId: string, 
    sessionInfo: SessionInfo
  ): Promise<void> {
    try {
      await db.refreshToken.update({
        where: { id: tokenId },
        data: {
          userAgent: sessionInfo.userAgent,
          ipAddress: sessionInfo.ipAddress,
        },
      });

      logger.debug({ tokenId }, 'Refresh token session info updated');
    } catch (error) {
      logger.error({ error, tokenId }, 'Failed to update refresh token session info');
      // No lanzar error, esta información es opcional
    }
  }

  /**
   * Limpiar tokens expirados
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await db.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isRevoked: true }
          ]
        }
      });

      logger.info({ deletedCount: result.count }, 'Expired tokens cleaned up');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired tokens');
    }
  }

  // ==============================================
  // Métodos privados
  // ==============================================

  /**
   * Generar ID único para tokens
   */
  private generateTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Cachear refresh token
   */
  private async cacheRefreshToken(
    tokenId: string, 
    userId: string, 
    sessionId: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const cacheKey = CACHE_KEYS.REFRESH_TOKEN(tokenId);
      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      
      await this.cacheService.set(
        cacheKey, 
        JSON.stringify({ userId, sessionId, expiresAt }), 
        ttl
      );
    } catch (error) {
      logger.warn({ error, tokenId }, 'Failed to cache refresh token');
    }
  }

  /**
   * Remover refresh token del cache
   */
  private async removeCachedRefreshToken(tokenId: string): Promise<void> {
    try {
      const cacheKey = CACHE_KEYS.REFRESH_TOKEN(tokenId);
      await this.cacheService.delete(cacheKey);
    } catch (error) {
      logger.warn({ error, tokenId }, 'Failed to remove cached refresh token');
    }
  }

  /**
   * Limpiar cache de tokens de usuario
   */
  private async clearUserTokenCache(userId: string): Promise<void> {
    try {
      // En una implementación real, aquí buscaríamos todos los tokens del usuario
      // y los removeríamos del cache uno por uno
      logger.debug({ userId }, 'User token cache cleared');
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to clear user token cache');
    }
  }
}