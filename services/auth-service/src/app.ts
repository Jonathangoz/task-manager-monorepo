// ==============================================
// src/app.ts - Auth Service Application
// Configuración principal de la aplicación Express con middlewares de seguridad optimizados
// ==============================================

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import timeout from 'connect-timeout';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Configuration
import { environment } from '@/config/environment';

// Utils
import { 
  logger, 
  httpLogger, 
  securityLogger, 
  createContextLogger 
} from '@/utils/logger';
import { 
  swaggerSpec, 
  swaggerUiOptions, 
  validateSwaggerSpec,
  getSwaggerInfo 
} from '@/utils/swagger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  REQUEST_HEADERS,
  MIDDLEWARE_CONFIG,
  TIMEOUT_CONFIG,
  RATE_LIMIT_CONFIG
} from '@/utils/constants';

// Middlewares
import { 
  ErrorMiddleware,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  payloadTooLargeHandler,
  timeoutHandler,
  jsonErrorHandler
} from '@/commons/middlewares/error.middleware';
import { 
  RateLimitMiddleware,
  rateLimitGeneral 
} from '@/commons/middlewares/rateLimit.middleware';

// Validation Middleware
import { validateRequest } from '@/commons/middlewares/validation.middleware';

// Routes
import { AuthRoutes } from '@/commons/routes/auth.routes';
import { UserRoutes } from '@/commons/routes/user.routes';
import { HealthRoutes } from '@/commons/routes/health.routes';

// ==============================================
// INTERFACES Y TIPOS
// ==============================================
interface AppRequest extends Request {
  correlationId?: string;
  requestId?: string;
  startTime?: number;
  clientIp?: string;
  deviceInfo?: {
    userAgent: string;
    platform?: string;
    browser?: string;
  };
}

interface SecurityConfig {
  helmet: any;
  cors: cors.CorsOptions;
  rateLimit: any;
  slowDown: any;
}

// ==============================================
// ESQUEMAS ZOD PARA VALIDACIÓN
// ==============================================
const RequestHeadersSchema = z.object({
  'user-agent': z.string().optional(),
  'x-forwarded-for': z.string().optional(),
  'x-real-ip': z.string().optional(),
  'correlation-id': z.string().optional(),
  'request-id': z.string().optional(),
  'authorization': z.string().optional(),
  'x-api-key': z.string().optional(),
});

const CorsOriginSchema = z.union([
  z.string().url(),
  z.literal('*'),
  z.boolean(),
  z.array(z.string().url())
]);

// ==============================================
// CLASE PRINCIPAL DE LA APLICACIÓN
// ==============================================
class App {
  public app: Express;
  private readonly appLogger = createContextLogger({ component: 'app' });
  private securityConfig: SecurityConfig;

  constructor() {
    this.app = express();
    this.securityConfig = this.buildSecurityConfig();
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      this.appLogger.info('Initializing Auth Service application...', {
        nodeVersion: process.version,
        environment: environment.app.env,
        port: environment.app.port,
        swaggerEnabled: environment.features?.swaggerEnabled
      });
      
      // Validar configuración inicial
      await this.validateConfiguration();
      
      // Inicializar en orden específico
      await this.initializeSecurityMiddlewares();
      await this.initializeCoreMiddlewares();
      await this.initializeValidationMiddlewares();
      this.initializeRoutes();
      this.initializeSwagger();
      this.initializeErrorHandling();
      
      this.appLogger.info('Auth Service application initialized successfully', {
        environment: environment.app.env,
        port: environment.app.port,
        apiVersion: environment.app.apiVersion,
        features: {
          swagger: !environment.app.isProduction,
          rateLimit: !environment.app.isTest,
          compression: true,
          security: environment.app.isProduction
        }
      });
    } catch (error) {
      this.appLogger.fatal('Failed to initialize application', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      process.exit(1);
    }
  }

