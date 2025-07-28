// src/core/infrastructure/repositories/TaskRepository.ts
import { PrismaClient, Task, TaskStatus, Priority } from '@prisma/client';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { 
  CreateTaskData, 
  UpdateTaskData, 
  TaskWithCategory, 
  TaskQueryResult,
  TaskStatus as DomainTaskStatus,
  TaskPriority as DomainTaskPriority
} from '@/core/types/TaskDomain';
import { 
  TaskFilters, 
  SortOptions, 
  PaginationMeta,
  PAGINATION_CONFIG,
  DEFAULT_VALUES,
  SORT_FIELDS,
  SORT_ORDERS,
  ERROR_CODES 
} from '@/utils/constants';
import { logger, loggers, logError } from '@/utils/logger';
import { db } from '@/config/database';

export class TaskRepository implements ITaskRepository {
  constructor(
    private readonly prisma: PrismaClient = db,
    private readonly validator: TaskDataValidator = new TaskDataValidator(),
    private readonly mapper: TaskDataMapper = new TaskDataMapper(),
    private readonly queryBuilder: TaskQueryBuilder = new TaskQueryBuilder(),
    private readonly logger: TaskRepositoryLogger = new TaskRepositoryLogger()
  ) {}

  // ==============================================
  // CORE CRUD OPERATIONS
  // ==============================================

