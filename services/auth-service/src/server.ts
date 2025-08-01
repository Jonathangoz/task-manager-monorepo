// src/server.ts - Auth Service Server
// Servidor HTTP con inicialización de dependencias y shutdown graceful
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
  healthCheck 
} from '@/utils/logger';
import { 
  connectDatabase, 
  disconnectDatabase, 
  cleanupExpiredTokens, 
  cleanupExpiredSessions,
  db
} from '@/config/database';
import { redisConnection } from '@/config/redis';

// CLASE DEL SERVIDOR AUTH
class AuthServer {
  private app: App;
  private server: Server | null = null;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private isShuttingDown = false;
  private readonly serverLogger = createContextLogger({ component: 'server' });
  private consecutiveHealthCheckFailures = 0;

  constructor() {
    this.app = new App();
  }

  // INICIO DEL SERVIDOR
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

  // INICIALIZACIÓN DE BASE DE DATOS
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

  // INICIALIZACIÓN DE REDIS
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

  // CONFIGURACIÓN DE TRABAJOS DE LIMPIEZA
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

  // INICIO DEL SERVIDOR HTTP
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

        if (!this.server) {
          const error = new Error('Server object failed to initialize.');
          this.serverLogger.error('Failed to start HTTP server', { error });
          return reject(error);
        }

        // Configurar timeouts del servidor - OPTIMIZADOS
      this.server.timeout = 60000;          // Era 45s, ahora 60s
      this.server.keepAliveTimeout = 90000;  // Era 75s, ahora 90s  
      this.server.headersTimeout = 91000;    // Era 76s, ahora 91s
      this.server.maxHeadersCount = 1000;    // Mantener
      this.server.requestTimeout = 50000;    // Era 40s, ahora 50s

        // Configurar límites de conexión
        this.server.maxConnections = 1000;
        
        // Configurar eventos del servidor
        this.server.on('connection', (socket: Socket) => {
          // Configurar timeouts de socket más permisivos
          socket.setTimeout(60000); // 60 segundos para socket timeout
          socket.setKeepAlive(true, 30000); // Keep alive cada 30 segundos
          
          socket.on('timeout', () => {
            this.serverLogger.warn('Socket timeout', {
              remoteAddress: socket.remoteAddress || 'unknown',
              remotePort: socket.remotePort || 'unknown'
            });
            socket.destroy();
          });
        });

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

        // Manejar errores de cliente de forma más silenciosa
        this.server.on('clientError', (error, socket: Socket) => {
          // Solo log si no es un error común de health check
          if (!error.message.includes('ECONNRESET') && !error.message.includes('EPIPE')) {
            this.serverLogger.warn('Client error', { 
              error: error.message,
              remoteAddress: socket.remoteAddress || 'unknown',
              remotePort: socket.remotePort || 'unknown'
            });
          }
          
          if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          }
        });

        // Evento para cuando el servidor está listo
        this.server.on('listening', () => {
          // Solo mostrar timeouts si el servidor existe
          const timeouts = this.server ? {
            server: this.server.timeout,
            keepAlive: this.server.keepAliveTimeout,
            headers: this.server.headersTimeout,
            request: this.server.requestTimeout
          } : undefined;

          this.serverLogger.info('Server is ready to accept connections', {
            port: environment.app.port,
            timeouts
          });
        });

      } catch (error) {
        this.serverLogger.error('Failed to start HTTP server', { error });
        reject(error);
      }
    });
  }

  // CONFIGURACIÓN DE SHUTDOWN GRACEFUL
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

  // SHUTDOWN GRACEFUL
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
    }, 30000); // antes 15 segundos de timeout ahora 30s

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

  // HEALTH CHECK
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

      // Verificar Redis con timeout MUY corto
      try {
        services.redis = redisConnection.isHealthy();
        if (services.redis) {
          // Test rápido de Redis usando el cliente
          const redisClient = redisConnection.getClient();
          await Promise.race([
            redisClient.ping(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Redis timeout')), 3000) // antes 1000 - 1 segundo ahora 3s
            )
          ]);
        }
      } catch (error) {
        services.redis = false;
      }
      // Verificar base de datos con timeout MUY corto
      try {
        await Promise.race([
          db.$queryRaw`SELECT 1`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout')), 5000) // antes 2000 - 2 segundos ahora 5s
          )
        ]);
        services.database = true;
      } catch (error) {
        services.database = false;
        // Solo log si es un error persistente (no cada health check)
        if (this.consecutiveHealthCheckFailures > 3) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.serverLogger.warn('Persistent database health check failure', {
            error: errorMessage,
            failures: this.consecutiveHealthCheckFailures
          });
        }
      }

      const isHealthy = services.server && services.database; // Redis no es crítico
      const memUsage = process.memoryUsage();

      // Resetear counter de fallos si está saludable
      if (isHealthy) {
        this.consecutiveHealthCheckFailures = 0;
      } else {
        this.consecutiveHealthCheckFailures++;
      }

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
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

    } catch (error) {
      this.consecutiveHealthCheckFailures++;
      
      // Solo log errores de health check si son persistentes
      if (this.consecutiveHealthCheckFailures > 5) {
        this.serverLogger.error('Persistent health check failure', { 
          error: error instanceof Error ? error.message : String(error),
          failures: this.consecutiveHealthCheckFailures
        });
      }
      
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

  // ESTADÍSTICAS DEL SERVIDOR
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

  // GETTERS PÚBLICOS
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

// INSTANCIA DEL SERVIDOR
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