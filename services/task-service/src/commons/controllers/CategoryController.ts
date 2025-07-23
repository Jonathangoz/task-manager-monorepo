// src/presentation/controllers/CategoryController.ts
import { Request, Response, NextFunction } from 'express';
import { ICategoryService } from '@/core/domain/interfaces/ICategoryService';
import { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '@/utils/constants';
import { logger } from '@/utils/logger';
import { createPaginationMeta } from '@/utils/pagination';
import { ApiResponse, TaskFilters, SortOptions } from '@/utils/constants';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

export class CategoryController {
  constructor(private readonly categoryService: ICategoryService) {}

  /**
   * Get user categories
   * GET /api/v1/categories
   */
  getCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const includeInactive = req.query.includeInactive === 'true';
      const includeTaskCount = req.query.includeTaskCount === 'true';

      const categories = await this.categoryService.getUserCategories(userId, {
        includeInactive,
        includeTaskCount,
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.CATEGORIES_RETRIEVED,
        data: categories,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, categoriesCount: categories.length },
        'Categories retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get single category by ID
   * GET /api/v1/categories/:id
   */
  getCategoryById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const includeTaskCount = req.query.includeTaskCount === 'true';

      const category = await this.categoryService.getCategoryById(id, userId, {
        includeTaskCount,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Category retrieved successfully',
        data: category,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ categoryId: id, userId }, 'Category retrieved by ID');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new category
   * POST /api/v1/categories
   */
  createCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const categoryData = {
        ...req.body,
        userId,
      };

      const category = await this.categoryService.createCategory(categoryData);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.CATEGORY_CREATED,
        data: category,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.CREATED).json(response);

      logger.info(
        { categoryId: category.id, userId, name: category.name },
        'Category created successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update category
   * PUT /api/v1/categories/:id
   */
  updateCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const category = await this.categoryService.updateCategory(id, userId, updateData);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.CATEGORY_UPDATED,
        data: category,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId: id, userId, changes: Object.keys(updateData) },
        'Category updated successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete category
   * DELETE /api/v1/categories/:id
   */
  deleteCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const force = req.query.force === 'true';

      await this.categoryService.deleteCategory(id, userId, { force });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.CATEGORY_DELETED,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ categoryId: id, userId, force }, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get tasks from a specific category
   * GET /api/v1/categories/:id/tasks
   */
  getCategoryTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      // Build filters (excluding categoryId since it's implicit)
      const filters: Omit<TaskFilters, 'categoryId'> = {
        status: req.query.status as string | string[],
        priority: req.query.priority as string | string[],
        dueDateFrom: req.query.dueDateFrom as string,
        dueDateTo: req.query.dueDateTo as string,
        isOverdue: req.query.isOverdue === 'true',
        hasDueDate: req.query.hasDueDate === 'true',
        tags: req.query.tags as string | string[],
        search: req.query.search as string,
      };

      // Build sort options
      const sortOptions: SortOptions = {
        field: (req.query.sortBy as string) || 'createdAt',
        order: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await this.categoryService.getCategoryTasks(id, userId, {
        page,
        limit,
        filters,
        sort: sortOptions,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Category tasks retrieved successfully',
        data: result.tasks,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
          pagination: createPaginationMeta(page, limit, result.total),
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId: id, userId, page, limit, total: result.total },
        'Category tasks retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle category active status
   * PATCH /api/v1/categories/:id/toggle
   */
  toggleCategoryStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const category = await this.categoryService.toggleCategoryStatus(id, userId);

      const response: ApiResponse = {
        success: true,
        message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        data: category,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId: id, userId, isActive: category.isActive },
        'Category status toggled'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get category statistics
   * GET /api/v1/categories/:id/stats
   */
  getCategoryStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const stats = await this.categoryService.getCategoryStats(id, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Category statistics retrieved successfully',
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ categoryId: id, userId }, 'Category statistics retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk update categories
   * PATCH /api/v1/categories/bulk
   */
  bulkUpdateCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryIds, updates } = req.body;
      const userId = req.user.id;

      const result = await this.categoryService.bulkUpdateCategories(categoryIds, userId, updates);

      const response: ApiResponse = {
        success: true,
        message: `${result.updated} categories updated successfully`,
        data: { updated: result.updated, failed: result.failed },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, updated: result.updated, failed: result.failed },
        'Bulk category update completed'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Move tasks between categories
   * PATCH /api/v1/categories/:id/move-tasks
   */
  moveTasksToCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { taskIds, targetCategoryId } = req.body;
      const userId = req.user.id;

      const result = await this.categoryService.moveTasksToCategory(
        taskIds,
        targetCategoryId,
        userId
      );

      const response: ApiResponse = {
        success: true,
        message: `${result.moved} tasks moved successfully`,
        data: { moved: result.moved, failed: result.failed },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { fromCategoryId: id, targetCategoryId, userId, moved: result.moved },
        'Tasks moved between categories'
      );
    } catch (error) {
      next(error);
    }
  };
}