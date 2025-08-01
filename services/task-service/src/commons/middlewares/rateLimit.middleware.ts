// src/commons/middlewares/rateLimit.middleware.ts
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  EVENT_TYPES,
  CACHE_KEYS,
  ApiResponse,
} from '@/utils/constants';

// TIPOS Y INTERFACES
interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableRedisStore?: boolean;
}

interface RateLimitResult {
  totalHits: number;
  timeToExpire?: number;
  resetTime?: Date;
}

interface ExtendedRequest extends Request {
  userId?: string;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

// REDIS RATE LIMIT STORE PERSONALIZADO
class TaskServiceRedisRateLimitStore {
  private windowMs: number;
  private keyPrefix = 'rate_limit:'; // Consistente con CACHE_KEYS

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  /**
   * Incrementa el contador para una clave específica
   */
  async increment(key: string): Promise<RateLimitResult> {
    try {
      const redis = taskRedisConnection.getClient();

      // Verificar conexión Redis
      if (!taskRedisConnection.isHealthy()) {
        logger.warn(
          {
            event: EVENT_TYPES.CACHE_ERROR,
            component: 'rate_limit_store',
            key,
          },
          'Redis not healthy, allowing request',
        );

        // Fallback: permitir request si Redis no está disponible
        return { totalHits: 1, timeToExpire: this.windowMs };
      }

      const redisKey = `${this.keyPrefix}${key}`;
      const windowSeconds = Math.ceil(this.windowMs / 1000);

      // Usar pipeline para operaciones atómicas
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, windowSeconds);
      pipeline.ttl(redisKey);

      const results = await pipeline.exec();

      if (!results || results.some(([err]) => err)) {
        throw new Error('Pipeline execution failed');
      }

      const totalHits = results[0][1] as number;
      const ttl = results[2][1] as number;
      const resetTime = new Date(Date.now() + ttl * 1000);

      logger.debug(
        {
          event: EVENT_TYPES.CACHE_HIT,
          component: 'rate_limit_store',
          key,
          totalHits,
          ttl,
        },
        'Rate limit incremented',
      );

      return {
        totalHits,
        timeToExpire: ttl * 1000,
        resetTime,
      };
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'rate_limit_store',
          key,
        },
        'Failed to increment rate limit counter',
      );

      // Fallback: permitir request en caso de error
      return { totalHits: 1, timeToExpire: this.windowMs };
    }
  }

  /**
   * Decrementa el contador (usado cuando skipFailedRequests es true)
   */
  async decrement(key: string): Promise<void> {
    try {
      const redis = taskRedisConnection.getClient();

      if (!taskRedisConnection.isHealthy()) {
        return;
      }

      const redisKey = `${this.keyPrefix}${key}`;
      const currentValue = await redis.get(redisKey);

      if (currentValue && parseInt(currentValue) > 0) {
        await redis.decr(redisKey);

        logger.debug(
          {
            event: EVENT_TYPES.CACHE_HIT,
            component: 'rate_limit_store',
            key,
          },
          'Rate limit decremented',
        );
      }
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'rate_limit_store',
          key,
        },
        'Failed to decrement rate limit counter',
      );
    }
  }

  /**
   * Resetea el contador para una clave específica
   */
  async resetKey(key: string): Promise<void> {
    try {
      const redis = taskRedisConnection.getClient();

      if (!taskRedisConnection.isHealthy()) {
        return;
      }

      const redisKey = `${this.keyPrefix}${key}`;
      await redis.del(redisKey);

      logger.debug(
        {
          event: EVENT_TYPES.CACHE_MISS,
          component: 'rate_limit_store',
          key,
        },
        'Rate limit key reset',
      );
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'rate_limit_store',
          key,
        },
        'Failed to reset rate limit key',
      );
    }
  }

  /**
   * Obtiene el estado actual del rate limit para una clave
   */
  async getStatus(key: string): Promise<{ count: number; ttl: number } | null> {
    try {
      const redis = taskRedisConnection.getClient();

      if (!taskRedisConnection.isHealthy()) {
        return null;
      }

      const redisKey = `${this.keyPrefix}${key}`;
      const pipeline = redis.pipeline();
      pipeline.get(redisKey);
      pipeline.ttl(redisKey);

      const results = await pipeline.exec();

      if (!results || results.some(([err]) => err)) {
        return null;
      }

      const count = parseInt((results[0][1] as string) || '0');
      const ttl = results[1][1] as number;

      return { count, ttl };
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'rate_limit_store',
          key,
        },
        'Failed to get rate limit status',
      );
      return null;
    }
  }
}

// FACTORY FUNCTION PARA CREAR RATE LIMITERS
export const createRateLimiter = (
  options: RateLimitOptions = {},
): RateLimitRequestHandler => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    keyGenerator = (req: Request) => {
      // Priorizar userId si está disponible, sino usar IP
      const extReq = req as ExtendedRequest;
      return extReq.userId || req.ip || 'unknown';
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    enableRedisStore = true,
  } = options;

  const store = enableRedisStore
    ? new TaskServiceRedisRateLimitStore(windowMs)
    : undefined;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        details: {
          windowMs,
          maxRequests: max,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse,

    // Headers estándar de rate limiting
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,

    // Handler personalizado con logging detallado
    handler: (req: Request, res: Response) => {
      const extReq = req as ExtendedRequest;
      const identifier = keyGenerator(req);

      logger.warn(
        {
          event: EVENT_TYPES.RATE_LIMIT_EXCEEDED,
          component: 'rate_limit_middleware',
          identifier,
          userId: extReq.userId,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          rateLimitInfo: extReq.rateLimitInfo,
        },
        'Rate limit exceeded',
      );

      // Respuesta consistente con el formato de la API
      const response: ApiResponse = {
        success: false,
        message,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          details: {
            windowMs,
            maxRequests: max,
            retryAfter: Math.ceil(windowMs / 1000),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(response);
    },
  });
};

