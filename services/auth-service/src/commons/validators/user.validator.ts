// src/commons/validators/user.validator.ts
import { z } from 'zod';
import {
  VALIDATION_PATTERNS,
  SECURITY_CONFIG,
  DEFAULT_VALUES,
  PASSWORD_VALIDATION,
} from '@/utils/constants';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Base Schemas - Principio DRY y reutilización
// ============================================================================

const CUIDSchema = z
  .string()
  .regex(VALIDATION_PATTERNS.CUID, 'El ID debe ser un CUID válido');

const EmailSchema = z
  .string()
  .min(1, 'El email es requerido')
  .max(
    SECURITY_CONFIG.EMAIL_MAX_LENGTH,
    `El email no puede exceder ${SECURITY_CONFIG.EMAIL_MAX_LENGTH} caracteres`,
  )
  .email('El email debe tener un formato válido')
  .regex(VALIDATION_PATTERNS.EMAIL, 'Formato de email inválido')
  .transform((email) => email.toLowerCase().trim());

const UsernameSchema = z
  .string()
  .min(
    SECURITY_CONFIG.USERNAME_MIN_LENGTH,
    `El username debe tener al menos ${SECURITY_CONFIG.USERNAME_MIN_LENGTH} caracteres`,
  )
  .max(
    SECURITY_CONFIG.USERNAME_MAX_LENGTH,
    `El username no puede exceder ${SECURITY_CONFIG.USERNAME_MAX_LENGTH} caracteres`,
  )
  .regex(
    VALIDATION_PATTERNS.USERNAME,
    'El username solo puede contener letras, números y guiones bajos',
  )
  .transform((username) => username.trim());

