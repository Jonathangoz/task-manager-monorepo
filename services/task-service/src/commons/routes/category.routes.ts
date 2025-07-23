// src/presentation/routes/category.routes.ts
import { Router } from 'express';
import { CategoryController } from '@/presentation/controllers/CategoryController';
import { authMiddleware } from '@/presentation/middlewares/auth.middleware';
import { validationMiddleware } from '@/presentation/middlewares/validation.middleware';
import { 
  createCategoryValidator, 
  updateCategoryValidator,
  getCategoryTasksValidator 
} from '@/presentation/validators/category.validator';

const router = Router();
const categoryController = new CategoryController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: List user categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive categories
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', categoryController.getCategories.bind(categoryController));

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Create new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               color:
 *                 type: string
 *                 pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *                 description: Hex color code
 *               icon:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Category created successfully
 *       409:
 *         description: Category with this name already exists
 */
router.post('/', 
  validationMiddleware(createCategoryValidator), 
  categoryController.createCategory.bind(categoryController)
);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Get specific category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id', categoryController.getCategoryById.bind(categoryController));

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               color:
 *                 type: string
 *                 pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *               icon:
 *                 type: string
 *                 maxLength: 50
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category with this name already exists
 */
router.put('/:id', 
  validationMiddleware(updateCategoryValidator), 
  categoryController.updateCategory.bind(categoryController)
);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       204:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       409:
 *         description: Cannot delete category that contains tasks
 */
router.delete('/:id', categoryController.deleteCategory.bind(categoryController));

/**
 * @swagger
 * /api/v1/categories/{id}/tasks:
 *   get:
 *     summary: List tasks in category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
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
 *     responses:
 *       200:
 *         description: Category tasks retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id/tasks', 
  validationMiddleware(getCategoryTasksValidator), 
  categoryController.getCategoryTasks.bind(categoryController)
);

export default router;