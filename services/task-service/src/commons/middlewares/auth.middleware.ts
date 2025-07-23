// src/presentation/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  AUTH_ENDPOINTS 
} from '@/utils/constants';

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

// Extender Request para incluir usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userId?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_REQUIRED,
        error: { code: ERROR_CODES.TOKEN_REQUIRED }
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await verifyTokenWithAuthService(token);
    
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error: any) {
    logger.error({ error, path: req.path }, 'Authentication failed');
    
    const statusCode = error.statusCode || HTTP_STATUS.UNAUTHORIZED;
    const errorCode = error.code || ERROR_CODES.INVALID_TOKEN;
    const message = error.message || ERROR_MESSAGES.INVALID_TOKEN;
    
    res.status(statusCode).json({
      success: false,
      message,
      error: { code: errorCode }
    });
  }
};

const verifyTokenWithAuthService = async (token: string): Promise<AuthenticatedUser> => {
  try {
    const response = await axios.post(
      `${config.auth.serviceUrl}${AUTH_ENDPOINTS.VERIFY_TOKEN}`,
      { token },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.auth.apiKey
        },
        timeout: config.auth.timeout
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid token response from auth service');
    }

    return response.data.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw {
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          code: ERROR_CODES.AUTH_SERVICE_ERROR,
          message: ERROR_MESSAGES.AUTH_SERVICE_ERROR
        };
      }
      
      if (error.response?.status === 401) {
        throw {
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: ERROR_CODES.INVALID_TOKEN,
          message: ERROR_MESSAGES.INVALID_TOKEN
        };
      }
    }
    
    throw error;
  }
};