// src/server.ts - Task Service Bootstrap & Connection Manager
// Inicialización de servicios y conexiones
import 'dotenv/config';
import * as http from 'http';
import { logger, startup, logError, healthCheck } from '@/utils/logger';
import { config } from '@/config/environment';
import { connectDatabase, disconnectDatabase, cleanupOldCompletedTasks } from '@/config/database';
import { taskRedisConnection } from '@/config/redis';
import { TaskServiceApp } from '@/app'; 

// TIPOS E INTERFACES
interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  error?: string;
  duration?: number;
}

interface ServerInfo {
  port: number;
  environment: string;
  apiVersion: string;
  pid: number;
  nodeVersion: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  startupTime: number;
}

// CLASE PRINCIPAL DE BOOTSTRAP
class TaskServiceBootstrap {
  private server?: http.Server;
  private cleanupInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private readonly gracefulShutdownTimeout = 30000; // 30 segundos
  private taskApp?: TaskServiceApp; // ✅ NUEVO: Instancia de la aplicación

  constructor() {
    this.validateEnvironment();
    this.logStartupInfo();
  }

  /**
   * Valida que todas las variables de entorno requeridas estén presentes
   */
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
        missingVariables: missingVars,
        event: 'environment_validation_failed'
      }, '💀 Missing required environment variables');
      process.exit(1);
    }

    logger.info({
      environment: config.app.env,
      nodeVersion: process.version,
      port: config.app.port, // ✅ VERIFICAR: Debe ser 3002
      apiVersion: config.app.apiVersion,
      event: 'environment_validation_passed'
    }, '✅ Environment validation passed');
  }

  /**
   * Log de información inicial del servicio
   */
  private logStartupInfo(): void {
    // ✅ CAMBIO: Log específico para task-service
    console.log('🔧 Task Service Configuration Loaded:');
    console.log(`   Environment: ${config.app.env}`);
    console.log(`   Port: ${config.app.port}`); // ✅ DEBE MOSTRAR 3002
    console.log(`   Auth Service: ${config.authService.url}`);
    console.log(`   Redis Prefix: ${config.redis.prefix}`);
    console.log(`   Log Level: ${config.logging.level}`);
    console.log(`   Jobs Enabled: cleanup=${config.jobs.cleanup.enabled}, stats=${config.jobs.statsUpdate.enabled}`);
    console.log(`   Swagger: ${config.swagger.enabled ? 'enabled' : 'disabled'}`);

    startup.configLoaded({
      service: 'task-service', // ✅ CAMBIO: Especificar task-service
      environment: config.app.env,
      port: config.app.port,
      redis: {
        enabled: true,
        prefix: config.redis.prefix
      },
      jobs: {
        cleanup: config.jobs.cleanup.enabled,
        statsUpdate: config.jobs.statsUpdate.enabled
      },
      features: {
        swagger: config.swagger.enabled,
        healthCheck: config.features.healthCheckEnabled
      }
    });
  }

  /**
   * Inicializa la conexión a PostgreSQL
   */
  private async initializeDatabase(): Promise<void> {
    try {
      logger.info({
        event: 'database_initialization_started',
        component: 'database'
      }, '🗄️ Initializing PostgreSQL database connection...');
      
      await connectDatabase();
      
      startup.dependencyConnected('PostgreSQL', 'Prisma ORM');
      
      logger.info({
        event: 'database_initialized',
        component: 'database'
      }, '✅ Database connection established successfully');
      
    } catch (error) {
      logError.critical(error as Error, {
        context: 'database_initialization',
        component: 'database'
      });
      
      throw error;
    }
  }

  /**
   * Inicializa la conexión a Redis
   */
  private async initializeRedis(): Promise<void> {
    try {
      logger.info({
        event: 'redis_initialization_started',
        component: 'redis'
      }, '🔴 Initializing Redis connection...');
      
      await taskRedisConnection.connect();
      
      startup.dependencyConnected('Redis', 'Cache & Session Store');
      
      logger.info({
        event: 'redis_initialized',
        component: 'redis'
      }, '✅ Redis connection established successfully');
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        event: 'redis_initialization_failed',
        component: 'redis'
      }, '⚠️ Failed to connect to Redis - continuing without cache');
      
      // No lanzar error para Redis ya que el servicio puede funcionar sin caché
    }
  }

  /**
   * Configura los trabajos en segundo plano
   */
  private setupBackgroundJobs(): void {
    logger.info({
      event: 'background_jobs_setup_started',
      component: 'jobs'
    }, '⚙️ Setting up background jobs...');

    // Trabajo de limpieza de tareas completadas antiguas
    if (config.jobs.cleanup.enabled && config.jobs.cleanup.intervalMs > 0) {
      this.cleanupInterval = setInterval(async () => {
        if (this.isShuttingDown) return;
        
        try {
          logger.info({
            event: 'cleanup_job_started',
            component: 'jobs',
            retentionDays: config.jobs.cleanup.retentionDays
          }, '🧹 Running cleanup job for old completed tasks');
          
          const deletedCount = await cleanupOldCompletedTasks(config.jobs.cleanup.retentionDays);
          
          logger.info({
            event: 'cleanup_job_completed',
            component: 'jobs',
            deletedCount,
            retentionDays: config.jobs.cleanup.retentionDays
          }, `✅ Cleanup job completed: ${deletedCount} tasks removed`);
          
        } catch (error) {
          logError.medium(error as Error, {
            context: 'background_cleanup_job',
            component: 'jobs'
          });
        }
      }, config.jobs.cleanup.intervalMs);

      logger.info({
        intervalMs: config.jobs.cleanup.intervalMs,
        retentionDays: config.jobs.cleanup.retentionDays,
        event: 'cleanup_job_scheduled',
        component: 'jobs'
      }, '📅 Cleanup background job scheduled');
    }

    // Trabajo de actualización de estadísticas
    if (config.jobs.statsUpdate.enabled && config.jobs.statsUpdate.intervalMs > 0) {
      this.statsInterval = setInterval(async () => {
        if (this.isShuttingDown) return;
        
        try {
          logger.debug({
            event: 'stats_job_placeholder',
            component: 'jobs'
          }, '📊 Stats update job placeholder (implement per user request)');
          
          // Aquí se puede implementar la actualización de estadísticas
          // por ahora es un placeholder
          
        } catch (error) {
          logError.low(error as Error, {
            context: 'background_stats_job',
            component: 'jobs'
          });
        }
      }, config.jobs.statsUpdate.intervalMs);

      logger.info({
        intervalMs: config.jobs.statsUpdate.intervalMs,
        event: 'stats_job_scheduled',
        component: 'jobs'
      }, '📊 Stats update background job scheduled');
    }

    logger.info({
      event: 'background_jobs_setup_completed',
      component: 'jobs',
      jobs: {
        cleanup: !!this.cleanupInterval,
        stats: !!this.statsInterval
      }
    }, '✅ Background jobs setup completed');
  }

  /**
   * Realiza health checks de todos los servicios
   */
  private async performHealthChecks(): Promise<void> {
    logger.info({
      event: 'health_checks_started',
      component: 'health'
    }, '🔍 Performing health checks...');

    const healthChecks: Promise<HealthCheckResult>[] = [];

    // Database health check
    healthChecks.push(
      connectDatabase()
        .then(() => ({ 
          service: 'database', 
          status: 'healthy' as const
        }))
        .catch((error) => ({ 
          service: 'database', 
          status: 'unhealthy' as const, 
          error: error.message 
        }))
    );

    // Redis health check
    healthChecks.push(
      taskRedisConnection.connect()
        .then(() => ({ 
          service: 'redis', 
          status: 'healthy' as const
        }))
        .catch((error) => ({ 
          service: 'redis', 
          status: 'unhealthy' as const, 
          error: error.message 
        }))
    );

    try {
      const results = await Promise.allSettled(healthChecks);
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const check = result.value;
          
          if (check.status === 'healthy') {
            healthCheck.passed(check.service, 0, { status: check.status });
            
            logger.info({
              service: check.service,
              status: check.status,
              event: 'health_check_passed',
              component: 'health'
            }, `✅ ${check.service} health check passed`);
            
          } else {
            healthCheck.failed(check.service, new Error(check.error || 'Unknown error'), 0);
            
            logger.warn({
              service: check.service,
              status: check.status,
              error: check.error,
              event: 'health_check_failed',
              component: 'health'
            }, `⚠️ ${check.service} health check failed`);
          }
        } else {
          logger.error({
            error: result.reason?.message || 'Unknown error',
            event: 'health_check_error',
            component: 'health'
          }, '❌ Health check promise rejected');
        }
      });

    } catch (error) {
      logError.high(error as Error, {
        context: 'health_checks_execution',
        component: 'health'
      });
    }

    logger.info({
      event: 'health_checks_completed',
      component: 'health'
    }, '✅ Health checks completed');
  }

  /**
   * Configura el graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn({
          signal,
          event: 'shutdown_already_in_progress'
        }, '⚠️ Shutdown already in progress, ignoring signal');
        return;
      }

      this.isShuttingDown = true;
      
      startup.gracefulShutdown(signal);
      
      logger.info({
        signal,
        timeout: this.gracefulShutdownTimeout,
        event: 'graceful_shutdown_started'
      }, `🛑 Received ${signal} signal, starting graceful shutdown...`);

      try {
        // 1. Detener trabajos en segundo plano
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          logger.info({
            event: 'cleanup_interval_stopped',
            component: 'jobs'
          }, '🛑 Cleanup interval stopped');
        }

        if (this.statsInterval) {
          clearInterval(this.statsInterval);
          logger.info({
            event: 'stats_interval_stopped',
            component: 'jobs'
          }, '🛑 Stats interval stopped');
        }

        // 2. Cerrar servidor HTTP
        if (this.server) {
          await new Promise<void>((resolve, reject) => {
            this.server!.close((err) => {
              if (err) {
                reject(err);
              } else {
                logger.info({
                  event: 'http_server_closed',
                  component: 'server'
                }, '🔌 HTTP server closed successfully');
                resolve();
              }
            });
          });
        }

        // 3. Cerrar conexiones de base de datos y Redis
        const shutdownPromises = [];

        shutdownPromises.push(
          disconnectDatabase()
            .then(() => {
              logger.info({
                event: 'database_disconnected',
                component: 'database'  
              }, '🔌 Database disconnected successfully');
            })
            .catch(err => {
              logError.medium(err, {
                context: 'database_disconnect_error',
                component: 'database'
              });
            })
        );

        shutdownPromises.push(
          taskRedisConnection.disconnect()
            .then(() => {
              logger.info({
                event: 'redis_disconnected',
                component: 'redis'
              }, '🔌 Redis disconnected successfully');
            })
            .catch(err => {
              logError.medium(err, {
                context: 'redis_disconnect_error',
                component: 'redis'
              });
            })
        );

        await Promise.allSettled(shutdownPromises);

        logger.info({
          event: 'graceful_shutdown_completed',
          signal
        }, '✅ All connections closed successfully');
        
        process.exit(0);
        
      } catch (error) {
        logError.critical(error as Error, {
          context: 'graceful_shutdown_error',
          signal
        });
        
        process.exit(1);
      }
    };

    // Configurar timeout de cierre forzado
    const forceShutdown = () => {
      setTimeout(() => {
        if (this.isShuttingDown) {
          logger.fatal({
            timeout: this.gracefulShutdownTimeout,
            event: 'forced_shutdown'
          }, '💀 Forced shutdown after timeout');
          process.exit(1);
        }
      }, this.gracefulShutdownTimeout);
    };

    // Escuchar señales de cierre
    process.on('SIGINT', () => {
      forceShutdown();
      shutdown('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      forceShutdown();
      shutdown('SIGTERM');
    });
    
    process.on('SIGUSR2', () => {
      forceShutdown();
      shutdown('SIGUSR2');
    }); // Para nodemon

    // Manejar errores no capturados
    process.on('uncaughtException', (error: Error) => {
      logError.critical(error, {
        context: 'uncaught_exception',
        pid: process.pid
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.fatal({
        reason: reason?.toString() || 'Unknown reason',
        promise: promise.toString(),
        event: 'unhandled_rejection',
        pid: process.pid
      }, '💀 Unhandled promise rejection occurred');
      process.exit(1);
    });

    logger.info({
      timeout: this.gracefulShutdownTimeout,
      event: 'graceful_shutdown_configured'
    }, '🛡️ Graceful shutdown handlers configured');
  }

  /**
   * Inicia el servidor HTTP usando la aplicación TaskServiceApp correcta
   */
  private async startHttpServer(): Promise<ServerInfo> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      try {
        // ✅ CAMBIO CRÍTICO: Crear la aplicación TaskServiceApp correcta
        console.log('Creating TaskServiceApp with correct configuration...');
        this.taskApp = new TaskServiceApp();
        const app = this.taskApp.getApp();
        
        console.log('TaskServiceApp created successfully:', !!app); 
        
        // Verificar que app sea una aplicación Express válida
        if (!app || typeof app !== 'function') {
          throw new Error('Invalid TaskServiceApp Express application');
        }

        // ✅ CAMBIO CRÍTICO: Usar el puerto correcto desde la configuración
        const targetPort = config.app.port; // DEBE SER 3002
        console.log(`Starting server on port: ${targetPort}`);

        // Crear servidor HTTP con la aplicación Express correcta
        this.server = http.createServer(app);
        
        // Configurar event listeners
        this.server.on('listening', () => {
          const address = this.server!.address();
          const port = typeof address === 'string' ? parseInt(address) : address?.port || targetPort;
          
          const serverInfo: ServerInfo = {
            port,
            environment: config.app.env,
            apiVersion: config.app.apiVersion,
            pid: process.pid,
            nodeVersion: process.version,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            startupTime: Date.now() - startTime
          };

          startup.serviceStarted(port, config.app.env);
          
          logger.info({
            ...serverInfo,
            event: 'http_server_started',
            component: 'server',
            service: 'task-service' // ✅ ESPECIFICAR task-service
          }, `🚀 TASK SERVICE HTTP server listening on port ${port}`); // ✅ ACLARAR QUE ES TASK SERVICE
          
          resolve(serverInfo);
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logError.critical(new Error(`Port ${targetPort} is already in use`), {
              context: 'http_server_port_in_use',
              port: targetPort,
              code: error.code,
              service: 'task-service' // ✅ ESPECIFICAR task-service
            });
          } else {
            logError.critical(error, {
              context: 'http_server_start_error',
              port: targetPort,
              code: error.code,
              service: 'task-service' // ✅ ESPECIFICAR task-service
            });
          }
          reject(error);
        });

        // Configurar timeouts del servidor
        this.server.timeout = 30000; // 30 segundos
        this.server.keepAliveTimeout = 5000; // 5 segundos
        this.server.headersTimeout = 6000; // 6 segundos

        // ✅ CAMBIO CRÍTICO: Iniciar el servidor en el puerto correcto
        this.server.listen(targetPort, '0.0.0.0');
        console.log(`Server.listen called with port: ${targetPort}`);

      } catch (error) {
        logError.critical(error as Error, {
          context: 'http_server_setup_error',
          port: config.app.port,
          service: 'task-service' // ✅ ESPECIFICAR task-service
        });
        reject(error);
      }
    });
  }

  /**
   * Proceso principal de inicialización del servicio
   */
  public async start(): Promise<void> {
    try {
      logger.info({
        event: 'service_bootstrap_started',
        service: 'task-service' // ✅ ESPECIFICAR task-service
      }, '🚀 Starting Task Service bootstrap process...');

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
      const serverInfo = await this.startHttpServer();

      // Log final de inicialización exitosa
      logger.info({
        ...serverInfo,
        event: 'service_started_successfully',
        service: 'task-service', // ✅ ESPECIFICAR task-service
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
      }, '🎉 TASK SERVICE started successfully and ready to accept connections'); // ✅ ACLARAR QUE ES TASK SERVICE

    } catch (error) {
      logError.critical(error as Error, {
        context: 'service_bootstrap_failed',
        service: 'task-service' // ✅ ESPECIFICAR task-service
      });
      
      logger.fatal({
        error: error instanceof Error ? error.message : String(error),
        event: 'service_bootstrap_failed',
        service: 'task-service' // ✅ ESPECIFICAR task-service
      }, '💀 Failed to start TASK SERVICE'); // ✅ ACLARAR QUE ES TASK SERVICE
      
      process.exit(1);
    }
  }

  /**
   * Obtiene información del estado actual del servicio
   */
  public getServiceInfo() {
    return {
      service: 'task-service', // ✅ ESPECIFICAR task-service
      version: config.app.apiVersion,
      environment: config.app.env,
      port: config.app.port,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: {
        database: true, // Asumir conectado si llegamos aquí
        redis: taskRedisConnection.isHealthy()
      },
      jobs: {
        cleanup: {
          enabled: config.jobs.cleanup.enabled,
          running: !!this.cleanupInterval
        },
        statsUpdate: {
          enabled: config.jobs.statsUpdate.enabled,
          running: !!this.statsInterval
        }
      },
      features: {
        swagger: config.swagger.enabled,
        healthCheck: config.features.healthCheckEnabled,
        rateLimit: config.rateLimit.enabled
      },
      server: {
        running: !!this.server && this.server.listening,
        timeout: this.server?.timeout,
        keepAliveTimeout: this.server?.keepAliveTimeout
      }
    };
  }

  /**
   * Detiene el servicio de forma controlada
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn({
        event: 'stop_already_in_progress',
        service: 'task-service' // ✅ ESPECIFICAR task-service
      }, '⚠️ Service stop already in progress');
      return;
    }

    logger.info({
      event: 'service_stop_requested',
      service: 'task-service' // ✅ ESPECIFICAR task-service
    }, '🛑 Service stop requested');

    // Usar el método de shutdown existente
    await new Promise<void>((resolve) => {
      process.once('exit', resolve);
      process.kill(process.pid, 'SIGTERM');
    });
  }
}

// INICIALIZACIÓN Y ARRANQUE
// Crear instancia del bootstrap
const bootstrap = new TaskServiceBootstrap();

// Solo arrancar si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  bootstrap.start().catch((error) => {
    logger.fatal({
      error: error instanceof Error ? error.message : String(error),
      event: 'bootstrap_startup_failed',
      service: 'task-service' // ✅ ESPECIFICAR task-service
    }, '💀 TASK SERVICE Bootstrap failed during startup'); // ✅ ACLARAR QUE ES TASK SERVICE
    
    process.exit(1);
  });
}

// Exportar para testing y uso externo
export { TaskServiceBootstrap };
export default bootstrap;