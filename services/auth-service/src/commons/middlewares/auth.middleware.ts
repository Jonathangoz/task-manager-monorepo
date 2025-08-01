// src/presentation/middlewares/auth.middleware.ts
import { ITokenService } from '@/core/interfaces/ITokenService';
import { IUserService } from '@/core/interfaces/IUserService';
import { ICacheService } from '@/core/interfaces/ICacheService';
import { TokenPayload } from '@/core/interfaces/IAuthService';
import { RedisCache } from '@/core/cache/RedisCache';
import { Request, Response, NextFunction } from 'express';
import AuthenticatedRequest from '@/typeExpress/express';
import { logger } from '@/utils/logger';
import {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  TOKEN_CONFIG,
  CACHE_KEYS,
} from '@/utils/constants';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

export class AuthMiddleware {
  private static tokenService: ITokenService;
  private static userService: IUserService;
  private static cache: ICacheService = new RedisCache();

  // Método para configurar las dependencias
  static configure(
    tokenService: ITokenService,
    userService: IUserService,
    cache?: ICacheService,
  ): void {
    AuthMiddleware.tokenService = tokenService;
    AuthMiddleware.userService = userService;
    if (cache) {
      AuthMiddleware.cache = cache;
    }
  }

  /**
   * Middleware para verificar token JWT en las peticiones
   */
  static async verifyToken(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!AuthMiddleware.tokenService || !AuthMiddleware.userService) {
      throw new Error(
        'AuthMiddleware no ha sido configurado. Llama a AuthMiddleware.configure() primero.',
      );
    }

    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    try {
      const token = AuthMiddleware.extractToken(req);

      if (!token) {
        logger.warn('Token no proporcionado', { correlationId });
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
        });
        return;
      }

      const payload: TokenPayload =
        await AuthMiddleware.tokenService.validateAccessToken(token);

      if (!payload) {
        logger.warn('Token inválido', { correlationId });
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_INVALID,
            message: ERROR_MESSAGES.TOKEN_INVALID,
          },
        });
        return;
      }

      const user = await AuthMiddleware.userService.findById(payload.sub);

      if (!user || !user.isActive) {
        logger.warn('Usuario no encontrado o inactivo', {
          correlationId,
          userId: payload.sub,
        });
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
        });
        return;
      }

      if (payload.sessionId) {
        const sessionKey = CACHE_KEYS.USER_SESSION(payload.sessionId);
        const sessionExists = await AuthMiddleware.cache.exists(sessionKey);

        if (!sessionExists) {
          logger.warn('Sesión no válida', {
            correlationId,
            sessionId: payload.sessionId,
          });
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
              code: ERROR_CODES.SESSION_INVALID,
              message: 'Sesión no válida',
            },
          });
          return;
        }
      }

      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        sessionId: payload.sessionId,
        iat: payload.iat,
        exp: payload.exp,
      };

      logger.debug('Token verificado exitosamente', {
        correlationId,
        userId: user.id,
        userEmail: user.email,
      });

      next();
    } catch (error) {
      logger.error('Error en verificación de token', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });

      if (error instanceof Error && error.message.includes('expired')) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_EXPIRED,
            message: ERROR_MESSAGES.TOKEN_EXPIRED,
          },
        });
        return;
      }

      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_INVALID,
          message: ERROR_MESSAGES.TOKEN_INVALID,
        },
      });
    }
  }

  /**
   * Middleware opcional - no falla si no hay token
   */
  static async optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!AuthMiddleware.tokenService || !AuthMiddleware.userService) {
      next();
      return;
    }

    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    try {
      const token = AuthMiddleware.extractToken(req);

      if (token) {
        const payload =
          await AuthMiddleware.tokenService.validateAccessToken(token);

        if (payload) {
          const user = await AuthMiddleware.userService.findById(payload.sub);

          if (user && user.isActive) {
            req.user = {
              id: user.id,
              email: user.email,
              username: user.username,
              sessionId: payload.sessionId,
              iat: payload.iat,
              exp: payload.exp,
            };
          }
        }
      }

      next();
    } catch (error) {
      logger.debug('Auth opcional falló, continuando sin usuario', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
      next();
    }
  }

  /**
   * Middleware para verificar que el usuario esté verificado
   */
  static requireVerifiedUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_REQUIRED,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
        },
      });
      return;
    }

    next();
  }

  /**
   * Middleware para verificar owner de recurso
   */
  static requireOwnership(userIdParam: string = 'userId') {
    return (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ): void => {
      const correlationId =
        req.correlationId ||
        `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body.userId;

      if (req.user.id !== resourceUserId) {
        logger.warn('Acceso denegado - no es propietario del recurso', {
          correlationId,
          userId: req.user.id,
          resourceUserId,
        });

        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'No tienes permisos para acceder a este recurso',
          },
        });
        return;
      }

      next();
    };
  }

  /**
   * Extrae el token del header Authorization
   */
  private static extractToken(req: Request): string | null {
    const authHeader =
      req.headers[TOKEN_CONFIG.ACCESS_TOKEN_HEADER.toLowerCase()];

    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== TOKEN_CONFIG.TOKEN_PREFIX.trim()) {
      return null;
    }

    return parts[1];
  }

  /**
   * Middleware para extraer información de sesión
   */
  static extractSessionInfo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    const userAgent = req.get('User-Agent') || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    (req as any).sessionInfo = {
      userAgent,
      ipAddress,
      correlationId,
    };

    next();
  }

  /**
   * Middleware para verificar límites de sesiones concurrentes
   */
  static async checkConcurrentSessions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (!req.user) {
        next();
        return;
      }

      const sessionKey = CACHE_KEYS.USER_SESSIONS(req.user.id);
      const activeSessions = await AuthMiddleware.cache.get(sessionKey);

      if (activeSessions && Array.isArray(activeSessions)) {
        const maxSessions = 10;

        if (activeSessions.length >= maxSessions) {
          logger.warn('Límite de sesiones concurrentes excedido', {
            correlationId,
            userId: req.user.id,
            activeSessions: activeSessions.length,
            maxSessions,
          });

          res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            error: {
              code: ERROR_CODES.MAX_SESSIONS_EXCEEDED,
              message: 'Límite de sesiones concurrentes excedido',
            },
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Error verificando sesiones concurrentes', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });

      next();
    }
  }
}

// Exportar middlewares para uso directo
export const verifyToken = AuthMiddleware.verifyToken;
export const optionalAuth = AuthMiddleware.optionalAuth;
export const requireVerifiedUser = AuthMiddleware.requireVerifiedUser;
export const requireOwnership = AuthMiddleware.requireOwnership;
export const extractSessionInfo = AuthMiddleware.extractSessionInfo;
export const checkConcurrentSessions = AuthMiddleware.checkConcurrentSessions;
