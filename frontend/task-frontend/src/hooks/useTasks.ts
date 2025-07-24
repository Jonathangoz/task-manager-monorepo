// src/hooks/useTasks.ts
import { useState, useCallback, useEffect } from 'react';
import { taskApi } from '@/lib/api/taskApi';
import { 
  Task, 
  CreateTaskData, 
  UpdateTaskData,
  TaskFilters,
  TaskStats,
  Category,
  CreateCategoryData,
  PaginationMeta
} from '@/types/task.types';
import { 
  TASK_STATUSES,
  TASK_PRIORITIES,
  SUCCESS_MESSAGES,
  PAGINATION_CONFIG,
  SORT_FIELDS,
  SORT_ORDERS
} from '@/lib/constants';
import { toast } from 'sonner';

interface TasksState {
  tasks: Task[];
  categories: Category[];
  stats: TaskStats | null;
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
}

interface UseTasksReturn extends TasksState {
  // Task operations
  fetchTasks: (filters?: TaskFilters, page?: number, limit?: number) => Promise<void>;
  createTask: (data: CreateTaskData) => Promise<boolean>;
  updateTask: (id: string, data: UpdateTaskData) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  getTask: (id: string) => Promise<Task | null>;
  updateTaskStatus: (id: string, status: keyof typeof TASK_STATUSES) => Promise<boolean>;
  
  // Category operations
  fetchCategories: () => Promise<void>;
  createCategory: (data: CreateCategoryData) => Promise<boolean>;
  updateCategory: (id: string, data: Partial<CreateCategoryData>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  
  // Stats operations
  fetchStats: () => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  resetCurrentTask: () => void;
  refreshData: () => Promise<void>;
}

const INITIAL_STATE: TasksState = {
  tasks: [],
  categories: [],
  stats: null,
  currentTask: null,
  isLoading: false,
  error: null,
  pagination: null,
};

export const useTasks = (): UseTasksReturn => {
  const [state, setState] = useState<TasksState>(INITIAL_STATE);

  // Helper para actualizar estado
  const updateState = useCallback((updates: Partial<TasksState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch Tasks
  const fetchTasks = useCallback(async (
    filters?: TaskFilters, 
    page = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });

      const queryParams = {
        page,
        limit,
        sortBy: SORT_FIELDS.CREATED_AT,
        sortOrder: SORT_ORDERS.DESC,
        ...filters,
      };

      const response = await taskApi.getTasks(queryParams);

      if (response.success && response.data) {
        updateState({
          tasks: response.data,
          pagination: response.meta?.pagination || null,
        });
      } else {
        throw new Error(response.message || 'Failed to fetch tasks');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch tasks';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState]);

  // Create Task
  const createTask = useCallback(async (data: CreateTaskData): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.createTask(data);

      if (response.success && response.data) {
        updateState({
          tasks: [response.data, ...state.tasks],
        });
        toast.success(SUCCESS_MESSAGES.TASK_CREATED);
        return true;
      }

      throw new Error(response.message || 'Failed to create task');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create task';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.tasks]);

  // Update Task
  const updateTask = useCallback(async (id: string, data: UpdateTaskData): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.updateTask(id, data);

      if (response.success && response.data) {
        updateState({
          tasks: state.tasks.map(task => 
            task.id === id ? response.data! : task
          ),
          currentTask: state.currentTask?.id === id ? response.data : state.currentTask,
        });
        toast.success(SUCCESS_MESSAGES.TASK_UPDATED);
        return true;
      }

      throw new Error(response.message || 'Failed to update task');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update task';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.tasks, state.currentTask]);

  // Delete Task
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.deleteTask(id);

      if (response.success) {
        updateState({
          tasks: state.tasks.filter(task => task.id !== id),
          currentTask: state.currentTask?.id === id ? null : state.currentTask,
        });
        toast.success(SUCCESS_MESSAGES.TASK_DELETED);
        return true;
      }

      throw new Error(response.message || 'Failed to delete task');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete task';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.tasks, state.currentTask]);

  // Get Single Task
  const getTask = useCallback(async (id: string): Promise<Task | null> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.getTask(id);

      if (response.success && response.data) {
        updateState({ currentTask: response.data });
        return response.data;
      }

      throw new Error(response.message || 'Failed to fetch task');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch task';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return null;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState]);

  // Update Task Status
  const updateTaskStatus = useCallback(async (
    id: string, 
    status: keyof typeof TASK_STATUSES
  ): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.updateTaskStatus(id, status);

      if (response.success && response.data) {
        updateState({
          tasks: state.tasks.map(task => 
            task.id === id ? { ...task, status } : task
          ),
          currentTask: state.currentTask?.id === id 
            ? { ...state.currentTask, status } 
            : state.currentTask,
        });
        
        if (status === TASK_STATUSES.COMPLETED) {
          toast.success(SUCCESS_MESSAGES.TASK_COMPLETED);
        } else {
          toast.success(SUCCESS_MESSAGES.TASK_STATUS_UPDATED);
        }
        return true;
      }

      throw new Error(response.message || 'Failed to update task status');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update task status';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.tasks, state.currentTask]);

  // Fetch Categories
  const fetchCategories = useCallback(async (): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.getCategories();

      if (response.success && response.data) {
        updateState({ categories: response.data });
      } else {
        throw new Error(response.message || 'Failed to fetch categories');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch categories';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState]);

  // Create Category
  const createCategory = useCallback(async (data: CreateCategoryData): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.createCategory(data);

      if (response.success && response.data) {
        updateState({
          categories: [...state.categories, response.data],
        });
        toast.success(SUCCESS_MESSAGES.CATEGORY_CREATED);
        return true;
      }

      throw new Error(response.message || 'Failed to create category');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create category';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.categories]);

  // Update Category
  const updateCategory = useCallback(async (
    id: string, 
    data: Partial<CreateCategoryData>
  ): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.updateCategory(id, data);

      if (response.success && response.data) {
        updateState({
          categories: state.categories.map(category => 
            category.id === id ? response.data! : category
          ),
        });
        toast.success(SUCCESS_MESSAGES.CATEGORY_UPDATED);
        return true;
      }

      throw new Error(response.message || 'Failed to update category');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update category';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.categories]);

  // Delete Category
  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.deleteCategory(id);

      if (response.success) {
        updateState({
          categories: state.categories.filter(category => category.id !== id),
        });
        toast.success(SUCCESS_MESSAGES.CATEGORY_DELETED);
        return true;
      }

      throw new Error(response.message || 'Failed to delete category');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete category';
      updateState({ error: errorMessage });
      toast.error(errorMessage);
      return false;
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState, state.categories]);

  // Fetch Stats
  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await taskApi.getStats();

      if (response.success && response.data) {
        updateState({ stats: response.data });
      } else {
        throw new Error(response.message || 'Failed to fetch stats');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch stats';
      updateState({ error: errorMessage });
      // No mostrar toast para stats error (menos crítico)
    } finally {
      updateState({ isLoading: false });
    }
  }, [updateState]);

  // Clear Error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Reset Current Task
  const resetCurrentTask = useCallback(() => {
    updateState({ currentTask: null });
  }, [updateState]);

  // Refresh All Data
  const refreshData = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchTasks(),
      fetchCategories(),
      fetchStats(),
    ]);
  }, [fetchTasks, fetchCategories, fetchStats]);

  // Load initial data
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    ...state,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    getTask,
    updateTaskStatus,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchStats,
    clearError,
    resetCurrentTask,
    refreshData,
  };
};