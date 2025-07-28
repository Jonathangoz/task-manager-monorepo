// src/presentation/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  ApiResponse,
  TASK_STATUSES,
  TASK_PRIORITIES,
  CATEGORY_CONFIG,
  VALIDATION_CONFIG,
  TASK_CONFIG
} from '@/utils/constants';
import { logger } from '@/utils/logger';

// Logger específico para el middleware de validación
const validationLogger = logger.child({ 
  component: 'validation-middleware',
  domain: 'validation'
});

/**
 * ValidationMiddleware
 * 
 * Middleware centralizado para el manejo de validaciones usando Zod.
 * Implementa principios SOLID y buenas prácticas de manejo de errores.
 * 
 * Responsabilidades:
 * - Procesar esquemas de validación de Zod
 * - Formatear errores de validación de manera consistente
 * - Proporcionar logging detallado para debugging
 * - Integración con el sistema de constantes y tipos
 */
export class ValidationMiddleware {
  
  // ==============================================
  // ESQUEMAS DE VALIDACIÓN CON ZOD
  // ==============================================

  /**
   * Esquema base para IDs CUID
   */
  static readonly cuidSchema = z.string()
    .min(VALIDATION_CONFIG.CUID.MIN_LENGTH, 'CUID debe tener al menos 20 caracteres')
    .max(VALIDATION_CONFIG.CUID.MAX_LENGTH, 'CUID debe tener máximo 30 caracteres')
    .regex(VALIDATION_CONFIG.CUID.PATTERN, 'CUID tiene formato inválido')
    .refine(ValidationMiddleware.isValidCuid, 'CUID no tiene formato válido');

  /**
   * Esquema para colores hexadecimales
   */
  static readonly hexColorSchema = z.string()
    .regex(VALIDATION_CONFIG.HEX_COLOR.PATTERN, 'Color debe estar en formato hexadecimal (#RGB o #RRGGBB)')
    .refine(
      (color) => CATEGORY_CONFIG.ALLOWED_COLORS.includes(color as any), 
      `Color debe ser uno de los colores permitidos: ${CATEGORY_CONFIG.ALLOWED_COLORS.join(', ')}`
    );

  /**
   * Esquema para iconos de categorías
   */
  static readonly iconSchema = z.string()
    .min(1, 'Icono no puede estar vacío')
    .max(50, 'Icono debe tener máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Icono solo puede contener letras, números, guiones y guiones bajos')
    .refine(
      (icon) => CATEGORY_CONFIG.ALLOWED_ICONS.includes(icon as any),
      `Icono debe ser uno de los iconos permitidos. Ver documentación para lista completa.`
    );

  /**
   * Esquema para arrays de tags
   */
  static readonly tagsSchema = z.array(
    z.string()
      .min(1, 'Tag no puede estar vacío')
      .max(TASK_CONFIG.MAX_TAG_LENGTH, `Tag debe tener máximo ${TASK_CONFIG.MAX_TAG_LENGTH} caracteres`)
      .regex(/^[\w\s\-áéíóúÁÉÍÓÚñÑ]+$/, 'Tag contiene caracteres no válidos')
  ).max(TASK_CONFIG.MAX_TAGS_COUNT, `Máximo ${TASK_CONFIG.MAX_TAGS_COUNT} tags permitidos`);

  /**
   * Esquema para URLs de attachments
   */
  static readonly attachmentsSchema = z.array(
    z.string().url('URL de attachment inválida')
  ).max(TASK_CONFIG.MAX_ATTACHMENTS_COUNT, `Máximo ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments permitidos`);

  /**
   * Esquema para fechas futuras
   */
  static readonly futureDateSchema = z.string()
    .datetime('Fecha debe estar en formato ISO válido')
    .refine(
      (dateString) => ValidationMiddleware.isFutureDate(dateString),
      `Fecha debe ser al menos ${TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES} minutos en el futuro`
    );

  /**
   * Esquema para paginación
   */
  static readonly paginationSchema = z.object({
    page: z.coerce.number()
      .int('Página debe ser un número entero')
      .min(1, 'Página debe ser mayor a 0')
      .default(1),
    limit: z.coerce.number()
      .int('Límite debe ser un número entero')
      .min(1, 'Límite debe ser mayor a 0')
      .max(100, 'Límite no puede ser mayor a 100')
      .default(20)
  });

