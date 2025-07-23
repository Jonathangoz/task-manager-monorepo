// src/core/domain/interfaces/ITaskService.ts
import { Task, TaskStatus, Priority } from '@prisma/client';
import { TaskFilters, SortOptions, ApiResponse, PaginationMeta } from '@/utils/constants';
import { TaskWithCategory, CreateTaskData, UpdateTaskData } from './ITaskRepository';

export interface TaskListResponse {
  tasks: TaskWithCategory[];
  meta: PaginationMeta;
}

export interface TaskStatsResponse {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  tasksByPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  tasksByStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    onHold: number;
  };
  completionRate: number;
  avgCompletionTime?: number;
}

export interface ProductivityStats {
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
  tasksCompletedThisMonth: number;
  streakDays: number;
  mostProductiveDay: string;
  avgTasksPerDay: number;
  peakHours: number[];
}

export interface ITaskService {
  createTask(userId: string, data: Omit<CreateTaskData, 'userId'>): Promise<Task>;
  
  getTaskById(taskId: string, userId: string): Promise<TaskWithCategory>;
  
  getUserTasks(
    userId: string,
    filters?: TaskFilters,
    sort?: SortOptions,
    page?: number,
    limit?: number
  ): Promise<TaskListResponse>;
  
  updateTask(taskId: string, userId: string, data: UpdateTaskData): Promise<Task>;
  
  updateTaskStatus(
    taskId: string, 
    userId: string, 
    status: TaskStatus
  ): Promise<Task>;
  
  updateTaskPriority(
    taskId: string,
    userId: string,
    priority: Priority
  ): Promise<Task>;
  
  deleteTask(taskId: string, userId: string): Promise<void>;
  
  getTasksByCategory(
    categoryId: string,
    userId: string,
    page?: number,
    limit?: number
  ): Promise<TaskListResponse>;
  
  searchTasks(
    userId: string,
    query: string,
    filters?: TaskFilters,
    page?: number,
    limit?: number
  ): Promise<TaskListResponse>;
  
  getOverdueTasks(userId: string): Promise<TaskWithCategory[]>;
  
  getUserStats(userId: string): Promise<TaskStatsResponse>;
  
  getProductivityStats(userId: string): Promise<ProductivityStats>;
  
  bulkUpdateStatus(
    taskIds: string[],
    userId: string,
    status: TaskStatus
  ): Promise<void>;
  
  bulkDeleteTasks(taskIds: string[], userId: string): Promise<void>;
  
  markTaskAsCompleted(taskId: string, userId: string): Promise<Task>;
  
  duplicateTask(taskId: string, userId: string): Promise<Task>;
}