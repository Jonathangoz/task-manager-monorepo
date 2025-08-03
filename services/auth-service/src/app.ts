// src/app.ts - Auth Service Application
// Configuración principal de la aplicación Express con middlewares de seguridad optimizados

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { HelmetOptions } from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Import tipos personalizados
import { AppRequest } from '../types/express';

// Configuration
import { environment } from '@/config/environment';

import { db } from '@/config/database';
import { RedisCache } from '@/core/cache/RedisCache';
import { UserRepository } from '@/core/repositories/UserRepository';
import { AuthService } from '@/core/application/AuthService';
import { TokenService } from '@/core/application/TokenService';
import { UserService } from '@/core/application/UserService';

// Utils
import {
  httpLogger,
  securityLogger,
  createContextLogger,
} from '@/utils/logger';
import { swaggerSpec, swaggerUiOptions, getSwaggerInfo } from '@/utils/swagger';
import {
  REQUEST_HEADERS,
  MIDDLEWARE_CONFIG,
  RATE_LIMIT_CONFIG,
} from '@/utils/constants';

// Middlewares
import {
  errorHandler,
  notFoundHandler,
  payloadTooLargeHandler,
  jsonErrorHandler,
} from '@/commons/middlewares/error.middleware';

// Services and Dependencies
import { UserController } from '@/commons/controllers/UserController';
import { UserRoutes } from '@/commons/routes/user.routes';
import { AuthRoutes } from '@/commons/routes/auth.routes';
import { HealthRoutes } from '@/commons/routes/health.routes';

// Interfaces
import { IUserService } from '@/core/interfaces/IUserService';
import { IAuthService } from '@/core/interfaces/IAuthService';
import { ITokenService } from '@/core/interfaces/ITokenService';
import { IUserRepository } from '@/core/interfaces/IUserRepository';
import { ICacheService } from '@/core/interfaces/ICacheService';

// INTERFACES Y TIPOS
interface SecurityConfig {
  helmet: HelmetOptions;
  cors: cors.CorsOptions;
  rateLimit: RateLimitRequestHandler;
  slowDown: (req: Request, res: Response, next: NextFunction) => void;
}

interface ExtendedRequest extends Request {
  skipTimeout?: boolean;
  isHealthCheck?: boolean;
}

interface ServiceDependencies {
  userRepository: IUserRepository;
  cacheService: ICacheService;
  tokenService: ITokenService;
  userService: IUserService;
  authService: IAuthService;
}

interface JsonRequest extends Request {
  headers: Request['headers'] & {
    'content-length'?: string;
  };
}

interface CacheServiceWithClose extends ICacheService {
  close?: () => Promise<void>;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    sessionId: string;
    iat: number;
    exp: number;
  };
}

interface SlowDownOptions {
  windowMs?: number;
  delayAfter?: number;
  delayMs?: number | ((hits: number) => number);
  maxDelayMs?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (
    req: Request,
    res: Response,
    options: SlowDownOptions,
  ) => void;
}

// Interface para Express Router Stack (Fix para ExpressAppWithRouter)
interface RouterLayer {
  route?: unknown;
}

interface ExpressRouter {
  stack?: RouterLayer[];
}

// Fix: Hacer _router opcional para no conflictar con Application
type ExpressAppWithRouter = Application & {
  _router?: ExpressRouter;
};

// ESQUEMAS ZOD PARA VALIDACIÓN
const RequestHeadersSchema = z.object({
  'user-agent': z.string().optional(),
  'x-forwarded-for': z.string().optional(),
  'x-real-ip': z.string().optional(),
  'correlation-id': z.string().optional(),
  'request-id': z.string().optional(),
  authorization: z.string().optional(),
  'x-api-key': z.string().optional(),
});

const CorsOriginSchema = z.union([
  z.string().url(),
  z.literal('*'),
  z.boolean(),
  z.array(z.string().url()),
]);

// HELPER FUNCTIONS
/**
 * Convierte un string de tamaño (e.g., '10mb') a bytes.
 */
