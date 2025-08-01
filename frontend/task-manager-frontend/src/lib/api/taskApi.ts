// src/lib/api/taskApi.ts
import { AxiosResponse } from 'axios';
import { taskApiClient } from './apiClient';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  SORT_FIELDS,
  SORT_ORDERS,
  PAGINATION_CONFIG,
  CACHE_TTL,
} from '@/lib/constants';

// Types
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: keyof typeof TASK_STATUSES;
  priority: keyof typeof TASK_PRIORITIES;
  dueDate?: string;
  categoryId?: string;
  category?: Category;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: keyof typeof TASK_PRIORITIES;
  dueDate?: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
}

interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: keyof typeof TASK_STATUSES;
  priority?: keyof typeof TASK_PRIORITIES;
  dueDate?: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
}

interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface TaskFilters {
  status?: string | string[];
  priority?: string | string[];
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
  hasDueDate?: boolean;
  tags?: string | string[];
  search?: string;
}

interface SortOptions {
  field: keyof typeof SORT_FIELDS;
  order: keyof typeof SORT_ORDERS;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
}

interface TaskQueryParams extends PaginationOptions {
  filters?: TaskFilters;
  sort?: SortOptions;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  onHold: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completionRate: number;
  averageCompletionTime: number;
}

interface CategoryStats {
  total: number;
  withTasks: number;
  mostUsed: {
    id: string;
    name: string;
    taskCount: number;
  } | null;
}

