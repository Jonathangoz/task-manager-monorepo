// ==============================================
// src/presentation/routes/health.routes.ts - Production Ready Health Check Routes
// Rutas de health check optimizadas con logging estructurado, métricas y coherencia
// ==============================================

import { Router, Request, Response } from 'express';
import { taskDatabase, databaseHealthCheck } from '@/config/database';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger, loggers, healthCheck, logError } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  EVENT_TYPES,
  SERVICE_NAMES 
} from '@/utils/constants';

const router = Router();

// ==============================================
// TYPES & INTERFACES
// ==============================================
interface HealthCheckResult {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface DetailedHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    authService?: HealthCheckResult;
  };
  metrics?: {
    totalResponseTime: number;
    criticalServices: number;
    healthyServices: number;
    degradedServices: number;
  };
}

interface ReadinessStatus {
  status: 'ready' | 'not-ready';
  timestamp: string;
  service: string;
  checks: {
    database: boolean;
    redis?: boolean;
  };
  error?: string;
}

interface LivenessStatus {
  status: 'alive';
  timestamp: string;
  service: string;
  uptime: number;
  pid: number;
  memory: {
    used: number;
    free: number;
    total: number;
  };
}

// ==============================================
// HEALTH CHECK SERVICE CLASS
// ==============================================
class HealthCheckService {
  private readonly serviceName = SERVICE_NAMES.TASK_SERVICE;
  private readonly serviceVersion = process.env.npm_package_version || '1.0.0';

  /**
   * Realiza health check de la base de datos
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const healthResult = await databaseHealthCheck();
      const responseTime = Date.now() - startTime;

      if (healthResult.healthy) {
        loggers.dbConnection('health_check_passed', { 
          responseTime, 
          details: healthResult.details 
        });

        return {
          status: 'up',
          responseTime,
          details: healthResult.details
        };
      } else {
        loggers.dbConnection('health_check_failed', { 
          responseTime, 
          error: healthResult.details?.error 
        });

        return {
          status: 'down',
          responseTime,
          error: healthResult.details?.error || 'Database health check failed'
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

      loggers.dbError(error as Error, 'health_check_database');
      
      return {
        status: 'down',
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Realiza health check de Redis
   */
  async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const healthResult = await taskRedisConnection.healthCheck();
      const responseTime = Date.now() - startTime;

