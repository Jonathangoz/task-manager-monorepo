// src/presentation/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  ApiResponse 
} from '@/utils/constants';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ValidationMiddleware');

/**
 * ValidationMiddleware
 * 
 * Middleware centralizado para el manejo de validaciones usando express-validator.
 * Implementa principios SOLID y buenas prácticas de manejo de errores.
 * 
 * Responsabilidades:
 * - Procesar resultados de validación de express-validator
 * - Formatear errores de validación de manera consistente
 * - Proporcionar logging detallado para debugging
 * - Integración con el sistema de constantes y tipos
 */
export class ValidationMiddleware {
  
  /**
   * Middleware principal para validar requests
   * Procesa los resultados de express-validator y formatea errores
   */
  static validate() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const errors = validationResult(req);
        
        if (errors.isEmpty()) {
          // Si no hay errores, continuar con el siguiente middleware
          return next();
        }

        // Formatear errores de validación
        const formattedErrors = ValidationMiddleware.formatValidationErrors(errors.array());
        
        // Log para debugging
        ValidationMiddleware.logValidationErrors(req, formattedErrors);
        
        // Respuesta de error consistente
        const errorResponse: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            details: formattedErrors
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || undefined
          }
        };

        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(errorResponse);
      } catch (error) {
        // Si ocurre un error interno en el middleware de validación
        logger.error('Error interno en middleware de validación:', error);
        
        const internalErrorResponse: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.INTERNAL_ERROR,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string || undefined
          }
        };

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(internalErrorResponse);
      }
    };
  }

  /**
   * Middleware específico para validaciones de parámetros de ruta
   * Útil para endpoints que requieren IDs específicos
   */
  static validateParams() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        return next();
      }

      // Filtrar solo errores de parámetros
      const paramErrors = errors.array().filter(error => error.location === 'params');
      
      if (paramErrors.length === 0) {
        return next();
      }

      const formattedErrors = ValidationMiddleware.formatValidationErrors(paramErrors);
      
      logger.warn('Errores de validación en parámetros:', {
        path: req.path,
        method: req.method,
        params: req.params,
        errors: formattedErrors
      });

      const errorResponse: ApiResponse = {
        success: false,
        message: 'Parámetros de ruta inválidos',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          details: formattedErrors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || undefined
        }
      };

      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    };
  }

  /**
   * Middleware específico para validaciones de query parameters
   * Útil para endpoints de listado con filtros y paginación
   */
  static validateQuery() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        return next();
      }

      // Filtrar solo errores de query parameters
      const queryErrors = errors.array().filter(error => error.location === 'query');
      
      if (queryErrors.length === 0) {
        return next();
      }

      const formattedErrors = ValidationMiddleware.formatValidationErrors(queryErrors);
      
      logger.warn('Errores de validación en query parameters:', {
        path: req.path,
        method: req.method,
        query: req.query,
        errors: formattedErrors
      });

      const errorResponse: ApiResponse = {
        success: false,
        message: 'Parámetros de consulta inválidos',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          details: formattedErrors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || undefined
        }
      };

      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
    };
  }

  /**
   * Middleware específico para validaciones de body
   * Útil para endpoints de creación y actualización
   */
  static validateBody() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        return next();
      }

      // Filtrar solo errores de body
      const bodyErrors = errors.array().filter(error => error.location === 'body');
      
      if (bodyErrors.length === 0) {
        return next();
      }

      const formattedErrors = ValidationMiddleware.formatValidationErrors(bodyErrors);
      
      logger.warn('Errores de validación en body:', {
        path: req.path,
        method: req.method,
        body: ValidationMiddleware.sanitizeBodyForLogging(req.body),
        errors: formattedErrors
      });

      const errorResponse: ApiResponse = {
        success: false,
        message: 'Datos del cuerpo de la solicitud inválidos',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          details: formattedErrors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || undefined
        }
      };

      res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(errorResponse);
    };
  }

  /**
   * Middleware combinado que valida y maneja diferentes tipos de errores
   * con diferentes códigos de estado HTTP según el tipo de error
   */
  static validateWithContext() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        return next();
      }

      const allErrors = errors.array();
      const formattedErrors = ValidationMiddleware.formatValidationErrors(allErrors);
      
      // Determinar el tipo de error predominante para el código de estado
      const hasParamErrors = allErrors.some(error => error.location === 'params');
      const hasBodyErrors = allErrors.some(error => error.location === 'body');
      const hasQueryErrors = allErrors.some(error => error.location === 'query');
      
      let statusCode = HTTP_STATUS.BAD_REQUEST;
      let message = ERROR_MESSAGES.VALIDATION_ERROR;
      
      if (hasParamErrors) {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Parámetros de ruta inválidos';
      } else if (hasBodyErrors) {
        statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
        message = 'Datos del cuerpo de la solicitud inválidos';
      } else if (hasQueryErrors) {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Parámetros de consulta inválidos';
      }

      ValidationMiddleware.logValidationErrors(req, formattedErrors);

      const errorResponse: ApiResponse = {
        success: false,
        message,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          details: formattedErrors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || undefined
        }
      };

      res.status(statusCode).json(errorResponse);
    };
  }

  // ==============================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ==============================================

  /**
   * Formatea los errores de express-validator para una respuesta consistente
   */
  private static formatValidationErrors(errors: ValidationError[]): ValidationErrorDetail[] {
    return errors.map(error => {
      const baseError: ValidationErrorDetail = {
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        location: error.location,
        receivedValue: error.type === 'field' ? error.value : undefined
      };

      // Agregar información adicional según el tipo de error
      if (error.type === 'field') {
        return {
          ...baseError,
          field: error.path,
          receivedValue: error.value
        };
      }

      if (error.type === 'alternative') {
        return {
          ...baseError,
          field: 'alternative_validation',
          message: 'No se cumplió ninguna de las validaciones alternativas'
        };
      }

      if (error.type === 'alternative_grouped') {
        return {
          ...baseError,
          field: 'grouped_validation',
          message: 'Error en validación de grupo'
        };
      }

      if (error.type === 'unknown_fields') {
        return {
          ...baseError,
          field: 'unknown_fields',
          message: 'Campos desconocidos detectados'
        };
      }

      return baseError;
    });
  }

  /**
   * Registra errores de validación con contexto útil para debugging
   */
  private static logValidationErrors(req: Request, errors: ValidationErrorDetail[]): void {
    const logContext = {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: (req as any).user?.id,
      requestId: req.headers['x-request-id'],
      errors: errors,
      requestBody: ValidationMiddleware.sanitizeBodyForLogging(req.body),
      queryParams: req.query,
      params: req.params
    };

    logger.warn('Errores de validación detectados:', logContext);
  }

  /**
   * Sanitiza el body de la request para logging seguro
   * Elimina campos sensibles como contraseñas
   */
  private static sanitizeBodyForLogging(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'authorization',
      'jwt',
      'refresh_token',
      'api_key'
    ];

    const sanitized = { ...body };

    // Recursivamente sanitizar campos sensibles
    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => 
          lowerKey.includes(field.toLowerCase())
        );

        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  // ==============================================
  // MÉTODOS ESTÁTICOS DE UTILIDAD PARA VALIDATORS
  // ==============================================

  /**
   * Validador personalizado para verificar que un campo sea un CUID válido
   * Coherente con el esquema de Prisma que usa CUID como ID
   */
  static isValidCuid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // CUID format: c + timestamp (8 chars) + fingerprint (4 chars) + random (16 chars)
    const cuidRegex = /^c[a-z0-9]{24}$/;
    return cuidRegex.test(value);
  }

  /**
   * Validador personalizado para fechas futuras
   * Útil para fechas de vencimiento de tareas
   */
  static isFutureDate(dateString: string, minOffsetMinutes: number = 5): boolean {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return false;
      }

      const now = new Date();
      const minDate = new Date(now.getTime() + minOffsetMinutes * 60000);
      
      return date > minDate;
    } catch {
      return false;
    }
  }

  /**
   * Validador personalizado para colores hexadecimales
   * Coherente con el campo color del modelo Category
   */
  static isValidHexColor(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Soporta tanto #RGB como #RRGGBB
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(value);
  }

  /**
   * Validador personalizado para arrays de tags
   * Coherente con el campo tags del modelo Task
   */
  static isValidTagsArray(tags: any, maxCount: number = 10, maxLength: number = 50): boolean {
    if (!Array.isArray(tags)) {
      return false;
    }

    if (tags.length > maxCount) {
      return false;
    }

    return tags.every(tag => 
      typeof tag === 'string' && 
      tag.length > 0 && 
      tag.length <= maxLength &&
      /^[\w\s\-]+$/.test(tag)
    );
  }

  /**
   * Validador personalizado para URLs de attachments
   * Coherente con el campo attachments del modelo Task
   */
  static isValidAttachmentsArray(attachments: any, maxCount: number = 5): boolean {
    if (!Array.isArray(attachments)) {
      return false;
    }

    if (attachments.length > maxCount) {
      return false;
    }

    return attachments.every(attachment => {
      if (typeof attachment !== 'string') {
        return false;
      }

      try {
        new URL(attachment);
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Validador personalizado para verificar que los enum values coincidan con Prisma
   * Útil para mantener consistencia con los enums de TaskStatus y Priority
   */
  static isValidEnumValue(value: string, enumObject: Record<string, string>): boolean {
    return Object.values(enumObject).includes(value);
  }

  // ==============================================
  // FACTORY METHODS PARA DIFERENTES TIPOS DE VALIDACIÓN
  // ==============================================

  /**
   * Factory method para crear middleware de validación específico para tareas
   */
  static forTasks() {
    return ValidationMiddleware.validateWithContext();
  }

  /**
   * Factory method para crear middleware de validación específico para categorías
   */
  static forCategories() {
    return ValidationMiddleware.validateWithContext();
  }

  /**
   * Factory method para crear middleware de validación específico para operaciones de solo lectura
   */
  static forReadOperations() {
    return ValidationMiddleware.validateQuery();
  }

  /**
   * Factory method para crear middleware de validación específico para operaciones de escritura
   */
  static forWriteOperations() {
    return ValidationMiddleware.validateBody();
  }
}

// ==============================================
// TIPOS Y INTERFACES
// ==============================================

/**
 * Interface para detalles de errores de validación
 * Proporciona estructura consistente para errores
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  location: 'body' | 'query' | 'params' | 'headers' | 'cookies';
  receivedValue?: any;
}

/**
 * Tipo para opciones de configuración del middleware de validación
 */
interface ValidationOptions {
  includeReceivedValue?: boolean;
  sanitizeLogging?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// ==============================================
// EXPORT DEFAULT
// ==============================================

export default ValidationMiddleware;