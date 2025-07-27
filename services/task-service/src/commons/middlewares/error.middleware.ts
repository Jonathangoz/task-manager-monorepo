// ==============================================
// src/presentation/middlewares/error.middleware.ts
// Middleware de manejo de errores centralizado con soporte completo
// para Prisma, validaciones Zod, rate limiting y logging estructurado
// ==============================================

import { Request, Response, NextFunction } from 'express';
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
  generateRateLimitMessage
} from '@/utils/constants';

// ==============================================
// INTERFACES Y TIPOS
// ==============================================

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

interface PrismaErrorMapping {
  code: string;
  httpStatus: number;
  errorCode: string;
  getMessage: (error: Prisma.PrismaClientKnownRequestError) => string;
}

// ==============================================
// MAPEO DE ERRORES PRISMA
// ==============================================

const PRISMA_ERROR_MAPPINGS: Record<string, PrismaErrorMapping> = {
  // Unique constraint violation
  P2002: {
    code: 'P2002',
    httpStatus: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    getMessage: (error) => {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('name')) {
        return target.includes('userId') 
          ? ERROR_MESSAGES.CATEGORY_ALREADY_EXISTS 
          : 'Recurso ya existe con este nombre';
      }
      if (target?.includes('title')) {
        return ERROR_MESSAGES.TASK_ALREADY_EXISTS;
      }
      return 'Este recurso ya existe en el sistema';
    }
  },

  // Record not found
  P2025: {
    code: 'P2025',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
    getMessage: (error) => {
      const cause = error.meta?.cause as string | undefined;
      if (cause?.includes('Category') || cause?.includes('category')) {
        return ERROR_MESSAGES.CATEGORY_NOT_FOUND;
      }
      if (cause?.includes('Task') || cause?.includes('task')) {
        return ERROR_MESSAGES.TASK_NOT_FOUND;
      }
      return 'Recurso no encontrado';
    }
  },

  // Foreign key constraint violation
  P2003: {
    code: 'P2003',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    getMessage: (error) => {
      const fieldName = error.meta?.field_name as string | undefined;
      if (fieldName === 'categoryId' || fieldName === 'category_id') {
        return ERROR_MESSAGES.CATEGORY_NOT_FOUND;
      }
      return 'Referencia inválida a recurso relacionado';
    }
  },

  // Record to delete does not exist
  P2016: {
    code: 'P2016',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
    getMessage: () => 'El recurso que intenta eliminar no existe'
  },

  // Related record not found
  P2018: {
    code: 'P2018',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    getMessage: () => 'Recurso relacionado requerido no encontrado'
  },

  // Value out of range
  P2020: {
    code: 'P2020',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    getMessage: () => 'Valor fuera del rango permitido'
  },

  // Table does not exist
  P2021: {
    code: 'P2021',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.DATABASE_ERROR,
    getMessage: () => ERROR_MESSAGES.DATABASE_ERROR
  },

  // Column does not exist
  P2022: {
    code: 'P2022',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.DATABASE_ERROR,
    getMessage: () => ERROR_MESSAGES.DATABASE_ERROR
  },

  // Inconsistent column data
  P2023: {
    code: 'P2023',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    getMessage: () => 'Datos inconsistentes en la columna'
  }
};

// ==============================================
// UTILIDADES DE CONTEXTO
// ==============================================

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
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ==============================================
// DETECTORES DE TIPO DE ERROR
// ==============================================

