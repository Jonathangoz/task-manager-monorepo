// auth-service/src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from '@/config/environment';
import { logger, httpLogger } from '@/utils/logger';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/utils/constants';

// Middlewares
import { errorMiddleware } from '@/middlewares/error.middleware';
import { rateLimitMiddleware } from '@/middlewares/rateLimit.middleware';

// Routes
import authRoutes from '@/routes/auth.routes';
import userRoutes from '@/routes/user.routes';
import healthRoutes from '@/routes/health.routes';

class App {
  public app: Express;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    if (config.security.helmetEnabled) {
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
    }

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Refresh-Token',
        'X-Session-Id',
        'X-CSRF-Token'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count']
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true 
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));
    
    // Cookie parser middleware
    this.app.use(cookieParser());

    // HTTP request logging
    const morganFormat = config.app.env === 'production' 
      ? 'combined' 
      : 'dev';

    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => {
          httpLogger.info(message.trim());
        }
      }
    }));

    // Rate limiting
    if (config.rateLimit.enabled) {
      this.app.use(rateLimitMiddleware);
    }

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          requestId: req.id,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress,
        };

        if (res.statusCode >= 400) {
          httpLogger.warn(logData, 'HTTP Request Warning');
        } else {
          httpLogger.info(logData, 'HTTP Request');
        }
      });

      next();
    });
  }

  private initializeRoutes(): void {
    const apiV1 = `/api/${config.app.apiVersion}`;
    
    // Health check routes (before auth)
    if (config.features.healthCheck) {
      this.app.use(healthRoutes);
    }

    // API routes
    this.app.use(`${apiV1}/auth`, authRoutes);
    this.app.use(`${apiV1}/users`, userRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Task Manager Auth Service API',
        version: config.app.apiVersion,
        timestamp: new Date().toISOString(),
        environment: config.app.env,
        documentation: config.features.swagger ? `${config.features.swaggerPath}` : null
      });
    });

    // 404 handler for unmatched routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        error: {
          code: 'ROUTE_NOT_FOUND',
          details: {
            method: req.method,
            path: req.originalUrl,
            timestamp: new Date().toISOString()
          }
        }
      });
    });
  }

  private initializeSwagger(): void {
    if (!config.features.swagger) return;

    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Task Manager Auth Service API',
          version: '1.0.0',
          description: 'Microservicio de autenticación para Task Manager',
          contact: {
            name: 'Task Manager Team',
            email: 'dev@taskmanager.com'
          },
        },
        servers: [
          {
            url: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
            description: 'Development server'
          },
          {
            url: `https://auth-service.render.com/api/${config.app.apiVersion}`,
            description: 'Production server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            },
            refreshToken: {
              type: 'apiKey',
              in: 'header',
              name: 'X-Refresh-Token'
            },
            sessionId: {
              type: 'apiKey',
              in: 'header',
              name: 'X-Session-Id'
            }
          },
          responses: {
            Unauthorized: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      message: { type: 'string', example: 'Authentication required' },
                      error: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'TOKEN_REQUIRED' }
                        }
                      }
                    }
                  }
                }
              }
            },
            Forbidden: {
              description: 'Access forbidden',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      message: { type: 'string', example: 'Access forbidden' },
                      error: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'ACCESS_DENIED' }
                        }
                      }
                    }
                  }
                }
              }
            },
            ValidationError: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      message: { type: 'string', example: 'Validation failed' },
                      error: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', example: 'VALIDATION_ERROR' },
                          details: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                field: { type: 'string' },
                                message: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        security: [
          {
            bearerAuth: []
          }
        ]
      },
      apis: [
        './src/presentation/routes/*.ts',
        './src/presentation/controllers/*.ts'
      ]
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    
    this.app.use(config.features.swaggerPath, swaggerUi.serve);
    this.app.get(config.features.swaggerPath, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Auth Service API Documentation'
    }));

    logger.info(`Swagger documentation available at ${config.features.swaggerPath}`);
  }

  private initializeErrorHandling(): void {
    // Global error handler (debe ser el último middleware)
    this.app.use(errorMiddleware);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({
        reason,
        promise
      }, 'Unhandled Promise Rejection');
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught Exception');
      process.exit(1);
    });
  }

  public getApp(): Express {
    return this.app;
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        id: string;
        email: string;
        username: string;
        sessionId: string;
      };
    }
  }
}

export default App;