  // ==============================================
  // VALIDACIÓN DE CONFIGURACIÓN
  // ==============================================
  private async validateConfiguration(): Promise<void> {
    this.appLogger.info('Validating application configuration...');

    try {
      // Validar variables de entorno críticas
      const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      // Validar configuración de CORS
      if (environment.cors?.origin) {
        CorsOriginSchema.parse(environment.cors.origin);
      }

      // Validar especificación de Swagger si está habilitada
      if (environment.features?.swaggerEnabled && !environment.app.isProduction) {
        if (!validateSwaggerSpec()) {
          throw new Error('Invalid Swagger specification');
        }
        
        const swaggerInfo = getSwaggerInfo();
        this.appLogger.info('Swagger validation successful', swaggerInfo);
      }

      this.appLogger.info('Configuration validation completed successfully');
    } catch (error) {
      this.appLogger.error('Configuration validation failed', { error });
      throw error;
    }
  }

  // ==============================================
  // CONFIGURACIÓN DE SEGURIDAD
  // ==============================================
  private buildSecurityConfig(): SecurityConfig {
    const helmetConfig = environment.app.isProduction ? {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https://api.github.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          childSrc: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          manifestSrc: ["'self'"]
        },
      },
      crossOriginEmbedderPolicy: { policy: "credentialless" },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 año
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true
    } : {
      // Configuración más permisiva para desarrollo
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: false
    };

    const corsConfig: cors.CorsOptions = {
      origin: this.getCorsOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Refresh-Token',
        'X-Session-Id',
        'X-CSRF-Token',
        'X-API-Key',
        REQUEST_HEADERS.CORRELATION_ID,
        REQUEST_HEADERS.REQUEST_ID,
        REQUEST_HEADERS.USER_AGENT,
        'X-Client-Version',
        'X-Device-Id'
      ],
      exposedHeaders: [
        'X-Total-Count', 
        'X-Page-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        REQUEST_HEADERS.CORRELATION_ID,
        REQUEST_HEADERS.REQUEST_ID
      ],
      maxAge: 86400, // 24 horas
      optionsSuccessStatus: 200,
      preflightContinue: false
    };

    const rateLimitConfig = rateLimit({
      windowMs: RATE_LIMIT_CONFIG?.WINDOW_MS || 15 * 60 * 1000, // 15 minutos
      max: RATE_LIMIT_CONFIG?.MAX_REQUESTS || 100,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          details: 'Maximum requests per window exceeded'
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        securityLogger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later',
          error: { code: 'RATE_LIMIT_EXCEEDED' }
        });
      },
      skip: (req: Request) => {
        // Skip rate limiting for health checks
        return req.path.startsWith('/health');
      }
    });

    const slowDownConfig = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutos
      delayAfter: 50, // Permitir 50 requests normales
      delayMs: 500, // Agregar 500ms de delay después del límite
      maxDelayMs: 20000, // Máximo 20 segundos de delay
    });

    return {
      helmet: helmetConfig,
      cors: corsConfig,
      rateLimit: rateLimitConfig,
      slowDown: slowDownConfig
    };
  }

  // ==============================================
  // MIDDLEWARES DE SEGURIDAD
  // ==============================================
  private async initializeSecurityMiddlewares(): Promise<void> {
    this.appLogger.info('Initializing security middlewares...');

    // Trust proxy para obtener IP real
    this.app.set('trust proxy', environment.app.isProduction ? 1 : true);

    // Helmet - Configuración de seguridad HTTP
    this.app.use(helmet(this.securityConfig.helmet));

    // CORS - Control de acceso entre orígenes
    this.app.use(cors(this.securityConfig.cors));

    // Rate limiting y slow down (solo en producción y staging)
    if (!environment.app.isTest && !environment.app.isDevelopment) {
      this.app.use(this.securityConfig.slowDown);
      this.app.use(this.securityConfig.rateLimit);
    }

    // Middleware de contexto de request (debe ir temprano)
    this.app.use(this.requestContextMiddleware.bind(this));

    this.appLogger.info('Security middlewares initialized successfully');
  }

  // ==============================================
  // MIDDLEWARES CORE
  // ==============================================
  private async initializeCoreMiddlewares(): Promise<void> {
    this.appLogger.info('Initializing core middlewares...');

    // Request timeout
    this.app.use(timeout(TIMEOUT_CONFIG?.HTTP_REQUEST || '30s'));

    // Compression con configuración optimizada
    this.app.use(compression({
      threshold: MIDDLEWARE_CONFIG?.COMPRESSION_THRESHOLD || 1024,
      level: environment.app.isProduction ? 6 : 1,
      filter: (req, res) => {
        // No comprimir si el cliente lo solicita
        if (req.headers['x-no-compression']) {
          return false;
        }
        // No comprimir archivos ya comprimidos
        const contentType = res.getHeader('content-type');
        if (typeof contentType === 'string') {
          const skipTypes = ['image/', 'video/', 'audio/', 'application/zip', 'application/gzip'];
          if (skipTypes.some(type => contentType.includes(type))) {
            return false;
          }
        }
        return compression.filter(req, res);
      }
    }));

    // Body parsing con validación
    this.app.use(express.json({ 
      limit: MIDDLEWARE_CONFIG?.MAX_REQUEST_SIZE || '10mb',
      strict: true,
      type: ['application/json', 'application/*+json'],
      verify: (req, res, buf, encoding) => {
        if (buf && buf.length === 0) {
          throw new Error('Request body cannot be empty');
        }
        // Validar tamaño del payload
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > (MIDDLEWARE_CONFIG?.MAX_REQUEST_SIZE_BYTES || 10485760)) {
          throw new Error('Payload too large');
        }
      }
    }));

    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: MIDDLEWARE_CONFIG?.MAX_REQUEST_SIZE || '10mb',
      parameterLimit: 100,
      type: 'application/x-www-form-urlencoded'
    }));
    
    // Cookie parser con configuración segura
    this.app.use(cookieParser(environment.jwt?.secret, {
      httpOnly: true,
      secure: environment.app.isProduction,
      sameSite: environment.app.isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    }));

    // Morgan HTTP logging con formato personalizado
    this.setupMorganLogging();

    // Handlers de errores específicos
    this.app.use(jsonErrorHandler);
    this.app.use(payloadTooLargeHandler);
    this.app.use(timeoutHandler);

    // Request logging personalizado
    this.app.use(this.requestLoggingMiddleware.bind(this));

    this.appLogger.info('Core middlewares initialized successfully');
  }

  // ==============================================
  // CONFIGURACIÓN DE MORGAN
  // ==============================================
  private setupMorganLogging(): void {
    // Tokens personalizados de Morgan
    morgan.token('correlation-id', (req: AppRequest) => req.correlationId || 'unknown');
    morgan.token('request-id', (req: AppRequest) => req.requestId || 'unknown');
    morgan.token('real-ip', (req: AppRequest) => req.clientIp || req.ip || 'unknown');
    morgan.token('user-id', (req: any) => req.user?.id || 'anonymous');
    morgan.token('response-time-ms', (req, res) => {
      const startTime = req['startTime'] || Date.now();
      return `${Date.now() - startTime}ms`;
    });

    const productionFormat = ':real-ip - :user-id [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms :correlation-id';
    
    const developmentFormat = ':method :url :status :response-time-ms - :res[content-length] :correlation-id';

    const morganFormat = environment.app.isProduction ? productionFormat : developmentFormat;

    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => {
          // Limpiar el mensaje y registrar
          const cleanMessage = message.trim();
          if (cleanMessage) {
            httpLogger.info(cleanMessage);
          }
        }
      },
      skip: (req: Request, res: Response) => {
        // Skip logging en casos específicos
        const skipPaths = ['/health', '/metrics', '/favicon.ico'];
        const shouldSkip = skipPaths.some(path => req.url.startsWith(path));
        
        // En producción, skip health checks exitosos
        if (environment.app.isProduction && req.url.startsWith('/health') && res.statusCode < 400) {
          return true;
        }

        return shouldSkip;
      }
    }));
  }

  // ==============================================
  // MIDDLEWARES DE VALIDACIÓN
  // ==============================================
  private async initializeValidationMiddlewares(): Promise<void> {
    this.appLogger.info('Initializing validation middlewares...');

    // Middleware de validación de headers comunes
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      try {
        // Validar headers básicos (opcional, no fallar si no están)
        const headers = {
          'user-agent': req.get('user-agent'),
          'x-forwarded-for': req.get('x-forwarded-for'),
          'x-real-ip': req.get('x-real-ip'),
          'correlation-id': req.get('correlation-id'),
          'request-id': req.get('request-id'),
          'authorization': req.get('authorization'),
          'x-api-key': req.get('x-api-key')
        };

        // Validación suave - no fallar, solo log warnings
        const validation = RequestHeadersSchema.safeParse(headers);
        if (!validation.success) {
          this.appLogger.debug('Header validation warnings', {
            path: req.path,
            issues: validation.error.issues
          });
        }

        next();
      } catch (error) {
        this.appLogger.error('Header validation error', { error });
        next(); // Continuar sin fallar
      }
    });

    this.appLogger.info('Validation middlewares initialized successfully');
  }

  // ==============================================
  // MIDDLEWARE DE CONTEXTO DE REQUEST
  // ==============================================
  private requestContextMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    
    // Generar IDs de correlación y request
    req.correlationId = req.get(REQUEST_HEADERS.CORRELATION_ID) || 
                       `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = req.get(REQUEST_HEADERS.REQUEST_ID) || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = startTime;

    // Obtener IP real del cliente
    req.clientIp = this.getClientIP(req);

    // Información del dispositivo
    const userAgent = req.get('User-Agent') || '';
    req.deviceInfo = {
      userAgent,
      platform: this.extractPlatform(userAgent),
      browser: this.extractBrowser(userAgent)
    };

    // Establecer headers de respuesta
    res.setHeader(REQUEST_HEADERS.CORRELATION_ID, req.correlationId);
    res.setHeader(REQUEST_HEADERS.REQUEST_ID, req.requestId);
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);

    // Manejar timeout de request
    req.on('timeout', () => {
      securityLogger.warn('Request timeout detected', {
        correlationId: req.correlationId,
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: req.clientIp,
        userAgent,
        duration: `${Date.now() - startTime}ms`
      });
    });

    next();
  }

  // ==============================================
  // MIDDLEWARE DE LOGGING DE REQUESTS
  // ==============================================
  private requestLoggingMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
    const startTime = req.startTime || Date.now();
    
    // Log de request entrante (solo en desarrollo)
    if (environment.app.isDevelopment) {
      this.appLogger.debug('Incoming request', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        ip: req.clientIp,
        userAgent: req.deviceInfo?.userAgent
      });
    }
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        correlationId: req.correlationId,
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.deviceInfo?.userAgent,
        ip: req.clientIp,
        contentLength: res.get('content-length'),
        referer: req.get('referer'),
        responseSize: res.get('content-length') || '0'
      };

      // Actualizar header de tiempo de respuesta
      res.setHeader('X-Response-Time', `${duration}ms`);

      // Log según el status code
      if (res.statusCode >= 500) {
        httpLogger.error('HTTP Request Error', logData);
      } else if (res.statusCode >= 400) {
        httpLogger.warn('HTTP Request Warning', logData);
      } else {
        httpLogger.info('HTTP Request Completed', logData);
      }

      // Métricas de performance
      if (duration > 5000) { // Más de 5 segundos
        securityLogger.warn('Slow request detected', {
          ...logData,
          threshold: '5000ms'
        });
      }
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        const duration = Date.now() - startTime;
        httpLogger.warn('HTTP Request closed before completion', {
          correlationId: req.correlationId,
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          duration: `${duration}ms`,
          event: 'REQUEST_CLOSED_EARLY'
        });
      }
    });

    next();
  }

  // ==============================================
  // INICIALIZACIÓN DE RUTAS
  // ==============================================
  private initializeRoutes(): void {
    this.appLogger.info('Initializing routes...');

    const apiVersion = `/api/${environment.app.apiVersion}`;
    
    // Health check routes (primero, sin autenticación)
    this.app.use('/health', HealthRoutes.routes);

    // Root endpoint con información del servicio
    this.app.get('/', this.createRootHandler());

    // API routes con prefijo de versión
    this.app.use(`${apiVersion}/auth`, AuthRoutes.routes);
    this.app.use(`${apiVersion}/users`, UserRoutes.routes);

    // API info endpoint
    this.app.get(`${apiVersion}`, this.createApiInfoHandler(apiVersion));

    // Endpoint de métricas (solo en desarrollo)
    if (environment.app.isDevelopment) {
      this.app.get('/metrics', this.createMetricsHandler());
    }

    this.appLogger.info('Routes initialized successfully', {
      apiVersion,
      routes: ['auth', 'users', 'health', 'metrics'],
      totalEndpoints: this.getRoutesCount()
    });
  }

  // ==============================================
  // HANDLERS DE ENDPOINTS
  // ==============================================
  private createRootHandler() {
    return (req: Request, res: Response) => {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      
      res.json({
        success: true,
        message: 'Task Manager Auth Service API',
        data: {
          service: 'auth-service',
          version: environment.app.apiVersion,
          environment: environment.app.env,
          timestamp: new Date().toISOString(),
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
          memory: {
            used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
          },
          documentation: !environment.app.isProduction ? '/api-docs' : null,
          healthCheck: '/health'
        },
        meta: {
          correlationId: (req as AppRequest).correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          version: environment.app.apiVersion
        }
      });
    };
  }

  private createApiInfoHandler(apiVersion: string) {
    return (req: Request, res: Response) => {
      res.json({
        success: true,
        message: `Auth Service API ${environment.app.apiVersion}`,
        data: {
          version: environment.app.apiVersion,
          endpoints: [
            `${apiVersion}/auth/register`,
            `${apiVersion}/auth/login`,
            `${apiVersion}/auth/refresh`,
            `${apiVersion}/auth/logout`,
            `${apiVersion}/users/profile`,
            `${apiVersion}/users/sessions`,
            '/health'
          ],
          documentation: !environment.app.isProduction ? '/api-docs' : null,
          rateLimit: {
            windowMs: '15 minutes',
            maxRequests: 100
          }
        },
        meta: {
          correlationId: (req as AppRequest).correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        }
      });
    };
  }

  private createMetricsHandler() {
    return (req: Request, res: Response) => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      });
    };
  }

  // ==============================================
  // INICIALIZACIÓN DE SWAGGER
  // ==============================================
  private initializeSwagger(): void {
    if (environment.app.isProduction || !environment.features?.swaggerEnabled) {
      this.appLogger.info('Swagger disabled in production environment');
      return;
    }

    try {
      // Configurar Swagger UI con opciones personalizadas
      this.app.use('/api-docs', swaggerUi.serve);
      this.app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

      // Endpoint para obtener la especificación JSON
      this.app.get('/api-docs.json', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(swaggerSpec);
      });

      // Endpoint alternativo para la especificación
      this.app.get('/swagger.json', (req: Request, res: Response) => {
        res.redirect('/api-docs.json');
      });

      const swaggerInfo = getSwaggerInfo();
      this.appLogger.info('Swagger documentation initialized successfully', {
        path: '/api-docs',
        jsonPath: '/api-docs.json',
        ...swaggerInfo
      });
    } catch (error) {
      this.appLogger.error('Failed to initialize Swagger documentation', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
    }
  }

  // ==============================================
  // MANEJO DE ERRORES
  // ==============================================
  private initializeErrorHandling(): void {
    this.appLogger.info('Initializing error handling...');

    // 404 handler para rutas no encontradas
    this.app.use('*', notFoundHandler);

    // Global error handler (debe ser el último)
    this.app.use(errorHandler);

    // Configurar handlers de shutdown graceful
    this.setupGracefulShutdown();

    this.appLogger.info('Error handling initialized successfully');
  }

  // ==============================================
  // GRACEFUL SHUTDOWN
  // ==============================================
  private setupGracefulShutdown(): void {
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.appLogger.fatal('Unhandled Promise Rejection detected', {
        reason: reason instanceof Error ? {
          message: reason.message,
          stack: reason.stack,
          name: reason.name
        } : reason,
        promise: promise.toString()
      });
      
      // Dar tiempo para logging luego salir
      setTimeout(() => process.exit(1), 1000);
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.appLogger.fatal('Uncaught Exception detected', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
      
      // Salir inmediatamente en uncaught exception
      process.exit(1);
    });

    // Graceful shutdown en SIGTERM
    process.on('SIGTERM', () => {
      this.appLogger.info('SIGTERM received, starting graceful shutdown...');
      this.gracefulShutdown('SIGTERM');
    });

    // Graceful shutdown en SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.appLogger.info('SIGINT received, starting graceful shutdown...');
      this.gracefulShutdown('SIGINT');
    });

    // Warning para eventos que podrían indicar problemas
    process.on('warning', (warning) => {
      this.appLogger.warn('Process warning detected', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    const shutdownLogger = createContextLogger({ 
      component: 'shutdown',
      signal 
    });

    try {
      shutdownLogger.info('Starting graceful shutdown process...', {
        signal,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });

      // Detener aceptación de nuevas conexiones
      // (esto sería manejado por la instancia del servidor)

      // Cerrar conexiones de base de datos
      // await this.closeDatabaseConnections();

      // Cerrar conexiones de Redis
      // await this.closeRedisConnections();

      // Limpiar timers y recursos
      // clearInterval/clearTimeout para cualquier timer activo

      shutdownLogger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      shutdownLogger.error('Error during graceful shutdown', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
      process.exit(1);
    }
  }

  // ==============================================
  // UTILIDADES HELPER
  // ==============================================
  private getCorsOrigins(): string | string[] | boolean {
    if (environment.app.isDevelopment) {
      // En desarrollo permitir todos los orígenes
      return true;
    }

    // En producción usar orígenes configurados
    const allowedOrigins = environment.cors?.origin;

    if (!allowedOrigins) {
      this.appLogger.warn('No CORS origins configured for production');
      return false;
    }

    // Validar formato de orígenes
    if (Array.isArray(allowedOrigins)) {
      const validOrigins = allowedOrigins.filter(origin => {
        try {
          new URL(origin);
          return true;
        } catch {
          this.appLogger.warn('Invalid CORS origin detected', { origin });
          return false;
        }
      });
      return validOrigins;
    }

    if (typeof allowedOrigins === 'string' && allowedOrigins !== '*') {
      try {
        new URL(allowedOrigins);
        return allowedOrigins;
      } catch {
        this.appLogger.warn('Invalid CORS origin format', { origin: allowedOrigins });
        return false;
      }
    }

    return allowedOrigins;
  }

  private getClientIP(req: Request): string {
    // Prioridad de headers para obtener IP real
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'x-forwarded',
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded'
    ];

    for (const header of ipHeaders) {
      const value = req.get(header);
      if (value) {
        // Tomar la primera IP si hay múltiples
        const ip = value.split(',')[0].trim();
        if (this.isValidIP(ip)) {
          return ip;
        }
      }
    }

    // Fallback a req.ip
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
      return ip.split('.').every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Regex.test(ip);
  }

  private extractPlatform(userAgent: string): string {
    const platforms = {
      'Windows NT 10.0': 'Windows 10',
      'Windows NT 6.3': 'Windows 8.1',
      'Windows NT 6.2': 'Windows 8',
      'Windows NT 6.1': 'Windows 7',
      'Mac OS X': 'macOS',
      'X11': 'Linux',
      'Linux': 'Linux',
      'Android': 'Android',
      'iPhone': 'iOS',
      'iPad': 'iPadOS'
    };

    for (const [key, value] of Object.entries(platforms)) {
      if (userAgent.includes(key)) {
        return value;
      }
    }

    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    const browsers = {
      'Chrome/': 'Chrome',
      'Firefox/': 'Firefox',
      'Safari/': 'Safari',
      'Edge/': 'Edge',
      'Opera/': 'Opera',
      'Brave/': 'Brave'
    };

    for (const [key, value] of Object.entries(browsers)) {
      if (userAgent.includes(key)) {
        // Extraer versión si es posible
        const versionMatch = userAgent.match(new RegExp(`${key}([\\d.]+)`));
        if (versionMatch) {
          return `${value} ${versionMatch[1].split('.')[0]}`;
        }
        return value;
      }
    }

    return 'Unknown';
  }

  private getRoutesCount(): number {
    // Contar rutas registradas (aproximado)
    const stack = this.app._router?.stack || [];
    return stack.filter((layer: any) => layer.route).length;
  }

  // ==============================================
  // MÉTODOS PÚBLICOS
  // ==============================================
  public getApp(): Express {
    return this.app;
  }

  public async close(): Promise<void> {
    this.appLogger.info('Closing application manually...');
    await this.gracefulShutdown('MANUAL_CLOSE');
  }

  // Método para obtener información del estado de la app
  public getAppInfo() {
    const memUsage = process.memoryUsage();
    return {
      service: 'auth-service',
      version: environment.app.apiVersion,
      environment: environment.app.env,
      uptime: process.uptime(),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      features: {
        swagger: !environment.app.isProduction && environment.features?.swaggerEnabled,
        rateLimit: !environment.app.isTest,
        compression: true,
        security: environment.app.isProduction
      },
      routes: this.getRoutesCount()
    };
  }

  // Método para configuración de pruebas
  public configureForTesting(): void {
    if (!environment.app.isTest) {
      this.appLogger.warn('configureForTesting called in non-test environment');
      return;
    }

    // Configuraciones específicas para testing
    this.app.set('trust proxy', true);
    
    // Endpoint adicional para testing
    this.app.get('/test/info', (req: Request, res: Response) => {
      res.json(this.getAppInfo());
    });

    this.appLogger.info('Application configured for testing');
  }
}

// ==============================================
// EXTENSIÓN DE INTERFACES GLOBALES
// ==============================================
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      requestId?: string;
      startTime?: number;
      clientIp?: string;
      deviceInfo?: {
        userAgent: string;
        platform?: string;
        browser?: string;
      };
      user?: {
        id: string;
        email: string;
        username: string;
        sessionId: string;
        iat?: number;
        exp?: number;
        isActive?: boolean;
        isVerified?: boolean;
      };
      // Para middlewares de validación
      validatedData?: {
        body?: any;
        query?: any;
        params?: any;
        headers?: any;
      };
    }
  }
}

// ==============================================
// VALIDADORES ZOD ADICIONALES PARA EXPORT
// ==============================================
export const AppValidators = {
  RequestHeaders: RequestHeadersSchema,
  CorsOrigin: CorsOriginSchema,
  // Agregar más validadores según sea necesario
  
  // Validador para configuración de ambiente
  EnvironmentConfig: z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.string().transform(Number).refine(n => n > 0 && n < 65536),
    JWT_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    CORS_ORIGIN: z.union([z.string(), z.array(z.string())]).optional()
  }),

  // Validador para request básico
  BasicRequest: z.object({
    correlationId: z.string().optional(),
    requestId: z.string().optional(),
    userAgent: z.string().optional(),
    ip: z.string().ip().optional()
  })
};

// ==============================================
// TIPOS TYPESCRIPT PARA EXPORT
// ==============================================
export type AppRequestExtended = AppRequest;
export type SecurityConfigType = SecurityConfig;

// ==============================================
// CONSTANTES DE CONFIGURACIÓN
// ==============================================
export const APP_CONSTANTS = {
  DEFAULT_TIMEOUT: '30s',
  MAX_REQUEST_SIZE: '10mb',
  COMPRESSION_THRESHOLD: 1024,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutos
  RATE_LIMIT_MAX: 100,
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 días
  SLOW_REQUEST_THRESHOLD: 5000, // 5 segundos
  
  CORS_MAX_AGE: 86400, // 24 horas
  HSTS_MAX_AGE: 31536000, // 1 año
  
  SKIP_LOGGING_PATHS: ['/health', '/metrics', '/favicon.ico'],
  SKIP_RATE_LIMIT_PATHS: ['/health']
} as const;

export default App;