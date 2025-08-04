// ==============================================
// src/core/domain/types/TaskDomain.ts
// Tipos de dominio puros - Independientes de implementación
// ==============================================

import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  PaginationMeta,
} from '@/utils/constants';

// ==============================================
// TIPOS DE DOMINIO (INDEPENDIENTES DE PRISMA)
// ==============================================

export type TaskStatus = keyof typeof TASK_STATUSES;
export type TaskPriority = keyof typeof TASK_PRIORITIES;

// Valores literales para runtime validation
export const TaskStatusValues = Object.keys(TASK_STATUSES) as TaskStatus[];
export const TaskPriorityValues = Object.keys(
  TASK_PRIORITIES,
) as TaskPriority[];

// ==============================================
// INTERFACES DE DOMINIO
// ==============================================

export interface DomainTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  categoryId?: string;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
  attachments: string[];
}

export interface DomainCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
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
  priority?: TaskPriority;
  dueDate?: Date;
  categoryId?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  attachments?: string[];
}

export interface TaskWithCategory extends DomainTask {
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

// ==============================================
// VALIDADORES DE DOMINIO
// ==============================================

export const isValidTaskStatus = (status: string): status is TaskStatus => {
  return TaskStatusValues.includes(status as TaskStatus);
};

export const isValidTaskPriority = (
  priority: string,
): priority is TaskPriority => {
  return TaskPriorityValues.includes(priority as TaskPriority);
};

export const validateTaskData = (data: CreateTaskData): string[] => {
  const errors: string[] = [];

  if (!data.title?.trim()) {
    errors.push('Title is required');
  }

  if (data.status && !isValidTaskStatus(data.status)) {
    errors.push('Invalid task status');
  }

  if (data.priority && !isValidTaskPriority(data.priority)) {
    errors.push('Invalid task priority');
  }

  if (data.dueDate && data.dueDate < new Date()) {
    errors.push('Due date cannot be in the past');
  }

  return errors;
};

// ==============================================
// MAPPERS: PRISMA ↔ DOMAIN
// ==============================================

import {
  Task as PrismaTask,
  TaskStatus as PrismaTaskStatus,
  Priority as PrismaPriority,
  Category as PrismaCategory,
} from '@prisma/client';

// Mappers para Status
export const toPrismaStatus = (status: TaskStatus): PrismaTaskStatus => {
  const statusMap: Record<TaskStatus, PrismaTaskStatus> = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    ON_HOLD: 'ON_HOLD',
  };
  return statusMap[status];
};

export const fromPrismaStatus = (status: PrismaTaskStatus): TaskStatus => {
  const statusMap: Record<PrismaTaskStatus, TaskStatus> = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    ON_HOLD: 'ON_HOLD',
  };
  return statusMap[status];
};

// Mappers para Priority
export const toPrismaPriority = (priority: TaskPriority): PrismaPriority => {
  const priorityMap: Record<TaskPriority, PrismaPriority> = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  };
  return priorityMap[priority];
};

export const fromPrismaPriority = (priority: PrismaPriority): TaskPriority => {
  const priorityMap: Record<PrismaPriority, TaskPriority> = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  };
  return priorityMap[priority];
};

// Mapper completo: Prisma → Domain
export const fromPrismaTask = (prismaTask: PrismaTask): DomainTask => ({
  id: prismaTask.id,
  title: prismaTask.title,
  description: prismaTask.description || undefined,
  status: fromPrismaStatus(prismaTask.status),
  priority: fromPrismaPriority(prismaTask.priority),
  dueDate: prismaTask.dueDate || undefined,
  completedAt: prismaTask.completedAt || undefined,
  createdAt: prismaTask.createdAt,
  updatedAt: prismaTask.updatedAt,
  userId: prismaTask.userId,
  categoryId: prismaTask.categoryId || undefined,
  tags: prismaTask.tags,
  estimatedHours: prismaTask.estimatedHours || undefined,
  actualHours: prismaTask.actualHours || undefined,
  attachments: prismaTask.attachments,
});

// Mapper: Domain → Prisma (para creates/updates)
export const toPrismaTaskCreate = (domainData: CreateTaskData) => ({
  title: domainData.title,
  description: domainData.description,
  status: domainData.status
    ? toPrismaStatus(domainData.status)
    : ('PENDING' as PrismaTaskStatus),
  priority: domainData.priority
    ? toPrismaPriority(domainData.priority)
    : ('MEDIUM' as PrismaPriority),
  dueDate: domainData.dueDate,
  userId: domainData.userId,
  categoryId: domainData.categoryId,
  tags: domainData.tags || [],
  estimatedHours: domainData.estimatedHours,
  attachments: domainData.attachments || [],
});

export const toPrismaTaskUpdate = (domainData: UpdateTaskData) => ({
  ...(domainData.title && { title: domainData.title }),
  ...(domainData.description !== undefined && {
    description: domainData.description,
  }),
  ...(domainData.status && { status: toPrismaStatus(domainData.status) }),
  ...(domainData.priority && {
    priority: toPrismaPriority(domainData.priority),
  }),
  ...(domainData.dueDate !== undefined && { dueDate: domainData.dueDate }),
  ...(domainData.categoryId !== undefined && {
    categoryId: domainData.categoryId,
  }),
  ...(domainData.tags !== undefined && { tags: domainData.tags }),
  ...(domainData.estimatedHours !== undefined && {
    estimatedHours: domainData.estimatedHours,
  }),
  ...(domainData.actualHours !== undefined && {
    actualHours: domainData.actualHours,
  }),
  ...(domainData.attachments !== undefined && {
    attachments: domainData.attachments,
  }),
});

// Mapper para Category
export const fromPrismaCategory = (
  prismaCategory: PrismaCategory,
): DomainCategory => ({
  id: prismaCategory.id,
  name: prismaCategory.name,
  description: prismaCategory.description || undefined,
  color: prismaCategory.color || undefined,
  icon: prismaCategory.icon || undefined,
  isActive: prismaCategory.isActive,
  createdAt: prismaCategory.createdAt,
  updatedAt: prismaCategory.updatedAt,
  userId: prismaCategory.userId,
});

// ==============================================
// FACTORY FUNCTIONS
// ==============================================

export const createTaskDefaults = (
  partial: Partial<CreateTaskData>,
): CreateTaskData => ({
  title: '',
  status: 'PENDING',
  priority: 'MEDIUM',
  tags: [],
  attachments: [],
  ...partial,
  userId: partial.userId || '', // Required field
});

export const createTaskWithCategory = (
  task: DomainTask,
  category?: DomainCategory,
): TaskWithCategory => ({
  ...task,
  category: category
    ? {
        id: category.id,
        name: category.name,
        color: category.color || '#6366f1',
        icon: category.icon || 'folder',
      }
    : undefined,
});

// ==============================================
// BUSINESS RULES
// ==============================================

export const canCompleteTask = (task: DomainTask): boolean => {
  return task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
};

export const canCancelTask = (task: DomainTask): boolean => {
  return task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
};

export const isTaskOverdue = (task: DomainTask): boolean => {
  if (!task.dueDate || task.status === 'COMPLETED') return false;
  return new Date() > task.dueDate;
};

export const getTaskStatusPriority = (status: TaskStatus): number => {
  const priorities = {
    COMPLETED: 0,
    CANCELLED: 1,
    PENDING: 2,
    ON_HOLD: 3,
    IN_PROGRESS: 4,
  };
  return priorities[status];
};

// ==============================================
// EXPORT TYPES FOR OTHER MODULES
// ==============================================

export type {
  TaskFilters,
  SortOptions,
  PaginationMeta,
} from '@/utils/constants';
