// src/core/application/HealthService.ts
// Servicio optimizado para health checks en Render.com con cache inteligente
import { createContextLogger } from '@/utils/logger';
import { db } from '@/config/database';
import { redisConnection } from '@/config/redis';
import { environment } from '@/config/environment';
import { HEALTH_CHECK_CONFIG } from '@/utils/constants';

// Interfaces
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
  error?: string;
  lastChecked?: string;
}

export interface SystemMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    rss: number;
    heap: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  process: {
    pid: number;
    platform: string;
    nodeVersion: string;
  };
}

export interface OverallHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  metrics?: SystemMetrics;
  cached?: boolean;
  cacheAge?: number;
}

// Cache para health checks (evita sobrecargar la BD)
interface HealthCache {
  result: OverallHealthStatus;
  timestamp: number;
  ttl: number;
}

export class HealthService {
  private readonly logger = createContextLogger({
    component: 'health-service',
  });
  private healthCache: HealthCache | null = null;
  private readonly cacheTimeout = 5000; // 5 segundos de cache
  private readonly quickCacheTimeout = 2000; // 2 segundos para checks rápidos
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      this.logger.info('Initializing HealthService...');
      this.isInitialized = true;
      this.logger.info('HealthService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize HealthService', { error });
      this.isInitialized = false;
    }
  }

  /**
   * Health check básico ULTRA RÁPIDO - Para Render.com
   * Con cache agresivo para evitar timeout
   */
  public async getBasicHealth(): Promise<OverallHealthStatus> {
    const now = Date.now();

    // ✅ USAR CACHE SI ES RECIENTE (< 5s)
    if (
      this.healthCache &&
      now - this.healthCache.timestamp < this.cacheTimeout &&
      this.healthCache.result.status === 'healthy'
    ) {
      return {
        ...this.healthCache.result,
        cached: true,
        cacheAge: now - this.healthCache.timestamp,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const startTime = Date.now();
      const checks: HealthCheckResult[] = [];

      // ✅ HEALTH CHECK DE SERVIDOR (INSTANTÁNEO)
      checks.push({
        name: 'server',
        status: 'healthy',
        message: 'Server process is running',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
      });

      // ✅ HEALTH CHECK DE BASE DE DATOS (CON TIMEOUT SÚPER AGRESIVO)
      const dbCheck = await this.checkDatabaseQuick();
      checks.push(dbCheck);

      // ✅ HEALTH CHECK DE REDIS (OPCIONAL - NO CRÍTICO)
      const redisCheck = await this.checkRedisQuick();
      checks.push(redisCheck);

      // ✅ DETERMINAR STATUS GENERAL
      const criticalChecks = [checks[0], checks[1]]; // Server + DB
      const allCriticalHealthy = criticalChecks.every(
        (check) => check.status === 'healthy',
      );
      const hasDegraded = checks.some((check) => check.status === 'degraded');

      let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      if (!allCriticalHealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const result: OverallHealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks,
        cached: false,
      };

      // ✅ GUARDAR EN CACHE SOLO SI ESTÁ SALUDABLE
      if (overallStatus === 'healthy') {
        this.healthCache = {
          result,
          timestamp: now,
          ttl: this.cacheTimeout,
        };
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug('Basic health check completed', {
        status: overallStatus,
        duration: `${totalTime}ms`,
        cached: false,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Basic health check failed', { error: errorMessage });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks: [
          {
            name: 'overall',
            status: 'unhealthy',
            message: 'Health check service failed',
            error: errorMessage,
            lastChecked: new Date().toISOString(),
          },
        ],
        cached: false,
      };
    }
  }

  /**
   * Readiness check - Para Kubernetes/Render readiness probe
   */
  public async getReadinessHealth(): Promise<OverallHealthStatus> {
    try {
      const checks: HealthCheckResult[] = [];

      // ✅ Verificar que el servicio esté inicializado
      checks.push({
        name: 'service_initialization',
        status: this.isInitialized ? 'healthy' : 'unhealthy',
        message: this.isInitialized
          ? 'Service initialized'
          : 'Service not ready',
        lastChecked: new Date().toISOString(),
      });

      // ✅ Verificar base de datos con timeout corto
      const dbCheck = await this.checkDatabaseQuick();
      checks.push(dbCheck);

      const allReady = checks.every((check) => check.status === 'healthy');

      return {
        status: allReady ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks,
        cached: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Readiness check failed', { error: errorMessage });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks: [
          {
            name: 'readiness',
            status: 'unhealthy',
            error: errorMessage,
            lastChecked: new Date().toISOString(),
          },
        ],
        cached: false,
      };
    }
  }

  /**
   * Liveness check - SÚPER RÁPIDO, solo verifica que el proceso esté vivo
   */
  public async getLivenessHealth(): Promise<OverallHealthStatus> {
    try {
      const isAlive = process.uptime() > 0 && this.isInitialized;
      const memUsage = process.memoryUsage();

      return {
        status: isAlive ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks: [
          {
            name: 'process',
            status: isAlive ? 'healthy' : 'unhealthy',
            message: isAlive ? 'Process is alive' : 'Process not responding',
            details: {
              pid: process.pid,
              uptime: process.uptime(),
              memoryUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            },
            lastChecked: new Date().toISOString(),
          },
        ],
        cached: false,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 0,
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks: [
          {
            name: 'process',
            status: 'unhealthy',
            error:
              error instanceof Error ? error.message : 'Process check failed',
            lastChecked: new Date().toISOString(),
          },
        ],
        cached: false,
      };
    }
  }

  /**
   * Health check detallado con métricas - Solo para desarrollo/debugging
   */
  public async getDetailedHealth(): Promise<OverallHealthStatus> {
    if (environment.app.isProduction) {
      return this.getBasicHealth();
    }

    try {
      const checks: HealthCheckResult[] = [];

      // ✅ Server check
      checks.push({
        name: 'server',
        status: 'healthy',
        message: 'Server is running',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
      });

      // ✅ Database check detallado
      const dbCheck = await this.checkDatabaseDetailed();
      checks.push(dbCheck);

      // ✅ Redis check detallado
      const redisCheck = await this.checkRedisDetailed();
      checks.push(redisCheck);

      // ✅ Environment check
      const envCheck = this.checkEnvironment();
      checks.push(envCheck);

      const criticalChecks = checks.filter((check) =>
        ['server', 'database'].includes(check.name),
      );
      const allCriticalHealthy = criticalChecks.every(
        (check) => check.status === 'healthy',
      );
      const hasDegraded = checks.some((check) => check.status === 'degraded');

      let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      if (!allCriticalHealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }

      const metrics = this.getSystemMetrics();

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks,
        metrics,
        cached: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Detailed health check failed', {
        error: errorMessage,
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        service: 'auth-service',
        version: environment.app.apiVersion || '1.0.0',
        environment: environment.app.env,
        checks: [
          {
            name: 'overall',
            status: 'unhealthy',
            error: errorMessage,
            lastChecked: new Date().toISOString(),
          },
        ],
        cached: false,
      };
    }
  }

  /**
   * Check específico de base de datos - SÚPER RÁPIDO
   */
  public async checkDatabaseQuick(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1 as status`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database timeout')),
            HEALTH_CHECK_CONFIG.DATABASE.QUICK_CHECK_TIMEOUT || 1000,
          ),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Database error';
      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
        error: errorMessage,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check específico de Redis - SÚPER RÁPIDO Y OPCIONAL
   */
  public async checkRedisQuick(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const client = redisConnection.getClient();
      await Promise.race([
        client.ping(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis timeout')),
            HEALTH_CHECK_CONFIG.REDIS.QUICK_CHECK_TIMEOUT || 500,
          ),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      const isHealthy = redisConnection.isHealthy();

      return {
        name: 'redis',
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy
          ? 'Redis connection is healthy'
          : 'Redis connection degraded',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Redis error';

      // ✅ Redis es opcional, marcar como degraded en lugar de unhealthy
      return {
        name: 'redis',
        status: 'degraded',
        message: 'Redis connection unavailable (optional service)',
        responseTime,
        error: errorMessage,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check detallado de base de datos
   */
  private async checkDatabaseDetailed(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1 as status, version() as version, now() as timestamp`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database timeout')),
            HEALTH_CHECK_CONFIG.DATABASE.TIMEOUT || 3000,
          ),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime,
        details: { query: 'SELECT 1, version(), now()' },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Database error';

      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
        error: errorMessage,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check detallado de Redis
   */
  private async checkRedisDetailed(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const client = redisConnection.getClient();
      const pingResult = await Promise.race([
        client.ping(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis timeout')),
            HEALTH_CHECK_CONFIG.REDIS.TIMEOUT || 2000,
          ),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      const isHealthy = redisConnection.isHealthy();

      return {
        name: 'redis',
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy
          ? 'Redis connection is healthy'
          : 'Redis connection degraded',
        responseTime,
        details: {
          ping: pingResult,
          connected: isHealthy,
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Redis error';

      return {
        name: 'redis',
        status: 'degraded',
        message: 'Redis connection unavailable (optional service)',
        responseTime,
        error: errorMessage,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check de configuración del entorno
   */
  private checkEnvironment(): HealthCheckResult {
    try {
      const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName],
      );

      if (missingVars.length > 0) {
        return {
          name: 'environment',
          status: 'unhealthy',
          message: 'Missing required environment variables',
          error: `Missing: ${missingVars.join(', ')}`,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        name: 'environment',
        status: 'healthy',
        message: 'Environment configuration is valid',
        details: {
          nodeEnv: environment.app.env,
          nodeVersion: process.version,
          platform: process.platform,
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Environment error';
      return {
        name: 'environment',
        status: 'unhealthy',
        message: 'Environment check failed',
        error: errorMessage,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtener métricas del sistema
   */
  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      uptime: process.uptime(),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heap: Math.round(memUsage.heapUsed / 1024 / 1024),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
    };
  }

  /**
   * Limpiar cache - útil para testing
   */
  public clearCache(): void {
    this.healthCache = null;
    this.logger.debug('Health check cache cleared');
  }

  /**
   * Verificar si el servicio está listo
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Obtener estado del cache
   */
  public getCacheInfo(): { cached: boolean; age?: number; status?: string } {
    if (!this.healthCache) {
      return { cached: false };
    }

    const age = Date.now() - this.healthCache.timestamp;
    return {
      cached: true,
      age,
      status: this.healthCache.result.status,
    };
  }
}

// Singleton instance
export const healthService = new HealthService();
