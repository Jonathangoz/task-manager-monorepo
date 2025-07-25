// src/commons/routes/health.routes.ts
import { Router } from 'express';
import { HealthController } from '@/controllers/HealthController';
import { rateLimitGeneral } from '@/middlewares/rateLimit.middleware';
import { extractSessionInfo } from '@/middlewares/auth.middleware';
import { asyncHandler } from '@/middlewares/error.middleware';
import { environment } from '@/config/environment';

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // Rate limiting más permisivo para health checks
    const healthRateLimit = rateLimitGeneral({
      windowMs: 1 * 60 * 1000, // 1 minuto
      maxRequests: 100, // máximo 100 requests por IP por minuto
      message: 'Demasiadas peticiones de health check'
    });

    // Middleware básico
    router.use(extractSessionInfo);

    // === HEALTH CHECKS BÁSICOS ===

    /**
     * GET /health
     * Health check básico - respuesta rápida
     */
    router.get(
      '/',
      healthRateLimit,
      asyncHandler(healthController.basicHealthCheck.bind(healthController))
    );

    /**
     * GET /health/ready
     * Readiness probe - verifica si el servicio está listo para recibir tráfico
     * Usado por Kubernetes/Docker Compose
     */
    router.get(
      '/ready',
      asyncHandler(healthController.readinessCheck.bind(healthController))
    );

    /**
     * GET /health/live
     * Liveness probe - verifica si el servicio está vivo
     * Usado por Kubernetes/Docker Compose
     */
    router.get(
      '/live',
      asyncHandler(healthController.livenessCheck.bind(healthController))
    );

    // === HEALTH CHECKS DETALLADOS (solo en desarrollo/staging) ===
    if (environment.NODE_ENV !== 'production') {
      /**
       * GET /health/detailed
       * Health check detallado con información del sistema
       */
      router.get(
        '/detailed',
        healthRateLimit,
        asyncHandler(healthController.detailedHealthCheck.bind(healthController))
      );

      /**
       * GET /health/database
       * Health check específico de la base de datos
       */
      router.get(
        '/database',
        healthRateLimit,
        asyncHandler(healthController.databaseHealthCheck.bind(healthController))
      );

      /**
       * GET /health/redis
       * Health check específico de Redis
       */
      router.get(
        '/redis',
        healthRateLimit,
        asyncHandler(healthController.redisHealthCheck.bind(healthController))
      );

      /**
       * GET /health/dependencies
       * Health check de dependencias externas
       */
      router.get(
        '/dependencies',
        healthRateLimit,
        asyncHandler(healthController.dependenciesHealthCheck.bind(healthController))
      );

      /**
       * GET /health/metrics
       * Métricas del sistema
       */
      router.get(
        '/metrics',
        healthRateLimit,
        asyncHandler(healthController.getMetrics.bind(healthController))
      );
    }

    return router;
  }
}