// src/utils/constants.ts - Auth-Service

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
  USER_REGISTERED: 'Usuario registrado exitosamente',
  LOGIN_SUCCESSFUL: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESSFUL: 'Cierre de sesión exitoso',
  TOKEN_REFRESHED: 'Token actualizado exitosamente',
  PASSWORD_UPDATED: 'Contraseña actualizada exitosamente',
  PROFILE_UPDATED: 'Perfil actualizado exitosamente',
  SESSION_TERMINATED: 'Sesión terminada exitosamente',
  EMAIL_VERIFIED: 'Correo electrónico verificado exitosamente',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Correo electrónico o contraseña inválidos',
  TOKEN_EXPIRED: 'El token ha expirado',
  TOKEN_INVALID: 'Token inválido',
  TOKEN_REQUIRED: 'Se requiere un token de autenticación',
  USER_NOT_FOUND: 'Usuario no encontrado',
  USER_ALREADY_EXISTS:
    'El usuario ya existe con este correo electrónico o nombre de usuario',
  USER_INACTIVE: 'La cuenta de usuario está inactiva',
  PASSWORD_TOO_WEAK: 'La contraseña no cumple con los requisitos de seguridad',
  VALIDATION_ERROR: 'La validación falló',
  RATE_LIMIT_EXCEEDED:
    'Demasiadas solicitudes, por favor inténtalo de nuevo más tarde',
  INTERNAL_ERROR: 'Error interno del servidor',
  SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible',
  DATABASE_CONNECTION_ERROR: 'Error de conexión con la base de datos',
  REDIS_CONNECTION_ERROR: 'Error de conexión con el servicio de caché',
  TOO_MANY_LOGIN_ATTEMPTS: 'Intentos de login',
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
  USER_TASKS: 180, // 3 minutos
  USER_CATEGORIES: 600, // 10 minutos
  USER_STATS: 300, // 5 minutos
  TASK_DETAIL: 300, // 5 minutos
  CATEGORY_DETAIL: 600, // 10 minutos
  CATEGORY_TASKS: 180, // 3 minutos
  SEARCH_RESULTS: 120, // 2 minutos
  RATE_LIMIT: 900, // 15 minutos (900s)
  LOGIN_ATTEMPTS: 900, // 15 minutos (900s)
  USER_SESSION: 900, // 15 minutos (900s)
  REFRESH_TOKEN: 604800, // 7 días (604800s)
  USER_PROFILE: 600, // 10 minutos (600s)
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]+$/,
  PASSWORD_STRONG:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  CUID: /^c[a-z0-9]{24}$/,
} as const;

// Event Types para logging y auditoria
export const EVENT_TYPES = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_STATUS_CHANGED: 'task.status.changed',
  TASK_COMPLETED: 'task.completed',

  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',

  USER_STATS_UPDATED: 'stats.updated',

  AUTH_TOKEN_VALIDATED: 'auth.token.validated',
  AUTH_SERVICE_ERROR: 'auth.service.error',

  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_ERROR: 'cache.error',

  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
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
  ACTIVE: 'activa',
  EXPIRED: 'expirada',
  TERMINATED: 'terminada',
  INVALID: 'invalida',
} as const;

// Login Attempt Reasons
export const LOGIN_ATTEMPT_REASONS = {
  INVALID_PASSWORD: 'contraseña_incorrecta',
  USER_NOT_FOUND: 'userio_no_encontrado',
  USER_INACTIVE: 'userio_inactivo',
  USER_NOT_VERIFIED: 'userio_no_verificado',
  RATE_LIMITED: 'rate_limitado',
  ACCOUNT_LOCKED: 'cuenta_bloqueada',
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
  PROFILE_RETRIEVED: 'Perfil obtenido exitosamente',
  AVATAR_UPDATED: 'Avatar actualizado exitosamente',
  ACCOUNT_DEACTIVATED: 'Cuenta desactivada exitosamente',
  ACCOUNT_REACTIVATED: 'Cuenta reactivada exitosamente',
  EMAIL_VERIFICATION_SENT: 'Correo de verificación enviado exitosamente',
  EMAIL_VERIFIED: 'Correo electrónico verificado exitosamente',
  PASSWORD_RESET_SENT: 'Correo para restablecer la contraseña enviado',
  PASSWORD_RESET_SUCCESS: 'Contraseña restablecida exitosamente',
  ALL_SESSIONS_TERMINATED: 'Todas las sesiones se han cerrado exitosamente',
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
  PROFILE_UPDATE_FAILED: 'Error al actualizar el perfil',
  AVATAR_UPDATE_FAILED: 'Error al actualizar el avatar',
  ACCOUNT_ALREADY_DEACTIVATED: 'La cuenta ya está desactivada',
  ACCOUNT_ALREADY_ACTIVE: 'La cuenta ya está activa',
  EMAIL_ALREADY_VERIFIED: 'El correo electrónico ya está verificado',
  VERIFICATION_TOKEN_EXPIRED: 'El token de verificación de correo ha expirado',
  VERIFICATION_TOKEN_INVALID: 'Token de verificación de correo inválido',
  PASSWORD_RESET_TOKEN_EXPIRED:
    'El token para restablecer la contraseña ha expirado',
  PASSWORD_RESET_TOKEN_INVALID: 'Token para restablecer la contraseña inválido',
  SAME_PASSWORD: 'La nueva contraseña debe ser diferente a la actual',
  EMAIL_ALREADY_EXISTS: 'El correo electrónico ya está en uso',
  USERNAME_ALREADY_EXISTS: 'El nombre de usuario ya está en uso',
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
  ACTIVE: 'activo',
  INACTIVE: 'inactivo',
  SUSPENDED: 'suspendido',
  PENDING_VERIFICATION: 'pendiente_verificacion',
} as const;

