// src/core/application/TaskService.ts
// ==============================================

import { Task, TaskStatus, Priority } from '@prisma/client';
import { ITaskService } from '@/core/domain/interfaces/ITaskService';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { logger } from '@/utils/logger';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  TASK_CONFIG,
  EVENT_TYPES,
  CACHE_TTL
} from '@/utils/constants';
import { TaskFilters, SortOptions, PaginationMeta } from '@/utils/constants';

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: Date;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
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
}

export interface TaskQueryOptions {
  page?: number;
  limit?: number;
  filters?: TaskFilters;
  sort?: SortOptions;
  search?: string;
}

export interface TaskWithCategory extends Task {
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}

export interface TasksResult {
  tasks: TaskWithCategory[];
  meta: PaginationMeta;
}

export class TaskService implements ITaskService {
  constructor(
    private taskRepository: ITaskRepository,
    private cacheService: ICacheService
  ) {}

  async createTask(userId: string, data: CreateTaskData): Promise<Task> {
    try {
      logger.info({ userId, title: data.title }, 'Creating new task');

      // Validaciones de negocio
      await this.validateTaskData(data);
      
      // Verificar límites por usuario si es necesario
      await this.checkUserTaskLimits(userId);

      // Crear la tarea
      const task = await this.taskRepository.create(userId, data);

      // Invalidar cache del usuario
      await this.invalidateUserCache(userId);

      // Log del evento
      logger.info({ 
        userId, 
        taskId: task.id, 
        title: task.title,
        event: EVENT_TYPES.TASK_CREATED 
      }, SUCCESS_MESSAGES.TASK_CREATED);

      return task;

    } catch (error) {
      logger.error({ error, userId, data }, 'Failed to create task');
      throw error;
    }
  }

