// src/presentation/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES 
} from '@/utils/constants';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log del error
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    request: {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
      userId: req.userId
    }
  }, 'Request error');

  // Manejar errores específicos
  if (isPrismaError(error)) {
    handlePrismaError(error as Prisma.PrismaClientKnownRequestError, res);
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      error: { code: ERROR_CODES.VALIDATION_ERROR }
    });
    return;
  }

  // Error operacional conocido
  if (error.isOperational && error.statusCode && error.code) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: { code: error.code }
    });
    return;
  }

  // Error interno del servidor
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: ERROR_MESSAGES.INTERNAL_ERROR,
    error: { code: ERROR_CODES.INTERNAL_ERROR }
  });
};

const isPrismaError = (error: any): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError ||
         error instanceof Prisma.PrismaClientUnknownRequestError ||
         error instanceof Prisma.PrismaClientValidationError;
};

const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
  res: Response
): void => {
  switch (error.code) {
    case 'P2002': // Unique constraint violation
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Resource already exists',
        error: { code: ERROR_CODES.VALIDATION_ERROR }
      });
      break;
      
    case 'P2025': // Record not found
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Resource not found',
        error: { code: ERROR_CODES.TASK_NOT_FOUND }
      });
      break;
      
    case 'P2003': // Foreign key constraint violation
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid reference',
        error: { code: ERROR_CODES.VALIDATION_ERROR }
      });
      break;
      
    default:
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.DATABASE_ERROR,
        error: { code: ERROR_CODES.DATABASE_ERROR }
      });
  }
};

export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    error: { code: 'ROUTE_NOT_FOUND' }
  });
};

// Crear errores operacionales
export const createAppError = (
  message: string,
  statusCode: number,
  code: string
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
};