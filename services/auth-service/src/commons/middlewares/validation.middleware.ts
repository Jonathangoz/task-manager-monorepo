// src/presentation/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { logger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  DEFAULT_VALUES,
  VALIDATION_PATTERNS 
} from '@/utils/constants';
import { AppError } from './error.middleware';

interface ValidationRequest extends Request {
  correlationId?: string;
}

export class ValidationMiddleware {
  /**
   * Middleware para manejar errores de validación de express-validator
   */
  static handleValidationErrors(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;
    
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : error.type,
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }));

      logger.warn('Errores de validación encontrados', {
        correlationId,
        errors: formattedErrors,
        path: req.path,
        method: req.method
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: formattedErrors
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }

    next();
  }

  /**
   * Crea un middleware de validación con manejo automático de errores
   */
  static validate(validations: ValidationChain[]) {
    return async (req: ValidationRequest, res: Response, next: NextFunction): Promise<void> => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.correlationId = correlationId;

      try {
        // Ejecutar todas las validaciones en paralelo
        await Promise.all(validations.map(validation => validation.run(req)));

        // Verificar si hay errores
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
          const formattedErrors = errors.array().map(error => ({
            field: error.type === 'field' ? error.path : error.type,
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined
          }));

          logger.warn('Errores de validación encontrados', {
            correlationId,
            errors: formattedErrors,
            path: req.path,
            method: req.method
          });

          res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: ERROR_MESSAGES.VALIDATION_ERROR,
              details: formattedErrors
            },
            meta: {
              correlationId,
              timestamp: new Date().toISOString(),
              path: req.path,
              method: req.method
            }
          });
          return;
        }

        logger.debug('Validación exitosa', {
          correlationId,
          path: req.path,
          method: req.method
        });

        next();
      } catch (error) {
        logger.error('Error durante validación', {
          correlationId,
          error: error instanceof Error ? error.message : 'Error desconocido',
          path: req.path,
          method: req.method
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
      }
    };
  }

  /**
   * Sanitiza y valida parámetros de paginación
   */
  static validatePagination(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    try {
      const { 
        page = '1', 
        limit = DEFAULT_VALUES.PAGINATION_LIMIT.toString(), 
        sortBy, 
        sortOrder = 'asc' 
      } = req.query;

      // Validar y sanitizar página
      const pageNum = parseInt(page as string, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new AppError(
          'El parámetro "page" debe ser un número entero mayor a 0', 
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Validar y sanitizar límite
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > DEFAULT_VALUES.PAGINATION_MAX_LIMIT) {
        throw new AppError(
          `El parámetro "limit" debe ser un número entre 1 y ${DEFAULT_VALUES.PAGINATION_MAX_LIMIT}`, 
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Validar orden de clasificación
      const validSortOrders = ['asc', 'desc'];
      if (sortOrder && !validSortOrders.includes(sortOrder as string)) {
        throw new AppError(
          'El parámetro "sortOrder" debe ser "asc" o "desc"', 
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Adjuntar parámetros sanitizados a la request
      req.query.page = pageNum.toString();
      req.query.limit = limitNum.toString();
      req.query.sortOrder = sortOrder as string;
      
      if (sortBy) {
        // Sanitizar campo de ordenamiento (remover caracteres peligrosos)
        const sanitizedSortBy = (sortBy as string).replace(/[^a-zA-Z0-9_]/g, '');
        if (sanitizedSortBy !== sortBy) {
          throw new AppError(
            'El parámetro "sortBy" contiene caracteres no válidos', 
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
          );
        }
        req.query.sortBy = sanitizedSortBy;
      }

      logger.debug('Parámetros de paginación validados', {
        correlationId,
        pagination: {
          page: pageNum,
          limit: limitNum,
          sortBy: req.query.sortBy,
          sortOrder
        }
      });

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
      } else {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Error en parámetros de paginación'
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
      }
    }
  }

  /**
   * Valida que el cuerpo de la petición no esté vacío
   */
  static requireBody(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn('Cuerpo de petición vacío', {
        correlationId,
        path: req.path,
        method: req.method
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'El cuerpo de la petición es requerido'
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }

    next();
  }

  /**
   * Valida formato de CUID en parámetros (usado por Prisma)
   */
  static validateCUID(paramName: string) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.correlationId = correlationId;

      const paramValue = req.params[paramName];
      
      if (!paramValue || !VALIDATION_PATTERNS.CUID.test(paramValue)) {
        logger.warn('CUID inválido en parámetro', {
          correlationId,
          paramName,
          paramValue,
          path: req.path
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `El parámetro "${paramName}" debe ser un CUID válido`
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Valida formato de UUID en parámetros (para compatibilidad)
   */
  static validateUUID(paramName: string) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.correlationId = correlationId;

      const paramValue = req.params[paramName];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!paramValue || !uuidRegex.test(paramValue)) {
        logger.warn('UUID inválido en parámetro', {
          correlationId,
          paramName,
          paramValue,
          path: req.path
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `El parámetro "${paramName}" debe ser un UUID válido`
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Sanitiza strings para prevenir inyección XSS básica
   */
  static sanitizeInput(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    try {
      // Sanitizar body
      if (req.body && typeof req.body === 'object') {
        req.body = ValidationMiddleware.sanitizeObject(req.body);
      }

      // Sanitizar query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = ValidationMiddleware.sanitizeObject(req.query);
      }

      next();
    } catch (error) {
      logger.error('Error durante sanitización', {
        correlationId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: ERROR_MESSAGES.INTERNAL_ERROR
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
    }
  }

  /**
   * Valida formato de email
   */
  static validateEmail(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    const { email } = req.body;

    if (email && !VALIDATION_PATTERNS.EMAIL.test(email)) {
      logger.warn('Formato de email inválido', {
        correlationId,
        email: email.substring(0, 3) + '***', // Log parcial por privacidad
        path: req.path
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: ERROR_CODES.INVALID_EMAIL,
          message: 'Formato de email inválido'
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }

    next();
  }

  /**
   * Valida formato de username
   */
  static validateUsername(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.correlationId = correlationId;

    const { username } = req.body;

    if (username && !VALIDATION_PATTERNS.USERNAME.test(username)) {
      logger.warn('Formato de username inválido', {
        correlationId,
        username: username.substring(0, 3) + '***',
        path: req.path
      });

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: ERROR_CODES.INVALID_USERNAME,
          message: 'El username solo puede contener letras, números y guiones bajos'
        },
        meta: {
          correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
      return;
    }

    next();
  }

  /**
   * Sanitiza recursivamente un objeto
   */
  private static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(item => ValidationMiddleware.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = ValidationMiddleware.sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Middleware para validar Content-Type
   */
  static requireContentType(expectedType: string = 'application/json') {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.correlationId = correlationId;

      const contentType = req.get('Content-Type');

      if (!contentType || !contentType.includes(expectedType)) {
        logger.warn('Content-Type inválido', {
          correlationId,
          expectedType,
          receivedType: contentType,
          path: req.path
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Content-Type debe ser ${expectedType}`
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
        return;
      }

      next();
    };
  }
}

// Exportar métodos estáticos para uso directo
export const handleValidationErrors = ValidationMiddleware.handleValidationErrors;
export const validate = ValidationMiddleware.validate;
export const validatePagination = ValidationMiddleware.validatePagination;
export const requireBody = ValidationMiddleware.requireBody;
export const validateCUID = ValidationMiddleware.validateCUID;
export const validateUUID = ValidationMiddleware.validateUUID;
export const sanitizeInput = ValidationMiddleware.sanitizeInput;
export const validateEmail = ValidationMiddleware.validateEmail;
export const validateUsername = ValidationMiddleware.validateUsername;
export const requireContentType = ValidationMiddleware.requireContentType;