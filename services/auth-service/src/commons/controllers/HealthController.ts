// src/commons/controllers/HealthController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/typeExpress/express';
import { db } from '@/config/database';
import { redisConnection } from '@/config/redis';
import { logger, createContextLogger } from '@/utils/logger';
import { HTTP_STATUS, HEALTH_CHECK_CONFIG } from '@/utils/constants';
import { environment } from '@/config/environment';

export class HealthController {
  private readonly healthLogger = createContextLogger({ component: 'health' });

  /**
   * Health check básico - ULTRA RÁPIDO para Docker health checks
   * No verifica dependencias, solo que el servidor esté respondiendo
   */
  public async basicHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Respuesta inmediata sin verificar dependencias
      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: environment.app.apiVersion || '1.0.0'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Basic health check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        error: 'Service unavailable'
      });
    }
  }

  /**
   * Readiness check - Verifica si el servicio está listo para recibir tráfico
   * Con timeouts agresivos para evitar bloqueos
   */
  public async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      const checks = {
        database: false,
        redis: false,
        server: true // El servidor está funcionando si llegamos aquí
      };

      // Check database con timeout muy corto
      try {
        const dbPromise = db.$queryRaw`SELECT 1`;
        const dbResult = await Promise.race([
          dbPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DB timeout')), 2000) // 2s timeout
          )
        ]);
        checks.database = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
        this.healthLogger.warn('Database readiness check failed', { error: errorMessage });
        checks.database = false;
      }

      // Check Redis con timeout muy corto
      try {
        const redisClient = redisConnection.getClient();
        const redisPromise = redisClient.ping();
        await Promise.race([
          redisPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), 1000) // 1s timeout
          )
        ]);
        checks.redis = redisConnection.isHealthy();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
        this.healthLogger.warn('Redis readiness check failed', { error: errorMessage });
        checks.redis = false;
      }

      const isReady = checks.database && checks.redis && checks.server;
      
      res.status(isReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: isReady,
        status: isReady ? 'ready' : 'not_ready',
        service: 'auth-service',
        checks,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Readiness check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'not_ready',
        error: 'Readiness check failed'
      });
    }
  }

  /**
   * Liveness check - Solo verifica que el proceso esté vivo
   */
  public async livenessCheck(req: Request, res: Response): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const isAlive = process.uptime() > 0 && memUsage.heapUsed > 0;
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'alive',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
        },
        pid: process.pid
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Liveness check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'dead',
        error: 'Process check failed'
      });
    }
  }

  /**
   * Health check detallado - Solo para desarrollo/debugging
   */
  public async detailedHealthCheck(req: Request, res: Response): Promise<Response | void> {
    if (environment.app.isProduction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production'
      });
    }

    try {
      const startTime = Date.now();
      const checks = {
        database: { status: false, responseTime: 0, error: null as string | null },
        redis: { status: false, responseTime: 0, error: null as string | null },
        server: { status: true, responseTime: 0, error: null as string | null }
      };

      // Database check con métricas
      try {
        const dbStart = Date.now();
        await Promise.race([
          db.$queryRaw`SELECT 1`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout')), 5000)
          )
        ]);
        checks.database.status = true;
        checks.database.responseTime = Date.now() - dbStart;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
        checks.database.error = errorMessage;
        checks.database.responseTime = Date.now() - startTime;
      }

      // Redis check con métricas
      try {
        const redisStart = Date.now();
        const redisClient = redisConnection.getClient();
        await Promise.race([
          redisClient.ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), 3000)
          )
        ]);
        checks.redis.status = redisConnection.isHealthy();
        checks.redis.responseTime = Date.now() - redisStart;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
        checks.redis.error = errorMessage;
        checks.redis.responseTime = Date.now() - startTime;
      }

      const memUsage = process.memoryUsage();
      const isHealthy = checks.database.status && checks.redis.status;

      res.status(isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks,
        metrics: {
          uptime: process.uptime(),
          responseTime: Date.now() - startTime,
          memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          },
          cpu: process.cpuUsage(),
          pid: process.pid,
          platform: process.platform,
          nodeVersion: process.version
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Detailed health check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Database-specific health check
   */
  public async databaseHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      await Promise.race([
        db.$queryRaw`SELECT 1 as status, version() as version, now() as timestamp`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 10000)
        )
      ]);

      const responseTime = Date.now() - startTime;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'healthy',
        service: 'database',
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.healthLogger.error('Database health check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'database',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Redis-specific health check
   */
  public async redisHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const redisClient = redisConnection.getClient();
      
      await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis timeout')), 5000)
        )
      ]);

      const responseTime = Date.now() - startTime;
      const isHealthy = redisConnection.isHealthy();

      res.status(isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'redis',
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
      this.healthLogger.error('Redis health check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'redis',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Dependencies health check
   */
  public async dependenciesHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const checks = await Promise.allSettled([
        this.checkDatabaseConnection(),
        this.checkRedisConnection()
      ]);

      const results = {
        database: checks[0].status === 'fulfilled' ? checks[0].value : { status: false, error: checks[0].reason?.message || 'Unknown error' },
        redis: checks[1].status === 'fulfilled' ? checks[1].value : { status: false, error: checks[1].reason?.message || 'Unknown error' }
      };

      const allHealthy = Object.values(results).every(result => result.status);

      res.status(allHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: allHealthy,
        status: allHealthy ? 'healthy' : 'degraded',
        dependencies: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Dependencies health check failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * System metrics
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        metrics: {
          process: {
            uptime: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version
          },
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Metrics collection failed', { error: errorMessage });
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper methods
  private async checkDatabaseConnection(): Promise<{ status: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      return { status: true, responseTime: Date.now() - startTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return { status: false, responseTime: Date.now() - startTime, error: errorMessage };
    }
  }

  private async checkRedisConnection(): Promise<{ status: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    try {
      const redisClient = redisConnection.getClient();
      await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis timeout')), 3000)
        )
      ]);
      return { status: redisConnection.isHealthy(), responseTime: Date.now() - startTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
      return { status: false, responseTime: Date.now() - startTime, error: errorMessage };
    }
  }
}