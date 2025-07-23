// src/presentation/routes/task.routes.ts
import { Router } from 'express';
import { TaskController } from '@/presentation/controllers/TaskController';
import { authMiddleware } from '@/presentation/middlewares/auth.middleware';
import { validationMiddleware } from '@/presentation/middlewares/validation.middleware';
import { 
  createTaskValidator, 
  updateTaskValidator, 
  updateTaskStatusValidator,
  updateTaskPriorityValidator,
  getTasksValidator 
} from '@/presentation/validators/task.validator';

const router = Router();
const taskController = new TaskController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: List user tasks with pagination and filters
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Filter by task priority
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 */
router.get('/', 
  validationMiddleware(getTasksValidator), 
  taskController.getTasks.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               categoryId:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *               estimatedHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 999
 *     responses:
 *       201:
 *         description: Task created successfully
 */
router.post('/', 
  validationMiddleware(createTaskValidator), 
  taskController.createTask.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Get specific task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       404:
 *         description: Task not found
 */
router.get('/:id', taskController.getTaskById.bind(taskController));

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   put:
 *     summary: Update complete task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               categoryId:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *               estimatedHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 999
 *               actualHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 999
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 */
router.put('/:id', 
  validationMiddleware(updateTaskValidator), 
  taskController.updateTask.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}/status:
 *   patch:
 *     summary: Update only task status
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD]
 *     responses:
 *       200:
 *         description: Task status updated successfully
 */
router.patch('/:id/status', 
  validationMiddleware(updateTaskStatusValidator), 
  taskController.updateTaskStatus.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}/priority:
 *   patch:
 *     summary: Update only task priority
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - priority
 *             properties:
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       200:
 *         description: Task priority updated successfully
 */
router.patch('/:id/priority', 
  validationMiddleware(updateTaskPriorityValidator), 
  taskController.updateTaskPriority.bind(taskController)
);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       204:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 */
router.delete('/:id', taskController.deleteTask.bind(taskController));

export default router;