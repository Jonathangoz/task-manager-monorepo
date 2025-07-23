// src/presentation/controllers/TaskController.ts
import { Request, Response, NextFunction } from 'express';
import { ITaskService } from '@/core/domain/interfaces/ITaskService';
import { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '@/utils/constants';
import { logger } from '@/utils/logger';
import { createPaginationMeta } from '@/utils/pagination';
import { TaskFilters, SortOptions, ApiResponse } from '@/utils/constants';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

export class TaskController {
  constructor(private readonly taskService: ITaskService) {}

  /**
   * Get user tasks with pagination and filters
   * GET /api/v1/tasks
   */
  getTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      
      // Build filters
      const filters: TaskFilters = {
        status: req.query.status as string | string[],
        priority: req.query.priority as string | string[],
        categoryId: req.query.categoryId as string,
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

      const result = await this.taskService.getUserTasks(userId, {
        page,
        limit,
        filters,
        sort: sortOptions,
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASKS_RETRIEVED,
        data: result.tasks,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
          pagination: createPaginationMeta(page, limit, result.total),
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, page, limit, total: result.total },
        'Tasks retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get single task by ID
   * GET /api/v1/tasks/:id
   */
  getTaskById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const task = await this.taskService.getTaskById(id, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Task retrieved successfully',
        data: task,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ taskId: id, userId }, 'Task retrieved by ID');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new task
   * POST /api/v1/tasks
   */
  createTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const taskData = {
        ...req.body,
        userId,
      };

      const task = await this.taskService.createTask(taskData);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASK_CREATED,
        data: task,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.CREATED).json(response);

      logger.info(
        { taskId: task.id, userId, title: task.title },
        'Task created successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update task
   * PUT /api/v1/tasks/:id
   */
  updateTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const task = await this.taskService.updateTask(id, userId, updateData);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASK_UPDATED,
        data: task,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { taskId: id, userId, changes: Object.keys(updateData) },
        'Task updated successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update task status only
   * PATCH /api/v1/tasks/:id/status
   */
  updateTaskStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const task = await this.taskService.updateTaskStatus(id, userId, status);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASK_STATUS_UPDATED,
        data: task,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { taskId: id, userId, newStatus: status },
        'Task status updated'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update task priority only
   * PATCH /api/v1/tasks/:id/priority
   */
  updateTaskPriority = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { priority } = req.body;
      const userId = req.user.id;

      const task = await this.taskService.updateTaskPriority(id, userId, priority);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASK_PRIORITY_UPDATED,
        data: task,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { taskId: id, userId, newPriority: priority },
        'Task priority updated'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete task
   * DELETE /api/v1/tasks/:id
   */
  deleteTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await this.taskService.deleteTask(id, userId);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TASK_DELETED,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ taskId: id, userId }, 'Task deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get task statistics
   * GET /api/v1/tasks/stats
   */
  getTaskStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const stats = await this.taskService.getUserTaskStats(userId);

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.STATS_RETRIEVED,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ userId }, 'Task statistics retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk update tasks
   * PATCH /api/v1/tasks/bulk
   */
  bulkUpdateTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskIds, updates } = req.body;
      const userId = req.user.id;

      const result = await this.taskService.bulkUpdateTasks(taskIds, userId, updates);

      const response: ApiResponse = {
        success: true,
        message: `${result.updated} tasks updated successfully`,
        data: { updated: result.updated, failed: result.failed },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, updated: result.updated, failed: result.failed },
        'Bulk task update completed'
      );
    } catch (error) {
      next(error);
    }
  };
}