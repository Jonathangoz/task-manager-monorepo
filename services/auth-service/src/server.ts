// src/server.ts - Auth Service Server - ✅ OPTIMIZADO PARA RENDER.COM
import { Server } from 'http';
import { Socket } from 'net';
import App from './app';
import { environment } from '@/config/environment';
import {
  dbLogger,
  redisLogger,
  startup,
  createContextLogger,
} from '@/utils/logger';
import {
  connectDatabase,
  disconnectDatabase,
  cleanupExpiredTokens,
  cleanupExpiredSessions,
  db,
} from '@/config/database';
import { redisConnection } from '@/config/redis';

// ✅ CONFIGURAR MANEJO DE ERRORES GLOBAL ANTES DE CUALQUIER OTRA COSA
process.on('uncaughtException', (error: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION - Server startup failed:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
  });

  // En Render, es mejor salir inmediatamente para que reinicie el contenedor
  process.exit(1);
});

process.on(
  'unhandledRejection',
  (reason: unknown, promise: Promise<unknown>) => {
    console.error('💥 UNHANDLED REJECTION - Server startup failed:', {
      reason:
        reason instanceof Error
          ? {
              message: reason.message,
              stack: reason.stack,
              name: reason.name,
            }
          : reason,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    });

    // En Render, salir inmediatamente para reinicio
    process.exit(1);
  },
);

class AuthServer {
  private app: App | null = null;
  private server: Server | null = null;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private isShuttingDown = false;
  private readonly serverLogger = createContextLogger({ component: 'server' });
  private consecutiveHealthCheckFailures = 0;
  private isInitialized = false;
  public isReady = false;

  constructor() {
    // No inicializar App en el constructor para evitar errores tempranos
  }

