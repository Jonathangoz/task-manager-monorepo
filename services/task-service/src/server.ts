// ==============================================
// src/server.ts - Task Service Bootstrap & Connection Manager
// Inicialización de servicios y conexiones
// ==============================================

import 'dotenv/config';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';
import { connectDatabase, disconnectDatabase, updateUserStats, cleanupOldCompletedTasks } from '@/config/database';
import { taskRedisConnection } from '@/config/redis';
import app from '@/app';

class TaskServiceBootstrap {
  private cleanupInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;

  constructor() {
    this.validateEnvironment();
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'AUTH_SERVICE_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.fatal({
        missingVariables: missingVars
      }, 'Missing required environment variables');
      process.exit(1);
    }

    logger.info({
      environment: config.app.env,
      nodeVersion: process.version,
      port: config.app.port,
      apiVersion: config.app.apiVersion
    }, 'Environment validation passed');
  }

  private async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing PostgreSQL database connection...');
      await connectDatabase();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.fatal({ error }, 'Failed to connect to database');
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      logger.info('Initializing Redis connection...');
      await taskRedisConnection.connect();
      logger.info('Redis connection established successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis - continuing without cache');
      // No throwear error para Redis ya que el servicio puede funcionar sin caché
    }
  }

  private setupBackgroundJobs(): void {
    // Limpieza de tareas completadas antiguas (diario)
    if (config.jobs.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          logger.info('Running cleanup job for old completed tasks');
          await cleanupOldCompletedTasks(90); // 90 días
          logger.info('Cleanup job completed successfully');
        } catch (error) {
          logger.error({ error }, 'Cleanup job failed');
        }
      }, config.jobs.cleanupInterval);

      logger.info({
        intervalMs: config.jobs.cleanupInterval
      }, 'Cleanup background job scheduled');
    }

    // Actualización de estadísticas (cada 5 minutos)
    if (config.jobs.statsUpdateInterval > 0) {
      this.statsInterval = setInterval(async () => {
        try {
          // Este job se puede optimizar para actualizar solo usuarios activos
          logger.debug('Stats update job would run here (implemented per user request)');
        } catch (error) {
          logger.error({ error }, 'Stats update job failed');
        }
      }, config.jobs.statsUpdateInterval);

      logger.info({
        intervalMs: config.jobs.statsUpdateInterval
      }, 'Stats update background job scheduled');
    }
  }

  private async performHealthChecks(): Promise<void> {
    const healthChecks = [];

    // Database health check
    healthChecks.push(
      connectDatabase()
        .then(() => ({ service: 'database', status: 'healthy' }))
        .catch((error) => ({ service: 'database', status: 'unhealthy', error: error.message }))
    );

    // Redis health check
    healthChecks.push(
      taskRedisConnection.connect()
        .then(() => ({ service: 'redis', status: 'healthy' }))
        .catch((error) => ({ service: 'redis', status: 'unhealthy', error: error.message }))
    );

    const results = await Promise.allSettled(healthChecks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const check = result.value;
        if (check.status === 'healthy') {
          logger.info({ service: check.service }, 'Health check passed');
        } else {
          logger.warn({ service: check.service, error: check.error }, 'Health check failed');
        }
      }
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal} signal, starting graceful shutdown...`);

      try {
        // Detener trabajos en segundo plano
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          logger.info('Cleanup interval stopped');
        }

        if (this.statsInterval) {
          clearInterval(this.statsInterval);
          logger.info('Stats interval stopped');
        }

        // Cerrar conexiones
        await Promise.all([
          disconnectDatabase().catch(err => 
            logger.error({ error: err }, 'Error disconnecting from database')
          ),
          taskRedisConnection.disconnect().catch(err => 
            logger.error({ error: err }, 'Error disconnecting from Redis')
          )
        ]);

        logger.info('All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Escuchar señales de cierre
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Para nodemon

    // Manejar errores no capturados
    process.on('uncaughtException', (error: Error) => {
      logger.fatal({ error }, 'Uncaught exception occurred');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.fatal({
        reason: reason.toString(),
        promise: promise.toString()
      }, 'Unhandled promise rejection');
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting Task Service bootstrap process...');

      // 1. Configurar manejo de cierre graceful
      this.setupGracefulShutdown();

      // 2. Inicializar conexiones
      await this.initializeDatabase();
      await this.initializeRedis();

      // 3. Realizar checks de salud
      await this.performHealthChecks();

      // 4. Configurar trabajos en segundo plano
      this.setupBackgroundJobs();

      // 5. Iniciar servidor HTTP
      const startTime = Date.now();
      
      app.listen(config.app.port, '0.0.0.0');

      logger.info({
        port: config.app.port,
        environment: config.app.env,
        startupTime: `${Date.now() - startTime}ms`,
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }, 'Task Service started successfully and ready to accept connections');

      // Log de configuración importante (sin valores sensibles)
      logger.info({
        features: {
          swagger: config.swagger.enabled,
          rateLimit: config.rateLimit.enabled,
          cors: config.cors.origin.length > 1 || !config.cors.origin.includes('*'),
          helmet: config.security.helmetEnabled,
          redis: taskRedisConnection.isHealthy(),
          backgroundJobs: {
            cleanup: !!this.cleanupInterval,
            stats: !!this.statsInterval
          }
        }
      }, 'Service features status');

    } catch (error) {
      logger.fatal({ error }, 'Failed to start Task Service');
      process.exit(1);
    }
  }
}

// Inicializar y arrancar el servicio
const bootstrap = new TaskServiceBootstrap();

// Solo arrancar si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  bootstrap.start().catch((error) => {
    logger.fatal({ error }, 'Bootstrap failed');
    process.exit(1);
  });
}

// Exportar para testing
export { TaskServiceBootstrap };
export default bootstrap;