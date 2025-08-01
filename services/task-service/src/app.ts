// src/app.ts - Task Service Application
// Aplicación Express con arquitectura modular, principios SOLID y logging estructurado
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { Server } from 'http';

// Routes
import { createCategoryRoutes } from '@/commons/routes/category.routes';
import taskRoutes from '@/commons/routes/task.routes';
import { HealthRoutes } from '@/commons/routes/health.routes';

// Middlewares
import {
  errorHandler,
  notFoundHandler,
} from '@/commons/middlewares/error.middleware';
import {
  generalRateLimit,
  rateLimitLogger,
  createRateLimiter,
} from '@/commons/middlewares/rateLimit.middleware';

// Servicios y dependencias
import { CategoryService } from '@/core/application/CategoryService';
import { CategoryRepository } from '@/core/infrastructure/repositories/CategoryRepository';
import { TaskRepository } from '@/core/infrastructure/repositories/TaskRepository';
import { RedisCache } from '@/core/infrastructure/cache/RedisCache';

// Utils
import {
  logger,
  httpLogger,
  startup,
  createRequestLogger,
} from '@/utils/logger';
import { config } from '@/config/environment';
import {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  REQUEST_HEADERS,
} from '@/utils/constants';

// INTERFACES Y TIPOS
interface AppDependencies {
  categoryService: CategoryService;
  cacheService: RedisCache;
  taskRepository: TaskRepository;
}

interface MiddlewareConfig {
  security: SecurityConfig;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
}

interface SecurityConfig {
  helmet: boolean;
  csp: boolean;
  hsts: boolean;
}

interface CorsConfig {
  origin: string[] | string | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

interface RateLimitConfig {
  enabled: boolean;
  global: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

interface LoggingConfig {
  http: boolean;
  requests: boolean;
  errors: boolean;
  level: string;
}

interface ServerOptions {
  port: number;
  hostname?: string;
  gracefulShutdown: boolean;
  shutdownTimeout: number;
}

// CLASE PRINCIPAL DE LA APLICACIÓN
/**
 * TaskServiceApp
 *
 * Aplicación principal que implementa:
 * - SRP: Responsabilidad única de configurar y gestionar el servidor Express
 * - OCP: Abierto para extensión mediante inyección de dependencias
 * - LSP: Implementaciones intercambiables de servicios
 * - ISP: Interfaces segregadas para diferentes responsabilidades
 * - DIP: Dependencia de abstracciones, no de concreciones
 */
export class TaskServiceApp {
  private readonly app: Application;
  private readonly dependencies: AppDependencies;
  private readonly middlewareConfig: MiddlewareConfig;
  private readonly appLogger = logger.child({
    component: 'TaskServiceApp',
    service: 'task-service',
  });
  private server?: Server;

  // Constantes de configuración
  private readonly API_PREFIX = `/api/${config.app.apiVersion}`;
  private readonly SERVICE_NAME = 'Task Manager - Task Service API';
  private readonly SHUTDOWN_TIMEOUT = 30000; // 30 segundos

  constructor(dependencies?: Partial<AppDependencies>) {
    this.app = express();
    this.dependencies = this.initializeDependencies(dependencies);
    this.middlewareConfig = this.createMiddlewareConfig();

    this.appLogger.info(
      {
        event: 'app_initialization_started',
        apiPrefix: this.API_PREFIX,
        environment: config.app.env,
      },
      '🚀 Iniciando TaskServiceApp',
    );

    this.initializeApplication();

    this.appLogger.info(
      {
        event: 'app_initialization_completed',
        middlewareCount: this.getMiddlewareCount(),
        routesCount: this.getRoutesCount(),
      },
      '✅ TaskServiceApp inicializada correctamente',
    );
  }

