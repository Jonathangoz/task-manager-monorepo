// src/commons/validators/user.validator.ts
import { body, query, param, ValidationChain } from 'express-validator';
import { 
  VALIDATION_PATTERNS, 
  SECURITY_CONFIG,
  DEFAULT_VALUES,
  PASSWORD_VALIDATION 
} from '@/utils/constants';

/**
 * Validaciones para consulta de usuarios con paginación y filtros
 */
export const getUsersQueryValidation: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: DEFAULT_VALUES.PAGINATION_MAX_LIMIT })
    .withMessage(`El límite debe estar entre 1 y ${DEFAULT_VALUES.PAGINATION_MAX_LIMIT}`)
    .toInt(),

  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 1 y 100 caracteres')
    .trim()
    .escape(), // Escapar caracteres HTML

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'email', 'username', 'firstName', 'lastName'])
    .withMessage('Campo de ordenamiento inválido'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('El orden debe ser "asc" o "desc"'),

  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un valor booleano')
    .toBoolean(),

  query('isVerified')
    .optional()
    .isBoolean()
    .withMessage('isVerified debe ser un valor booleano')
    .toBoolean(),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe estar en formato ISO 8601')
    .toDate(),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('La fecha de fin debe estar en formato ISO 8601')
    .toDate()
    .custom((value, { req }) => {
      if (req.query.dateFrom && value < new Date(req.query.dateFrom as string)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
];

/**
 * Validaciones para parámetros de usuario por ID (CUID)
 */
export const userParamsValidation: ValidationChain[] = [
  param('id')
    .matches(VALIDATION_PATTERNS.CUID)
    .withMessage('El ID del usuario debe ser un CUID válido'),
];

/**
 * Validaciones para actualización de usuario
 */
export const updateUserValidation: ValidationChain[] = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('El email debe tener un formato válido')
    .isLength({ max: SECURITY_CONFIG.EMAIL_MAX_LENGTH })
    .withMessage(`El email no puede exceder ${SECURITY_CONFIG.EMAIL_MAX_LENGTH} caracteres`)
    .normalizeEmail()
    .matches(VALIDATION_PATTERNS.EMAIL)
    .withMessage('Formato de email inválido'),

  body('username')
    .optional()
    .isLength({ 
      min: SECURITY_CONFIG.USERNAME_MIN_LENGTH, 
      max: SECURITY_CONFIG.USERNAME_MAX_LENGTH 
    })
    .withMessage(`El username debe tener entre ${SECURITY_CONFIG.USERNAME_MIN_LENGTH} y ${SECURITY_CONFIG.USERNAME_MAX_LENGTH} caracteres`)
    .matches(VALIDATION_PATTERNS.USERNAME)
    .withMessage('El username solo puede contener letras, números y guiones bajos')
    .trim(),

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
      const allowedFields = ['email', 'username', 'firstName', 'lastName', 'avatar'];
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
 * Validaciones para crear usuario (admin/system use)
 */
export const createUserValidation: ValidationChain[] = [
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
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .trim(),

  body('lastName')
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
];

/**
 * Validaciones para desactivar usuario
 */
export const deactivateUserValidation: ValidationChain[] = [
  body('reason')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('La razón debe tener entre 1 y 500 caracteres')
    .trim()
    .escape(),
];

/**
 * Validaciones para actualizar avatar
 */
export const updateAvatarValidation: ValidationChain[] = [
  body('avatar')
    .isURL()
    .withMessage('El avatar debe ser una URL válida')
    .isLength({ max: 500 })
    .withMessage('La URL del avatar no puede exceder 500 caracteres'),
];

/**
 * Validaciones para búsqueda avanzada de usuarios
 */
export const searchUsersValidation: ValidationChain[] = [
  query('q')
    .isLength({ min: 1, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 1 y 100 caracteres')
    .trim()
    .escape(),

  query('fields')
    .optional()
    .isString()
    .withMessage('Los campos deben ser una cadena separada por comas')
    .custom((value) => {
      const allowedFields = ['email', 'username', 'firstName', 'lastName'];
      const fields = value.split(',').map((f: string) => f.trim());
      const invalidFields = fields.filter((f: string) => !allowedFields.includes(f));
      
      if (invalidFields.length > 0) {
        throw new Error(`Campos inválidos: ${invalidFields.join(', ')}`);
      }
      return true;
    }),

  query('exactMatch')
    .optional()
    .isBoolean()
    .withMessage('exactMatch debe ser un valor booleano')
    .toBoolean(),

  query('caseSensitive')
    .optional()
    .isBoolean()
    .withMessage('caseSensitive debe ser un valor booleano')
    .toBoolean(),
];

/**
 * Validaciones for token de verificación de email
 */
export const verifyEmailTokenValidation: ValidationChain[] = [
  param('token')
    .notEmpty()
    .withMessage('El token de verificación es requerido')
    .isString()
    .withMessage('El token debe ser una cadena válida')
    .isLength({ min: 10 })
    .withMessage('El token debe tener al menos 10 caracteres'),
];

/**
 * Validaciones para parámetro de sesión
 */
export const sessionParamsValidation: ValidationChain[] = [
  param('sessionId')
    .matches(VALIDATION_PATTERNS.CUID)
    .withMessage('El ID de sesión debe ser un CUID válido'),
];

/**
 * Validaciones para exportación de datos de usuario
 */
export const exportUserDataValidation: ValidationChain[] = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('El formato debe ser "json" o "csv"'),

  query('includeHistory')
    .optional()
    .isBoolean()
    .withMessage('includeHistory debe ser un valor booleano')
    .toBoolean(),
];

// Tipos TypeScript para las requests
export interface GetUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: boolean;
  isVerified?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface UserParams {
  id: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface DeactivateUserRequest {
  reason?: string;
}

export interface UpdateAvatarRequest {
  avatar: string;
}

export interface SearchUsersQuery {
  q: string;
  fields?: string;
  exactMatch?: boolean;
  caseSensitive?: boolean;
}

export interface VerifyEmailTokenParams {
  token: string;
}

export interface SessionParams {
  sessionId: string;
}

export interface ExportUserDataQuery {
  format?: 'json' | 'csv';
  includeHistory?: boolean;
}

// Funciones helper para validación
export const validateCUID = (id: string): boolean => {
  return VALIDATION_PATTERNS.CUID.test(id);
};

export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[<>\"'%;()&+]/g, '') // Remover caracteres peligrosos
    .substring(0, 100); // Limitar longitud
};

export const validateEmail = (email: string): boolean => {
  return VALIDATION_PATTERNS.EMAIL.test(email);
};

export const validateUsername = (username: string): boolean => {
  return VALIDATION_PATTERNS.USERNAME.test(username);
};