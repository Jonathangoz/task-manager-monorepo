// src/commons/controllers/HealthController.ts - OPTIMIZADO PARA RENDER.COM
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/typeExpress/express';
import { db } from '@/config/database';
import { redisConnection } from '@/config/redis';
import { logger, createContextLogger } from '@/utils/logger';
import { HTTP_STATUS, HEALTH_CHECK_CONFIG } from '@/utils/constants';
import { environment } from '@/config/environment';

export class HealthController {
  private readonly healthLogger = createContextLogger({ component: 'health' });
  private lastHealthCheckTime = 0;
  private lastHealthCheckResult: any = null;
  private healthCheckCacheTimeout = 5000; // 5 segundos de cache

  /**
   * Health check básico - ULTRA RÁPIDO para Render health checks
   * CON CACHE para evitar sobrecarga de la BD
   */
  public async basicHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const now = Date.now();
      
      // ✅ Usar cache si el health check es reciente (< 5s)
      if (this.lastHealthCheckResult && 
          (now - this.lastHealthCheckTime) < this.healthCheckCacheTimeout) {
        
        // Respuesta desde cache - SÚPER RÁPIDA
        res.status(HTTP_STATUS.OK).json({
          success: true,
          status: 'healthy',
          service: 'auth-service',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          version: environment.app.apiVersion || '1.0.0',
          cached: true,
          cacheAge: now - this.lastHealthCheckTime
        });
      }

      // ✅ Health check con timeouts SÚPER AGRESIVOS para Render
      const checks = await Promise.allSettled([
        // Database check con timeout de solo 3 segundos
        Promise.race([
          db.$queryRaw`SELECT 1`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DB timeout')), 3000)
          )
        ]),
        
        // Redis check con timeout de solo 1 segundo (opcional)
        Promise.race([
          redisConnection.getClient().ping(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), 1000)
          )
        ])
      ]);

      const dbOk = checks[0].status === 'fulfilled';
      const redisOk = checks[1].status === 'fulfilled';
      
      // ✅ Considerar saludable si al menos la DB funciona
      const isHealthy = dbOk; // Redis es opcional
      
      const result = {
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: environment.app.apiVersion || '1.0.0',
        checks: {
          database: dbOk,
          redis: redisOk,
          server: true
        },
        cached: false
      };

      // ✅ Guardar en cache solo si está saludable
      if (isHealthy) {
        this.lastHealthCheckResult = result;
        this.lastHealthCheckTime = now;
      }

      res.status(isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Basic health check failed', { error: errorMessage });
      
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'auth-service',
        error: 'Service temporarily unavailable',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });
    }
  }

  /**
   * Readiness check - MUY RÁPIDO para evitar timeouts de Render
   */
  public async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      // ✅ Solo verificar lo mínimo indispensable
      const dbCheck = await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB timeout')), 2000) // Solo 2 segundos
        )
      ]).then(() => true).catch(() => false);

      const isReady = dbCheck; // Solo requerir BD

      res.status(isReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: isReady,
        status: isReady ? 'ready' : 'not_ready',
        service: 'auth-service',
        checks: {
          database: dbCheck,
          server: true
        },
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthLogger.error('Readiness check failed', { error: errorMessage });
      
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'not_ready',
        error: 'Service not ready',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Liveness check - INSTANTÁNEO, solo verifica que el proceso esté vivo
   */
  public async livenessCheck(req: Request, res: Response): Promise<void> {
    try {
      // ✅ Sin verificaciones externas - solo proceso
      const memUsage = process.memoryUsage();
      const isAlive = process.uptime() > 0;
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'alive',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        pid: process.pid
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'dead',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Health check detallado - Solo para desarrollo
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
      const isHealthy = checks.database.status; // Solo requerir BD

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
   * Database-specific health check - CON TIMEOUT OPTIMIZADO
   */
  public async databaseHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      await Promise.race([
        db.$queryRaw`SELECT 1 as status, version() as version, now() as timestamp`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 8000) // Más tiempo para queries detalladas
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
   * Redis-specific health check - CON TIMEOUT OPTIMIZADO
   */
  public async redisHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const redisClient = redisConnection.getClient();
      
      await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis timeout')), 3000) // 3 segundos max
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
   * Dependencies health check - PARALELO Y RÁPIDO
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

      // ✅ Considerar saludable si al menos la BD funciona
      const allHealthy = results.database.status; // Redis es opcional

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
   * System metrics - LIGERO
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

  // ✅ Helper methods OPTIMIZADOS
  private async checkDatabaseConnection(): Promise<{ status: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 4000) // 4s max
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
          setTimeout(() => reject(new Error('Redis timeout')), 2000) // 2s max
        )
      ]);
      return { status: redisConnection.isHealthy(), responseTime: Date.now() - startTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
      return { status: false, responseTime: Date.now() - startTime, error: errorMessage };
    }
  }
}