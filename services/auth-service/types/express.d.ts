// services/auth-service/types/express.d.ts
// Extensiones de tipos para Express.js

import { Request, Response, NextFunction } from 'express';

// Definir TokenPayload localmente
interface TokenPayload {
  id: string;
  email: string;
  username: string;
  sessionId: string;
  iat: number;
  exp: number;
}

// Extender la interfaz global de Express
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
      sessionInfo?: {
        ipAddress?: string;
        userAgent?: string;
        device?: string;
        location?: string;
      };
      correlationId?: string;
      requestId?: string;
      startTime?: number;
      clientIp?: string;
      deviceInfo?: {
        userAgent: string;
        platform?: string;
        browser?: string;
      };
      auth?: TokenPayload;
      validatedData?: {
        body?: any;
        query?: any;
        params?: any;
        headers?: any;
      };
    }
  }
}

// Tipos para request bodies de autenticación
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    sessionId: string;
    iat: number;
    exp: number;
  };
}

// Tipos para request bodies específicos
export interface RegisterRequestBody {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface RefreshTokenRequestBody {
  refreshToken?: string;
}

export interface VerifyTokenRequestBody {
  token: string;
  service?: string;
}

export interface ChangePasswordRequestBody {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequestBody {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface ForgotPasswordRequestBody {
  email: string;
}

export interface ResetPasswordRequestBody {
  token: string;
  password: string;
  email: string;
}

export interface UpdateUserRequestBody {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface DeactivateUserRequestBody {
  reason?: string;
}

export interface UpdateAvatarRequestBody {
  avatar: string;
}

// Tipos para query parameters
export interface GetUsersQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: string;
  isVerified?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Tipos para parámetros de ruta
export interface UserParams {
  id: string;
}

export interface SessionParams {
  sessionId: string;
}

export interface VerifyEmailParams {
  id: string;
  token: string;
}

// Middleware types
export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;
export type ValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;
export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

// Tipos para controladores
export type ControllerMethod = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

// Tipos para el contexto de sesión
export interface SessionContext {
  userId: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  issuedAt: number;
  expiresAt: number;
}

// Tipos para logging context
export interface LogContext {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  event?: string;
  error?: string | Error;
  [key: string]: any;
}

// Extensión específica para la aplicación
export interface AppRequest extends Request {
  correlationId?: string;
  requestId?: string;
  startTime?: number;
  clientIp?: string;
  deviceInfo?: {
    userAgent: string;
    platform?: string;
    browser?: string;
  };
}

// Export explícito del TokenPayload para uso en otros archivos
export { TokenPayload };

// Export para asegurar que el módulo sea tratado como un módulo
export {};
