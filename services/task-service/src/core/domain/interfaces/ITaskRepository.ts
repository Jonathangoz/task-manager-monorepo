// src/core/domain/interfaces/ITaskRepository.ts
// Interface del repositorio de tareas

import { z } from 'zod';
import { 
  DomainTask,
  TaskWithCategory,
  CreateTaskData,
  UpdateTaskData,
  TaskQueryResult,
  TaskStatus,
  TaskPriority,
  TaskStatusValues,
  TaskPriorityValues,
  isValidTaskStatus,
  isValidTaskPriority,
  validateTaskData
} from '@/core/types/TaskDomain';
import { 
  TaskFilters, 
  SortOptions, 
  PaginationMeta,
  TASK_CONFIG,
  PAGINATION_CONFIG
} from '@/utils/constants';

// SCHEMAS DE VALIDACIÓN CON ZOD

// Schema para validar CreateTaskData
export const CreateTaskDataSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(TASK_CONFIG.MAX_TITLE_LENGTH, `Title must be less than ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`)
    .trim(),
  
  description: z.string()
    .max(TASK_CONFIG.MAX_DESCRIPTION_LENGTH, `Description must be less than ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`)
    .optional(),
  
  status: z.enum(TaskStatusValues as [string, ...string[]])
    .optional(),
  
  priority: z.enum(TaskPriorityValues as [string, ...string[]])
    .optional(),
  
  dueDate: z.date()
    .min(new Date(Date.now() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60 * 1000), 
         'Due date must be at least 5 minutes in the future')
    .optional(),
  
  userId: z.string()
    .uuid('User ID must be a valid UUID'),
  
  categoryId: z.string()
    .uuid('Category ID must be a valid UUID')
    .optional(),
  
  tags: z.array(z.string().max(TASK_CONFIG.MAX_TAG_LENGTH))
    .max(TASK_CONFIG.MAX_TAGS_COUNT, `Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`)
    .optional(),
  
  estimatedHours: z.number()
    .min(0, 'Estimated hours must be positive')
    .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
    .optional(),
  
  attachments: z.array(z.string().url('Invalid attachment URL'))
    .max(TASK_CONFIG.MAX_ATTACHMENTS_COUNT, `Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`)
    .optional(),
}).strict();

// Schema para validar UpdateTaskData
export const UpdateTaskDataSchema = z.object({
  title: z.string()
    .min(1, 'Title cannot be empty')
    .max(TASK_CONFIG.MAX_TITLE_LENGTH, `Title must be less than ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`)
    .trim()
    .optional(),
  
  description: z.string()
    .max(TASK_CONFIG.MAX_DESCRIPTION_LENGTH, `Description must be less than ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`)
    .nullable()
    .optional(),
  
  status: z.enum(TaskStatusValues as [string, ...string[]])
    .optional(),
  
  priority: z.enum(TaskPriorityValues as [string, ...string[]])
    .optional(),
  
  dueDate: z.date()
    .nullable()
    .optional(),
  
  categoryId: z.string()
    .uuid('Category ID must be a valid UUID')
    .nullable()
    .optional(),
  
  tags: z.array(z.string().max(TASK_CONFIG.MAX_TAG_LENGTH))
    .max(TASK_CONFIG.MAX_TAGS_COUNT, `Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`)
    .optional(),
  
  estimatedHours: z.number()
    .min(0, 'Estimated hours must be positive')
    .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
    .nullable()
    .optional(),
  
  actualHours: z.number()
    .min(0, 'Actual hours must be positive')
    .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Actual hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
    .nullable()
    .optional(),
  
  attachments: z.array(z.string().url('Invalid attachment URL'))
    .max(TASK_CONFIG.MAX_ATTACHMENTS_COUNT, `Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`)
    .optional(),
}).strict();

// Schema para validar parámetros de paginación
export const PaginationParamsSchema = z.object({
  page: z.number()
    .int('Page must be an integer')
    .min(PAGINATION_CONFIG.MIN_LIMIT, `Page must be at least ${PAGINATION_CONFIG.MIN_LIMIT}`)
    .default(PAGINATION_CONFIG.DEFAULT_PAGE),
  
  limit: z.number()
    .int('Limit must be an integer')
    .min(PAGINATION_CONFIG.MIN_LIMIT, `Limit must be at least ${PAGINATION_CONFIG.MIN_LIMIT}`)
    .max(PAGINATION_CONFIG.MAX_LIMIT, `Limit cannot exceed ${PAGINATION_CONFIG.MAX_LIMIT}`)
    .default(PAGINATION_CONFIG.DEFAULT_LIMIT),
});

// Schema para validar TaskFilters
export const TaskFiltersSchema = z.object({
  status: z.union([
    z.enum(TaskStatusValues as [string, ...string[]]),
    z.array(z.enum(TaskStatusValues as [string, ...string[]]))
  ]).optional(),
  
  priority: z.union([
    z.enum(TaskPriorityValues as [string, ...string[]]),
    z.array(z.enum(TaskPriorityValues as [string, ...string[]]))
  ]).optional(),
  
  categoryId: z.string().uuid().optional(),
  
  dueDateFrom: z.string().datetime().optional(),
  
  dueDateTo: z.string().datetime().optional(),
  
  isOverdue: z.boolean().optional(),
  
  hasDueDate: z.boolean().optional(),
  
  tags: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  
  search: z.string().min(1).optional(),
}).strict();

