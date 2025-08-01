// src/commons/middlewares/health.middleware.ts - Health Check Middleware
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { REQUEST_HEADERS } from '@/utils/constants';

/**
 * Middleware para agregar request ID a health checks si no existe
 */
export const healthRequestId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Verificar si existe el header de request ID
  let requestId = req.headers[REQUEST_HEADERS.X_REQUEST_ID];

  if (!requestId) {
    requestId = `health_${uuidv4()}`;
    req.headers[REQUEST_HEADERS.X_REQUEST_ID] = requestId;
  }

  // Agregar header de respuesta con verificación de tipo
  if (typeof requestId === 'string') {
    res.setHeader(REQUEST_HEADERS.X_REQUEST_ID, requestId);
  } else if (Array.isArray(requestId)) {
    res.setHeader(REQUEST_HEADERS.X_REQUEST_ID, requestId[0]);
  }

  next();
};

/**
 * Middleware para logging específico de health checks
 */
export const healthLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();
  const requestId = req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string;
  const userAgent = req.headers[REQUEST_HEADERS.USER_AGENT];

  // Log de inicio (solo en debug para evitar spam)
  logger.debug(
    {
      requestId,
      method: req.method,
      path: req.path,
      userAgent:
        typeof userAgent === 'string' ? userAgent : userAgent?.[0] || 'unknown',
      ip: req.ip,
      component: 'health_middleware',
    },
    `🏥 Health check iniciado: ${req.method} ${req.path}`,
  );

  // Override del res.json para capturar la respuesta
  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log del resultado
    if (statusCode >= 200 && statusCode < 300) {
      logger.debug(
        {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          component: 'health_middleware',
        },
        `✅ Health check completado: ${req.method} ${req.path} - ${statusCode} (${duration}ms)`,
      );
    } else {
      logger.warn(
        {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          component: 'health_middleware',
          responseBody: body,
        },
        `⚠️ Health check con problemas: ${req.method} ${req.path} - ${statusCode} (${duration}ms)`,
      );
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Interface para el cache de health checks
 */
interface HealthCacheEntry {
  data: any;
  timestamp: number;
}

/**
 * Middleware para cachear respuestas de health checks básicos (opcional)
 */
export const healthCache = (cacheDurationSeconds: number = 5) => {
  const cache = new Map<string, HealthCacheEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Solo cachear GET requests básicos
    if (req.method !== 'GET' || req.path.includes('detailed')) {
      return next();
    }

    const cacheKey = `${req.method}:${req.path}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    // Verificar si tenemos cache válido
    if (cached && now - cached.timestamp < cacheDurationSeconds * 1000) {
      logger.debug(
        {
          cacheKey,
          age: now - cached.timestamp,
          component: 'health_cache',
        },
        `💾 Respuesta de health check desde cache`,
      );

      res.status(200).json(cached.data);
    }

    // Override del res.json para guardar en cache
    const originalJson = res.json;
    res.json = function (body: any) {
      // Solo cachear respuestas exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, {
          data: body,
          timestamp: now,
        });

        // Limpiar cache antiguo (garbage collection)
        const maxAge = cacheDurationSeconds * 2 * 1000;
        for (const [key, value] of cache.entries()) {
          if (now - value.timestamp > maxAge) {
            cache.delete(key);
          }
        }
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware de manejo de errores específico para health checks
 */
export const healthErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId = req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string;

  logger.error(
    {
      error: error.message,
      stack: error.stack,
      requestId,
      method: req.method,
      path: req.path,
      component: 'health_error_handler',
    },
    `❌ Error en health check: ${req.method} ${req.path}`,
  );

  // Respuesta de error estandarizada para health checks
  res.status(503).json({
    success: false,
    message: 'Health check failed',
    error: {
      code: 'HEALTH_CHECK_ERROR',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
};

/**
 * Función helper para crear un middleware de timeout específico para health checks
 */
export const healthTimeout = (timeoutMs: number = 5000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const requestId = req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string;

        logger.warn(
          {
            requestId,
            method: req.method,
            path: req.path,
            timeout: timeoutMs,
            component: 'health_timeout',
          },
          `⏰ Health check timeout: ${req.method} ${req.path}`,
        );

        res.status(503).json({
          success: false,
          message: 'Health check timeout',
          error: {
            code: 'HEALTH_CHECK_TIMEOUT',
            details: { timeoutMs },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
      }
    }, timeoutMs);

    // Limpiar timeout cuando la respuesta termine
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};
