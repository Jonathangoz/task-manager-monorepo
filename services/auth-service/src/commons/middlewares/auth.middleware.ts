// src/presentation/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { config } from '../../config/config';
import { AppError } from '../errors/AppError';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  correlationId?: string;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

export class AuthMiddleware {
  /**
   * Middleware para verificar token JWT en las peticiones
   */
  static async verifyToken(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
    
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        logger.warn('Token no proporcionado', { correlationId });
        throw new AppError('Token de acceso requerido', 401);
      }

      // Verificar token con el servicio de autenticación
      const userData = await AuthMiddleware.verifyWithAuthService(token, correlationId);
      
      // Adjuntar información del usuario a la request
      req.user = userData;
      req.correlationId = correlationId;

      logger.info('Token verificado exitosamente', {
        correlationId,
        userId: userData.id,
        userEmail: userData.email
      });

      next();
    } catch (error) {
      logger.error('Error en verificación de token', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          correlationId
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Token inválido o expirado',
          correlationId
        });
      }
    }
  }

  /**
   * Middleware para verificar roles específicos
   */
  static requireRole(roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

      try {
        if (!req.user) {
          throw new AppError('Usuario no autenticado', 401);
        }

        if (!roles.includes(req.user.role)) {
          logger.warn('Acceso denegado por rol insuficiente', {
            correlationId,
            userRole: req.user.role,
            requiredRoles: roles,
            userId: req.user.id
          });
          
          throw new AppError('Permisos insuficientes', 403);
        }

        logger.info('Autorización de rol exitosa', {
          correlationId,
          userRole: req.user.role,
          userId: req.user.id
        });

        next();
      } catch (error) {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            success: false,
            message: error.message,
            correlationId
          });
        } else {
          res.status(403).json({
            success: false,
            message: 'Acceso denegado',
            correlationId
          });
        }
      }
    };
  }

  /**
   * Middleware opcional - no falla si no hay token
   */
  static async optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
    
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (token) {
        const userData = await AuthMiddleware.verifyWithAuthService(token, correlationId);
        req.user = userData;
      }

      req.correlationId = correlationId;
      next();
    } catch (error) {
      // En auth opcional, continuamos sin usuario
      req.correlationId = correlationId;
      next();
    }
  }

  /**
   * Extrae el token del header Authorization
   */
  private static extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
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
   * Verifica el token con el servicio de autenticación
   */
  private static async verifyWithAuthService(
    token: string, 
    correlationId: string
  ): Promise<TokenPayload> {
    try {
      const response = await axios.post(
        `${config.auth.serviceUrl}/api/v1/auth/verify-token`,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          },
          timeout: config.auth.verifyTimeout || 5000
        }
      );

      if (!response.data.success) {
        throw new AppError('Token inválido', 401);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new AppError('Token expirado o inválido', 401);
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          logger.error('Error de conectividad con servicio de auth', {
            correlationId,
            error: error.message
          });
          throw new AppError('Servicio de autenticación no disponible', 503);
        }
      }

      logger.error('Error inesperado en verificación de token', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      
      throw new AppError('Error interno del servidor', 500);
    }
  }
}

export const verifyToken = AuthMiddleware.verifyToken;
export const requireRole = AuthMiddleware.requireRole;
export const optionalAuth = AuthMiddleware.optionalAuth;