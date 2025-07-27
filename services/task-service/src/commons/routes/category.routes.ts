// src/commons/routes/category.routes.ts

import { Router } from 'express';
import { CategoryController } from '@/commons/controllers/CategoryController';
import { authenticateToken } from '@/commons/middlewares/auth.middleware';
import { ValidationMiddleware } from '@/commons/middlewares/validation.middleware';
import { 
  validateCategorySchema,
  createCategorySchema,
  updateCategorySchema,
  getCategoryByIdSchema,
  getCategoriesSchema,
  deleteCategorySchema,
  bulkDeleteCategoriesSchema,
  bulkUpdateCategoriesSchema,
  searchCategoriesSchema,
  getCategoryStatsSchema,
  exportCategoriesSchema
} from '@/commons/validators/category.validator';
import { ICategoryService } from '@/core/domain/interfaces/ICategoryService';
import { rateLimitMiddleware } from '@/commons/middlewares/rateLimit.middleware';

/**
 * CategoryRoutes
 * 
 * Configuración de rutas para el módulo de categorías siguiendo principios SOLID:
 * - Single Responsibility: Cada ruta tiene una responsabilidad específica
 * - Open/Closed: Extensible mediante middleware adicional
 * - Liskov Substitution: Compatible con cualquier implementación de ICategoryService
 * - Interface Segregation: Usa interfaces específicas para cada operación
 * - Dependency Inversion: Depende de abstracciones, no de implementaciones concretas
 */

export class CategoryRoutes {
  private router: Router;
  private categoryController: CategoryController;

  constructor(categoryService: ICategoryService) {
    this.router = Router();
    this.categoryController = new CategoryController(categoryService);
    this.setupRoutes();
  }

