// src/commons/routes/health.routes.ts - Task Service Health Routes
import express, { Router } from 'express';
import { HealthController } from '@/commons/controllers/HealthController';
import { asyncHandler } from '@/commons/middlewares/error.middleware';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { 
  healthRequestId, 
  healthLogger, 
  healthCache, 
  healthTimeout 
} from '@/commons/middlewares/health.middleware';

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const healthController = new HealthController();

    // Log de inicialización de rutas de health
    logger.info({
      component: 'health_routes',
      environment: config.app.env,
      productionMode: config.app.isProduction,
      event: 'health_routes_initialization'
    }, '🏥 Configurando rutas de health checks para Task Service');

    // Aplicar middlewares específicos de health
    router.use(healthRequestId);
    router.use(healthLogger);

    // === HEALTH CHECKS BÁSICOS (SIEMPRE DISPONIBLES) ===
    
    /**
     * GET /api/v1/health
     * Health check básico - ULTRA RÁPIDO para Docker health checks
     * Solo verifica que el servidor responda, no dependencias
     * Timeout: ~1ms
     */
    router.get(
      '/',
      healthCache(5), // Cache de 5 segundos
      healthTimeout(2000), // Timeout de 2 segundos
      asyncHandler(healthController.basicHealthCheck.bind(healthController))
    );

    /**
     * GET /api/v1/health/ready
     * Readiness probe - verifica dependencias con timeouts agresivos
     * Mejor para depends_on: service_healthy en Docker Compose
     * Timeout: ~5s
     */
    router.get(
      '/ready',
      healthTimeout(8000), // Timeout de 8 segundos
      asyncHandler(healthController.readinessCheck.bind(healthController))
    );

    /**
     * GET /api/v1/health/live
     * Liveness probe - solo verifica que el proceso esté vivo
     * Timeout: ~1ms
     */
    router.get(
      '/live',
      healthCache(3), // Cache de 3 segundos
      healthTimeout(2000), // Timeout de 2 segundos
      asyncHandler(healthController.livenessCheck.bind(healthController))
    );

    // === HEALTH CHECKS DETALLADOS (solo en desarrollo/staging) ===
    if (!config.app.isProduction) {
      logger.info({
        component: 'health_routes',
        environment: config.app.env,
        event: 'detailed_health_checks_enabled'
      }, '🔧 Habilitando health checks detallados para desarrollo');

      /**
       * GET /api/v1/health/detailed
       * Health check detallado con métricas del sistema
       * Solo disponible en desarrollo/staging
       */
      router.get(
        '/detailed',
        healthTimeout(15000), // Timeout de 15 segundos para checks detallados
        asyncHandler(healthController.detailedHealthCheck.bind(healthController))
      );

      /**
       * GET /api/v1/health/database
       * Health check específico de la base de datos
       */
      router.get(
        '/database',
        healthTimeout(10000), // Timeout de 10 segundos
        asyncHandler(healthController.databaseHealthCheck.bind(healthController))
      );

      /**
       * GET /api/v1/health/redis
       * Health check específico de Redis
       */
      router.get(
        '/redis',
        healthTimeout(5000), // Timeout de 5 segundos
        asyncHandler(healthController.redisHealthCheck.bind(healthController))
      );

      /**
       * GET /api/v1/health/auth-service
       * Health check específico del Auth Service
       */
      router.get(
        '/auth-service',
        healthTimeout(8000), // Timeout de 8 segundos
        asyncHandler(healthController.authServiceHealthCheck.bind(healthController))
      );

      // Endpoint de documentación de health checks (solo desarrollo)
      router.get('/docs', (req, res) => {
        res.json({
          success: true,
          message: 'Task Service Health Check Documentation',
          data: {
            service: 'task-service',
            version: config.app.apiVersion,
            environment: config.app.env,
            endpoints: {
              production: {
                basic: {
                  path: '/api/v1/health',
                  purpose: 'Ultra-fast health check for Docker',
                  timeout: '~1ms',
                  checks: ['server_response']
                },
                readiness: {
                  path: '/api/v1/health/ready',
                  purpose: 'Service readiness for traffic',
                  timeout: '~5s',
                  checks: ['database', 'redis', 'auth_service_optional', 'server']
                },
                liveness: {
                  path: '/api/v1/health/live',
                  purpose: 'Process liveness check',
                  timeout: '~1ms',
                  checks: ['memory', 'pid', 'uptime']
                }
              },
              development: {
                detailed: {
                  path: '/api/v1/health/detailed',
                  purpose: 'Complete system information',
                  timeout: '~15s',
                  checks: ['all_systems', 'metrics', 'performance']
                },
                specific: {
                  database: '/api/v1/health/database',
                  redis: '/api/v1/health/redis',
                  authService: '/api/v1/health/auth-service'
                }
              }
            },
            usage: {
              docker_compose: {
                healthcheck: 'curl -f http://localhost:3002/api/v1/health',
                depends_on: 'condition: service_healthy'
              },
              kubernetes: {
                livenessProbe: '/api/v1/health/live',
                readinessProbe: '/api/v1/health/ready'
              }
            }
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          }
        });
      });

    } else {
      logger.info({
        component: 'health_routes',
        environment: config.app.env,
        event: 'detailed_health_checks_disabled'
      }, '🔒 Health checks detallados deshabilitados en producción');

      // En producción, devolver 404 para endpoints detallados
      const productionNotFound = (req: express.Request, res: express.Response) => {
        res.status(404).json({
          success: false,
          message: 'Health check endpoint not available in production',
          error: {
            code: 'ENDPOINT_NOT_AVAILABLE_IN_PRODUCTION'
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          }
        });
      };

      router.get('/detailed', productionNotFound);
      router.get('/database', productionNotFound);
      router.get('/redis', productionNotFound);
      router.get('/auth-service', productionNotFound);
      router.get('/docs', productionNotFound);
    }

    // Log de rutas configuradas
    const availableEndpoints = ['/', '/ready', '/live'];
    const developmentEndpoints = !config.app.isProduction ? 
      ['/detailed', '/database', '/redis', '/auth-service', '/docs'] : 
      [];

    logger.info({
      component: 'health_routes',
      environment: config.app.env,
      event: 'health_routes_configured',
      endpoints: {
        production: availableEndpoints,
        development: developmentEndpoints,
        total: availableEndpoints.length + developmentEndpoints.length
      }
    }, '✅ Rutas de health checks configuradas para Task Service');

    return router;
  }
}

// Exportación por defecto para compatibilidad
const healthRoutes = HealthRoutes.routes;
export default healthRoutes;