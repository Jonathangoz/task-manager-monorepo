// src/commons/routes/category.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { CategoryController } from '@/commons/controllers/CategoryController';
import { authenticateToken, AuthenticatedRequest } from '@/commons/middlewares/auth.middleware';
import { ValidationMiddleware } from '@/commons/middlewares/validation.middleware';
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
import { logger } from '@/utils/logger';

// Mock de middleware de cache (reemplazar con implementación real)
const cacheMiddleware = {
  categories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => next(),
  categoryDetail: (ttl: number) => (req: Request, res: Response, next: NextFunction) => next(),
  categoryTasks: (ttl: number) => (req: Request, res: Response, next: NextFunction) => next(),
  categoryStats: (ttl: number) => (req: Request, res: Response, next: NextFunction) => next(),
  activeCategories: (ttl: number) => (req: Request, res: Response, next: NextFunction) => next(),
};

// Middleware de rate limiting específicos
const rateLimitMiddleware = {
  categoryCreation: () => createRateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 categorías por minuto
    keyGenerator: (req: AuthenticatedRequest) => `create_category:${req.user?.id || req.ip}`,
  }),
  bulkOperations: () => bulkOperationsRateLimit,
  exportOperations: () => createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 5,
    keyGenerator: (req: AuthenticatedRequest) => `export_category:${req.user?.id || req.ip}`,
  }),
};

/**
 * CategoryRoutes
 * Configuración de rutas para el módulo de categorías siguiendo principios SOLID.
 */
export class CategoryRoutes {
  public router: Router;
  private categoryController: CategoryController;

  constructor(categoryService: ICategoryService) {
    this.router = Router();
    this.categoryController = new CategoryController(categoryService);
    this.setupRoutes();
  }

