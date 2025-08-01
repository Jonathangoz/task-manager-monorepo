// src/presentation/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/typeExpress/express';
import { z } from 'zod';
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

// Base Schemas para validaciones comunes

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'La página debe ser un número entero mayor a 0').default(1),
  limit: z.coerce.number().int().min(1).max(DEFAULT_VALUES.PAGINATION_MAX_LIMIT, `El límite debe estar entre 1 y ${DEFAULT_VALUES.PAGINATION_MAX_LIMIT}`).default(DEFAULT_VALUES.PAGINATION_LIMIT),
  sortBy: z.string().regex(/^[a-zA-Z0-9_]+$/, 'El campo de ordenamiento contiene caracteres no válidos').optional(),
  sortOrder: z.enum(['asc', 'desc'], { errorMap: () => ({ message: 'El orden debe ser "asc" o "desc"' }) }).default('asc')
});

const CUIDSchema = z.string().regex(VALIDATION_PATTERNS.CUID, 'Debe ser un CUID válido');
const UUIDSchema = z.string().uuid('Debe ser un UUID válido');
const EmailSchema = z.string().email('Formato de email inválido').regex(VALIDATION_PATTERNS.EMAIL, 'Formato de email inválido');
const UsernameSchema = z.string().regex(VALIDATION_PATTERNS.USERNAME, 'El username solo puede contener letras, números y guiones bajos');

// Core Validation Middleware Class

export class ValidationMiddleware {
  /**
   * Genera un correlation ID único para la request
   */
  private static generateCorrelationId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Asegura que la request tenga un correlation ID
   */
  private static ensureCorrelationId(req: ValidationRequest): string {
    if (!req.correlationId) {
      req.correlationId = ValidationMiddleware.generateCorrelationId();
    }
    return req.correlationId;
  }

  /**
   * Crea un middleware de validación genérico para cualquier schema de Zod
   */
  static createValidator<T extends z.ZodSchema>(
    schema: T,
    target: 'body' | 'query' | 'params' = 'body'
  ) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      const correlationId = ValidationMiddleware.ensureCorrelationId(req);

      try {
        const dataToValidate = req[target];
        const validatedData = schema.parse(dataToValidate);
        
        // Reemplazar los datos originales con los validados y transformados
        (req as any)[target] = validatedData;

        logger.debug('Validación exitosa', {
          correlationId,
          target,
          path: req.path,
          method: req.method
        });

        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            value: err.code !== 'invalid_type' ? err.path.reduce((obj, key) => obj?.[key], req[target]) : undefined
          }));

          logger.warn('Errores de validación encontrados', {
            correlationId,
            target,
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

        // Error no esperado durante validación
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
   * Validador específico para paginación con lógica adicional
   */
  static validatePagination = ValidationMiddleware.createValidator(PaginationQuerySchema, 'query');

  /**
   * Valida que el cuerpo de la petición no esté vacío
   */
  static requireBody(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = ValidationMiddleware.ensureCorrelationId(req);

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
   * Valida formato de CUID en parámetros
   */
  static validateCUID(paramName: string) {
    const paramSchema = z.object({
      [paramName]: CUIDSchema
    });

    return ValidationMiddleware.createValidator(paramSchema, 'params');
  }

  /**
   * Valida formato de UUID en parámetros
   */
  static validateUUID(paramName: string) {
    const paramSchema = z.object({
      [paramName]: UUIDSchema
    });

    return ValidationMiddleware.createValidator(paramSchema, 'params');
  }

  /**
   * Sanitiza strings para prevenir inyección XSS básica
   */
  static sanitizeInput(
    req: ValidationRequest,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = ValidationMiddleware.ensureCorrelationId(req);

    try {
      // Sanitizar body
      if (req.body && typeof req.body === 'object') {
        req.body = ValidationMiddleware.sanitizeObject(req.body);
      }

      // Sanitizar query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = ValidationMiddleware.sanitizeObject(req.query);
      }

      logger.debug('Sanitización completada', {
        correlationId,
        path: req.path,
        method: req.method
      });

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
   * Valida formato de email en el body
   */
  static validateEmail = ValidationMiddleware.createValidator(
    z.object({ email: EmailSchema }),
    'body'
  );

  /**
   * Valida formato de username en el body
   */
  static validateUsername = ValidationMiddleware.createValidator(
    z.object({ username: UsernameSchema }),
    'body'
  );

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
      const correlationId = ValidationMiddleware.ensureCorrelationId(req);
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

// Advanced Validation Utilities

export class AdvancedValidationUtils {
  /**
   * Crea un validador condicional basado en condiciones
   */
  static createConditionalValidator<T extends z.ZodSchema>(
    schema: T,
    condition: (req: ValidationRequest) => boolean,
    target: 'body' | 'query' | 'params' = 'body'
  ) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      if (!condition(req)) {
        return next(); // Saltar validación si no se cumple la condición
      }

      return ValidationMiddleware.createValidator(schema, target)(req, res, next);
    };
  }

  /**
   * Combina múltiples validadores en uno solo
   */
  static combineValidators(...validators: Array<(req: any, res: any, next: any) => void>) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      let currentIndex = 0;

      const runNext = (error?: any) => {
        if (error) return next(error);

        if (currentIndex >= validators.length) {
          return next();
        }

        const validator = validators[currentIndex++];
        validator(req, res, runNext);
      };

      runNext();
    };
  }

  /**
   * Crea un validador que permite campos opcionales en el cuerpo
   */
  static createOptionalBodyValidator<T extends z.ZodSchema>(schema: T) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      // Si no hay body, continúa sin validar
      if (!req.body || Object.keys(req.body).length === 0) {
        return next();
      }

      return ValidationMiddleware.createValidator(schema, 'body')(req, res, next);
    };
  }

  /**
   * Validador para múltiples parámetros CUID
   */
  static validateMultipleCUIDs(...paramNames: string[]) {
    const schemaObj: Record<string, z.ZodString> = {};
    paramNames.forEach(param => {
      schemaObj[param] = CUIDSchema;
    });

    return ValidationMiddleware.createValidator(z.object(schemaObj), 'params');
  }

  /**
   * Validador para rangos de fechas en query parameters
   */
  static validateDateRange() {
    const dateRangeSchema = z.object({
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional()
    }).refine(data => {
      if (data.dateFrom && data.dateTo) {
        return data.dateTo >= data.dateFrom;
      }
      return true;
    }, {
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
      path: ['dateTo']
    });

    return ValidationMiddleware.createValidator(dateRangeSchema, 'query');
  }
}

