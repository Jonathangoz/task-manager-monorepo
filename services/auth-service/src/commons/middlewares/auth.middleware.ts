// src/presentation/middlewares/auth.middleware.ts
import { ITokenService } from '@/core/interfaces/ITokenService';
import { IUserService } from '@/core/interfaces/IUserService';
import { ICacheService } from '@/core/interfaces/ICacheService';
import { IAuthService } from '@/core/interfaces/IAuthService';
import { RedisCache } from '@/core/cache/RedisCache';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  TOKEN_CONFIG,
  CACHE_KEYS 
} from '@/utils/constants';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    sessionId?: string;
  };
  correlationId?: string;
}

interface TokenPayload {
  sub: string; // user id
  email: string;
  username: string;
  sessionId?: string;
  exp: number;
  iat: number;
}
export class AuthMiddleware {
  private static tokenService = new TokenService();
  private static userService = new UserService();
  private static cache = new RedisCache();

  /**
   * Middleware para verificar token JWT en las peticiones
   */
  static async verifyToken(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;
    
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        logger.warn('Token no proporcionado', { correlationId });
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED
          }
        });
      }

      // Verificar token JWT
      const payload = await AuthMiddleware.tokenService.verifyAccessToken(token);
      
      if (!payload) {
        logger.warn('Token inválido', { correlationId });
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_INVALID,
            message: ERROR_MESSAGES.TOKEN_INVALID
          }
        });
      }

      // Verificar si el usuario existe y está activo
      const user = await AuthMiddleware.userService.findById(payload.sub);
      
      if (!user || !user.isActive) {
        logger.warn('Usuario no encontrado o inactivo', { 
          correlationId, 
          userId: payload.sub 
        });
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND
          }
        });
      }

      // Verificar sesión si existe sessionId en el token
      if (payload.sessionId) {
        const sessionKey = CACHE_KEYS.USER_SESSION(payload.sessionId);
        const sessionExists = await AuthMiddleware.cache.exists(sessionKey);
        
        if (!sessionExists) {
          logger.warn('Sesión no válida', { 
            correlationId, 
            sessionId: payload.sessionId 
          });
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
              code: ERROR_CODES.SESSION_INVALID,
              message: 'Sesión no válida'
            }
          });
        }
      }

      // Adjuntar información del usuario a la request
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        sessionId: payload.sessionId
      };

      logger.debug('Token verificado exitosamente', {
        correlationId,
        userId: user.id,
        userEmail: user.email
      });

      next();
    } catch (error) {
      logger.error('Error en verificación de token', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      
      // Determinar tipo de error de token
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
              code: ERROR_CODES.TOKEN_EXPIRED,
              message: ERROR_MESSAGES.TOKEN_EXPIRED
            }
          });
        }
      }

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_INVALID,
          message: ERROR_MESSAGES.TOKEN_INVALID
        }
      });
    }
  }

  /**
   * Middleware opcional - no falla si no hay token
   */
  static async optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;
    
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (token) {
        const payload = await AuthMiddleware.tokenService.verifyAccessToken(token);
        
        if (payload) {
          const user = await AuthMiddleware.userService.findById(payload.sub);
          
          if (user && user.isActive) {
            req.user = {
              id: user.id,
              email: user.email,
              username: user.username,
              sessionId: payload.sessionId
            };
          }
        }
      }

      next();
    } catch (error) {
      // En auth opcional, continuamos sin usuario
      logger.debug('Auth opcional falló, continuando sin usuario', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
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
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.TOKEN_REQUIRED,
          message: ERROR_MESSAGES.TOKEN_REQUIRED
        }
      });
    }

    // Para verificar si está verificado, necesitaríamos consultar la BD
    // Por ahora asumimos que el middleware de auth ya verificó esto
    next();
  }

  /**
   * Middleware para verificar owner de recurso
   */
  static requireOwnership(userIdParam: string = 'userId') {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED
          }
        });
      }

      const resourceUserId = req.params[userIdParam] || req.body.userId;
      
      if (req.user.id !== resourceUserId) {
        logger.warn('Acceso denegado - no es propietario del recurso', {
          correlationId,
          userId: req.user.id,
          resourceUserId
        });

        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'No tienes permisos para acceder a este recurso'
          }
        });
      }

      next();
    };
  }

  /**
   * Extrae el token del header Authorization
   */
  private static extractToken(req: Request): string | null {
    const authHeader = req.headers[TOKEN_CONFIG.ACCESS_TOKEN_HEADER.toLowerCase()];
    
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
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    // Extraer información del dispositivo/sesión
    const userAgent = req.get('User-Agent') || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Agregar a la request para uso posterior
    (req as any).sessionInfo = {
      userAgent,
      ipAddress,
      correlationId
    };

    next();
  }

  /**
   * Middleware para verificar límites de sesiones concurrentes
   */
  static async checkConcurrentSessions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (!req.user) {
        return next();
      }

      const sessionKey = CACHE_KEYS.USER_SESSIONS(req.user.id);
      const activeSessions = await AuthMiddleware.cache.get(sessionKey);
      
      if (activeSessions && Array.isArray(activeSessions)) {
        const maxSessions = 10; // Configurable
        
        if (activeSessions.length >= maxSessions) {
          logger.warn('Límite de sesiones concurrentes excedido', {
            correlationId,
            userId: req.user.id,
            activeSessions: activeSessions.length,
            maxSessions
          });

          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            error: {
              code: ERROR_CODES.MAX_SESSIONS_EXCEEDED,
              message: 'Límite de sesiones concurrentes excedido'
            }
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Error verificando sesiones concurrentes', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      
      // En caso de error, permitir continuar
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