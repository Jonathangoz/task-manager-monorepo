// src/utils/constants.ts

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_INACTIVE: 'USER_INACTIVE',
  USER_NOT_VERIFIED: 'USER_NOT_VERIFIED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_USERNAME: 'INVALID_USERNAME',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',
  MAX_SESSIONS_EXCEEDED: 'MAX_SESSIONS_EXCEEDED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_LOGIN_ATTEMPTS: 'TOO_MANY_LOGIN_ATTEMPTS',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Additional errors needed by middlewares
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  USER_REGISTERED: 'User registered successfully',
  LOGIN_SUCCESSFUL: 'Login successful',
  LOGOUT_SUCCESSFUL: 'Logout successful',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  PASSWORD_UPDATED: 'Password updated successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  SESSION_TERMINATED: 'Session terminated successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  TOKEN_REQUIRED: 'Authentication token is required',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists with this email or username',
  USER_INACTIVE: 'User account is inactive',
  PASSWORD_TOO_WEAK: 'Password does not meet security requirements',
  VALIDATION_ERROR: 'Validation failed',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  DATABASE_CONNECTION_ERROR: 'Database connection error',
  REDIS_CONNECTION_ERROR: 'Cache service connection error',
} as const;

// Token Configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_HEADER: 'authorization',
  REFRESH_TOKEN_HEADER: 'x-refresh-token',
  TOKEN_PREFIX: 'Bearer ',
  SESSION_HEADER: 'x-session-id',
  CSRF_HEADER: 'x-csrf-token',
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPT_WINDOW: 15 * 60 * 1000, // 15 minutos
  JWT_SECRET_MIN_LENGTH: 64,
  JWE_SECRET_LENGTH: 32,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  EMAIL_MAX_LENGTH: 255,
  SESSION_MAX_COUNT: 10, // Máximo de sesiones activas por usuario
  TOKEN_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas
} as const;