  async updateTask(userId: string, taskId: string, data: UpdateTaskData): Promise<Task> {
    try {
      logger.info({ userId, taskId }, 'Updating task');

      // Verificar que existe y pertenece al usuario
      const existingTask = await this.getTaskById(userId, taskId);
      if (!existingTask) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
      }

      // Validaciones de negocio
      await this.validateTaskData(data);

      // Actualizar la tarea
      const updatedTask = await this.taskRepository.update(taskId, data);

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheService.del(`task:${taskId}`);

      logger.info({ 
        userId, 
        taskId, 
        changes: Object.keys(data),
        event: EVENT_TYPES.TASK_UPDATED 
      }, SUCCESS_MESSAGES.TASK_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, data }, 'Failed to update task');
      throw error;
    }
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    try {
      logger.info({ userId, taskId }, 'Deleting task');

      // Verificar que existe y pertenece al usuario
      const existingTask = await this.getTaskById(userId, taskId);
      if (!existingTask) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
      }

      // Eliminar la tarea
      await this.taskRepository.delete(taskId);

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheService.del(`task:${taskId}`);

      logger.info({ 
        userId, 
        taskId,
        event: EVENT_TYPES.TASK_DELETED 
      }, SUCCESS_MESSAGES.TASK_DELETED);

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to delete task');
      throw error;
    }
  }

  async getTaskById(userId: string, taskId: string): Promise<TaskWithCategory | null> {
    try {
      // Intentar obtener del cache primero
      const cacheKey = `task:${taskId}`;
      const cached = await this.cacheService.getJson<TaskWithCategory>(cacheKey);
      
      if (cached && cached.userId === userId) {
        logger.info({ userId, taskId, event: EVENT_TYPES.CACHE_HIT }, 'Task retrieved from cache');
        return cached;
      }

      // Si no está en cache, obtener de la base de datos
      const task = await this.taskRepository.findById(taskId);
      
      if (!task || task.userId !== userId) {
        return null;
      }

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, task, CACHE_TTL.TASK_DETAIL);
      
      logger.info({ userId, taskId, event: EVENT_TYPES.CACHE_MISS }, 'Task retrieved from database');
      return task;

    } catch (error) {
      logger.error({ error, userId, taskId }, 'Failed to get task by ID');
      throw error;
    }
  }

  async getUserTasks(userId: string, options: TaskQueryOptions = {}): Promise<TasksResult> {
    try {
      const { page = 1, limit = 20, filters, sort, search } = options;
      
      logger.info({ userId, options }, 'Getting user tasks');

      // Generar clave de cache basada en los parámetros
      const cacheKey = this.generateTasksCacheKey(userId, options);
      
      // Intentar obtener del cache
      const cached = await this.cacheService.getJson<TasksResult>(cacheKey);
      if (cached) {
        logger.info({ userId, event: EVENT_TYPES.CACHE_HIT }, 'User tasks retrieved from cache');
        return cached;
      }

      // Obtener de la base de datos
      const result = await this.taskRepository.findByUserId(userId, {
        page,
        limit,
        filters,
        sort,
        search
      });

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, result, CACHE_TTL.USER_TASKS);
      
      logger.info({ 
        userId, 
        count: result.tasks.length, 
        total: result.meta.total,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'User tasks retrieved from database');

      return result;

    } catch (error) {
      logger.error({ error, userId, options }, 'Failed to get user tasks');
      throw error;
    }
  }

  async updateTaskStatus(userId: string, taskId: string, status: TaskStatus): Promise<Task> {
    try {
      logger.info({ userId, taskId, status }, 'Updating task status');

      // Verificar que la tarea existe y pertenece al usuario
      const existingTask = await this.getTaskById(userId, taskId);
      if (!existingTask) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
      }

      // Preparar datos de actualización
      const updateData: UpdateTaskData = { 
        ...(status === TaskStatus.COMPLETED && { completedAt: new Date() })
      };

      // Actualizar el status
      const updatedTask = await this.taskRepository.updateStatus(taskId, status, updateData);

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheService.del(`task:${taskId}`);

      // Eventos específicos
      const eventType = status === TaskStatus.COMPLETED 
        ? EVENT_TYPES.TASK_COMPLETED 
        : EVENT_TYPES.TASK_STATUS_CHANGED;

      logger.info({ 
        userId, 
        taskId, 
        oldStatus: existingTask.status,
        newStatus: status,
        event: eventType 
      }, SUCCESS_MESSAGES.TASK_STATUS_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, status }, 'Failed to update task status');
      throw error;
    }
  }

  async updateTaskPriority(userId: string, taskId: string, priority: Priority): Promise<Task> {
    try {
      logger.info({ userId, taskId, priority }, 'Updating task priority');

      // Verificar que la tarea existe y pertenece al usuario
      const existingTask = await this.getTaskById(userId, taskId);
      if (!existingTask) {
        throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
      }

      // Actualizar la prioridad
      const updatedTask = await this.taskRepository.updatePriority(taskId, priority);

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheService.del(`task:${taskId}`);

      logger.info({ 
        userId, 
        taskId, 
        oldPriority: existingTask.priority,
        newPriority: priority 
      }, SUCCESS_MESSAGES.TASK_PRIORITY_UPDATED);

      return updatedTask;

    } catch (error) {
      logger.error({ error, userId, taskId, priority }, 'Failed to update task priority');
      throw error;
    }
  }

  async getTasksByCategory(userId: string, categoryId: string, options: TaskQueryOptions = {}): Promise<TasksResult> {
    try {
      const { page = 1, limit = 20, sort } = options;
      
      logger.info({ userId, categoryId, options }, 'Getting tasks by category');

      // Generar clave de cache
      const cacheKey = `category:${categoryId}:tasks:${page}:${limit}:${JSON.stringify(sort)}`;
      
      // Intentar obtener del cache
      const cached = await this.cacheService.getJson<TasksResult>(cacheKey);
      if (cached) {
        logger.info({ userId, categoryId, event: EVENT_TYPES.CACHE_HIT }, 'Category tasks retrieved from cache');
        return cached;
      }

      // Obtener de la base de datos
      const result = await this.taskRepository.findByCategory(categoryId, userId, {
        page,
        limit,
        sort
      });

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, result, CACHE_TTL.CATEGORY_TASKS);
      
      logger.info({ 
        userId, 
        categoryId, 
        count: result.tasks.length,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'Category tasks retrieved from database');

      return result;

    } catch (error) {
      logger.error({ error, userId, categoryId, options }, 'Failed to get tasks by category');
      throw error;
    }
  }

  async searchTasks(userId: string, query: string, options: TaskQueryOptions = {}): Promise<TasksResult> {
    try {
      const { page = 1, limit = 20, filters, sort } = options;
      
      logger.info({ userId, query, options }, 'Searching tasks');

      // Generar clave de cache para búsqueda
      const cacheKey = `search:${userId}:${Buffer.from(query + JSON.stringify(options)).toString('base64')}`;
      
      // Intentar obtener del cache
      const cached = await this.cacheService.getJson<TasksResult>(cacheKey);
      if (cached) {
        logger.info({ userId, query, event: EVENT_TYPES.CACHE_HIT }, 'Search results retrieved from cache');
        return cached;
      }

      // Buscar en la base de datos
      const result = await this.taskRepository.searchTasks(userId, query, {
        page,
        limit,
        filters,
        sort
      });

      // Guardar en cache con TTL más corto para búsquedas
      await this.cacheService.setJson(cacheKey, result, CACHE_TTL.SEARCH_RESULTS);
      
      logger.info({ 
        userId, 
        query, 
        count: result.tasks.length,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'Search results retrieved from database');

      return result;

    } catch (error) {
      logger.error({ error, userId, query, options }, 'Failed to search tasks');
      throw error;
    }
  }

  async getOverdueTasks(userId: string): Promise<TaskWithCategory[]> {
    try {
      logger.info({ userId }, 'Getting overdue tasks');

      const now = new Date();
      const tasks = await this.taskRepository.findOverdue(userId, now);

      logger.info({ userId, count: tasks.length }, 'Overdue tasks retrieved');
      return tasks;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get overdue tasks');
      throw error;
    }
  }

  async getTasksCompletedInPeriod(userId: string, startDate: Date, endDate: Date): Promise<TaskWithCategory[]> {
    try {
      logger.info({ userId, startDate, endDate }, 'Getting tasks completed in period');

      const tasks = await this.taskRepository.findCompletedInPeriod(userId, startDate, endDate);

      logger.info({ userId, count: tasks.length }, 'Period tasks retrieved');
      return tasks;

    } catch (error) {
      logger.error({ error, userId, startDate, endDate }, 'Failed to get period tasks');
      throw error;
    }
  }

  // Métodos privados de utilidad

  private async validateTaskData(data: CreateTaskData | UpdateTaskData): Promise<void> {
    if (data.title && data.title.length > TASK_CONFIG.MAX_TITLE_LENGTH) {
      throw new Error(`Title must be less than ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`);
    }

    if (data.description && data.description.length > TASK_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description must be less than ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`);
    }

    if (data.tags && data.tags.length > TASK_CONFIG.MAX_TAGS_COUNT) {
      throw new Error(`Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`);
    }

    if (data.estimatedHours && data.estimatedHours > TASK_CONFIG.MAX_ESTIMATED_HOURS) {
      throw new Error(`Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`);
    }

    if (data.dueDate && data.dueDate < new Date()) {
      throw new Error(ERROR_MESSAGES.INVALID_DUE_DATE);
    }
  }

  private async checkUserTaskLimits(userId: string): Promise<void> {
    // Implementar límites por usuario si es necesario
    // Por ejemplo: máximo 1000 tareas por usuario
    const taskCount = await this.taskRepository.countByUserId(userId);
    const MAX_TASKS_PER_USER = 1000;

    if (taskCount >= MAX_TASKS_PER_USER) {
      throw new Error(`Maximum ${MAX_TASKS_PER_USER} tasks per user exceeded`);
    }
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      // Invalidar cache de tareas del usuario
      await this.cacheService.del(`user:${userId}:tasks`);
      
      // Invalidar cache de estadísticas
      await this.cacheService.del(`user:${userId}:stats`);
      
      // También podrías invalidar caches de búsqueda relacionados
      // Esto requeriría un patrón de clave más complejo o un sistema de tags
      
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user cache');
      // No lanzar error, ya que es solo optimización
    }
  }

  private generateTasksCacheKey(userId: string, options: TaskQueryOptions): string {
    const { page = 1, limit = 20, filters, sort, search } = options;
    const params = { page, limit, filters, sort, search };
    const hash = Buffer.from(JSON.stringify(params)).toString('base64');
    return `user:${userId}:tasks:${hash}`;
  }
}