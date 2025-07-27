// src/core/application/TaskService.ts
// ==============================================

import { Task, TaskStatus, Priority } from '@prisma/client';
import { 
  ITaskService, 
  TaskListResponse, 
  TaskStatsResponse, 
  ProductivityStats 
} from '@/core/domain/interfaces/ITaskService';
import { 
  ITaskRepository,
  TaskWithCategory,
  CreateTaskData as RepositoryCreateTaskData,
  UpdateTaskData as RepositoryUpdateTaskData,
  TaskQueryResult
} from '@/core/domain/interfaces/ITaskRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { logger } from '@/utils/logger';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  TASK_CONFIG,
  TASK_STATUSES,
  TASK_PRIORITIES,
  EVENT_TYPES,
  CACHE_TTL,
  CACHE_KEYS,
  PAGINATION_CONFIG,
  DEFAULT_VALUES,
  TaskFilters,
  SortOptions
} from '@/utils/constants';

// Application DTOs - diferentes de las del repository
export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: Date;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  attachments?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: Date;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  attachments?: string[];
}

// Custom error class para mejor manejo de errores
class TaskError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

export class TaskService implements ITaskService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: ICacheService
  ) {}

  async createTask(userId: string, data: CreateTaskData): Promise<Task> {
    try {
      logger.info({ userId, title: data.title }, 'Creating new task');

      // Validaciones de negocio
      this.validateTaskData(data);
      await this.checkUserTaskLimits(userId);

      // Mapear a formato del repository
      const repositoryData: RepositoryCreateTaskData = {
        ...data,
        userId,
        status: DEFAULT_VALUES.TASK_STATUS,
        priority: data.priority || DEFAULT_VALUES.TASK_PRIORITY
      };

      const task = await this.taskRepository.create(repositoryData);

      // Invalidar caches del usuario
      await this.invalidateUserCaches(userId);

      logger.info({ 
        userId, 
        taskId: task.id, 
        title: task.title,
        event: EVENT_TYPES.TASK_CREATED 
      }, SUCCESS_MESSAGES.TASK_CREATED);

      return task;

    } catch (error) {
      logger.error({ error, userId, data }, 'Failed to create task');
      this.handleError(error);
    }
  }

  async getTaskById(taskId: string, userId: string): Promise<TaskWithCategory> {
    try {
      logger.debug({ userId, taskId }, 'Getting task by ID');

      // Intentar obtener del cache primero
      const cached = await this.cacheService.getCachedTaskDetail(taskId);
      if (cached && cached.userId === userId) {
        logger.debug({ userId, taskId, event: EVENT_TYPES.CACHE_HIT }, 'Task retrieved from cache');
        return cached;
      }

      // Obtener de la base de datos
      const task = await this.taskRepository.findById(taskId);
      if (!task) {
        throw new TaskError(
          ERROR_MESSAGES.TASK_NOT_FOUND,
          ERROR_CODES.TASK_NOT_FOUND,
          404
        );
      }

      // Verificar ownership
      if (task.userId !== userId) {
        throw new TaskError(
          ERROR_MESSAGES.TASK_NOT_FOUND, // No revelar que existe
          ERROR_CODES.TASK_ACCESS_DENIED,
          403
        );
      }

      // Cachear el resultado
      await this.cacheService.cacheTaskDetail(taskId, task, CACHE_TTL.TASK_DETAIL);

      logger.debug({ userId, taskId, event: EVENT_TYPES.CACHE_MISS }, 'Task retrieved from database');
      return task;

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to get task by ID');
      this.handleError(error);
    }
  }

  async getUserTasks(
    userId: string,
    filters?: TaskFilters,
    sort?: SortOptions,
    page = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskListResponse> {
    try {
      logger.debug({ userId, filters, sort, page, limit }, 'Getting user tasks');

      // Para consultas simples sin filtros, intentar cache
      if (!filters && !sort && page === 1 && limit === PAGINATION_CONFIG.DEFAULT_LIMIT) {
        const cached = await this.cacheService.getCachedUserTasks(userId);
        if (cached) {
          logger.debug({ userId, event: EVENT_TYPES.CACHE_HIT }, 'User tasks retrieved from cache');
          return {
            tasks: cached,
            meta: this.buildPaginationMeta(cached.length, page, limit, cached.length)
          };
        }
      }

      // Obtener de la base de datos
      const result = await this.taskRepository.findByUserId(
        userId, 
        filters, 
        sort, 
        page, 
        limit
      );

      // Cachear solo consultas simples
      if (!filters && !sort && page === 1 && limit === PAGINATION_CONFIG.DEFAULT_LIMIT) {
        await this.cacheService.cacheUserTasks(userId, result.tasks, CACHE_TTL.USER_TASKS);
      }

      logger.debug({ 
        userId, 
        count: result.tasks.length, 
        total: result.meta.total,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'User tasks retrieved from database');

      return result;

    } catch (error) {
      logger.error({ error, userId, filters, sort, page, limit }, 'Failed to get user tasks');
      this.handleError(error);
    }
  }

  async updateTask(taskId: string, userId: string, data: UpdateTaskData): Promise<Task> {
    try {
      logger.info({ userId, taskId }, 'Updating task');

      // Verificar ownership
      await this.validateTaskOwnership(taskId, userId);

      // Validaciones de negocio
      this.validateTaskData(data);

      // Mapear a formato del repository
      const repositoryData: RepositoryUpdateTaskData = { ...data };
      const updatedTask = await this.taskRepository.update(taskId, repositoryData);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateTaskCache(taskId);

      logger.info({ 
        userId, 
        taskId, 
        changes: Object.keys(data),
        event: EVENT_TYPES.TASK_UPDATED 
      }, SUCCESS_MESSAGES.TASK_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, data }, 'Failed to update task');
      this.handleError(error);
    }
  }

  async updateTaskStatus(taskId: string, userId: string, status: TaskStatus): Promise<Task> {
    try {
      logger.info({ userId, taskId, status }, 'Updating task status');

      // Verificar ownership
      await this.validateTaskOwnership(taskId, userId);

      // Validar status
      if (!Object.values(TASK_STATUSES).includes(status)) {
        throw new TaskError(
          ERROR_MESSAGES.VALIDATION_ERROR,
          ERROR_CODES.INVALID_TASK_STATUS,
          400
        );
      }

      // Preparar fecha de completion si es necesario
      const completedAt = status === TASK_STATUSES.COMPLETED ? new Date() : undefined;
      
      const updatedTask = await this.taskRepository.updateStatus(taskId, status, completedAt);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateTaskCache(taskId);

      // Log evento específico
      const eventType = status === TASK_STATUSES.COMPLETED 
        ? EVENT_TYPES.TASK_COMPLETED 
        : EVENT_TYPES.TASK_STATUS_CHANGED;

      logger.info({ 
        userId, 
        taskId, 
        newStatus: status,
        event: eventType 
      }, SUCCESS_MESSAGES.TASK_STATUS_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, status }, 'Failed to update task status');
      this.handleError(error);
    }
  }

  async updateTaskPriority(taskId: string, userId: string, priority: Priority): Promise<Task> {
    try {
      logger.info({ userId, taskId, priority }, 'Updating task priority');

      // Verificar ownership
      await this.validateTaskOwnership(taskId, userId);

      // Validar priority
      if (!Object.values(TASK_PRIORITIES).includes(priority)) {
        throw new TaskError(
          ERROR_MESSAGES.VALIDATION_ERROR,
          ERROR_CODES.INVALID_TASK_PRIORITY,
          400
        );
      }

      const updatedTask = await this.taskRepository.updatePriority(taskId, priority);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateTaskCache(taskId);

      logger.info({ 
        userId, 
        taskId, 
        newPriority: priority 
      }, SUCCESS_MESSAGES.TASK_PRIORITY_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, priority }, 'Failed to update task priority');
      this.handleError(error);
    }
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    try {
      logger.info({ userId, taskId }, 'Deleting task');

      // Verificar ownership
      await this.validateTaskOwnership(taskId, userId);

      await this.taskRepository.delete(taskId);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateTaskCache(taskId);

      logger.info({ 
        userId, 
        taskId,
        event: EVENT_TYPES.TASK_DELETED 
      }, SUCCESS_MESSAGES.TASK_DELETED);

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to delete task');
      this.handleError(error);
    }
  }

  async getTasksByCategory(
    categoryId: string,
    userId: string,
    page = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskListResponse> {
    try {
      logger.debug({ userId, categoryId, page, limit }, 'Getting tasks by category');

      const result = await this.taskRepository.findByCategoryId(categoryId, userId, page, limit);

      logger.debug({ 
        userId, 
        categoryId, 
        count: result.tasks.length 
      }, 'Category tasks retrieved');

      return result;

    } catch (error) {
      logger.error({ error, userId, categoryId, page, limit }, 'Failed to get tasks by category');
      this.handleError(error);
    }
  }

  async searchTasks(
    userId: string,
    query: string,
    filters?: TaskFilters,
    page = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<TaskListResponse> {
    try {
      logger.debug({ userId, query, filters, page, limit }, 'Searching tasks');

      // Intentar obtener del cache
      const cached = await this.cacheService.getCachedSearchResults(userId, query, filters || {});
      if (cached && page === 1 && limit === PAGINATION_CONFIG.DEFAULT_LIMIT) {
        logger.debug({ userId, query, event: EVENT_TYPES.CACHE_HIT }, 'Search results retrieved from cache');
        return cached;
      }

      const result = await this.taskRepository.search(userId, query, filters, page, limit);

      // Cachear solo la primera página con límite default
      if (page === 1 && limit === PAGINATION_CONFIG.DEFAULT_LIMIT) {
        await this.cacheService.cacheSearchResults(
          userId, 
          query, 
          filters || {}, 
          result, 
          CACHE_TTL.SEARCH_RESULTS
        );
      }

      logger.debug({ 
        userId, 
        query, 
        count: result.tasks.length,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'Search results retrieved from database');

      return result;

    } catch (error) {
      logger.error({ error, userId, query, filters, page, limit }, 'Failed to search tasks');
      this.handleError(error);
    }
  }

  async getOverdueTasks(userId: string): Promise<TaskWithCategory[]> {
    try {
      logger.debug({ userId }, 'Getting overdue tasks');

      const tasks = await this.taskRepository.findOverdueTasks(userId);

      logger.debug({ userId, count: tasks.length }, 'Overdue tasks retrieved');
      return tasks;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get overdue tasks');
      this.handleError(error);
    }
  }

  async getUserStats(userId: string): Promise<TaskStatsResponse> {
    try {
      logger.debug({ userId }, 'Getting user task statistics');

      // Intentar obtener del cache
      const cached = await this.cacheService.getCachedUserStats(userId);
      if (cached?.taskStats) {
        logger.debug({ userId, event: EVENT_TYPES.CACHE_HIT }, 'Task stats retrieved from cache');
        return cached.taskStats;
      }

      // Obtener todas las tareas del usuario
      const allTasksResult = await this.taskRepository.findByUserId(userId, {}, undefined, 1, 10000);
      const tasks = allTasksResult.tasks;

      // Calcular estadísticas
      const stats: TaskStatsResponse = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === TASK_STATUSES.COMPLETED).length,
        pendingTasks: tasks.filter(t => t.status === TASK_STATUSES.PENDING).length,
        inProgressTasks: tasks.filter(t => t.status === TASK_STATUSES.IN_PROGRESS).length,
        overdueTasks: tasks.filter(t => 
          t.dueDate && 
          new Date(t.dueDate) < new Date() && 
          t.status !== TASK_STATUSES.COMPLETED
        ).length,
        tasksByPriority: {
          urgent: tasks.filter(t => t.priority === TASK_PRIORITIES.URGENT).length,
          high: tasks.filter(t => t.priority === TASK_PRIORITIES.HIGH).length,
          medium: tasks.filter(t => t.priority === TASK_PRIORITIES.MEDIUM).length,
          low: tasks.filter(t => t.priority === TASK_PRIORITIES.LOW).length
        },
        tasksByStatus: {
          pending: tasks.filter(t => t.status === TASK_STATUSES.PENDING).length,
          inProgress: tasks.filter(t => t.status === TASK_STATUSES.IN_PROGRESS).length,
          completed: tasks.filter(t => t.status === TASK_STATUSES.COMPLETED).length,
          cancelled: tasks.filter(t => t.status === TASK_STATUSES.CANCELLED).length,
          onHold: tasks.filter(t => t.status === TASK_STATUSES.ON_HOLD).length
        },
        completionRate: tasks.length > 0 
          ? (tasks.filter(t => t.status === TASK_STATUSES.COMPLETED).length / tasks.length) * 100 
          : 0
      };

      // Calcular tiempo promedio de completion si hay tareas completadas
      const completedTasks = tasks.filter(t => t.status === TASK_STATUSES.COMPLETED && t.completedAt);
      if (completedTasks.length > 0) {
        const totalTime = completedTasks.reduce((sum, task) => {
          const created = new Date(task.createdAt);
          const completed = new Date(task.completedAt!);
          return sum + (completed.getTime() - created.getTime());
        }, 0);
        stats.avgCompletionTime = Math.round(totalTime / completedTasks.length / (1000 * 60 * 60)); // horas
      }

      // Cachear las estadísticas
      await this.cacheService.cacheUserStats(userId, { taskStats: stats }, CACHE_TTL.USER_STATS);

      logger.debug({ userId, stats }, 'User task statistics calculated');
      return stats;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user stats');
      this.handleError(error);
    }
  }

  async getProductivityStats(userId: string): Promise<ProductivityStats> {
    try {
      logger.debug({ userId }, 'Getting productivity statistics');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - (6 * 24 * 60 * 60 * 1000));
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Obtener tareas completadas
      const allTasksResult = await this.taskRepository.findByUserId(
        userId, 
        { status: TASK_STATUSES.COMPLETED }, 
        undefined, 
        1, 
        10000
      );
      const completedTasks = allTasksResult.tasks;

      const stats: ProductivityStats = {
        tasksCompletedToday: completedTasks.filter(t => 
          t.completedAt && new Date(t.completedAt) >= todayStart
        ).length,
        tasksCompletedThisWeek: completedTasks.filter(t => 
          t.completedAt && new Date(t.completedAt) >= weekStart
        ).length,
        tasksCompletedThisMonth: completedTasks.filter(t => 
          t.completedAt && new Date(t.completedAt) >= monthStart
        ).length,
        streakDays: this.calculateStreakDays(completedTasks),
        mostProductiveDay: this.getMostProductiveDay(completedTasks),
        avgTasksPerDay: this.calculateAvgTasksPerDay(completedTasks),
        peakHours: this.getPeakHours(completedTasks)
      };

      logger.debug({ userId, stats }, 'Productivity statistics calculated');
      return stats;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get productivity stats');
      this.handleError(error);
    }
  }

  async bulkUpdateStatus(taskIds: string[], userId: string, status: TaskStatus): Promise<void> {
    try {
      logger.info({ userId, taskIds, status }, 'Bulk updating task status');

      // Validar ownership de todas las tareas
      for (const taskId of taskIds) {
        await this.validateTaskOwnership(taskId, userId);
      }

      // Validar status
      if (!Object.values(TASK_STATUSES).includes(status)) {
        throw new TaskError(
          ERROR_MESSAGES.VALIDATION_ERROR,
          ERROR_CODES.INVALID_TASK_STATUS,
          400
        );
      }

      await this.taskRepository.bulkUpdateStatus(taskIds, status);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      for (const taskId of taskIds) {
        await this.cacheService.invalidateTaskCache(taskId);
      }

      logger.info({ 
        userId, 
        updatedCount: taskIds.length, 
        status 
      }, 'Tasks bulk status updated successfully');

    } catch (error) {
      logger.error({ error, userId, taskIds, status }, 'Failed to bulk update task status');
      this.handleError(error);
    }
  }

  async bulkDeleteTasks(taskIds: string[], userId: string): Promise<void> {
    try {
      logger.info({ userId, taskIds }, 'Bulk deleting tasks');

      // Validar ownership de todas las tareas
      for (const taskId of taskIds) {
        await this.validateTaskOwnership(taskId, userId);
      }

      await this.taskRepository.bulkDelete(taskIds);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      for (const taskId of taskIds) {
        await this.cacheService.invalidateTaskCache(taskId);
      }

      logger.info({ 
        userId, 
        deletedCount: taskIds.length,
        event: EVENT_TYPES.TASK_DELETED 
      }, 'Tasks bulk deleted successfully');

    } catch (error) {
      logger.error({ error, userId, taskIds }, 'Failed to bulk delete tasks');
      this.handleError(error);
    }
  }

  async markTaskAsCompleted(taskId: string, userId: string): Promise<Task> {
    try {
      logger.info({ userId, taskId }, 'Marking task as completed');

      const task = await this.updateTaskStatus(taskId, userId, TASK_STATUSES.COMPLETED);

      logger.info({ 
        userId, 
        taskId,
        event: EVENT_TYPES.TASK_COMPLETED 
      }, SUCCESS_MESSAGES.TASK_COMPLETED);

      return task;

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to mark task as completed');
      this.handleError(error);
    }
  }

  async duplicateTask(taskId: string, userId: string): Promise<Task> {
    try {
      logger.info({ userId, taskId }, 'Duplicating task');

      // Obtener la tarea original
      const originalTask = await this.getTaskById(taskId, userId);

      // Crear datos para la nueva tarea
      const duplicateData: CreateTaskData = {
        title: `${originalTask.title} (Copy)`,
        description: originalTask.description,
        priority: originalTask.priority,
        dueDate: originalTask.dueDate,
        categoryId: originalTask.categoryId,
        tags: [...(originalTask.tags || [])],
        estimatedHours: originalTask.estimatedHours,
        attachments: [...(originalTask.attachments || [])]
      };

      const duplicatedTask = await this.createTask(userId, duplicateData);

      logger.info({ 
        userId, 
        originalTaskId: taskId, 
        duplicatedTaskId: duplicatedTask.id 
      }, 'Task duplicated successfully');

      return duplicatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to duplicate task');
      this.handleError(error);
    }
  }

  // Métodos privados

  private validateTaskData(data: CreateTaskData | UpdateTaskData): void {
    if (data.title !== undefined) {
      if (!data.title.trim()) {
        throw new TaskError(
          'Task title is required',
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
      
      if (data.title.length > TASK_CONFIG.MAX_TITLE_LENGTH) {
        throw new TaskError(
          `Title must be less than ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`,
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    }

    if (data.description && data.description.length > TASK_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new TaskError(
        `Description must be less than ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`,
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (data.tags && data.tags.length > TASK_CONFIG.MAX_TAGS_COUNT) {
      throw new TaskError(
        `Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`,
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (data.estimatedHours && data.estimatedHours > TASK_CONFIG.MAX_ESTIMATED_HOURS) {
      throw new TaskError(
        `Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`,
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (data.dueDate && data.dueDate < new Date(Date.now() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60 * 1000)) {
      throw new TaskError(
        ERROR_MESSAGES.INVALID_DUE_DATE,
        ERROR_CODES.INVALID_DUE_DATE,
        400
      );
    }
  }

  private async checkUserTaskLimits(userId: string): Promise<void> {
    const taskCount = await this.taskRepository.countByUserId(userId);
    const MAX_TASKS_PER_USER = 10000; // Configurable limit

    if (taskCount >= MAX_TASKS_PER_USER) {
      throw new TaskError(
        `Maximum ${MAX_TASKS_PER_USER} tasks per user exceeded`,
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
  }

  private async validateTaskOwnership(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task || task.userId !== userId) {
      throw new TaskError(
        ERROR_MESSAGES.TASK_NOT_FOUND,
        ERROR_CODES.TASK_ACCESS_DENIED,
        403
      );
    }
  }

  private async invalidateUserCaches(userId: string): Promise<void> {
    try {
      await this.cacheService.invalidateUserTasksCache(userId);
      await this.cacheService.invalidateUserStatsCache(userId);
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user caches');
    }
  }

  private buildPaginationMeta(count: number, page: number, limit: number, total: number) {
    const pages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1
    };
  }

  private calculateStreakDays(completedTasks: TaskWithCategory[]): number {
    if (completedTasks.length === 0) return 0;

    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const hasTasksOnDay = completedTasks.some(task => 
        task.completedAt && 
        new Date(task.completedAt) >= dayStart && 
        new Date(task.completedAt) < dayEnd
      );

      if (hasTasksOnDay) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  private getMostProductiveDay(completedTasks: TaskWithCategory[]): string {
    const dayCount: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    completedTasks.forEach(task => {
      if (task.completedAt) {
        const day = new Date(task.completedAt).getDay();
        const dayName = dayNames[day];
        dayCount[dayName] = (dayCount[dayName] || 0) + 1;
      }
    });

    let mostProductiveDay = 'Monday';
    let maxCount = 0;

    Object.entries(dayCount).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostProductiveDay = day;
      }
    });

    return mostProductiveDay;
  }

  private calculateAvgTasksPerDay(completedTasks: TaskWithCategory[]): number {
    if (completedTasks.length === 0) return 0;

    const uniqueDays = new Set();
    completedTasks.forEach(task => {
      if (task.completedAt) {
        const date = new Date(task.completedAt);
        const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        uniqueDays.add(dayKey);
      }
    });

    return uniqueDays.size > 0 ? Math.round((completedTasks.length / uniqueDays.size) * 100) / 100 : 0;
  }

  private getPeakHours(completedTasks: TaskWithCategory[]): number[] {
    const hourCount: Record<number, number> = {};

    completedTasks.forEach(task => {
      if (task.completedAt) {
        const hour = new Date(task.completedAt).getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }
    });

    const sortedHours = Object.entries(hourCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return sortedHours.length > 0 ? sortedHours : [9, 14, 16]; // Default peak hours
  }

  private handleError(error: unknown): never {
    if (error instanceof TaskError) {
      throw error;
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new TaskError(
      ERROR_MESSAGES.INTERNAL_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      500
    );
  }
}