  /**
   * Esquema para ordenamiento
   */
  static readonly sortSchema = z.object({
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title', 'name'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  });

  // ==============================================
  // ESQUEMAS ESPECÍFICOS PARA ENTIDADES
  // ==============================================

  /**
   * Esquema para crear categoría
   */
  static readonly createCategorySchema = z.object({
    name: z.string()
      .min(1, 'Nombre de categoría es requerido')
      .max(CATEGORY_CONFIG.MAX_NAME_LENGTH, `Nombre debe tener máximo ${CATEGORY_CONFIG.MAX_NAME_LENGTH} caracteres`)
      .regex(VALIDATION_CONFIG.NAME.PATTERN, 'Nombre contiene caracteres no válidos')
      .refine(
        (name) => !ValidationMiddleware.isReservedName(name),
        'Este nombre está reservado y no puede ser utilizado'
      ),
    description: z.string()
      .max(CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH, `Descripción debe tener máximo ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} caracteres`)
      .optional(),
    color: ValidationMiddleware.hexColorSchema.default(CATEGORY_CONFIG.DEFAULT_COLOR),
    icon: ValidationMiddleware.iconSchema.default(CATEGORY_CONFIG.DEFAULT_ICON)
  });

  /**
   * Esquema para actualizar categoría
   */
  static readonly updateCategorySchema = ValidationMiddleware.createCategorySchema.partial();

  /**
   * Esquema para crear tarea
   */
  static readonly createTaskSchema = z.object({
    title: z.string()
      .min(1, 'Título de la tarea es requerido')
      .max(TASK_CONFIG.MAX_TITLE_LENGTH, `Título debe tener máximo ${TASK_CONFIG.MAX_TITLE_LENGTH} caracteres`),
    description: z.string()
      .max(TASK_CONFIG.MAX_DESCRIPTION_LENGTH, `Descripción debe tener máximo ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} caracteres`)
      .optional(),
    dueDate: ValidationMiddleware.futureDateSchema.optional(),
    priority: z.nativeEnum(TASK_PRIORITIES, {
      errorMap: () => ({ message: `Prioridad debe ser: ${Object.values(TASK_PRIORITIES).join(', ')}` })
    }).default(TASK_PRIORITIES.MEDIUM),
    status: z.nativeEnum(TASK_STATUSES, {
      errorMap: () => ({ message: `Estado debe ser: ${Object.values(TASK_STATUSES).join(', ')}` })
    }).default(TASK_STATUSES.PENDING),
    categoryId: ValidationMiddleware.cuidSchema.optional(),
    tags: ValidationMiddleware.tagsSchema.optional(),
    attachments: ValidationMiddleware.attachmentsSchema.optional(),
    estimatedHours: z.number()
      .min(0.1, 'Horas estimadas debe ser mayor a 0')
      .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Horas estimadas no puede ser mayor a ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
      .optional()
  });

  /**
   * Esquema para actualizar tarea
   */
  static readonly updateTaskSchema = ValidationMiddleware.createTaskSchema.partial();

  /**
   * Esquema para filtros de tareas
   */
  static readonly taskFiltersSchema = z.object({
    status: z.union([
      z.nativeEnum(TASK_STATUSES),
      z.array(z.nativeEnum(TASK_STATUSES))
    ]).optional(),
    priority: z.union([
      z.nativeEnum(TASK_PRIORITIES),
      z.array(z.nativeEnum(TASK_PRIORITIES))
    ]).optional(),
    categoryId: ValidationMiddleware.cuidSchema.optional(),
    dueDateFrom: z.string().datetime().optional(),
    dueDateTo: z.string().datetime().optional(),
    isOverdue: z.coerce.boolean().optional(),
    hasDueDate: z.coerce.boolean().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    search: z.string()
      .min(VALIDATION_CONFIG.SEARCH.MIN_LENGTH)
      .max(VALIDATION_CONFIG.SEARCH.MAX_LENGTH)
      .regex(VALIDATION_CONFIG.SEARCH.PATTERN, 'Búsqueda contiene caracteres no válidos')
      .optional()
  });

  /**
   * Esquema para parámetros de ruta con ID
   */
  static readonly idParamSchema = z.object({
    id: ValidationMiddleware.cuidSchema
  });

  /**
   * Esquema para operaciones en lote
   */
  static readonly bulkOperationSchema = z.object({
    ids: z.array(ValidationMiddleware.cuidSchema)
      .min(VALIDATION_CONFIG.BULK.MIN_ITEMS, `Mínimo ${VALIDATION_CONFIG.BULK.MIN_ITEMS} elementos requeridos`)
      .max(VALIDATION_CONFIG.BULK.MAX_ITEMS, `Máximo ${VALIDATION_CONFIG.BULK.MAX_ITEMS} elementos permitidos`)
  });

  // ==============================================
  // MIDDLEWARE FACTORIES
  // ==============================================

  /**
   * Factory para crear middleware de validación genérico
   */
  static validate<T>(schema: ZodSchema<T>, target: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const dataToValidate = req[target];
        const result = schema.safeParse(dataToValidate);

        if (!result.success) {
          const formattedErrors = ValidationMiddleware.formatZodErrors(result.error);
          
          ValidationMiddleware.logValidationErrors(req, formattedErrors, target);
          
          const statusCode = ValidationMiddleware.getStatusCodeForTarget(target);
          const message = ValidationMiddleware.getMessageForTarget(target);
          
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
        }

        // Asignar los datos validados y transformados de vuelta al request
        (req as any)[target] = result.data;
        next();
      } catch (error) {
        ValidationMiddleware.handleInternalError(req, res, error);
      }
    };
  }

