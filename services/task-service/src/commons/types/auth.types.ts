// src/commons/types/auth.types.ts
import { Request } from 'express';

// ==============================================
// TIPOS BASE DE USUARIO
// ==============================================

/**
 * Payload del token de acceso
 */
export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
  sessionId?: string;
  type: 'access';
}

/**
 * Payload del token de refresh
 */
export interface RefreshTokenPayload {
  sub: string; // userId
  email: string;
  sessionId: string;
  iat: number;
  exp: number;
  type: 'refresh';
}

// ==============================================
// TIPOS DE CONFIGURACIÓN DE AUTENTICACIÓN
// ==============================================

/**
 * Configuración de tokens
 */
export interface TokenConfig {
  accessToken: {
    secret: string;
    expiresIn: string;
  };
  refreshToken: {
    secret: string;
    expiresIn: string;
  };
}

/**
 * Configuración de rate limiting para auth
 */
export interface AuthRateLimitConfig {
  login: {
    windowMs: number;
    max: number;
  };
  register: {
    windowMs: number;
    max: number;
  };
  passwordReset: {
    windowMs: number;
    max: number;
  };
}

// ==============================================
// TIPOS DE EVENTOS DE SEGURIDAD
// ==============================================

/**
 * Tipos de eventos de autenticación para logging
 */
export type AuthEventType =
  | 'user.registered'
  | 'user.login'
  | 'user.login.failed'
  | 'user.logout'
  | 'password.changed'
  | 'account.locked'
  | 'account.unlocked'
  | 'token.generated'
  | 'token.validated'
  | 'token.validation.failed'
  | 'token.revoked'
  | 'refresh_token.rotated'
  | 'security.suspicious'
  | 'security.rate_limit'
  | 'security.brute_force'
  | 'security.unauthorized';

/**
 * Contexto de evento de autenticación
 */
export interface AuthEventContext {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  tokenType?: 'access' | 'refresh' | 'reset';
  reason?: string;
  attempts?: number;
  method?: string;
  endpoint?: string;
}

// ==============================================
// TIPOS DE ERROR DE AUTENTICACIÓN
// ==============================================

/**
 * Códigos de error de autenticación
 */
export enum AuthErrorCode {
  TOKEN_REQUIRED = 'TOKEN_REQUIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_INACTIVE = 'USER_INACTIVE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SESSION_INVALID = 'SESSION_INVALID',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
}

/**
 * Error de autenticación personalizado
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly statusCode: number = 401,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ==============================================
// TIPOS DE MIDDLEWARE
// ==============================================

/**
 * Opciones para middleware de autenticación
 */
export interface AuthMiddlewareOptions {
  required?: boolean;
  permissions?: string[];
  roles?: string[];
  skipCache?: boolean;
}

/**
 * Resultado de middleware de autenticación
 */
export interface AuthMiddlewareResult {
  success: boolean;
  user?: AuthUser;
  error?: AuthError;
}

// ==============================================
// TIPOS PARA EXTENDER EXPRESS
// ==============================================

/**
 * Extensión global de Express Request
 * Debe ser declarada en un archivo de tipos global
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        firstName?: string;
        lastName?: string;
        sessionId?: string;
      };
      requestId?: string;
      startTime?: number;
    }
  }
}

// ==============================================
// HELPERS Y UTILIDADES DE TIPOS
// ==============================================

/**
 * Type guard para verificar si un request está autenticado
 */
export const isAuthenticatedRequest = (
  req: Request,
): req is AuthenticatedRequest => {
  return (
    req.user !== undefined &&
    typeof req.user.id === 'string' &&
    typeof req.user.email === 'string' &&
    typeof req.user.username === 'string'
  );
};

/**
 * Type guard para verificar si un token payload es válido
 */