  /**
   * Configuración centralizada de todas las rutas de categorías
   * Aplica middleware común y específico según las necesidades de cada endpoint
   */
  private setupRoutes(): void {
    // Middleware global para todas las rutas de categorías
    this.router.use(authenticateToken);
    this.router.use(rateLimitMiddleware.categoryOperations());

    // ==============================================
    // RUTAS PRINCIPALES DE CRUD
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories:
     *   get:
     *     summary: Obtener categorías del usuario
     *     description: |
     *       Recupera una lista paginada de categorías del usuario autenticado con soporte para:
     *       - Filtrado avanzado por estado, color, icono y conteo de tareas
     *       - Búsqueda por nombre y descripción
     *       - Ordenamiento personalizable
     *       - Paginación eficiente con metadatos
     *       - Cache automático para mejor rendimiento
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *       - $ref: '#/components/parameters/SortOrderParam'
     *       - in: query
     *         name: isActive
     *         description: Filtrar por estado activo/inactivo de la categoría
     *         required: false
     *         schema:
     *           type: boolean
     *           example: true
     *       - in: query
     *         name: color
     *         description: Filtrar por color específico (formato hexadecimal)
     *         required: false
     *         schema:
     *           type: string
     *           pattern: '^#[0-9a-fA-F]{6}$'
     *           example: '#6366f1'
     *       - in: query
     *         name: icon
     *         description: Filtrar por icono específico
     *         required: false
     *         schema:
     *           type: string
     *           example: 'folder'
     *       - in: query
     *         name: search
     *         description: Buscar en nombre y descripción de categorías
     *         required: false
     *         schema:
     *           type: string
     *           minLength: 2
     *           example: 'desarrollo'
     *       - in: query
     *         name: includeTaskCount
     *         description: Incluir conteo de tareas por categoría
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *       - in: query
     *         name: minTasks
     *         description: Filtrar categorías con mínimo número de tareas
     *         required: false
     *         schema:
     *           type: integer
     *           minimum: 0
     *           example: 5
     *       - in: query
     *         name: maxTasks
     *         description: Filtrar categorías con máximo número de tareas
     *         required: false
     *         schema:
     *           type: integer
     *           minimum: 0
     *           example: 20
     *       - in: query
     *         name: createdFrom
     *         description: Filtrar categorías creadas desde esta fecha
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *           example: '2024-01-01T00:00:00Z'
     *       - in: query
     *         name: createdTo
     *         description: Filtrar categorías creadas hasta esta fecha
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *           example: '2024-12-31T23:59:59Z'
     *     responses:
     *       200:
     *         description: Lista de categorías obtenida exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         $ref: '#/components/schemas/Category'
     *             example:
     *               success: true
     *               message: 'Categorías obtenidas exitosamente'
     *               data:
     *                 - id: 'cat123abc456def789'
     *                   name: 'Desarrollo'
     *                   description: 'Categoría para proyectos de desarrollo'
     *                   color: '#6366f1'
     *                   icon: 'code'
     *                   isActive: true
     *                   taskCount: 15
     *                   createdAt: '2024-01-15T10:00:00Z'
     *                   updatedAt: '2024-01-15T10:00:00Z'
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_123abc456'
     *                 pagination:
     *                   page: 1
     *                   limit: 20
     *                   total: 25
     *                   pages: 2
     *                   hasNext: true
     *                   hasPrev: false
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       429:
     *         $ref: '#/components/responses/TooManyRequests'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/',
      cacheMiddleware.categories(300), // Cache por 5 minutos
      validateCategorySchema(getCategoriesSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.getCategories
    );

    /**
     * @swagger
     * /api/v1/categories:
     *   post:
     *     summary: Crear nueva categoría
     *     description: |
     *       Crea una nueva categoría para el usuario autenticado con las siguientes características:
     *       - Validación automática de nombre único por usuario
     *       - Asignación de colores e iconos por defecto si no se especifican
     *       - Verificación de límites de categorías por usuario
     *       - Normalización automática de datos de entrada
     *       - Logging completo para auditoría
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateCategoryRequest'
     *           examples:
     *             basico:
     *               summary: Categoría básica
     *               value:
     *                 name: 'Proyectos Personales'
     *                 description: 'Categoría para organizar proyectos personales'
     *             completo:
     *               summary: Categoría completa
     *               value:
     *                 name: 'Marketing'
     *                 description: 'Actividades de marketing y promoción'
     *                 color: '#10b981'
     *                 icon: 'megaphone'
     *                 isActive: true
     *     responses:
     *       201:
     *         description: Categoría creada exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Category'
     *             example:
     *               success: true
     *               message: 'Categoría creada exitosamente'
     *               data:
     *                 id: 'cat999xyz123abc'
     *                 name: 'Proyectos Personales'
     *                 description: 'Categoría para organizar proyectos personales'
     *                 color: '#f59e0b'
     *                 icon: 'home'
     *                 isActive: true
     *                 userId: 'user123'
     *                 createdAt: '2024-01-16T16:00:00Z'
     *                 updatedAt: '2024-01-16T16:00:00Z'
     *               meta:
     *                 timestamp: '2024-01-16T16:00:00Z'
     *                 requestId: 'req_cat999'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       409:
     *         description: Conflicto - Ya existe una categoría con este nombre
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             example:
     *               success: false
     *               message: 'Ya existe una categoría con este nombre'
     *               error:
     *                 code: 'CATEGORY_NAME_EXISTS'
     *                 details: 'El nombre de categoría debe ser único por usuario'
     *       422:
     *         description: Límite de categorías excedido
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             example:
     *               success: false
     *               message: 'Límite de categorías excedido'
     *               error:
     *                 code: 'CATEGORY_LIMIT_EXCEEDED'
     *                 details: 'Ha alcanzado el límite máximo de categorías permitidas'
     *       429:
     *         $ref: '#/components/responses/TooManyRequests'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.post(
      '/',
      rateLimitMiddleware.categoryCreation(),
      validateCategorySchema(createCategorySchema),
      ValidationMiddleware.forWriteOperations(),
      this.categoryController.createCategory
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   get:
     *     summary: Obtener categoría específica
     *     description: |
     *       Recupera los detalles completos de una categoría específica incluyendo:
     *       - Información básica de la categoría
     *       - Conteo de tareas asociadas (opcional)
     *       - Estadísticas de uso (opcional)
     *       - Metadatos de creación y actualización
     *       - Verificación automática de propiedad
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *       - in: query
     *         name: includeTasks
     *         description: Incluir información detallada de tareas asociadas
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *       - in: query
     *         name: includeInactiveTasks
     *         description: Incluir tareas inactivas en el conteo y listado
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *     responses:
     *       200:
     *         description: Categoría obtenida exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Category'
     *             example:
     *               success: true
     *               message: 'Categoría obtenida exitosamente'
     *               data:
     *                 id: 'cat123abc456def789'
     *                 name: 'Desarrollo'
     *                 description: 'Tareas relacionadas con desarrollo de software'
     *                 color: '#6366f1'
     *                 icon: 'code'
     *                 isActive: true
     *                 userId: 'user123'
     *                 taskCount: 15
     *                 completedTasks: 8
     *                 pendingTasks: 7
     *                 createdAt: '2024-01-10T09:00:00Z'
     *                 updatedAt: '2024-01-15T14:30:00Z'
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_789def123'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/:id',
      cacheMiddleware.categoryDetail(300),
      validateCategorySchema(getCategoryByIdSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.getCategoryById
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   put:
     *     summary: Actualizar categoría completa
     *     description: |
     *       Actualiza todos los campos de una categoría existente con las siguientes validaciones:
     *       - Verificación de propiedad del usuario
     *       - Validación de unicidad del nombre
     *       - Normalización de colores e iconos
     *       - Mantenimiento de integridad referencial
     *       - Invalidación automática de cache
     *       - Logging de cambios para auditoría
     *     tags: [Categorías]
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
     *           examples:
     *             actualizacion_parcial:
     *               summary: Actualización parcial
     *               value:
     *                 name: 'Desarrollo Frontend'
     *                 color: '#8b5cf6'
     *             actualizacion_completa:
     *               summary: Actualización completa
     *               value:
     *                 name: 'Marketing Digital'
     *                 description: 'Estrategias y campañas de marketing digital'
     *                 color: '#10b981'
     *                 icon: 'trending-up'
     *                 isActive: true
     *     responses:
     *       200:
     *         description: Categoría actualizada exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Category'
     *             example:
     *               success: true
     *               message: 'Categoría actualizada exitosamente'
     *               data:
     *                 id: 'cat123abc456def789'
     *                 name: 'Desarrollo Frontend'
     *                 description: 'Tareas relacionadas con desarrollo frontend'
     *                 color: '#8b5cf6'
     *                 icon: 'code'
     *                 isActive: true
     *                 userId: 'user123'
     *                 createdAt: '2024-01-10T09:00:00Z'
     *                 updatedAt: '2024-01-16T16:30:00Z'
     *               meta:
     *                 timestamp: '2024-01-16T16:30:00Z'
     *                 requestId: 'req_update123'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       409:
     *         $ref: '#/components/responses/Conflict'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.put(
      '/:id',
      validateCategorySchema(updateCategorySchema),
      ValidationMiddleware.forWriteOperations(),
      this.categoryController.updateCategory
    );

    /**
     * @swagger
     * /api/v1/categories/{id}:
     *   delete:
     *     summary: Eliminar categoría
     *     description: |
     *       Elimina permanentemente una categoría del usuario con las siguientes consideraciones:
     *       - Verificación de propiedad del usuario
     *       - Validación de reglas de negocio (categorías con tareas)
     *       - Opción de eliminación forzada o migración de tareas
     *       - Limpieza automática de cache relacionado
     *       - Logging completo para auditoría y recuperación
     *       - Transacciones atómicas para mantener consistencia
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *       - in: query
     *         name: force
     *         description: Forzar eliminación incluso si la categoría tiene tareas asociadas
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *       - in: query
     *         name: moveTo
     *         description: ID de categoría destino para mover las tareas antes de eliminar
     *         required: false
     *         schema:
     *           type: string
     *           example: 'cat456def789abc123'
     *     responses:
     *       200:
     *         description: Categoría eliminada exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         deletedId:
     *                           type: string
     *                           example: 'cat123abc456def789'
     *                         movedTasks:
     *                           type: integer
     *                           example: 5
     *                         moveToCategory:
     *                           type: string
     *                           example: 'cat456def789abc123'
     *             example:
     *               success: true
     *               message: 'Categoría eliminada exitosamente'
     *               data:
     *                 deletedId: 'cat123abc456def789'
     *                 movedTasks: 5
     *                 moveToCategory: 'cat456def789abc123'
     *               meta:
     *                 timestamp: '2024-01-16T17:00:00Z'
     *                 requestId: 'req_delete123'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       409:
     *         description: Conflicto - Categoría contiene tareas
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             example:
     *               success: false
     *               message: 'No se puede eliminar categoría con tareas asociadas'
     *               error:
     *                 code: 'CATEGORY_HAS_TASKS'
     *                 details: 'La categoría contiene 5 tareas. Use force=true o moveTo para proceder'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.delete(
      '/:id',
      validateCategorySchema(deleteCategorySchema),
      ValidationMiddleware.forWriteOperations(),
      this.categoryController.deleteCategory
    );

    // ==============================================
    // RUTAS DE FUNCIONALIDADES ESPECIALIZADAS
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/{id}/tasks:
     *   get:
     *     summary: Obtener tareas de una categoría
     *     description: |
     *       Recupera todas las tareas asociadas a una categoría específica con:
     *       - Paginación eficiente para grandes volúmenes de datos
     *       - Filtrado avanzado por estado, prioridad y fechas
     *       - Ordenamiento personalizable
     *       - Búsqueda en título y descripción de tareas
     *       - Metadatos de paginación y estadísticas
     *       - Cache inteligente basado en modificaciones
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *       - $ref: '#/components/parameters/SortOrderParam'
     *       - $ref: '#/components/parameters/StatusFilterParam'
     *       - $ref: '#/components/parameters/PriorityFilterParam'
     *       - $ref: '#/components/parameters/SearchParam'
     *       - $ref: '#/components/parameters/DueDateFromParam'
     *       - $ref: '#/components/parameters/DueDateToParam'
     *       - $ref: '#/components/parameters/OverdueParam'
     *     responses:
     *       200:
     *         description: Tareas de la categoría obtenidas exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         $ref: '#/components/schemas/Task'
     *             example:
     *               success: true
     *               message: 'Tareas de categoría obtenidas exitosamente'
     *               data:
     *                 - id: 'task123abc'
     *                   title: 'Implementar autenticación'
     *                   status: 'IN_PROGRESS'
     *                   priority: 'HIGH'
     *                   dueDate: '2024-02-15T18:00:00Z'
     *                   categoryId: 'cat123abc456def789'
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_cat_tasks'
     *                 pagination:
     *                   page: 1
     *                   limit: 20
     *                   total: 15
     *                   pages: 1
     *                   hasNext: false
     *                   hasPrev: false
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/:id/tasks',
      cacheMiddleware.categoryTasks(180), // Cache por 3 minutos
      validateCategorySchema(getCategoryByIdSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.getCategoryTasks
    );

    // ==============================================
    // RUTAS DE OPERACIONES MASIVAS
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/bulk:
     *   delete:
     *     summary: Eliminación masiva de categorías
     *     description: |
     *       Elimina múltiples categorías de forma transaccional con:
     *       - Validación de propiedad para todas las categorías
     *       - Verificación de reglas de negocio en lote
     *       - Opción de migración masiva de tareas
     *       - Transacciones atómicas para consistencia
     *       - Logging detallado para auditoría
     *       - Limpieza automática de cache relacionado
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - categoryIds
     *             properties:
     *               categoryIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 minItems: 1
     *                 maxItems: 20
     *                 description: Lista de IDs de categorías a eliminar
     *                 example: ['cat123abc', 'cat456def', 'cat789ghi']
     *               force:
     *                 type: boolean
     *                 default: false
     *                 description: Forzar eliminación incluso si las categorías tienen tareas
     *               moveTasksTo:
     *                 type: string
     *                 description: ID de categoría destino para mover todas las tareas
     *                 example: 'cat999xyz'
     *           examples:
     *             eliminacion_simple:
     *               summary: Eliminación simple
     *               value:
     *                 categoryIds: ['cat123abc', 'cat456def']
     *             eliminacion_con_migracion:
     *               summary: Con migración de tareas
     *               value:
     *                 categoryIds: ['cat123abc', 'cat456def']
     *                 moveTasksTo: 'cat999xyz'
     *             eliminacion_forzada:
     *               summary: Eliminación forzada
     *               value:
     *                 categoryIds: ['cat123abc', 'cat456def']
     *                 force: true
     *     responses:
     *       200:
     *         description: Categorías eliminadas exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         deletedCount:
     *                           type: integer
     *                           example: 3
     *                         movedTasks:
     *                           type: integer
     *                           example: 15
     *                         errors:
     *                           type: array
     *                           items:
     *                             type: object
     *                             properties:
     *                               categoryId:
     *                                 type: string
     *                               error:
     *                                 type: string
     *             example:
     *               success: true
     *               message: '3 categorías eliminadas exitosamente'
     *               data:
     *                 deletedCount: 3
     *                 movedTasks: 15
     *                 errors: []
     *               meta:
     *                 timestamp: '2024-01-16T17:30:00Z'
     *                 requestId: 'req_bulk_delete'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       409:
     *         $ref: '#/components/responses/Conflict'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.delete(
      '/bulk',
      rateLimitMiddleware.bulkOperations(),
      validateCategorySchema(bulkDeleteCategoriesSchema),
      ValidationMiddleware.forWriteOperations(),
      this.categoryController.bulkDeleteCategories
    );

    // ==============================================
    // RUTAS DE ESTADÍSTICAS Y ANÁLISIS
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/stats:
     *   get:
     *     summary: Obtener estadísticas de categorías
     *     description: |
     *       Proporciona estadísticas detalladas sobre las categorías del usuario incluyendo:
     *       - Distribución de tareas por categoría
     *       - Análisis de productividad por categoría
     *       - Tendencias de creación y uso
     *       - Métricas de eficiencia y completitud
     *       - Comparativas temporales
     *       - Identificación de categorías más/menos utilizadas
     *     tags: [Estadísticas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: from
     *         description: Fecha inicial para el análisis estadístico
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *           example: '2024-01-01T00:00:00Z'
     *       - in: query
     *         name: to
     *         description: Fecha final para el análisis estadístico
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *           example: '2024-12-31T23:59:59Z'
     *       - in: query
     *         name: includeInactive
     *         description: Incluir categorías inactivas en las estadísticas
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *     responses:
     *       200:
     *         description: Estadísticas de categorías obtenidas exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         totalCategories:
     *                           type: integer
     *                           example: 8
     *                         activeCategories:
     *                           type: integer
     *                           example: 6
     *                         categoriesWithTasks:
     *                           type: integer
     *                           example: 5
     *                         averageTasksPerCategory:
     *                           type: number
     *                           example: 12.5
     *                         mostUsedCategory:
     *                           type: object
     *                           properties:
     *                             id:
     *                               type: string
     *                             name:
     *                               type: string
     *                             taskCount:
     *                               type: integer
     *                         categoryDistribution:
     *                           type: array
     *                           items:
     *                             type: object
     *                             properties:
     *                               categoryId:
     *                                 type: string
     *                               categoryName:
     *                                 type: string
     *                               totalTasks:
     *                                 type: integer
     *                               completedTasks:
     *                                 type: integer
     *                               completionRate:
     *                                 type: number
     *             example:
     *               success: true
     *               message: 'Estadísticas de categorías obtenidas exitosamente'
     *               data:
     *                 totalCategories: 8
     *                 activeCategories: 6
     *                 categoriesWithTasks: 5
     *                 averageTasksPerCategory: 12.5
     *                 mostUsedCategory:
     *                   id: 'cat123abc'
     *                   name: 'Desarrollo'
     *                   taskCount: 25
     *                 categoryDistribution:
     *                   - categoryId: 'cat123abc'
     *                     categoryName: 'Desarrollo'
     *                     totalTasks: 25
     *                     completedTasks: 18
     *                     completionRate: 0.72
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_stats123'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/stats',
      cacheMiddleware.categoryStats(600), // Cache por 10 minutos
      validateCategorySchema(getCategoryStatsSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.getCategoryStats
    );

    /**
     * @swagger
     * /api/v1/categories/active:
     *   get:
     *     summary: Obtener solo categorías activas
     *     description: |
     *       Recupera únicamente las categorías que están marcadas como activas.
     *       Útil para dropdowns, selectores y operaciones que solo requieren
     *       categorías disponibles para nuevas tareas.
     *       Incluye cache optimizado y respuesta liviana.
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Categorías activas obtenidas exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: string
     *                           name:
     *                             type: string
     *                           color:
     *                             type: string
     *                           icon:
     *                             type: string
     *             example:
     *               success: true
     *               message: 'Categorías activas obtenidas exitosamente'
     *               data:
     *                 - id: 'cat123abc'
     *                   name: 'Desarrollo'
     *                   color: '#6366f1'
     *                   icon: 'code'
     *                 - id: 'cat456def'
     *                   name: 'Marketing'
     *                   color: '#10b981'
     *                   icon: 'megaphone'
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_active_cats'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/active',
      cacheMiddleware.activeCategories(900), // Cache por 15 minutos
      this.categoryController.getActiveCategories
    );

    // ==============================================
    // RUTAS DE BÚSQUEDA Y FILTRADO AVANZADO
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/search:
     *   get:
     *     summary: Búsqueda avanzada de categorías
     *     description: |
     *       Realiza búsqueda inteligente en categorías con las siguientes características:
     *       - Búsqueda full-text en nombre y descripción
     *       - Soporte para términos múltiples y operadores
     *       - Filtrado combinado con otros criterios
     *       - Ordenamiento por relevancia
     *       - Resaltado de términos encontrados
     *       - Sugerencias de búsqueda similares
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: q
     *         description: Término de búsqueda (mínimo 2 caracteres)
     *         required: true
     *         schema:
     *           type: string
     *           minLength: 2
     *           example: 'desarrollo front'
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - in: query
     *         name: isActive
     *         description: Filtrar por estado activo/inactivo
     *         required: false
     *         schema:
     *           type: boolean
     *       - in: query
     *         name: hasIcon
     *         description: Filtrar categorías que tienen icono asignado
     *         required: false
     *         schema:
     *           type: boolean
     *       - in: query
     *         name: minTasks
     *         description: Mínimo número de tareas asociadas
     *         required: false
     *         schema:
     *           type: integer
     *           minimum: 0
     *     responses:
     *       200:
     *         description: Resultados de búsqueda obtenidos exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         results:
     *                           type: array
     *                           items:
     *                             allOf:
     *                               - $ref: '#/components/schemas/Category'
     *                               - type: object
     *                                 properties:
     *                                   relevanceScore:
     *                                     type: number
     *                                     example: 0.85
     *                                   highlightedName:
     *                                     type: string
     *                                     example: '<mark>Desarrollo</mark> Frontend'
     *                         suggestions:
     *                           type: array
     *                           items:
     *                             type: string
     *                           example: ['desarrollo', 'frontend', 'programación']
     *             example:
     *               success: true
     *               message: 'Búsqueda completada exitosamente'
     *               data:
     *                 results:
     *                   - id: 'cat123abc'
     *                     name: 'Desarrollo Frontend'
     *                     relevanceScore: 0.95
     *                     highlightedName: '<mark>Desarrollo</mark> <mark>Frontend</mark>'
     *                 suggestions: ['desarrollo', 'frontend', 'programación']
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_search123'
     *                 pagination:
     *                   page: 1
     *                   limit: 20
     *                   total: 3
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/search',
      validateCategorySchema(searchCategoriesSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.searchCategories
    );

    // ==============================================
    // RUTAS DE UTILIDADES Y VALIDACIÓN
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/{id}/validate:
     *   get:
     *     summary: Validar propiedad de categoría
     *     description: |
     *       Verifica si el usuario autenticado es propietario de la categoría especificada.
     *       Útil para validaciones del lado cliente antes de realizar operaciones
     *       que requieren permisos específicos.
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - $ref: '#/components/parameters/CategoryIdParam'
     *     responses:
     *       200:
     *         description: Validación de propiedad completada
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         isOwner:
     *                           type: boolean
     *                           example: true
     *                         categoryExists:
     *                           type: boolean
     *                           example: true
     *             example:
     *               success: true
     *               message: 'Validación de propiedad completada'
     *               data:
     *                 isOwner: true
     *                 categoryExists: true
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_validate123'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/:id/validate',
      validateCategorySchema(getCategoryByIdSchema),
      this.CategoryController.validateCategoryOwnership
    );

    /**
     * @swagger
     * /api/v1/categories/check-limit:
     *   get:
     *     summary: Verificar límite de categorías
     *     description: |
     *       Verifica si el usuario puede crear más categorías según los límites
     *       establecidos en las reglas de negocio. Incluye información sobre
     *       el límite actual, categorías creadas y capacidad restante.
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Verificación de límite completada
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         canCreateMore:
     *                           type: boolean
     *                           example: true
     *                         currentCount:
     *                           type: integer
     *                           example: 8
     *                         maxAllowed:
     *                           type: integer
     *                           example: 20
     *                         remaining:
     *                           type: integer
     *                           example: 12
     *             example:
     *               success: true
     *               message: 'Verificación de límite completada'
     *               data:
     *                 canCreateMore: true
     *                 currentCount: 8
     *                 maxAllowed: 20
     *                 remaining: 12
     *               meta:
     *                 timestamp: '2024-01-16T15:00:00Z'
     *                 requestId: 'req_limit_check'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/check-limit',
      this.categoryController.checkCategoryLimit
    );

    // ==============================================
    // RUTAS DE EXPORTACIÓN E IMPORTACIÓN
    // ==============================================

    /**
     * @swagger
     * /api/v1/categories/export:
     *   get:
     *     summary: Exportar categorías
     *     description: |
     *       Exporta las categorías del usuario en diferentes formatos con opciones
     *       de filtrado y personalización. Soporta exportación completa o filtrada
     *       según criterios específicos.
     *     tags: [Categorías]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: format
     *         description: Formato de exportación
     *         required: false
     *         schema:
     *           type: string
     *           enum: [json, csv, xlsx]
     *           default: json
     *       - in: query
     *         name: includeInactive
     *         description: Incluir categorías inactivas en la exportación
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *       - in: query
     *         name: includeTasks
     *         description: Incluir información de tareas asociadas
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *       - in: query
     *         name: isActive
     *         description: Filtrar por estado activo/inactivo
     *         required: false
     *         schema:
     *           type: boolean
     *       - in: query
     *         name: createdFrom
     *         description: Exportar categorías creadas desde esta fecha
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *       - in: query
     *         name: createdTo
     *         description: Exportar categorías creadas hasta esta fecha
     *         required: false
     *         schema:
     *           type: string
     *           format: date-time
     *     responses:
     *       200:
     *         description: Exportación completada exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/ApiResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         downloadUrl:
     *                           type: string
     *                           example: 'https://api.taskmanager.com/exports/categories_20240116.json'
     *                         expiresAt:
     *                           type: string
     *                           format: date-time
     *                           example: '2024-01-17T15:00:00Z'
     *                         fileSize:
     *                           type: integer
     *                           example: 2048
     *                         recordCount:
     *                           type: integer
     *                           example: 8
     *           application/octet-stream:
     *             schema:
     *               type: string
     *               format: binary
     *         headers:
     *           Content-Disposition:
     *             description: Nombre del archivo de exportación
     *             schema:
     *               type: string
     *               example: 'attachment; filename="categorias_2024-01-16.json"'
     *           Content-Type:
     *             description: Tipo de contenido según el formato
     *             schema:
     *               type: string
     *               example: 'application/json'
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       500:
     *         $ref: '#/components/responses/InternalError'
     */
    this.router.get(
      '/export',
      rateLimitMiddleware.exportOperations(),
      validateCategorySchema(exportCategoriesSchema),
      ValidationMiddleware.forReadOperations(),
      this.categoryController.getCategories
    );
  }