  async create(data: CreateTaskData): Promise<TaskWithCategory> {
    const operation = this.logger.startOperation('create');
    
    try {
      this.validator.validateCreateData(data);
      
      const taskData = this.mapper.mapCreateDataToPrisma(data);
      const createdTask = await this.prisma.task.create({
        data: taskData,
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = this.mapper.mapPrismaToTaskWithCategory(createdTask);
      
      this.logger.logSuccess(operation, 'Task created successfully', {
        taskId: result.id,
        userId: data.userId,
        status: result.status,
        priority: result.priority,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { data });
      throw this.enhanceError(error, 'Failed to create task');
    }
  }

  async findById(id: string): Promise<TaskWithCategory | null> {
    const operation = this.logger.startOperation('findById');
    
    try {
      this.validator.validateId(id);
      
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = task ? this.mapper.mapPrismaToTaskWithCategory(task) : null;
      
      this.logger.logSuccess(operation, 'Task retrieved', {
        taskId: id,
        found: !!result,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { id });
      throw this.enhanceError(error, 'Failed to find task by ID');
    }
  }

  async findByUserId(
    userId: string,
    filters: TaskFilters = {},
    sort: SortOptions = { 
      field: DEFAULT_VALUES.SORT_FIELD, 
      order: DEFAULT_VALUES.SORT_ORDER 
    },
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const operation = this.logger.startOperation('findByUserId');
    
    try {
      this.validator.validateUserId(userId);
      this.validator.validatePagination(page, limit);
      this.validator.validateSortOptions(sort);
      
      const where = this.queryBuilder.buildWhereClause(userId, filters);
      const orderBy = this.queryBuilder.buildOrderByClause(sort);
      const skip = (page - 1) * limit;

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: this.queryBuilder.getCategoryInclude(),
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.task.count({ where }),
      ]);

      const result: TaskQueryResult = {
        tasks: tasks.map(task => this.mapper.mapPrismaToTaskWithCategory(task)),
        meta: this.buildPaginationMeta(page, limit, total),
      };

      this.logger.logSuccess(operation, 'Tasks retrieved by user ID', {
        userId,
        count: tasks.length,
        total,
        page,
        filters,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, {
        userId, filters, sort, page, limit
      });
      throw this.enhanceError(error, 'Failed to find tasks by user ID');
    }
  }

  async findByCategoryId(
    categoryId: string,
    userId: string,
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const operation = this.logger.startOperation('findByCategoryId');
    
    try {
      this.validator.validateId(categoryId);
      this.validator.validateUserId(userId);
      this.validator.validatePagination(page, limit);
      
      const skip = (page - 1) * limit;
      const where = { categoryId, userId };

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: this.queryBuilder.getCategoryInclude(),
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.task.count({ where }),
      ]);

      const result: TaskQueryResult = {
        tasks: tasks.map(task => this.mapper.mapPrismaToTaskWithCategory(task)),
        meta: this.buildPaginationMeta(page, limit, total),
      };

      this.logger.logSuccess(operation, 'Tasks retrieved by category ID', {
        categoryId,
        userId,
        count: tasks.length,
        total,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, {
        categoryId, userId, page, limit
      });
      throw this.enhanceError(error, 'Failed to find tasks by category ID');
    }
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskWithCategory> {
    const operation = this.logger.startOperation('update');
    
    try {
      this.validator.validateId(id);
      this.validator.validateUpdateData(data);
      
      const updateData = this.mapper.mapUpdateDataToPrisma(data);

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = this.mapper.mapPrismaToTaskWithCategory(updatedTask);
      
      this.logger.logSuccess(operation, 'Task updated successfully', {
        taskId: id,
        updatedFields: Object.keys(updateData),
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { id, data });
      throw this.enhanceError(error, 'Failed to update task');
    }
  }

  async updateStatus(
    id: string, 
    status: DomainTaskStatus, 
    completedAt?: Date
  ): Promise<TaskWithCategory> {
    const operation = this.logger.startOperation('updateStatus');
    
    try {
      this.validator.validateId(id);
      this.validator.validateTaskStatus(status);
      
      const updateData = this.mapper.mapStatusUpdateToPrisma(status, completedAt);

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = this.mapper.mapPrismaToTaskWithCategory(updatedTask);
      
      this.logger.logSuccess(operation, 'Task status updated', {
        taskId: id,
        newStatus: status,
        completedAt,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, {
        id, status, completedAt
      });
      throw this.enhanceError(error, 'Failed to update task status');
    }
  }

  async updatePriority(id: string, priority: DomainTaskPriority): Promise<TaskWithCategory> {
    const operation = this.logger.startOperation('updatePriority');
    
    try {
      this.validator.validateId(id);
      this.validator.validateTaskPriority(priority);
      
      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: { priority },
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = this.mapper.mapPrismaToTaskWithCategory(updatedTask);
      
      this.logger.logSuccess(operation, 'Task priority updated', {
        taskId: id,
        newPriority: priority,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { id, priority });
      throw this.enhanceError(error, 'Failed to update task priority');
    }
  }

  async delete(id: string): Promise<void> {
    const operation = this.logger.startOperation('delete');
    
    try {
      this.validator.validateId(id);
      
      const deletedTask = await this.prisma.task.delete({
        where: { id },
      });

      this.logger.logSuccess(operation, 'Task deleted successfully', {
        taskId: id,
        taskTitle: deletedTask.title,
      });
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { id });
      throw this.enhanceError(error, 'Failed to delete task');
    }
  }

  // ==============================================
  // EXTENDED QUERY OPERATIONS
  // ==============================================

  async countByUserId(userId: string, filters: TaskFilters = {}): Promise<number> {
    const operation = this.logger.startOperation('countByUserId');
    
    try {
      this.validator.validateUserId(userId);
      
      const where = this.queryBuilder.buildWhereClause(userId, filters);
      const count = await this.prisma.task.count({ where });

      this.logger.logSuccess(operation, 'Tasks counted', {
        userId, filters, count
      });

      return count;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { userId, filters });
      throw this.enhanceError(error, 'Failed to count tasks by user ID');
    }
  }

  async findOverdueTasks(userId: string): Promise<TaskWithCategory[]> {
    const operation = this.logger.startOperation('findOverdueTasks');
    
    try {
      this.validator.validateUserId(userId);
      
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: this.queryBuilder.getCategoryInclude(),
        orderBy: { dueDate: 'asc' },
      });

      const result = tasks.map(task => 
        this.mapper.mapPrismaToTaskWithCategory(task)
      );

      this.logger.logSuccess(operation, 'Overdue tasks retrieved', {
        userId, count: result.length
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { userId });
      throw this.enhanceError(error, 'Failed to find overdue tasks');
    }
  }

  async findByIds(ids: string[]): Promise<TaskWithCategory[]> {
    const operation = this.logger.startOperation('findByIds');
    
    try {
      this.validator.validateIdsArray(ids);
      
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: ids } },
        include: this.queryBuilder.getCategoryInclude(),
      });

      const result = tasks.map(task => 
        this.mapper.mapPrismaToTaskWithCategory(task)
      );

      this.logger.logSuccess(operation, 'Tasks retrieved by IDs', {
        requestedIds: ids.length,
        foundTasks: result.length,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { ids });
      throw this.enhanceError(error, 'Failed to find tasks by IDs');
    }
  }

