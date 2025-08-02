// src/commons/routes/health.routes.ts - ACTUALIZADO CON NUEVOS ENDPOINTS
import { Router, Request, Response, NextFunction } from 'express';
import { HealthController } from '@/commons/controllers/HealthController';
import { asyncHandler } from '@/commons/middlewares/error.middleware';
import { environment } from '@/config/environment';

// ✅ Interfaces para los parámetros del middleware
interface HealthCheckRequest extends Request {
  isHealthCheck?: boolean;
  skipTimeout?: boolean;
}

interface HealthCheckError extends Error {
  statusCode?: number;
}

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // ✅ MIDDLEWARE ESPECIAL PARA HEALTH CHECKS - SIN TIMEOUT
    const healthCheckMiddleware = (
      req: HealthCheckRequest,
      res: Response,
      next: NextFunction,
    ) => {
      // Marcar como health check para evitar timeouts y logging excesivo
      req.isHealthCheck = true;
      req.skipTimeout = true;
      // Headers optimizados para health checks
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Health-Check', 'true');
      next();
    };

    // === HEALTH CHECKS BÁSICOS - OPTIMIZADOS PARA RENDER ===

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
     * HEALTH CHECK PRINCIPAL PARA RENDER.
     * GET /health (mapeado a /api/v1/health en app.ts)
     * Responde INMEDIATAMENTE si el proceso Node.js está vivo.
     */
    router.get(
      '/', // La ruta base, que se convertirá en /api/v1/health
      healthCheckMiddleware,
      asyncHandler(healthController.livenessCheck.bind(healthController)),
    );

    /**
     * GET /healthz
     * Kubernetes-style health check (común en cloud platforms)
     */
    router.get(
      '/healthz',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    // === KUBERNETES-STYLE PROBES ===

    /**
     * READINESS PROBE - Para que Render sepa cuándo el servicio puede aceptar tráfico real.
     * GET /health/ready
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

    // === ENDPOINTS SÚPER SIMPLES PARA RENDER ===

    /**
     * GET /ping
     * Endpoint súper simple para verificaciones rápidas
     */
    router.get(
      '/ping',
      healthCheckMiddleware,
      asyncHandler(healthController.ping.bind(healthController)),
    );

    /**
     * GET /status
     * Status simple sin verificaciones externas
     */
    router.get(
      '/status',
      healthCheckMiddleware,
      asyncHandler(healthController.status.bind(healthController)),
    );

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

      /**
       * POST /health/cache/clear
       * Limpiar cache de health checks (solo desarrollo)
       */
      router.post(
        '/cache/clear',
        healthCheckMiddleware,
        asyncHandler(healthController.clearCache.bind(healthController)),
      );

      /**
       * GET /health/cache/info
       * Información del cache de health checks (solo desarrollo)
       */
      router.get(
        '/cache/info',
        healthCheckMiddleware,
        asyncHandler(healthController.getCacheInfo.bind(healthController)),
      );
    }

    // === ENDPOINTS ADICIONALES PARA DIFERENTES CONFIGURACIONES DE RENDER ===

    /**
     * GET /health-check (alternative naming)
     * Algunos servicios pueden usar este formato
     */
    router.get(
      '/health-check',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET /health/check (alternative naming)
     */
    router.get(
      '/check',
      healthCheckMiddleware,
      asyncHandler(healthController.basicHealthCheck.bind(healthController)),
    );

    /**
     * GET /health/alive (alternative to /live)
     */
    router.get(
      '/alive',
      healthCheckMiddleware,
      asyncHandler(healthController.livenessCheck.bind(healthController)),
    );

    // === ENDPOINTS PARA MONITOREO EXTERNO ===
    if (!environment.app.isProduction) {
      /**
       * GET /health/uptime
       * Simple uptime check
       */
      router.get(
        '/uptime',
        healthCheckMiddleware,
        (req: Request, res: Response) => {
          const uptimeSeconds = Math.floor(process.uptime());
          const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`;
          res.status(200).json({
            success: true,
            uptime: {
              seconds: uptimeSeconds,
              formatted: uptimeFormatted,
            },
            timestamp: new Date().toISOString(),
            service: 'auth-service',
          });
        },
      );

      /**
       * GET /health/version
       * Version information
       */
      router.get(
        '/version',
        healthCheckMiddleware,
        (req: Request, res: Response) => {
          res.status(200).json({
            success: true,
            version: environment.app.apiVersion || '1.0.0',
            service: 'auth-service',
            environment: environment.app.env,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            timestamp: new Date().toISOString(),
          });
        },
      );
    }

    // ✅ HANDLER DE ERRORES ESPECÍFICO PARA HEALTH CHECKS
    router.use(
      (
        error: HealthCheckError,
        req: HealthCheckRequest,
        res: Response,
        next: NextFunction,
      ): void => {
        // Si es un health check, responder rápido sin logs detallados
        if (req.isHealthCheck) {
          const statusCode = error.statusCode || 503;
          const response = {
            success: false,
            status: 'unhealthy',
            service: 'auth-service',
            error: error.message || 'Service temporarily unavailable',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            path: req.path,
          };
          res.status(statusCode).json(response);
          return;
        }
        next(error);
      },
    );

    // ✅ CATCH-ALL PARA HEALTH ROUTES NO ENCONTRADAS
    router.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        status: 'not_found',
        message: `Health endpoint ${req.originalUrl} not found`,
        availableEndpoints: environment.app.isProduction
          ? [
              '/',
              '/health',
              '/health/ready',
              '/health/live',
              '/ping',
              '/status',
              '/healthz',
            ]
          : [
              '/',
              '/health',
              '/health/ready',
              '/health/live',
              '/health/detailed',
              '/health/database',
              '/health/redis',
              '/health/dependencies',
              '/health/metrics',
              '/ping',
              '/status',
              '/healthz',
              '/uptime',
              '/version',
            ],
        timestamp: new Date().toISOString(),
      });
    });

    return router;
  }
}

// ✅ FUNCIÓN HELPER PARA OBTENER INFORMACIÓN DE ENDPOINTS DISPONIBLES
export const getAvailableHealthEndpoints = () => {
  const baseEndpoints = [
    '/health',
    '/health/ready',
    '/health/live',
    '/ping',
    '/status',
    '/healthz',
    '/health-check',
    '/health/check',
    '/health/alive',
  ];

  const developmentEndpoints = [
    '/health/detailed',
    '/health/database',
    '/health/redis',
    '/health/dependencies',
    '/health/metrics',
    '/health/cache/clear',
    '/health/cache/info',
    '/health/uptime',
    '/health/version',
  ];

  return environment.app.isProduction
    ? baseEndpoints
    : [...baseEndpoints, ...developmentEndpoints];
};

// ✅ FUNCIÓN HELPER PARA CONFIGURACIÓN DE RENDER
export const getRenderHealthConfig = () => ({
  // Configuración recomendada para render.yaml
  healthCheckPath: '/health', // ✅ Endpoint principal
  alternatives: [
    '/health/ready', // Readiness probe
    '/health/live', // Liveness probe
    '/ping', // Súper simple
    '/status', // Status básico
  ],
  timeout: 10, // 10 segundos timeout en Render
  interval: 30, // Check cada 30 segundos
  retries: 3, // 3 reintentos antes de marcar como unhealthy
});

export default HealthRoutes;