// Cache Keys Patterns
export const CACHE_KEYS = {
  USER_SESSION: (sessionId: string) => `auth:session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `auth:user:${userId}:sessions`,
  REFRESH_TOKEN: (tokenId: string) => `auth:refresh:${tokenId}`,
  LOGIN_ATTEMPTS: (email: string) => `auth:login:attempts:${email}`,
  RATE_LIMIT: (key: string) => `auth:ratelimit:${key}`,
  USER_PROFILE: (userId: string) => `auth:user:${userId}:profile`,
  PASSWORD_RESET: (token: string) => `auth:reset:${token}`,
  EMAIL_VERIFICATION: (token: string) => `auth:verify:${token}`,
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  ACCESS_TOKEN: 15 * 60, // 15 minutos
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 días
  USER_SESSION: 24 * 60 * 60, // 24 horas
  LOGIN_ATTEMPTS: 15 * 60, // 15 minutos
  RATE_LIMIT: 15 * 60, // 15 minutos
  USER_PROFILE: 30 * 60, // 30 minutos
  PASSWORD_RESET: 15 * 60, // 15 minutos
  EMAIL_VERIFICATION: 24 * 60 * 60, // 24 horas
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]+$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  CUID: /^c[a-z0-9]{24}$/,
} as const;

// Event Types para logging y auditoria
export const EVENT_TYPES = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_LOGIN_FAILED: 'user.login.failed',
  TOKEN_REFRESHED: 'token.refreshed',
  PASSWORD_CHANGED: 'password.changed',
  SESSION_CREATED: 'session.created',
  SESSION_TERMINATED: 'session.terminated',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
} as const;

// Default Values
export const DEFAULT_VALUES = {
  PAGINATION_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,
  PASSWORD_HASH_ROUNDS: 12,
  SESSION_CLEANUP_BATCH_SIZE: 1000,
  MAX_CONCURRENT_SESSIONS: 10,
} as const;

// Environment specific constants
export const ENV_CONFIG = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

// API Response Types
export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    correlationId?: string;
    requestId?: string;
    path?: string;
    method?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
};

// Request Headers
export const REQUEST_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  USER_AGENT: 'user-agent',
  FORWARDED_FOR: 'x-forwarded-for',
  REAL_IP: 'x-real-ip',
} as const;

// Prisma Error Codes
export const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT_VIOLATION: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT_VIOLATION: 'P2003',
  NULL_CONSTRAINT_VIOLATION: 'P2011',
  RELATION_VIOLATION: 'P2014',
  REQUIRED_RELATION_VIOLATION: 'P2018',
} as const;

// Token Types (matching Prisma schema)
export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_CHANGE: 'EMAIL_CHANGE',
} as const;

// Session Status
export const SESSION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
  INVALID: 'invalid',
} as const;

// Login Attempt Reasons
export const LOGIN_ATTEMPT_REASONS = {
  INVALID_PASSWORD: 'invalid_password',
  USER_NOT_FOUND: 'user_not_found',
  USER_INACTIVE: 'user_inactive',
  USER_NOT_VERIFIED: 'user_not_verified',
  RATE_LIMITED: 'rate_limited',
  ACCOUNT_LOCKED: 'account_locked',
} as const;

// Password Validation
export const PASSWORD_VALIDATION = {
  MIN_LENGTH: SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
  MAX_LENGTH: SECURITY_CONFIG.PASSWORD_MAX_LENGTH,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SYMBOLS: true,
  FORBIDDEN_PATTERNS: [
    /(.)\1{2,}/, // No more than 2 consecutive identical characters
    /^(password|123456|qwerty)/i, // Common passwords
  ],
} as const;

// Device Detection Patterns
export const DEVICE_PATTERNS = {
  MOBILE: /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i,
  TABLET: /iPad|Android(?!.*Mobile)|Tablet/i,
  DESKTOP: /Chrome|Firefox|Safari|Edge|Opera/i,
  BOT: /bot|crawler|spider|scraper/i,
} as const;

// Export all constants as a single object for easier imports
export const CONSTANTS = {
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  TOKEN_CONFIG,
  SECURITY_CONFIG,
  CACHE_KEYS,
  CACHE_TTL,
  VALIDATION_PATTERNS,
  EVENT_TYPES,
  DEFAULT_VALUES,
  ENV_CONFIG,
  REQUEST_HEADERS,
  PRISMA_ERROR_CODES,
  TOKEN_TYPES,
  SESSION_STATUS,
  LOGIN_ATTEMPT_REASONS,
  PASSWORD_VALIDATION,
  DEVICE_PATTERNS,
} as const;

// Adiciones para src/utils/constants.ts
// Estas constantes deben agregarse al archivo constants.ts existente

// Mensajes de éxito adicionales
export const ADDITIONAL_SUCCESS_MESSAGES = {
  PROFILE_RETRIEVED: 'Profile retrieved successfully',
  AVATAR_UPDATED: 'Avatar updated successfully',
  ACCOUNT_DEACTIVATED: 'Account deactivated successfully',
  ACCOUNT_REACTIVATED: 'Account reactivated successfully',
  EMAIL_VERIFICATION_SENT: 'Email verification sent successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  ALL_SESSIONS_TERMINATED: 'All sessions terminated successfully',
} as const;

// Códigos de error adicionales
export const ADDITIONAL_ERROR_CODES = {
  PROFILE_UPDATE_FAILED: 'PROFILE_UPDATE_FAILED',
  AVATAR_UPDATE_FAILED: 'AVATAR_UPDATE_FAILED',
  ACCOUNT_ALREADY_DEACTIVATED: 'ACCOUNT_ALREADY_DEACTIVATED',
  ACCOUNT_ALREADY_ACTIVE: 'ACCOUNT_ALREADY_ACTIVE',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  VERIFICATION_TOKEN_EXPIRED: 'VERIFICATION_TOKEN_EXPIRED',
  VERIFICATION_TOKEN_INVALID: 'VERIFICATION_TOKEN_INVALID',
  PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',
  PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',
  SAME_PASSWORD: 'SAME_PASSWORD',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',
} as const;

// Mensajes de error adicionales
export const ADDITIONAL_ERROR_MESSAGES = {
  PROFILE_UPDATE_FAILED: 'Failed to update profile',
  AVATAR_UPDATE_FAILED: 'Failed to update avatar',
  ACCOUNT_ALREADY_DEACTIVATED: 'Account is already deactivated',
  ACCOUNT_ALREADY_ACTIVE: 'Account is already active',
  EMAIL_ALREADY_VERIFIED: 'Email is already verified',
  VERIFICATION_TOKEN_EXPIRED: 'Email verification token has expired',
  VERIFICATION_TOKEN_INVALID: 'Invalid email verification token',
  PASSWORD_RESET_TOKEN_EXPIRED: 'Password reset token has expired',
  PASSWORD_RESET_TOKEN_INVALID: 'Invalid password reset token',
  SAME_PASSWORD: 'New password must be different from current password',
  EMAIL_ALREADY_EXISTS: 'Email is already in use',
  USERNAME_ALREADY_EXISTS: 'Username is already in use',
} as const;

// Tipos adicionales para las interfaces
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserFilters {
  search?: string;
  isActive?: boolean;
  isVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tipos para el middleware de autenticación
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        sessionId: string;
        iat: number;
        exp: number;
      };
    }
  }
}

// Headers de request adicionales
export const ADDITIONAL_REQUEST_HEADERS = {
  SESSION_ID: 'x-session-id',
  DEVICE_ID: 'x-device-id',
  CLIENT_VERSION: 'x-client-version',
  TIMEZONE: 'x-timezone',
} as const;

// Configuración de cookies
export const COOKIE_CONFIG = {
  REFRESH_TOKEN_NAME: 'task_manager_refresh_token',
  SESSION_COOKIE_NAME: 'task_manager_session',
  CSRF_TOKEN_NAME: 'task_manager_csrf',
  MAX_AGE: {
    REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 días
    SESSION: 24 * 60 * 60 * 1000, // 24 horas
    CSRF: 24 * 60 * 60 * 1000, // 24 horas
  },
  OPTIONS: {
    SECURE: process.env.NODE_ENV === 'production',
    HTTP_ONLY: true,
    SAME_SITE: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
} as const;

// Configuración de validación adicional
export const VALIDATION_CONFIG = {
  USER_ID_REGEX: /^c[a-z0-9]{24}$/,
  SESSION_ID_REGEX: /^[a-zA-Z0-9-_]{32,}$/,
  TOKEN_REGEX: /^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/,
  MAX_SEARCH_LENGTH: 100,
  MAX_REASON_LENGTH: 500,
} as const;

// Estados de cuenta de usuario
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_VERIFICATION: 'pending_verification',
} as const;

// Tipos de actividad de usuario para logging
export const USER_ACTIVITY_TYPES = {
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPDATED: 'avatar_updated',
  PASSWORD_CHANGED: 'password_changed',
  EMAIL_VERIFIED: 'email_verified',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  ACCOUNT_REACTIVATED: 'account_reactivated',
  SESSION_TERMINATED: 'session_terminated',
  ALL_SESSIONS_TERMINATED: 'all_sessions_terminated',
} as const;

// Configuración de rate limiting específica
export const RATE_LIMIT_CONFIG = {
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 5, // 5 intentos por ventana
  },
  REGISTRATION: {
    WINDOW_MS: 60 * 60 * 1000, // 1 hora
    MAX_REQUESTS: 3, // 3 registros por hora por IP
  },
  PASSWORD_RESET: {
    WINDOW_MS: 60 * 60 * 1000, // 1 hora
    MAX_REQUESTS: 5, // 5 intentos por hora
  },
  EMAIL_VERIFICATION: {
    WINDOW_MS: 10 * 60 * 1000, // 10 minutos
    MAX_REQUESTS: 3, // 3 intentos por 10 minutos
  },
  GENERAL: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100, // 100 requests por ventana
  },
} as const;

// Configuración de timeouts
export const TIMEOUT_CONFIG = {
  DATABASE_QUERY: 30000, // 30 segundos
  REDIS_OPERATION: 5000, // 5 segundos
  HTTP_REQUEST: 10000, // 10 segundos
  EMAIL_SEND: 15000, // 15 segundos
} as const;

// Configuración de health checks
export const HEALTH_CHECK_CONFIG = {
  DATABASE: {
    TIMEOUT: 5000,
    RETRY_COUNT: 3,
  },
  REDIS: {
    TIMEOUT: 3000,
    RETRY_COUNT: 2,
  },
  EXTERNAL_SERVICE: {
    TIMEOUT: 10000,
    RETRY_COUNT: 2,
  },
} as const;

// Límites de sistema
export const SYSTEM_LIMITS = {
  MAX_CONCURRENT_SESSIONS: 10,
  MAX_LOGIN_ATTEMPTS_PER_HOUR: 10,
  MAX_PASSWORD_RESET_ATTEMPTS_PER_DAY: 5,
  MAX_EMAIL_VERIFICATION_ATTEMPTS_PER_HOUR: 5,
  MAX_PROFILE_UPDATES_PER_DAY: 20,
} as const;

// Configuración de logging
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

// Configuración de entorno
export const ENVIRONMENT_CONFIG = {
  DEVELOPMENT: {
    LOG_LEVEL: 'debug',
    ENABLE_SWAGGER: true,
    ENABLE_DETAILED_ERRORS: true,
    ENABLE_CORS: true,
  },
  PRODUCTION: {
    LOG_LEVEL: 'info',
    ENABLE_SWAGGER: false,
    ENABLE_DETAILED_ERRORS: false,
    ENABLE_CORS: false,
  },
  TEST: {
    LOG_LEVEL: 'warn',
    ENABLE_SWAGGER: false,
    ENABLE_DETAILED_ERRORS: true,
    ENABLE_CORS: true,
  },
} as const;

export const MIDDLEWARE_CONFIG = {
  CORRELATION_ID_HEADER: 'x-correlation-id',
  REQUEST_TIMEOUT: 30000,
  MAX_REQUEST_SIZE: '10mb',
  COMPRESSION_THRESHOLD: 1024,
} as const;

export const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Invalid email format',
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  USERNAME_REQUIRED: 'Username is required',
  USERNAME_TOO_SHORT: 'Username must be at least 3 characters',
  USERNAME_TOO_LONG: 'Username must be less than 30 characters',
} as const;

// Exportar todo junto con las constantes existentes
export const EXTENDED_CONSTANTS = {
  ...CONSTANTS, // Constantes existentes del archivo original
  ADDITIONAL_SUCCESS_MESSAGES,
  ADDITIONAL_ERROR_CODES,
  ADDITIONAL_ERROR_MESSAGES,
  ADDITIONAL_REQUEST_HEADERS,
  COOKIE_CONFIG,
  VALIDATION_CONFIG,
  USER_STATUS,
  USER_ACTIVITY_TYPES,
  RATE_LIMIT_CONFIG,
  TIMEOUT_CONFIG,
  HEALTH_CHECK_CONFIG,
  SYSTEM_LIMITS,
  LOG_LEVELS,
  ENVIRONMENT_CONFIG,
} as const;