  /**
   * Middleware específico para validar body de creación de categorías
   */
  static validateCreateCategory() {
    return ValidationMiddleware.validate(ValidationMiddleware.createCategorySchema, 'body');
  }

  /**
   * Middleware específico para validar body de actualización de categorías
   */
  static validateUpdateCategory() {
    return ValidationMiddleware.validate(ValidationMiddleware.updateCategorySchema, 'body');
  }

  /**
   * Middleware específico para validar body de creación de tareas
   */
  static validateCreateTask() {
    return ValidationMiddleware.validate(ValidationMiddleware.createTaskSchema, 'body');
  }

  /**
   * Middleware específico para validar body de actualización de tareas
   */
  static validateUpdateTask() {
    return ValidationMiddleware.validate(ValidationMiddleware.updateTaskSchema, 'body');
  }

  /**
   * Middleware específico para validar parámetros de ID
   */
  static validateIdParam() {
    return ValidationMiddleware.validate(ValidationMiddleware.idParamSchema, 'params');
  }

  /**
   * Middleware específico para validar query parameters de paginación
   */
  static validatePagination() {
    return ValidationMiddleware.validate(ValidationMiddleware.paginationSchema, 'query');
  }

  /**
   * Middleware específico para validar query parameters de ordenamiento
   */
  static validateSort() {
    return ValidationMiddleware.validate(ValidationMiddleware.sortSchema, 'query');
  }

  /**
   * Middleware específico para validar filtros de tareas
   */
  static validateTaskFilters() {
    return ValidationMiddleware.validate(ValidationMiddleware.taskFiltersSchema, 'query');
  }

  /**
   * Middleware específico para validar operaciones en lote
   */
  static validateBulkOperation() {
    return ValidationMiddleware.validate(ValidationMiddleware.bulkOperationSchema, 'body');
  }

  /**
   * Middleware combinado para paginación y ordenamiento
   */
  static validatePaginationAndSort() {
    const combinedSchema = ValidationMiddleware.paginationSchema.merge(ValidationMiddleware.sortSchema);
    return ValidationMiddleware.validate(combinedSchema, 'query');
  }

  // ==============================================
  // MÉTODOS PRIVADOS DE UTILIDAD
  // ==============================================

  /**
   * Formatea errores de Zod para una respuesta consistente
   */
  private static formatZodErrors(zodError: ZodError): ValidationErrorDetail[] {
    return zodError.errors.map(error => ({
      field: error.path.join('.') || 'unknown',
      message: error.message,
      location: 'body' as const, // Se ajustará según el contexto
      receivedValue: error.code === 'invalid_type' ? undefined : (error as any).received,
      code: error.code
    }));
  }

  /**
   * Obtiene el código de estado HTTP apropiado según el target
   */
  private static getStatusCodeForTarget(target: 'body' | 'query' | 'params'): number {
    switch (target) {
      case 'params':
        return HTTP_STATUS.BAD_REQUEST;
      case 'body':
        return HTTP_STATUS.UNPROCESSABLE_ENTITY;
      case 'query':
        return HTTP_STATUS.BAD_REQUEST;
      default:
        return HTTP_STATUS.BAD_REQUEST;
    }
  }

  /**
   * Obtiene el mensaje apropiado según el target
   */
  private static getMessageForTarget(target: 'body' | 'query' | 'params'): string {
    switch (target) {
      case 'params':
        return 'Parámetros de ruta inválidos';
      case 'body':
        return 'Datos del cuerpo de la solicitud inválidos';
      case 'query':
        return 'Parámetros de consulta inválidos';
      default:
        return ERROR_MESSAGES.VALIDATION_ERROR;
    }
  }

