'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { taskApi } from '@/lib/api/taskApi';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Types based on constants
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  category?: Category;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
  hasDueDate?: boolean;
  tags?: string | string[];
  search?: string;
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
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface TaskState {
  // Tasks
  tasks: Task[];
  currentTask: Task | null;
  taskStats: TaskStats | null;
  
  // Categories
  categories: Category[];
  currentCategory: Category | null;
  
  // UI State
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Filters & Pagination
  filters: TaskFilters;
  pagination: PaginationMeta | null;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  
  // Error handling
  error: string | null;
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
}

interface UpdateTaskData extends Partial<CreateTaskData> {
  status?: TaskStatus;
}

interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface TaskContextType {
  // State
  state: TaskState;
  
  // Task Actions
  loadTasks: (page?: number, filters?: TaskFilters) => Promise<void>;
  createTask: (data: CreateTaskData) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskData) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  updateTaskPriority: (id: string, priority: TaskPriority) => Promise<void>;
  
  // Category Actions
  loadCategories: () => Promise<void>;
  createCategory: (data: CreateCategoryData) => Promise<Category>;
  updateCategory: (id: string, data: Partial<CreateCategoryData>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Stats Actions
  loadStats: () => Promise<void>;
  
  // Filter & Sort Actions
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: string, order: 'asc' | 'desc') => void;
  
  // UI Actions
  setCurrentTask: (task: Task | null) => void;
  setCurrentCategory: (category: Category | null) => void;
  clearError: () => void;
}

// Action types
type TaskAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CREATING'; payload: boolean }
  | { type: 'SET_UPDATING'; payload: boolean }
  | { type: 'SET_DELETING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TASKS'; payload: { tasks: Task[]; pagination: PaginationMeta } }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'REMOVE_TASK'; payload: string }
  | { type: 'SET_CURRENT_TASK'; payload: Task | null }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'REMOVE_CATEGORY'; payload: string }
  | { type: 'SET_CURRENT_CATEGORY'; payload: Category | null }
  | { type: 'SET_STATS'; payload: TaskStats }
  | { type: 'SET_FILTERS'; payload: TaskFilters }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_SORTING'; payload: { field: string; order: 'asc' | 'desc' } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: TaskState = {
  tasks: [],
  currentTask: null,
  taskStats: null,
  categories: [],
  currentCategory: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  filters: {},
  pagination: null,
  sortField: 'createdAt',
  sortOrder: 'desc',
  error: null,
};

// Reducer
const taskReducer = (state: TaskState, action: TaskAction): TaskState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_CREATING':
      return { ...state, isCreating: action.payload };
    
    case 'SET_UPDATING':
      return { ...state, isUpdating: action.payload };
    
    case 'SET_DELETING':
      return { ...state, isDeleting: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_TASKS':
      return {
        ...state,
        tasks: action.payload.tasks,
        pagination: action.payload.pagination,
        isLoading: false,
      };
    
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [action.payload, ...state.tasks],
        isCreating: false,
      };
    
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task => 
          task.id === action.payload.id ? action.payload : task
        ),
        currentTask: state.currentTask?.id === action.payload.id ? action.payload : state.currentTask,
        isUpdating: false,
      };
    
    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
        currentTask: state.currentTask?.id === action.payload ? null : state.currentTask,
        isDeleting: false,
      };
    
    case 'SET_CURRENT_TASK':
      return { ...state, currentTask: action.payload };
    
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    
    case 'ADD_CATEGORY':
      return {
        ...state,
        categories: [...state.categories, action.payload],
        isCreating: false,
      };
    
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map(cat => 
          cat.id === action.payload.id ? action.payload : cat
        ),
        currentCategory: state.currentCategory?.id === action.payload.id ? action.payload : state.currentCategory,
        isUpdating: false,
      };
    
    case 'REMOVE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter(cat => cat.id !== action.payload),
        currentCategory: state.currentCategory?.id === action.payload ? null : state.currentCategory,
        isDeleting: false,
      };
    
    case 'SET_CURRENT_CATEGORY':
      return { ...state, currentCategory: action.payload };
    
    case 'SET_STATS':
      return { ...state, taskStats: action.payload };
    
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case 'CLEAR_FILTERS':
      return { ...state, filters: {} };
    
    case 'SET_SORTING':
      return {
        ...state,
        sortField: action.payload.field,
        sortOrder: action.payload.order,
      };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
};

// Create context
const TaskContext = createContext<TaskContextType | undefined>(undefined);

