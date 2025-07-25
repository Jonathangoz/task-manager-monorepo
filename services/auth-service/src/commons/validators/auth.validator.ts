// src/commons/validators/auth.validator.ts
import { body, ValidationChain } from 'express-validator';
import { 
  VALIDATION_PATTERNS, 
  SECURITY_CONFIG,
  ERROR_MESSAGES,
  PASSWORD_VALIDATION 
} from '@/utils/constants';

/**
 * Validaciones para registro de usuario
 */
export const registerValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('El email debe tener un formato válido')
    .isLength({ max: SECURITY_CONFIG.EMAIL_MAX_LENGTH })
    .withMessage(`El email no puede exceder ${SECURITY_CONFIG.EMAIL_MAX_LENGTH} caracteres`)
    .normalizeEmail()
    .matches(VALIDATION_PATTERNS.EMAIL)
    .withMessage('Formato de email inválido'),

  body('username')
    .isLength({ 
      min: SECURITY_CONFIG.USERNAME_MIN_LENGTH, 
      max: SECURITY_CONFIG.USERNAME_MAX_LENGTH 
    })
    .withMessage(`El username debe tener entre ${SECURITY_CONFIG.USERNAME_MIN_LENGTH} y ${SECURITY_CONFIG.USERNAME_MAX_LENGTH} caracteres`)
    .matches(VALIDATION_PATTERNS.USERNAME)
    .withMessage('El username solo puede contener letras, números y guiones bajos')
    .trim(),

  body('password')
    .isLength({ 
      min: SECURITY_CONFIG.PASSWORD_MIN_LENGTH, 
      max: SECURITY_CONFIG.PASSWORD_MAX_LENGTH 
    })
    .withMessage(`La contraseña debe tener entre ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} y ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} caracteres`)
    .matches(VALIDATION_PATTERNS.PASSWORD_STRONG)
    .withMessage('La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial')
    .custom((value) => {
      // Verificar patrones prohibidos
      for (const pattern of PASSWORD_VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(value)) {
          throw new Error('La contraseña contiene un patrón no permitido');
        }
      }
      return true;
    }),

  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .trim(),

  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El apellido debe tener entre 1 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios')
    .trim(),
];

/**
 * Validaciones para login
 */
export const loginValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('El email debe tener un formato válido')
    .normalizeEmail()
    .matches(VALIDATION_PATTERNS.EMAIL)
    .withMessage('Formato de email inválido'),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ min: 1 })
    .withMessage('La contraseña no puede estar vacía'),
];

/**
 * Validaciones para refresh token
 */
export const refreshTokenValidation: ValidationChain[] = [
  body('refreshToken')
    .notEmpty()
    .withMessage('El refresh token es requerido')
    .isLength({ min: 10 })
    .withMessage('El refresh token debe tener al menos 10 caracteres')
    .isString()
    .withMessage('El refresh token debe ser una cadena válida'),
];

/**
 * Validaciones para verificación de token (usado por otros servicios)
 */
export const verifyTokenValidation: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('El token es requerido')
    .isString()
    .withMessage('El token debe ser una cadena válida')
    .isLength({ min: 10 })
    .withMessage('El token debe tener al menos 10 caracteres'),

  body('service')
    .optional()
    .isString()
    .withMessage('El servicio debe ser una cadena válida')
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre del servicio debe tener entre 1 y 50 caracteres')
    .trim(),
];

/**
 * Validaciones para actualizar perfil
 */
export const updateProfileValidation: ValidationChain[] = [
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .trim(),

  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El apellido debe tener entre 1 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios')
    .trim(),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('El avatar debe ser una URL válida')
    .isLength({ max: 500 })
    .withMessage('La URL del avatar no puede exceder 500 caracteres'),

  // Validación personalizada para asegurar que al menos un campo esté presente
  body()
    .custom((value, { req }) => {
      const allowedFields = ['firstName', 'lastName', 'avatar'];
      const providedFields = Object.keys(req.body).filter(key => 
        allowedFields.includes(key) && req.body[key] !== undefined && req.body[key] !== ''
      );
      
      if (providedFields.length === 0) {
        throw new Error('Debe proporcionar al menos un campo para actualizar');
      }
      return true;
    }),
];

/**
 * Validaciones para cambio de contraseña
 */
export const changePasswordValidation: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida')
    .isString()
    .withMessage('La contraseña actual debe ser una cadena válida'),

  body('newPassword')
    .isLength({ 
      min: SECURITY_CONFIG.PASSWORD_MIN_LENGTH, 
      max: SECURITY_CONFIG.PASSWORD_MAX_LENGTH 
    })
    .withMessage(`La nueva contraseña debe tener entre ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} y ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} caracteres`)
    .matches(VALIDATION_PATTERNS.PASSWORD_STRONG)
    .withMessage('La nueva contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial')
    .custom((value, { req }) => {
      // Verificar que la nueva contraseña sea diferente de la actual
      if (value === req.body.currentPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }
      
      // Verificar patrones prohibidos
      for (const pattern of PASSWORD_VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(value)) {
          throw new Error('La nueva contraseña contiene un patrón no permitido');
        }
      }
      
      return true;
    }),
];

/**
 * Validaciones para recuperación de contraseña
 */
export const forgotPasswordValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('El email debe tener un formato válido')
    .normalizeEmail()
    .matches(VALIDATION_PATTERNS.EMAIL)
    .withMessage('Formato de email inválido'),
];

/**
 * Validaciones para reset de contraseña
 */
export const resetPasswordValidation: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('El token de reset es requerido')
    .isString()
    .withMessage('El token debe ser una cadena válida')
    .isLength({ min: 10 })
    .withMessage('El token debe tener al menos 10 caracteres'),

  body('password')
    .isLength({ 
      min: SECURITY_CONFIG.PASSWORD_MIN_LENGTH, 
      max: SECURITY_CONFIG.PASSWORD_MAX_LENGTH 
    })
    .withMessage(`La contraseña debe tener entre ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} y ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} caracteres`)
    .matches(VALIDATION_PATTERNS.PASSWORD_STRONG)
    .withMessage('La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial')
    .custom((value) => {
      // Verificar patrones prohibidos
      for (const pattern of PASSWORD_VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(value)) {
          throw new Error('La contraseña contiene un patrón no permitido');
        }
      }
      return true;
    }),

  body('email')
    .isEmail()
    .withMessage('El email debe tener un formato válido')
    .normalizeEmail()
    .matches(VALIDATION_PATTERNS.EMAIL)
    .withMessage('Formato de email inválido'),
];

/**
 * Validaciones para verificación de email
 */
export const verifyEmailValidation: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('El token de verificación es requerido')
    .isString()
    .withMessage('El token debe ser una cadena válida')
    .isLength({ min: 10 })
    .withMessage('El token debe tener al menos 10 caracteres'),
];

/**
 * Validaciones para logout (solo refresh token opcional)
 */
export const logoutValidation: ValidationChain[] = [
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('El refresh token debe ser una cadena válida'),
];

/**
 * Validaciones para terminar sesión específica
 */
export const terminateSessionValidation: ValidationChain[] = [
  body('sessionId')
    .optional()
    .matches(VALIDATION_PATTERNS.CUID)
    .withMessage('El ID de sesión debe ser un CUID válido'),
];

// Tipos TypeScript para las requests (inferidos de las validaciones)
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface VerifyTokenRequest {
  token: string;
  service?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  email: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface TerminateSessionRequest {
  sessionId?: string;
}