  // INICIALIZACIÓN DE DEPENDENCIAS
  /**
   * Inicializa las dependencias de la aplicación con inyección de dependencias
   * Implementa el patrón Factory y Dependency Injection
   */
  private initializeDependencies(
    dependencies?: Partial<AppDependencies>,
  ): AppDependencies {
    this.appLogger.debug('🔧 Inicializando dependencias');

    try {
      // Cache Service
      const cacheService = dependencies?.cacheService || new RedisCache();

      // Repository Layer
      const categoryRepository = new CategoryRepository();
      const taskRepository =
        dependencies?.taskRepository || new TaskRepository();

      // Service Layer con inyección de dependencias
      const categoryService =
        dependencies?.categoryService ||
        new CategoryService(categoryRepository, taskRepository, cacheService);

      const resolvedDependencies: AppDependencies = {
        categoryService,
        cacheService,
        taskRepository,
      };

      this.appLogger.info(
        {
          event: 'dependencies_initialized',
          services: Object.keys(resolvedDependencies),
        },
        '🔌 Dependencias inicializadas',
      );

      return resolvedDependencies;
    } catch (error) {
      this.appLogger.fatal(
        {
          error: error instanceof Error ? error.message : String(error),
          event: 'dependencies_initialization_failed',
        },
        '💀 Error crítico inicializando dependencias',
      );

      throw error;
    }
  }

  // CONFIGURACIÓN DE MIDDLEWARES
  /**
   * Crea la configuración de middlewares basada en el entorno
   */
  private createMiddlewareConfig(): MiddlewareConfig {
    return {
      security: {
        helmet: config.security.helmetEnabled,
        csp: config.security.cspEnabled,
        hsts: config.security.hstsEnabled,
      },
      cors: {
        origin: config.cors.origin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-Request-ID',
        ],
      },
      rateLimit: {
        enabled: config.rateLimit.enabled,
        global: true,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      },
      logging: {
        http: !config.app.isTest,
        requests: true,
        errors: true,
        level: config.logging.level,
      },
    };
  }

  /**
   * Inicialización completa de la aplicación
   */
  private initializeApplication(): void {
    this.setupSecurityMiddlewares();
    this.setupUtilityMiddlewares();
    this.setupLoggingMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configuración de middlewares de seguridad
   */
  private setupSecurityMiddlewares(): void {
    this.appLogger.debug('🛡️ Configurando middlewares de seguridad');

    // Helmet para headers de seguridad
    if (this.middlewareConfig.security.helmet) {
      const helmetConfig: any = {
        contentSecurityPolicy: false, // Deshabilitado por defecto para APIs
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      };

      // CSP personalizado si está habilitado
      if (this.middlewareConfig.security.csp) {
        helmetConfig.contentSecurityPolicy = {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        };
      }

      // HSTS si está habilitado
      if (this.middlewareConfig.security.hsts) {
        helmetConfig.hsts = {
          maxAge: config.security.hstsMaxAge,
          includeSubDomains: true,
          preload: true,
        };
      }

      this.app.use(helmet(helmetConfig));
    }

    // CORS configurado
    this.app.use(cors(this.middlewareConfig.cors));

    // Rate limiting global
    if (
      this.middlewareConfig.rateLimit.enabled &&
      this.middlewareConfig.rateLimit.global
    ) {
      this.app.use(generalRateLimit);
      if (config.app.isDevelopment) {
        this.app.use(rateLimitLogger);
      }
    }

    this.appLogger.debug('✅ Middlewares de seguridad configurados');
  }

  /**
   * Configuración de middlewares de utilidad
   */
  private setupUtilityMiddlewares(): void {
    this.appLogger.debug('⚙️ Configurando middlewares de utilidad');

    // Compresión de respuestas
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
        threshold: 1024, // Solo comprimir si es > 1KB
      }),
    );

    // Parser de cookies
    this.app.use(cookieParser());

    // Parser de JSON con validación
    this.app.use(
      express.json({
        limit: '10mb',
        verify: this.createJsonVerifier(),
      }),
    );