  async bulkUpdateStatus(ids: string[], status: DomainTaskStatus): Promise<void> {
    const operation = this.logger.startOperation('bulkUpdateStatus');
    
    try {
      this.validator.validateIdsArray(ids);
      this.validator.validateTaskStatus(status);
      
      const updateData = this.mapper.mapStatusUpdateToPrisma(status);

      const result = await this.prisma.task.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });

      this.logger.logSuccess(operation, 'Bulk status update completed', {
        taskIds: ids,
        status,
        updatedCount: result.count,
      });
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { ids, status });
      throw this.enhanceError(error, 'Failed to bulk update task status');
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const operation = this.logger.startOperation('bulkDelete');
    
    try {
      this.validator.validateIdsArray(ids);
      
      const result = await this.prisma.task.deleteMany({
        where: { id: { in: ids } },
      });

      this.logger.logSuccess(operation, 'Bulk delete completed', {
        taskIds: ids,
        deletedCount: result.count,
      });
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { ids });
      throw this.enhanceError(error, 'Failed to bulk delete tasks');
    }
  }

  async search(
    userId: string,
    query: string,
    filters: TaskFilters = {},
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const operation = this.logger.startOperation('search');
    
    try {
      this.validator.validateUserId(userId);
      this.validator.validateSearchQuery(query);
      this.validator.validatePagination(page, limit);
      
      const searchFilters: TaskFilters = {
        ...filters,
        search: query.trim(),
      };
      
      const result = await this.findByUserId(
        userId, 
        searchFilters, 
        { field: SORT_FIELDS.UPDATED_AT, order: SORT_ORDERS.DESC },
        page, 
        limit
      );

      this.logger.logSuccess(operation, 'Task search completed', {
        userId,
        query,
        resultCount: result.tasks.length,
        total: result.meta.total,
      });

      return result;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, {
        userId, query, filters, page, limit
      });
      throw this.enhanceError(error, 'Failed to search tasks');
    }
  }

  // ==============================================
  // ADDITIONAL INTERFACE METHODS
  // ==============================================

  async belongsToUser(taskId: string, userId: string): Promise<boolean> {
    const operation = this.logger.startOperation('belongsToUser');
    
    try {
      this.validator.validateId(taskId);
      this.validator.validateUserId(userId);
      
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, userId },
        select: { id: true }, // Only select ID for performance
      });

      const belongs = !!task;
      
      this.logger.logSuccess(operation, 'Task ownership checked', {
        taskId, userId, belongs
      });

      return belongs;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { taskId, userId });
      throw this.enhanceError(error, 'Failed to check task ownership');
    }
  }

  async getUserTaskStats(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    byPriority: Record<DomainTaskPriority, number>;
    byStatus: Record<DomainTaskStatus, number>;
  }> {
    const operation = this.logger.startOperation('getUserTaskStats');
    
    try {
      this.validator.validateUserId(userId);
      
      const [
        statusStats,
        priorityStats,
        overdueCount
      ] = await Promise.all([
        this.prisma.task.groupBy({
          by: ['status'],
          where: { userId },
          _count: { status: true },
        }),
        this.prisma.task.groupBy({
          by: ['priority'],
          where: { userId },
          _count: { priority: true },
        }),
        this.prisma.task.count({
          where: {
            userId,
            dueDate: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        }),
      ]);

      const stats = this.mapper.mapStatsToResponse(
        statusStats,
        priorityStats,
        overdueCount
      );

      this.logger.logSuccess(operation, 'User task stats retrieved', {
        userId, stats
      });

      return stats;
      
    } catch (error) {
      this.logger.logError(operation, error as Error, { userId });
      throw this.enhanceError(error, 'Failed to get user task stats');
    }
  }

  // ==============================================
  // PRIVATE HELPER METHODS
  // ==============================================

  private buildPaginationMeta(
    page: number, 
    limit: number, 
    total: number
  ): PaginationMeta {
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  private enhanceError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }
    return new Error(`${context}: Unknown error`);
  }
}

