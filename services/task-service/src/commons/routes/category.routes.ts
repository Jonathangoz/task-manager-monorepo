// src/commons/routes/category.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { CategoryController } from '@/commons/controllers/CategoryController';
import { authenticateToken } from '@/commons/middlewares/auth.middleware';
import {
  validateCategorySchema,
  createCategorySchema,
  updateCategorySchema,
  getCategoryByIdSchema,
  getCategoriesSchema,
  deleteCategorySchema,
  bulkDeleteCategoriesSchema,
  searchCategoriesSchema,
  getCategoryStatsSchema,
  exportCategoriesSchema,
} from '@/commons/validators/category.validator';
import { ICategoryService } from '@/core/domain/interfaces/ICategoryService';
import {
  createRateLimiter,
  bulkOperationsRateLimit,
} from '@/commons/middlewares/rateLimit.middleware';
import { logger, httpLogger, createRequestLogger } from '@/utils/logger';

// ==============================================
// INTERFACES Y TIPOS
// ==============================================

/**
 * Interface unificada para requests autenticados
 * Corrige el problema de compatibilidad entre middlewares
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string; // Corregido: requerido y no opcional
    lastName: string;  // Corregido: requerido y no opcional
    sessionId?: string;
  };
}

/**
 * Configuración de middleware de cache mock
 * TODO: Reemplazar con implementación real de cache
 */
interface CacheMiddleware {
  categories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => void;
  categoryDetail: (ttl: number) => (req: Request, res: Response, next: NextFunction) => void;
  categoryTasks: (ttl: number) => (req: Request, res: Response, next: NextFunction) => void;
  categoryStats: (ttl: number) => (req: Request, res: Response, next: NextFunction) => void;
  activeCategories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Configuración de rate limiting
 */
interface RateLimitMiddleware {
  categoryCreation: () => (req: Request, res: Response, next: NextFunction) => void;
  bulkOperations: () => (req: Request, res: Response, next: NextFunction) => void;
  exportOperations: () => (req: Request, res: Response, next: NextFunction) => void;
}

// ==============================================
// CONFIGURACIÓN DE MIDDLEWARES
// ==============================================

/**
 * Factory para crear middleware de cache
 * Implementación mock que se puede reemplazar fácilmente
 */
const createCacheMiddleware = (): CacheMiddleware => ({
  categories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(
      req.headers['x-request-id'] as string,
      (req as AuthenticatedRequest).user?.id
    );
    requestLogger.debug({ ttl, endpoint: 'categories' }, 'Cache middleware - categories (mock)');
    next();
  },
  categoryDetail: (ttl: number) => (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(
      req.headers['x-request-id'] as string,
      (req as AuthenticatedRequest).user?.id
    );
    requestLogger.debug({ ttl, endpoint: 'categoryDetail' }, 'Cache middleware - categoryDetail (mock)');
    next();
  },
  categoryTasks: (ttl: number) => (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(
      req.headers['x-request-id'] as string,
      (req as AuthenticatedRequest).user?.id
    );
    requestLogger.debug({ ttl, endpoint: 'categoryTasks' }, 'Cache middleware - categoryTasks (mock)');
    next();
  },
  categoryStats: (ttl: number) => (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(
      req.headers['x-request-id'] as string,
      (req as AuthenticatedRequest).user?.id
    );
    requestLogger.debug({ ttl, endpoint: 'categoryStats' }, 'Cache middleware - categoryStats (mock)');
    next();
  },
  activeCategories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(
      req.headers['x-request-id'] as string,
      (req as AuthenticatedRequest).user?.id
    );
    requestLogger.debug({ ttl, endpoint: 'activeCategories' }, 'Cache middleware - activeCategories (mock)');
    next();
  },
});

/**
 * Factory para crear middleware de rate limiting
 */
