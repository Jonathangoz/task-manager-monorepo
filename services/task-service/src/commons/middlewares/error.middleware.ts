// src/commons/middlewares/error.middleware.ts
// Middleware de manejo de errores centralizado con soporte completo
// para Prisma, validaciones Zod, rate limiting y logging estructurado

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, ZodIssue } from 'zod';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  RATE_LIMIT_ERROR_CODES,
  RATE_LIMIT_ERROR_MESSAGES,
  EVENT_TYPES,
  ApiResponse,
  REQUEST_HEADERS,
  generateRateLimitMessage,
  PRISMA_ERROR_MAPPINGS
} from '@/utils/constants';

// INTERFACES Y TIPOS

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  details?: any;
  context?: Record<string, any>;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: any;
}

interface ErrorContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method: string;
  path: string;
  body?: any;
  query?: any;
  timestamp: string;
}

// Interfaz para el mapeo de errores de Prisma
interface PrismaErrorMapping {
  statusCode: number;
  message: string;
  errorCode: string;
  getMessage?: (error: Prisma.PrismaClientKnownRequestError) => string;
}

// UTILIDADES DE CONTEXTO
const extractErrorContext = (req: Request): ErrorContext => {
  return {
    requestId: req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string || generateRequestId(),
    userId: (req as any).userId,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.headers[REQUEST_HEADERS.USER_AGENT] as string,
    method: req.method,
    path: req.path,
    body: sanitizeRequestBody(req.body),
    query: req.query,
    timestamp: new Date().toISOString()
  };
};

