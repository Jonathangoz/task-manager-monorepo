// src/core/application/AuthMiddleware.ts
// ==============================================

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';
import { ERROR_CODES, ERROR_MESSAGES, EVENT_TYPES } from '@/utils/constants';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export class AuthMiddleware {
  private static authServiceClient = axios.create({
    baseURL: config.auth.serviceUrl,
    timeout: config.auth.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': config.auth.apiKey,
      'User-Agent': 'TaskService/1.0'
    }
  });

  /**
   * Middleware principal de autenticación
   */
  static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extraer token del header Authorization
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        logger.warn({ 
          ip: req.ip, 
          userAgent: req.get('User-Agent'),
          event: EVENT_TYPES.AUTH_TOKEN_VALIDATED 
        }, 'Authentication token missing');
        
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED
          }
        });
        return;
      }

      // Validar token con el Auth Service
      const user = await AuthMiddleware.validateToken(token);
      
      if (!user) {
        logger.warn({ 
          ip: req.ip, 
          token: token.substring(0, 20) + '...',
          event: EVENT_TYPES.AUTH_TOKEN_VALIDATED 
        }, 'Invalid authentication token');
        
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
            message: ERROR_MESSAGES.INVALID_TOKEN
          }
        });
        return;
      }

      // Agregar usuario y token al request
      req.user = user;
      req.token = token;

      logger.info({ 
        userId: user.id, 
        email: user.email,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        event: EVENT_TYPES.AUTH_TOKEN_VALIDATED 
      }, 'User authenticated successfully');

      next();

    } catch (error) {
      logger.error({ 
        error, 
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        event: EVENT_TYPES.AUTH_SERVICE_ERROR 
      }, 'Authentication middleware error');

      res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_SERVICE_ERROR,
          message: ERROR_MESSAGES.AUTH_SERVICE_ERROR
        }
      });
    }
  }

  /**
   * Middleware opcional de autenticación (para endpoints públicos)
   */
  static async optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (token) {
        const user = await AuthMiddleware.validateToken(token);
        if (user) {
          req.user = user;
          req.token = token;
          
          logger.info({ 
            userId: user.id, 
            email: user.email,
            event: EVENT_TYPES.AUTH_TOKEN_VALIDATED 
          }, 'Optional authentication successful');
        }
      }

      next();

    } catch (error) {
      logger.warn({ error }, 'Optional authentication failed, continuing without user');
      next();
    }
  }

  /**
   * Middleware para verificar permisos específicos
   */
  static requirePermission(permission: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS
          }
        });
        return;
      }

      if (req.user.permissions && !req.user.permissions.includes(permission)) {
        logger.warn({ 
          userId: req.user.id, 
          requiredPermission: permission,
          userPermissions: req.user.permissions 
        }, 'User lacks required permission');
        
        res.status(403).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Middleware para verificar roles específicos
   */
  static requireRole(role: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS
          }
        });
        return;
      }

      if (req.user.role !== role) {
        logger.warn({ 
          userId: req.user.id, 
          requiredRole: role,
          userRole: req.user.role 
        }, 'User lacks required role');
        
        res.status(403).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Extraer token del header Authorization
   */
  private static extractToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    
    if (!authHeader) {
      return null;
    }

    // Formato: "Bearer <token>"
    const matches = authHeader.match(/Bearer\s+(.+)/i);
    return matches ? matches[1] : null;
  }

  /**
   * Validar token con el Auth Service
   */
  private static async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const response = await AuthMiddleware.authServiceClient.post('/api/v1/auth/verify-token', {
        token
      });

      if (response.status === 200 && response.data.success) {
        return response.data.data.user;
      }

      return null;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          logger.warn({ error: error.response.data }, 'Token validation failed');
          return null;
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          logger.error({ error: error.message }, 'Auth service connection failed');
          throw new Error(ERROR_MESSAGES.AUTH_SERVICE_ERROR);
        }
      }

      logger.error({ error }, 'Unexpected error during token validation');
      throw error;
    }
  }

  /**
   * Obtener información adicional del usuario desde el Auth Service
   */
  static async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await AuthMiddleware.authServiceClient.get(`/api/v1/users/${userId}/profile`);
      
      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      return null;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user profile from auth service');
      throw error;
    }
  }

  /**
   * Verificar si el Auth Service está disponible
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await AuthMiddleware.authServiceClient.get('/api/v1/health', {
        timeout: 3000
      });
      
      return response.status === 200;

    } catch (error) {
      logger.error({ error }, 'Auth service health check failed');
      return false;
    }
  }
}