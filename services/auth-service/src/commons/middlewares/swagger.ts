// src/commons/middleware/swagger.ts - Middleware para servir docs
import { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from '@/utils/swagger';

/**
 * Middleware para servir la documentación Swagger
 */
export const serveSwaggerDocs = () => {
  return [
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  ];
};

/**
 * Endpoint para obtener el JSON de Swagger
 */
export const getSwaggerJson = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
};

/**
 * Middleware para redireccionar /docs a /docs/
 */
export const redirectToDocs = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/docs') {
    res.redirect(301, '/docs/');
    return;
  }
  next();
};

/**
 * Middleware de seguridad para docs en producción
 */
export const protectDocsInProduction = (req: Request, res: Response, next: NextFunction) => {
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

function isValidAuthForDocs(authHeader: string): boolean {
  // Implementar lógica de autenticación para docs
  // Por ejemplo, basic auth con credenciales específicas
  const expectedAuth = 'Basic ' + Buffer.from('docs:secure123').toString('base64');
  return authHeader === expectedAuth;
}