const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random()}`;
};

// DETECTORES DE TIPO DE ERROR

const isPrismaError = (error: any): error is Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError | Prisma.PrismaClientValidationError | Prisma.PrismaClientRustPanicError | Prisma.PrismaClientInitializationError => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError
  );
};

const isZodError = (error: any): error is ZodError => {
  return error instanceof ZodError || error.name === 'ZodError';
};

const isRateLimitError = (error: AppError): boolean => {
  return error.code ? Object.values(RATE_LIMIT_ERROR_CODES).includes(error.code as any) : false;
};

const isAuthError = (error: AppError): boolean => {
  return [
    ERROR_CODES.INVALID_TOKEN,
    ERROR_CODES.TOKEN_EXPIRED,
    ERROR_CODES.TOKEN_REQUIRED,
    ERROR_CODES.UNAUTHORIZED_ACCESS,
    ERROR_CODES.USER_NOT_FOUND
  ].includes(error.code as any);
};

// MANEJADORES ESPECÍFICOS DE ERROR
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError | Prisma.PrismaClientValidationError | Prisma.PrismaClientRustPanicError | Prisma.PrismaClientInitializationError,
  context: ErrorContext
): ApiResponse => {
  // Log específico para errores de Prisma
  const errorDetails: any = {
    message: error.message,
    stack: config.app.isDevelopment ? error.stack : undefined
  };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    errorDetails.code = error.code;
    errorDetails.meta = error.meta;
  }

  logger.error({ 
    type: 'prisma_error', 
    error: errorDetails, 
    context 
  }, `Prisma database error: ${errorDetails.code || 'UNKNOWN'}`);

  // Error conocido con mapeo específico
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code) {
    // Corregir aquí: usar error.code como índice, no el objeto error completo
    const mapping = PRISMA_ERROR_MAPPINGS[error.code as keyof typeof PRISMA_ERROR_MAPPINGS] as PrismaErrorMapping;
    if (mapping) {
      return {
        success: false,
        message: mapping.getMessage ? mapping.getMessage(error) : mapping.message,
        error: { 
          code: mapping.errorCode, 
          details: config.app.isDevelopment ? { prismaCode: error.code, meta: error.meta } : undefined 
        },
        meta: { timestamp: context.timestamp, requestId: context.requestId }
      };
    }
  }

  // Error de validación de Prisma
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      success: false,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      error: { 
        code: ERROR_CODES.VALIDATION_ERROR, 
        details: config.app.isDevelopment ? { message: error.message } : undefined 
      },
      meta: { timestamp: context.timestamp, requestId: context.requestId }
    };
  }

  // Error de inicialización de Prisma
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      success: false,
      message: ERROR_MESSAGES.DATABASE_ERROR,
      error: { 
        code: ERROR_CODES.DATABASE_ERROR, 
        details: config.app.isDevelopment ? { message: error.message } : undefined 
      },
      meta: { timestamp: context.timestamp, requestId: context.requestId }
    };
  }

  // Error desconocido de Prisma
  return {
    success: false,
    message: ERROR_MESSAGES.DATABASE_ERROR,
    error: { 
      code: ERROR_CODES.DATABASE_ERROR, 
      details: config.app.isDevelopment ? { message: error.message } : undefined 
    },
    meta: { timestamp: context.timestamp, requestId: context.requestId }
  };
};

const handleZodError = (error: ZodError, context: ErrorContext): ApiResponse => {
  // Log de error de validación
  logger.warn({ type: 'validation_error', error: { issues: error.issues, path: context.path }, context }, 'Validation error occurred');

  // Formatear errores de validación Zod
  const validationErrors: ValidationError[] = error.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
    code: issue.code,
    // Conditionally include 'received' if it exists on the issue
    ...(Object.prototype.hasOwnProperty.call(issue, 'received') && { received: (issue as any).received }) 
  }));

  return {
    success: false,
    message: ERROR_MESSAGES.VALIDATION_ERROR,
    error: { 
      code: ERROR_CODES.VALIDATION_ERROR, 
      details: { validationErrors, count: validationErrors.length } 
    },
    meta: { timestamp: context.timestamp, requestId: context.requestId }
  };
};

const handleRateLimitError = (error: AppError, context: ErrorContext, res: Response): ApiResponse => {
  // Log de error de Rate Limit
  logger.warn({ type: EVENT_TYPES.RATE_LIMIT_EXCEEDED, 
    error: { code: error.code, message: error.message }, 
    context }, 
    'Rate limit exceeded'
  );

  // Mensaje contextual si hay información de reset time
  let message = error.message;
  if (error.details?.resetTimeMs && error.code) {
    const rateLimitType = error.code.replace('_RATE_LIMIT_EXCEEDED', '').toLowerCase();
    if (rateLimitType in RATE_LIMIT_ERROR_MESSAGES) {
      message = generateRateLimitMessage(rateLimitType as any, error.details.resetTimeMs);
    }
  }

  return {
    success: false,
    message,
    error: {
      code: error.code || ERROR_CODES.RATE_LIMIT_EXCEEDED,
      details: error.details
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

const handleAuthError = (error: AppError, context: ErrorContext): ApiResponse => {
  // Log de error de autenticación
  logger.warn({
    type: 'auth_error',
    error: {
      code: error.code,
      message: error.message
    },
    context,
    event: EVENT_TYPES.AUTH_SERVICE_ERROR
  }, 'Authentication error occurred');

  return {
    success: false,
    message: error.message,
    error: {
      code: error.code || ERROR_CODES.UNAUTHORIZED_ACCESS,
      details: error.details
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

const handleOperationalError = (error: AppError, context: ErrorContext): ApiResponse => {
  // Log de error operacional
  logger.error({
    type: 'operational_error',
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: config.app.isDevelopment ? error.stack : undefined
    },
    context
  }, 'Operational error occurred');

  return {
    success: false,
    message: error.message,
    error: {
      code: error.code || ERROR_CODES.INTERNAL_ERROR,
      details: error.details
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

const handleUnknownError = (error: Error, context: ErrorContext): ApiResponse => {
  // Log de error desconocido
  logger.error({
    type: 'unknown_error',
    error: {
      name: error.name,
      message: error.message,
      stack: config.app.isDevelopment ? error.stack : undefined
    },
    context
  }, 'Unknown error occurred');

  return {
    success: false,
    message: config.app.isProduction 
      ? ERROR_MESSAGES.INTERNAL_ERROR 
      : error.message || ERROR_MESSAGES.INTERNAL_ERROR,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      details: config.app.isDevelopment ? {
        name: error.name,
        originalMessage: error.message
      } : undefined
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

// Función auxiliar para determinar el status code basado en el error code
const getStatusCodeFromErrorCode = (errorCode: string): number => {
  switch (errorCode) {
    case ERROR_CODES.TASK_NOT_FOUND:
    case ERROR_CODES.CATEGORY_NOT_FOUND:
    case ERROR_CODES.USER_NOT_FOUND:
      return HTTP_STATUS.NOT_FOUND;
    
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.INVALID_DATE_FORMAT:
    case ERROR_CODES.INVALID_DUE_DATE:
    case ERROR_CODES.INVALID_PAGINATION:
    case ERROR_CODES.INVALID_SORT_FIELD:
    case ERROR_CODES.INVALID_FILTER:
    case ERROR_CODES.INVALID_HEX_COLOR:
    case ERROR_CODES.INVALID_ICON:
    case ERROR_CODES.INVALID_CUID:
    case ERROR_CODES.INVALID_SEARCH_QUERY:
    case ERROR_CODES.RESERVED_NAME_ERROR:
      return HTTP_STATUS.BAD_REQUEST;
    
    case ERROR_CODES.TASK_ALREADY_EXISTS:
    case ERROR_CODES.CATEGORY_ALREADY_EXISTS:
    case ERROR_CODES.CATEGORY_HAS_TASKS:
      return HTTP_STATUS.CONFLICT;
    
    case ERROR_CODES.INVALID_TOKEN:
    case ERROR_CODES.TOKEN_EXPIRED:
    case ERROR_CODES.TOKEN_REQUIRED:
    case ERROR_CODES.UNAUTHORIZED_ACCESS:
      return HTTP_STATUS.UNAUTHORIZED;
    
    case ERROR_CODES.TASK_ACCESS_DENIED:
    case ERROR_CODES.CATEGORY_ACCESS_DENIED:
      return HTTP_STATUS.FORBIDDEN;
    
    case ERROR_CODES.CATEGORY_LIMIT_EXCEEDED:
      return HTTP_STATUS.UNPROCESSABLE_ENTITY;
    
    case ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return HTTP_STATUS.TOO_MANY_REQUESTS;
    
    case ERROR_CODES.SERVICE_UNAVAILABLE:
      return HTTP_STATUS.SERVICE_UNAVAILABLE;
    
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
};

/**
 * Wrapper para funciones async en rutas de Express
 * Captura errores automáticamente y los pasa al error handler
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// También agregar esta interfaz si no existe
export interface AsyncRequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void | Response>;
}

/**
 * Versión tipada del asyncHandler para mejor intellisense
 */
export const typedAsyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// MIDDLEWARE PRINCIPAL DE MANEJO DE ERRORES
export const errorHandler = (
  err: Error | AppError | Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context = extractErrorContext(req);
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let responseBody: ApiResponse;

  if (isPrismaError(err)) {
    responseBody = handlePrismaError(err, context);
    // Corregir aquí: usar la función auxiliar para determinar el status code
    statusCode = responseBody.error?.code ? getStatusCodeFromErrorCode(responseBody.error.code) : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  } else if (isZodError(err)) {
    responseBody = handleZodError(err, context);
    statusCode = HTTP_STATUS.BAD_REQUEST;
  } else if (err instanceof Error && (err as AppError).isOperational) {
    // Errores operacionales (AppError)
    const appError = err as AppError;
    
    if (isRateLimitError(appError)) {
      responseBody = handleRateLimitError(appError, context, res);
      statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;
    } else if (isAuthError(appError)) {
      responseBody = handleAuthError(appError, context);
      statusCode = appError.statusCode || HTTP_STATUS.UNAUTHORIZED;
    } else {
      responseBody = handleOperationalError(appError, context);
      statusCode = appError.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    }
  } else {
    // Errores de programación o desconocidos
    logger.fatal({ 
      type: 'unhandled_exception', 
      error: { message: err.message, stack: err.stack }, 
      context 
    }, 'Unhandled exception caught by error middleware');

    responseBody = handleUnknownError(err, context);
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
  
  res.status(statusCode).json(responseBody);
};

// MIDDLEWARE DE RUTA NO ENCONTRADA

export const notFoundHandler = (req: Request, res: Response): void => {
  const context = extractErrorContext(req);
  
  logger.warn({
    type: 'route_not_found',
    context
  }, `Route not found: ${req.method} ${req.path}`);
  
  const response: ApiResponse = {
    success: false,
    message: `Ruta ${req.method} ${req.path} no encontrada`,
    error: {
      code: 'ROUTE_NOT_FOUND',
      details: {
        method: req.method,
        path: req.path,
        availableRoutes: config.app.isDevelopment ? [
          'GET /api/v1/health',
          'GET /api/v1/tasks',
          'POST /api/v1/tasks',
          'GET /api/v1/categories'
        ] : undefined
      }
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };

  res.setHeader('X-Request-ID', context.requestId!);
  res.status(HTTP_STATUS.NOT_FOUND).json(response);
};

// FUNCIONES AUXILIARES PARA CREAR ERRORES

export const createAppError = (
  message: string,
  statusCode: number,
  code: string,
  details?: any,
  context?: Record<string, any>
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  error.details = details;
  error.context = context;
  return error;
};

export const createValidationError = (
  message: string,
  field?: string,
  received?: any
): AppError => {
  return createAppError(
    message,
    HTTP_STATUS.BAD_REQUEST,
    ERROR_CODES.VALIDATION_ERROR,
    { field, received }
  );
};

export const createNotFoundError = (
  resource: 'task' | 'category' | 'user',
  id?: string
): AppError => {
  const messages = {
    task: ERROR_MESSAGES.TASK_NOT_FOUND,
    category: ERROR_MESSAGES.CATEGORY_NOT_FOUND,
    user: ERROR_MESSAGES.TASK_NOT_FOUND
  };

  const codes = {
    task: ERROR_CODES.TASK_NOT_FOUND,
    category: ERROR_CODES.CATEGORY_NOT_FOUND,
    user: ERROR_CODES.USER_NOT_FOUND
  };

  return createAppError(
    messages[resource],
    HTTP_STATUS.NOT_FOUND,
    codes[resource],
    id ? { resourceId: id } : undefined
  );
};

export const createUnauthorizedError = (
  message: string = ERROR_MESSAGES.UNAUTHORIZED_ACCESS
): AppError => {
  return createAppError(
    message,
    HTTP_STATUS.UNAUTHORIZED,
    ERROR_CODES.UNAUTHORIZED_ACCESS
  );
};

export const createRateLimitError = (
  type: string,
  resetTimeMs?: number,
  current?: number,
  limit?: number
): AppError => {
  const code = RATE_LIMIT_ERROR_CODES[type as keyof typeof RATE_LIMIT_ERROR_CODES] || 
              ERROR_CODES.RATE_LIMIT_EXCEEDED;
  
  const message = RATE_LIMIT_ERROR_MESSAGES[type as keyof typeof RATE_LIMIT_ERROR_MESSAGES] || 
                  ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;

  return createAppError(
    message,
    HTTP_STATUS.TOO_MANY_REQUESTS,
    code,
    { resetTimeMs, current, limit, type }
  );
};

// TIPOS EXPORTADOS

export type { AppError, ValidationError, ErrorContext };

// CONSTANTES EXPORTADAS

export { PRISMA_ERROR_MAPPINGS };