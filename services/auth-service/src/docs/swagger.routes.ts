// src/docs/swagger.routes.ts
import { Router } from 'express';
import {
  swaggerMiddlewares,
  getAllSwaggerMiddlewares,
} from '@/commons/middlewares/swaggerMiddleware';

class SwaggerRoutes {
  private router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Ruta para obtener el JSON de la especificación
    this.router.get('/swagger.json', swaggerMiddlewares.getJson);

    // Rutas para la documentación UI
    this.router.use('/docs', ...getAllSwaggerMiddlewares(true));

    // Redirección desde /api-docs a /docs para compatibilidad
    this.router.get('/api-docs', (req, res) => {
      res.redirect(301, '/api/v1/docs/');
    });

    // Health check específico para docs
    this.router.get('/docs/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'swagger-docs',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });
  }

  public get routes(): Router {
    return this.router;
  }

  // Método estático factory
  static create(): SwaggerRoutes {
    return new SwaggerRoutes();
  }
}

export { SwaggerRoutes };
export default SwaggerRoutes.create().routes;