  /**
   * Configuración centralizada de todas las rutas de categorías.
   */
  private setupRoutes(): void {
    // Middleware global para todas las rutas de categorías
    this.router.use(authenticateToken);
    this.router.use(createRateLimiter()); // Rate limiter general para usuarios autenticados

    // RUTAS PRINCIPALES DE CRUD

    /**
     * @swagger
     * /api/v1/categories:
     * get:
     * summary: Obtener categorías del usuario
     * description: Recupera una lista paginada y filtrable de categorías del usuario.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/PageParam'
     * - $ref: '#/components/parameters/LimitParam'
     * - in: query
     * name: includeTaskCount
     * schema: { type: 'boolean' }
     * responses:
     * 200:
     * description: Lista de categorías.
     */
    this.router.get(
      '/',
      cacheMiddleware.categories(300),
      validateCategorySchema(getCategoriesSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.getCategories
    );

    /**
     * @swagger
     * /api/v1/categories:
     * post:
     * summary: Crear nueva categoría
     * description: Crea una nueva categoría para el usuario autenticado.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * requestBody:
     * required: true
     * content:
     * application/json:
     * schema:
     * $ref: '#/components/schemas/CreateCategoryRequest'
     * responses:
     * 201:
     * description: Categoría creada.
     */
    this.router.post(
      '/',
      rateLimitMiddleware.categoryCreation(),
      validateCategorySchema(createCategorySchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.createCategory
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     * get:
     * summary: Obtener categoría específica
     * description: Recupera los detalles de una categoría por su ID.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/CategoryIdParam'
     * responses:
     * 200:
     * description: Detalles de la categoría.
     */
    this.router.get(
      '/:id',
      cacheMiddleware.categoryDetail(300),
      validateCategorySchema(getCategoryByIdSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.getCategoryById
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     * put:
     * summary: Actualizar categoría
     * description: Actualiza los campos de una categoría existente.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/CategoryIdParam'
     * requestBody:
     * required: true
     * content:
     * application/json:
     * schema:
     * $ref: '#/components/schemas/UpdateCategoryRequest'
     * responses:
     * 200:
     * description: Categoría actualizada.
     */
    this.router.put(
      '/:id',
      validateCategorySchema(updateCategorySchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.updateCategory
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     * delete:
     * summary: Eliminar categoría
     * description: Elimina una categoría por su ID.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/CategoryIdParam'
     * responses:
     * 200:
     * description: Categoría eliminada.
     */
    this.router.delete(
      '/:id',
      validateCategorySchema(deleteCategorySchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.deleteCategory
    );

    // RUTAS DE FUNCIONALIDADES ESPECIALIZADAS

    /**
     * @swagger
     * /api/v1/categories/{id}/tasks:
     * get:
     * summary: Obtener tareas de una categoría
     * description: Recupera las tareas asociadas a una categoría.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/CategoryIdParam'
     * responses:
     * 200:
     * description: Lista de tareas.
     */
    this.router.get(
      '/:id/tasks',
      cacheMiddleware.categoryTasks(180),
      validateCategorySchema(getCategoryByIdSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.getCategoryTasks
    );

    // RUTAS DE OPERACIONES MASIVAS

    /**
     * @swagger
     * /api/v1/categories/bulk:
     * delete:
     * summary: Eliminación masiva de categorías
     * description: Elimina múltiples categorías de forma transaccional.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * requestBody:
     * required: true
     * content:
     * application/json:
     * schema:
     * type: object
     * properties:
     * categoryIds:
     * type: array
     * items: { type: string }
     * responses:
     * 200:
     * description: Categorías eliminadas.
     */
    this.router.delete(
      '/bulk',
      rateLimitMiddleware.bulkOperations(),
      validateCategorySchema(bulkDeleteCategoriesSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.bulkDeleteCategories
    );

    // RUTAS DE ESTADÍSTICAS Y ANÁLISIS

    /**
     * @swagger
     * /api/v1/categories/stats:
     * get:
     * summary: Obtener estadísticas de categorías
     * description: Proporciona estadísticas detalladas sobre las categorías del usuario.
     * tags: [Statistics]
     * security:
     * - BearerAuth: []
     * responses:
     * 200:
     * description: Estadísticas obtenidas.
     */
    this.router.get(
      '/stats',
      cacheMiddleware.categoryStats(600),
      validateCategorySchema(getCategoryStatsSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.getCategoryStats
    );

    /**
     * @swagger
     * /api/v1/categories/active:
     * get:
     * summary: Obtener solo categorías activas
     * description: Recupera únicamente las categorías marcadas como activas.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * responses:
     * 200:
     * description: Lista de categorías activas.
     */
    this.router.get(
      '/active',
      cacheMiddleware.activeCategories(900),
      // FIX: Llamada al método de la instancia `this.categoryController`. El error de tipado se resuelve
      // asegurando que `AuthenticatedRequest` sea consistente en todo el proyecto.
      this.categoryController.getActiveCategories
    );

    // RUTAS DE BÚSQUEDA Y FILTRADO AVANZADO

    /**
     * @swagger
     * /api/v1/categories/search:
     * get:
     * summary: Búsqueda avanzada de categorías
     * description: Realiza una búsqueda full-text en nombre y descripción.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - in: query
     * name: q
     * schema: { type: 'string', minLength: 2 }
     * required: true
     * responses:
     * 200:
     * description: Resultados de la búsqueda.
     */
    this.router.get(
      '/search',
      validateCategorySchema(searchCategoriesSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.searchCategories
    );

    // RUTAS DE UTILIDADES Y VALIDACIÓN

    /**
     * @swagger
     * /api/v1/categories/{id}/validate:
     * get:
     * summary: Validar propiedad de categoría
     * description: Verifica si el usuario autenticado es propietario de la categoría.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - $ref: '#/components/parameters/CategoryIdParam'
     * responses:
     * 200:
     * description: Validación completada.
     */
    this.router.get(
      '/:id/validate',
      validateCategorySchema(getCategoryByIdSchema),
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.validateCategoryOwnership
    );

    /**
     * @swagger
     * /api/v1/categories/check-limit:
     * get:
     * summary: Verificar límite de categorías
     * description: Verifica si el usuario puede crear más categorías.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * responses:
     * 200:
     * description: Verificación completada.
     */
    this.router.get(
      '/check-limit',
      // FIX: Llamada al método de la instancia `this.categoryController`
      this.categoryController.checkCategoryLimit
    );

    // RUTAS DE EXPORTACIÓN E IMPORTACIÓN
    /**
     * @swagger
     * /api/v1/categories/export:
     * get:
     * summary: Exportar categorías
     * description: Exporta las categorías del usuario en diferentes formatos.
     * tags: [Categories]
     * security:
     * - BearerAuth: []
     * parameters:
     * - in: query
     * name: format
     * schema: { type: 'string', enum: ['json', 'csv', 'xlsx'] }
     * responses:
     * 200:
     * description: Archivo de exportación.
     */
    this.router.get(
      '/export',
      rateLimitMiddleware.exportOperations(),
      validateCategorySchema(exportCategoriesSchema),
      // FIX: No hay un método de exportación en el controlador, se asume que se reutilizará getCategories.
      // Si existiera un `exportCategories`, se llamaría aquí.
      this.categoryController.getCategories
    );
  }
}

// Factory function para crear la instancia del router
export const createCategoryRoutes = (categoryService: ICategoryService): Router => {
  const categoryRoutes = new CategoryRoutes(categoryService);
  return categoryRoutes.router;
};

export default CategoryRoutes;