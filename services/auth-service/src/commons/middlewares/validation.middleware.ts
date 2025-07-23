// src/presentation/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { AppError } from '../errors/AppError';
import { logger } from '../../utils/logger';

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
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
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

      res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: formattedErrors,
        correlationId
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
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
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

          res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: formattedErrors,
            correlationId
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

        res.status(500).json({
          success: false,
          message: 'Error interno durante validación',
          correlationId
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
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
    req.correlationId = correlationId;

    try {
      const { page = '1', limit = '10', sortBy, sortOrder = 'asc' } = req.query;

      // Validar y sanitizar página
      const pageNum = parseInt(page as string, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new AppError('El parámetro "page" debe ser un número entero mayor a 0', 400);
      }

      // Validar y sanitizar límite
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new AppError('El parámetro "limit" debe ser un número entre 1 y 100', 400);
      }

      // Validar orden de clasificación
      const validSortOrders = ['asc', 'desc'];
      if (sortOrder && !validSortOrders.includes(sortOrder as string)) {
        throw new AppError('El parámetro "sortOrder" debe ser "asc" o "desc"', 400);
      }

      // Adjuntar parámetros sanitizados a la request
      req.query.page = pageNum.toString();
      req.query.limit = limitNum.toString();
      req.query.sortOrder = sortOrder as string;
      
      if (sortBy) {
        // Sanitizar campo de ordenamiento (remover caracteres peligrosos)
        const sanitizedSortBy = (sortBy as string).replace(/[^a-zA-Z0-9_]/g, '');
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
          message: error.message,
          correlationId
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Error en parámetros de paginación',
          correlationId
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
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
    req.correlationId = correlationId;

    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn('Cuerpo de petición vacío', {
        correlationId,
        path: req.path,
        method: req.method
      });

      res.status(400).json({
        success: false,
        message: 'El cuerpo de la petición es requerido',
        correlationId
      });
      return;
    }

    next();
  }

  /**
   * Valida formato de UUID en parámetros
   */
  static validateUUID(paramName: string) {
    return (req: ValidationRequest, res: Response, next: NextFunction): void => {
      const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
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

        res.status(400).json({
          success: false,
          message: `El parámetro "${paramName}" debe ser un UUID válido`,
          correlationId
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
    const correlationId = req.correlationId || `req-${Date.now()}-${Math.random()}`;
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

      res.status(500).json({
        success: false,
        message: 'Error interno durante sanitización',
        correlationId
      });
    }
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
}

// Exportar métodos estáticos para uso directo
export const handleValidationErrors = ValidationMiddleware.handleValidationErrors;
export const validate = ValidationMiddleware.validate;
export const validatePagination = ValidationMiddleware.validatePagination;
export const requireBody = ValidationMiddleware.requireBody;
export const validateUUID = ValidationMiddleware.validateUUID;
export const sanitizeInput = ValidationMiddleware.sanitizeInput;