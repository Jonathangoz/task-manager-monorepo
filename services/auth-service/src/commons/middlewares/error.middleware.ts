// src/presentation/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

interface ErrorRequest extends Request {
  correlationId?: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  correlationId?: string;
  stack?: string;
  details?: any;
}

export class ErrorMiddleware {
  /**
   * Middleware principal de manejo de errores
   */
  static handle(
    error: any,
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

    // Si ya se envió una respuesta, delegar al manejador de errores por defecto
    if (res.headersSent) {
      return next(error);
    }

    let statusCode = 500;
    let message = 'Error interno del servidor';
    let details: any = undefined;

    // Determinar el tipo de error y configurar la respuesta
    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
      details = error.details;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Error de validación';
      details = ErrorMiddleware.formatValidationError(error);
    } else if (error.name === 'CastError') {
      statusCode = 400;
      message = 'Formato de datos inválido';
      details = { field: error.path, value: error.value };
    } else if (error.code === 11000) {
      statusCode = 409;
      message = 'Recurso duplicado';
      details = ErrorMiddleware.formatDuplicateKeyError(error);
    } else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Token inválido';
    } else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expirado';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      message = 'Servicio no disponible';
    } else if (error.code === 'ETIMEDOUT') {
      statusCode = 504;
      message = 'Tiempo de espera agotado';
    }

    // Loggear el error según su severidad
    if (statusCode >= 500) {
      logger.error('Error interno del servidor', {
        correlationId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code
        },
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
          params: req.params,
          query: req.query
        }
      });
    } else if (statusCode >= 400) {
      logger.warn('Error de cliente', {
        correlationId,
        error: {
          message: error.message,
          name: error.name,
          code: error.code
        },
        request: {
          method: req.method,
          url: req.url,
          params: req.params,
          query: req.query
        }
      });
    }

    // Preparar respuesta de error
    const errorResponse: ErrorResponse = {
      success: false,
      message,
      correlationId
    };

    // Incluir detalles adicionales en desarrollo
    if (details) {
      errorResponse.details = details;
    }

    // Incluir stack trace solo en desarrollo
    if (config.app.environment === 'development' && error.stack) {
      errorResponse.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Middleware para capturar errores 404
   */
  static notFound(
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

    logger.warn('Ruta no encontrada', {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    });

    res.status(404).json({
      success: false,
      message: `Ruta ${req.method} ${req.url} no encontrada`,
      correlationId
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
   * Formatea errores de validación de Mongoose/MongoDB
   */
  private static formatValidationError(error: any): any {
    const errors: any = {};
    
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
    }

    return errors;
  }

  /**
   * Formatea errores de clave duplicada de MongoDB
   */
  private static formatDuplicateKeyError(error: any): any {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    
    return {
      field,
      value,
      message: `El valor '${value}' ya existe para el campo '${field}'`
    };
  }

  /**
   * Middleware para manejar errores de límite de tamaño de payload
   */
  static payloadTooLarge(
    error: any,
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

    if (error.type === 'entity.too.large') {
      logger.warn('Payload demasiado grande', {
        correlationId,
        limit: error.limit,
        length: error.length,
        method: req.method,
        url: req.url
      });

      res.status(413).json({
        success: false,
        message: 'El tamaño del payload excede el límite permitido',
        correlationId,
        details: {
          limit: error.limit,
          received: error.length
        }
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
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

    logger.warn('Request timeout', {
      correlationId,
      method: req.method,
      url: req.url,
      timeout: config.server.timeout || 30000
    });

    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Tiempo de espera de la petición agotado',
        correlationId
      });
    }
  }

  /**
   * Middleware para capturar errores de parsing JSON
   */
  static handleJSONError(
    error: any,
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;

    if (error instanceof SyntaxError && 'body' in error) {
      logger.warn('Error de sintaxis JSON', {
        correlationId,
        error: error.message,
        method: req.method,
        url: req.url
      });

      res.status(400).json({
        success: false,
        message: 'JSON inválido en el cuerpo de la petición',
        correlationId
      });
      return;
    }

    next(error);
  }
}

// Configurar manejadores de errores no capturados globalmente
process.on('uncaughtException', (error: Error) => {
  logger.error('Excepción no capturada', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
  
  // Cerrar el servidor gracefully
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Promesa rechazada no manejada', {
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : reason,
    promise: promise.toString()
  });
  
  // Cerrar el servidor gracefully
  process.exit(1);
});

// Exportar middlewares para uso directo
export const errorHandler = ErrorMiddleware.handle;
export const notFoundHandler = ErrorMiddleware.notFound;
export const asyncHandler = ErrorMiddleware.asyncHandler;
export const payloadTooLargeHandler = ErrorMiddleware.payloadTooLarge;
export const timeoutHandler = ErrorMiddleware.handleTimeout;
export const jsonErrorHandler = ErrorMiddleware.handleJSONError;