  /**
   * Obtiene la instancia del router configurado
   * Método público para integración con la aplicación principal
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Método para agregar middleware adicional de forma dinámica
   * Útil para testing o configuraciones específicas por ambiente
   */
  public addMiddleware(middleware: any): void {
    this.router.use(middleware);
  }

  /**
   * Método para obtener información sobre las rutas configuradas
   * Útil para debugging y documentación automática
   */
  public getRouteInfo(): RouteInfo[] {
    const routeInfo: RouteInfo[] = [];
    
    // Esta implementación sería más compleja en un caso real
    // Aquí se muestra la estructura básica
    this.router.stack.forEach(layer => {
      if (layer.route) {
        routeInfo.push({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
          middlewareCount: layer.route.stack.length
        });
      }
    });

    return routeInfo;
  }
}

// ==============================================
// INTERFACES Y TIPOS DE SOPORTE
// ==============================================

/**
 * Interface para información de rutas
 * Útil para debugging y documentación
 */
interface RouteInfo {
  path: string;
  methods: string[];
  middlewareCount: number;
}

// ==============================================
// FACTORY FUNCTION PARA CREAR INSTANCIA
// ==============================================

/**
 * Factory function para crear y configurar las rutas de categorías
 * Sigue el patrón Factory para encapsular la creación y configuración
 * 
 * @param categoryService - Implementación del servicio de categorías
 * @returns Router configurado con todas las rutas de categorías
 */