// ==============================================
// SUPPORTING CLASSES (DEPENDENCY INJECTION)
// ==============================================

/**
 * Handles all task data validation logic
 * Single Responsibility: Only validates data
 */
class TaskDataValidator {
  validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Valid ID is required');
    }
  }

  validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Valid user ID is required');
    }
  }

  validateCreateData(data: CreateTaskData): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Task title is required');
    }
    if (!data.userId || typeof data.userId !== 'string' || data.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
  }

  validateUpdateData(data: UpdateTaskData): void {
    if (data.title !== undefined && (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0)) {
      throw new Error('Task title cannot be empty');
    }
  }

  validateTaskStatus(status: DomainTaskStatus): void {
    const validStatuses: DomainTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid task status: ${status}`);
    }
  }

  validateTaskPriority(priority: DomainTaskPriority): void {
    const validPriorities: DomainTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid task priority: ${priority}`);
    }
  }

  validatePagination(page: number, limit: number): void {
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < PAGINATION_CONFIG.MIN_LIMIT || limit > PAGINATION_CONFIG.MAX_LIMIT) {
      throw new Error(`Limit must be between ${PAGINATION_CONFIG.MIN_LIMIT} and ${PAGINATION_CONFIG.MAX_LIMIT}`);
    }
  }

  validateSortOptions(sort: SortOptions): void {
    const validSortFields = Object.values(SORT_FIELDS);
    const validSortOrders = Object.values(SORT_ORDERS);
    
    if (!validSortFields.includes(sort.field as any)) {
      throw new Error(`Invalid sort field: ${sort.field}`);
    }
    if (!validSortOrders.includes(sort.order as any)) {
      throw new Error(`Invalid sort order: ${sort.order}`);
    }
  }

  validateSearchQuery(query: string): void {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required');
    }
    if (query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }
  }

  validateIdsArray(ids: string[]): void {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('IDs array is required and cannot be empty');
    }
    ids.forEach(id => this.validateId(id));
  }
}

/**
 * Handles data mapping between domain and persistence layers
 * Single Responsibility: Only maps data structures
 */
class TaskDataMapper {
  mapCreateDataToPrisma(data: CreateTaskData): any {
    return {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status || DEFAULT_VALUES.TASK_STATUS,
      priority: data.priority || DEFAULT_VALUES.TASK_PRIORITY,
      dueDate: data.dueDate || null,
      userId: data.userId,
      categoryId: data.categoryId || null,
      tags: data.tags || [],
      estimatedHours: data.estimatedHours || null,
      attachments: data.attachments || [],
    };
  }

  mapUpdateDataToPrisma(data: UpdateTaskData): any {
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;

    return updateData;
  }

  mapStatusUpdateToPrisma(status: DomainTaskStatus, completedAt?: Date): any {
    const updateData: any = { status };
    
    if (status === 'COMPLETED') {
      updateData.completedAt = completedAt || new Date();
    } else {
      updateData.completedAt = null;
    }

    return updateData;
  }

