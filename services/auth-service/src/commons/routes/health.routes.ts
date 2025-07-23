import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // Rate limiting más permisivo para health checks
    const healthRateLimit = RateLimitMiddleware.createRateLimit({
      windowMs: 1 * 60 * 1000, // 1 minuto
      max: 100, // máximo 100 requests por IP por minuto
      message: 'Demasiadas peticiones de health check'
    });

    // Health check básico
    router.get(
      '/',
      healthRateLimit,
      healthController.basicHealthCheck
    );

    // Health check detallado con información del sistema
    router.get(
      '/detailed',
      healthRateLimit,
      healthController.detailedHealthCheck
    );

    // Health check de la base de datos
    router.get(
      '/database',
      healthRateLimit,
      healthController.databaseHealthCheck
    );

    // Health check de servicios externos
    router.get(
      '/external',
      healthRateLimit,
      healthController.externalServicesHealthCheck
    );

    // Métricas del sistema
    router.get(
      '/metrics',
      healthRateLimit,
      healthController.getMetrics
    );

    // Readiness probe (para Kubernetes)
    router.get(
      '/ready',
      healthController.readinessCheck
    );

    // Liveness probe (para Kubernetes)
    router.get(
      '/live',
      healthController.livenessCheck
    );

    return router;
  }
}