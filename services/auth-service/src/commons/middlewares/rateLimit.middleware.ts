// src/presentation/middlewares/rateLimit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '@/config/redis';
import { logger, securityLogger } from '@/utils/logger';
import { config } from '@/config/environment';
import { HTTP_STATUS, ERROR_CODES, ERROR_MESSAGES, CACHE_KEYS, CACHE_TTL, SECURITY_CONFIG } from '@/utils/constants';

interface RateLimitRequest extends Request {
  correlationId?: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, rateLimitInfo: RateLimitInfo) => void;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
  remaining: number;
}

// Store en memoria para desarrollo/fallback cuando Redis no está disponible
const rateLimitStore = new Map<string, RateLimitInfo>();

export class RateLimitMiddleware {
  /**
   * Rate limiter general basado en IP
   */
  static general(options: Partial<RateLimitConfig> = {}) {
    const defaultOptions: RateLimitConfig = {
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.ip || 'unknown',
      skip: () => false,
    };

    const finalOptions = { ...defaultOptions, ...options };

    return async (req: RateLimitRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Generar correlation ID si no existe
        if (!req.correlationId) {
          req.correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Skip si está configurado
        if (finalOptions.skip && finalOptions.skip(req)) {
          return next();
        }

        const key = `general:${finalOptions.keyGenerator!(req)}`;
        const rateLimitInfo = await RateLimitMiddleware.checkRateLimit(
          key,
          finalOptions.windowMs,
          finalOptions.maxRequests
        );

        // Agregar headers de rate limit
        RateLimitMiddleware.setRateLimitHeaders(res, rateLimitInfo, finalOptions.maxRequests);

        // Log de la petición
        logger.debug({
          correlationId: req.correlationId,
          ip: req.ip,
          key,
          count: rateLimitInfo.count,
          remaining: rateLimitInfo.remaining,
          resetTime: rateLimitInfo.resetTime,
        }, 'Rate limit check completed');

        // Verificar si se excedió el límite
        if (rateLimitInfo.count > finalOptions.maxRequests) {
          // Log de seguridad
          securityLogger.warn({
            correlationId: req.correlationId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            count: rateLimitInfo.count,
            maxRequests: finalOptions.maxRequests,
            event: 'RATE_LIMIT_EXCEEDED',
          }, 'Rate limit exceeded');

          // Callback personalizado
          if (finalOptions.onLimitReached) {
            finalOptions.onLimitReached(req, rateLimitInfo);
          }

          return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            error: {
              code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
              message: finalOptions.message,
            },
            meta: {
              rateLimitExceeded: true,
              resetTime: new Date(rateLimitInfo.resetTime).toISOString(),
              retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
            },
          });
        }

        next();
      } catch (error) {
        logger.error({
          error,
          correlationId: req.correlationId,
          ip: req.ip,
        }, 'Rate limit middleware error');
        
        // En caso de error, permitir la petición pero logear
        next();
      }
    };
  }

  /**
   * Rate limiter estricto para endpoints de autenticación
   */
  static auth(options: Partial<RateLimitConfig> = {}) {
    const defaultOptions: RateLimitConfig = {
      windowMs: SECURITY_CONFIG.LOGIN_ATTEMPT_WINDOW,
      maxRequests: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      keyGenerator: (req) => {
        const body = req.body as { email?: string };
        const email = body?.email || req.ip || 'unknown';
        return `auth:${email}`;
      },
      onLimitReached: (req, rateLimitInfo) => {
        securityLogger.error({
          correlationId: req.correlationId,
          ip: req.ip,
          email: (req.body as { email?: string })?.email,
          userAgent: req.get('User-Agent'),
          count: rateLimitInfo.count,
          event: 'AUTH_RATE_LIMIT_EXCEEDED',
        }, 'Authentication rate limit exceeded - potential brute force attack');
      },
    };

    return RateLimitMiddleware.general({ ...defaultOptions, ...options });
  }

  /**
   * Rate limiter por usuario autenticado
   */
  static perUser(options: Partial<RateLimitConfig> = {}) {
    const defaultOptions: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minuto
      maxRequests: 60,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      keyGenerator: (req) => {
        const typedReq = req as RateLimitRequest;
        return typedReq.user?.id || req.ip || 'unknown';
      },
      skip: (req) => {
        const typedReq = req as RateLimitRequest;
        return !typedReq.user; // Skip si no hay usuario autenticado
      },
    };

    return RateLimitMiddleware.general({ ...defaultOptions, ...options });
  }

  /**
   * Rate limiter específico para refresh tokens
   */
  static refreshToken() {
    return RateLimitMiddleware.general({
      windowMs: 60 * 1000, // 1 minuto
      maxRequests: 10, // Máximo 10 refresh por minuto
      message: 'Too many token refresh attempts',
      keyGenerator: (req) => {
        const typedReq = req as RateLimitRequest;
        return `refresh:${typedReq.user?.id || req.ip}`;
      },
    });
  }

  /**
   * Rate limiter para endpoints de registro
   */
  static registration() {
    return RateLimitMiddleware.general({
      windowMs: 60 * 60 * 1000, // 1 hora
      maxRequests: 5, // Máximo 5 registros por hora por IP
      message: 'Too many registration attempts',
      keyGenerator: (req) => `register:${req.ip}`,
    });
  }

  /**
   * Verifica el rate limit usando Redis o memoria
   */
  private static async checkRateLimit(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Intentar usar Redis primero
      if (redisConnection.isHealthy()) {
        return await RateLimitMiddleware.checkRateLimitRedis(key, windowMs, maxRequests, now);
      }
    } catch (error) {
      logger.warn({ error }, 'Redis unavailable for rate limiting, falling back to memory store');
    }

    // Fallback a store en memoria
    return RateLimitMiddleware.checkRateLimitMemory(key, windowMs, maxRequests, now, windowStart);
  }

  /**
   * Rate limiting usando Redis
   */
  private static async checkRateLimitRedis(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number
  ): Promise<RateLimitInfo> {
    const redis = redisConnection.getClient();
    const redisKey = CACHE_KEYS.RATE_LIMIT(key);
    
    // Usar pipeline para operaciones atómicas
    const pipeline = redis.pipeline();
    
    // Incrementar contador
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results || results.length < 2) {
      throw new Error('Redis pipeline failed');
    }

    const count = results[0][1] as number;
    const resetTime = now + windowMs;
    const remaining = Math.max(0, maxRequests - count);

    return {
      count,
      resetTime,
      firstRequest: now,
      remaining,
    };
  }

  /**
   * Rate limiting usando memoria (fallback)
   */
  private static checkRateLimitMemory(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number,
    windowStart: number
  ): RateLimitInfo {
    // Limpiar entradas expiradas
    RateLimitMiddleware.cleanExpiredEntries(windowStart);

    // Obtener o crear info de rate limit
    let limitInfo = rateLimitStore.get(key);
    
    if (!limitInfo || limitInfo.firstRequest < windowStart) {
      // Nueva ventana de tiempo
      limitInfo = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
        remaining: maxRequests,
      };
    }

    // Incrementar contador
    limitInfo.count++;
    limitInfo.remaining = Math.max(0, maxRequests - limitInfo.count);
    rateLimitStore.set(key, limitInfo);

    return limitInfo;
  }

  /**
   * Limpia entradas expiradas del store en memoria
   */
  private static cleanExpiredEntries(windowStart: number): void {
    for (const [key, info] of rateLimitStore.entries()) {
      if (info.resetTime < Date.now()) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Establece headers de rate limit en la respuesta
   */
  private static setRateLimitHeaders(
    res: Response,
    rateLimitInfo: RateLimitInfo,
    maxRequests: number
  ): void {
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString(),
      'X-RateLimit-Used': rateLimitInfo.count.toString(),
    });

    // Header adicional si se excedió el límite
    if (rateLimitInfo.count > maxRequests) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);
      res.set('Retry-After', retryAfter.toString());
    }
  }

  /**
   * Middleware para limpiar rate limits (útil para testing)
   */
  static clearAll() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Limpiar store en memoria
        rateLimitStore.clear();

        // Limpiar Redis si está disponible
        if (redisConnection.isHealthy()) {
          const redis = redisConnection.getClient();
          const keys = await redis.keys('ratelimit:*');
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        }

        logger.info('Rate limit store cleared');
        next();
      } catch (error) {
        logger.error({ error }, 'Failed to clear rate limit store');
        next();
      }
    };
  }

  /**
   * Obtiene estadísticas de rate limiting para monitoreo
   */
  static getStats() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const memoryStats = {
          totalKeys: rateLimitStore.size,
          keys: Array.from(rateLimitStore.entries()).map(([key, info]) => ({
            key,
            count: info.count,
            remaining: info.remaining,
            resetTime: new Date(info.resetTime).toISOString(),
          })),
        };

        let redisStats = null;
        if (redisConnection.isHealthy()) {
          const redis = redisConnection.getClient();
          const keys = await redis.keys('ratelimit:*');
          const values = keys.length > 0 ? await redis.mget(...keys) : [];
          
          redisStats = {
            totalKeys: keys.length,
            keys: keys.map((key, index) => ({
              key: key.replace('auth:ratelimit:', ''),
              count: parseInt(values[index] || '0'),
            })),
          };
        }

        res.json({
          success: true,
          data: {
            memory: memoryStats,
            redis: redisStats,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get rate limit stats');
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
          },
        });
      }
    };
  }
}

// Exportar middlewares preconfigurados para uso directo
export const rateLimitGeneral = RateLimitMiddleware.general();
export const rateLimitAuth = RateLimitMiddleware.auth();
export const rateLimitPerUser = RateLimitMiddleware.perUser();
export const rateLimitRefreshToken = RateLimitMiddleware.refreshToken();
export const rateLimitRegistration = RateLimitMiddleware.registration();