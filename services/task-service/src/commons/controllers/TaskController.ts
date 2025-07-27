// src/presentation/controllers/TaskController.ts
import { Request, Response, NextFunction } from 'express';
import { ITaskService } from '@/core/domain/interfaces/ITaskService';
import { 
  HTTP_STATUS, 
  SUCCESS_MESSAGES, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  ApiResponse,
  TaskFilters,
  TASK_STATUSES,
  TASK_PRIORITIES
} from '@/utils/constants';
import { logger } from '@/utils/logger';
import { 
  extractPaginationParams,
  PaginationError,
  PaginationParams
} from '@/utils/pagination';
import { 
  TaskStatus,
  TaskPriority,
  UpdateTaskData,
  isValidTaskStatus,
  isValidTaskPriority
} from '@/core/domain/types/TaskDomain';
import {
  ServiceCreateTaskData,
  validateServiceCreateTaskData,
  validateBulkTaskIds,
  validateSearchQuery
} from '@/core/domain/interfaces/ITaskService';

// ===== INTERFACES =====

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name?: string;
    roles?: string[];
    permissions?: string[];
  };
}

interface TaskControllerDependencies {
  taskService: ITaskService;
}

// ===== CONTROLLER CLASS =====

export class TaskController {
  constructor(private readonly dependencies: TaskControllerDependencies) {}

  private get taskService(): ITaskService {
    return this.dependencies.taskService;
  }

  // ===== CRUD OPERATIONS =====

  /**
   * Get user tasks with pagination and filters
   * GET /api/v1/tasks
   */
  getTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      
      // Extract and validate pagination parameters
      const paginationParams = this.extractPaginationParamsWithErrorHandling(req, res);
      if (!paginationParams) return; // Response already sent
      
      // Build filters with proper validation
      const filters = this.buildTaskFilters(req.query);