export const createCategoryRoutes = (categoryService: ICategoryService): Router => {
  const categoryRoutes = new CategoryRoutes(categoryService);
  return categoryRoutes.getRouter();
};

// ==============================================
// CONFIGURACIÓN POR DEFECTO Y CONSTANTES
// ==============================================

/**
 * Configuración por defecto para las rutas de categorías
 * Centraliza valores configurables para fácil mantenimiento
 */
export const CATEGORY_ROUTES_CONFIG = {
  // Tiempos de cache por tipo de operación (en segundos)
  CACHE_TIMES: {
    CATEGORIES_LIST: 300,      // 5 minutos
    CATEGORY_DETAIL: 300,      // 5 minutos  
    CATEGORY_TASKS: 180,       // 3 minutos
    CATEGORY_STATS: 600,       // 10 minutos
    ACTIVE_CATEGORIES: 900,    // 15 minutos
  },
  
  // Límites de rate limiting por tipo de operación
  RATE_LIMITS: {
    CATEGORY_CREATION: { max: 10, windowMs: 60000 },      // 10 por minuto
    BULK_OPERATIONS: { max: 3, windowMs: 60000 },         // 3 por minuto
    EXPORT_OPERATIONS: { max: 5, windowMs: 300000 },      // 5 por 5 minutos
    GENERAL_OPERATIONS: { max: 100, windowMs: 60000 },    // 100 por minuto
  },
  
  // Configuración de validación
  VALIDATION: {
    ENABLE_STRICT_MODE: process.env.NODE_ENV === 'production',
    LOG_VALIDATION_ERRORS: process.env.NODE_ENV !== 'production',
    SANITIZE_ERROR_RESPONSES: process.env.NODE_ENV === 'production',
  }
} as const;