  /**
   * Registra errores de validación con contexto útil para debugging
   */
  private static logValidationErrors(
    req: Request, 
    errors: ValidationErrorDetail[], 
    target: string
  ): void {
    const logContext = {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: (req as any).user?.id,
      requestId: req.headers['x-request-id'],
      target,
      errors: errors,
      requestBody: target === 'body' ? ValidationMiddleware.sanitizeBodyForLogging(req.body) : undefined,
      queryParams: target === 'query' ? req.query : undefined,
      params: target === 'params' ? req.params : undefined
    };

    validationLogger.warn('Errores de validación detectados:', logContext);
  }

  /**
   * Maneja errores internos del middleware
   */
  private static handleInternalError(req: Request, res: Response, error: any): void {
    validationLogger.error('Error interno en middleware de validación:', error);
    
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
  static isFutureDate(dateString: string, minOffsetMinutes: number = TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES): boolean {
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
   * Validador personalizado para verificar que los enum values coincidan con Prisma
   * Útil para mantener consistencia con los enums de TaskStatus y Priority
   */
  static isValidEnumValue(value: string, enumObject: Record<string, string>): boolean {
    return Object.values(enumObject).includes(value);
  }

  /**
   * Validador personalizado para nombres reservados
   */
  static isReservedName(name: string): boolean {
    const normalizedName = name.toLowerCase().trim();
    return CATEGORY_CONFIG.RESERVED_NAMES.includes(normalizedName as any);
  }

  // ==============================================
  // FACTORY METHODS PARA DIFERENTES TIPOS DE VALIDACIÓN
  // ==============================================

  /**
   * Factory method para crear middleware de validación específico para tareas
   */
  static forTasks() {
    return {
      create: ValidationMiddleware.validateCreateTask(),
      update: ValidationMiddleware.validateUpdateTask(),
      filters: ValidationMiddleware.validateTaskFilters(),
      id: ValidationMiddleware.validateIdParam()
    };
  }

  /**
   * Factory method para crear middleware de validación específico para categorías
   */
  static forCategories() {
    return {
      create: ValidationMiddleware.validateCreateCategory(),
      update: ValidationMiddleware.validateUpdateCategory(),
      id: ValidationMiddleware.validateIdParam(),
      bulk: ValidationMiddleware.validateBulkOperation()
    };
  }

  /**
   * Factory method para crear middleware de validación específico para operaciones de solo lectura
   */
  static forReadOperations() {
    return {
      pagination: ValidationMiddleware.validatePagination(),
      sort: ValidationMiddleware.validateSort(),
      paginationAndSort: ValidationMiddleware.validatePaginationAndSort(),
      id: ValidationMiddleware.validateIdParam()
    };
  }

  /**
   * Factory method para crear middleware de validación específico para operaciones de escritura
   */
  static forWriteOperations() {
    return {
      createTask: ValidationMiddleware.validateCreateTask(),
      updateTask: ValidationMiddleware.validateUpdateTask(),
      createCategory: ValidationMiddleware.validateCreateCategory(),
      updateCategory: ValidationMiddleware.validateUpdateCategory(),
      bulk: ValidationMiddleware.validateBulkOperation()
    };
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
  code?: string;
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
// TIPOS EXPORTADOS PARA USO EXTERNO
// ==============================================

export type { ValidationErrorDetail, ValidationOptions };

// Esquemas exportados para uso en otros módulos
export const ValidationSchemas = {
  createCategory: ValidationMiddleware.createCategorySchema,
  updateCategory: ValidationMiddleware.updateCategorySchema,
  createTask: ValidationMiddleware.createTaskSchema,
  updateTask: ValidationMiddleware.updateTaskSchema,
  taskFilters: ValidationMiddleware.taskFiltersSchema,
  pagination: ValidationMiddleware.paginationSchema,
  sort: ValidationMiddleware.sortSchema,
  idParam: ValidationMiddleware.idParamSchema,
  bulkOperation: ValidationMiddleware.bulkOperationSchema,
  cuid: ValidationMiddleware.cuidSchema,
  hexColor: ValidationMiddleware.hexColorSchema,
  icon: ValidationMiddleware.iconSchema,
  tags: ValidationMiddleware.tagsSchema,
  attachments: ValidationMiddleware.attachmentsSchema,
  futureDate: ValidationMiddleware.futureDateSchema
} as const;

// ==============================================
// EXPORT DEFAULT
// ==============================================

export default ValidationMiddleware;