// Tipos de actividad de usuario para logging
export const USER_ACTIVITY_TYPES = {
  PROFILE_UPDATED: 'perfil_actualizado',
  AVATAR_UPDATED: 'avatar_actualizado',
  PASSWORD_CHANGED: 'contraseña_cambiada',
  EMAIL_VERIFIED: 'email_verificado',
  ACCOUNT_DEACTIVATED: 'cuenta_desactivada',
  ACCOUNT_REACTIVATED: 'cuenta_reactivada',
  SESSION_TERMINATED: 'sesion_terminada',
  ALL_SESSIONS_TERMINATED: 'todas_sesiones_terminadas',
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
  // HEALTH CHECKS - SIN RATE LIMITING o muy permisivo
  HEALTH_CHECK: {
    WINDOW_MS: 1 * 60 * 1000, // 1 minuto
    MAX_REQUESTS: 200, // 200 health checks por minuto (muy permisivo)
  },
} as const;

// Configuración de timeouts
export const TIMEOUT_CONFIG = {
  // HTTP requests normales
  HTTP_REQUEST: 30000, // 30 segundos (era 10s, muy agresivo)

  // Health checks - MUY RÁPIDOS
  HEALTH_CHECK_BASIC: 2000, // 2 segundos para health check básico
  HEALTH_CHECK_DETAILED: 5000, // 5 segundos para health check detallado

  // Database operations
  DATABASE_QUERY: 15000, // 15 segundos (era 30s, reducido)
  DATABASE_HEALTH_CHECK: 3000, // 3 segundos para health check de DB
  DATABASE_CONNECTION: 10000, // 10 segundos para conectar

  // Redis operations
  REDIS_OPERATION: 5000, // 5 segundos (era 10s)
  REDIS_HEALTH_CHECK: 2000, // 2 segundos para health check de Redis
  REDIS_CONNECTION: 5000, // 5 segundos para conectar

  // Email y operaciones externas
  EMAIL_SEND: 15000, // 15 segundos
  EXTERNAL_API: 10000, // 10 segundos

  // Server timeouts
  SERVER_REQUEST: 30000, // 30 segundos
  SERVER_KEEP_ALIVE: 65000, // 65 segundos
  SERVER_HEADERS: 66000, // 66 segundos
} as const;

// Configuración de health checks optimizada
export const HEALTH_CHECK_CONFIG = {
  DATABASE: {
    TIMEOUT: 3000, // 3 segundos (era 10s)
    RETRY_COUNT: 2, // 2 reintentos (era 3)
    QUICK_CHECK_TIMEOUT: 1000, // 1 segundo para check básico
  },
  REDIS: {
    TIMEOUT: 2000, // 2 segundos (era 10s)
    RETRY_COUNT: 2, // 2 reintentos
    QUICK_CHECK_TIMEOUT: 500, // 500ms para check básico
  },
  EXTERNAL_SERVICE: {
    TIMEOUT: 5000, // 5 segundos (era 10s)
    RETRY_COUNT: 1, // 1 reintento (era 2)
    QUICK_CHECK_TIMEOUT: 2000, // 2 segundos para check básico
  },
  // Configuración específica para Docker health checks
  DOCKER_HEALTH_CHECK: {
    INTERVAL: 10000, // 10 segundos
    TIMEOUT: 5000, // 5 segundos
    START_PERIOD: 30000, // 30 segundos
    RETRIES: 3,
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
  REQUEST_TIMEOUT: 30000, // 30 segundos (era muy bajo)
  MAX_REQUEST_SIZE: '10mb',
  COMPRESSION_THRESHOLD: 1024,

  // Paths que NO deben tener timeouts agresivos
  TIMEOUT_EXEMPT_PATHS: [
    '/health',
    '/api/v1/health',
    '/api/v1/health/live',
    '/api/v1/health/ready',
    '/metrics',
    '/favicon.ico',
  ],

  // Paths que NO deben tener rate limiting
  RATE_LIMIT_EXEMPT_PATHS: [
    '/health',
    '/api/v1/health',
    '/api/v1/health/live',
    '/api/v1/health/ready',
    '/metrics',
  ],

  // Paths que NO deben tener logging detallado
  MINIMAL_LOGGING_PATHS: [
    '/health',
    '/api/v1/health',
    '/metrics',
    '/favicon.ico',
  ],
} as const;

export const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'El correo electrónico es requerido',
  EMAIL_INVALID: 'Formato de correo electrónico inválido',
  PASSWORD_REQUIRED: 'La contraseña es requerida',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
  USERNAME_REQUIRED: 'El nombre de usuario es requerido',
  USERNAME_TOO_SHORT: 'El nombre de usuario debe tener al menos 3 caracteres',
  USERNAME_TOO_LONG: 'El nombre de usuario debe tener menos de 30 caracteres',
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
