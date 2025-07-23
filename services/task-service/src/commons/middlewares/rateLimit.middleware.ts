// src/presentation/middlewares/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES 
} from '@/utils/constants';

// Rate limiter usando Redis store personalizado
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    keyGenerator = (req: Request) => req.ip
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req: Request, res: Response) => {
      logger.warn({
        ip: req.ip,
        userId: req.userId,
        path: req.path,
        method: req.method
      }, 'Rate limit exceeded');

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message,
        error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED }
      });
    },
    // Store personalizado usando Redis
    store: config.rateLimit.enabled ? new RedisRateLimitStore(windowMs) : undefined
  });
};

class RedisRateLimitStore {
  constructor(private windowMs: number) {}

  async increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    try {
      const redis = taskRedisConnection.getClient();
      const redisKey = `ratelimit:${key}`;
      
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, Math.ceil(this.windowMs / 1000));
      
      const results = await multi.exec();
      const totalHits = results?.[0]?.[1] as number || 1;
      
      return {
        totalHits,
        timeToExpire: this.windowMs
      };
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit store error');
      // Fallback: permitir la request si Redis falla
      return { totalHits: 1 };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      const redis = taskRedisConnection.getClient();
      const redisKey = `ratelimit:${key}`;
      await redis.decr(redisKey);
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit decrement error');
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      const redis = taskRedisConnection.getClient();
      const redisKey = `ratelimit:${key}`;
      await redis.del(redisKey);
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit reset error');
    }
  }
}

// Rate limiters específicos para diferentes endpoints
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
});

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requests por IP para endpoints críticos
});

export const createTaskRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 tareas nuevas por minuto por usuario
  keyGenerator: (req: Request) => req.userId || req.ip
});

export const userSpecificRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requests por usuario autenticado
  keyGenerator: (req: Request) => req.userId || req.ip
});