// src/core/application/AuthMiddleware.ts
// Middleware de autenticación para Task Service
// Integrado con Auth Service, logging estructurado y configuración centralizada

import { Request, Response, NextFunction } from 'express';
import axios, { AxiosInstance } from 'axios';
import { logger, logError, loggers } from '@/utils/logger';
import { config } from '@/config/environment';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  EVENT_TYPES,
  AUTH_ENDPOINTS,
  REQUEST_HEADERS,
  CONTENT_TYPES,
  SERVICE_NAMES,
  HTTP_STATUS
} from '@/utils/constants';

// INTERFACES Y TIPOS
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

// AUTH MIDDLEWARE CLASS
export class AuthMiddleware {
  private static authServiceClient: AxiosInstance;
  private static isInitialized = false;


  // INICIALIZACIÓN DEL CLIENTE HTTP

  private static initializeClient(): void {
    if (AuthMiddleware.isInitialized) return;

    AuthMiddleware.authServiceClient = axios.create({
      baseURL: config.authService.url,
      timeout: 5000, // 5 segundos timeout
      headers: {
        [REQUEST_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [REQUEST_HEADERS.USER_AGENT]: `${SERVICE_NAMES.TASK_SERVICE}/1.0`,
      },
      // Configuración adicional para producción
      maxRedirects: 0,
      validateStatus: (status) => status < 500, // No rechazar 4xx
    });

    // Interceptor para logging de requests
    AuthMiddleware.authServiceClient.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        
        loggers.authService('request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
        });
        
        return config;
      },
      (error) => {
        logError.medium(error, { context: 'auth_service_request_interceptor' });
        return Promise.reject(error);
      }
    );

    // Interceptor para logging de responses
    AuthMiddleware.authServiceClient.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        loggers.authService('response', {
          status: response.status,
          duration,
          url: response.config.url,
        });
        
        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);
        
        loggers.authService('error', {
          status: error.response?.status,
          duration,
          url: error.config?.url,
          message: error.message,
        });
        
        return Promise.reject(error);
      }
    );

    AuthMiddleware.isInitialized = true;
    
    logger.info({
      authServiceUrl: config.authService.url,
      timeout: 5000,
      event: 'auth.middleware.initialized',
      domain: 'authentication',
    }, '🔐 Auth middleware inicializado correctamente');
  }


  // MIDDLEWARE PRINCIPAL DE AUTENTICACIÓN

  static async authenticate(
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    AuthMiddleware.initializeClient();
    
    const startTime = Date.now();
    const requestId = req.get(REQUEST_HEADERS.X_REQUEST_ID) || 'unknown';
    
    try {
      // Extraer token del header Authorization
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        const duration = Date.now() - startTime;
        
        logger.warn({ 
          ip: req.ip, 
          userAgent: req.get(REQUEST_HEADERS.USER_AGENT),
          method: req.method,
          url: req.originalUrl,
          requestId,
          duration,
          event: EVENT_TYPES.AUTH_TOKEN_VALIDATED,
          domain: 'authentication',
        }, '⚠️ Token de autenticación faltante');
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      // Validar token con el Auth Service  
      const user = await AuthMiddleware.validateToken(token);
      
      if (!user) {
        const duration = Date.now() - startTime;
        
        logger.warn({ 
          ip: req.ip, 
          tokenPreview: token.substring(0, 20) + '...',
          method: req.method,
          url: req.originalUrl,
          requestId,
          duration,
          event: EVENT_TYPES.AUTH_TOKEN_VALIDATED,
          domain: 'authentication',
        }, '⚠️ Token de autenticación inválido');
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.INVALID_TOKEN,
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      // Agregar usuario y token al request
      req.user = user;
      req.token = token;

      const duration = Date.now() - startTime;
      
      logger.info({ 
        userId: user.id, 
        email: user.email,
        role: user.role,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        requestId,
        duration,
        event: EVENT_TYPES.AUTH_TOKEN_VALIDATED,
        domain: 'authentication',
      }, '✅ Usuario autenticado exitosamente');

      next();

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError.high(error as Error, {
        context: 'auth_middleware',
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        requestId,
        duration,
      });

      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        requestId,
        duration,
        event: EVENT_TYPES.AUTH_SERVICE_ERROR,
        domain: 'authentication',
      }, '❌ Error en middleware de autenticación');

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.AUTH_SERVICE_ERROR,
        error: {
          code: ERROR_CODES.AUTH_SERVICE_ERROR,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }
  }


  // MIDDLEWARE OPCIONAL DE AUTENTICACIÓN

  static async optionalAuthenticate(
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    AuthMiddleware.initializeClient();
    
    const requestId = req.get(REQUEST_HEADERS.X_REQUEST_ID) || 'unknown';
    
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
            requestId,
            event: EVENT_TYPES.AUTH_TOKEN_VALIDATED,
            domain: 'authentication',
          }, '✅ Autenticación opcional exitosa');
        } else {
          logger.debug({ 
            tokenPreview: token.substring(0, 20) + '...',
            requestId,
            event: EVENT_TYPES.AUTH_TOKEN_VALIDATED,
            domain: 'authentication',
          }, '⚠️ Token inválido en autenticación opcional');
        }
      }

      next();

    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        requestId,
        event: EVENT_TYPES.AUTH_SERVICE_ERROR,
        domain: 'authentication',
      }, '⚠️ Autenticación opcional falló, continuando sin usuario');
      
      next();
    }
  }


  // MIDDLEWARE PARA VERIFICAR PERMISOS

  static requirePermission(permission: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const requestId = req.get(REQUEST_HEADERS.X_REQUEST_ID) || 'unknown';
      
      if (!req.user) {
        logger.warn({
          requiredPermission: permission,
          requestId,
          ip: req.ip,
          event: 'auth.permission.denied',
          domain: 'authorization',
        }, '⚠️ Usuario no autenticado intentando acceder a recurso protegido');
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      if (req.user.permissions && !req.user.permissions.includes(permission)) {
        logger.warn({ 
          userId: req.user.id, 
          requiredPermission: permission,
          userPermissions: req.user.permissions,
          requestId,
          event: 'auth.permission.denied',
          domain: 'authorization',
        }, '⚠️ Usuario sin permisos suficientes');
        
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            details: {
              requiredPermission: permission,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      logger.debug({
        userId: req.user.id,
        permission,
        requestId,
        event: 'auth.permission.granted',
        domain: 'authorization',
      }, '✅ Permiso verificado correctamente');

      next();
    };
  }


  // MIDDLEWARE PARA VERIFICAR ROLES

  static requireRole(role: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const requestId = req.get(REQUEST_HEADERS.X_REQUEST_ID) || 'unknown';
      
      if (!req.user) {
        logger.warn({
          requiredRole: role,
          requestId,
          ip: req.ip,
          event: 'auth.role.denied',
          domain: 'authorization',
        }, '⚠️ Usuario no autenticado intentando acceder a recurso con rol específico');
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      if (req.user.role !== role) {
        logger.warn({ 
          userId: req.user.id, 
          requiredRole: role,
          userRole: req.user.role,
          requestId,
          event: 'auth.role.denied',
          domain: 'authorization',
        }, '⚠️ Usuario sin rol requerido');
        
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            details: {
              requiredRole: role,
              userRole: req.user.role,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
        return;
      }

      logger.debug({
        userId: req.user.id,
        role,
        requestId,
        event: 'auth.role.granted',
        domain: 'authorization',
      }, '✅ Rol verificado correctamente');

      next();
    };
  }


  // MÉTODOS PRIVADOS DE UTILIDAD

  
  /**
   * Extraer token del header Authorization
   */
  private static extractToken(req: Request): string | null {
    const authHeader = req.get(REQUEST_HEADERS.AUTHORIZATION);
    
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
    const startTime = Date.now();
    
    try {
      const response = await AuthMiddleware.authServiceClient.post(
        AUTH_ENDPOINTS.VERIFY_TOKEN,
        { token }
      );

      const duration = Date.now() - startTime;

      if (response.status === HTTP_STATUS.OK && response.data.success) {
        logger.debug({
          duration,
          event: 'auth.token.validation.success',
          domain: 'authentication',
        }, '✅ Token validado correctamente con Auth Service');
        
        return response.data.data.user;
      }

      logger.debug({
        status: response.status,
        duration,
        event: 'auth.token.validation.failed',
        domain: 'authentication',
      }, '⚠️ Respuesta de Auth Service indica token inválido');

      return null;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
          logger.debug({ 
            error: error.response.data,
            duration,
            event: 'auth.token.validation.unauthorized',
            domain: 'authentication',
          }, '⚠️ Token rechazado por Auth Service');
          return null;
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          const errorMsg = `Auth Service no disponible: ${error.message}`;
          
          logError.critical(new Error(errorMsg), {
            context: 'auth_service_connection',
            errorCode: error.code,
            duration,
          });
          
          throw new Error(ERROR_MESSAGES.AUTH_SERVICE_ERROR);
        }
      }

      logError.high(error as Error, {
        context: 'token_validation',
        duration,
      });
      
      throw error;
    }
  }


  // MÉTODOS PÚBLICOS ADICIONALES

  
  /**
   * Obtener información adicional del usuario desde el Auth Service
   */
  static async getUserProfile(userId: string): Promise<any> {
    AuthMiddleware.initializeClient();
    
    const startTime = Date.now();
    
    try {
      const response = await AuthMiddleware.authServiceClient.get(
        AUTH_ENDPOINTS.GET_USER.replace(':id', userId)
      );
      
      const duration = Date.now() - startTime;

      if (response.status === HTTP_STATUS.OK && response.data.success) {
        logger.debug({
          userId,
          duration,
          event: 'auth.user.profile.retrieved',
          domain: 'authentication',
        }, '✅ Perfil de usuario obtenido correctamente');
        
        return response.data.data;
      }

      logger.warn({
        userId,
        status: response.status,
        duration,
        event: 'auth.user.profile.not_found',
        domain: 'authentication',
      }, '⚠️ Perfil de usuario no encontrado');

      return null;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError.medium(error as Error, {
        context: 'get_user_profile',
        userId,
        duration,
      });
      
      throw error;
    }
  }

  /**
   * Verificar si el Auth Service está disponible
   */
  static async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    AuthMiddleware.initializeClient();
    
    const startTime = Date.now();
    
    try {
      const response = await AuthMiddleware.authServiceClient.get('/api/v1/health', {
        timeout: 3000,
      });
      
      const duration = Date.now() - startTime;
      const healthy = response.status === HTTP_STATUS.OK;
      
      const details = {
        status: response.status,
        responseTime: duration,
        url: config.authService.url,
        available: healthy,
      };

      if (healthy) {
        logger.debug({
          ...details,
          event: 'auth.service.health.ok',
          domain: 'authentication',
        }, '✅ Auth Service saludable');
      } else {
        logger.warn({
          ...details,
          event: 'auth.service.health.degraded',
          domain: 'authentication',
        }, '⚠️ Auth Service con problemas');
      }

      return { healthy, details };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      const details = {
        error: error instanceof Error ? error.message : String(error),
        responseTime: duration,
        url: config.authService.url,
        available: false,
      };

      logger.error({
        ...details,
        event: 'auth.service.health.failed',
        domain: 'authentication',
      }, '❌ Auth Service no disponible');

      return { healthy: false, details };
    }
  }
}

// EXPORTS ADICIONALES PARA CONVENIENCIA
export const authenticate = AuthMiddleware.authenticate;
export const optionalAuthenticate = AuthMiddleware.optionalAuthenticate;
export const requirePermission = AuthMiddleware.requirePermission;
export const requireRole = AuthMiddleware.requireRole;
export const authHealthCheck = AuthMiddleware.healthCheck;