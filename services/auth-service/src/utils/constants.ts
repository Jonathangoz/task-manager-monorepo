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
  USER_SESSION: (sessionId: string) => `session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `user:${userId}:sessions`,
  REFRESH_TOKEN: (tokenId: string) => `refresh:${tokenId}`,
  LOGIN_ATTEMPTS: (email: string) => `login:attempts:${email}`,
  RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  PASSWORD_RESET: (token: string) => `reset:${token}`,
  EMAIL_VERIFICATION: (token: string) => `verify:${token}`,
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
  CUID: /^c[^\s-]{8,}$/,
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
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
};