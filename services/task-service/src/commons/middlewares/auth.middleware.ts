// src/commons/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { authServiceClient, UserData } from '@/core/infrastructure/external/AuthServiceClient';
import { redisCache } from '@/core/infrastructure/cache/RedisCache';
import { logger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  TOKEN_CONFIG,
  CACHE_KEYS,
  CACHE_TTL 
} from '@/utils/constants';

// Extend Express Request type
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
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    sessionId?: string;
  };
}

/**
 * Middleware principal de autenticación
 * Valida el token JWT contra el Auth Service
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_REQUIRED,
        error: {
          code: ERROR_CODES.TOKEN_REQUIRED,
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
      return;
    }

    // Verificar cache primero para optimizar rendimiento
    const cachedUser = await getCachedUserData(token);
    if (cachedUser) {
      req.user = cachedUser;
      logger.debug({
        userId: cachedUser.id,
        path: req.path,
        method: req.method,
      }, 'Token validated from cache');
      next();
      return;
    }

    // Validar token con Auth Service
    const validationResult = await authServiceClient.verifyToken(token);
    
    if (!validationResult.valid || !validationResult.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: validationResult.error || ERROR_MESSAGES.INVALID_TOKEN,
        error: {
          code: ERROR_CODES.INVALID_TOKEN,
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
      return;
    }

    const user = validationResult.user;

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'User account is inactive',
        error: {
          code: ERROR_CODES.USER_INACTIVE,
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
      return;
    }

    // Preparar datos del usuario para el request
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    // Cachear datos del usuario para requests futuros
    await cacheUserData(token, userData);

    // Agregar usuario al request
    req.user = userData;

    logger.debug({
      userId: user.id,
      email: user.email,
      path: req.path,
      method: req.method,
    }, 'Token validated successfully');

    next();
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
    }, 'Authentication middleware error');

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    });
  }
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero lo valida si existe
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      next();
      return;
    }

    // Intentar validar el token
    const validationResult = await authServiceClient.verifyToken(token);
    
    if (validationResult.valid && validationResult.user) {
      const user = validationResult.user;
      
      if (user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
    }

    next();
  } catch (error) {
    // En modo opcional, no fallar por errores de autenticación
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    }, 'Optional authentication failed, continuing without user');
    
    next();
  }
};

/**
 * Middleware para verificar permisos específicos
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_REQUIRED,
        error: {
          code: ERROR_CODES.TOKEN_REQUIRED,
        },
      });
      return;
    }

    // Aquí podrías implementar lógica de permisos más compleja
    // Por ahora, solo verificamos que el usuario esté autenticado
    next();
  };
};

/**
 * Extrae el token del header Authorization
 */
function extractTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers[TOKEN_CONFIG.ACCESS_TOKEN_HEADER.toLowerCase()];
  
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (!authHeader.startsWith(TOKEN_CONFIG.TOKEN_PREFIX)) {
    return null;
  }

  return authHeader.slice(TOKEN_CONFIG.TOKEN_PREFIX.length);
}

/**
 * Obtiene datos del usuario desde cache
 */
async function getCachedUserData(token: string): Promise<any | null> {
  try {
    const cacheKey = CACHE_KEYS.USER_SESSION(token);
    const cachedData = await redisCache.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return null;
  } catch (error) {
    logger.warn({ error }, 'Failed to get cached user data');
    return null;
  }
}

/**
 * Cachea datos del usuario
 */
async function cacheUserData(token: string, userData: any): Promise<void> {
  try {
    const cacheKey = CACHE_KEYS.USER_SESSION(token);
    await redisCache.setex(
      cacheKey,
      CACHE_TTL.USER_SESSION,
      JSON.stringify(userData)
    );
  } catch (error) {
    logger.warn({ error }, 'Failed to cache user data');
    // No lanzar error, solo log warning
  }
}

/**
 * Middleware para limpiar cache de usuario
 */
export const clearUserCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      const cacheKey = CACHE_KEYS.USER_SESSION(token);
      await redisCache.del(cacheKey);
    }
    
    next();
  } catch (error) {
    logger.warn({ error }, 'Failed to clear user cache');
    next();
  }
};

/**
 * Middleware para verificar ownership de recursos
 */
export const verifyResourceOwnership = (getUserIdFromResource: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_REQUIRED,
        error: {
          code: ERROR_CODES.TOKEN_REQUIRED,
        },
      });
      return;
    }

    const resourceUserId = getUserIdFromResource(req);
    
    if (resourceUserId !== req.user.id) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS,
        },
      });
      return;
    }

    next();
  };
};