// FUNCIONES DE VALIDACIÓN

/**
 * Validar datos de creación de tarea
 */
export const validateCreateTaskData = (data: unknown): CreateTaskData => {
  try {
    return CreateTaskDataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
};

/**
 * Validar datos de actualización de tarea
 */
export const validateUpdateTaskData = (data: unknown): UpdateTaskData => {
  try {
    return UpdateTaskDataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
};

/**
 * Validar parámetros de paginación
 */
export const validatePaginationParams = (page?: number, limit?: number) => {
  return PaginationParamsSchema.parse({ page, limit });
};

/**
 * Validar filtros de búsqueda
 */
export const validateTaskFilters = (filters: unknown): TaskFilters => {
  try {
    return TaskFiltersSchema.parse(filters);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Invalid filters: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
};

// INTERFACE DEL REPOSITORIO

export interface ITaskRepository {
  /**
   * Crear nueva tarea
   */
  create(data: CreateTaskData): Promise<TaskWithCategory>;
  
  /**
   * Buscar tarea por ID
   */
  findById(id: string): Promise<TaskWithCategory | null>;
  
  /**
   * Buscar tareas por usuario con filtros y paginación
   */
  findByUserId(
    userId: string,
    filters?: TaskFilters,
    sort?: SortOptions,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
  
  /**
   * Buscar tareas por categoría
   */
  findByCategoryId(
    categoryId: string,
    userId: string,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
  
  /**
   * Actualizar tarea completa
   */
  update(id: string, data: UpdateTaskData): Promise<TaskWithCategory>;
  
  /**
   * Actualizar solo el estado de una tarea
   */
  updateStatus(id: string, status: TaskStatus, completedAt?: Date): Promise<TaskWithCategory>;
  
  /**
   * Actualizar solo la prioridad de una tarea
   */
  updatePriority(id: string, priority: TaskPriority): Promise<TaskWithCategory>;
  
  /**
   * Eliminar tarea por ID
   */
  delete(id: string): Promise<void>;
  
  /**
   * Contar tareas por usuario con filtros opcionales
   */
  countByUserId(userId: string, filters?: TaskFilters): Promise<number>;
  
  /**
   * Buscar tareas vencidas de un usuario
   */
  findOverdueTasks(userId: string): Promise<TaskWithCategory[]>;
  
  /**
   * Buscar múltiples tareas por IDs
   */
  findByIds(ids: string[]): Promise<TaskWithCategory[]>;
  
  /**
   * Actualizar estado de múltiples tareas
   */
  bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<void>;
  
  /**
   * Eliminar múltiples tareas
   */
  bulkDelete(ids: string[]): Promise<void>;
  
  /**
   * Buscar tareas por texto con filtros
   */
  search(
    userId: string,
    query: string,
    filters?: TaskFilters,
    page?: number,
    limit?: number
  ): Promise<TaskQueryResult>;
  
  /**
   * Verificar si una tarea pertenece a un usuario
   */
  belongsToUser(taskId: string, userId: string): Promise<boolean>;
  
  /**
   * Obtener estadísticas de tareas de un usuario
   */
  getUserTaskStats(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    byPriority: Record<TaskPriority, number>;
    byStatus: Record<TaskStatus, number>;
  }>;
}

// TIPOS AUXILIARES

/**
 * Resultado de operación bulk
 */
export interface BulkOperationResult {
  success: boolean;
  affected: number;
  errors?: string[];
}

/**
 * Parámetros de búsqueda avanzada
 */
export interface AdvancedSearchParams {
  userId: string;
  query?: string;
  filters?: TaskFilters;
  sort?: SortOptions;
  page?: number;
  limit?: number;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}

// UTILIDADES DE VALIDACIÓN ESPECÍFICAS

/**
 * Verificar si la fecha de vencimiento es válida para creación
 */
export const isValidDueDateForCreation = (dueDate: Date): boolean => {
  const minDate = new Date(Date.now() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60 * 1000);
  return dueDate >= minDate;
};

/**
 * Verificar si el array de tags es válido
 */
export const isValidTagsArray = (tags: string[]): boolean => {
  if (tags.length > TASK_CONFIG.MAX_TAGS_COUNT) return false;
  return tags.every(tag => tag.length <= TASK_CONFIG.MAX_TAG_LENGTH);
};

/**
 * Verificar si el array de attachments es válido
 */
export const isValidAttachmentsArray = (attachments: string[]): boolean => {
  if (attachments.length > TASK_CONFIG.MAX_ATTACHMENTS_COUNT) return false;
  try {
    attachments.forEach(url => new URL(url)); // Validar URLs
    return true;
  } catch {
    return false;
  }
};

// Re-exportar funciones de validación del dominio
export { 
  isValidTaskStatus, 
  isValidTaskPriority, 
  validateTaskData 
} from '@/core/domain/types/TaskDomain';