// Validation Presets - Validadores predefinidos comunes

export const ValidationPresets = {
  // Validaciones básicas
  pagination: ValidationMiddleware.validatePagination,
  requireBody: ValidationMiddleware.requireBody,
  requireJSON: ValidationMiddleware.requireContentType('application/json'),
  sanitizeInput: ValidationMiddleware.sanitizeInput,

  // Validaciones de parámetros
  userIdParam: ValidationMiddleware.validateCUID('id'),
  sessionIdParam: ValidationMiddleware.validateCUID('sessionId'),
  uuidParam: (paramName: string) => ValidationMiddleware.validateUUID(paramName),

  // Validaciones de campos específicos
  emailField: ValidationMiddleware.validateEmail,
  usernameField: ValidationMiddleware.validateUsername,

  // Validaciones avanzadas
  dateRange: AdvancedValidationUtils.validateDateRange(),

  // Combinaciones comunes
  paginationAndSanitize: AdvancedValidationUtils.combineValidators(
    ValidationMiddleware.validatePagination,
    ValidationMiddleware.sanitizeInput
  ),

  userResourceAccess: AdvancedValidationUtils.combineValidators(
    ValidationMiddleware.validateCUID('id'),
    ValidationMiddleware.requireBody,
    ValidationMiddleware.sanitizeInput
  )
} as const;

// Schema Factory - Para crear schemas dinámicamente

export class SchemaFactory {
  /**
   * Crea un schema de paginación con campos de ordenamiento específicos
   */
  static createPaginationSchema(allowedSortFields: string[]) {
    return z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(DEFAULT_VALUES.PAGINATION_MAX_LIMIT).default(DEFAULT_VALUES.PAGINATION_LIMIT),
      sortBy: z.enum(allowedSortFields as [string, ...string[]]).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('asc')
    });
  }

  /**
   * Crea un schema de búsqueda con validaciones específicas
   */
  static createSearchSchema(minLength: number = 1, maxLength: number = 100) {
    return z.object({
      q: z.string()
        .min(minLength, `El término de búsqueda debe tener al menos ${minLength} caracteres`)
        .max(maxLength, `El término de búsqueda no puede exceder ${maxLength} caracteres`)
        .transform(q => q.trim()),
      exactMatch: z.coerce.boolean().default(false),
      caseSensitive: z.coerce.boolean().default(false)
    });
  }

  /**
   * Crea un schema para validar IDs múltiples
   */
  static createMultipleIdsSchema(fieldName: string, idType: 'cuid' | 'uuid' = 'cuid') {
    const idSchema = idType === 'cuid' ? CUIDSchema : UUIDSchema;
    
    return z.object({
      [fieldName]: z.array(idSchema).min(1, `Debe proporcionar al menos un ${fieldName}`)
    });
  }
}

// Exports - Compatibilidad con la API anterior

// Métodos principales
export const createValidator = ValidationMiddleware.createValidator;
export const validatePagination = ValidationMiddleware.validatePagination;
export const requireBody = ValidationMiddleware.requireBody;
export const validateCUID = ValidationMiddleware.validateCUID;
export const validateUUID = ValidationMiddleware.validateUUID;
export const sanitizeInput = ValidationMiddleware.sanitizeInput;
export const validateEmail = ValidationMiddleware.validateEmail;
export const validateUsername = ValidationMiddleware.validateUsername;
export const requireContentType = ValidationMiddleware.requireContentType;

// Legacy exports para compatibilidad
export const handleValidationErrors = (req: ValidationRequest, res: Response, next: NextFunction) => {
  // Esta función ya no es necesaria con Zod, pero se mantiene para compatibilidad
  logger.warn('handleValidationErrors is deprecated with Zod implementation');
  next();
};

export const validate = (validations: any[]) => {
  // Esta función es reemplazada por createValidator
  logger.warn('validate function is deprecated, use createValidator instead');
  return (req: ValidationRequest, res: Response, next: NextFunction) => next();
};

// Export default para compatibilidad
export default {
  ValidationMiddleware,
  AdvancedValidationUtils,
  ValidationPresets,
  SchemaFactory,
  createValidator,
  validatePagination,
  requireBody,
  validateCUID,
  validateUUID,
  sanitizeInput,
  validateEmail,
  validateUsername,
  requireContentType
};