  mapPrismaToTaskWithCategory(task: any): TaskWithCategory {
    return {
      ...task,
      description: task.description ?? undefined, // Map null to undefined
      category: task.category ? {
        id: task.category.id,
        name: task.category.name,
        color: task.category.color || '#6366f1',
        icon: task.category.icon || 'folder',
      } : undefined,
    };
  }

  mapStatsToResponse(
    statusStats: any[],
    priorityStats: any[],
    overdueCount: number
  ): {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    byPriority: Record<DomainTaskPriority, number>;
    byStatus: Record<DomainTaskStatus, number>;
  } {
    const total = statusStats.reduce((sum, stat) => sum + stat._count.status, 0);
    
    const byStatus = statusStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<DomainTaskStatus, number>);

    const byPriority = priorityStats.reduce((acc, stat) => {
      acc[stat.priority] = stat._count.priority;
      return acc;
    }, {} as Record<DomainTaskPriority, number>);

    return {
      total,
      completed: byStatus.COMPLETED || 0,
      pending: byStatus.PENDING || 0,
      inProgress: byStatus.IN_PROGRESS || 0,
      overdue: overdueCount,
      byPriority,
      byStatus,
    };
  }
}

/**
 * Builds Prisma queries
 * Single Responsibility: Only constructs queries
 */
class TaskQueryBuilder {
  getCategoryInclude() {
    return {
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
    };
  }

  buildWhereClause(userId: string, filters: TaskFilters): any {
    const where: any = { userId };

    if (filters.status) {
      where.status = Array.isArray(filters.status) 
        ? { in: filters.status } 
        : filters.status;
    }

    if (filters.priority) {
      where.priority = Array.isArray(filters.priority) 
        ? { in: filters.priority } 
        : filters.priority;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) where.dueDate.gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo) where.dueDate.lte = new Date(filters.dueDateTo);
    }

    if (filters.isOverdue === true) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }

    if (filters.hasDueDate === true) {
      where.dueDate = { not: null };
    } else if (filters.hasDueDate === false) {
      where.dueDate = null;
    }

    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      where.tags = { hasSome: tags };
    }

    return where;
  }

  buildOrderByClause(sort: SortOptions): any {
    const validSortFields = Object.values(SORT_FIELDS);
    const sortField = validSortFields.includes(sort.field as any) 
      ? sort.field 
      : DEFAULT_VALUES.SORT_FIELD;
    const sortOrder = [SORT_ORDERS.ASC, SORT_ORDERS.DESC].includes(sort.order as any) 
      ? sort.order 
      : DEFAULT_VALUES.SORT_ORDER;
    
    return { [sortField]: sortOrder };
  }
}

/**
 * Handles all logging operations for the repository
 * Single Responsibility: Only handles logging
 */
class TaskRepositoryLogger {
  startOperation(operation: string): { operation: string; startTime: number } {
    return {
      operation,
      startTime: Date.now(),
    };
  }

  logSuccess(
    operationInfo: { operation: string; startTime: number },
    message: string,
    context: any = {}
  ): void {
    const duration = Date.now() - operationInfo.startTime;
    
    loggers.dbQuery(
      operationInfo.operation, 
      'tasks', 
      duration, 
      context.count?.toString() || '1'
    );
    
    logger.info({
      ...context,
      duration,
      event: `task.${operationInfo.operation}.success`,
      domain: 'repository',
    }, `✅ ${message}`);
  }

  logError(
    operationInfo: { operation: string; startTime: number },
    error: Error,
    context: any = {}
  ): void {
    const duration = Date.now() - operationInfo.startTime;
    
    loggers.dbError(error, `${operationInfo.operation}_task`, 'tasks');
    logError.medium(error, {
      context: `task_repository_${operationInfo.operation}`,
      ...context,
      duration,
    });
  }
}