const createRateLimitMiddleware = (): RateLimitMiddleware => ({
  categoryCreation: () => createRateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 categorías por minuto
    keyGenerator: (req: Request) => {
      const user = (req as AuthenticatedRequest).user;
      return `create_category:${user?.id || req.ip}`;
    },
  }),
  bulkOperations: () => bulkOperationsRateLimit,
  exportOperations: () => createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 5,
    keyGenerator: (req: Request) => {
      const user = (req as AuthenticatedRequest).user;
      return `export_category:${user?.id || req.ip}`;
    },
  }),
});

// ==============================================
// CONFIGURACIÓN DE CONSTANTES
// ==============================================

/**
 * Configuración de timeouts para cache
 */
const CACHE_TTL = {
  CATEGORIES: 300,        // 5 minutos
  CATEGORY_DETAIL: 300,   // 5 minutos
  CATEGORY_TASKS: 180,    // 3 minutos
  CATEGORY_STATS: 600,    // 10 minutos
  ACTIVE_CATEGORIES: 900, // 15 minutos
} as const;

/**
 * Mensajes de respuesta estandarizados
 */
const RESPONSE_MESSAGES = {
  CATEGORIES_RETRIEVED: 'Categories retrieved successfully',
  CATEGORY_RETRIEVED: 'Category retrieved successfully',
  CATEGORY_CREATED: 'Category created successfully',
  CATEGORY_UPDATED: 'Category updated successfully',
  CATEGORY_DELETED: 'Category deleted successfully',
  CATEGORY_TASKS_RETRIEVED: 'Category tasks retrieved successfully',
  CATEGORY_STATS_RETRIEVED: 'Category statistics retrieved successfully',
  ACTIVE_CATEGORIES_RETRIEVED: 'Active categories retrieved successfully',
  CATEGORIES_SEARCHED: 'Categories search completed successfully',
  BULK_DELETE_COMPLETED: 'categories deleted successfully',
  OWNERSHIP_VALIDATED: 'Category ownership validation completed',
  LIMIT_CHECKED: 'Category limit check completed',
  CATEGORIES_EXPORTED: 'Categories exported successfully',
} as const;

// ==============================================
// CLASE PRINCIPAL DE RUTAS
// ==============================================

/**
 * CategoryRoutes
 * Configuración de rutas para el módulo de categorías siguiendo principios SOLID.
 * 
 * Principios aplicados:
 * - SRP: Una sola responsabilidad - configurar rutas de categorías
 * - OCP: Abierto para extensión, cerrado para modificación
 * - LSP: Las implementaciones pueden ser sustituidas
 * - ISP: Interfaces segregadas para diferentes responsabilidades
 * - DIP: Depende de abstracciones (ICategoryService)
 */
export class CategoryRoutes {
  public router: Router;
  private readonly categoryController: CategoryController;
  private readonly cacheMiddleware: CacheMiddleware;
  private readonly rateLimitMiddleware: RateLimitMiddleware;
  private readonly routeLogger = logger.child({ 
    component: 'CategoryRoutes',
    domain: 'routes' 
  });

  constructor(categoryService: ICategoryService) {
    this.router = Router();
    this.categoryController = new CategoryController(categoryService);
    this.cacheMiddleware = createCacheMiddleware();
    this.rateLimitMiddleware = createRateLimitMiddleware();
    
    this.routeLogger.info('Inicializando CategoryRoutes');
    this.setupGlobalMiddleware();
    this.setupRoutes();
    this.routeLogger.info('CategoryRoutes configurado correctamente');
  }

  /**
   * Configuración de middleware global para todas las rutas de categorías
   */
  private setupGlobalMiddleware(): void {
    this.routeLogger.debug('Configurando middleware global');
    
    // Middleware de autenticación para todas las rutas
    this.router.use(authenticateToken);
    
    // Rate limiter general para usuarios autenticados
    this.router.use(createRateLimiter());
    
    // Middleware de logging para todas las requests
    this.router.use(this.createLoggingMiddleware());
    
    this.routeLogger.debug('Middleware global configurado');
  }

