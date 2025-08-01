// src/presentation/controllers/TaskController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/commons/middlewares/auth.middleware';
import { ITaskService } from '@/core/domain/interfaces/ITaskService';
import {
  HTTP_STATUS,
  SUCCESS_MESSAGES,
  ERROR_CODES,
  ERROR_MESSAGES,
  ApiResponse,
  TaskFilters,
} from '@/utils/constants';
import { logger } from '@/utils/logger';
import {
  extractPaginationParams,
  PaginationError,
  PaginationParams,
} from '@/utils/pagination';
import {
  TaskStatus,
  TaskPriority,
  UpdateTaskData,
  isValidTaskStatus,
  isValidTaskPriority,
} from '@/core/domain/types/TaskDomain';
import {
  ServiceCreateTaskData,
  validateServiceCreateTaskData,
  validateBulkTaskIds,
  validateSearchQuery,
} from '@/core/domain/interfaces/ITaskService';

interface TaskControllerDependencies {
  taskService: ITaskService;
}

export class TaskController {
  constructor(private readonly dependencies: TaskControllerDependencies) {}

  private get taskService(): ITaskService {
    return this.dependencies.taskService;
  }

  getTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const paginationParams = this.extractPaginationParamsWithErrorHandling(
        req,
        res,
      );
      if (!paginationParams) return;

      const filters = this.buildTaskFilters(req.query);