const parseSize = (sizeStr: string): number => {
  const sizeRegex = /^(\d+)(mb|kb|gb)$/i;
  const match = sizeStr.match(sizeRegex);
  if (!match) return 10485760; // Default 10mb

  const size = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'gb':
      return size * 1024 * 1024 * 1024;
    case 'mb':
      return size * 1024 * 1024;
    case 'kb':
      return size * 1024;
    default:
      return size;
  }
};

// CLASE PRINCIPAL DE LA APLICACIÓN
class App {
  public app: Application;
  private readonly appLogger = createContextLogger({ component: 'app' });
  private securityConfig: SecurityConfig;
  private services: ServiceDependencies;

  constructor() {
    this.app = express();
    this.securityConfig = this.buildSecurityConfig();
    this.services = {} as ServiceDependencies;
  }

  public async initializeApp(): Promise<void> {
    try {
      this.appLogger.info('Initializing Auth Service application...', {
        nodeVersion: process.version,
        environment: environment.app.env,
        port: environment.app.port,
        swaggerEnabled: environment.features?.swaggerEnabled,
      });

      // Registrar el contexto y el router de health checks PRIMERO
      this.initializePreSecurityMiddlewares();
      this.initializeHealthRoutes();

      // Registrar los middlewares de seguridad pesados
      await this.initializeSecurityMiddlewares();

      //  await this.validateConfiguration();
      await this.initializeServices();
      await this.initializeCoreMiddlewares();
      await this.initializeValidationMiddlewares();
      await this.initializeRoutes();
      this.initializeSwagger();
      this.initializeErrorHandling();

      this.appLogger.info('Auth Service aplicacion iniciada exitosamente');
    } catch (error) {
      this.appLogger.fatal('Fallo al iniciar la aplicación', { error });
      process.exit(1);
    }
  }

  private async initializeServices(): Promise<void> {
    this.appLogger.info('Initializing services and dependencies...');

    try {
      const userRepository: IUserRepository = new UserRepository(db);
      const cacheService: ICacheService = new RedisCache();
      const tokenService: ITokenService = new TokenService(
        userRepository,
        cacheService,
      );
      const userService: IUserService = new UserService(
        userRepository,
        cacheService,
      );
      const authService: IAuthService = new AuthService(
        userRepository,
        tokenService,
        cacheService,
      );

      this.services = {
        userRepository,
        cacheService,
        tokenService,
        userService,
        authService,
      };

      this.appLogger.info('Services initialized successfully');
    } catch (error) {
      this.appLogger.error('Failed to initialize services', { error });
      throw error;
    }
  }

  /*private async validateConfiguration(): Promise<void> {
    this.appLogger.info('Validating application configuration...');

    try {
      const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName],
      );

      if (missingVars.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missingVars.join(', ')}`,
        );
      }

      if (environment.cors?.origin) {
        CorsOriginSchema.parse(environment.cors.origin);
      }

      if (
        environment.features?.swaggerEnabled &&
        !environment.app.isProduction
      ) {
        if (!validateSwaggerSpec()) {
          throw new Error('Invalid Swagger specification');
        }
      }

      this.appLogger.info('Configuration validation completed successfully');
    } catch (error) {
      this.appLogger.error('Configuration validation failed', { error });
      throw error;
    }
  }*/

