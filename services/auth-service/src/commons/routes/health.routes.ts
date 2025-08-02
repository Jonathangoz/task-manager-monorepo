// src/commons/routes/health.routes.ts - OPTIMIZADO PARA RENDER.COM
import express, { Router } from 'express';
import { HealthController } from '@/commons/controllers/HealthController';
import { asyncHandler } from '@/commons/middlewares/error.middleware';
import { environment } from '@/config/environment';

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // ✅ MIDDLEWARE ESPECIAL PARA HEALTH CHECKS - SIN TIMEOUT
    const healthCheckMiddleware = (req: any, res: any, next: any) => {
      // Marcar como health check para evitar timeouts y logging excesivo
      req.isHealthCheck = true;
      req.skipTimeout = true;
      // Headers optimizados para health checks
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    };

    // === HEALTH CHECKS BÁSICOS - OPTIMIZADOS PARA RENDER
    /**
     * GET /health
     * Health check básico - ULTRA RÁPIDO para Render health checks
     * Render usa este endpoint por defecto para verificar el servicio
     */
    router.get(
      '/health',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET / (root health check)
     * Render también puede verificar la raíz del health check
     */
    router.get(
      '/',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET /health/ready
     * Readiness probe - verifica dependencias críticas con timeouts mínimos
     * Usado por Render para determinar si el servicio está listo
     */
    router.get(
      '/ready',
      healthCheckMiddleware,
      asyncHandler(healthController.readinessCheck.bind(healthController)),
    );

    /**
     * GET /health/live
     * Liveness probe - INSTANTÁNEO, solo verifica que el proceso esté vivo
     * Para verificaciones frecuentes de Render
     */
    router.get(
      '/live',
      healthCheckMiddleware,
      asyncHandler(healthController.livenessCheck.bind(healthController)),
    );

    // ✅ ENDPOINTS ALTERNATIVOS PARA DIFERENTES CONFIGURACIONES DE RENDER
    /**
     * GET /healthz
     * Kubernetes-style health check (común en cloud platforms)
     */
    router.get(
      '/healthz',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET /ping
     * Endpoint super simple para verificaciones rápidas
     */
    router.get('/ping', healthCheckMiddleware, (req, res) => {
      res.status(200).json({
        success: true,
        status: 'pong',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    });

    /**
     * GET /status
     * Status simple sin verificaciones externas
     */
    router.get('/status', healthCheckMiddleware, (req, res) => {
      const memUsage = process.memoryUsage();
      res.status(200).json({
        success: true,
        status: 'ok',
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // === HEALTH CHECKS DETALLADOS (solo en desarrollo/staging) ===
    if (!environment.app.isProduction) {
      /**
       * GET /health/detailed
       * Health check detallado con métricas del sistema
       */
      router.get(
        '/detailed',
        healthCheckMiddleware,
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
        healthCheckMiddleware,
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
        healthCheckMiddleware,
        asyncHandler(healthController.redisHealthCheck.bind(healthController)),
      );

      /**
       * GET /health/dependencies
       * Health check de dependencias externas
       */
      router.get(
        '/dependencies',
        healthCheckMiddleware,
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
        healthCheckMiddleware,
        asyncHandler(healthController.getMetrics.bind(healthController)),
      );
    }

    // ✅ HANDLER DE ERRORES ESPECÍFICO PARA HEALTH CHECKS
    router.use((error: unknown, req: unknown, res: unknown, next: unknown) => {
      // Si es un health check, responder rápido sin logs detallados
      if (req.isHealthCheck) {
        const statusCode = error.statusCode || 503;
        return res.status(statusCode).json({
          success: false,
          status: 'unhealthy',
          error: error.message || 'Service temporarily unavailable',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
        });
      }
      next(error);
    });

    return router;
  }
}
