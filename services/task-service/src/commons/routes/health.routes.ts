// src/presentation/routes/health.routes.ts
import { Router, Request, Response } from 'express';
import { db } from '@/config/database';
import { taskRedisConnection } from '@/config/redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { HTTP_STATUS } from '@/utils/constants';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    authService?: {
      status: 'up' | 'down' | 'unknown';
      responseTime?: number;
      error?: string;
    };
  };
}

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
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
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'task-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: config.app.env,
    checks: {
      database: { status: 'down' },
      redis: { status: 'down' }
    }
  };

  // Check Database
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    healthStatus.checks.database = {
      status: 'up',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    healthStatus.checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
    healthStatus.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const redisClient = taskRedisConnection.getClient();
    await redisClient.ping();
    healthStatus.checks.redis = {
      status: 'up',
      responseTime: Date.now() - redisStart
    };
  } catch (error) {
    healthStatus.checks.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown Redis error'
    };
    // Redis failure is not critical, mark as degraded
    if (healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }
  }

  // Optional: Check Auth Service (uncomment if needed)
  /*
  try {
    const authStart = Date.now();
    const response = await axios.get(`${config.auth.serviceUrl}/api/v1/health`, {
      timeout: 3000
    });
    
    healthStatus.checks.authService = {
      status: response.status === 200 ? 'up' : 'down',
      responseTime: Date.now() - authStart
    };
  } catch (error) {
    healthStatus.checks.authService = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Auth service unreachable'
    };
    // External service failure is not critical
    if (healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }
  }
  */

  // Log health check results
  logger.info({
    healthStatus,
    responseTime: Date.now() - startTime
  }, 'Health check completed');

  // Set appropriate HTTP status
  const httpStatus = healthStatus.status === 'healthy' 
    ? HTTP_STATUS.OK 
    : healthStatus.status === 'degraded' 
      ? HTTP_STATUS.OK 
      : HTTP_STATUS.SERVICE_UNAVAILABLE;

  res.status(httpStatus).json(healthStatus);
});

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness probe for Kubernetes/Docker
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if essential services are available
    await db.$queryRaw`SELECT 1`;
    
    res.status(HTTP_STATUS.OK).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'task-service'
    });
  } catch (error) {
    logger.error({ error }, 'Readiness check failed');
    
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      service: 'task-service',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Liveness probe for Kubernetes/Docker
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req: Request, res: Response): void => {
  res.status(HTTP_STATUS.OK).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'task-service',
    uptime: process.uptime(),
    pid: process.pid
  });
});

export default router;