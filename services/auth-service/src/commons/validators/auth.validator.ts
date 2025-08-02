// src/commons/validators/auth.validator.ts
import { z } from 'zod';
import {
  VALIDATION_PATTERNS,
  SECURITY_CONFIG,
  PASSWORD_VALIDATION,
} from '@/utils/constants';
import { Request, Response, NextFunction } from 'express';

// Base Schemas - Reutilización y principio DRY
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

const SimplePasswordSchema = z
  .string()
  .min(1, 'La contraseña es requerida')
  .nonempty('La contraseña no puede estar vacía');

const NameSchema = z
  .string()
  .min(1, 'Este campo debe tener al menos 1 carácter')
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

const TokenSchema = z
  .string()
  .min(10, 'El token debe tener al menos 10 caracteres')
  .nonempty('El token es requerido');

const CUIDSchema = z
  .string()
  .regex(VALIDATION_PATTERNS.CUID, 'El ID debe ser un CUID válido');

const ServiceSchema = z
  .string()
  .min(1, 'El nombre del servicio es requerido')
  .max(50, 'El nombre del servicio debe tener entre 1 y 50 caracteres')
  .transform((service) => service.trim());

// Authentication Schemas - Separación por funcionalidad

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
});

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: SimplePasswordSchema,
});

export const RefreshTokenBodySchema = z.object({
  refreshToken: TokenSchema,
});

export const VerifyTokenBodySchema = z.object({
  token: TokenSchema,
  service: ServiceSchema.optional(),
});

// Profile Management Schemas
export const UpdateProfileBodySchema = z
  .object({
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

export const ChangePasswordBodySchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'La contraseña actual es requerida')
      .nonempty('La contraseña actual es requerida'),
    newPassword: PasswordSchema,
  })
  .refine(
    (data) => {
      // La nueva contraseña debe ser diferente de la actual
      return data.newPassword !== data.currentPassword;
    },
    {
      message: 'La nueva contraseña debe ser diferente a la actual',
      path: ['newPassword'],
    },
  );

// Password Recovery Schemas
export const ForgotPasswordBodySchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordBodySchema = z.object({
  token: TokenSchema,
  password: PasswordSchema,
  email: EmailSchema,
});

export const VerifyEmailBodySchema = z.object({
  token: TokenSchema,
});

// Session Management Schemas
export const LogoutBodySchema = z.object({
  refreshToken: z.string().optional(),
});

export const TerminateSessionBodySchema = z.object({
  sessionId: CUIDSchema.optional(),
});

// Validation Factory - Patrón Factory para crear middlewares
class AuthValidationFactory {
  private static createErrorResponse(errors: z.ZodError) {
    return {
      success: false,
      message: 'Errores de validación en la autenticación',
      errors: errors.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  static createBodyValidator<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json(this.createErrorResponse(error));
        }
        return next(error);
      }
    };
  }

  static createOptionalBodyValidator<T extends z.ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Si no hay body, continúa sin validar
      if (!req.body || Object.keys(req.body).length === 0) {
        return next();
      }

      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json(this.createErrorResponse(error));
        }
        next(error);
      }
    };
  }
}

// Middleware Validators - Interfaz simple para uso en rutas
export const validateRegisterBody =
  AuthValidationFactory.createBodyValidator(RegisterBodySchema);
export const validateLoginBody =
  AuthValidationFactory.createBodyValidator(LoginBodySchema);
export const validateRefreshTokenBody =
  AuthValidationFactory.createBodyValidator(RefreshTokenBodySchema);
export const validateVerifyTokenBody =
  AuthValidationFactory.createBodyValidator(VerifyTokenBodySchema);
export const validateUpdateProfileBody =
  AuthValidationFactory.createBodyValidator(UpdateProfileBodySchema);
export const validateChangePasswordBody =
  AuthValidationFactory.createBodyValidator(ChangePasswordBodySchema);
export const validateForgotPasswordBody =
  AuthValidationFactory.createBodyValidator(ForgotPasswordBodySchema);
export const validateResetPasswordBody =
  AuthValidationFactory.createBodyValidator(ResetPasswordBodySchema);
export const validateVerifyEmailBody =
  AuthValidationFactory.createBodyValidator(VerifyEmailBodySchema);
export const validateLogoutBody =
  AuthValidationFactory.createOptionalBodyValidator(LogoutBodySchema);
export const validateTerminateSessionBody =
  AuthValidationFactory.createOptionalBodyValidator(TerminateSessionBodySchema);

// Type Inference - Tipos automáticos desde los schemas
export type RegisterRequest = z.infer<typeof RegisterBodySchema>;
export type LoginRequest = z.infer<typeof LoginBodySchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenBodySchema>;
export type VerifyTokenRequest = z.infer<typeof VerifyTokenBodySchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileBodySchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordBodySchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordBodySchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordBodySchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailBodySchema>;
export type LogoutRequest = z.infer<typeof LogoutBodySchema>;
export type TerminateSessionRequest = z.infer<
  typeof TerminateSessionBodySchema
>;

