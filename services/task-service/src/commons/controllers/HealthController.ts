// src/commons/controllers/HealthController.ts - Task Service
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client'; // ✅ Added missing import
import { taskDatabase } from '@/config/database';
import { taskRedisConnection } from '@/config/redis';
import { logger, healthCheck, logError } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  SERVICE_NAMES,
  EVENT_TYPES,
  ApiResponse
} from '@/utils/constants';
import { config } from '@/config/environment';
import axios from 'axios';

// Interfaz para el resultado de health checks
interface HealthCheckResult {
  status: boolean;
  responseTime: number;
  error?: string;
  details?: any;
}

// Interfaz para métricas del sistema
interface SystemMetrics {
  uptime: number;
  responseTime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu: NodeJS.CpuUsage;
  pid: number;
  platform: string;
  nodeVersion: string;
}

export class HealthController {
  private readonly serviceName = SERVICE_NAMES.TASK_SERVICE;

  /**
   * Health check básico - ULTRA RÁPIDO para Docker health checks
   * No verifica dependencias, solo que el servidor esté respondiendo
   */
  public async basicHealthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response: ApiResponse = {
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'healthy',
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          version: config.app.apiVersion
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      healthCheck.passed('basic', Date.now() - startTime);
      res.status(HTTP_STATUS.OK).json(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'basic'
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
        error: {
          code: ERROR_CODES.SERVICE_UNAVAILABLE,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Readiness check - Verifica si el servicio está listo para recibir tráfico
   * Con timeouts agresivos para evitar bloqueos
   */
  public async readinessCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const checks = {
        database: false,
        redis: false,
        authService: false,
        server: true // El servidor está funcionando si llegamos aquí
      };

      // Check database con timeout muy corto
      const dbResult = await this.checkDatabaseConnection();
      checks.database = dbResult.status;

      // Check Redis con timeout muy corto
      const redisResult = await this.checkRedisConnection();
      checks.redis = redisResult.status;

      // Check Auth Service con timeout (opcional para readiness)
      const authResult = await this.checkAuthServiceConnection();
      checks.authService = authResult.status;

      // Para task-service, consideramos que está listo si database y redis están OK
      // Auth service es opcional para readiness
      const isReady = checks.database && checks.redis && checks.server;
      const responseTime = Date.now() - startTime;
      
      const response: ApiResponse = {
        success: isReady,
        message: isReady ? 'Service is ready' : 'Service is not ready',
        data: {
          status: isReady ? 'ready' : 'not_ready',
          service: this.serviceName,
          checks,
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          responseTime
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      if (isReady) {
        healthCheck.passed('readiness', responseTime, { checks });
      } else {
        healthCheck.degraded('readiness', 'Some dependencies are not available', responseTime);
      }

      res.status(isReady ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'readiness',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
        error: {
          code: ERROR_CODES.SERVICE_UNAVAILABLE,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Liveness check - Solo verifica que el proceso esté vivo
   */
  public async livenessCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const isAlive = process.uptime() > 0 && memUsage.heapUsed > 0;
      const responseTime = Date.now() - startTime;
      
      const response: ApiResponse = {
        success: true,
        message: 'Service is alive',
        data: {
          status: 'alive',
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          responseTime,
          memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
          },
          pid: process.pid
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      healthCheck.passed('liveness', responseTime, { 
        memory: response.data.memory,
        pid: response.data.pid 
      });
      
      res.status(HTTP_STATUS.OK).json(response);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.critical(error as Error, { 
        component: 'health_controller',
        check: 'liveness',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: 'Process check failed',
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Health check detallado - Solo para desarrollo/debugging
   */
  public async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    // Solo disponible en desarrollo
    if (config.app.isProduction) {
      const response: ApiResponse = {
        success: false,
        message: 'Endpoint not available in production',
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };
      
      res.status(HTTP_STATUS.NOT_FOUND).json(response);
      return; // ✅ Added return statement
    }

    const startTime = Date.now();
    
    try {
      const checks = {
        database: { status: false, responseTime: 0, error: null as string | null },
        redis: { status: false, responseTime: 0, error: null as string | null },
        authService: { status: false, responseTime: 0, error: null as string | null },
        server: { status: true, responseTime: 0, error: null as string | null }
      };

      // Database check con métricas
      const dbResult = await this.checkDatabaseConnection();
      checks.database = {
        status: dbResult.status,
        responseTime: dbResult.responseTime,
        error: dbResult.error || null
      };

      // Redis check con métricas
      const redisResult = await this.checkRedisConnection();
      checks.redis = {
        status: redisResult.status,
        responseTime: redisResult.responseTime,
        error: redisResult.error || null
      };

      // Auth Service check con métricas
      const authResult = await this.checkAuthServiceConnection();
      checks.authService = {
        status: authResult.status,
        responseTime: authResult.responseTime,
        error: authResult.error || null
      };

      const systemMetrics = this.getSystemMetrics();
      const isHealthy = checks.database.status && checks.redis.status;
      const responseTime = Date.now() - startTime;

      const response: ApiResponse = {
        success: isHealthy,
        message: isHealthy ? 'Service is healthy' : 'Service is degraded',
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          service: this.serviceName,
          version: config.app.apiVersion,
          environment: config.app.env,
          checks,
          metrics: systemMetrics,
          timestamp: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      if (isHealthy) {
        healthCheck.passed('detailed', responseTime, { checks, metrics: systemMetrics });
      } else {
        healthCheck.degraded('detailed', 'Some dependencies are failing', responseTime);
      }

      res.status(isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'detailed',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.INTERNAL_ERROR,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Database-specific health check
   */
  public async databaseHealthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkDatabaseConnection();
      
      const response: ApiResponse = {
        success: result.status,
        message: result.status ? 'Database is healthy' : 'Database is unhealthy',
        data: {
          status: result.status ? 'healthy' : 'unhealthy',
          service: 'database',
          responseTime: result.responseTime,
          timestamp: new Date().toISOString(),
          details: result.details
        },
        error: result.error ? {
          code: ERROR_CODES.DATABASE_ERROR,
          details: config.app.isDevelopment ? { message: result.error } : undefined
        } : undefined,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      if (result.status) {
        healthCheck.passed('database', result.responseTime);
      } else {
        healthCheck.failed('database', new Error(result.error || 'Database check failed'), result.responseTime);
      }

      res.status(result.status ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'database',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.DATABASE_ERROR,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Redis-specific health check
   */
  public async redisHealthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkRedisConnection();
      
      const response: ApiResponse = {
        success: result.status,
        message: result.status ? 'Redis is healthy' : 'Redis is unhealthy',
        data: {
          status: result.status ? 'healthy' : 'unhealthy',
          service: 'redis',
          responseTime: result.responseTime,
          timestamp: new Date().toISOString(),
          details: result.details
        },
        error: result.error ? {
          code: ERROR_CODES.REDIS_ERROR,
          details: config.app.isDevelopment ? { message: result.error } : undefined
        } : undefined,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      if (result.status) {
        healthCheck.passed('redis', result.responseTime);
      } else {
        healthCheck.failed('redis', new Error(result.error || 'Redis check failed'), result.responseTime);
      }

      res.status(result.status ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'redis',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.REDIS_ERROR,
        error: {
          code: ERROR_CODES.REDIS_ERROR,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  /**
   * Auth Service-specific health check
   */
  public async authServiceHealthCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkAuthServiceConnection();
      
      const response: ApiResponse = {
        success: result.status,
        message: result.status ? 'Auth Service is healthy' : 'Auth Service is unhealthy',
        data: {
          status: result.status ? 'healthy' : 'unhealthy',
          service: 'auth-service',
          responseTime: result.responseTime,
          timestamp: new Date().toISOString(),
          details: result.details
        },
        error: result.error ? {
          code: ERROR_CODES.AUTH_SERVICE_ERROR,
          details: config.app.isDevelopment ? { message: result.error } : undefined
        } : undefined,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      if (result.status) {
        healthCheck.passed('auth-service', result.responseTime);
      } else {
        healthCheck.failed('auth-service', new Error(result.error || 'Auth service check failed'), result.responseTime);
      }

      res.status(result.status ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      
      logError.high(error as Error, { 
        component: 'health_controller',
        check: 'auth-service',
        responseTime
      });
      
      const response: ApiResponse = {
        success: false,
        message: ERROR_MESSAGES.AUTH_SERVICE_ERROR,
        error: {
          code: ERROR_CODES.AUTH_SERVICE_ERROR,
          details: config.app.isDevelopment ? { originalError: errorMessage } : undefined
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string
        }
      };

      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }
  }

  // Helper methods
  private async checkDatabaseConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // ✅ FIXED: Get the Prisma client from TaskDatabase and use proper Prisma.sql
      const prismaClient = taskDatabase.getClient();
      await Promise.race([
        // Using Prisma.sql template literal for type safety
        prismaClient.$queryRaw(Prisma.sql`SELECT 1 as status, version() as version, now() as timestamp`),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      
      return { 
        status: true, 
        responseTime: Date.now() - startTime,
        details: { connected: true }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return { 
        status: false, 
        responseTime: Date.now() - startTime, 
        error: errorMessage 
      };
    }
  }

  private async checkRedisConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const redisClient = taskRedisConnection.getClient();
      await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis timeout')), 3000)
        )
      ]);
      
      return { 
        status: taskRedisConnection.isHealthy(), 
        responseTime: Date.now() - startTime,
        details: { connected: true }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown redis error';
      return { 
        status: false, 
        responseTime: Date.now() - startTime, 
        error: errorMessage 
      };
    }
  }

  private async checkAuthServiceConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const authServiceUrl = config.authService.url;
      const response = await Promise.race([
        axios.get(`${authServiceUrl}/api/v1/health`, {
          timeout: 5000,
          headers: { 'Accept': 'application/json' }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth service timeout')), 5000)
        )
      ]);
      
      return { 
        status: true, 
        responseTime: Date.now() - startTime,
        details: (response as any)?.data || { connected: true }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown auth service error';
      return { 
        status: false, 
        responseTime: Date.now() - startTime, 
        error: errorMessage 
      };
    }
  }

  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      responseTime: 0, // Se establecerá en el caller
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
    };
  }
}