const PasswordSchema = z
  .string()
  .min(
    SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} caracteres`,
  )
  .max(
    SECURITY_CONFIG.PASSWORD_MAX_LENGTH,
    `La contraseña no puede exceder ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} caracteres`,
  )
  .regex(
    VALIDATION_PATTERNS.PASSWORD_STRONG,
    'La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial',
  )
  .refine((password) => {
    return !PASSWORD_VALIDATION.FORBIDDEN_PATTERNS.some((pattern) =>
      pattern.test(password),
    );
  }, 'La contraseña contiene un patrón no permitido');

const NameSchema = z
  .string()
  .min(1, 'Este campo es requerido')
  .max(50, 'No puede exceder 50 caracteres')
  .regex(
    /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/,
    'Solo puede contener letras y espacios',
  )
  .transform((name) => name.trim());

const AvatarSchema = z
  .string()
  .url('El avatar debe ser una URL válida')
  .max(500, 'La URL del avatar no puede exceder 500 caracteres');

const PaginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'La página debe ser un número entero mayor a 0')
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(
      DEFAULT_VALUES.PAGINATION_MAX_LIMIT,
      `El límite debe estar entre 1 y ${DEFAULT_VALUES.PAGINATION_MAX_LIMIT}`,
    )
    .default(DEFAULT_VALUES.PAGINATION_LIMIT),
});

const SortSchema = z.object({
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'email',
      'username',
      'firstName',
      'lastName',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const BaseDateRangeSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// ============================================================================
// Query Validation Schemas - Alta cohesión por funcionalidad
// ============================================================================

export const GetUsersQuerySchema = PaginationSchema.merge(SortSchema)
  .merge(BaseDateRangeSchema)
  .extend({
    search: z
      .string()
      .min(1)
      .max(100, 'El término de búsqueda debe tener entre 1 y 100 caracteres')
      .transform((search) => search.trim())
      .optional(),
    isActive: z.coerce.boolean().optional(),
    isVerified: z.coerce.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return data.dateTo >= data.dateFrom;
      }
      return true;
    },
    {
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
      path: ['dateTo'],
    },
  );

export const SearchUsersQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'El término de búsqueda es requerido')
    .max(100, 'El término de búsqueda debe tener entre 1 y 100 caracteres')
    .transform((q) => q.trim()),
  fields: z
    .string()
    .optional()
    .transform((fields) => fields?.split(',').map((f) => f.trim()))
    .pipe(
      z
        .array(z.enum(['email', 'username', 'firstName', 'lastName']))
        .optional(),
    ),
  exactMatch: z.coerce.boolean().optional(),
  caseSensitive: z.coerce.boolean().optional(),
});

export const ExportUserDataQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeHistory: z.coerce.boolean().default(false),
});

// ============================================================================
// Parameter Validation Schemas
// ============================================================================

export const UserParamsSchema = z.object({
  id: CUIDSchema,
});

export const VerifyEmailTokenParamsSchema = z.object({
  token: z
    .string()
    .min(10, 'El token debe tener al menos 10 caracteres')
    .nonempty('El token de verificación es requerido'),
});

export const SessionParamsSchema = z.object({
  sessionId: CUIDSchema,
});

// ============================================================================
// Body Validation Schemas - Separación de responsabilidades
// ============================================================================

export const CreateUserBodySchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  avatar: AvatarSchema.optional(),
});

export const UpdateUserBodySchema = z
  .object({
    email: EmailSchema.optional(),
    username: UsernameSchema.optional(),
    firstName: NameSchema.optional(),
    lastName: NameSchema.optional(),
    avatar: AvatarSchema.optional(),
  })
  .refine(
    (data) => {
      // Al menos un campo debe estar presente
      return Object.values(data).some((value) => value !== undefined);
    },
    {
      message: 'Debe proporcionar al menos un campo para actualizar',
    },
  );

export const UpdateAvatarBodySchema = z.object({
  avatar: AvatarSchema,
});

export const DeactivateUserBodySchema = z.object({
  reason: z
    .string()
    .min(1)
    .max(500, 'La razón debe tener entre 1 y 500 caracteres')
    .transform((reason) => reason.trim())
    .optional(),
});

// ============================================================================
// Validation Factory - Patrón Factory para crear validadores
// ============================================================================

class ValidationFactory {
  static createQueryValidator<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.query = schema.parse(req.query);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            message: 'Errores de validación en query parameters',
            errors: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          });
        }
        return next(error);
      }
    };
  }

  static createParamsValidator<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.params = schema.parse(req.params);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            message: 'Errores de validación en parámetros',
            errors: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          });
        }
        return next(error);
      }
    };
  }

  static createBodyValidator<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            message: 'Errores de validación en el cuerpo de la petición',
            errors: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          });
        }
        return next(error);
      }
    };
  }
}

// ============================================================================
// Middleware Validators - Interfaz simple para uso en rutas
// ============================================================================

export const validateGetUsersQuery =
  ValidationFactory.createQueryValidator(GetUsersQuerySchema);
export const validateSearchUsersQuery = ValidationFactory.createQueryValidator(
  SearchUsersQuerySchema,
);
export const validateExportUserDataQuery =
  ValidationFactory.createQueryValidator(ExportUserDataQuerySchema);

export const validateUserParams =
  ValidationFactory.createParamsValidator(UserParamsSchema);
export const validateVerifyEmailTokenParams =
  ValidationFactory.createParamsValidator(VerifyEmailTokenParamsSchema);
export const validateSessionParams =
  ValidationFactory.createParamsValidator(SessionParamsSchema);

export const validateCreateUserBody =
  ValidationFactory.createBodyValidator(CreateUserBodySchema);
export const validateUpdateUserBody =
  ValidationFactory.createBodyValidator(UpdateUserBodySchema);
export const validateUpdateAvatarBody = ValidationFactory.createBodyValidator(
  UpdateAvatarBodySchema,
);
export const validateDeactivateUserBody = ValidationFactory.createBodyValidator(
  DeactivateUserBodySchema,
);

// ============================================================================
// Type Inference - Tipos automáticos desde los schemas
// ============================================================================

export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;
export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;
export type ExportUserDataQuery = z.infer<typeof ExportUserDataQuerySchema>;

export type UserParams = z.infer<typeof UserParamsSchema>;
export type VerifyEmailTokenParams = z.infer<
  typeof VerifyEmailTokenParamsSchema
>;
export type SessionParams = z.infer<typeof SessionParamsSchema>;

export type CreateUserRequest = z.infer<typeof CreateUserBodySchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserBodySchema>;
export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarBodySchema>;
export type DeactivateUserRequest = z.infer<typeof DeactivateUserBodySchema>;

// ============================================================================
// Utility Functions - Funciones helper reutilizables
// ============================================================================

export class UserValidationUtils {
  static validateCUID(id: string): boolean {
    return CUIDSchema.safeParse(id).success;
  }

  static sanitizeSearchQuery(query: string): string {
    return query
      .trim()
      .replace(/[<>"'%;()&+]/g, '') // Remover caracteres peligrosos
      .substring(0, 100); // Limitar longitud
  }

  static validateEmail(email: string): boolean {
    return EmailSchema.safeParse(email).success;
  }

  static validateUsername(username: string): boolean {
    return UsernameSchema.safeParse(username).success;
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const result = PasswordSchema.safeParse(password);
    return {
      isValid: result.success,
      errors: result.success
        ? []
        : result.error.errors.map((err) => err.message),
    };
  }

  /**
   * Valida datos de forma segura sin lanzar excepciones
   */
  static safeValidate<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
  ): {
    success: boolean;
    data?: z.infer<T>;
    errors?: Array<{ field: string; message: string; code: string }>;
  } {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }
}

// ============================================================================
// Validation Presets - Conjuntos predefinidos para casos comunes
// ============================================================================

export const ValidationPresets = {
  // Para operaciones CRUD básicas
  userCRUD: {
    create: validateCreateUserBody,
    update: validateUpdateUserBody,
    params: validateUserParams,
  },

  // Para operaciones de consulta
  userQuery: {
    list: validateGetUsersQuery,
    search: validateSearchUsersQuery,
    export: validateExportUserDataQuery,
  },

  // Para operaciones de autenticación
  userAuth: {
    verifyEmail: validateVerifyEmailTokenParams,
    session: validateSessionParams,
  },
} as const;

export default {
  // Schemas
  GetUsersQuerySchema,
  SearchUsersQuerySchema,
  ExportUserDataQuerySchema,
  UserParamsSchema,
  VerifyEmailTokenParamsSchema,
  SessionParamsSchema,
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UpdateAvatarBodySchema,
  DeactivateUserBodySchema,

  // Validators
  validateGetUsersQuery,
  validateSearchUsersQuery,
  validateExportUserDataQuery,
  validateUserParams,
  validateVerifyEmailTokenParams,
  validateSessionParams,
  validateCreateUserBody,
  validateUpdateUserBody,
  validateUpdateAvatarBody,
  validateDeactivateUserBody,

  // Utils
  UserValidationUtils,
  ValidationPresets,
  ValidationFactory,
};