export const isValidTokenPayload = (
  payload: any,
): payload is AccessTokenPayload => {
  return (
    payload &&
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.username === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
};

/**
 * Utilitario para extraer datos de usuario del token payload
 */
export const extractUserFromTokenPayload = (
  payload: AccessTokenPayload,
): AuthUser => ({
  id: payload.sub,
  email: payload.email,
  username: payload.username,
  firstName: payload.firstName,
  lastName: payload.lastName,
  sessionId: payload.sessionId,
});

/**
 * Utilitario para crear un AuthUser mínimo
 */
export const createMinimalAuthUser = (
  id: string,
  email: string,
  username: string,
): MinimalAuthUser => ({
  id,
  email,
  username,
});

/**
 * Utilitario para sanitizar datos de usuario para respuestas
 */
export const sanitizeUserForResponse = (
  user: AuthUser,
): Omit<AuthUser, 'sessionId'> => {
  const { sessionId, ...sanitized } = user;
  return sanitized;
};

// ==============================================
// TIPOS DE CONFIGURACIÓN ESPECÍFICOS POR SERVICIO
// ==============================================

/**
 * Configuración específica para CategoryService
 */
export interface CategoryServiceAuthConfig {
  requireOwnership: boolean;
  allowedRoles?: string[];
  maxCategoriesPerUser?: number;
  rateLimits: {
    create: number;
    update: number;
    delete: number;
    bulkDelete: number;
  };
}

/**
 * Configuración específica para TaskService
 */
export interface TaskServiceAuthConfig {
  requireOwnership: boolean;
  allowedRoles?: string[];
  maxTasksPerUser?: number;
  maxTasksPerCategory?: number;
  rateLimits: {
    create: number;
    update: number;
    delete: number;
    bulkOperations: number;
  };
}

// ==============================================
// EXPORTS
// ==============================================

// Re-export tipos comunes para facilitar imports
export type {
  AuthUser as User,
  AuthenticatedRequest as AuthRequest,
  TokenValidationResult as TokenValidation,
  LoginResponse as AuthResponse,
};

// Export de constantes útiles
export const AUTH_CONSTANTS = {
  TOKEN_HEADER: 'Authorization',
  TOKEN_PREFIX: 'Bearer ',
  SESSION_HEADER: 'X-Session-ID',
  REQUEST_ID_HEADER: 'X-Request-ID',
  DEFAULT_TOKEN_EXPIRY: '15m',
  DEFAULT_REFRESH_EXPIRY: '7d',
} as const;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  sessionId?: string;
  isActive?: boolean;
  roles?: string[];
  permissions?: string[];
}

/**
 * Datos mínimos requeridos para autenticación
 * Usado en contextos donde no se necesita información completa
 */
export interface MinimalAuthUser {
  id: string;
  email: string;
  username: string;
}

/**
 * Datos completos del usuario con metadatos adicionales
 * Usado en respuestas de API y contextos que requieren información extendida
 */
export interface ExtendedAuthUser extends AuthUser {
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  profileImage?: string;
  preferences?: Record<string, unknown>;
}

// ==============================================
// INTERFACES DE REQUEST EXTENDIDAS
// ==============================================

/**
 * Interface unificada para requests autenticados
 * CORRIGE el problema de compatibilidad entre middlewares
 *
 * IMPORTANTE: Esta interface debe ser consistente en:
 * - auth.middleware.ts
 * - category.routes.ts
 * - category.controller.ts
 * - Cualquier otro archivo que use requests autenticados
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string; // CORREGIDO: Requerido, no opcional
    lastName: string; // CORREGIDO: Requerido, no opcional
    sessionId?: string;
  };
}

/**
 * Request con usuario opcional (para middleware optionalAuth)
 */
export interface OptionalAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    sessionId?: string;
  };
}

/**
 * Request con información extendida del usuario
 */
export interface ExtendedAuthRequest extends Request {
  user: ExtendedAuthUser;
}

// ==============================================
// TIPOS DE RESPUESTA DE AUTENTICACIÓN
// ==============================================

/**
 * Respuesta de validación de token
 */
export interface TokenValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
  expired?: boolean;
}

/**
 * Respuesta de login exitoso
 */
export interface LoginResponse {
  user: Omit<AuthUser, 'sessionId'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  sessionId: string;
}

/**
 * Respuesta de refresh token
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
