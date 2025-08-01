// src/commons/routes/health.routes.ts
import express, { Router } from 'express';
import { HealthController } from '@/commons/controllers/HealthController';
import { asyncHandler } from '@/commons/middlewares/error.middleware';
import { environment } from '@/config/environment';

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // === HEALTH CHECKS BÁSICOS ===
    /**
     * GET /health
     * Health check básico - ULTRA RÁPIDO para Docker health checks
     * Solo verifica que el servidor responda, no dependencias
     */
    router.get(
      '/health',
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET /health/ready
     * Readiness probe - verifica dependencias con timeouts agresivos
     * Mejor para depends_on: service_healthy en Docker Compose
     */
    router.get(
      '/health/ready',
      asyncHandler(healthController.readinessCheck.bind(healthController)),
    );

    /**
     * GET /health/live
     * Liveness probe - solo verifica que el proceso esté vivo
     */
    router.get(
      '/health/live',
      asyncHandler(healthController.livenessCheck.bind(healthController)),
    );

    // === HEALTH CHECKS DETALLADOS (solo en desarrollo/staging) ===
    if (!environment.app.isProduction) {
      /**
       * GET /health/detailed
       * Health check detallado con métricas del sistema
       */
      router.get(
        '/detailed',
        asyncHandler(
          healthController.detailedHealthCheck.bind(healthController),
        ),
      );

      /**
       * GET /health/database
       * Health check específico de la base de datos
       */
      router.get(
        '/database',
        asyncHandler(
          healthController.databaseHealthCheck.bind(healthController),
        ),
      );

      /**
       * GET /health/redis
       * Health check específico de Redis
       */
      router.get(
        '/redis',
        asyncHandler(healthController.redisHealthCheck.bind(healthController)),
      );

      /**
       * GET /health/dependencies
       * Health check de dependencias externas
       */
      router.get(
        '/dependencies',
        asyncHandler(
          healthController.dependenciesHealthCheck.bind(healthController),
        ),
      );

      /**
       * GET /health/metrics
       * Métricas del sistema
       */
      router.get(
        '/metrics',
        asyncHandler(healthController.getMetrics.bind(healthController)),
      );
    }

    return router;
  }
}
