// src/commons/middleware/swaggerMiddleware.ts - Middleware para servir docs
import { Request, Response, NextFunction, RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from '@/utils/swagger';

/**
 * Middleware para servir la documentación Swagger
 * @returns Array con la ruta y los middlewares de swagger-ui
 */
export const serveSwaggerDocs = (): [string, RequestHandler[], RequestHandler] => {
  return [
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  ];
};

/**
 * Endpoint para obtener el JSON de Swagger
 */
export const getSwaggerJson = (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
};

/**
 * Middleware para redireccionar /docs a /docs/
 */
export const redirectToDocs = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/docs') {
    res.redirect(301, '/docs/');
    return;
  }
  next();
};

/**
 * Middleware de seguridad para docs en producción
 */
export const protectDocsInProduction = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production') {
    // En producción, podrías querer proteger los docs
    // Por ejemplo, con basic auth o limitando IPs
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !isValidAuthForDocs(authHeader)) {
      res.status(401).json({
        success: false,
        message: 'Documentation access restricted in production',
        error: { code: 'DOCS_RESTRICTED' }
      });
      return;
    }
  }
  next();
};

/**
 * Valida las credenciales de autenticación para acceder a los docs
 * @param authHeader - Header de autorización
 * @returns true si las credenciales son válidas
 */
function isValidAuthForDocs(authHeader: string): boolean {
  // Implementar lógica de autenticación para docs
  // Por ejemplo, basic auth con credenciales específicas
  const expectedAuth = 'Basic ' + Buffer.from('docs:secure123').toString('base64');
  return authHeader === expectedAuth;
}

/**
 * Middleware alternativo que retorna directamente los handlers sin el path
 * Útil cuando quieres definir la ruta en el router
 */
export const createSwaggerMiddleware = (): RequestHandler[] => {
  return [
    ...swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  ];
};

/**
 * Función helper para configurar todos los endpoints de documentación
 * @param app - Instancia de Express
 * @param basePath - Ruta base (por defecto '/api/v1')
 */
export const setupSwaggerEndpoints = (app: any, basePath: string = '/api/v1'): void => {
  // Redirección de /docs a /docs/
  app.use(`${basePath}/docs`, redirectToDocs);
  
  // Protección en producción
  app.use(`${basePath}/docs`, protectDocsInProduction);
  
  // Servir documentación Swagger UI
  app.use(`${basePath}/docs`, swaggerUi.serve);
  app.get(`${basePath}/docs`, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Endpoint para obtener el JSON de Swagger
  app.get(`${basePath}/docs.json`, getSwaggerJson);
  
  console.log(`📚 Swagger docs disponibles en: ${basePath}/docs`);
  console.log(`📄 Swagger JSON disponible en: ${basePath}/docs.json`);
};