// src/server.ts
import { Server } from 'http';
import App from './app';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { connectDatabase, disconnectDatabase, cleanupExpiredTokens, cleanupExpiredSessions } from '@/config/database';
import { redisConnection } from '@/config/redis';

class AuthServer {
  private app: App;
  private server: Server | null = null;
  private cleanupIntervals: NodeJS.Timeout[] = [];

  constructor() {
    this.app = new App();
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await this.initializeDatabase();
      
      // Initialize Redis connection
      await this.initializeRedis();
      
      // Setup cleanup jobs
      this.setupCleanupJobs();
      
      // Start HTTP server
      await this.startHttpServer();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info({
        port: config.app.port,
        env: config.app.env,
        apiVersion: config.app.apiVersion
      }, 'Auth Service started successfully');

    } catch (error) {
      logger.fatal({ error }, 'Failed to start Auth Service');
      await this.shutdown(1);
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await connectDatabase();
      logger.info('Database connection initialized');
    } catch (error) {
      logger.error({ error }, 'Database initialization failed');
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      await redisConnection.connect();
      logger.info('Redis connection initialized');
    } catch (error) {
      logger.error({ error }, 'Redis initialization failed');
      throw error;
    }
  }

  private setupCleanupJobs(): void {
    // Cleanup expired tokens every hour
    const tokenCleanupInterval = setInterval(async () => {
      try {
        await cleanupExpiredTokens();
      } catch (error) {
        logger.error({ error }, 'Token cleanup job failed');
      }
    }, 60 * 60 * 1000); // 1 hour

    // Cleanup expired sessions every 30 minutes
    const sessionCleanupInterval = setInterval(async () => {
      try {
        await cleanupExpiredSessions();
      } catch (error) {
        logger.error({ error }, 'Session cleanup job failed');
      }
    }, 30 * 60 * 1000); // 30 minutes

    this.cleanupIntervals.push(tokenCleanupInterval, sessionCleanupInterval);
    
    logger.info('Cleanup jobs scheduled');
  }

  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.getApp().listen(config.app.port, '0.0.0.0', () => {
          logger.info(`Server listening on port ${config.app.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error({ error }, 'Server error');
          reject(error);
        });

        // Set server timeouts
        this.server.timeout = 30000; // 30 seconds
        this.server.keepAliveTimeout = 65000; // 65 seconds
        this.server.headersTimeout = 66000; // 66 seconds

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupGracefulShutdown(): void {
    // Handle various shutdown signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown(0);
      });
    });

    // Handle process exit
    process.on('exit', (code) => {
      logger.info(`Process exiting with code: ${code}`);
    });
  }

  public async shutdown(exitCode: number = 0): Promise<void> {
    logger.info('Starting graceful shutdown...');

    try {
      // Stop accepting new connections
      if (this.server) {
        logger.info('Closing HTTP server...');
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Clear cleanup intervals
      this.cleanupIntervals.forEach(interval => clearInterval(interval));
      logger.info('Cleanup jobs stopped');

      // Close Redis connection
      if (redisConnection.isHealthy()) {
        logger.info('Closing Redis connection...');
        await redisConnection.disconnect();
      }

      // Close database connection
      logger.info('Closing database connection...');
      await disconnectDatabase();

      logger.info('Graceful shutdown completed');

    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      exitCode = 1;
    } finally {
      process.exit(exitCode);
    }
  }

  // Health check method for monitoring
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      database: boolean;
      redis: boolean;
      server: boolean;
    };
    timestamp: string;
  }> {
    const services = {
      database: false,
      redis: false,
      server: false
    };

    try {
      // Check database
      services.database = true; // Will be checked in health route

      // Check Redis
      services.redis = redisConnection.isHealthy();

      // Check server
      services.server = this.server !== null && this.server.listening;

      const isHealthy = Object.values(services).every(status => status);

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return {
        status: 'unhealthy',
        services,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create and start server
const authServer = new AuthServer();

// Start the server
if (require.main === module) {
  authServer.start().catch((error) => {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  });
}

export default authServer;
export { AuthServer };