    // Parser de URL encoded
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
      }),
    );

    this.appLogger.debug('✅ Middlewares de utilidad configurados');
  }

  /**
   * Crea un verificador personalizado para JSON
   */
  private createJsonVerifier() {
    return (req: Request, res: Response, buf: Buffer) => {
      try {
        JSON.parse(buf.toString());
      } catch (error) {
        const requestLogger = createRequestLogger(
          req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string,
        );

        requestLogger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
          },
          'Invalid JSON in request body',
        );

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid JSON format in request body',
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            details: 'Request body contains malformed JSON',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string,
          },
        });

        throw new Error('Invalid JSON');
      }
    };
  }

  /**
   * Configuración de middlewares de logging
   */
  private setupLoggingMiddlewares(): void {
    this.appLogger.debug('📝 Configurando middlewares de logging');

    // Morgan HTTP logger
    if (this.middlewareConfig.logging.http) {
      this.app.use(
        morgan('combined', {
          stream: {
            write: (message: string) => {
              httpLogger.info(message.trim(), 'HTTP Request');
            },
          },
          skip: (req: Request) => {
            // Skip health check requests para evitar spam
            return req.path.includes('/health');
          },
        }),
      );
    }

    // Request ID middleware
    this.app.use(this.createRequestIdMiddleware());

    // Request logging middleware
    if (this.middlewareConfig.logging.requests) {
      this.app.use(this.createRequestLoggingMiddleware());
    }

    this.appLogger.debug('✅ Middlewares de logging configurados');
  }

  /**
   * Middleware para generar Request ID único
   */
  private createRequestIdMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId =
        (req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string) ||
        `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      req.headers[REQUEST_HEADERS.X_REQUEST_ID] = requestId;
      res.setHeader('X-Request-ID', requestId);

      next();
    };
  }

  /**
   * Middleware de logging de requests
   */
  private createRequestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      const requestLogger = createRequestLogger(
        req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string,
      );

      requestLogger.info(
        {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          contentType: req.get('Content-Type'),
          contentLength: req.get('Content-Length'),
        },
        `🌐 Request iniciado: ${req.method} ${req.path}`,
      );

      // Capturar respuesta para logging
      const originalSend = res.send;
      res.send = function (this: Response, body: any) {
        const duration = Date.now() - startTime;

        requestLogger.info(
          {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            responseSize: Buffer.byteLength(body || ''),
          },
          `✅ Request completado: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
        );

        return originalSend.call(this, body);
      };

      next();
    };
  }

  // CONFIGURACIÓN DE RUTAS
  /**
   * Configuración centralizada de todas las rutas de la API
   */
  private setupRoutes(): void {
    this.appLogger.debug('🛣️ Configurando rutas de la aplicación');

    // Root endpoint con información del servicio
    this.setupRootEndpoint();

    // ✅ CAMBIO CRÍTICO: Health check routes PRIMERO y SIEMPRE disponible
    // Las rutas de health check DEBEN ir antes que cualquier middleware que pueda fallar
    this.app.use(`${this.API_PREFIX}/health`, HealthRoutes.routes);
    this.appLogger.info(
      {
        component: 'routes_setup',
        healthEndpoint: `${this.API_PREFIX}/health`,
        productionMode: config.app.isProduction,
      },
      '🏥 Health check routes configuradas (siempre disponibles)',
    );

    // API Routes principales
    this.app.use(`${this.API_PREFIX}/tasks`, taskRoutes);
    this.app.use(
      `${this.API_PREFIX}/categories`,
      createCategoryRoutes(this.dependencies.categoryService),
    );

    // Swagger documentation (si está habilitado)
    this.setupSwaggerDocumentation();

    // Catch-all para rutas no encontradas
    this.setupNotFoundHandler();

    this.appLogger.info(
      {
        event: 'routes_configured',
        apiPrefix: this.API_PREFIX,
        availableRoutes: this.getAvailableRoutes(),
      },
      '✅ Rutas configuradas correctamente',
    );
  }

  /**
   * Configura el endpoint raíz con información del servicio
   */
  private setupRootEndpoint(): void {
    this.app.get('/', (req: Request, res: Response) => {
      const requestLogger = createRequestLogger(
        req.headers[REQUEST_HEADERS.X_REQUEST_ID] as string,
      );

      requestLogger.debug('Root endpoint accessed');

      res.json({
        success: true,
        message: this.SERVICE_NAME,
        data: {
          service: 'task-service',
          version: config.app.apiVersion,
          environment: config.app.env,
          timestamp: new Date().toISOString(),
          status: 'operational',
          endpoints: {
            health: `${this.API_PREFIX}/health`,
            healthReady: `${this.API_PREFIX}/health/ready`,
            healthLive: `${this.API_PREFIX}/health/live`,
            healthDetailed: !config.app.isProduction
              ? `${this.API_PREFIX}/health/detailed`
              : 'disabled',
            docs: config.swagger.enabled
              ? `${this.API_PREFIX}/docs`
              : 'disabled',
            tasks: `${this.API_PREFIX}/tasks`,
            categories: `${this.API_PREFIX}/categories`,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers[REQUEST_HEADERS.X_REQUEST_ID],
        },
      });
    });
  }

  /**
   * Configura la documentación Swagger si está habilitada
   */
  private setupSwaggerDocumentation(): void {
    if (config.swagger.enabled) {
      try {
        // Importación dinámica de swagger para evitar errores si no está disponible
        const swaggerUi = require('swagger-ui-express');
        const { swaggerSpec, swaggerUiOptions } = require('@/utils/swagger');

        // Servir documentación JSON
        this.app.get(
          `${this.API_PREFIX}/docs/json`,
          (req: Request, res: Response) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
          },
        );

        // Servir interfaz Swagger UI
        this.app.use(
          `${this.API_PREFIX}/docs`,
          swaggerUi.serve,
          swaggerUi.setup(swaggerSpec, swaggerUiOptions),
        );

        this.appLogger.info(
          {
            event: 'swagger_configured',
            docsUrl: `${this.API_PREFIX}/docs`,
            jsonUrl: `${this.API_PREFIX}/docs/json`,
          },
          `📚 Swagger documentation available at ${this.API_PREFIX}/docs`,
        );
      } catch (error) {
        this.appLogger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            event: 'swagger_setup_failed',
          },
          '⚠️ Swagger setup failed, continuing without documentation',
        );
      }
    } else {
      this.appLogger.debug('📚 Swagger documentation disabled');
    }
  }

  /**
   * Configura el handler para rutas no encontradas
   */
  private setupNotFoundHandler(): void {
    this.app.all('*', notFoundHandler);
  }

  /**
   * Obtiene las rutas disponibles para documentación
   */
  private getAvailableRoutes(): string[] {
    const routes = [
      `GET /`,
      `GET ${this.API_PREFIX}/health`,
      `GET ${this.API_PREFIX}/health/ready`,
      `GET ${this.API_PREFIX}/health/live`,
      `GET ${this.API_PREFIX}/tasks`,
      `POST ${this.API_PREFIX}/tasks`,
      `GET ${this.API_PREFIX}/categories`,
      `POST ${this.API_PREFIX}/categories`,
    ];

    // Rutas detalladas solo en desarrollo
    if (!config.app.isProduction) {
      routes.push(
        `GET ${this.API_PREFIX}/health/detailed`,
        `GET ${this.API_PREFIX}/health/database`,
        `GET ${this.API_PREFIX}/health/redis`,
        `GET ${this.API_PREFIX}/health/auth-service`,
      );
    }

    if (config.swagger.enabled) {
      routes.push(`GET ${this.API_PREFIX}/docs`);
      routes.push(`GET ${this.API_PREFIX}/docs/json`);
    }

    return routes;
  }

  // CONFIGURACIÓN DE MANEJO DE ERRORES
  /**
   * Configuración centralizada del manejo de errores
   */
  private setupErrorHandling(): void {
    this.appLogger.debug('🚨 Configurando manejo de errores');

    // Global error handler (debe ir al final)
    this.app.use(errorHandler);

    // Manejo de excepciones no capturadas
    this.setupUncaughtExceptionHandlers();

    this.appLogger.debug('✅ Manejo de errores configurado');
  }

  /**
   * Configura el manejo de excepciones no capturadas
   */
  private setupUncaughtExceptionHandlers(): void {
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.appLogger.error(
        {
          reason: reason instanceof Error ? reason.message : String(reason),
          promise: promise.toString(),
          event: 'unhandled_promise_rejection',
        },
        '💥 Unhandled promise rejection detected',
      );

      // En producción, cerrar gracefully
      if (config.app.isProduction) {
        this.gracefulShutdown('unhandledRejection');
      }
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.appLogger.fatal(
        {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          event: 'uncaught_exception',
        },
        '💀 Uncaught exception - shutting down',
      );

      // Las excepciones no capturadas son críticas
      process.exit(1);
    });
  }

  // MÉTODOS PÚBLICOS
  /**
   * Obtiene la instancia de Express para testing
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Obtiene las dependencias configuradas
   */
  public getDependencies(): AppDependencies {
    return this.dependencies;
  }

  /**
   * Inicia el servidor en el puerto y hostname especificados
   */
  public async listen(options: Partial<ServerOptions> = {}): Promise<void> {
    const serverOptions: ServerOptions = {
      port: options.port || config.app.port,
      hostname: options.hostname || '0.0.0.0',
      gracefulShutdown: options.gracefulShutdown ?? true,
      shutdownTimeout: options.shutdownTimeout || this.SHUTDOWN_TIMEOUT,
    };

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(serverOptions.port, () => {
          startup.serviceStarted(serverOptions.port, config.app.env);

          this.appLogger.info(
            {
              event: 'server_started',
              port: serverOptions.port,
              hostname: serverOptions.hostname,
              environment: config.app.env,
              apiVersion: config.app.apiVersion,
              nodeVersion: process.version,
              pid: process.pid,
              uptime: process.uptime(),
            },
            `🚀 Task Service started successfully on ${serverOptions.hostname}:${serverOptions.port}`,
          );

          // Log de configuración de features
          this.logFeatureStatus();

          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.appLogger.error(
            {
              error: error.message,
              event: 'server_start_error',
              port: serverOptions.port,
              hostname: serverOptions.hostname,
            },
            '❌ Error starting server',
          );

          reject(error);
        });

        // Configurar graceful shutdown si está habilitado
        if (serverOptions.gracefulShutdown) {
          this.setupGracefulShutdown(serverOptions.shutdownTimeout);
        }
      } catch (error) {
        this.appLogger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            event: 'server_listen_error',
          },
          '❌ Error in listen method',
        );

        reject(error);
      }
    });
  }

  /**
   * Log del estado de las features configuradas
   */
  private logFeatureStatus(): void {
    this.appLogger.info(
      {
        event: 'features_status',
        features: {
          swagger: config.swagger.enabled,
          rateLimit: config.rateLimit.enabled,
          cors:
            config.cors.origin.length > 1 || !config.cors.origin.includes('*'),
          helmet: config.security.helmetEnabled,
          csp: config.security.cspEnabled,
          hsts: config.security.hstsEnabled,
          redis: this.dependencies.cacheService ? 'available' : 'unavailable',
          compression: true,
          healthCheck: config.features.healthCheckEnabled,
          backgroundJobs: {
            cleanup: config.jobs.cleanup.enabled,
            statsUpdate: config.jobs.statsUpdate.enabled,
          },
        },
      },
      '🎛️ Service features status logged',
    );
  }

  /**
   * Configura el graceful shutdown
   */
  private setupGracefulShutdown(timeout: number): void {
    const gracefulShutdown = (signal: string) => {
      startup.gracefulShutdown(signal);

      this.appLogger.info(
        {
          signal,
          timeout,
          event: 'graceful_shutdown_initiated',
        },
        `🛑 Graceful shutdown initiated (signal: ${signal})`,
      );

      if (this.server) {
        this.server.close(() => {
          this.appLogger.info(
            {
              event: 'http_server_closed',
            },
            '🔌 HTTP server closed',
          );

          process.exit(0);
        });

        // Force close after timeout
        setTimeout(() => {
          this.appLogger.error(
            {
              timeout,
              event: 'forced_shutdown',
            },
            '⏰ Forced shutdown after timeout',
          );

          process.exit(1);
        }, timeout);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  /**
   * Graceful shutdown manual
   */
  public async gracefulShutdown(reason: string): Promise<void> {
    this.appLogger.info(
      {
        reason,
        event: 'manual_graceful_shutdown',
      },
      `🛑 Manual graceful shutdown initiated: ${reason}`,
    );

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.appLogger.info('🔌 Server closed successfully');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // MÉTODOS DE UTILIDAD Y DEBUGGING
  /**
   * Obtiene información de la aplicación para debugging
   */
  public getAppInfo() {
    return {
      serviceName: this.SERVICE_NAME,
      apiPrefix: this.API_PREFIX,
      environment: config.app.env,
      version: config.app.apiVersion,
      middlewareConfig: this.middlewareConfig,
      availableRoutes: this.getAvailableRoutes(),
      dependencies: Object.keys(this.dependencies),
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Obtiene el conteo de middlewares (aproximado)
   */
  private getMiddlewareCount(): number {
    // Aproximación basada en los middlewares configurados
    let count = 0;

    if (this.middlewareConfig.security.helmet) count++;
    count++; // CORS
    if (this.middlewareConfig.rateLimit.enabled) count++;
    count++; // compression
    count++; // cookieParser
    count++; // express.json
    count++; // express.urlencoded
    if (this.middlewareConfig.logging.http) count++;
    count++; // requestId
    if (this.middlewareConfig.logging.requests) count++;
    count++; // errorHandler

    return count;
  }

  /**
   * Obtiene el conteo de rutas configuradas
   */
  private getRoutesCount(): number {
    return this.getAvailableRoutes().length;
  }

  /**
   * Health check del estado de la aplicación
   */
  public async healthCheck() {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'task-service',
        version: config.app.apiVersion,
        environment: config.app.env,
        uptime: `${Math.floor(uptime)}s`,
        memory: {
          used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        },
        dependencies: {
          redis: this.dependencies.cacheService ? 'connected' : 'unavailable',
          database: 'connected', // Asumimos conectado si la app está corriendo
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// FACTORY FUNCTION
/**
 * Factory function para crear la instancia de la aplicación
 * Facilita la inyección de dependencias y el testing
 */
export const createTaskServiceApp = (
  dependencies?: Partial<AppDependencies>,
): TaskServiceApp => {
  logger.info(
    {
      event: 'app_factory_called',
      hasDependencies: !!dependencies,
    },
    '🏭 Creating TaskServiceApp instance with factory function',
  );

  try {
    const app = new TaskServiceApp(dependencies);
    logger.info(
      {
        event: 'app_factory_success',
      },
      '✅ TaskServiceApp instance created successfully',
    );
    return app;
  } catch (error) {
    logger.fatal(
      {
        error: error instanceof Error ? error.message : String(error),
        event: 'app_creation_failed',
      },
      '💀 Failed to create TaskServiceApp instance',
    );

    throw error;
  }
};

// EXPORTACIÓN POR DEFECTO
// Crear instancia singleton para uso normal
const taskServiceApp = new TaskServiceApp();
//export { TaskServiceApp };
export default taskServiceApp;