  /**
   * Middleware personalizado de logging para requests
   */
  private createLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string;
      const user = (req as AuthenticatedRequest).user;
      
      const requestLogger = createRequestLogger(requestId, user?.id);
      
      requestLogger.info({
        method: req.method,
        path: req.path,
        query: req.query,
        userId: user?.id,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      }, `🌐 Iniciando request: ${req.method} ${req.path}`);

      // Override del método end para capturar la respuesta
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const duration = Date.now() - startTime;
        
        requestLogger.info({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userId: user?.id,
        }, `✅ Request completada: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
        
        return originalEnd.apply(this);
      };

      next();
    };
  }

  /**
   * Configuración centralizada de todas las rutas de categorías.
   * Organizada por grupos funcionales para mejor mantenibilidad.
   */
  private setupRoutes(): void {
    this.routeLogger.debug('Configurando rutas de categorías');
    
    // Configurar grupos de rutas
    this.setupCrudRoutes();
    this.setupSpecializedRoutes();
    this.setupBulkOperationRoutes();
    this.setupStatisticsRoutes();
    this.setupSearchRoutes();
    this.setupUtilityRoutes();
    this.setupExportRoutes();
    
    this.routeLogger.debug('Todas las rutas configuradas correctamente');
  }

  /**
   * Configuración de rutas CRUD básicas
   */
  private setupCrudRoutes(): void {
    this.routeLogger.debug('Configurando rutas CRUD');

    /**
     * @swagger
     * /api/v1/categories:
     *   get:
     *     summary: Obtener categorías del usuario
     *     description: Recupera una lista paginada y filtrable de categorías del usuario.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - in: query
     *         name: includeTaskCount
     *         schema: { type: 'boolean' }
     *     responses:
     *       200:
     *         description: Lista de categorías.
     */
    this.router.get(
      '/',
      this.cacheMiddleware.categories(CACHE_TTL.CATEGORIES),
      validateCategorySchema(getCategoriesSchema),
      this.wrapControllerMethod('getCategories')
    );

    /**
     * @swagger
     * /api/v1/categories:
     *   post:
     *     summary: Crear nueva categoría
     *     description: Crea una nueva categoría para el usuario autenticado.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateCategoryRequest'
     *     responses:
     *       201:
     *         description: Categoría creada.
     */
    this.router.post(
      '/',
      this.rateLimitMiddleware.categoryCreation(),
      validateCategorySchema(createCategorySchema),
      this.wrapControllerMethod('createCategory')
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   get:
     *     summary: Obtener categoría específica
     *     description: Recupera los detalles de una categoría por su ID.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     responses:
     *       200:
     *         description: Detalles de la categoría.
     */
    this.router.get(
      '/:id',
      this.cacheMiddleware.categoryDetail(CACHE_TTL.CATEGORY_DETAIL),
      validateCategorySchema(getCategoryByIdSchema),
      this.wrapControllerMethod('getCategoryById')
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   put:
     *     summary: Actualizar categoría
     *     description: Actualiza los campos de una categoría existente.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateCategoryRequest'
     *     responses:
     *       200:
     *         description: Categoría actualizada.
     */
    this.router.put(
      '/:id',
      validateCategorySchema(updateCategorySchema),
      this.wrapControllerMethod('updateCategory')
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   delete:
     *     summary: Eliminar categoría
     *     description: Elimina una categoría por su ID.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     responses:
     *       200:
     *         description: Categoría eliminada.
     */
    this.router.delete(
      '/:id',
      validateCategorySchema(deleteCategorySchema),
      this.wrapControllerMethod('deleteCategory')
    );
  }

  /**
   * Configuración de rutas especializadas
   */
  private setupSpecializedRoutes(): void {
    this.routeLogger.debug('Configurando rutas especializadas');

    /**
     * @swagger
     * /api/v1/categories/{id}/tasks:
     *   get:
     *     summary: Obtener tareas de una categoría
     *     description: Recupera las tareas asociadas a una categoría.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     responses:
     *       200:
     *         description: Lista de tareas.
     */
    this.router.get(
      '/:id/tasks',
      this.cacheMiddleware.categoryTasks(CACHE_TTL.CATEGORY_TASKS),
      validateCategorySchema(getCategoryByIdSchema),
      this.wrapControllerMethod('getCategoryTasks')
    );
  }

  /**
   * Configuración de rutas de operaciones masivas
   */
  private setupBulkOperationRoutes(): void {
    this.routeLogger.debug('Configurando rutas de operaciones masivas');

    /**
     * @swagger
     * /api/v1/categories/bulk:
     *   delete:
     *     summary: Eliminación masiva de categorías
     *     description: Elimina múltiples categorías de forma transaccional.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               categoryIds:
     *                 type: array
     *                 items: { type: string }
     *     responses:
     *       200:
     *         description: Categorías eliminadas.
     */
    this.router.delete(
      '/bulk',
      this.rateLimitMiddleware.bulkOperations(),
      validateCategorySchema(bulkDeleteCategoriesSchema),
      this.wrapControllerMethod('bulkDeleteCategories')
    );
  }

  /**
   * Configuración de rutas de estadísticas y análisis
   */
  private setupStatisticsRoutes(): void {
    this.routeLogger.debug('Configurando rutas de estadísticas');

    /**
     * @swagger
     * /api/v1/categories/stats:
     *   get:
     *     summary: Obtener estadísticas de categorías
     *     description: Proporciona estadísticas detalladas sobre las categorías del usuario.
     *     tags: [Statistics]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Estadísticas obtenidas.
     */
    this.router.get(
      '/stats',
      this.cacheMiddleware.categoryStats(CACHE_TTL.CATEGORY_STATS),
      validateCategorySchema(getCategoryStatsSchema),
      this.wrapControllerMethod('getCategoryStats')
    );

    /**
     * @swagger
     * /api/v1/categories/active:
     *   get:
     *     summary: Obtener solo categorías activas
     *     description: Recupera únicamente las categorías marcadas como activas.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Lista de categorías activas.
     */
    this.router.get(
      '/active',
      this.cacheMiddleware.activeCategories(CACHE_TTL.ACTIVE_CATEGORIES),
      this.wrapControllerMethod('getActiveCategories')
    );
  }

  /**
   * Configuración de rutas de búsqueda y filtrado avanzado
   */
  private setupSearchRoutes(): void {
    this.routeLogger.debug('Configurando rutas de búsqueda');

    /**
     * @swagger
     * /api/v1/categories/search:
     *   get:
     *     summary: Búsqueda avanzada de categorías
     *     description: Realiza una búsqueda full-text en nombre y descripción.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: q
     *         schema: { type: 'string', minLength: 2 }
     *         required: true
     *     responses:
     *       200:
     *         description: Resultados de la búsqueda.
     */
    this.router.get(
      '/search',
      validateCategorySchema(searchCategoriesSchema),
      this.wrapControllerMethod('searchCategories')
    );
  }

  /**
   * Configuración de rutas de utilidades y validación
   */
  private setupUtilityRoutes(): void {
    this.routeLogger.debug('Configurando rutas de utilidades');

    /**
     * @swagger
     * /api/v1/categories/{id}/validate:
     *   get:
     *     summary: Validar propiedad de categoría
     *     description: Verifica si el usuario autenticado es propietario de la categoría.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     responses:
     *       200:
     *         description: Validación completada.
     */
    this.router.get(
      '/:id/validate',
      validateCategorySchema(getCategoryByIdSchema),
      this.wrapControllerMethod('validateCategoryOwnership')
    );

    /**
     * @swagger
     * /api/v1/categories/check-limit:
     *   get:
     *     summary: Verificar límite de categorías
     *     description: Verifica si el usuario puede crear más categorías.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Verificación completada.
     */
    this.router.get(
      '/check-limit',
      this.wrapControllerMethod('checkCategoryLimit')
    );
  }

  /**
   * Configuración de rutas de exportación
   */
  private setupExportRoutes(): void {
    this.routeLogger.debug('Configurando rutas de exportación');

    /**
     * @swagger
     * /api/v1/categories/export:
     *   get:
     *     summary: Exportar categorías
     *     description: Exporta las categorías del usuario en diferentes formatos.
     *     tags: [Categories]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: format
     *         schema: { type: 'string', enum: ['json', 'csv', 'xlsx'] }
     *     responses:
     *       200:
     *         description: Archivo de exportación.
     */
    this.router.get(
      '/export',
      this.rateLimitMiddleware.exportOperations(),
      validateCategorySchema(exportCategoriesSchema),
      this.wrapControllerMethod('getCategories') // Reutiliza getCategories hasta implementar exportCategories
    );
  }

  /**
   * Wrapper que unifica el manejo de métodos del controlador
   * Aplica logging consistente y manejo de errores
   * 
   * @param methodName - Nombre del método del controlador
   * @returns Middleware function
   */
  private wrapControllerMethod(methodName: keyof CategoryController) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authReq = req as AuthenticatedRequest;
      const requestLogger = createRequestLogger(
        req.headers['x-request-id'] as string,
        authReq.user?.id
      );

      requestLogger.debug(
        { 
          method: methodName,
          path: req.path,
          userId: authReq.user?.id,
          params: req.params,
          query: req.query 
        },
        `🎯 Ejecutando método del controlador: ${methodName}`
      );

      try {
        // Verificar que el método existe en el controlador
        const controllerMethod = this.categoryController[methodName];
        
        if (typeof controllerMethod !== 'function') {
          const error = new Error(`Controller method '${methodName}' not found`);
          requestLogger.error({ methodName, availableMethods: Object.getOwnPropertyNames(this.categoryController) }, 'Método del controlador no encontrado');
          return next(error);
        }

        // Ejecutar el método del controlador con bind correcto
        return (controllerMethod as Function).call(this.categoryController, authReq, res, next);
      } catch (error) {
        requestLogger.error(
          { 
            error: error instanceof Error ? error.message : String(error),
            methodName,
            userId: authReq.user?.id 
          },
          `❌ Error ejecutando método del controlador: ${methodName}`
        );
        next(error);
      }
    };
  }
}

// ==============================================
// FACTORY FUNCTIONS
// ==============================================

/**
 * Factory function para crear la instancia del router
 * Facilita la inyección de dependencias y testing
 * 
 * @param categoryService - Servicio de categorías
 * @returns Router configurado
 */
export const createCategoryRoutes = (categoryService: ICategoryService): Router => {
  logger.info('🏭 Creando CategoryRoutes con factory function');
  
  try {
    const categoryRoutes = new CategoryRoutes(categoryService);
    
    logger.info('✅ CategoryRoutes creado exitosamente');
    return categoryRoutes.router;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '❌ Error creando CategoryRoutes'
    );
    throw error;
  }
};

/**
 * Función de utilidad para obtener información de las rutas configuradas
 * Útil para debugging y documentación
 */
export const getCategoryRoutesInfo = () => {
  return {
    totalRoutes: 12,
    routeGroups: {
      crud: ['GET /', 'POST /', 'GET /:id', 'PUT /:id', 'DELETE /:id'],
      specialized: ['GET /:id/tasks'],
      bulk: ['DELETE /bulk'],
      statistics: ['GET /stats', 'GET /active'],
      search: ['GET /search'],
      utilities: ['GET /:id/validate', 'GET /check-limit'],
      export: ['GET /export'],
    },
    middleware: {
      authentication: 'authenticateToken',
      rateLimit: 'createRateLimiter',
      cache: 'mockCacheMiddleware',
      validation: 'validateCategorySchema',
      logging: 'customLoggingMiddleware',
    },
    cacheTTL: CACHE_TTL,
  };
};

// Export por defecto
export default CategoryRoutes;