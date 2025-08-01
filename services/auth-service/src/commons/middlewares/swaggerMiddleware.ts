// src/commons/middleware/swagger.ts - Middleware para servir docs
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '@/typeExpress/express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from '@/utils/swagger';
import { environment } from '@/config/environment';

// ==============================================
// TIPOS Y INTERFACES
// ==============================================
interface SwaggerSecurityConfig {
  username: string;
  password: string;
}

interface SwaggerMiddlewares {
  serve: RequestHandler[];
  setup: RequestHandler;
  getJson: RequestHandler;
  redirectToDocs: RequestHandler;
  protectDocs: RequestHandler;
}

// ==============================================
// CONFIGURACIÓN DE SEGURIDAD
// ==============================================
const SWAGGER_AUTH_CONFIG: SwaggerSecurityConfig = {
  username: process.env.SWAGGER_AUTH_USER || 'docs',
  password: process.env.SWAGGER_AUTH_PASS || 'secure123',
};

// ==============================================
// SERVICIOS DE VALIDACIÓN
// ==============================================
class SwaggerAuthService {
  private static instance: SwaggerAuthService;

  private constructor() {}

  public static getInstance(): SwaggerAuthService {
    if (!SwaggerAuthService.instance) {
      SwaggerAuthService.instance = new SwaggerAuthService();
    }
    return SwaggerAuthService.instance;
  }

  /**
   * Valida las credenciales para acceso a documentación
   */
  public validateDocsAuth(authHeader: string): boolean {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return false;
    }

    const expectedAuth =
      'Basic ' +
      Buffer.from(
        `${SWAGGER_AUTH_CONFIG.username}:${SWAGGER_AUTH_CONFIG.password}`,
      ).toString('base64');

    return authHeader === expectedAuth;
  }

  /**
   * Verifica si la documentación debe estar protegida
   */
  public shouldProtectDocs(): boolean {
    return environment.app.isProduction;
  }
}

// ==============================================
// FACTORY DE MIDDLEWARES
// ==============================================
class SwaggerMiddlewareFactory {
  private readonly authService: SwaggerAuthService;

  constructor() {
    this.authService = SwaggerAuthService.getInstance();
  }

  /**
   * Crea el middleware para servir los archivos estáticos de Swagger UI
   */
  public createServeMiddlewares(): RequestHandler[] {
    return swaggerUi.serve;
  }

  /**
   * Crea el middleware para setup de Swagger UI
   */
  public createSetupMiddleware(): RequestHandler {
    return swaggerUi.setup(swaggerSpec, swaggerUiOptions);
  }

  /**
   * Crea el middleware para obtener el JSON de Swagger
   */
  public createJsonMiddleware(): RequestHandler {
    return (req: Request, res: Response): void => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 minutos
      res.json(swaggerSpec);
    };
  }

  /**
   * Crea el middleware para redireccionar /docs a /docs/
   */
  public createRedirectMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path === '/docs') {
        res.redirect(301, `${req.path}/`);
        return;
      }
      next();
    };
  }

  /**
   * Crea el middleware de protección para producción
   */
  public createProtectionMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!this.authService.shouldProtectDocs()) {
        next();
        return;
      }

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        this.sendAuthChallenge(res);
        return;
      }

      if (!this.authService.validateDocsAuth(authHeader)) {
        this.sendUnauthorizedResponse(res);
        return;
      }

      next();
    };
  }

  /**
   * Envía challenge de autenticación básica
   */
  private sendAuthChallenge(res: Response): void {
    res.set('WWW-Authenticate', 'Basic realm="Swagger Documentation"');
    res.status(401).json({
      success: false,
      message: 'Authentication required to access documentation',
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        details:
          'Please provide valid credentials to access the API documentation',
      },
    });
  }

  /**
   * Envía respuesta de credenciales inválidas
   */
  private sendUnauthorizedResponse(res: Response): void {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials for documentation access',
      error: {
        code: 'INVALID_CREDENTIALS',
        details:
          'The provided credentials are not valid for accessing the documentation',
      },
    });
  }
}

// ==============================================
// INSTANCIA DEL FACTORY
// ==============================================
const middlewareFactory = new SwaggerMiddlewareFactory();

// ==============================================
// EXPORTS DE MIDDLEWARES INDIVIDUALES
// ==============================================

/**
 * Array de middlewares para servir los archivos estáticos de Swagger UI
 */
export const swaggerServeMiddlewares: RequestHandler[] =
  middlewareFactory.createServeMiddlewares();

/**
 * Middleware para configurar y renderizar Swagger UI
 */
export const swaggerSetupMiddleware: RequestHandler =
  middlewareFactory.createSetupMiddleware();

/**
 * Middleware para obtener el JSON de especificación de Swagger
 */
export const getSwaggerJson: RequestHandler =
  middlewareFactory.createJsonMiddleware();

/**
 * Middleware para redireccionar /docs a /docs/
 */
export const redirectToDocs: RequestHandler =
  middlewareFactory.createRedirectMiddleware();

/**
 * Middleware de seguridad para docs en producción
 */
export const protectDocsInProduction: RequestHandler =
  middlewareFactory.createProtectionMiddleware();

// ==============================================
// EXPORT DE CONJUNTO COMPLETO DE MIDDLEWARES
// ==============================================

/**
 * Objeto con todos los middlewares de Swagger organizados
 */
export const swaggerMiddlewares: SwaggerMiddlewares = {
  serve: swaggerServeMiddlewares,
  setup: swaggerSetupMiddleware,
  getJson: getSwaggerJson,
  redirectToDocs: redirectToDocs,
  protectDocs: protectDocsInProduction,
};

// ==============================================
// FUNCIÓN HELPER PARA APLICAR TODOS LOS MIDDLEWARES
// ==============================================

/**
 * Obtiene todos los middlewares necesarios para Swagger en el orden correcto
 * @param includeProtection - Si incluir protección de producción (por defecto: true)
 * @returns Array de middlewares para aplicar en Express
 */
export const getAllSwaggerMiddlewares = (
  includeProtection: boolean = true,
): RequestHandler[] => {
  const middlewares: RequestHandler[] = [];

  // Redirección si es necesaria
  middlewares.push(redirectToDocs);

  // Protección en producción si está habilitada
  if (includeProtection) {
    middlewares.push(protectDocsInProduction);
  }

  // Middlewares de Swagger UI (serve devuelve un array)
  middlewares.push(...swaggerServeMiddlewares);

  // Setup de Swagger UI
  middlewares.push(swaggerSetupMiddleware);

  return middlewares;
};

// ==============================================
// EXPORT DEFAULT
// ==============================================
export default {
  middlewares: swaggerMiddlewares,
  getAllMiddlewares: getAllSwaggerMiddlewares,
  factory: middlewareFactory,
  authService: SwaggerAuthService.getInstance(),
};