// Utility Functions - Funciones helper especializadas para auth
export class AuthValidationUtils {
  /**
   * Valida si un email es válido sin lanzar excepción
   */
  static validateEmail(email: string): boolean {
    return EmailSchema.safeParse(email).success;
  }

  /**
   * Valida si un username es válido sin lanzar excepción
   */
  static validateUsername(username: string): boolean {
    return UsernameSchema.safeParse(username).success;
  }

  /**
   * Valida si una contraseña es fuerte y devuelve detalles
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const result = PasswordSchema.safeParse(password);

    if (result.success) {
      return { isValid: true, errors: [], strength: 'strong' };
    }

    const errors = result.error.errors.map((err) => err.message);
    const strength =
      password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH ? 'weak' : 'medium';

    return { isValid: false, errors, strength };
  }

  /**
   * Valida si un token tiene el formato correcto
   */
  static validateToken(token: string): boolean {
    return TokenSchema.safeParse(token).success;
  }

  /**
   * Valida si un CUID es válido
   */
  static validateCUID(id: string): boolean {
    return CUIDSchema.safeParse(id).success;
  }

  /**
   * Sanitiza datos de entrada para prevenir ataques
   */
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>"'%;()&+]/g, '') // Remover caracteres peligrosos
      .substring(0, 500); // Limitar longitud
  }

  /**
   * Verifica si dos contraseñas son diferentes
   */
  static arePasswordsDifferent(current: string, newPassword: string): boolean {
    return current !== newPassword;
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

  /**
   * Valida múltiples campos a la vez
   */
  static validateAuthData(data: {
    email?: string;
    username?: string;
    password?: string;
  }): {
    isValid: boolean;
    fieldErrors: Record<string, string[]>;
  } {
    const fieldErrors: Record<string, string[]> = {};
    let isValid = true;

    if (data.email) {
      const emailResult = this.safeValidate(EmailSchema, data.email);
      if (!emailResult.success) {
        fieldErrors.email = emailResult.errors?.map((e) => e.message) || [];
        isValid = false;
      }
    }

    if (data.username) {
      const usernameResult = this.safeValidate(UsernameSchema, data.username);
      if (!usernameResult.success) {
        fieldErrors.username =
          usernameResult.errors?.map((e) => e.message) || [];
        isValid = false;
      }
    }

    if (data.password) {
      const passwordResult = this.validatePassword(data.password);
      if (!passwordResult.isValid) {
        fieldErrors.password = passwordResult.errors;
        isValid = false;
      }
    }

    return { isValid, fieldErrors };
  }
}

// Validation Presets - Conjuntos predefinidos para flujos comunes
export const AuthValidationPresets = {
  // Flujo de registro completo
  registration: {
    body: validateRegisterBody,
  },

  // Flujo de autenticación
  authentication: {
    login: validateLoginBody,
    refresh: validateRefreshTokenBody,
    verify: validateVerifyTokenBody,
    logout: validateLogoutBody,
  },

  // Flujo de gestión de perfil
  profile: {
    update: validateUpdateProfileBody,
    changePassword: validateChangePasswordBody,
  },

  // Flujo de recuperación de contraseña
  passwordRecovery: {
    forgot: validateForgotPasswordBody,
    reset: validateResetPasswordBody,
  },

  // Flujo de verificación de email
  emailVerification: {
    verify: validateVerifyEmailBody,
  },

  // Flujo de gestión de sesiones
  sessionManagement: {
    terminate: validateTerminateSessionBody,
  },
} as const;

// Advanced Validation Compositors - Para casos complejos
export class AuthValidationCompositor {
  /**
   * Crea un validador condicional basado en el tipo de operación
   */
  static createConditionalValidator(conditions: {
    [key: string]: z.ZodSchema;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      const operationType = req.body?.operationType || req.query?.type;
      const schema = conditions[operationType];

      if (!schema) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de operación no válido o no especificado',
          error: { code: 'INVALID_OPERATION_TYPE' },
        });
      }

      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            message: 'Errores de validación',
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

  /**
   * Combina múltiples validadores en uno solo
   */
  static combineValidators(
    ...validators: Array<
      (req: Request, res: Response, next: NextFunction) => void
    >
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      let currentIndex = 0;

      const runNext = (error?: unknown) => {
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
}

// Export Default - Objeto principal con toda la funcionalidad
export default {
  // Schemas
  RegisterBodySchema,
  LoginBodySchema,
  RefreshTokenBodySchema,
  VerifyTokenBodySchema,
  UpdateProfileBodySchema,
  ChangePasswordBodySchema,
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
  VerifyEmailBodySchema,
  LogoutBodySchema,
  TerminateSessionBodySchema,

  // Validators
  validateRegisterBody,
  validateLoginBody,
  validateRefreshTokenBody,
  validateVerifyTokenBody,
  validateUpdateProfileBody,
  validateChangePasswordBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
  validateVerifyEmailBody,
  validateLogoutBody,
  validateTerminateSessionBody,

  // Utils y herramientas avanzadas
  AuthValidationUtils,
  AuthValidationPresets,
  AuthValidationCompositor,
  AuthValidationFactory,
};
