// src/commons/routes/task.routes.ts
import { Router } from 'express';
import { TaskController } from '@/commons/controllers/TaskController';
import { authenticateToken } from '@/commons/middlewares/auth.middleware';
import {
  validateSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateTaskPrioritySchema,
  getTasksSchema,
  getTaskByIdSchema,
  deleteTaskSchema,
  bulkUpdateStatusSchema,
  bulkDeleteTasksSchema,
  duplicateTaskSchema,
  markTaskAsCompletedSchema,
  getTasksByCategorySchema,
  searchTasksSchema,
} from '@/commons/validators/task.validator';

// Importar dependencias del controlador
import { TaskService } from '@/core/application/TaskService';
import { TaskRepository } from '@/core/infrastructure/repositories/TaskRepository';
import { RedisCache } from '@/core/infrastructure/cache/RedisCache'; // Asegúrate que la ruta sea correcta

const router: Router = Router();

// --- Inyección de Dependencias ---
// Se crea una única instancia de cada dependencia y se inyecta en las capas correspondientes
// para seguir los principios de Inversión de Dependencias.
const taskRepository = new TaskRepository();
// CORRECCIÓN: Se necesita una instancia de ICacheService para el TaskService.
const cacheService = new RedisCache();
// CORRECCIÓN: El constructor de TaskService espera 2 argumentos, no un objeto.
const taskService = new TaskService(taskRepository, cacheService);
const taskController = new TaskController({ taskService });

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/tasks:
 * get:
 * summary: List user tasks with pagination and filters
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: query
 * name: page
 * schema:
 * type: integer
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * responses:
 * 200:
 * description: Tasks retrieved successfully
 */
router.get(
  '/',
  validateSchema(getTasksSchema),
  taskController.getTasks.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks:
 * post:
 * summary: Create a new task
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/CreateTask'
 * responses:
 * 201:
 * description: Task created successfully
 */
router.post(
  '/',
  validateSchema(createTaskSchema),
  taskController.createTask.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 * get:
 * summary: Get specific task
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Task retrieved successfully
 */
router.get(
  '/:id',
  validateSchema(getTaskByIdSchema),
  taskController.getTaskById.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 * put:
 * summary: Update complete task
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/UpdateTask'
 * responses:
 * 200:
 * description: Task updated successfully
 */
router.put(
  '/:id',
  validateSchema(updateTaskSchema),
  taskController.updateTask.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}/status:
 * patch:
 * summary: Update only task status
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD]
 * responses:
 * 200:
 * description: Task status updated successfully
 */
router.patch(
  '/:id/status',
  validateSchema(updateTaskStatusSchema),
  taskController.updateTaskStatus.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}/priority:
 * patch:
 * summary: Update only task priority
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * priority:
 * type: string
 * enum: [LOW, MEDIUM, HIGH, URGENT]
 * responses:
 * 200:
 * description: Task priority updated successfully
 */
router.patch(
  '/:id/priority',
  validateSchema(updateTaskPrioritySchema),
  taskController.updateTaskPriority.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 * delete:
 * summary: Delete task
 * tags: [Tasks]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 204:
 * description: Task deleted successfully
 */
router.delete(
  '/:id',
  validateSchema(deleteTaskSchema),
  taskController.deleteTask.bind(taskController)
);

// ===== RUTAS ESPECIALIZADAS =====
router.get('/stats', taskController.getTaskStats.bind(taskController));
router.get('/overdue', taskController.getOverdueTasks.bind(taskController));
router.get(
  '/search',
  validateSchema(searchTasksSchema),
  taskController.searchTasks.bind(taskController)
);
router.get('/export', taskController.exportUserTasks.bind(taskController));
router.get(
  '/productivity',
  taskController.getProductivityStats.bind(taskController)
);
router.get(
  '/category/:categoryId',
  validateSchema(getTasksByCategorySchema),
  taskController.getTasksByCategory.bind(taskController)
);
router.patch(
  '/:id/complete',
  validateSchema(markTaskAsCompletedSchema),
  taskController.markTaskAsCompleted.bind(taskController)
);
router.post(
  '/:id/duplicate',
  validateSchema(duplicateTaskSchema),
  taskController.duplicateTask.bind(taskController)
);

// ===== OPERACIONES EN LOTE =====
router.patch(
  '/bulk/status',
  validateSchema(bulkUpdateStatusSchema),
  taskController.bulkUpdateTaskStatus.bind(taskController)
);
router.delete(
  '/bulk',
  validateSchema(bulkDeleteTasksSchema),
  taskController.bulkDeleteTasks.bind(taskController)
);

export default router;