      // Call service
      const result = await this.taskService.getUserTasks(
        userId,
        filters,
        paginationParams.sort,
        paginationParams.page,
        paginationParams.limit
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASKS_RETRIEVED,
        result.tasks,
        req,
        { pagination: result.meta }
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Tasks retrieved successfully', {
        userId, 
        page: paginationParams.page, 
        limit: paginationParams.limit, 
        total: result.meta.total,
        filtersApplied: this.countActiveFilters(filters),
        sortBy: paginationParams.sort.field,
        sortOrder: paginationParams.sort.order
      });
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

      if (!task) {
        this.sendNotFoundResponse(res, ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
        return;
      }

      const response = this.createSuccessResponse(
        'Task retrieved successfully',
        task,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task retrieved by ID', { taskId: id, userId });
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
      
      // Validate and extract task data using service validation
      const taskData = validateServiceCreateTaskData(req.body);

      const task = await this.taskService.createTask(userId, taskData);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_CREATED,
        task,
        req
      );

      res.status(HTTP_STATUS.CREATED).json(response);

      this.logSuccess('Task created successfully', {
        taskId: task.id, 
        userId, 
        title: task.title
      });
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

      const updateData = this.extractUpdateTaskData(req.body);

      const task = await this.taskService.updateTask(id, userId, updateData);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_UPDATED,
        task,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task updated successfully', {
        taskId: id, 
        userId, 
        changes: Object.keys(updateData)
      });
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

      // Validate status using domain validation
      if (!status || !isValidTaskStatus(status)) {
        this.sendValidationErrorResponse(res, 'Invalid task status provided', ERROR_CODES.INVALID_TASK_STATUS);
        return;
      }

      const task = await this.taskService.updateTaskStatus(id, userId, status as TaskStatus);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_STATUS_UPDATED,
        task,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task status updated', {
        taskId: id, 
        userId, 
        newStatus: status
      });
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

      // Validate priority using domain validation
      if (!priority || !isValidTaskPriority(priority)) {
        this.sendValidationErrorResponse(res, 'Invalid task priority provided', ERROR_CODES.INVALID_TASK_PRIORITY);
        return;
      }

      const task = await this.taskService.updateTaskPriority(id, userId, priority as TaskPriority);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_PRIORITY_UPDATED,
        task,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task priority updated', {
        taskId: id, 
        userId, 
        newPriority: priority
      });
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

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_DELETED,
        undefined,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task deleted successfully', { taskId: id, userId });
    } catch (error) {
      next(error);
    }
  };

  // ===== SPECIALIZED OPERATIONS =====

  /**
   * Get task statistics
   * GET /api/v1/tasks/stats
   */
  getTaskStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const stats = await this.taskService.getUserStats(userId);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.STATS_RETRIEVED,
        stats,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task statistics retrieved', { userId });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark task as completed
   * PATCH /api/v1/tasks/:id/complete
   */
  markTaskAsCompleted = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const task = await this.taskService.markTaskAsCompleted(id, userId);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASK_COMPLETED,
        task,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task marked as completed', { taskId: id, userId });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get tasks by category
   * GET /api/v1/tasks/category/:categoryId
   */
  getTasksByCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryId } = req.params;
      const userId = req.user.id;

      // Extract pagination parameters
      const paginationParams = this.extractPaginationParamsWithErrorHandling(req, res);
      if (!paginationParams) return; // Response already sent

      const result = await this.taskService.getTasksByCategory(
        categoryId, 
        userId, 
        paginationParams.page, 
        paginationParams.limit
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.TASKS_RETRIEVED,
        result.tasks,
        req,
        { pagination: result.meta }
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Tasks by category retrieved', { 
        categoryId, 
        userId, 
        page: paginationParams.page, 
        limit: paginationParams.limit,
        total: result.meta.total
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search tasks
   * GET /api/v1/tasks/search
   */
  searchTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q: query } = req.query;
      const userId = req.user.id;

      // Validate search query using service validation
      const validatedQuery = validateSearchQuery(query);

      // Extract pagination parameters
      const paginationParams = this.extractPaginationParamsWithErrorHandling(req, res);
      if (!paginationParams) return; // Response already sent

      const filters = this.buildTaskFilters(req.query);

      const result = await this.taskService.searchTasks(
        userId, 
        validatedQuery, 
        filters, 
        paginationParams.page, 
        paginationParams.limit
      );

      const response = this.createSuccessResponse(
        'Search completed successfully',
        result.tasks,
        req,
        { pagination: result.meta }
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Task search completed', { 
        userId, 
        query: validatedQuery, 
        resultsCount: result.tasks.length,
        page: paginationParams.page,
        limit: paginationParams.limit
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get overdue tasks
   * GET /api/v1/tasks/overdue
   */
  getOverdueTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const tasks = await this.taskService.getOverdueTasks(userId);

      const response = this.createSuccessResponse(
        'Overdue tasks retrieved successfully',
        tasks,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Overdue tasks retrieved', { userId, overdueCount: tasks.length });
    } catch (error) {
      next(error);
    }
  };

  // ===== BULK OPERATIONS =====

  /**
   * Bulk update task status
   * PATCH /api/v1/tasks/bulk/status
   */
  bulkUpdateTaskStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskIds, status } = req.body;
      const userId = req.user.id;

      // Validate task IDs using service validation
      const validatedTaskIds = validateBulkTaskIds(taskIds);

      // Validate status
      if (!status || !isValidTaskStatus(status)) {
        this.sendValidationErrorResponse(res, 'Invalid task status provided', ERROR_CODES.INVALID_TASK_STATUS);
        return;
      }

      const result = await this.taskService.bulkUpdateStatus(validatedTaskIds, userId, status as TaskStatus);

      const response = this.createSuccessResponse(
        `Bulk operation completed: ${result.successfullyProcessed} tasks updated`,
        result,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Bulk task status update completed', {
        userId, 
        taskCount: validatedTaskIds.length, 
        successCount: result.successfullyProcessed,
        failureCount: result.failed,
        newStatus: status 
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk delete tasks
   * DELETE /api/v1/tasks/bulk
   */
  bulkDeleteTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskIds } = req.body;
      const userId = req.user.id;

      // Validate task IDs using service validation
      const validatedTaskIds = validateBulkTaskIds(taskIds);

      const result = await this.taskService.bulkDeleteTasks(validatedTaskIds, userId);

      const response = this.createSuccessResponse(
        `Bulk deletion completed: ${result.successfullyProcessed} tasks deleted`,
        result,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Bulk task deletion completed', {
        userId, 
        taskCount: validatedTaskIds.length,
        successCount: result.successfullyProcessed,
        failureCount: result.failed
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Duplicate task
   * POST /api/v1/tasks/:id/duplicate
   */
  duplicateTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Extract optional modifications from body
      const modifications = req.body ? this.extractServiceCreateTaskData(req.body) : undefined;

      const task = await this.taskService.duplicateTask(id, userId, modifications);

      const response = this.createSuccessResponse(
        'Task duplicated successfully',
        task,
        req
      );

      res.status(HTTP_STATUS.CREATED).json(response);

      this.logSuccess('Task duplicated', { originalTaskId: id, newTaskId: task.id, userId });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get productivity stats
   * GET /api/v1/tasks/productivity
   */
  getProductivityStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const stats = await this.taskService.getProductivityStats(userId);

      const response = this.createSuccessResponse(
        'Productivity statistics retrieved successfully',
        stats,
        req
      );

      res.status(HTTP_STATUS.OK).json(response);

      this.logSuccess('Productivity statistics retrieved', { userId });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export user tasks
   * GET /api/v1/tasks/export
   */
  exportUserTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { format = 'json' } = req.query;

      // Validate format
      if (!this.isValidExportFormat(format as string)) {
        this.sendValidationErrorResponse(res, 'Export format must be json, csv, or xml', ERROR_CODES.VALIDATION_ERROR);
        return;
      }

      const filters = this.buildTaskFilters(req.query);
      const exportData = await this.taskService.exportUserTasks(
        userId, 
        format as 'json' | 'csv' | 'xml', 
        filters
      );

      // Set appropriate content type and headers
      this.setExportHeaders(res, format as string);
      
      res.status(HTTP_STATUS.OK).send(exportData);

      this.logSuccess('Tasks exported', { userId, format, filtersCount: this.countActiveFilters(filters) });
    } catch (error) {
      next(error);
    }
  };

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Build task filters from query parameters
   */
  private buildTaskFilters(query: any): TaskFilters {
    const filters: TaskFilters = {};

    if (query.status) {
      filters.status = Array.isArray(query.status) ? query.status : [query.status];
    }

    if (query.priority) {
      filters.priority = Array.isArray(query.priority) ? query.priority : [query.priority];
    }

    if (query.categoryId) {
      filters.categoryId = query.categoryId;
    }

    if (query.dueDateFrom) {
      filters.dueDateFrom = query.dueDateFrom;
    }

    if (query.dueDateTo) {
      filters.dueDateTo = query.dueDateTo;
    }

    if (query.isOverdue !== undefined) {
      filters.isOverdue = query.isOverdue === 'true';
    }

    if (query.hasDueDate !== undefined) {
      filters.hasDueDate = query.hasDueDate === 'true';
    }

    if (query.tags) {
      filters.tags = Array.isArray(query.tags) ? query.tags : [query.tags];
    }

    if (query.search) {
      filters.search = query.search;
    }

    return filters;
  }

  /**
   * Extract and validate ServiceCreateTaskData from request body
   */
  private extractServiceCreateTaskData(body: any): Partial<ServiceCreateTaskData> {
    const data: Partial<ServiceCreateTaskData> = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.estimatedHours !== undefined) data.estimatedHours = body.estimatedHours;
    if (body.attachments !== undefined) data.attachments = body.attachments;

    return data;
  }

  /**
   * Extract UpdateTaskData from request body
   */
  private extractUpdateTaskData(body: any): UpdateTaskData {
    const updateData: UpdateTaskData = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.estimatedHours !== undefined) updateData.estimatedHours = body.estimatedHours;
    if (body.actualHours !== undefined) updateData.actualHours = body.actualHours;
    if (body.attachments !== undefined) updateData.attachments = body.attachments;

    return updateData;
  }

  /**
   * Extract pagination parameters with error handling
   */
  private extractPaginationParamsWithErrorHandling(req: AuthenticatedRequest, res: Response): PaginationParams | null {
    try {
      return extractPaginationParams(req);
    } catch (error) {
      if (error instanceof PaginationError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          error: { code: error.code, details: error.message }
        });
        return null;
      }
      throw error;
    }
  }

  /**
   * Count active filters for logging
   */
  private countActiveFilters(filters: TaskFilters): number {
    return Object.keys(filters).filter(key => filters[key as keyof TaskFilters] !== undefined).length;
  }

  /**
   * Validate export format
   */
  private isValidExportFormat(format: string): boolean {
    return ['json', 'csv', 'xml'].includes(format);
  }

  /**
   * Set appropriate headers for export
   */
  private setExportHeaders(res: Response, format: string): void {
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml'
    };

    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="tasks.${format}"`);
  }

  /**
   * Create standardized success response
   */
  private createSuccessResponse(
    message: string, 
    data?: any, 
    req?: AuthenticatedRequest,
    additionalMeta?: any
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

  /**
   * Send standardized not found response
   */
  private sendNotFoundResponse(res: Response, message: string, code: string): void {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      message,
      error: { code }
    });
  }

  /**
   * Send standardized validation error response
   */
  private sendValidationErrorResponse(res: Response, details: string, code: string): void {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      error: { 
        code, 
        details 
      }
    });
  }

  /**
   * Log success operations with consistent format
   */
  private logSuccess(message: string, context: Record<string, any>): void {
    logger.info(context, message);
  }
}