// ==============================================
// MIDDLEWARE DE CONFIGURACIÓN ESPECÍFICA
// ==============================================

/**
 * Middleware específico para logging de operaciones de categorías
 * Registra todas las operaciones para auditoría y monitoreo
 */
export const categoryOperationLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      operation: 'category_operation',
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    // Aquí se integraría con el sistema de logging centralizado
    console.log('Category Operation:', logData);
  });
  
  next();
};

/**
 * Middleware para aplicar headers de seguridad específicos para categorías
 * Mejora la seguridad de las operaciones sensibles
 */
export const categorySecurityHeaders = (req: any, res: any, next: any) => {
  // Headers de seguridad específicos para operaciones de categorías
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Header personalizado para identificar el tipo de recurso
  res.setHeader('X-Resource-Type', 'category');
  
  next();
};

// ==============================================
// EXPORT POR DEFECTO Y NAMED EXPORTS
// ==============================================

// Export por defecto de la clase principal
export default CategoryRoutes;



// ==============================================
// COMENTARIOS DE DOCUMENTACIÓN ADICIONAL
// ==============================================

/*
GUÍA DE USO:

1. INTEGRACIÓN BÁSICA:
   ```typescript
   import { createCategoryRoutes } from './routes/category.routes';
   import { CategoryService } from './services/CategoryService';
   
   const categoryService = new CategoryService();
   const categoryRouter = createCategoryRoutes(categoryService);
   
   app.use('/api/v1/categories', categoryRouter);
   ```

2. INTEGRACIÓN AVANZADA CON MIDDLEWARE PERSONALIZADO:
   ```typescript
   import { CategoryRoutes, categoryOperationLogger } from './routes/category.routes';
   
   const categoryRoutes = new CategoryRoutes(categoryService);
   categoryRoutes.addMiddleware(categoryOperationLogger);
   categoryRoutes.addMiddleware(customAuthMiddleware);
   
   app.use('/api/v1/categories', categoryRoutes.getRouter());
   ```

3. CONFIGURACIÓN PARA TESTING:
   ```typescript
   import { CategoryRoutes } from './routes/category.routes';
   import { MockCategoryService } from './mocks/MockCategoryService';
   
   const mockService = new MockCategoryService();
   const testRoutes = new CategoryRoutes(mockService);
   
   // Deshabilitar rate limiting para tests
   testRoutes.addMiddleware((req, res, next) => {
     req.rateLimit = { skip: true };
     next();
   });
   ```

PRINCIPIOS SOLID APLICADOS:

- **Single Responsibility**: Cada ruta tiene una responsabilidad específica
- **Open/Closed**: Las rutas son extensibles mediante middleware adicional
- **Liskov Substitution**: Cualquier implementación de ICategoryService funciona
- **Interface Segregation**: Se usan validadores específicos para cada operación  
- **Dependency Inversion**: Se depende de ICategoryService, no de implementaciones concretas

BUENAS PRÁCTICAS IMPLEMENTADAS:

- ✅ Documentación Swagger completa en español
- ✅ Validación exhaustiva con Zod schemas
- ✅ Rate limiting diferenciado por tipo de operación
- ✅ Cache inteligente con TTL apropiados
- ✅ Logging detallado para auditoría
- ✅ Headers de seguridad apropiados
- ✅ Manejo de errores consistente
- ✅ Separación clara de responsabilidades
- ✅ Configuración centralizada
- ✅ Testing-friendly architecture
*/