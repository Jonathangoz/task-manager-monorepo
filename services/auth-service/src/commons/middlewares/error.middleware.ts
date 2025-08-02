// src/presentation/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { environment } from '@/config/environment';
import { HTTP_STATUS, ERROR_CODES, ERROR_MESSAGES } from '@/utils/constants';

interface ErrorRequest extends Request {
  correlationId?: string;
  isHealthCheck?: boolean;
  skipTimeout?: boolean;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    correlationId?: string;
    timestamp: string;
    path: string;
    method: string;
  };
  stack?: string;
}

// Tipos para errores conocidos
interface ValidationErrorObject {
  name: string;
  message: string;
  errors?: Record<string, { message: string }>;
}

interface PrismaErrorObject {
  name: string;
  message: string;
  code: string;
  meta?: {
    target?: string[];
  };
}

interface SystemErrorObject {
  name: string;
  message: string;
  code?: string;
  type?: string;
  limit?: number;
  length?: number;
  stack?: string;
}

// Clase personalizada para errores de aplicación
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ErrorMiddleware {
  /**
   * Middleware principal de manejo de errores
   */
  static handle(
    error: unknown,
    req: ErrorRequest,
    res: Response,
    _next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Si ya se envió una respuesta, delegar al manejador de errores por defecto
    if (res.headersSent) {
      return _next(error);
    }

    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let errorCode: string = ERROR_CODES.INTERNAL_ERROR;
    let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
    let details: unknown = undefined;

    // Determinar el tipo de error y configurar la respuesta
    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
      details = error.details;
    } else if (ErrorMiddleware.isValidationError(error)) {
      statusCode = HTTP_STATUS.BAD_REQUEST;
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      message = ERROR_MESSAGES.VALIDATION_ERROR;
      details = ErrorMiddleware.formatValidationError(error);
    } else if (ErrorMiddleware.isPrismaValidationError(error)) {
      statusCode = HTTP_STATUS.BAD_REQUEST;
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      message = 'Error de validación en base de datos';
      details = { prismaError: (error as Error).message };
    } else if (ErrorMiddleware.isPrismaKnownRequestError(error)) {
      const prismaError = ErrorMiddleware.handlePrismaError(
        error as PrismaErrorObject,
      );
      statusCode = prismaError.statusCode;
      errorCode = prismaError.code;
      message = prismaError.message;
      details = prismaError.details;
    } else if (ErrorMiddleware.isJWTError(error)) {
      statusCode = HTTP_STATUS.UNAUTHORIZED;
      errorCode = ERROR_CODES.TOKEN_INVALID;
      message = ERROR_MESSAGES.TOKEN_INVALID;
    } else if (ErrorMiddleware.isTokenExpiredError(error)) {
      statusCode = HTTP_STATUS.UNAUTHORIZED;
      errorCode = ERROR_CODES.TOKEN_EXPIRED;
      message = ERROR_MESSAGES.TOKEN_EXPIRED;
    } else if (ErrorMiddleware.isConnectionError(error)) {
      statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
      errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
      message = ERROR_MESSAGES.SERVICE_UNAVAILABLE;
    } else if (ErrorMiddleware.isTimeoutError(error)) {
      statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
      errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
      message = 'Tiempo de espera agotado';
    }

    // Loggear el error según su severidad
    if (statusCode >= 500) {
      logger.error('Error interno del servidor', {
        correlationId,
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name,
          code: (error as SystemErrorObject).code,
        },
        request: {
          method: req.method,
          url: req.url,
          headers: ErrorMiddleware.sanitizeHeaders(req.headers),
          body: ErrorMiddleware.sanitizeBody(req.body),
          params: req.params,
          query: req.query,
        },
      });
    } else if (statusCode >= 400) {
      logger.warn('Error de cliente', {
        correlationId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name,
          code: (error as SystemErrorObject).code,
        },
        request: {
          method: req.method,
          url: req.url,
          params: req.params,
          query: req.query,
        },
      });
    }

    // Preparar respuesta de error
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        // ✅ FIX: Usar sintaxis condicional en lugar de spread
        ...(details !== undefined && { details }),
      },
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    };

    // Incluir stack trace solo en desarrollo
    if (environment.NODE_ENV === 'development' && (error as Error).stack) {
      errorResponse.stack = (error as Error).stack;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Middleware para capturar errores 404
   */
  static notFound(req: ErrorRequest, res: Response, _next: NextFunction): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.warn('Ruta no encontrada', {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });

    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND || 'NOT_FOUND',
        message: `Ruta ${req.method} ${req.url} no encontrada`,
      },
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    });
  }

  /**
   * Middleware para capturar errores asíncronos no manejados
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Type guards para identificar tipos de error
   */
  private static isValidationError(
    error: unknown,
  ): error is ValidationErrorObject {
    return (error as ValidationErrorObject)?.name === 'ValidationError';
  }

  private static isPrismaValidationError(error: unknown): error is Error {
    return (error as Error)?.name === 'PrismaClientValidationError';
  }

  private static isPrismaKnownRequestError(
    error: unknown,
  ): error is PrismaErrorObject {
    return (error as Error)?.name === 'PrismaClientKnownRequestError';
  }

  private static isJWTError(error: unknown): error is Error {
    return (error as Error)?.name === 'JsonWebTokenError';
  }

  private static isTokenExpiredError(error: unknown): error is Error {
    return (error as Error)?.name === 'TokenExpiredError';
  }

  private static isConnectionError(error: unknown): error is SystemErrorObject {
    return (error as SystemErrorObject)?.code === 'ECONNREFUSED';
  }

  private static isTimeoutError(error: unknown): error is SystemErrorObject {
    return (error as SystemErrorObject)?.code === 'ETIMEDOUT';
  }

  /**
   * Maneja errores específicos de Prisma
   */
  private static handlePrismaError(error: PrismaErrorObject): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.USER_ALREADY_EXISTS,
          message: 'El recurso ya existe',
          details: {
            field: error.meta?.target?.[0] || 'unknown',
            constraint: 'unique_violation',
          },
        };
      case 'P2025':
        return {
          statusCode: HTTP_STATUS.NOT_FOUND,
          code: ERROR_CODES.USER_NOT_FOUND,
          message: 'Recurso no encontrado',
        };
      case 'P2003':
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Error de referencia en base de datos',
          details: { constraint: 'foreign_key_violation' },
        };
      case 'P2011':
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Valor nulo en campo requerido',
          details: { constraint: 'null_constraint_violation' },
        };
      default:
        return {
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          code: ERROR_CODES.DATABASE_ERROR,
          message: ERROR_MESSAGES.DATABASE_CONNECTION_ERROR,
          details: { prismaCode: error.code },
        };
    }
  }

  /**
   * Formatea errores de validación
   */
  private static formatValidationError(
    error: ValidationErrorObject,
  ): Record<string, string> {
    const errors: Record<string, string> = {};

    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors![key].message;
      });
    }

    return errors;
  }

  /**
   * Middleware para manejar errores de límite de tamaño de payload
   */
  static payloadTooLarge(
    error: unknown,
    req: ErrorRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const systemError = error as SystemErrorObject;
    if (systemError.type === 'entity.too.large') {
      logger.warn('Payload demasiado grande', {
        correlationId,
        limit: systemError.limit,
        length: systemError.length,
        method: req.method,
        url: req.url,
      });

      res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'El tamaño del payload excede el límite permitido',
          details: {
            limit: systemError.limit,
            received: systemError.length,
          },
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
      return;
    }

    next(error);
  }

  /**
   * Maneja errores de timeout específicos
   */
  static handleTimeout(
    req: ErrorRequest,
    res: Response,
    _next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ✅ CRÍTICO: NO responder si es un health check
    const isHealthCheck =
      req.path.includes('/health') ||
      req.path === '/ping' ||
      req.path === '/status' ||
      req.path === '/healthz' ||
      req.isHealthCheck ||
      req.skipTimeout;

    if (isHealthCheck) {
      // Para health checks, solo log debug (no warning)
      logger.debug('Health check timeout (ignoring)', {
        correlationId,
        method: req.method,
        url: req.url,
      });
      return; // ✅ NO responder para health checks
    }

    // Solo log para requests que NO son health checks
    logger.warn('Request timeout', {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Solo responder si no se han enviado headers
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Tiempo de espera de la petición agotado',
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
    }
  }

  /**
   * Middleware para capturar errores de parsing JSON
   */
  static handleJSONError(
    error: unknown,
    req: ErrorRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId =
      req.correlationId ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (error instanceof SyntaxError && 'body' in error) {
      logger.warn('Error de sintaxis JSON', {
        correlationId,
        error: (error as Error).message,
        method: req.method,
        url: req.url,
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'JSON inválido en el cuerpo de la petición',
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
      return;
    }

    next(error);
  }

  /**
   * Sanitiza headers sensibles para logging
   */
  private static sanitizeHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitiza body sensible para logging
   */
  private static sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitiveFields = [
      'password',
      'token',
      'refreshToken',
      'oldPassword',
      'newPassword',
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDRACTED]';
      }
    });

    return sanitized;
  }
}

// Configurar manejadores de errores no capturados globalmente
process.on('uncaughtException', (error: Error) => {
  logger.error('Excepción no capturada', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  });

  // Cerrar el servidor gracefully
  process.exit(1);
});

process.on(
  'unhandledRejection',
  (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Promesa rechazada no manejada', {
      reason:
        reason instanceof Error
          ? {
              message: reason.message,
              stack: reason.stack,
              name: reason.name,
            }
          : reason,
      promise: promise.toString(),
    });

    // Cerrar el servidor gracefully
    process.exit(1);
  },
);

// Exportar middlewares para uso directo
export const errorHandler = ErrorMiddleware.handle;
export const notFoundHandler = ErrorMiddleware.notFound;
export const asyncHandler = ErrorMiddleware.asyncHandler;
export const payloadTooLargeHandler = ErrorMiddleware.payloadTooLarge;
export const timeoutHandler = ErrorMiddleware.handleTimeout;
export const jsonErrorHandler = ErrorMiddleware.handleJSONError;