const isPrismaError = (error: any): error is Prisma.PrismaClientKnownRequestError => {
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

// ==============================================
// MANEJADORES ESPECÍFICOS DE ERROR
// ==============================================

const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError,
  context: ErrorContext
): ApiResponse => {
  // Log específico para errores de Prisma
  logger.error({
    type: 'prisma_error',
    error: {
      code: error.code || 'UNKNOWN',
      message: error.message,
      meta: error.meta,
      stack: config.app.isDevelopment ? error.stack : undefined
    },
    context
  }, `Prisma database error: ${error.code || 'UNKNOWN'}`);

  // Error conocido con mapeo específico
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code) {
    const mapping = PRISMA_ERROR_MAPPINGS[error.code];
    if (mapping) {
      return {
        success: false,
        message: mapping.getMessage(error),
        error: {
          code: mapping.errorCode,
          details: config.app.isDevelopment ? { prismaCode: error.code, meta: error.meta } : undefined
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId
        }
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
      meta: {
        timestamp: context.timestamp,
        requestId: context.requestId
      }
    };
  }

  // Error de inicialización de Prisma
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      success: false,
      message: ERROR_MESSAGES.DATABASE_ERROR,
      error: {
        code: ERROR_CODES.DATABASE_ERROR,
        details: config.app.isDevelopment ? { message: error.message } : undefined
      },
      meta: {
        timestamp: context.timestamp,
        requestId: context.requestId
      }
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
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

const handleZodError = (error: ZodError, context: ErrorContext): ApiResponse => {
  // Log de error de validación
  logger.warn({
    type: 'validation_error',
    error: {
      issues: error.issues,
      path: context.path
    },
    context
  }, 'Validation error occurred');

  // Formatear errores de validación Zod
  const validationErrors: ValidationError[] = error.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
    code: issue.code,
    received: issue.received
  }));

  return {
    success: false,
    message: ERROR_MESSAGES.VALIDATION_ERROR,
    error: {
      code: ERROR_CODES.VALIDATION_ERROR,
      details: {
        validationErrors,
        count: validationErrors.length
      }
    },
    meta: {
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };
};

const handleRateLimitError = (error: AppError, context: ErrorContext): ApiResponse => {
  // Log de rate limiting
  logger.warn({
    type: 'rate_limit_exceeded',
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    },
    context,
    event: EVENT_TYPES.RATE_LIMIT_EXCEEDED
  }, 'Rate limit exceeded');

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

// ==============================================
// MIDDLEWARE PRINCIPAL DE MANEJO DE ERRORES
// ==============================================

export const errorHandler = (
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context = extractErrorContext(req);
  let response: ApiResponse;
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Procesar según el tipo de error
  if (isPrismaError(error)) {
    response = handlePrismaError(error, context);
    statusCode = (PRISMA_ERROR_MAPPINGS[error.code]?.httpStatus) || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  } else if (isZodError(error)) {
    response = handleZodError(error, context);
    statusCode = HTTP_STATUS.BAD_REQUEST;
  } else if (isRateLimitError(error as AppError)) {
    response = handleRateLimitError(error as AppError, context);
    statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;
  } else if (isAuthError(error as AppError)) {
    response = handleAuthError(error as AppError, context);
    statusCode = HTTP_STATUS.UNAUTHORIZED;
  } else if ((error as AppError).isOperational) {
    response = handleOperationalError(error as AppError, context);
    statusCode = (error as AppError).statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  } else {
    response = handleUnknownError(error, context);
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }

  // Establecer headers de seguridad y contexto
  res.setHeader('X-Request-ID', context.requestId!);
  if (!config.app.isProduction) {
    res.setHeader('X-Error-Type', response.error?.code || 'UNKNOWN');
  }

  // Enviar respuesta
  res.status(statusCode).json(response);
};

// ==============================================
// MIDDLEWARE DE RUTA NO ENCONTRADA
// ==============================================

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

// ==============================================
// FUNCIONES AUXILIARES PARA CREAR ERRORES
// ==============================================

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
    user: ERROR_MESSAGES.USER_NOT_FOUND
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

// ==============================================
// TIPOS EXPORTADOS
// ==============================================

export type { AppError, ValidationError, ErrorContext };

// ==============================================
// CONSTANTES EXPORTADAS
// ==============================================

export { PRISMA_ERROR_MAPPINGS };