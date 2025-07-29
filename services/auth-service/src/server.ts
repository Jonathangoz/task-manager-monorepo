// ==============================================
// src/server.ts - Auth Service Server
// Servidor HTTP con inicialización de dependencias y shutdown graceful
// ==============================================

import { Server } from 'http';
import App from './app';
import { environment } from '@/config/environment';
import { 
  logger, 
  dbLogger, 
  redisLogger, 
  startup,
  createContextLogger,
  healthCheck 
} from '@/utils/logger';
import { 
  connectDatabase, 
  disconnectDatabase, 
  cleanupExpiredTokens, 
  cleanupExpiredSessions 
} from '@/config/database';
import { redisConnection } from '@/config/redis';

// ==============================================
// CLASE DEL SERVIDOR AUTH
// ==============================================
class AuthServer {
  private app: App;
  private server: Server | null = null;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private isShuttingDown = false;
  private readonly serverLogger = createContextLogger({ component: 'server' });

  constructor() {
    this.app = new App();
  }

  // ==============================================
  // INICIO DEL SERVIDOR
  // ==============================================
  public async start(): Promise<void> {
    try {
      startup.serviceStarted(environment.app.port, environment.app.env);

      // Inicializar dependencias en orden
      await this.initializeDatabase();
      await this.initializeRedis();
      
      // Configurar trabajos de limpieza
      this.setupCleanupJobs();
      
      // Iniciar servidor HTTP
      await this.startHttpServer();
      
      // Configurar shutdown graceful
      this.setupGracefulShutdown();
      
      this.serverLogger.info('Auth Service started successfully', {
        port: environment.app.port,
        env: environment.app.env,
        apiVersion: environment.app.apiVersion,
        logLevel: environment.logging.level,
        features: {
          healthCheck: environment.features.healthCheckEnabled,
          swagger: environment.features.swaggerEnabled,
          emailVerification: environment.features.emailVerificationEnabled
        }
      });

    } catch (error) {
      this.serverLogger.fatal('Failed to start Auth Service', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      await this.shutdown(1);
    }
  }

  // ==============================================
  // INICIALIZACIÓN DE BASE DE DATOS
  // ==============================================
  private async initializeDatabase(): Promise<void> {
    try {
      startup.dependencyConnected('PostgreSQL Database');
      await connectDatabase();
      dbLogger.info('Database initialized successfully', {
        url: environment.database.url.replace(/\/\/.*@/, '//***@'), // Ocultar credenciales
      });
    } catch (error) {
      dbLogger.error('Database initialization failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ==============================================
  // INICIALIZACIÓN DE REDIS
  // ==============================================
  private async initializeRedis(): Promise<void> {
    try {
      startup.dependencyConnected('Redis Cache');
      await redisConnection.connect();
      redisLogger.info('Redis initialized successfully', {
        url: environment.redis.url.replace(/\/\/.*@/, '//***@'), // Ocultar credenciales
        prefix: environment.redis.prefix
      });
    } catch (error) {
      redisLogger.error('Redis initialization failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ==============================================
  // CONFIGURACIÓN DE TRABAJOS DE LIMPIEZA
  // ==============================================
  private setupCleanupJobs(): void {
    this.serverLogger.info('Setting up cleanup jobs...');

    // Cleanup de tokens expirados - cada hora
    const tokenCleanupInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        this.serverLogger.debug('Running token cleanup job...');
        await cleanupExpiredTokens();
      } catch (error) {
        this.serverLogger.error('Token cleanup job failed', { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60 * 60 * 1000); // 1 hora

    // Cleanup de sesiones expiradas - cada 30 minutos
    const sessionCleanupInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        this.serverLogger.debug('Running session cleanup job...');
        await cleanupExpiredSessions();
      } catch (error) {
        this.serverLogger.error('Session cleanup job failed', { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 30 * 60 * 1000); // 30 minutos

    this.cleanupIntervals.push(tokenCleanupInterval, sessionCleanupInterval);
    
    this.serverLogger.info('Cleanup jobs scheduled successfully', {
      tokenCleanupInterval: '1 hour',
      sessionCleanupInterval: '30 minutes'
    });
  }

  // ==============================================
  // INICIO DEL SERVIDOR HTTP
  // ==============================================
  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.getApp().listen(environment.app.port, '0.0.0.0', () => {
          this.serverLogger.info('HTTP server listening', {
            port: environment.app.port,
            host: '0.0.0.0',
            environment: environment.app.env
          });
          resolve();
        });

        // Configurar timeouts del servidor
        this.server.timeout = 30000; // 30 segundos
        this.server.keepAliveTimeout = 65000; // 65 segundos
        this.server.headersTimeout = 66000; // 66 segundos
        this.server.maxHeadersCount = 1000; // Máximo headers por request

        // Manejar errores del servidor
        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            this.serverLogger.error(`Port ${environment.app.port} is already in use`, {
              port: environment.app.port,
              code: error.code
            });
          } else {
            this.serverLogger.error('Server error', { 
              error: {
                message: error.message,
                code: error.code,
                errno: error.errno
              }
            });
          }
          reject(error);
        });

        // Manejar errores de cliente
        this.server.on('clientError', (error, socket) => {
          this.serverLogger.warn('Client error', { 
            error: error.message,
            remoteAddress: socket,
            remotePort: socket
          });
          if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          }
        });

      } catch (error) {
        this.serverLogger.error('Failed to start HTTP server', { error });
        reject(error);
      }
    });
  }

  // ==============================================
  // CONFIGURACIÓN DE SHUTDOWN GRACEFUL
  // ==============================================
  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        startup.gracefulShutdown(signal);
        await this.shutdown(0);
      });
    });

    // Manejar excepciones no capturadas
    process.on('uncaughtException', async (error) => {
      this.serverLogger.fatal('Uncaught exception', { 
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
      await this.shutdown(1);
    });

    // Manejar promesas rechazadas no manejadas
    process.on('unhandledRejection', async (reason, promise) => {
      this.serverLogger.fatal('Unhandled promise rejection', { 
        reason: reason instanceof Error ? {
          message: reason.message,
          stack: reason.stack,
          name: reason.name
        } : reason,
        promise: promise.toString()
      });
      await this.shutdown(1);
    });

    // Manejar salida del proceso
    process.on('exit', (code) => {
      this.serverLogger.info('Process exiting', { exitCode: code });
    });
  }

  // ==============================================
  // SHUTDOWN GRACEFUL
  // ==============================================
  public async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      this.serverLogger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.serverLogger.info('Starting graceful shutdown...', { exitCode });

    const shutdownTimeout = setTimeout(() => {
      this.serverLogger.error('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 15000); // 15 segundos de timeout

    try {
      // Detener aceptación de nuevas conexiones
      if (this.server) {
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

      // Detener trabajos de limpieza
      this.serverLogger.info('Stopping cleanup jobs...');
      this.cleanupIntervals.forEach(interval => clearInterval(interval));
      this.cleanupIntervals = [];

      // Cerrar conexión Redis
      if (redisConnection.isHealthy()) {
        redisLogger.info('Closing Redis connection...');
        await redisConnection.disconnect();
      }

      // Cerrar conexión de base de datos
      dbLogger.info('Closing database connection...');
      await disconnectDatabase();

      clearTimeout(shutdownTimeout);
      this.serverLogger.info('Graceful shutdown completed successfully');

    } catch (error) {
      this.serverLogger.error('Error during shutdown', { 
        error: error instanceof Error ? error.message : String(error)
      });
      exitCode = 1;
    } finally {
      // Forzar salida si no ha salido naturalmente
      setTimeout(() => process.exit(exitCode), 100);
    }
  }

  // ==============================================
  // HEALTH CHECK
  // ==============================================
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
      server: false
    };

    try {
      // Verificar servidor
      services.server = this.server !== null && this.server.listening && !this.isShuttingDown;

      // Verificar Redis
      services.redis = redisConnection.isHealthy();

      // Verificar base de datos (test de conexión simple)
      try {
        const { db } = await import('@/config/database');
        await db.$queryRaw`SELECT 1`;
        services.database = true;
        healthCheck.passed('database', 0);
      } catch (error) {
        services.database = false;
        healthCheck.failed('database', error as Error, 0);
      }

      const isHealthy = Object.values(services).every(status => status);
      const memUsage = process.memoryUsage();

      const healthData = {
        status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
        services,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        }
      };

      if (isHealthy) {
        healthCheck.passed('auth-service', 0, { services });
      } else {
        healthCheck.degraded('auth-service', 'Some services are unhealthy', 0);
      }

      return healthData;

    } catch (error) {
      this.serverLogger.error('Health check failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      healthCheck.failed('auth-service', error as Error, 0);
      
      return {
        status: 'unhealthy',
        services,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        memory: {
          used: 0,
          total: 0,
          rss: 0
        }
      };
    }
  }

  // ==============================================
  // ESTADÍSTICAS DEL SERVIDOR
  // ==============================================
  public getServerStats(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    version: string;
    environment: string;
    pid: number;
    nodeVersion: string;
    platform: string;
    arch: string;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: environment.app.env,
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  // ==============================================
  // GETTERS PÚBLICOS
  // ==============================================
  public getApp(): App {
    return this.app;
  }

  public isRunning(): boolean {
    return this.server !== null && this.server.listening && !this.isShuttingDown;
  }

  public getServer(): Server | null {
    return this.server;
  }
}

// ==============================================
// INSTANCIA DEL SERVIDOR
// ==============================================
const authServer = new AuthServer();

// Iniciar el servidor solo si es el módulo principal
if (require.main === module) {
  authServer.start().catch((error) => {
    logger.fatal('Failed to start server', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    process.exit(1);
  });
}

// Export para testing y uso externo
export default authServer;
export { AuthServer };