// Provider component
export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const { state: authState } = useAuth();

  // Reset state when user logs out
  useEffect(() => {
    if (!authState.isAuthenticated) {
      dispatch({ type: 'RESET_STATE' });
    }
  }, [authState.isAuthenticated]);

  // Load initial data when authenticated
  useEffect(() => {
    if (authState.isAuthenticated && state.categories.length === 0) {
      loadCategories();
      loadStats();
    }
  }, [authState.isAuthenticated]);

  // Helper function to handle errors
  const handleError = (error: any, defaultMessage: string) => {
    const errorMessage = error.response?.data?.message || defaultMessage;
    dispatch({ type: 'SET_ERROR', payload: errorMessage });
    toast.error(errorMessage);
    throw error;
  };

  // Task Actions
  const loadTasks = async (page = 1, filters?: TaskFilters) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const queryFilters = filters || state.filters;
      const response = await taskApi.getTasks({
        page,
        limit: parseInt(process.env.NEXT_PUBLIC_PAGINATION_DEFAULT_LIMIT || '20'),
        ...queryFilters,
        sortBy: state.sortField,
        sortOrder: state.sortOrder,
      });

      dispatch({
        type: 'SET_TASKS',
        payload: {
          tasks: response.data,
          pagination: response.meta.pagination,
        },
      });
    } catch (error: any) {
      handleError(error, 'Error al cargar las tareas');
    }
  };

  const createTask = async (data: CreateTaskData): Promise<Task> => {
    try {
      dispatch({ type: 'SET_CREATING', payload: true });
      
      const task = await taskApi.createTask(data);
      dispatch({ type: 'ADD_TASK', payload: task });
      
      toast.success('Tarea creada exitosamente');
      
      // Reload stats
      loadStats();
      
      return task;
    } catch (error: any) {
      dispatch({ type: 'SET_CREATING', payload: false });
      handleError(error, 'Error al crear la tarea');
    }
  };

  const updateTask = async (id: string, data: UpdateTaskData): Promise<Task> => {
    try {
      dispatch({ type: 'SET_UPDATING', payload: true });
      
      const task = await taskApi.updateTask(id, data);
      dispatch({ type: 'UPDATE_TASK', payload: task });
      
      toast.success('Tarea actualizada exitosamente');
      
      // Reload stats if status changed
      if (data.status) {
        loadStats();
      }
      
      return task;
    } catch (error: any) {
      dispatch({ type: 'SET_UPDATING', payload: false });
      handleError(error, 'Error al actualizar la tarea');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      dispatch({ type: 'SET_DELETING', payload: true });
      
      await taskApi.deleteTask(id);
      dispatch({ type: 'REMOVE_TASK', payload: id });
      
      toast.success('Tarea eliminada exitosamente');
      
      // Reload stats
      loadStats();
    } catch (error: any) {
      dispatch({ type: 'SET_DELETING', payload: false });
      handleError(error, 'Error al eliminar la tarea');
    }
  };

  const getTask = async (id: string): Promise<Task> => {
    try {
      const task = await taskApi.getTask(id);
      dispatch({ type: 'SET_CURRENT_TASK', payload: task });
      return task;
    } catch (error: any) {
      handleError(error, 'Error al obtener la tarea');
    }
  };

  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    try {
      const task = await taskApi.updateTaskStatus(id, status);
      dispatch({ type: 'UPDATE_TASK', payload: task });
      
      const statusMessages = {
        PENDING: 'Tarea marcada como pendiente',
        IN_PROGRESS: 'Tarea en progreso',
        COMPLETED: 'Tarea completada',
        CANCELLED: 'Tarea cancelada',
        ON_HOLD: 'Tarea pausada',
      };
      
      toast.success(statusMessages[status]);
      loadStats();
    } catch (error: any) {
      handleError(error, 'Error al actualizar el estado de la tarea');
    }
  };

  const updateTaskPriority = async (id: string, priority: TaskPriority) => {
    try {
      const task = await taskApi.updateTaskPriority(id, priority);
      dispatch({ type: 'UPDATE_TASK', payload: task });
      
      toast.success('Prioridad actualizada exitosamente');
    } catch (error: any) {
      handleError(error, 'Error al actualizar la prioridad de la tarea');
    }
  };

  // Category Actions
  const loadCategories = async () => {
    try {
      const categories = await taskApi.getCategories();
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
    } catch (error: any) {
      handleError(error, 'Error al cargar las categorías');
    }
  };

  const createCategory = async (data: CreateCategoryData): Promise<Category> => {
    try {
      dispatch({ type: 'SET_CREATING', payload: true });
      
      const category = await taskApi.createCategory(data);
      dispatch({ type: 'ADD_CATEGORY', payload: category });
      
      toast.success('Categoría creada exitosamente');
      
      return category;
    } catch (error: any) {
      dispatch({ type: 'SET_CREATING', payload: false });
      handleError(error, 'Error al crear la categoría');
    }
  };

  const updateCategory = async (id: string, data: Partial<CreateCategoryData>): Promise<Category> => {
    try {
      dispatch({ type: 'SET_UPDATING', payload: true });
      
      const category = await taskApi.updateCategory(id, data);
      dispatch({ type: 'UPDATE_CATEGORY', payload: category });
      
      toast.success('Categoría actualizada exitosamente');
      
      return category;
    } catch (error: any) {
      dispatch({ type: 'SET_UPDATING', payload: false });
      handleError(error, 'Error al actualizar la categoría');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      dispatch({ type: 'SET_DELETING', payload: true });
      
      await taskApi.deleteCategory(id);
      dispatch({ type: 'REMOVE_CATEGORY', payload: id });
      
      toast.success('Categoría eliminada exitosamente');
    } catch (error: any) {
      dispatch({ type: 'SET_DELETING', payload: false });
      handleError(error, 'Error al eliminar la categoría');
    }
  };

  // Stats Actions
  const loadStats = async () => {
    try {
      const stats = await taskApi.getStats();
      dispatch({ type: 'SET_STATS', payload: stats });
    } catch (error: any) {
      console.warn('Error loading stats:', error);
    }
  };

  // Filter & Sort Actions
  const setFilters = (filters: Partial<TaskFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const clearFilters = () => {
    dispatch({ type: 'CLEAR_FILTERS' });
  };

  const setSorting = (field: string, order: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORTING', payload: { field, order } });
  };

  // UI Actions
  const setCurrentTask = (task: Task | null) => {
    dispatch({ type: 'SET_CURRENT_TASK', payload: task });
  };

  const setCurrentCategory = (category: Category | null) => {
    dispatch({ type: 'SET_CURRENT_CATEGORY', payload: category });
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  const contextValue: TaskContextType = {
    state,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTask,
    updateTaskStatus,
    updateTaskPriority,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    loadStats,
    setFilters,
    clearFilters,
    setSorting,
    setCurrentTask,
    setCurrentCategory,
    clearError,
  };

  return <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>;
};

// Hook to use task context
export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

export default TaskContext;