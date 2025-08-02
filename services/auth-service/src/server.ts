// src/server.ts - Auth Service Server - ✅ OPTIMIZADO PARA RENDER.COM
import { Server } from 'http';
import { Socket } from 'net';
import App from './app';
import { environment } from '@/config/environment';
import {
  logger,
  dbLogger,
  redisLogger,
  startup,
  createContextLogger,
  // healthCheck, // ✅ Removido porque no se usa
} from '@/utils/logger';
import {
  connectDatabase,
  disconnectDatabase,
  cleanupExpiredTokens,
  cleanupExpiredSessions,
  db,
} from '@/config/database';
import { redisConnection } from '@/config/redis';

class AuthServer {
  private app: App;
  private server: Server | null = null;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private isShuttingDown = false;
  private readonly serverLogger = createContextLogger({ component: 'server' });
  private consecutiveHealthCheckFailures = 0;
  private isInitialized = false;

  constructor() {
    this.app = new App();
  }

  // ✅ INICIO DEL SERVIDOR OPTIMIZADO
  public async start(): Promise<void> {
    try {
      startup.serviceStarted(environment.app.port, environment.app.env);

      // ✅ Inicializar dependencias con mejor manejo de errores
      await this.initializeDependencies();

      // ✅ Configurar trabajos de limpieza DESPUÉS de inicializar
      this.setupCleanupJobs();

      // ✅ Iniciar servidor HTTP con configuración optimizada
      await this.startHttpServer();

      // ✅ Configurar shutdown graceful
      this.setupGracefulShutdown();

      this.isInitialized = true;

      this.serverLogger.info('Auth Service started successfully', {
        port: environment.app.port,
        env: environment.app.env,
        apiVersion: environment.app.apiVersion,
        logLevel: environment.logging.level,
        features: {
          healthCheck: environment.features.healthCheckEnabled,
          swagger: environment.features.swaggerEnabled,
          emailVerification: environment.features.emailVerificationEnabled,
        },
        memory: this.getMemoryUsage(),
      });
    } catch (error) {
      this.serverLogger.fatal('Failed to start Auth Service', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      });
      await this.shutdown(1);
    }
  }

  // ✅ INICIALIZACIÓN DE DEPENDENCIAS CON MEJOR MANEJO DE ERRORES
  private async initializeDependencies(): Promise<void> {
    // Inicializar base de datos
    await this.initializeDatabase();

    // Inicializar Redis (no crítico - puede fallar)
    await this.initializeRedis();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      startup.dependencyConnected('PostgreSQL Database');

      // ✅ Intentar conectar con reintentos
      let retries = 3;
      while (retries > 0) {
        try {
          await connectDatabase();

          // ✅ Verificar conexión con timeout
          await Promise.race([
            db.$queryRaw`SELECT 1`,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Database connection timeout')),
                10000,
              ),
            ),
          ]);

          dbLogger.info('Database initialized successfully', {
            url: environment.database.url.replace(/\/\/.*@/, '//***@'),
            retries: 3 - retries,
          });
          return;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;

          dbLogger.warn(
            `Database connection failed, retrying... (${retries} attempts left)`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );

          // Esperar antes del siguiente intento
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      dbLogger.error('Database initialization failed after all retries', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      startup.dependencyConnected('Redis Cache');

      // ✅ Redis es opcional - no debe fallar el startup
      const redisTimeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Redis initialization timeout')),
          8000,
        ),
      );

      await Promise.race([redisConnection.connect(), redisTimeout]);

      redisLogger.info('Redis initialized successfully', {
        url: environment.redis.url.replace(/\/\/.*@/, '//***@'),
        prefix: environment.redis.prefix,
      });
    } catch (error) {
      // ✅ Redis es opcional - log warning pero no fallar
      redisLogger.warn(
        'Redis initialization failed - continuing without cache',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  // ✅ CONFIGURACIÓN DE TRABAJOS DE LIMPIEZA OPTIMIZADA
  private setupCleanupJobs(): void {
    this.serverLogger.info('Setting up cleanup jobs...');

    // ✅ Solo configurar si las dependencias están disponibles
    if (this.isDatabaseAvailable()) {
      // Cleanup de tokens expirados - cada 2 horas (menos frecuente)
      const tokenCleanupInterval = setInterval(
        async () => {
          if (this.isShuttingDown) return;

          try {
            this.serverLogger.debug('Running token cleanup job...');
            await cleanupExpiredTokens();
          } catch (error) {
            this.serverLogger.warn('Token cleanup job failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        2 * 60 * 60 * 1000,
      ); // 2 horas

      // Cleanup de sesiones expiradas - cada hora
      const sessionCleanupInterval = setInterval(
        async () => {
          if (this.isShuttingDown) return;

          try {
            this.serverLogger.debug('Running session cleanup job...');
            await cleanupExpiredSessions();
          } catch (error) {
            this.serverLogger.warn('Session cleanup job failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        60 * 60 * 1000,
      ); // 1 hora

      this.cleanupIntervals.push(tokenCleanupInterval, sessionCleanupInterval);

      this.serverLogger.info('Cleanup jobs scheduled successfully', {
        tokenCleanupInterval: '2 hours',
        sessionCleanupInterval: '1 hour',
      });
    } else {
      this.serverLogger.warn(
        'Cleanup jobs not scheduled - database not available',
      );
    }
  }

  // ✅ INICIO DEL SERVIDOR HTTP OPTIMIZADO PARA RENDER
  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app
          .getApp()
          .listen(environment.app.port, '0.0.0.0', () => {
            this.serverLogger.info('HTTP server listening', {
              port: environment.app.port,
              host: '0.0.0.0',
              environment: environment.app.env,
            });
            resolve();
          });

        if (!this.server) {
          const error = new Error('Server object failed to initialize.');
          this.serverLogger.error('Failed to start HTTP server', { error });
          return reject(error);
        }

        // ✅ TIMEOUTS OPTIMIZADOS PARA RENDER.COM
        this.server.timeout = 120000; // 2 minutos (más generoso)
        this.server.keepAliveTimeout = 65000; // 65s (dentro del límite de Render)
        this.server.headersTimeout = 66000; // 66s (1s más que keepAlive)
        this.server.requestTimeout = 60000; // 60s para requests individuales
        this.server.maxHeadersCount = 100; // Reducido para mejor performance

        // ✅ Configurar límites de conexión más conservadores
        this.server.maxConnections = 500; // Reducido de 1000

        // ✅ MANEJO DE CONEXIONES OPTIMIZADO
        this.server.on('connection', (socket: Socket) => {
          // Timeouts más generosos para cloud
          socket.setTimeout(90000); // 90 segundos
          socket.setKeepAlive(true, 45000); // Keep alive cada 45 segundos

          socket.on('timeout', () => {
            this.serverLogger.debug(
              'Socket timeout (normal for health checks)',
              {
                remoteAddress: socket.remoteAddress || 'unknown',
              },
            );
            socket.destroy();
          });

          socket.on('error', (error) => {
            // Solo log errores que no sean de health checks
            if (
              !error.message.includes('ECONNRESET') &&
              !error.message.includes('EPIPE') &&
              !error.message.includes('ENOTFOUND')
            ) {
              this.serverLogger.debug('Socket error', {
                error: error.message,
                remoteAddress: socket.remoteAddress || 'unknown',
              });
            }
          });
        });

        // ✅ MANEJO DE ERRORES DEL SERVIDOR MEJORADO
        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            this.serverLogger.error(
              `Port ${environment.app.port} is already in use`,
              {
                port: environment.app.port,
                code: error.code,
              },
            );
          } else {
            this.serverLogger.error('Server error', {
              error: {
                message: error.message,
                code: error.code,
                errno: error.errno,
              },
            });
          }
          reject(error);
        });

        // ✅ MANEJO DE ERRORES DE CLIENTE MÁS SILENCIOSO
        this.server.on('clientError', (error, socket: Socket) => {
          // Filtrar errores comunes de health checks y load balancers
          const commonErrors = [
            'ECONNRESET',
            'EPIPE',
            'ETIMEDOUT',
            'ENOTFOUND',
            'Parse Error',
            'Bad Request',
            'HPE_INVALID_METHOD',
          ];

          const isCommonError = commonErrors.some((commonError) =>
            error.message.includes(commonError),
          );

          if (!isCommonError) {
            this.serverLogger.debug('Client error', {
              error: error.message,
              remoteAddress: socket.remoteAddress || 'unknown',
            });
          }

          // Responder y cerrar conexión de forma segura
          if (socket.writable && !socket.destroyed) {
            try {
              socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            } catch (_e) {
              // ✅ Usar _e para indicar que es intencionalmente ignorado
              socket.destroy();
            }
          }
        });

        // ✅ Evento de servidor listo
        this.server.on('listening', () => {
          const timeouts = {
            server: this.server?.timeout,
            keepAlive: this.server?.keepAliveTimeout,
            headers: this.server?.headersTimeout,
            request: this.server?.requestTimeout,
          };

          this.serverLogger.info('Server is ready to accept connections', {
            port: environment.app.port,
            timeouts,
            maxConnections: this.server?.maxConnections,
          });
        });
      } catch (error) {
        this.serverLogger.error('Failed to start HTTP server', { error });
        reject(error);
      }
    });
  }

  // ✅ CONFIGURACIÓN DE SHUTDOWN GRACEFUL MEJORADA
  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        startup.gracefulShutdown(signal);
        await this.shutdown(0);
      });
    });

    // ✅ Manejo mejorado de excepciones
    process.on('uncaughtException', async (error) => {
      this.serverLogger.fatal('Uncaught exception', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        isInitialized: this.isInitialized,
      });
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.serverLogger.fatal('Unhandled promise rejection', {
        reason:
          reason instanceof Error
            ? {
                message: reason.message,
                stack: reason.stack,
                name: reason.name,
              }
            : reason,
        promise: promise.toString(),
        isInitialized: this.isInitialized,
      });
      await this.shutdown(1);
    });

    process.on('exit', (code) => {
      this.serverLogger.info('Process exiting', {
        exitCode: code,
        isInitialized: this.isInitialized,
      });
    });

    // ✅ Manejo de warnings de Node.js
    process.on('warning', (warning) => {
      // Solo log warnings importantes
      if (
        warning.name !== 'ExperimentalWarning' &&
        warning.name !== 'DeprecationWarning'
      ) {
        this.serverLogger.warn('Process warning', {
          name: warning.name,
          message: warning.message,
        });
      }
    });
  }

  // ✅ SHUTDOWN GRACEFUL OPTIMIZADO
  public async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      this.serverLogger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.serverLogger.info('Starting graceful shutdown...', {
      exitCode,
      isInitialized: this.isInitialized,
    });

    // ✅ Timeout más generoso para shutdown
    const shutdownTimeout = setTimeout(() => {
      this.serverLogger.error('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 45000); // 45 segundos

    try {
      // ✅ Detener servidor HTTP primero
      if (this.server && this.server.listening) {
        this.serverLogger.info('Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              this.serverLogger.error('Error closing HTTP server', { error });
              reject(error);
            } else {
              this.serverLogger.info('HTTP server closed successfully');
              resolve();
            }
          });
        });
      }

      // ✅ Detener trabajos de limpieza
      if (this.cleanupIntervals.length > 0) {
        this.serverLogger.info('Stopping cleanup jobs...');
        this.cleanupIntervals.forEach((interval) => clearInterval(interval));
        this.cleanupIntervals = [];
      }

      // ✅ Cerrar Redis (no crítico si falla)
      try {
        if (redisConnection.isHealthy()) {
          redisLogger.info('Closing Redis connection...');
          await Promise.race([
            redisConnection.disconnect(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Redis disconnect timeout')),
                5000,
              ),
            ),
          ]);
        }
      } catch (_error) {
        // ✅ Usar _error para indicar que es intencionalmente ignorado
        redisLogger.warn('Error closing Redis connection', {
          error: _error instanceof Error ? _error.message : String(_error),
        });
      }

      // ✅ Cerrar base de datos
      try {
        dbLogger.info('Closing database connection...');
        await Promise.race([
          disconnectDatabase(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Database disconnect timeout')),
              10000,
            ),
          ),
        ]);
      } catch (error) {
        dbLogger.warn('Error closing database connection', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      clearTimeout(shutdownTimeout);
      this.serverLogger.info('Graceful shutdown completed successfully');
    } catch (error) {
      this.serverLogger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      exitCode = 1;
    } finally {
      // ✅ Salida controlada
      setTimeout(() => process.exit(exitCode), 100);
    }
  }

  // ✅ HEALTH CHECK OPTIMIZADO PARA RENDER
  public async performHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      database: boolean;
      redis: boolean;
      server: boolean;
    };
    uptime: number;
    timestamp: string;
    version: string;
    environment: string;
    memory: {
      used: number;
      total: number;
      rss: number;
    };
  }> {
    const services = {
      database: false,
      redis: false,
      server: false,
    };

    try {
      // ✅ Verificar servidor
      services.server =
        this.server !== null &&
        this.server.listening &&
        !this.isShuttingDown &&
        this.isInitialized;

      // ✅ Verificar Redis con timeout corto (no crítico)
      try {
        if (redisConnection.isHealthy()) {
          const redisClient = redisConnection.getClient();
          await Promise.race([
            redisClient.ping(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Redis timeout')), 2000),
            ),
          ]);
          services.redis = true;
        }
      } catch (_error) {
        // ✅ Usar _error para indicar que es intencionalmente ignorado
        services.redis = false;
      }

      // ✅ Verificar base de datos con timeout generoso
      try {
        await Promise.race([
          db.$queryRaw`SELECT 1`,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database timeout')), 8000),
          ),
        ]);
        services.database = true;
        this.consecutiveHealthCheckFailures = 0;
      } catch (error) {
        services.database = false;
        this.consecutiveHealthCheckFailures++;

        // Solo log errores persistentes
        if (this.consecutiveHealthCheckFailures > 5) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.serverLogger.warn('Persistent database health check failure', {
            error: errorMessage,
            failures: this.consecutiveHealthCheckFailures,
          });
        }
      }

      // ✅ Considerar saludable si servidor y DB funcionan
      const isHealthy = services.server && services.database;
      const memUsage = process.memoryUsage();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
      };
    } catch (error) {
      this.consecutiveHealthCheckFailures++;

      if (this.consecutiveHealthCheckFailures > 10) {
        this.serverLogger.error('Critical health check failure', {
          error: error instanceof Error ? error.message : String(error),
          failures: this.consecutiveHealthCheckFailures,
        });
      }

      return {
        status: 'unhealthy',
        services,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        memory: {
          used: 0,
          total: 0,
          rss: 0,
        },
      };
    }
  }

  // ✅ UTILIDADES PRIVADAS
  private isDatabaseAvailable(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  private getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };
  }

  // ✅ GETTERS PÚBLICOS
  public getServerStats(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    version: string;
    environment: string;
    pid: number;
    nodeVersion: string;
    platform: string;
    arch: string;
    isInitialized: boolean;
    consecutiveFailures: number;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: environment.app.env,
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      isInitialized: this.isInitialized,
      consecutiveFailures: this.consecutiveHealthCheckFailures,
    };
  }

  public getApp(): App {
    return this.app;
  }

  public isRunning(): boolean {
    return (
      this.server !== null &&
      this.server.listening &&
      !this.isShuttingDown &&
      this.isInitialized
    );
  }

  public getServer(): Server | null {
    return this.server;
  }
}

// ✅ INSTANCIA DEL SERVIDOR
const authServer = new AuthServer();

// ✅ Iniciar el servidor solo si es el módulo principal
if (require.main === module) {
  authServer.start().catch((error) => {
    logger.fatal('Failed to start server', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    });
    process.exit(1);
  });
}

export default authServer;
export { AuthServer };