      if (healthResult.status === 'healthy') {
        logger.debug({
          event: EVENT_TYPES.CACHE_HIT,
          component: 'redis',
          responseTime,
          details: healthResult
        }, 'Redis health check passed');

        return {
          status: 'up',
          responseTime,
          details: {
            latency: healthResult.latency,
            memory: healthResult.memory,
            connections: healthResult.connections
          }
        };
      } else {
        logger.warn({
          event: EVENT_TYPES.CACHE_ERROR,
          component: 'redis',
          responseTime,
          details: healthResult
        }, 'Redis health check failed');

        return {
          status: 'down',
          responseTime,
          error: 'Redis health check failed',
          details: healthResult
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';

      logger.error({
        error,
        event: EVENT_TYPES.CACHE_ERROR,
        component: 'redis',
        responseTime
      }, 'Redis health check error');

      return {
        status: 'down',
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Realiza health check del servicio de autenticación (opcional)
   */
  async checkAuthService(): Promise<HealthCheckResult> {
    // Esta implementación se puede agregar cuando sea necesario
    // Por ahora retornamos un resultado neutral
    return {
      status: 'up',
      responseTime: 0,
      details: { message: 'Auth service check not implemented' }
    };
  }

  /**
   * Determina el estado general del servicio basado en los checks individuales
   */
  determineOverallStatus(checks: DetailedHealthStatus['checks']): DetailedHealthStatus['status'] {
    const { database, redis } = checks;

    // La base de datos es crítica
    if (database.status === 'down') {
      return 'unhealthy';
    }

    // Redis es importante pero no crítico
    if (redis.status === 'down') {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Calcula métricas del health check
   */
  calculateMetrics(checks: DetailedHealthStatus['checks']): DetailedHealthStatus['metrics'] {
    const services = Object.values(checks);
    const totalResponseTime = services.reduce((sum, check) => sum + (check.responseTime || 0), 0);
    
    let healthyServices = 0;
    let degradedServices = 0;
    let criticalServices = 0;

    services.forEach(check => {
      if (check.status === 'up') {
        healthyServices++;
      } else {
        if (check === checks.database) {
          criticalServices++; // Database es crítico
        } else {
          degradedServices++; // Otros servicios son degradados
        }
      }
    });

    return {
      totalResponseTime,
      criticalServices,
      healthyServices,
      degradedServices
    };
  }

  /**
   * Obtiene información de memoria del proceso
   */
  getMemoryUsage(): LivenessStatus['memory'] {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    return {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      free: Math.round(freeMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024) // MB
    };
  }
}

// ==============================================
// INSTANCIA DEL SERVICIO
// ==============================================
const healthCheckService = new HealthCheckService();

// ==============================================
// ROUTES
// ==============================================

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Comprehensive health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy, degraded]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 environment:
 *                   type: string
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [up, down]
 *                         responseTime:
 *                           type: number
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [up, down]
 *                         responseTime:
 *                           type: number
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalResponseTime:
 *                       type: number
 *                     criticalServices:
 *                       type: number
 *                     healthyServices:
 *                       type: number
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestStartTime = Date.now();
  
  try {
    // Realizar todos los health checks en paralelo para mejor performance
    const [databaseCheck, redisCheck] = await Promise.allSettled([
      healthCheckService.checkDatabase(),
      healthCheckService.checkRedis(),
      // healthCheckService.checkAuthService() // Descomentear cuando sea necesario
    ]);

    // Procesar resultados de los checks
    const checks: DetailedHealthStatus['checks'] = {
      database: databaseCheck.status === 'fulfilled' 
        ? databaseCheck.value 
        : { status: 'down', error: 'Database check failed' },
      redis: redisCheck.status === 'fulfilled' 
        ? redisCheck.value 
        : { status: 'down', error: 'Redis check failed' }
    };

    // Construir respuesta completa
    const healthStatus: DetailedHealthStatus = {
      status: healthCheckService.determineOverallStatus(checks),
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      version: healthCheckService['serviceVersion'],
      uptime: process.uptime(),
      environment: config.app.env,
      checks,
      metrics: healthCheckService.calculateMetrics(checks)
    };

    const totalResponseTime = Date.now() - requestStartTime;

    // Log estructurado del health check
    logger.info({
      healthStatus,
      responseTime: totalResponseTime,
      event: EVENT_TYPES.CACHE_HIT, // Reutilizamos este event type
      domain: 'health_check',
      requestId: req.headers['x-request-id']
    }, `🏥 Health check completed: ${healthStatus.status}`);

    // Registrar métricas en el health check tracker
    if (healthStatus.status === 'healthy') {
      healthCheck.passed('overall_health', totalResponseTime, healthStatus);
    } else if (healthStatus.status === 'degraded') {
      healthCheck.degraded('overall_health', 'Some services degraded', totalResponseTime);
    } else {
      healthCheck.failed('overall_health', new Error('Critical services down'), totalResponseTime);
    }

    // Determinar código de estado HTTP
    const httpStatus = healthStatus.status === 'unhealthy' 
      ? HTTP_STATUS.SERVICE_UNAVAILABLE
      : HTTP_STATUS.OK;

    res.status(httpStatus).json(healthStatus);

  } catch (error) {
    const totalResponseTime = Date.now() - requestStartTime;
    
    logError.high(error as Error, {
      context: 'health_check_endpoint',
      responseTime: totalResponseTime,
      requestId: req.headers['x-request-id']
    });

    const errorResponse: DetailedHealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      version: healthCheckService['serviceVersion'],
      uptime: process.uptime(),
      environment: config.app.env,
      checks: {
        database: { status: 'down', error: 'Health check failed' },
        redis: { status: 'down', error: 'Health check failed' }
      }
    };

    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Kubernetes/Docker readiness probe
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ready]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Para readiness, solo verificamos servicios críticos
    const databaseReady = await taskDatabase.isHealthy();
    
    if (!databaseReady) {
      // Intentar un health check rápido
      await healthCheckService.checkDatabase();
    }

    const readinessStatus: ReadinessStatus = {
      status: databaseReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      checks: {
        database: databaseReady,
        redis: taskRedisConnection.isHealthy() // Opcional para readiness
      }
    };

    const responseTime = Date.now() - startTime;

    logger.debug({
      readinessStatus,
      responseTime,
      event: 'readiness_check',
      domain: 'health_check',
      requestId: req.headers['x-request-id']
    }, `🚦 Readiness check: ${readinessStatus.status}`);

    if (readinessStatus.status === 'ready') {
      res.status(HTTP_STATUS.OK).json(readinessStatus);
    } else {
      readinessStatus.error = ERROR_MESSAGES.DATABASE_ERROR;
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(readinessStatus);
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logError.medium(error as Error, {
      context: 'readiness_check',
      responseTime,
      requestId: req.headers['x-request-id']
    });

    const errorResponse: ReadinessStatus = {
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      checks: {
        database: false,
        redis: false
      },
      error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR
    };

    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Kubernetes/Docker liveness probe
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [alive]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 pid:
 *                   type: number
 *                 memory:
 *                   type: object
 */
router.get('/live', (req: Request, res: Response): void => {
  const startTime = Date.now();
  
  try {
    const livenessStatus: LivenessStatus = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      uptime: process.uptime(),
      pid: process.pid,
      memory: healthCheckService.getMemoryUsage()
    };

    const responseTime = Date.now() - startTime;

    // Solo log en debug para liveness (se llama frecuentemente)
    logger.debug({
      livenessStatus,
      responseTime,
      event: 'liveness_check',
      domain: 'health_check'
    }, '💓 Liveness check completed');

    res.status(HTTP_STATUS.OK).json(livenessStatus);

  } catch (error) {
    // El liveness check nunca debería fallar, pero por precaución
    logError.critical(error as Error, {
      context: 'liveness_check',
      pid: process.pid,
      uptime: process.uptime()
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE,
      error: 'Liveness check failed'
    });
  }
});

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     summary: Detailed health check with metrics (admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health information
 *       403:
 *         description: Access denied
 */
router.get('/detailed', async (req: Request, res: Response): Promise<void> => {
  // Este endpoint podría requerir autenticación admin en el futuro
  // Por ahora devolvemos información detallada
  
  const startTime = Date.now();
  
  try {
    // Obtener información detallada del sistema
    const [databaseMetrics, memoryUsage] = await Promise.allSettled([
      import('@/config/database').then(db => db.getDatabaseMetrics()),
      Promise.resolve(healthCheckService.getMemoryUsage())
    ]);

    const detailedInfo = {
      service: SERVICE_NAMES.TASK_SERVICE,
      version: healthCheckService['serviceVersion'],
      environment: config.app.env,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: memoryUsage.status === 'fulfilled' ? memoryUsage.value : null,
      database: databaseMetrics.status === 'fulfilled' ? databaseMetrics.value : null,
      configuration: {
        nodeEnv: config.app.env,
        port: config.app.port,
        apiVersion: config.app.apiVersion,
        features: config.features
      },
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    const responseTime = Date.now() - startTime;

    logger.info({
      detailedInfo,
      responseTime,
      event: 'detailed_health_check',
      domain: 'health_check',
      requestId: req.headers['x-request-id']
    }, '🔍 Detailed health check completed');

    res.status(HTTP_STATUS.OK).json(detailedInfo);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logError.medium(error as Error, {
      context: 'detailed_health_check',
      responseTime,
      requestId: req.headers['x-request-id']
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
      service: SERVICE_NAMES.TASK_SERVICE
    });
  }
});

// ==============================================
// EXPORTACIÓN
// ==============================================
export default router;

// Export del servicio para testing
export { HealthCheckService, healthCheckService };