  private buildSecurityConfig(): SecurityConfig {
    // Fix: Definir helmetOptions como HelmetOptions en lugar de usar typeof
    const helmetOptions: HelmetOptions = environment.app.isProduction
      ? {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com',
              ],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
              connectSrc: ["'self'", 'https://api.github.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
              childSrc: ["'none'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              manifestSrc: ["'self'"],
            },
          },
          crossOriginEmbedderPolicy: { policy: 'credentialless' as const },
          crossOriginOpenerPolicy: { policy: 'same-origin' as const },
          crossOriginResourcePolicy: { policy: 'cross-origin' as const },
          dnsPrefetchControl: { allow: false },
          frameguard: { action: 'deny' as const },
          hidePoweredBy: true,
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
          ieNoOpen: true,
          noSniff: true,
          originAgentCluster: true,
          permittedCrossDomainPolicies: false,
          referrerPolicy: {
            policy: 'strict-origin-when-cross-origin' as const,
          },
          xssFilter: true,
        }
      : {
          contentSecurityPolicy: false,
          crossOriginEmbedderPolicy: false,
          hsts: false,
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
        'X-Device-Id',
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        REQUEST_HEADERS.CORRELATION_ID,
        REQUEST_HEADERS.REQUEST_ID,
      ],
      maxAge: 86400,
      optionsSuccessStatus: 200,
      preflightContinue: false,
    };

    const rateLimitConfig = rateLimit({
      windowMs: RATE_LIMIT_CONFIG.GENERAL.WINDOW_MS || 15 * 60 * 1000,
      max: RATE_LIMIT_CONFIG.GENERAL.MAX_REQUESTS || 100,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          details: 'Maximum requests per window exceeded',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, _res: Response) => {
        securityLogger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        });
        _res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later',
          error: { code: 'RATE_LIMIT_EXCEEDED' },
        });
      },
      skip: (req: Request) => {
        return req.path.startsWith('/health');
      },
    });

    const slowDownOptions = slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: 50,
      delayMs: (hits) => hits * 100,
      maxDelayMs: 20000,
    });

    return {
      helmet: helmetOptions,
      cors: corsConfig,
      rateLimit: rateLimitConfig,
      slowDown: slowDownOptions,
    };
  }

  private initializePreSecurityMiddlewares(): void {
    this.app.set('trust proxy', environment.app.isProduction ? 1 : 1);
    this.app.use(this.requestContextMiddleware.bind(this));
  }

  private initializeHealthRoutes(): void {
    this.appLogger.info('Initializing health check routes (pre-security)...');
    const apiVersion = `/api/${environment.app.apiVersion}`;
    this.app.use(`${apiVersion}/health`, HealthRoutes.routes);
  }

  private async initializeSecurityMiddlewares(): Promise<void> {
    this.appLogger.info('Inicializando Middleware sw Seguridad...');

    this.app.use(helmet(this.securityConfig.helmet));
    this.app.use(cors(this.securityConfig.cors));

    if (!environment.app.isTest) {
      this.app.use(this.securityConfig.slowDown);
      this.app.use(this.securityConfig.rateLimit);
    }

    this.appLogger.info('Middleware de Seguridad Iniciado Exitosamente');
  }

  private async initializeCoreMiddlewares(): Promise<void> {
    this.appLogger.info('Initializing core middlewares...');

    // ✅ TIMEOUT MIDDLEWARE MEJORADO - EXCLUYE HEALTH CHECKS COMPLETAMENTE
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // ✅ PATHS QUE NUNCA DEBEN TENER TIMEOUT (CRÍTICO PARA RENDER)
      const noTimeoutPaths = [
        '/health',
        '/api/v1/health',
        '/api/v1/health/ready',
        '/api/v1/health/live',
        '/api/v1/health/ping',
        '/api/v1/health/status',
        '/api/v1/health/healthz',
        '/ping',
        '/status',
        '/healthz',
        '/metrics',
        '/', // Root también puede ser usado por Render
      ];

      // Verificar si es un health check (más flexible)
      const isHealthCheck = noTimeoutPaths.some(
        (path) =>
          req.path === path ||
          req.path.startsWith(path + '/') ||
          req.url.includes('/health') ||
          req.path.includes('/health'),
      );

      // ✅ SKIP TIMEOUT COMPLETAMENTE para health checks
      if (
        isHealthCheck ||
        (req as ExtendedRequest).skipTimeout ||
        (req as ExtendedRequest).isHealthCheck
      ) {
        return next();
      }
    });

    // ✅ Compression optimizado con exclusión de health checks
    this.app.use(
      compression({
        threshold: MIDDLEWARE_CONFIG?.COMPRESSION_THRESHOLD || 1024,
        level: environment.app.isProduction ? 6 : 1,
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          // ✅ No comprimir health checks para mayor velocidad
          if (
            req.path.includes('/health') ||
            req.path === '/ping' ||
            req.path === '/status'
          ) {
            return false;
          }
          const contentType = res.getHeader('content-type');
          if (typeof contentType === 'string') {
            const skipTypes = [
              'image/',
              'video/',
              'audio/',
              'application/zip',
              'application/gzip',
            ];
            if (skipTypes.some((type) => contentType.includes(type))) {
              return false;
            }
          }
          return compression.filter(req, res);
        },
      }),
    );

    const maxRequestSizeBytes = parseSize(
      MIDDLEWARE_CONFIG?.MAX_REQUEST_SIZE || '10mb',
    );

    // ✅ JSON parser optimizado con exclusión de health checks
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // ✅ Health checks no necesitan parsing JSON (más rápido)
      if (
        req.path.includes('/health') ||
        req.path === '/ping' ||
        req.path === '/status'
      ) {
        return next();
      }

      return express.json({
        limit: maxRequestSizeBytes,
        strict: true,
        type: ['application/json', 'application/*+json'],
        verify: (req: JsonRequest, _res: Response, buf: Buffer) => {
          if (buf && buf.length === 0) {
            throw new Error('Request body cannot be empty');
          }
          const contentLength = parseInt(
            req.headers['content-length'] || '0',
            10,
          );
          if (contentLength > maxRequestSizeBytes) {
            throw new Error('Payload too large');
          }
        },
      })(req, res, next);
    });

    // ✅ URL encoded parser optimizado con exclusión de health checks
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.path.includes('/health') ||
        req.path === '/ping' ||
        req.path === '/status'
      ) {
        return next();
      }

      return express.urlencoded({
        extended: true,
        limit: maxRequestSizeBytes,
        parameterLimit: 100,
        type: 'application/x-www-form-urlencoded',
      })(req, res, next);
    });

    this.app.use(cookieParser(environment.jwt?.secret));
    this.setupMorganLogging();
    this.app.use(jsonErrorHandler);
    this.app.use(payloadTooLargeHandler);
    this.app.use(this.requestLoggingMiddleware.bind(this));

    this.appLogger.info('Core middlewares initialized successfully');
  }

  private setupMorganLogging(): void {
    morgan.token(
      'correlation-id',
      (req: Request) => (req as AppRequest).correlationId || 'unknown',
    );
    morgan.token(
      'request-id',
      (req: Request) => (req as AppRequest).requestId || 'unknown',
    );
    morgan.token(
      'real-ip',
      (req: Request) => (req as AppRequest).clientIp || req.ip || 'unknown',
    );
    morgan.token(
      'user-id',
      (req: AuthenticatedRequest) => req.user?.id || 'anonymous',
    );
    morgan.token('response-time-ms', (req: Request, _res: Response) => {
      const startTime = (req as AppRequest).startTime || Date.now();
      return `${Date.now() - startTime}ms`;
    });

    const productionFormat =
      ':real-ip - :user-id [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms :correlation-id';
    const developmentFormat =
      ':method :url :status :response-time-ms - :res[content-length] :correlation-id';
    const morganFormat = environment.app.isProduction
      ? productionFormat
      : developmentFormat;

    this.app.use(
      morgan(morganFormat, {
        stream: {
          write: (message: string) => {
            const cleanMessage = message.trim();
            if (cleanMessage) {
              httpLogger.info(cleanMessage);
            }
          },
        },
        skip: (req: Request, res: Response) => {
          // ✅ SKIP MÁS AGRESIVO para health checks y evitar spam de logs
          const skipPaths = [
            `/api/${environment.app.apiVersion}/health`,
            `/health`,
            '/metrics',
            '/favicon.ico',
            // ✅ Agregar más paths de health checks
            `/api/${environment.app.apiVersion}/health/ready`,
            `/api/${environment.app.apiVersion}/health/live`,
            '/health/ready',
            '/health/live',
          ];

          const shouldSkip = skipPaths.some((path) => req.url.startsWith(path));

          // ✅ En producción, skip TODOS los health checks exitosos
          if (
            environment.app.isProduction &&
            req.url.includes('/health') &&
            res.statusCode < 400
          ) {
            return true;
          }

          return shouldSkip;
        },
      }),
    );
  }

  private async initializeValidationMiddlewares(): Promise<void> {
    this.appLogger.info('Initializing validation middlewares...');

    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      try {
        const headers = {
          'user-agent': req.get('user-agent'),
          'x-forwarded-for': req.get('x-forwarded-for'),
          'x-real-ip': req.get('x-real-ip'),
          'correlation-id': req.get('correlation-id'),
          'request-id': req.get('request-id'),
          authorization: req.get('authorization'),
          'x-api-key': req.get('x-api-key'),
        };

        const validation = RequestHeadersSchema.safeParse(headers);
        if (!validation.success) {
          this.appLogger.debug('Header validation warnings', {
            path: req.path,
            issues: validation.error.issues,
          });
        }

        next();
      } catch (error) {
        this.appLogger.error('Header validation error', { error });
        next();
      }
    });

    this.appLogger.info('Validation middlewares initialized successfully');
  }

  private requestContextMiddleware(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const startTime = Date.now();

    req.correlationId =
      req.get(REQUEST_HEADERS.CORRELATION_ID) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId =
      req.get(REQUEST_HEADERS.REQUEST_ID) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = startTime;
    req.clientIp = this.getClientIP(req);

    const userAgent = req.get('User-Agent') || '';
    req.deviceInfo = {
      userAgent,
      platform: this.extractPlatform(userAgent),
      browser: this.extractBrowser(userAgent),
    };

    res.setHeader(REQUEST_HEADERS.CORRELATION_ID, req.correlationId);
    res.setHeader(REQUEST_HEADERS.REQUEST_ID, req.requestId);

    req.on('timeout', () => {
      securityLogger.warn('Request timeout detected', {
        correlationId: req.correlationId,
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: req.clientIp,
        userAgent,
        duration: `${Date.now() - startTime}ms`,
      });
    });

    next();
  }

  private requestLoggingMiddleware(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const startTime = req.startTime || Date.now();

    // ✅ NO log debug para health checks en producción
    if (environment.app.isDevelopment && !req.path.includes('/health')) {
      this.appLogger.debug('Incoming request', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        ip: req.clientIp,
        userAgent: req.deviceInfo?.userAgent,
      });
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const isHealthCheck = req.path.includes('/health');

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
        responseSize: res.get('content-length') || '0',
      };

      res.setHeader('X-Response-Time', `${duration}ms`);

      // ✅ LOG MÁS INTELIGENTE - menos logs para health checks exitosos
      if (res.statusCode >= 500) {
        httpLogger.error('HTTP Request Error', logData);
      } else if (res.statusCode >= 400) {
        httpLogger.warn('HTTP Request Warning', logData);
      } else {
        // ✅ Solo log health checks si fallan o en desarrollo
        if (
          !isHealthCheck ||
          !environment.app.isProduction ||
          res.statusCode >= 400
        ) {
          httpLogger.info('HTTP Request Completed', logData);
        }
      }

      // ✅ Warning para requests lentos (pero no health checks normales)
      if (duration > 5000 && !isHealthCheck) {
        securityLogger.warn('Slow request detected', {
          ...logData,
          threshold: '5000ms',
        });
      }
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        const duration = Date.now() - startTime;
        const isHealthCheck = req.path.includes('/health');

        // ✅ Solo log closes inesperados si no son health checks
        if (!isHealthCheck) {
          httpLogger.warn('HTTP Request closed before completion', {
            correlationId: req.correlationId,
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            duration: `${duration}ms`,
            event: 'REQUEST_CLOSED_EARLY',
          });
        }
      }
    });

    next();
  }

  private async initializeRoutes(): Promise<void> {
    this.appLogger.info('Inicializando Rutas...');

    const apiVersion = `/api/${environment.app.apiVersion}`;

    this.app.get('/', this.createRootHandler());

    try {
      const authRoutes = AuthRoutes.create({
        authService: this.services.authService,
        userService: this.services.userService,
        tokenService: this.services.tokenService,
      });
      this.app.use(`${apiVersion}/auth`, authRoutes);

      const userController = new UserController(
        this.services.userService,
        this.services.authService,
      );

      const userRoutesInstance = UserRoutes.create({ userController });
      this.app.use(`${apiVersion}/users`, userRoutesInstance.routes);

      this.appLogger.info('Routes initialized successfully');
    } catch (error) {
      this.appLogger.error('Failed to initialize routes', { error });
      throw error;
    }

    this.app.get(`${apiVersion}`, this.createApiInfoHandler(apiVersion));

    if (environment.app.isDevelopment) {
      this.app.get(`${apiVersion}/metrics`, this.createMetricsHandler());
    }
  }

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
            total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          },
          documentation: !environment.app.isProduction ? '/api-docs' : null,
          healthCheck: `/api/${environment.app.apiVersion}/health`,
        },
        meta: {
          correlationId: (req as AppRequest).correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          version: environment.app.apiVersion,
        },
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
            `${apiVersion}/health`,
          ],
          documentation: !environment.app.isProduction ? '/api-docs' : null,
          rateLimit: {
            windowMs: '15 minutes',
            maxRequests: 100,
          },
        },
        meta: {
          correlationId: (req as AppRequest).correlationId,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
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
          arrayBuffers: memUsage.arrayBuffers,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      });
    };
  }

  private initializeSwagger(): void {
    if (environment.app.isProduction || !environment.features?.swaggerEnabled) {
      this.appLogger.info('Swagger disabled in production environment');
      return;
    }

    try {
      this.app.use('/api-docs', swaggerUi.serve);
      this.app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

      this.app.get('/api-docs.json', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(swaggerSpec);
      });

      this.app.get('/swagger.json', (req: Request, res: Response) => {
        res.redirect('/api-docs.json');
      });

      const swaggerInfo = getSwaggerInfo();
      this.appLogger.info('Swagger documentation initialized successfully', {
        path: '/api-docs',
        jsonPath: '/api-docs.json',
        ...swaggerInfo,
      });
    } catch (error) {
      this.appLogger.error('Failed to initialize Swagger documentation', {
        error,
      });
    }
  }

  private initializeErrorHandling(): void {
    this.appLogger.info('Initializing error handling...');

    this.app.use('*', notFoundHandler);
    this.app.use(errorHandler);
    this.setupGracefulShutdown();

    this.appLogger.info('Error handling initialized successfully');
  }

  private setupGracefulShutdown(): void {
    process.on(
      'unhandledRejection',
      (reason: unknown, promise: Promise<unknown>) => {
        this.appLogger.fatal('Unhandled Promise Rejection detected', {
          reason:
            reason instanceof Error
              ? {
                  message: reason.message,
                  stack: reason.stack,
                  name: reason.name,
                }
              : reason,
          promise: promise.toString(),
        });
        setTimeout(() => process.exit(1), 1000);
      },
    );

    process.on('uncaughtException', (error: Error) => {
      this.appLogger.fatal('Uncaught Exception detected', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      this.appLogger.info('SIGTERM received, starting graceful shutdown...');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      this.appLogger.info('SIGINT received, starting graceful shutdown...');
      this.gracefulShutdown('SIGINT');
    });

    process.on('warning', (warning) => {
      this.appLogger.warn('Process warning detected', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    const shutdownLogger = createContextLogger({
      component: 'shutdown',
      signal,
    });

    try {
      shutdownLogger.info('Starting graceful shutdown process...', {
        signal,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });

      // Fix: Verificar que el servicio existe y tiene el método close antes de llamarlo
      const cacheService = this.services.cacheService as CacheServiceWithClose;
      if (cacheService && typeof cacheService.close === 'function') {
        await cacheService.close();
      }

      shutdownLogger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      shutdownLogger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  }

  private getCorsOrigins(): string | string[] | boolean {
    if (environment.app.isDevelopment) {
      return true;
    }
    const allowedOrigins = environment.cors?.origin;
    if (!allowedOrigins) {
      this.appLogger.warn('No CORS origins configured for production');
      return false;
    }
    return allowedOrigins;
  }

  private getClientIP(req: Request): string {
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'x-forwarded',
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded',
    ];
    for (const header of ipHeaders) {
      const value = req.get(header);
      if (value) {
        const ip = value.split(',')[0].trim();
        if (this.isValidIP(ip)) {
          return ip;
        }
      }
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv4Regex.test(ip)) {
      return ip.split('.').every((octet) => parseInt(octet, 10) <= 255);
    }
    return ipv6Regex.test(ip);
  }

  private extractPlatform(userAgent: string): string {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac OS X/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    const browserMatches = userAgent.match(
      /(Chrome|Firefox|Safari|Edge|Opera|Brave)\/([\d.]+)/,
    );
    if (browserMatches) {
      return `${browserMatches[1]} ${browserMatches[2].split('.')[0]}`;
    }
    return 'Unknown';
  }

  private getRoutesCount(): number {
    const app = this.app as ExpressAppWithRouter;
    const stack = app._router?.stack || [];
    return stack.filter((layer: RouterLayer) => layer.route).length;
  }

  public getApp(): Application {
    return this.app;
  }

  public async close(): Promise<void> {
    this.appLogger.info('Closing application manually...');
    await this.gracefulShutdown('MANUAL_CLOSE');
  }

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
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      features: {
        swagger:
          !environment.app.isProduction && environment.features?.swaggerEnabled,
        rateLimit: !environment.app.isTest,
        compression: true,
        security: environment.app.isProduction,
      },
      routes: this.getRoutesCount(),
      services: {
        userService: !!this.services.userService,
        authService: !!this.services.authService,
        tokenService: !!this.services.tokenService,
        cacheService: !!this.services.cacheService,
        userRepository: !!this.services.userRepository,
      },
    };
  }

  public configureForTesting(): void {
    if (!environment.app.isTest) {
      this.appLogger.warn('configureForTesting called in non-test environment');
      return;
    }
    this.app.set('trust proxy', true);
    this.app.get('/test/info', (req: Request, res: Response) => {
      res.json(this.getAppInfo());
    });
    this.appLogger.info('Application configured for testing');
  }

  public getServices(): ServiceDependencies {
    return this.services;
  }
}

// VALIDADORES ZOD ADICIONALES PARA EXPORT
export const AppValidators = {
  RequestHeaders: RequestHeadersSchema,
  CorsOrigin: CorsOriginSchema,
  EnvironmentConfig: z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z
      .string()
      .transform(Number)
      .refine((n) => n > 0 && n < 65536),
    JWT_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    CORS_ORIGIN: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  BasicRequest: z.object({
    correlationId: z.string().optional(),
    requestId: z.string().optional(),
    userAgent: z.string().optional(),
    ip: z.string().ip().optional(),
  }),
};

// TIPOS TYPESCRIPT PARA EXPORT
export type AppRequestExtended = AppRequest;
export type SecurityConfigType = SecurityConfig;
export type ServiceDependenciesType = ServiceDependencies;

// CONSTANTES DE CONFIGURACIÓN
export const APP_CONSTANTS = {
  MAX_REQUEST_SIZE: '10mb',
  COMPRESSION_THRESHOLD: 1024,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 100,
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  SLOW_REQUEST_THRESHOLD: 5000,
  CORS_MAX_AGE: 86400,
  HSTS_MAX_AGE: 31536000,
  SKIP_LOGGING_PATHS: ['/health', '/metrics', '/favicon.ico'],
  SKIP_RATE_LIMIT_PATHS: ['/health'],
} as const;

export default App;