      const result = await this.taskService.getUserTasks(
        userId,
        filters,
        paginationParams.sort,
        paginationParams.page,
        paginationParams.limit,
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASKS_RETRIEVED,
        result.tasks,
        req,
        { pagination: result.meta },
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Tasks retrieved successfully', {
        userId,
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: result.meta.total,
      });
    } catch (error) {
      next(error);
    }
  };

  getTaskById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const task = await this.taskService.getTaskById(id, userId);

      if (!task) {
        this.sendNotFoundResponse(
          res,
          ERROR_MESSAGES.TASK_NOT_FOUND,
          ERROR_CODES.TASK_NOT_FOUND,
        );
        return;
      }

      const response = this.createSuccessResponse(
        'Task retrieved successfully',
        task,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  createTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const taskData = validateServiceCreateTaskData(req.body);
      const task = await this.taskService.createTask(userId, taskData);
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_CREATED,
        task,
        req,
      );
      res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updateData = this.extractUpdateTaskData(req.body);
      const task = await this.taskService.updateTask(id, userId, updateData);
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_UPDATED,
        task,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateTaskStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      if (!status || !isValidTaskStatus(status)) {
        this.sendValidationErrorResponse(
          res,
          'Invalid task status provided',
          ERROR_CODES.INVALID_TASK_STATUS,
        );
        return;
      }

      const task = await this.taskService.updateTaskStatus(
        id,
        userId,
        status as TaskStatus,
      );
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_STATUS_UPDATED,
        task,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateTaskPriority = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { priority } = req.body;
      const userId = req.user!.id;

      if (!priority || !isValidTaskPriority(priority)) {
        this.sendValidationErrorResponse(
          res,
          'Invalid task priority provided',
          ERROR_CODES.INVALID_TASK_PRIORITY,
        );
        return;
      }

      const task = await this.taskService.updateTaskPriority(
        id,
        userId,
        priority as TaskPriority,
      );
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_PRIORITY_UPDATED,
        task,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      await this.taskService.deleteTask(id, userId);
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_DELETED,
        undefined,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTaskStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.taskService.getUserStats(userId);
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.STATS_RETRIEVED,
        stats,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  markTaskAsCompleted = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const task = await this.taskService.markTaskAsCompleted(id, userId);
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_COMPLETED,
        task,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getTasksByCategory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const userId = req.user!.id;
      const paginationParams = this.extractPaginationParamsWithErrorHandling(
        req,
        res,
      );
      if (!paginationParams) return;
      const result = await this.taskService.getTasksByCategory(
        categoryId,
        userId,
        paginationParams.page,
        paginationParams.limit,
      );
      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASKS_RETRIEVED,
        result.tasks,
        req,
        { pagination: result.meta },
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  searchTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { q: query } = req.query;
      const userId = req.user!.id;
      const validatedQuery = validateSearchQuery(query);
      const paginationParams = this.extractPaginationParamsWithErrorHandling(
        req,
        res,
      );
      if (!paginationParams) return;
      const filters = this.buildTaskFilters(req.query);
      const result = await this.taskService.searchTasks(
        userId,
        validatedQuery,
        filters,
        paginationParams.page,
        paginationParams.limit,
      );
      const response = this.createSuccessResponse(
        'Search completed successfully',
        result.tasks,
        req,
        { pagination: result.meta },
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  getOverdueTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const tasks = await this.taskService.getOverdueTasks(userId);
      const response = this.createSuccessResponse(
        'Overdue tasks retrieved successfully',
        tasks,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  bulkUpdateTaskStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { taskIds, status } = req.body;
      const userId = req.user!.id;
      const validatedTaskIds = validateBulkTaskIds(taskIds);
      if (!status || !isValidTaskStatus(status)) {
        this.sendValidationErrorResponse(
          res,
          'Invalid task status provided',
          ERROR_CODES.INVALID_TASK_STATUS,
        );
        return;
      }
      const result = await this.taskService.bulkUpdateStatus(
        validatedTaskIds,
        userId,
        status as TaskStatus,
      );
      const response = this.createSuccessResponse(
        `Bulk operation completed: ${result.successfullyProcessed} tasks updated`,
        result,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  bulkDeleteTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { taskIds } = req.body;
      const userId = req.user!.id;
      const validatedTaskIds = validateBulkTaskIds(taskIds);
      const result = await this.taskService.bulkDeleteTasks(
        validatedTaskIds,
        userId,
      );
      const response = this.createSuccessResponse(
        `Bulk deletion completed: ${result.successfullyProcessed} tasks deleted`,
        result,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  duplicateTask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const modifications = req.body
        ? this.extractServiceCreateTaskData(req.body)
        : undefined;
      const task = await this.taskService.duplicateTask(
        id,
        userId,
        modifications,
      );
      const response = this.createSuccessResponse(
        'Task duplicated successfully',
        task,
        req,
      );
      res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  };

  getProductivityStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.taskService.getProductivityStats(userId);
      const response = this.createSuccessResponse(
        'Productivity statistics retrieved successfully',
        stats,
        req,
      );
      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      next(error);
    }
  };

  exportUserTasks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { format = 'json' } = req.query;
      if (!this.isValidExportFormat(format as string)) {
        this.sendValidationErrorResponse(
          res,
          'Export format must be json, csv, or xml',
          ERROR_CODES.VALIDATION_ERROR,
        );
        return;
      }
      const filters = this.buildTaskFilters(req.query);
      const exportData = await this.taskService.exportUserTasks(
        userId,
        format as 'json' | 'csv' | 'xml',
        filters,
      );
      this.setExportHeaders(res, format as string);
      res.status(HTTP_STATUS.OK).send(exportData);
    } catch (error) {
      next(error);
    }
  };

  // ===== PRIVATE METHODS =====
  private buildTaskFilters(query: any): TaskFilters {
    const filters: TaskFilters = {};
    if (query.status) filters.status = query.status;
    if (query.priority) filters.priority = query.priority;
    if (query.categoryId) filters.categoryId = query.categoryId;
    // ... more filters
    return filters;
  }

  private extractServiceCreateTaskData(
    body: any,
  ): Partial<ServiceCreateTaskData> {
    const data: Partial<ServiceCreateTaskData> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    // ... more fields
    return data;
  }

  private extractUpdateTaskData(body: any): UpdateTaskData {
    const updateData: UpdateTaskData = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    // ... more fields
    return updateData;
  }

  private extractPaginationParamsWithErrorHandling(
    req: Request,
    res: Response,
  ): PaginationParams | null {
    try {
      return extractPaginationParams(req);
    } catch (error) {
      if (error instanceof PaginationError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          error: { code: error.code, details: error.message },
        });
        return null;
      }
      throw error;
    }
  }

  private isValidExportFormat(format: string): boolean {
    return ['json', 'csv', 'xml'].includes(format);
  }

  private setExportHeaders(res: Response, format: string): void {
    const contentTypes: { [key: string]: string } = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml',
    };
    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tasks.${format}"`,
    );
  }

  private createSuccessResponse(
    message: string,
    data?: any,
    req?: Request,
    additionalMeta?: any,
  ): ApiResponse {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req?.headers['x-request-id'] as string,
        ...additionalMeta,
      },
    };
  }

  private sendNotFoundResponse(
    res: Response,
    message: string,
    code: string,
  ): void {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      message,
      error: { code },
    });
  }

  private sendValidationErrorResponse(
    res: Response,
    details: string,
    code: string,
  ): void {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      error: {
        code,
        details,
      },
    });
  }

  private logSuccess(message: string, context: Record<string, any>): void {
    logger.info(context, message);
  }
}
