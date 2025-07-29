// src/commons/controllers/HealthController.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { HTTP_STATUS } from '@/utils/constants';
import type { ApiResponse } from '@/utils/constants';

export class HealthController {
  /**
   * @swagger
   * /api/v1/health:
   *   get:
   *     tags: [Health]
   *     summary: Basic health check
   *     description: Quick health check endpoint for load balancers
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
   *                   example: "ok"
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                   description: Process uptime in seconds
   */
  public basicHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'auth-service',
        version: process.env.npm_package_version || '1.0.0',
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'basic_health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/health/ready:
   *   get:
   *     tags: [Health]
   *     summary: Readiness probe
   *     description: Kubernetes readiness probe - checks if service is ready to receive traffic
   *     responses:
   *       200:
   *         description: Service is ready
   *       503:
   *         description: Service is not ready
   */
  public readinessCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Aquí puedes agregar checks específicos para determinar si el servicio está listo
      // Por ejemplo: verificar conexión a base de datos, Redis, etc.
      
      const checks = {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      };

      const isReady = Object.values(checks).every(check => check.status === 'ok');

      const response: ApiResponse = {
        success: isReady,
        message: isReady ? 'Service is ready' : 'Service is not ready',
        data: {
          status: isReady ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          checks,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      const statusCode = isReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error({
        event: 'readiness_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const response: ApiResponse = {
        success: false,
        message: 'Readiness check failed',
        error: {
          code: 'READINESS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  };

  /**
   * @swagger
   * /api/v1/health/live:
   *   get:
   *     tags: [Health]
   *     summary: Liveness probe
   *     description: Kubernetes liveness probe - checks if service is alive
   *     responses:
   *       200:
   *         description: Service is alive
   *       503:
   *         description: Service is not responding
   */
  public livenessCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check básico de que el proceso está vivo
      const response = {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'liveness_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * @swagger
   * /api/v1/health/detailed:
   *   get:
   *     tags: [Health]
   *     summary: Detailed health check
   *     description: Comprehensive health check with system information (non-production only)
   *     responses:
   *       200:
   *         description: Detailed health information
   */
  public detailedHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const checks = {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
        memory: this.checkMemory(),
        disk: await this.checkDisk(),
      };

      const overallHealth = Object.values(checks).every(check => check.status === 'ok');

      const response: ApiResponse = {
        success: overallHealth,
        message: overallHealth ? 'All systems operational' : 'Some systems have issues',
        data: {
          status: overallHealth ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          checks,
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            pid: process.pid,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'detailed_health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/health/database:
   *   get:
   *     tags: [Health]
   *     summary: Database health check
   *     description: Check database connectivity and performance
   *     responses:
   *       200:
   *         description: Database is healthy
   *       503:
   *         description: Database issues detected
   */
  public databaseHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dbCheck = await this.checkDatabase();
      
      const response: ApiResponse = {
        success: dbCheck.status === 'ok',
        message: dbCheck.status === 'ok' ? 'Database is healthy' : 'Database issues detected',
        data: dbCheck,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      const statusCode = dbCheck.status === 'ok' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error({
        event: 'database_health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/health/redis:
   *   get:
   *     tags: [Health]
   *     summary: Redis health check
   *     description: Check Redis connectivity and performance
   *     responses:
   *       200:
   *         description: Redis is healthy
   *       503:
   *         description: Redis issues detected
   */
  public redisHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redisCheck = await this.checkRedis();
      
      const response: ApiResponse = {
        success: redisCheck.status === 'ok',
        message: redisCheck.status === 'ok' ? 'Redis is healthy' : 'Redis issues detected',
        data: redisCheck,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      const statusCode = redisCheck.status === 'ok' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error({
        event: 'redis_health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/health/dependencies:
   *   get:
   *     tags: [Health]
   *     summary: External dependencies health check
   *     description: Check all external dependencies
   *     responses:
   *       200:
   *         description: All dependencies are healthy
   *       503:
   *         description: Some dependencies have issues
   */
  public dependenciesHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const checks = {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
        // Aquí puedes agregar más dependencias externas
      };

      const allHealthy = Object.values(checks).every(check => check.status === 'ok');

      const response: ApiResponse = {
        success: allHealthy,
        message: allHealthy ? 'All dependencies are healthy' : 'Some dependencies have issues',
        data: {
          status: allHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          checks,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      const statusCode = allHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error({
        event: 'dependencies_health_check_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/health/metrics:
   *   get:
   *     tags: [Health]
   *     summary: System metrics
   *     description: Get system performance metrics
   *     responses:
   *       200:
   *         description: Metrics retrieved successfully
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
        },
      };

      const response: ApiResponse = {
        success: true,
        message: 'Metrics retrieved successfully',
        data: metrics,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'get_metrics_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  // Métodos privados para los checks específicos
  private async checkDatabase(): Promise<{ status: string; responseTime?: number; error?: string; info?: any }> {
    try {
      const start = Date.now();
      
      // Aquí deberías importar y usar tu cliente de Prisma
      // const { PrismaClient } = require('@prisma/client');
      // const prisma = new PrismaClient();
      // await prisma.$queryRaw`SELECT 1`;
      
      // Por ahora, simulamos el check
      const responseTime = Date.now() - start;
      
      return {
        status: 'ok',
        responseTime,
        info: {
          connected: true,
          pool: {
            // Información del pool de conexiones si está disponible
          }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }

  private async checkRedis(): Promise<{ status: string; responseTime?: number; error?: string; info?: any }> {
    try {
      const start = Date.now();
      
      // Aquí deberías importar y usar tu cliente de Redis
      // const Redis = require('ioredis');
      // const redis = new Redis(process.env.REDIS_URL);
      // await redis.ping();
      
      // Por ahora, simulamos el check
      const responseTime = Date.now() - start;
      
      return {
        status: 'ok',
        responseTime,
        info: {
          connected: true,
          mode: 'standalone' // o 'cluster' dependiendo de tu configuración
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Redis connection failed'
      };
    }
  }

  private checkMemory(): { status: string; usage: NodeJS.MemoryUsage; info?: any } {
    const usage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB como ejemplo
    const memoryUsagePercent = (usage.heapUsed / maxMemory) * 100;
    
    return {
      status: memoryUsagePercent > 90 ? 'warning' : 'ok',
      usage,
      info: {
        usagePercent: memoryUsagePercent,
        maxMemory,
        warning: memoryUsagePercent > 90 ? 'High memory usage detected' : null
      }
    };
  }

  private async checkDisk(): Promise<{ status: string; info?: any; error?: string }> {
    try {
      // En un entorno real, podrías usar librerías como 'diskusage' para obtener info del disco
      // const diskusage = require('diskusage');
      // const info = await diskusage.check('/');
      
      // Por ahora, simulamos el check
      return {
        status: 'ok',
        info: {
          available: '10GB', // Espacio disponible simulado
          used: '5GB',       // Espacio usado simulado
          total: '15GB',     // Espacio total simulado
          usagePercent: 33.3
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Disk check failed'
      };
    }
  }
}