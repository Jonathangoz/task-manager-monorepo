// ==============================================
// src/app.ts - Task Service API Contract
// Punto único de comunicación Frontend <-> Backend
// ==============================================

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

// Routes
import taskRoutes from '@/presentation/routes/task.routes';
import categoryRoutes from '@/presentation/routes/category.routes';
import healthRoutes from '@/presentation/routes/health.routes';

// Middlewares
import { errorMiddleware } from '@/presentation/middlewares/error.middleware';
import { rateLimitMiddleware } from '@/presentation/middlewares/rateLimit.middleware';

// Utils
import { logger } from '@/utils/logger';
import { setupSwagger } from '@/utils/swagger';
import { config } from '@/config/environment';
import { HTTP_STATUS, ERROR_CODES, ERROR_MESSAGES } from '@/utils/constants';

class TaskServiceApp {
  private app: Application;
  private readonly API_PREFIX = `/api/${config.app.apiVersion}`;

  constructor() {
    this.app = express();
    this.initializeSecurityMiddlewares();
    this.initializeGeneralMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  private initializeSecurityMiddlewares(): void {
    // Helmet para headers de seguridad
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configurado para múltiples orígenes
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID'
      ],
    }));

    // Rate limiting global
    if (config.rateLimit.enabled) {
      this.app.use(rateLimitMiddleware);
    }
  }

  private initializeGeneralMiddlewares(): void {
    // Compresión de respuestas
    this.app.use(compression());

    // Parsing de cookies
    this.app.use(cookieParser());

    // Parsing de JSON con límite
    this.app.use(express.json({
      limit: '10mb',
      verify: (req: Request, res: Response, buf: Buffer) => {
        try {
          JSON.parse(buf.toString());
        } catch (e) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid JSON format',
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              details: 'Request body contains invalid JSON'
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] as string
            }
          });
          throw new Error('Invalid JSON');
        }
      }
    }));

    // Parsing de URL encoded
    this.app.use(express.urlencoded({ extended: true }));

    // Logger HTTP
    if (config.app.env !== 'test') {
      this.app.use(morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim(), 'HTTP Request');
          }
        }
      }));
    }

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || 
                       `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info({
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.headers['x-request-id']
      }, 'Incoming request');
      next();
    });
  }

  private initializeRoutes(): void {
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Task Manager - Task Service API',
        data: {
          service: 'task-service',
          version: config.app.apiVersion,
          environment: config.app.env,
          timestamp: new Date().toISOString(),
          endpoints: {
            health: `${this.API_PREFIX}/health`,
            docs: config.swagger.enabled ? `${this.API_PREFIX}/docs` : 'disabled',
            tasks: `${this.API_PREFIX}/tasks`,
            categories: `${this.API_PREFIX}/categories`,
            stats: `${this.API_PREFIX}/stats`
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
    });

    // API Routes - Contrato único con el Frontend
    this.app.use(`${this.API_PREFIX}/health`, healthRoutes);
    this.app.use(`${this.API_PREFIX}/tasks`, taskRoutes);
    this.app.use(`${this.API_PREFIX}/categories`, categoryRoutes);

    // Catch-all para rutas no encontradas
    this.app.all('*', (req: Request, res: Response) => {
      logger.warn({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      }, 'Route not found');

      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`,
        error: {
          code: ERROR_CODES.NOT_FOUND,
          details: {
            method: req.method,
            path: req.url,
            availableEndpoints: [
              `GET ${this.API_PREFIX}/health`,
              `GET ${this.API_PREFIX}/tasks`,
              `POST ${this.API_PREFIX}/tasks`,
              `GET ${this.API_PREFIX}/categories`,
              `POST ${this.API_PREFIX}/categories`
            ]
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
    });
  }

  private initializeSwagger(): void {
    if (config.swagger.enabled) {
      setupSwagger(this.app, this.API_PREFIX);
      logger.info(`Swagger documentation available at ${this.API_PREFIX}/docs`);
    }
  }

  private initializeErrorHandling(): void {
    // Global error handler - debe ir al final
    this.app.use(errorMiddleware);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error({
        reason,
        promise: promise.toString()
      }, 'Unhandled promise rejection');
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.fatal({ error }, 'Uncaught exception');
      process.exit(1);
    });
  }

  // Método para obtener la instancia de Express
  public getApp(): Application {
    return this.app;
  }

  // Método para configurar el puerto y hostname
  public listen(port: number, hostname?: string): void {
    const server = this.app.listen(port, hostname, () => {
      logger.info({
        port,
        hostname: hostname || 'localhost',
        environment: config.app.env,
        apiVersion: config.app.apiVersion,
        nodeVersion: process.version,
        pid: process.pid
      }, 'Task Service started successfully');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }
}

// Exportar instancia singleton
export default new TaskServiceApp();