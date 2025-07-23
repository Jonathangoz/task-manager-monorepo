// src/core/domain/interfaces/ITaskRepository.ts
import { Task, TaskStatus, Priority } from '@prisma/client';
import { TaskFilters, SortOptions, PaginationMeta } from '@/utils/constants';

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: Date;
  userId: string;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  attachments?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: Date;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  attachments?: string[];
}

export interface TaskWithCategory extends Task {
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}

export interface TaskQueryResult {
  tasks: TaskWithCategory[];
  meta: PaginationMeta;
}

export interface ITaskRepository {
  create(data: CreateTaskData): Promise<Task>;
  
  findById(id: string): Promise<TaskWithCategory | null>;
  
  findByUserId(
    userId: string,
    filters?: TaskFilters,
    sort?: SortOptions,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
  
  findByCategoryId(
    categoryId: string,
    userId: string,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
  
  update(id: string, data: UpdateTaskData): Promise<Task>;
  
  updateStatus(id: string, status: TaskStatus, completedAt?: Date): Promise<Task>;
  
  updatePriority(id: string, priority: Priority): Promise<Task>;
  
  delete(id: string): Promise<void>;
  
  countByUserId(userId: string, filters?: TaskFilters): Promise<number>;
  
  findOverdueTasks(userId: string): Promise<TaskWithCategory[]>;
  
  findByIds(ids: string[]): Promise<TaskWithCategory[]>;
  
  bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void>;
  
  bulkDelete(ids: string[]): Promise<void>;
  
  search(
    userId: string,
    query: string,
    filters?: TaskFilters,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
}