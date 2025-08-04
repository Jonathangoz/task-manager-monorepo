// ==============================================
// src/utils/rateLimitUtils.ts
// Utilidades para testing, monitoreo y administración de rate limiting
// ==============================================

import { Request } from 'express';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import {
  RATE_LIMIT_CONFIG,
  RATE_LIMIT_EXEMPTIONS,
  EVENT_TYPES,
  isWhitelistedIP,
  isExemptedRoute,
} from '@/utils/constants';

// ==============================================
// TIPOS Y INTERFACES
// ==============================================

interface RateLimitStatus {
  identifier: string;
  current: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
  isBlocked: boolean;
}

interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  blockRate: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
  }>;
  averageUsage: number;
  timestamp: Date;
}

interface RateLimitHealth {
  store: 'healthy' | 'degraded' | 'unavailable';
  latency: number;
  errorRate: number;
  fallbackActive: boolean;
  lastError?: string;
}

// ==============================================
// CLASE PRINCIPAL DE UTILIDADES
// ==============================================

export class RateLimitUtils {
  private redis = taskRedisConnection.getClient();
  private keyPrefix = RATE_LIMIT_CONFIG.REDIS_KEY_PREFIX;

  // ==============================================
  // MÉTODOS DE CONSULTA Y MONITOREO
  // ==============================================