class TaskApi {
  /**
   * Get paginated tasks with filters and sorting
   */
  async getTasks(
    params: TaskQueryParams = {},
  ): Promise<{ tasks: Task[]; meta: PaginationMeta }> {
    try {
      const queryParams = this.buildTaskQueryParams(params);

      const response: AxiosResponse<
        ApiResponse<{ tasks: Task[]; meta: PaginationMeta }>
      > = await taskApiClient.get('/tasks', { params: queryParams });

      if (response.data.success && response.data.data) {
        // Cache tasks for quick access
        this.cacheTasks(response.data.data.tasks);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to fetch tasks');
    } catch (error) {
      console.error('[TaskApi] Get tasks error:', error);
      throw error;
    }
  }

  /**
   * Get single task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    try {
      // Check cache first
      const cached = this.getCachedTask(taskId);
      if (cached) return cached;

      const response: AxiosResponse<ApiResponse<Task>> =
        await taskApiClient.get(`/tasks/${taskId}`);

      if (response.data.success && response.data.data) {
        // Cache individual task
        this.cacheTask(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Task not found');
    } catch (error) {
      console.error('[TaskApi] Get task error:', error);
      throw error;
    }
  }

  /**
   * Create new task
   */
  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    try {
      const response: AxiosResponse<ApiResponse<Task>> =
        await taskApiClient.post('/tasks', taskData);

      if (response.data.success && response.data.data) {
        // Cache new task
        this.cacheTask(response.data.data);
        // Invalidate tasks cache
        this.invalidateTasksCache();
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to create task');
    } catch (error) {
      console.error('[TaskApi] Create task error:', error);
      throw error;
    }
  }

  /**
   * Update existing task
   */
  async updateTask(taskId: string, taskData: UpdateTaskRequest): Promise<Task> {
    try {
      const response: AxiosResponse<ApiResponse<Task>> =
        await taskApiClient.put(`/tasks/${taskId}`, taskData);

      if (response.data.success && response.data.data) {
        // Update cache
        this.cacheTask(response.data.data);
        this.invalidateTasksCache();
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to update task');
    } catch (error) {
      console.error('[TaskApi] Update task error:', error);
      throw error;
    }
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const response: AxiosResponse<ApiResponse> = await taskApiClient.delete(
        `/tasks/${taskId}`,
      );

      if (response.data.success) {
        // Remove from cache
        this.removeCachedTask(taskId);
        this.invalidateTasksCache();
        return;
      }

      throw new Error(response.data.message || 'Failed to delete task');
    } catch (error) {
      console.error('[TaskApi] Delete task error:', error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: keyof typeof TASK_STATUSES,
  ): Promise<Task> {
    return this.updateTask(taskId, { status });
  }

  /**
   * Mark task as completed
   */
  async completeTask(taskId: string): Promise<Task> {
    return this.updateTaskStatus(taskId, 'COMPLETED');
  }

  /**
   * Get task statistics
   */
  async getTaskStats(): Promise<TaskStats> {
    try {
      // Check cache first
      const cached = this.getCachedStats();
      if (cached) return cached;

      const response: AxiosResponse<ApiResponse<TaskStats>> =
        await taskApiClient.get('/tasks/stats');

      if (response.data.success && response.data.data) {
        // Cache stats
        this.cacheStats(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to fetch stats');
    } catch (error) {
      console.error('[TaskApi] Get stats error:', error);
      throw error;
    }
  }

  /**
   * Search tasks
   */
  async searchTasks(query: string, filters?: TaskFilters): Promise<Task[]> {
    try {
      const params = {
        search: query,
        ...filters,
      };

      const response: AxiosResponse<ApiResponse<Task[]>> =
        await taskApiClient.get('/tasks/search', { params });

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(response.data.message || 'Search failed');
    } catch (error) {
      console.error('[TaskApi] Search tasks error:', error);
      throw error;
    }
  }

  // ===== CATEGORY METHODS =====

  /**
   * Get all categories for current user
   */
  async getCategories(): Promise<Category[]> {
    try {
      // Check cache first
      const cached = this.getCachedCategories();
      if (cached) return cached;

      const response: AxiosResponse<ApiResponse<Category[]>> =
        await taskApiClient.get('/categories');

      if (response.data.success && response.data.data) {
        // Cache categories
        this.cacheCategories(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to fetch categories');
    } catch (error) {
      console.error('[TaskApi] Get categories error:', error);
      throw error;
    }
  }

  /**
   * Get single category by ID
   */
  async getCategory(categoryId: string): Promise<Category> {
    try {
      const response: AxiosResponse<ApiResponse<Category>> =
        await taskApiClient.get(`/categories/${categoryId}`);

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(response.data.message || 'Category not found');
    } catch (error) {
      console.error('[TaskApi] Get category error:', error);
      throw error;
    }
  }

  /**
   * Create new category
   */
  async createCategory(categoryData: CreateCategoryRequest): Promise<Category> {
    try {
      const response: AxiosResponse<ApiResponse<Category>> =
        await taskApiClient.post('/categories', categoryData);

      if (response.data.success && response.data.data) {
        // Invalidate categories cache
        this.invalidateCategoriesCache();
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to create category');
    } catch (error) {
      console.error('[TaskApi] Create category error:', error);
      throw error;
    }
  }

  /**
   * Update existing category
   */
  async updateCategory(
    categoryId: string,
    categoryData: UpdateCategoryRequest,
  ): Promise<Category> {
    try {
      const response: AxiosResponse<ApiResponse<Category>> =
        await taskApiClient.put(`/categories/${categoryId}`, categoryData);

      if (response.data.success && response.data.data) {
        // Invalidate cache
        this.invalidateCategoriesCache();
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to update category');
    } catch (error) {
      console.error('[TaskApi] Update category error:', error);
      throw error;
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const response: AxiosResponse<ApiResponse> = await taskApiClient.delete(
        `/categories/${categoryId}`,
      );

      if (response.data.success) {
        // Invalidate cache
        this.invalidateCategoriesCache();
        this.invalidateTasksCache(); // Tasks might have been affected
        return;
      }

      throw new Error(response.data.message || 'Failed to delete category');
    } catch (error) {
      console.error('[TaskApi] Delete category error:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<CategoryStats> {
    try {
      const response: AxiosResponse<ApiResponse<CategoryStats>> =
        await taskApiClient.get('/categories/stats');

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(
        response.data.message || 'Failed to fetch category stats',
      );
    } catch (error) {
      console.error('[TaskApi] Get category stats error:', error);
      throw error;
    }
  }

  // ===== PRIVATE CACHE METHODS =====

  private buildTaskQueryParams(params: TaskQueryParams): Record<string, any> {
    const queryParams: Record<string, any> = {};

    // Pagination
    queryParams.page = params.page || PAGINATION_CONFIG.DEFAULT_PAGE;
    queryParams.limit = Math.min(
      params.limit || PAGINATION_CONFIG.DEFAULT_LIMIT,
      PAGINATION_CONFIG.MAX_LIMIT,
    );

    // Sorting
    if (params.sort) {
      queryParams.sortBy = params.sort.field;
      queryParams.sortOrder = params.sort.order;
    }

    // Filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams[key] = Array.isArray(value) ? value.join(',') : value;
        }
      });
    }

    return queryParams;
  }

  private cacheTasks(tasks: Task[]): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheData = {
        data: tasks,
        timestamp: Date.now(),
      };
      localStorage.setItem('tasks_cache', JSON.stringify(cacheData));

      // Cache individual tasks
      tasks.forEach((task) => this.cacheTask(task));
    } catch (error) {
      console.warn('[TaskApi] Failed to cache tasks:', error);
    }
  }

  private cacheTask(task: Task): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheData = {
        data: task,
        timestamp: Date.now(),
      };
      localStorage.setItem(`task_${task.id}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[TaskApi] Failed to cache task:', error);
    }
  }

  private getCachedTask(taskId: string): Task | null {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(`task_${taskId}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_TTL.TASK_DETAIL * 1000;

      return isExpired ? null : data;
    } catch {
      return null;
    }
  }

  private removeCachedTask(taskId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(`task_${taskId}`);
    } catch (error) {
      console.warn('[TaskApi] Failed to remove cached task:', error);
    }
  }

  private cacheCategories(categories: Category[]): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheData = {
        data: categories,
        timestamp: Date.now(),
      };
      localStorage.setItem('categories_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[TaskApi] Failed to cache categories:', error);
    }
  }

  private getCachedCategories(): Category[] | null {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem('categories_cache');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired =
        Date.now() - timestamp > CACHE_TTL.USER_CATEGORIES * 1000;

      return isExpired ? null : data;
    } catch {
      return null;
    }
  }

  private cacheStats(stats: TaskStats): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheData = {
        data: stats,
        timestamp: Date.now(),
      };
      localStorage.setItem('task_stats_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[TaskApi] Failed to cache stats:', error);
    }
  }

  private getCachedStats(): TaskStats | null {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem('task_stats_cache');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_TTL.USER_STATS * 1000;

      return isExpired ? null : data;
    } catch {
      return null;
    }
  }

  private invalidateTasksCache(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('tasks_cache');
      localStorage.removeItem('task_stats_cache');
    } catch (error) {
      console.warn('[TaskApi] Failed to invalidate tasks cache:', error);
    }
  }

  private invalidateCategoriesCache(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('categories_cache');
    } catch (error) {
      console.warn('[TaskApi] Failed to invalidate categories cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (
          key.startsWith('task_') ||
          key.startsWith('categories_') ||
          key.includes('_cache')
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[TaskApi] Failed to clear cache:', error);
    }
  }
}

// Export singleton instance
export const taskApi = new TaskApi();
export default taskApi;

// Export types for use in components
export type {
  Task,
  Category,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  TaskFilters,
  SortOptions,
  PaginationOptions,
  TaskQueryParams,
  TaskStats,
  CategoryStats,
  PaginationMeta,
};