  // ✅ INICIO DEL SERVIDOR CON MEJOR MANEJO DE ERRORES
  public async start(): Promise<void> {
    try {
      this.serverLogger.info('🚀 Starting Auth Service...', {
        nodeVersion: process.version,
        environment: environment.app.env,
        port: environment.app.port,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      });

      // ✅ PASO 1: Verificar configuración crítica ANTES de inicializar
      await this.validateCriticalConfig();

      // ✅ PASO 2: Inicializar App con manejo de errores
      this.serverLogger.info('📦 Initializing Express application...');
      this.app = new App();

      // ✅ PASO 3: Iniciar servidor HTTP INMEDIATAMENTE (para health checks de Render)
      await this.startHttpServer();

      // ✅ PASO 4: Inicializar dependencias en background
      this.initializeDependenciesInBackground();

      // ✅ PASO 5: Configurar shutdown graceful
      this.setupGracefulShutdown();

      this.isInitialized = true;
      startup.serviceStarted(environment.app.port, environment.app.env);
    } catch (error) {
      this.serverLogger.fatal('❌ Failed to start Auth Service', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      });

      // En caso de error durante startup, salir inmediatamente
      process.exit(1);
    }
  }

  // ✅ VALIDACIÓN DE CONFIGURACIÓN CRÍTICA
  private async validateCriticalConfig(): Promise<void> {
    this.serverLogger.info('🔍 Validating critical configuration...');

    const criticalVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET',
      'JWE_SECRET',
      'AUTH_SERVICE_API_KEY',
    ];

    const missingVars: string[] = [];

    for (const varName of criticalVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      const error = new Error(
        `❌ Missing critical environment variables: ${missingVars.join(', ')}`,
      );
      this.serverLogger.fatal('Configuration validation failed', {
        missingVariables: missingVars,
        availableVariables: Object.keys(process.env).filter(
          (key) =>
            key.startsWith('DATABASE_') ||
            key.startsWith('JWT_') ||
            key.startsWith('REDIS_') ||
            key.includes('SECRET'),
        ),
      });
      throw error;
    }

    // Validar formato de secrets
    try {
      if (environment.jwt.secret.length < 32) {
        throw new Error('JWT_SECRET is too short');
      }
      if (environment.refreshToken.secret.length < 32) {
        throw new Error('REFRESH_TOKEN_SECRET is too short');
      }
    } catch (error) {
      this.serverLogger.fatal('Secret validation failed', { error });
      throw error;
    }

    this.serverLogger.info('✅ Critical configuration validated successfully');
  }

  // ✅ INICIALIZACIÓN DE DEPENDENCIAS EN BACKGROUND
  private initializeDependenciesInBackground(): void {
    // No usar async/await aquí - usar Promises para no bloquear
    this.initializeDependencies()
      .then(() => {
        this.isReady = true;
        this.serverLogger.info(
          '✅ All dependencies initialized. Service is fully ready.',
        );
        this.setupCleanupJobs();
      })
      .catch((error) => {
        this.serverLogger.error(
          '⚠️ Failed to initialize some dependencies, but server will continue running',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );

        // Marcar como parcialmente listo para que los health checks básicos funcionen
        this.isReady = true;
      });
  }

  // ✅ INICIALIZACIÓN DE DEPENDENCIAS CON MEJOR TOLERANCIA A FALLOS
  private async initializeDependencies(): Promise<void> {
    const results = await Promise.allSettled([
      this.initializeDatabase(),
      this.initializeRedis(),
    ]);

    let hasErrors = false;
    results.forEach((result, index) => {
      const depName = index === 0 ? 'Database' : 'Redis';

      if (result.status === 'rejected') {
        hasErrors = true;
        this.serverLogger.warn(`${depName} initialization failed`, {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      } else {
        this.serverLogger.info(`${depName} initialized successfully`);
      }
    });

    if (hasErrors) {
      this.serverLogger.warn(
        'Some dependencies failed to initialize, but service will continue',
      );
    }
  }

  // ✅ INICIALIZACIÓN DE BASE DE DATOS MÁS ROBUSTA
  private async initializeDatabase(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.serverLogger.info(
          `🗄️ Connecting to database (attempt ${attempt}/${maxRetries})...`,
        );

        // Timeout más generoso para Render
        const dbTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database connection timeout')),
            20000,
          ),
        );

        await Promise.race([connectDatabase(), dbTimeout]);

        // Verificar que la conexión funciona
        await Promise.race([
          db.$queryRaw`SELECT 1`,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Database query timeout')),
              10000,
            ),
          ),
        ]);

        startup.dependencyConnected('PostgreSQL Database');
        dbLogger.info('✅ Database connected successfully', {
          attempt,
          url: environment.database.url.replace(/\/\/.*@/, '//***@'),
        });
        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (attempt === maxRetries) {
          dbLogger.error('❌ Database connection failed after all retries', {
            attempts: maxRetries,
            lastError: errorMessage,
          });
          throw new Error(`Database connection failed: ${errorMessage}`);
        }

        // Delay exponencial con jitter
        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;

        dbLogger.warn(
          `⏳ Database connection failed, retrying in ${Math.round(delay)}ms...`,
          {
            attempt,
            maxRetries,
            error: errorMessage,
          },
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // ✅ INICIALIZACIÓN DE REDIS MÁS TOLERANTE
  private async initializeRedis(): Promise<void> {
    try {
      this.serverLogger.info('🔄 Connecting to Redis...');

      const redisTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000),
      );

      await Promise.race([redisConnection.connect(), redisTimeout]);

      startup.dependencyConnected('Redis Cache');
      redisLogger.info('✅ Redis connected successfully', {
        url: environment.redis.url.replace(/\/\/.*@/, '//***@'),
        prefix: environment.redis.prefix,
      });
    } catch (error) {
      // Redis es opcional - no debe fallar el startup completo
      redisLogger.warn(
        '⚠️ Redis initialization failed - continuing without cache',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      // No lanzar error - Redis es opcional
    }
  }

  // ✅ INICIO DEL SERVIDOR HTTP MEJORADO PARA RENDER
  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.app) {
        return reject(new Error('App not initialized'));
      }

      try {
        const port = environment.app.port;
        const host = '0.0.0.0'; // Importante para Render

        this.server = this.app.getApp().listen(port, host, () => {
          this.serverLogger.info('✅ HTTP server started successfully', {
            port,
            host,
            environment: environment.app.env,
            processId: process.pid,
          });
          resolve();
        });

        if (!this.server) {
          const error = new Error('Server failed to initialize');
          this.serverLogger.error('❌ Server initialization failed', { error });
          return reject(error);
        }

        // ✅ CONFIGURACIÓN DE TIMEOUTS PARA RENDER
        this.server.timeout = 120000; // 2 minutos
        this.server.keepAliveTimeout = 65000; // 65s
        this.server.headersTimeout = 66000; // 66s
        this.server.requestTimeout = 60000; // 60s
        this.server.maxHeadersCount = 100;
        this.server.maxConnections = 1000;

        // ✅ MANEJO DE ERRORES DEL SERVIDOR
        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            this.serverLogger.fatal(`❌ Port ${port} is already in use`, {
              port,
              code: error.code,
            });
          } else {
            this.serverLogger.fatal('❌ Server error during startup', {
              error: {
                message: error.message,
                code: error.code,
                errno: error.errno,
              },
            });
          }
          reject(error);
        });

        // ✅ MANEJO DE CONEXIONES OPTIMIZADO
        this.server.on('connection', (socket: Socket) => {
          socket.setTimeout(90000);
          socket.setKeepAlive(true, 45000);

          socket.on('timeout', () => {
            this.serverLogger.debug('Socket timeout (normal)', {
              remoteAddress: socket.remoteAddress || 'unknown',
            });
            socket.destroy();
          });

          socket.on('error', (socketError) => {
            // Solo log errores importantes
            const ignoredErrors = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'];
            if (
              !ignoredErrors.some((ignored) =>
                socketError.message.includes(ignored),
              )
            ) {
              this.serverLogger.debug('Socket error', {
                error: socketError.message,
                remoteAddress: socket.remoteAddress || 'unknown',
              });
            }
          });
        });

        // ✅ MANEJO SILENCIOSO DE ERRORES DE CLIENTE (health checks)
        this.server.on('clientError', (error, socket: Socket) => {
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

          // Solo log errores no comunes
          if (!isCommonError) {
            this.serverLogger.debug('Client error', {
              error: error.message,
              remoteAddress: socket.remoteAddress || 'unknown',
            });
          }

          if (socket.writable && !socket.destroyed) {
            try {
              socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            } catch {
              socket.destroy();
            }
          }
        });
      } catch (error) {
        this.serverLogger.fatal('❌ Failed to start HTTP server', { error });
        reject(error);
      }
    });
  }

  // ✅ CONFIGURACIÓN DE TRABAJOS DE LIMPIEZA MÁS SEGURA
  private setupCleanupJobs(): void {
    try {
      this.serverLogger.info('🧹 Setting up cleanup jobs...');

      if (!this.isDatabaseAvailable()) {
        this.serverLogger.warn(
          '⚠️ Database not available - skipping cleanup jobs',
        );
        return;
      }

      // Token cleanup - cada 4 horas (menos frecuente)
      const tokenCleanupInterval = setInterval(
        async () => {
          if (this.isShuttingDown || !this.isDatabaseAvailable()) return;

          try {
            await cleanupExpiredTokens();
            this.serverLogger.debug('✅ Token cleanup completed');
          } catch (error) {
            this.serverLogger.warn('⚠️ Token cleanup failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        4 * 60 * 60 * 1000,
      ); // 4 horas

      // Session cleanup - cada 2 horas
      const sessionCleanupInterval = setInterval(
        async () => {
          if (this.isShuttingDown || !this.isDatabaseAvailable()) return;

          try {
            await cleanupExpiredSessions();
            this.serverLogger.debug('✅ Session cleanup completed');
          } catch (error) {
            this.serverLogger.warn('⚠️ Session cleanup failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        2 * 60 * 60 * 1000,
      ); // 2 horas

      this.cleanupIntervals.push(tokenCleanupInterval, sessionCleanupInterval);

      this.serverLogger.info('✅ Cleanup jobs scheduled', {
        tokenCleanup: '4 hours',
        sessionCleanup: '2 hours',
      });
    } catch (error) {
      this.serverLogger.warn('⚠️ Failed to setup cleanup jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ✅ CONFIGURACIÓN DE SHUTDOWN GRACEFUL MEJORADA
  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.serverLogger.info(`📨 Received ${signal} signal`);
        startup.gracefulShutdown(signal);
        await this.shutdown(0);
      });
    });

    // ✅ Manejo de warnings menos verboso
    process.on('warning', (warning) => {
      // Solo log warnings críticos
      if (
        warning.name !== 'ExperimentalWarning' &&
        warning.name !== 'DeprecationWarning' &&
        warning.name !== 'MaxListenersExceededWarning'
      ) {
        this.serverLogger.warn('⚠️ Process warning', {
          name: warning.name,
          message: warning.message,
        });
      }
    });
  }

  // ✅ SHUTDOWN GRACEFUL OPTIMIZADO PARA RENDER
  public async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      this.serverLogger.warn('⚠️ Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.serverLogger.info('🛑 Starting graceful shutdown...', {
      exitCode,
      isInitialized: this.isInitialized,
      uptime: Math.round(process.uptime()),
    });

    // ✅ Timeout de shutdown más generoso para Render
    const shutdownTimeout = setTimeout(() => {
      this.serverLogger.error('⏰ Shutdown timeout - forcing exit');
      process.exit(1);
    }, 30000); // 30 segundos

    try {
      // ✅ PASO 1: Detener servidor HTTP
      if (this.server && this.server.listening) {
        this.serverLogger.info('🚪 Closing HTTP server...');
        await this.closeHttpServer();
      }

      // ✅ PASO 2: Detener trabajos de limpieza
      this.stopCleanupJobs();

      // ✅ PASO 3: Cerrar conexiones (con timeouts)
      await Promise.allSettled([this.closeRedis(), this.closeDatabase()]);

      clearTimeout(shutdownTimeout);
      this.serverLogger.info('✅ Graceful shutdown completed');
    } catch (error) {
      this.serverLogger.error('❌ Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      exitCode = 1;
    } finally {
      // Pequeño delay antes de salir
      setTimeout(() => {
        process.exit(exitCode);
      }, 100);
    }
  }

  private async closeHttpServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('HTTP server close timeout'));
      }, 10000);

      this.server.close((error) => {
        clearTimeout(timeout);
        if (error) {
          this.serverLogger.error('❌ Error closing HTTP server', { error });
          reject(error);
        } else {
          this.serverLogger.info('✅ HTTP server closed successfully');
          resolve();
        }
      });
    });
  }

  private stopCleanupJobs(): void {
    if (this.cleanupIntervals.length > 0) {
      this.serverLogger.info('🧹 Stopping cleanup jobs...');
      this.cleanupIntervals.forEach((interval) => clearInterval(interval));
      this.cleanupIntervals = [];
    }
  }

  private async closeRedis(): Promise<void> {
    try {
      if (redisConnection.isHealthy()) {
        redisLogger.info('🔄 Closing Redis connection...');
        await Promise.race([
          redisConnection.disconnect(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Redis disconnect timeout')),
              5000,
            ),
          ),
        ]);
        redisLogger.info('✅ Redis connection closed');
      }
    } catch (error) {
      redisLogger.warn('⚠️ Redis close error (non-critical)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async closeDatabase(): Promise<void> {
    try {
      if (this.isDatabaseAvailable()) {
        dbLogger.info('🗄️ Closing database connection...');
        await Promise.race([
          disconnectDatabase(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Database disconnect timeout')),
              15000,
            ),
          ),
        ]);
        dbLogger.info('✅ Database connection closed');
      }
    } catch (error) {
      dbLogger.warn('⚠️ Database close error', {
        error: error instanceof Error ? error.message : String(error),
      });
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
    ready: boolean;
  }> {
    const services = {
      database: false,
      redis: false,
      server: this.isServerListening(),
    };

    try {
      // ✅ Verificar base de datos con timeout corto
      if (this.isDatabaseAvailable()) {
        try {
          await Promise.race([
            db.$queryRaw`SELECT 1`,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('DB timeout')), 3000),
            ),
          ]);
          services.database = true;
          this.consecutiveHealthCheckFailures = 0;
        } catch {
          services.database = false;
          this.consecutiveHealthCheckFailures++;
        }
      }

      // ✅ Verificar Redis (no crítico)
      try {
        if (redisConnection.isHealthy()) {
          const client = redisConnection.getClient();
          await Promise.race([
            client.ping(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Redis timeout')), 1500),
            ),
          ]);
          services.redis = true;
        }
      } catch {
        services.redis = false;
      }

      // ✅ Estado saludable si el servidor está funcionando
      const isHealthy = services.server && this.isInitialized;
      const memUsage = process.memoryUsage();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        ready: this.isReady,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
      };
    } catch {
      this.consecutiveHealthCheckFailures++;

      return {
        status: 'unhealthy',
        services,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: environment.app.env,
        ready: false,
        memory: { used: 0, total: 0, rss: 0 },
      };
    }
  }

  // ✅ UTILIDADES
  public isServiceReady(): boolean {
    return this.isReady && this.isInitialized && !this.isShuttingDown;
  }

  public isServerListening(): boolean {
    return (
      this.isInitialized &&
      this.server !== null &&
      this.server.listening &&
      !this.isShuttingDown
    );
  }

  private isDatabaseAvailable(): boolean {
    try {
      return !!db && typeof db.$queryRaw === 'function';
    } catch {
      return false;
    }
  }

  // ✅ GETTERS PÚBLICOS
  public getServerStats() {
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
      isReady: this.isReady,
      consecutiveFailures: this.consecutiveHealthCheckFailures,
      serverListening: this.isServerListening(),
    };
  }

  public getApp(): App | null {
    return this.app;
  }

  public isRunning(): boolean {
    return this.isServerListening() && this.isInitialized;
  }

  public getServer(): Server | null {
    return this.server;
  }
}

// ✅ FUNCIÓN PRINCIPAL DE STARTUP CON MANEJO DE ERRORES ROBUSTO
async function startServer(): Promise<void> {
  const authServer = new AuthServer();

  try {
    console.warn('🚀 Starting Auth Service...');
    await authServer.start();
    console.info('✅ Auth Service started successfully');
  } catch (error) {
    console.error('💥 Failed to start Auth Service:', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
    });
    // Salir inmediatamente en caso de error
    process.exit(1);
  }
}

// ✅ INSTANCIA GLOBAL DEL SERVIDOR
const authServer = new AuthServer();

// ✅ Iniciar servidor solo si es el módulo principal
if (require.main === module) {
  startServer().catch((error) => {
    console.error('💥 Startup failed:', error);
    process.exit(1);
  });
}

export default authServer;
export { AuthServer };