// MIDDLEWARE DE ENRIQUECIMIENTO DE RATE LIMIT INFO
export const enrichRateLimitInfo = (
  rateLimitStore: TaskServiceRedisRateLimitStore,
  maxRequests: number,
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const extReq = req as ExtendedRequest;
      const identifier = extReq.userId || req.ip || 'unknown';

      const status = await rateLimitStore.getStatus(identifier);

      if (status) {
        const remaining = Math.max(0, maxRequests - status.count);
        const resetTime = new Date(Date.now() + status.ttl * 1000);

        extReq.rateLimitInfo = {
          limit: maxRequests,
          remaining,
          resetTime,
        };

        // Agregar headers informativos
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
        });
      }

      next();
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'rate_limit_enricher',
        },
        'Failed to enrich rate limit info',
      );

      // Continuar sin enriquecimiento en caso de error
      next();
    }
  };
};

// RATE LIMITERS ESPECÍFICOS PARA DIFERENTES ENDPOINTS
/**
 * Rate limiter general para endpoints públicos
 */
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por identificador
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

/**
 * Rate limiter estricto para endpoints de autenticación
 */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requests por IP para endpoints críticos
  keyGenerator: (req: Request) => req.ip || 'unknown',
  skipSuccessfulRequests: true, // No contar requests exitosos
});

/**
 * Rate limiter para creación de tareas (por usuario)
 */
export const createTaskRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 tareas nuevas por minuto por usuario
  keyGenerator: (req: Request) => {
    const extReq = req as ExtendedRequest;
    return `create_task:${extReq.userId || req.ip}`;
  },
});

/**
 * Rate limiter para usuarios autenticados
 */
export const authenticatedUserRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requests por usuario autenticado
  keyGenerator: (req: Request) => {
    const extReq = req as ExtendedRequest;
    return `auth_user:${extReq.userId || req.ip}`;
  },
});

/**
 * Rate limiter para endpoints de búsqueda
 */
export const searchRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 búsquedas por minuto
  keyGenerator: (req: Request) => {
    const extReq = req as ExtendedRequest;
    return `search:${extReq.userId || req.ip}`;
  },
});

/**
 * Rate limiter para operaciones en lote
 */
export const bulkOperationsRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // 5 operaciones en lote cada 5 minutos
  keyGenerator: (req: Request) => {
    const extReq = req as ExtendedRequest;
    return `bulk:${extReq.userId || req.ip}`;
  },
});

/**
 * Rate limiter para endpoints administrativos
 */
export const adminRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 50, // 50 requests por minuto para admins
  keyGenerator: (req: Request) => {
    const extReq = req as ExtendedRequest;
    return `admin:${extReq.userId || req.ip}`;
  },
});

// UTILIDADES DE MONITOREO Y DEBUGGING

/**
 * Middleware para logging de rate limit (útil en desarrollo)
 */
export const rateLimitLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (config.app.isDevelopment) {
    const extReq = req as ExtendedRequest;

    if (extReq.rateLimitInfo) {
      logger.debug(
        {
          component: 'rate_limit_logger',
          path: req.path,
          method: req.method,
          userId: extReq.userId,
          rateLimitInfo: extReq.rateLimitInfo,
        },
        'Rate limit status',
      );
    }
  }

  next();
};

/**
 * Función para obtener estadísticas de rate limiting
 */
export const getRateLimitStats = async (
  identifier: string,
): Promise<{
  current: number;
  limit: number;
  remaining: number;
  resetTime: Date | null;
} | null> => {
  try {
    const store = new TaskServiceRedisRateLimitStore(config.rateLimit.windowMs);
    const status = await store.getStatus(identifier);

    if (!status) {
      return null;
    }

    const limit = config.rateLimit.maxRequests;
    const remaining = Math.max(0, limit - status.count);
    const resetTime =
      status.ttl > 0 ? new Date(Date.now() + status.ttl * 1000) : null;

    return {
      current: status.count,
      limit,
      remaining,
      resetTime,
    };
  } catch (error) {
    logger.error(
      {
        error,
        identifier,
        event: EVENT_TYPES.CACHE_ERROR,
      },
      'Failed to get rate limit stats',
    );
    return null;
  }
};

/**
 * Función para resetear rate limit de un identificador específico
 */
export const resetRateLimit = async (identifier: string): Promise<boolean> => {
  try {
    const store = new TaskServiceRedisRateLimitStore(config.rateLimit.windowMs);
    await store.resetKey(identifier);

    logger.info(
      {
        component: 'rate_limit_admin',
        identifier,
      },
      'Rate limit reset manually',
    );

    return true;
  } catch (error) {
    logger.error(
      {
        error,
        identifier,
        event: EVENT_TYPES.CACHE_ERROR,
      },
      'Failed to reset rate limit',
    );
    return false;
  }
};

// EXPORTACIONES
export {
  TaskServiceRedisRateLimitStore,
  type RateLimitOptions,
  type RateLimitResult,
  type ExtendedRequest,
};