  /**
   * Obtiene el estado actual del rate limit para un identificador
   */
  async getStatus(
    identifier: string,
    limitType: string = 'general',
  ): Promise<RateLimitStatus | null> {
    try {
      const key = `${this.keyPrefix}${limitType}:${identifier}`;
      const pipeline = this.redis.pipeline();

      pipeline.get(key);
      pipeline.ttl(key);

      const results = await pipeline.exec();

      if (!results || results.some(([err]) => err)) {
        return null;
      }

      const current = parseInt((results[0][1] as string) || '0');
      const ttl = results[1][1] as number;

      // Obtener límite basado en el tipo
      const limit = this.getLimitForType(limitType);
      const remaining = Math.max(0, limit - current);
      const resetTime = new Date(Date.now() + ttl * 1000);
      const windowMs = this.getWindowMsForType(limitType);

      return {
        identifier,
        current,
        limit,
        remaining,
        resetTime,
        windowMs,
        isBlocked: current >= limit,
      };
    } catch (error) {
      logger.error(
        {
          error,
          identifier,
          limitType,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to get rate limit status',
      );
      return null;
    }
  }

  /**
   * Obtiene métricas agregadas de rate limiting
   */
  async getMetrics(_timeRangeMs: number = 3600000): Promise<RateLimitMetrics> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      let totalRequests = 0;
      let blockedRequests = 0;
      const violatorMap = new Map<string, number>();

      // Analizar cada clave de rate limit
      for (const key of keys) {
        const value = await this.redis.get(key);
        if (value) {
          const count = parseInt(value);
          totalRequests += count;

          // Extraer identificador y tipo de la clave
          const parts = key.replace(this.keyPrefix, '').split(':');
          const identifier = parts[parts.length - 1];
          const limitType = parts[0];

          const limit = this.getLimitForType(limitType);

          if (count >= limit) {
            blockedRequests += count - limit + 1;
            violatorMap.set(identifier, (violatorMap.get(identifier) || 0) + 1);
          }
        }
      }

      // Ordenar violadores por número de violaciones
      const topViolators = Array.from(violatorMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([identifier, violations]) => ({ identifier, violations }));

      const blockRate =
        totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;
      const averageUsage = keys.length > 0 ? totalRequests / keys.length : 0;

      return {
        totalRequests,
        blockedRequests,
        blockRate,
        topViolators,
        averageUsage,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to get rate limit metrics',
      );

      return {
        totalRequests: 0,
        blockedRequests: 0,
        blockRate: 0,
        topViolators: [],
        averageUsage: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Verifica la salud del sistema de rate limiting
   */
  async checkHealth(): Promise<RateLimitHealth> {
    try {
      const start = Date.now();
      const testKey = `${this.keyPrefix}health_check`;

      // Test de escritura/lectura
      await this.redis.setex(testKey, 5, 'test');
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      const latency = Date.now() - start;

      if (value !== 'test') {
        throw new Error('Redis read/write test failed');
      }

      return {
        store: 'healthy',
        latency,
        errorRate: 0,
        fallbackActive: false,
      };
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Rate limit health check failed',
      );

      return {
        store: 'unavailable',
        latency: -1,
        errorRate: 100,
        fallbackActive: true,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==============================================
  // MÉTODOS DE ADMINISTRACIÓN
  // ==============================================

  /**
   * Resetea el rate limit para un identificador específico
   */
  async resetLimit(
    identifier: string,
    limitType: string = 'general',
  ): Promise<boolean> {
    try {
      const key = `${this.keyPrefix}${limitType}:${identifier}`;
      const result = await this.redis.del(key);

      logger.info(
        {
          identifier,
          limitType,
          component: 'rate_limit_admin',
        },
        'Rate limit reset manually',
      );

      return result > 0;
    } catch (error) {
      logger.error(
        {
          error,
          identifier,
          limitType,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to reset rate limit',
      );
      return false;
    }
  }

  /**
   * Resetea todos los rate limits (usar con cuidado)
   */
  async resetAllLimits(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);

      logger.warn(
        {
          keysDeleted: result,
          component: 'rate_limit_admin',
        },
        'All rate limits reset',
      );

      return result;
    } catch (error) {
      logger.error(
        {
          error,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to reset all rate limits',
      );
      return 0;
    }
  }

  /**
   * Añade una IP a la whitelist temporal
   */
  async addTemporaryWhitelist(
    identifier: string,
    durationSeconds: number = 3600,
  ): Promise<void> {
    try {
      const key = `${this.keyPrefix}whitelist:${identifier}`;
      await this.redis.setex(key, durationSeconds, '1');

      logger.info(
        {
          identifier,
          durationSeconds,
          component: 'rate_limit_admin',
        },
        'Temporary whitelist added',
      );
    } catch (error) {
      logger.error(
        {
          error,
          identifier,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to add temporary whitelist',
      );
    }
  }

  /**
   * Verifica si un identificador está en whitelist temporal
   */
  async isTemporarilyWhitelisted(identifier: string): Promise<boolean> {
    try {
      const key = `${this.keyPrefix}whitelist:${identifier}`;
      const result = await this.redis.get(key);
      return result === '1';
    } catch (error) {
      logger.error(
        {
          error,
          identifier,
          event: EVENT_TYPES.CACHE_ERROR,
        },
        'Failed to check temporary whitelist',
      );
      return false;
    }
  }

  // ==============================================
  // MÉTODOS DE ANÁLISIS Y REPORTING
  // ==============================================

  /**
   * Genera un reporte detallado de rate limiting
   */
  async generateReport(timeRangeMs: number = 3600000): Promise<{
    summary: RateLimitMetrics;
    health: RateLimitHealth;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
    recommendations: string[];
  }> {
    const summary = await this.getMetrics(timeRangeMs);
    const health = await this.checkHealth();

    // Simular análisis de endpoints (en producción vendría de logs estructurados)
    const topEndpoints = [
      { endpoint: '/api/v1/tasks', requests: 1250 },
      { endpoint: '/api/v1/categories', requests: 890 },
      { endpoint: '/api/v1/tasks/search', requests: 567 },
    ];

    const recommendations = this.generateRecommendations(summary, health);

    return {
      summary,
      health,
      topEndpoints,
      recommendations,
    };
  }

  /**
   * Genera recomendaciones basadas en métricas
   */
  private generateRecommendations(
    metrics: RateLimitMetrics,
    health: RateLimitHealth,
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.blockRate > 10) {
      recommendations.push(
        'Alto porcentaje de bloqueo detectado. Considere ajustar los límites.',
      );
    }

    if (health.latency > 100) {
      recommendations.push(
        'Latencia alta del store Redis. Verifique la configuración de red.',
      );
    }

    if (metrics.topViolators.length > 5) {
      recommendations.push(
        'Múltiples violadores detectados. Considere implementar bloqueo temporal.',
      );
    }

    if (health.store !== 'healthy') {
      recommendations.push(
        'Store Redis no saludable. Verifique la conectividad.',
      );
    }

    return recommendations;
  }

  // ==============================================
  // MÉTODOS DE UTILIDAD PRIVADOS
  // ==============================================

  private getLimitForType(limitType: string): number {
    switch (limitType) {
      case 'auth':
        return config.rateLimit.auth?.max || 20;
      case 'create_task':
        return config.rateLimit.createTask?.max || 10;
      case 'search':
        return config.rateLimit.search?.max || 30;
      case 'bulk':
        return config.rateLimit.bulk?.max || 5;
      case 'admin':
        return config.rateLimit.admin?.max || 50;
      default:
        return config.rateLimit.maxRequests || 200;
    }
  }

  private getWindowMsForType(limitType: string): number {
    switch (limitType) {
      case 'auth':
        return config.rateLimit.auth?.windowMs || 900000;
      case 'create_task':
        return config.rateLimit.createTask?.windowMs || 60000;
      case 'search':
        return config.rateLimit.search?.windowMs || 60000;
      case 'bulk':
        return config.rateLimit.bulk?.windowMs || 300000;
      case 'admin':
        return config.rateLimit.admin?.windowMs || 60000;
      default:
        return config.rateLimit.windowMs || 900000;
    }
  }
}

// ==============================================
// FUNCIONES DE UTILIDAD EXPORTADAS
// ==============================================

/**
 * Instancia singleton de utilidades de rate limiting
 */
export const rateLimitUtils = new RateLimitUtils();

/**
 * Middleware para logging de rate limit en desarrollo
 */
export const rateLimitDebugLogger = (req: Request, limitType: string) => {
  if (config.app.isDevelopment) {
    rateLimitUtils
      .getStatus(req.ip || 'unknown', limitType)
      .then((status) => {
        if (status) {
          logger.debug(
            {
              component: 'rate_limit_debug',
              path: req.path,
              method: req.method,
              limitType,
              status,
            },
            'Rate limit status',
          );
        }
      })
      .catch((error) => {
        logger.error({ error }, 'Failed to get rate limit status for debug');
      });
  }
};

/**
 * Función para verificar si una request debe ser excluida del rate limiting
 */
export const shouldExemptFromRateLimit = (req: Request): boolean => {
  const ip = req.ip || '';
  const path = req.path;
  const userAgent = req.get('User-Agent') || '';

  // Verificar IP whitelist
  if (isWhitelistedIP(ip)) {
    return true;
  }

  // Verificar rutas excluidas
  if (isExemptedRoute(path)) {
    return true;
  }

  // Verificar user agents confiables
  if (
    RATE_LIMIT_EXEMPTIONS.TRUSTED_USER_AGENTS.some((agent) =>
      userAgent.includes(agent),
    )
  ) {
    return true;
  }

  return false;
};

/**
 * Función para generar identificador único basado en request
 */
export const generateRateLimitIdentifier = (
  req: Request,
  type: 'ip' | 'user' | 'combined' = 'combined',
): string => {
  const ip = req.ip || 'unknown';
  const userId = (req as Request & { userId?: string }).userId;

  switch (type) {
    case 'ip':
      return ip;
    case 'user':
      return userId || ip;
    case 'combined':
      return userId ? `user:${userId}` : `ip:${ip}`;
    default:
      return ip;
  }
};

/**
 * Función para formatear tiempo de reset de manera legible
 */
export const formatResetTime = (resetTime: Date): string => {
  const now = new Date();
  const diffMs = resetTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'ahora';
  }

  const diffSeconds = Math.ceil(diffMs / 1000);
  const diffMinutes = Math.ceil(diffSeconds / 60);

  if (diffSeconds < 60) {
    return `${diffSeconds} segundo${diffSeconds !== 1 ? 's' : ''}`;
  } else {
    return `${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  }
};

// ==============================================
// EXPORTACIONES
// ==============================================

export type { RateLimitStatus, RateLimitMetrics, RateLimitHealth };
