// src/core/infrastructure/repositories/TaskRepository.ts
import { PrismaClient, Task, TaskStatus, Priority } from '@prisma/client';
import { 
  ITaskRepository, 
  CreateTaskData, 
  UpdateTaskData, 
  TaskWithCategory, 
  TaskQueryResult 
} from '@/core/domain/interfaces/ITaskRepository';
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

/**
 * Repository implementation for Task entity
 * Handles all database operations for tasks with proper error handling,
 * logging, validation and adherence to SOLID principles
 */
export class TaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaClient = db) {}

  /**
   * Create a new task
   */
  async create(data: CreateTaskData): Promise<Task> {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      this.validateCreateData(data);
      
      const task = await this.prisma.task.create({
        data: {
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
        },
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('create', 'tasks', duration, 1);
      logger.info({
        taskId: task.id,
        userId: data.userId,
        status: task.status,
        priority: task.priority,
        duration,
        event: 'task.created',
        domain: 'repository',
      }, `✅ Task created successfully: "${task.title}"`);

      return task;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'create_task', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_create',
        data,
        duration,
      });
      
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Failed to create task: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<TaskWithCategory | null> {
    const startTime = Date.now();
    
    try {
      this.validateId(id);
      
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findById', 'tasks', duration, task ? 1 : 0);

      return task ? this.mapToTaskWithCategory(task) : null;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'find_task_by_id', 'tasks');
      logError.low(error as Error, {
        context: 'task_repository_find_by_id',
        id,
        duration,
      });
      
      throw new Error(`Failed to find task by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find tasks by user ID with filters, sorting and pagination
   */
  async findByUserId(
    userId: string,
    filters: TaskFilters = {},
    sort: SortOptions = { field: DEFAULT_VALUES.SORT_FIELD, order: DEFAULT_VALUES.SORT_ORDER },
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const startTime = Date.now();
    
    try {
      this.validateUserId(userId);
      this.validatePagination(page, limit);
      this.validateSortOptions(sort);
      
      const where = this.buildWhereClause(userId, filters);
      const orderBy = this.buildOrderByClause(sort);
      const skip = (page - 1) * limit;

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                icon: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.task.count({ where }),
      ]);

      const duration = Date.now() - startTime;
      loggers.dbQuery('findByUserId', 'tasks', duration, tasks.length);

      const meta: PaginationMeta = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        tasks: tasks.map(this.mapToTaskWithCategory),
        meta,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'find_tasks_by_user', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_find_by_user_id',
        userId,
        filters,
        sort,
        page,
        limit,
        duration,
      });
      
      throw new Error(`Failed to find tasks by user ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find tasks by category ID
   */
  async findByCategoryId(
    categoryId: string,
    userId: string,
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const startTime = Date.now();
    
    try {
      this.validateId(categoryId);
      this.validateUserId(userId);
      this.validatePagination(page, limit);
      
      const skip = (page - 1) * limit;
      const where = { categoryId, userId };

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                icon: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.task.count({ where }),
      ]);

      const duration = Date.now() - startTime;
      loggers.dbQuery('findByCategoryId', 'tasks', duration, tasks.length);

      const meta: PaginationMeta = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        tasks: tasks.map(this.mapToTaskWithCategory),
        meta,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'find_tasks_by_category', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_find_by_category_id',
        categoryId,
        userId,
        page,
        limit,
        duration,
      });
      
      throw new Error(`Failed to find tasks by category ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a task
   */
  async update(id: string, data: UpdateTaskData): Promise<Task> {
    const startTime = Date.now();
    
    try {
      this.validateId(id);
      this.validateUpdateData(data);
      
      // Build update data, excluding undefined values
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

      const task = await this.prisma.task.update({
        where: { id },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('update', 'tasks', duration, 1);
      logger.info({
        taskId: id,
        updatedFields: Object.keys(updateData),
        duration,
        event: 'task.updated',
        domain: 'repository',
      }, `✅ Task updated successfully: "${task.title}"`);

      return task;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'update_task', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_update',
        id,
        data,
        duration,
      });
      
      throw new Error(`Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus, completedAt?: Date): Promise<Task> {
    const startTime = Date.now();
    
    try {
      this.validateId(id);
      this.validateTaskStatus(status);
      
      const updateData: any = { status };
      if (status === 'COMPLETED') {
        updateData.completedAt = completedAt || new Date();
      } else if (status !== 'COMPLETED') {
        updateData.completedAt = null;
      }

      const task = await this.prisma.task.update({
        where: { id },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('updateStatus', 'tasks', duration, 1);
      logger.info({
        taskId: id,
        oldStatus: 'unknown', // Would need to fetch first to know old status
        newStatus: status,
        duration,
        event: 'task.status.updated',
        domain: 'repository',
      }, `🔄 Task status updated to ${status}: "${task.title}"`);

      return task;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'update_task_status', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_update_status',
        id,
        status,
        completedAt,
        duration,
      });
      
      throw new Error(`Failed to update task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update task priority
   */
  async updatePriority(id: string, priority: Priority): Promise<Task> {
    const startTime = Date.now();
    
    try {
      this.validateId(id);
      this.validateTaskPriority(priority);
      
      const task = await this.prisma.task.update({
        where: { id },
        data: { priority },
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('updatePriority', 'tasks', duration, 1);
      logger.info({
        taskId: id,
        newPriority: priority,
        duration,
        event: 'task.priority.updated',
        domain: 'repository',
      }, `🎯 Task priority updated to ${priority}: "${task.title}"`);

      return task;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'update_task_priority', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_update_priority',
        id,
        priority,
        duration,
      });
      
      throw new Error(`Failed to update task priority: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.validateId(id);
      
      const task = await this.prisma.task.delete({
        where: { id },
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('delete', 'tasks', duration, 1);
      logger.info({
        taskId: id,
        taskTitle: task.title,
        duration,
        event: 'task.deleted',
        domain: 'repository',
      }, `🗑️ Task deleted successfully: "${task.title}"`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'delete_task', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_delete',
        id,
        duration,
      });
      
      throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Count tasks by user ID with optional filters
   */
  async countByUserId(userId: string, filters: TaskFilters = {}): Promise<number> {
    const startTime = Date.now();
    
    try {
      this.validateUserId(userId);
      
      const where = this.buildWhereClause(userId, filters);
      const count = await this.prisma.task.count({ where });

      const duration = Date.now() - startTime;
      loggers.dbQuery('countByUserId', 'tasks', duration, count);

      return count;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'count_tasks_by_user', 'tasks');
      logError.low(error as Error, {
        context: 'task_repository_count_by_user_id',
        userId,
        filters,
        duration,
      });
      
      throw new Error(`Failed to count tasks by user ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find overdue tasks for a user
   */
  async findOverdueTasks(userId: string): Promise<TaskWithCategory[]> {
    const startTime = Date.now();
    
    try {
      this.validateUserId(userId);
      
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findOverdueTasks', 'tasks', duration, tasks.length);

      return tasks.map(this.mapToTaskWithCategory);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'find_overdue_tasks', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_find_overdue_tasks',
        userId,
        duration,
      });
      
      throw new Error(`Failed to find overdue tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find tasks by multiple IDs
   */
  async findByIds(ids: string[]): Promise<TaskWithCategory[]> {
    const startTime = Date.now();
    
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('IDs array is required and cannot be empty');
      }
      
      ids.forEach(this.validateId);
      
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: ids } },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findByIds', 'tasks', duration, tasks.length);

      return tasks.map(this.mapToTaskWithCategory);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'find_tasks_by_ids', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_find_by_ids',
        ids,
        duration,
      });
      
      throw new Error(`Failed to find tasks by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update status for multiple tasks
   */
  async bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('IDs array is required and cannot be empty');
      }
      
      ids.forEach(this.validateId);
      this.validateTaskStatus(status);
      
      const updateData: any = { status };
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (status !== 'COMPLETED') {
        updateData.completedAt = null;
      }

      const result = await this.prisma.task.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('bulkUpdateStatus', 'tasks', duration, result.count);
      logger.info({
        taskIds: ids,
        status,
        updatedCount: result.count,
        duration,
        event: 'task.bulk.status.updated',
        domain: 'repository',
      }, `🔄 Bulk status update: ${result.count} tasks updated to ${status}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'bulk_update_status', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_bulk_update_status',
        ids,
        status,
        duration,
      });
      
      throw new Error(`Failed to bulk update task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk delete multiple tasks
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('IDs array is required and cannot be empty');
      }
      
      ids.forEach(this.validateId);
      
      const result = await this.prisma.task.deleteMany({
        where: { id: { in: ids } },
      });

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('bulkDelete', 'tasks', duration, result.count);
      logger.info({
        taskIds: ids,
        deletedCount: result.count,
        duration,
        event: 'task.bulk.deleted',
        domain: 'repository',
      }, `🗑️ Bulk delete: ${result.count} tasks deleted`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'bulk_delete_tasks', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_bulk_delete',
        ids,
        duration,
      });
      
      throw new Error(`Failed to bulk delete tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search tasks by query string
   */
  async search(
    userId: string,
    query: string,
    filters: TaskFilters = {},
    page: number = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskQueryResult> {
    const startTime = Date.now();
    
    try {
      this.validateUserId(userId);
      this.validateSearchQuery(query);
      this.validatePagination(page, limit);
      
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

      const duration = Date.now() - startTime;
      
      loggers.dbQuery('search', 'tasks', duration, result.tasks.length);
      logger.info({
        userId,
        query,
        resultCount: result.tasks.length,
        total: result.meta.total,
        duration,
        event: 'task.search',
        domain: 'repository',
      }, `🔍 Task search completed: "${query}" - ${result.tasks.length} results`);

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'search_tasks', 'tasks');
      logError.medium(error as Error, {
        context: 'task_repository_search',
        userId,
        query,
        filters,
        page,
        limit,
        duration,
      });
      
      throw new Error(`Failed to search tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==============================================
  // PRIVATE HELPER METHODS
  // ==============================================

  /**
   * Map Prisma task to TaskWithCategory
   */
  private mapToTaskWithCategory(task: any): TaskWithCategory {
    return {
      ...task,
      category: task.category ? {
        id: task.category.id,
        name: task.category.name,
        color: task.category.color || '#6366f1',
        icon: task.category.icon || 'folder',
      } : undefined,
    };
  }

  /**
   * Build WHERE clause for Prisma queries
   */
  private buildWhereClause(userId: string, filters: TaskFilters): any {
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

  /**
   * Build ORDER BY clause for Prisma queries
   */
  private buildOrderByClause(sort: SortOptions): any {
    const validSortFields = Object.values(SORT_FIELDS);
    const sortField = validSortFields.includes(sort.field) ? sort.field : DEFAULT_VALUES.SORT_FIELD;
    const sortOrder = [SORT_ORDERS.ASC, SORT_ORDERS.DESC].includes(sort.order) ? sort.order : DEFAULT_VALUES.SORT_ORDER;
    
    return { [sortField]: sortOrder };
  }

  // ==============================================
  // VALIDATION METHODS
  // ==============================================

  private validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Valid ID is required');
    }
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Valid user ID is required');
    }
  }

  private validateCreateData(data: CreateTaskData): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Task title is required');
    }
    if (!data.userId || typeof data.userId !== 'string' || data.userId.trim().length === 0) {
      throw new Error('User ID is required');
    }
  }

  private validateUpdateData(data: UpdateTaskData): void {
    if (data.title !== undefined && (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0)) {
      throw new Error('Task title cannot be empty');
    }
  }

  private validateTaskStatus(status: TaskStatus): void {
    const validStatuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid task status: ${status}`);
    }
  }

  private validateTaskPriority(priority: Priority): void {
    const validPriorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid task priority: ${priority}`);
    }
  }

  private validatePagination(page: number, limit: number): void {
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < PAGINATION_CONFIG.MIN_LIMIT || limit > PAGINATION_CONFIG.MAX_LIMIT) {
      throw new Error(`Limit must be between ${PAGINATION_CONFIG.MIN_LIMIT} and ${PAGINATION_CONFIG.MAX_LIMIT}`);
    }
  }

  private validateSortOptions(sort: SortOptions): void {
    const validSortFields = Object.values(SORT_FIELDS);
    const validSortOrders = Object.values(SORT_ORDERS);
    
    if (!validSortFields.includes(sort.field)) {
      throw new Error(`Invalid sort field: ${sort.field}`);
    }
    if (!validSortOrders.includes(sort.order)) {
      throw new Error(`Invalid sort order: ${sort.order}`);
    }
  }

  private validateSearchQuery(query: string): void {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required');
    }
    if (query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }
  }
}