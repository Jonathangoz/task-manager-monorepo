// src/commons/controllers/HealthController.ts
import { Request, Response } from 'express';
import { healthService } from '@/core/application/HealthService';
import { createContextLogger } from '@/utils/logger';
import { HTTP_STATUS } from '@/utils/constants';
import { environment } from '@/config/environment';

export class HealthController {
  private readonly healthLogger = createContextLogger({
    component: 'health-controller',
  });

  /**
   * Health check básico - ULTRA RÁPIDO para Render health checks
   * Endpoint: GET /health, GET /, GET /healthz
   */
  public async basicHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await healthService.getBasicHealth();
      const statusCode =
        healthStatus.status === 'healthy'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      this.healthLogger.error('Basic health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'auth-service',
        error: 'Health check service unavailable',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    }
  }

  /**
   * Readiness check - Para Render readiness probe
   * Endpoint: GET /health/ready
   */
  public async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await healthService.getReadinessHealth();
      const statusCode =
        healthStatus.status === 'healthy'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      this.healthLogger.error('Readiness check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'not_ready',
        service: 'auth-service',
        error: 'Service not ready',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    }
  }

  /**
   * Liveness check - INSTANTÁNEO, solo verifica que el proceso esté vivo
   * Endpoint: GET /health/live
   */
  public async livenessCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await healthService.getLivenessHealth();
      const statusCode =
        healthStatus.status === 'healthy'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      this.healthLogger.error('Liveness check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'dead',
        service: 'auth-service',
        error: 'Process not responding',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    }
  }

  /**
   * Health check detallado - Solo para desarrollo/debugging
   * Endpoint: GET /health/detailed
   */
  public async detailedHealthCheck(
    req: Request,
    res: Response,
  ): Promise<Response | void> {
    // ✅ BLOQUEAR EN PRODUCCIÓN
    if (environment.app.isProduction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
    }

    try {
      const healthStatus = await healthService.getDetailedHealth();
      const statusCode =
        healthStatus.status === 'healthy'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      this.healthLogger.error('Detailed health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'auth-service',
        error: 'Detailed health check failed',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    }
  }

  /**
   * Database-specific health check
   * Endpoint: GET /health/database
   */
  public async databaseHealthCheck(req: Request, res: Response): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      const dbCheck = await healthService.checkDatabaseQuick();
      const statusCode =
        dbCheck.status === 'healthy'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json({
        success: dbCheck.status === 'healthy',
        status: dbCheck.status,
        service: 'database',
        responseTime: dbCheck.responseTime,
        message: dbCheck.message,
        error: dbCheck.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.healthLogger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        service: 'database',
        error: 'Database health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Redis-specific health check
   * Endpoint: GET /health/redis
   */
  public async redisHealthCheck(req: Request, res: Response): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      const redisCheck = await healthService.checkRedisQuick();
      // ✅ Redis puede estar degraded pero aún ser OK (es opcional)
      const statusCode =
        redisCheck.status === 'unhealthy'
          ? HTTP_STATUS.SERVICE_UNAVAILABLE
          : HTTP_STATUS.OK;

      res.status(statusCode).json({
        success: redisCheck.status !== 'unhealthy',
        status: redisCheck.status,
        service: 'redis',
        responseTime: redisCheck.responseTime,
        message: redisCheck.message,
        error: redisCheck.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.healthLogger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.OK).json({
        // ✅ OK porque Redis es opcional
        success: true,
        status: 'degraded',
        service: 'redis',
        message: 'Redis is optional and currently unavailable',
        error: 'Redis health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Dependencies health check
   * Endpoint: GET /health/dependencies
   */
  public async dependenciesHealthCheck(
    req: Request,
    res: Response,
  ): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      // ✅ Verificar dependencias en paralelo
      const [dbCheck, redisCheck] = await Promise.allSettled([
        healthService.checkDatabaseQuick(),
        healthService.checkRedisQuick(),
      ]);

      const dependencies = {
        database:
          dbCheck.status === 'fulfilled'
            ? dbCheck.value
            : {
                name: 'database',
                status: 'unhealthy' as const,
                error:
                  dbCheck.status === 'rejected'
                    ? dbCheck.reason?.message
                    : 'Unknown error',
                lastChecked: new Date().toISOString(),
              },
        redis:
          redisCheck.status === 'fulfilled'
            ? redisCheck.value
            : {
                name: 'redis',
                status: 'degraded' as const, // ✅ Redis es opcional
                error:
                  redisCheck.status === 'rejected'
                    ? redisCheck.reason?.message
                    : 'Unknown error',
                lastChecked: new Date().toISOString(),
              },
      };

      // ✅ Solo requerir base de datos para estar saludable
      const isHealthy = dependencies.database.status === 'healthy';
      const statusCode = isHealthy
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res.status(statusCode).json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        dependencies,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.healthLogger.error('Dependencies health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'unhealthy',
        error: 'Dependencies health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * System metrics
   * Endpoint: GET /health/metrics
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      const healthStatus = await healthService.getDetailedHealth();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        metrics: healthStatus.metrics,
        cacheInfo: healthService.getCacheInfo(),
        serviceReady: healthService.isReady(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.healthLogger.error('Metrics collection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        error: 'Metrics collection failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Ping endpoint - SÚPER SIMPLE para verificaciones rápidas
   * Endpoint: GET /ping
   */
  public async ping(req: Request, res: Response): Promise<void> {
    try {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        status: 'pong',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: environment.app.apiVersion || '1.0.0',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown redis error';
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'error',
        error: 'Ping failed',
        timestamp: new Date().toISOString(),
        errorMessage,
      });
    }
  }

  /**
   * Status endpoint - SIMPLE sin verificaciones externas
   * Endpoint: GET /status
   */
  public async status(req: Request, res: Response): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      res.status(HTTP_STATUS.OK).json({
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
        ready: healthService.isReady(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown redis error';
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        status: 'error',
        error: 'Status check failed',
        timestamp: new Date().toISOString(),
        errorMessage,
      });
    }
  }

  /**
   * Cache management endpoints (solo desarrollo)
   */
  public async clearCache(req: Request, res: Response): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      healthService.clearCache();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Health check cache cleared',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown redis error';
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to clear cache',
        timestamp: new Date().toISOString(),
        errorMessage,
      });
    }
  }

  public async getCacheInfo(req: Request, res: Response): Promise<void> {
    if (environment.app.isProduction) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    try {
      const cacheInfo = healthService.getCacheInfo();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        cache: cacheInfo,
        serviceReady: healthService.isReady(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown redis error';
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get cache info',
        timestamp: new Date().toISOString(),
        errorMessage,
      });
    }
  }
}
