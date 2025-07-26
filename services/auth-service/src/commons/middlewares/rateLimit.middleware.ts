// src/presentation/middlewares/rateLimit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { RedisCache } from '@/core/cache/RedisCache';
import { securityLogger, logger } from '@/utils/logger';
import { environment } from '@/config/environment';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  CACHE_KEYS, 
  CACHE_TTL, 
  SECURITY_CONFIG,
  RATE_LIMIT_CONFIG
} from '@/utils/constants';

interface RateLimitRequest extends Request {
  correlationId?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    sessionId?: string;
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
  private static cache = new RedisCache();

  /**
   * Rate limiter general basado en IP
   */
  static general(options: Partial<RateLimitConfig> = {}) {
    const defaultOptions: RateLimitConfig = {
      windowMs: environment.RATE_LIMIT_WINDOW_MS,
      maxRequests: environment.RATE_LIMIT_MAX_REQUESTS,
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
        securityLogger.debug('Rate limit check completed', {
          correlationId: req.correlationId,
          ip: req.ip,
          key,
          count: rateLimitInfo.count,
          remaining: rateLimitInfo.remaining,
          resetTime: rateLimitInfo.resetTime,
        });

        // Verificar si se excedió el límite
        if (rateLimitInfo.count > finalOptions.maxRequests) {
          // Log de seguridad
          securityLogger.warn('Rate limit exceeded', {
            correlationId: req.correlationId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            count: rateLimitInfo.count,
            maxRequests: finalOptions.maxRequests,
            event: 'RATE_LIMIT_EXCEEDED',
          });

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
              correlationId: req.correlationId,
              rateLimitExceeded: true,
              resetTime: new Date(rateLimitInfo.resetTime).toISOString(),
              retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000),
              timestamp: new Date().toISOString(),
              path: req.path,
              method: req.method
            },
          });
        }

        next();
      } catch (error) {
        securityLogger.error('Rate limit middleware error', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined,
          correlationId: req.correlationId,
          ip: req.ip,
        });
        
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
      windowMs: RATE_LIMIT_CONFIG.AUTH.WINDOW_MS,
      maxRequests: RATE_LIMIT_CONFIG.AUTH.MAX_REQUESTS,
      message: 'Demasiados intentos de login, intenta de nuevo más tarde',
      keyGenerator: (req) => {
        const body = req.body as { email?: string };
        const email = body?.email || req.ip || 'unknown';
        return `auth:${email}`;
      },
      onLimitReached: (req, rateLimitInfo) => {
        securityLogger.error('Authentication rate limit exceeded - potential brute force attack', {
          correlationId: req.correlationId,
          ip: req.ip,
          email: (req.body as { email?: string })?.email,
          userAgent: req.get('User-Agent'),
          count: rateLimitInfo.count,
          event: 'AUTH_RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
        });
      },
    };

    return RateLimitMiddleware.general({ ...defaultOptions, ...options });
  }

  /**
   * Rate limiter por usuario autenticado
   */
  static perUser(options: Partial<RateLimitConfig> = {}) {
    const defaultOptions: RateLimitConfig = {
      windowMs: RATE_LIMIT_CONFIG.GENERAL.WINDOW_MS,
      maxRequests: RATE_LIMIT_CONFIG.GENERAL.MAX_REQUESTS,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      keyGenerator: (req) => {
        const typedReq = req as RateLimitRequest;
        return `user:${typedReq.user?.id || req.ip || 'unknown'}`;
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
      message: 'Demasiados intentos de renovación de token',
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
      windowMs: RATE_LIMIT_CONFIG.REGISTRATION.WINDOW_MS,
      maxRequests: RATE_LIMIT_CONFIG.REGISTRATION.MAX_REQUESTS,
      message: 'Demasiados intentos de registro',
      keyGenerator: (req) => `register:${req.ip}`,
    });
  }

  /**
   * Rate limiter para recuperación de contraseña
   */
  static passwordReset() {
    return RateLimitMiddleware.general({
      windowMs: RATE_LIMIT_CONFIG.PASSWORD_RESET.WINDOW_MS,
      maxRequests: RATE_LIMIT_CONFIG.PASSWORD_RESET.MAX_REQUESTS,
      message: 'Demasiados intentos de recuperación de contraseña',
      keyGenerator: (req) => {
        const email = (req.body as { email?: string })?.email || req.ip;
        return `password-reset:${email}`;
      },
    });
  }

  /**
   * Rate limiter para verificación de email
   */
  static emailVerification() {
    return RateLimitMiddleware.general({
      windowMs: RATE_LIMIT_CONFIG.EMAIL_VERIFICATION.WINDOW_MS,
      maxRequests: RATE_LIMIT_CONFIG.EMAIL_VERIFICATION.MAX_REQUESTS,
      message: 'Demasiados intentos de verificación de email',
      keyGenerator: (req) => {
        const email = (req.body as { email?: string })?.email || req.ip;
        return `email-verify:${email}`;
      },
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
      const isHealthy = await RateLimitMiddleware.cache.healthCheck();
      if (isHealthy) {
        return await RateLimitMiddleware.checkRateLimitRedis(key, windowMs, maxRequests, now);
      }
    } catch (error) {
      securityLogger.warn('Redis unavailable for rate limiting, falling back to memory store', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        key
      });
    }

    // Fallback a store en memoria
    return RateLimitMiddleware.checkRateLimitMemory(key, windowMs, maxRequests, now, windowStart);
  }

  /**
   * Rate limiting usando Redis con sliding window
   */
  private static async checkRateLimitRedis(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number
  ): Promise<RateLimitInfo> {
    const redisKey = CACHE_KEYS.RATE_LIMIT(key);
    const windowStart = now - windowMs;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      // Incrementar contador usando el método del RedisCache
      const count = await RateLimitMiddleware.cache.incrementRateLimit(key, windowMs);
      
      const resetTime = now + windowMs;
      const remaining = Math.max(0, maxRequests - count);

      return {
        count,
        resetTime,
        firstRequest: now,
        remaining,
      };
    } catch (error) {
      securityLogger.error('Error in Redis rate limiting', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        key: redisKey
      });
      throw error;
    }
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
   * Middleware para limpiar todos los rate limits (útil para testing)
   */
  static clearAll() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Limpiar store en memoria
        rateLimitStore.clear();

        // Limpiar Redis si está disponible
        const isHealthy = await RateLimitMiddleware.cache.healthCheck();
        if (isHealthy) {
          await RateLimitMiddleware.cache.deletePattern('*ratelimit:*');
        }

        securityLogger.info('All rate limits cleared', {
          correlationId: req.correlationId || `clear-${Date.now()}`,
          clearedBy: (req as RateLimitRequest).user?.id || req.ip
        });
        
        next();
      } catch (error) {
        securityLogger.error('Failed to clear all rate limits', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined
        });
        next();
      }
    };
  }

  /**
   * Middleware para limpiar rate limits específicos
   */
  static clearRateLimit(keyPattern: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Limpiar de memoria
        for (const [key] of rateLimitStore.entries()) {
          if (key.includes(keyPattern)) {
            rateLimitStore.delete(key);
          }
        }

        // Limpiar de Redis si está disponible
        const isHealthy = await RateLimitMiddleware.cache.healthCheck();
        if (isHealthy) {
          const pattern = `*${keyPattern}*`;
          await RateLimitMiddleware.cache.deletePattern(pattern);
        }

        securityLogger.info('Rate limit cleared', { 
          keyPattern,
          correlationId: req.correlationId || `clear-${Date.now()}`,
          clearedBy: (req as RateLimitRequest).user?.id || req.ip
        });
        
        next();
      } catch (error) {
        securityLogger.error('Failed to clear rate limit', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined,
          keyPattern
        });
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
        const correlationId = `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        const isHealthy = await RateLimitMiddleware.cache.healthCheck();
        if (isHealthy) {
          try {
            const cacheStats = await RateLimitMiddleware.cache.getStats();
            redisStats = {
              keyCount: cacheStats.keyCount,
              memoryUsage: cacheStats.memoryUsage,
            };
          } catch (error) {
            securityLogger.warn('Error getting Redis stats', {
              error: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
        }

        res.json({
          success: true,
          data: {
            memory: memoryStats,
            redis: redisStats,
            timestamp: new Date().toISOString(),
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });

        logger.debug('Rate limit stats retrieved', {
          correlationId,
          memoryKeys: memoryStats.totalKeys,
          redisAvailable: !!redisStats
        });

      } catch (error) {
        securityLogger.error('Failed to get rate limit stats', {
          error: error instanceof Error ? error.message : 'Error desconocido',
          stack: error instanceof Error ? error.stack : undefined
        });
        
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
          },
          meta: {
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
          }
        });
      }
    };
  }

  /**
   * Middleware para verificar si un IP está en whitelist
   */
  static whitelist(whitelistedIPs: string[] = []) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Si está en whitelist, skip rate limiting
      if (whitelistedIPs.includes(clientIP)) {
        securityLogger.debug('IP whitelisted, skipping rate limit', { 
          ip: clientIP,
          path: req.path 
        });
        return next();
      }

      // Continuar con rate limiting normal
      next();
    };
  }

  /**
   * Middleware de rate limiting adaptativo basado en carga del sistema
   */
  static adaptive(baseOptions: Partial<RateLimitConfig> = {}) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Obtener métricas básicas del sistema
      const memUsage = process.memoryUsage();
      
      // Calcular factor de ajuste basado en uso de memoria
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      let adjustmentFactor = 1;
      
      if (memUsagePercent > 80) {
        adjustmentFactor = 0.5; // Reducir límites si memoria alta
      } else if (memUsagePercent > 60) {
        adjustmentFactor = 0.75;
      }

      // Aplicar factor de ajuste a las opciones
      const adaptedOptions = {
        ...baseOptions,
        maxRequests: Math.floor((baseOptions.maxRequests || 100) * adjustmentFactor),
      };

      securityLogger.debug('Adaptive rate limiting applied', {
        memUsagePercent,
        adjustmentFactor,
        originalLimit: baseOptions.maxRequests || 100,
        adaptedLimit: adaptedOptions.maxRequests,
        ip: req.ip,
        path: req.path
      });

      // Aplicar rate limiting con opciones adaptadas
      RateLimitMiddleware.general(adaptedOptions)(req, res, next);
    };
  }

  /**
   * Middleware para aplicar diferentes límites según el método HTTP
   */
  static byMethod(methodLimits: Record<string, Partial<RateLimitConfig>> = {}) {
    const defaultLimits: Record<string, Partial<RateLimitConfig>> = {
      'GET': { maxRequests: 100, windowMs: 60000 },
      'POST': { maxRequests: 20, windowMs: 60000 },
      'PUT': { maxRequests: 20, windowMs: 60000 },
      'PATCH': { maxRequests: 20, windowMs: 60000 },
      'DELETE': { maxRequests: 10, windowMs: 60000 },
    };

    return (req: Request, res: Response, next: NextFunction): void => {
      const method = req.method.toUpperCase();
      const limits = methodLimits[method] || defaultLimits[method] || defaultLimits['GET'];
      
      securityLogger.debug('Method-based rate limiting applied', {
        method,
        limits: {
          maxRequests: limits.maxRequests,
          windowMs: limits.windowMs
        },
        ip: req.ip,
        path: req.path
      });

      RateLimitMiddleware.general(limits)(req, res, next);
    };
  }
}

// Exportar middlewares preconfigurados para uso directo
export const rateLimitGeneral = RateLimitMiddleware.general();
export const rateLimitAuth = RateLimitMiddleware.auth();
export const rateLimitPerUser = RateLimitMiddleware.perUser();
export const rateLimitRefreshToken = RateLimitMiddleware.refreshToken();
export const rateLimitRegistration = RateLimitMiddleware.registration();
export const rateLimitPasswordReset = RateLimitMiddleware.passwordReset();
export const rateLimitEmailVerification = RateLimitMiddleware.emailVerification();

// Exportar clase para uso avanzado
export { RateLimitMiddleware };