// ==============================================
// src/core/domain/interfaces/ITaskService.ts
// Interface del servicio de tareas - Versión corregida
// ==============================================

import { z } from 'zod';
import {
  TaskFilters,
  SortOptions,
  PaginationMeta,
  TaskStatus,
  TaskPriority,
  TASK_CONFIG,
} from '@/utils/constants';

import {
  TaskWithCategory,
  CreateTaskData,
  UpdateTaskData,
} from '@/core/types/TaskDomain';

import {
  validateTaskFilters,
  validatePaginationParams,
} from '@/core/domain/interfaces/ITaskRepository';

// ==============================================
// SCHEMAS DE VALIDACIÓN ESPECÍFICOS DEL SERVICIO
// ==============================================

// Schema para validar parámetros de entrada del servicio
export const ServiceTaskCreateSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(
        TASK_CONFIG.MAX_TITLE_LENGTH,
        `Title must be less than ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`,
      )
      .trim(),

    description: z
      .string()
      .max(
        TASK_CONFIG.MAX_DESCRIPTION_LENGTH,
        `Description must be less than ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`,
      )
      .optional(),

    dueDate: z
      .date()
      .min(
        new Date(
          Date.now() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60 * 1000,
        ),
        'Due date must be at least 5 minutes in the future',
      )
      .optional(),

    categoryId: z.string().uuid('Category ID must be a valid UUID').optional(),

    tags: z
      .array(z.string().max(TASK_CONFIG.MAX_TAG_LENGTH))
      .max(
        TASK_CONFIG.MAX_TAGS_COUNT,
        `Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`,
      )
      .default([]),

    estimatedHours: z
      .number()
      .min(0, 'Estimated hours must be positive')
      .max(
        TASK_CONFIG.MAX_ESTIMATED_HOURS,
        `Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`,
      )
      .optional(),

    attachments: z
      .array(z.string().url('Invalid attachment URL'))
      .max(
        TASK_CONFIG.MAX_ATTACHMENTS_COUNT,
        `Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`,
      )
      .default([]),
  })
  .strict();

// Schema para validar arrays de IDs en operaciones bulk
export const BulkTaskIdsSchema = z
  .array(z.string().uuid('Each task ID must be a valid UUID'))
  .min(1, 'At least one task ID is required')
  .max(50, 'Maximum 50 tasks can be processed at once');

// Schema para validar query de búsqueda
export const SearchQuerySchema = z
  .string()
  .min(1, 'Search query cannot be empty')
  .max(200, 'Search query cannot exceed 200 characters')
  .trim();

// ==============================================
// TIPOS DE RESPUESTA DEL SERVICIO
// ==============================================

/**
 * Respuesta estándar para listas de tareas
 */
export interface TaskListResponse {
  tasks: TaskWithCategory[];
  meta: PaginationMeta;
}

/**
 * Estadísticas completas de tareas de un usuario
 */
export interface TaskStatsResponse {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  cancelledTasks: number;
  onHoldTasks: number;

  tasksByPriority: {
    [K in TaskPriority as Lowercase<K>]: number;
  };

  tasksByStatus: {
    [K in TaskStatus as Lowercase<K>]: number;
  };

  completionRate: number;
  avgCompletionTime?: number; // en horas
  totalEstimatedHours: number;
  totalActualHours: number;
  efficiencyRatio?: number; // actualHours / estimatedHours
}

/**
 * Estadísticas de productividad
 */
export interface ProductivityStats {
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
  tasksCompletedThisMonth: number;
  tasksCompletedThisYear: number;

  streakDays: number;
  longestStreak: number;

  mostProductiveDay: string; // día de la semana
  mostProductiveHour: number; // hora del día (0-23)

  avgTasksPerDay: number;
  avgTasksPerWeek: number;

  peakHours: number[]; // horas más productivas
  productivityTrend: 'increasing' | 'decreasing' | 'stable';

  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    tasksCompleted: number;
    avgCompletionTime: number;
  }>;
}

/**
 * Resultado de operación bulk
 */
export interface BulkOperationResult {
  success: boolean;
  totalRequested: number;
  successfullyProcessed: number;
  failed: number;
  errors?: Array<{
    taskId: string;
    error: string;
  }>;
}

/**
 * Datos de entrada para crear tarea (sin userId)
 */
export type ServiceCreateTaskData = Omit<CreateTaskData, 'userId'>;

/**
 * Parámetros para búsqueda avanzada de tareas
 */
export interface AdvancedSearchParams {
  query?: string;
  filters?: TaskFilters;
  sort?: SortOptions;
  page?: number;
  limit?: number;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// ==============================================
// FUNCIONES DE VALIDACIÓN DEL SERVICIO
// ==============================================

/**
 * Validar datos de entrada para crear tarea en el servicio
 */
export const validateServiceCreateTaskData = (
  data: unknown,
): ServiceCreateTaskData => {
  try {
    return ServiceTaskCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new Error(
        `Task creation validation failed: ${errorMessages.join(', ')}`,
      );
    }
    throw error;
  }
};

/**
 * Validar array de IDs para operaciones bulk
 */
export const validateBulkTaskIds = (ids: unknown): string[] => {
  try {
    return BulkTaskIdsSchema.parse(ids);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new Error(
        `Bulk operation validation failed: ${errorMessages.join(', ')}`,
      );
    }
    throw error;
  }
};

/**
 * Validar query de búsqueda
 */
export const validateSearchQuery = (query: unknown): string => {
  try {
    return SearchQuerySchema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new Error(
        `Search query validation failed: ${errorMessages.join(', ')}`,
      );
    }
    throw error;
  }
};

/**
 * Validar parámetros de búsqueda avanzada
 */
export const validateAdvancedSearchParams = (
  params: Partial<AdvancedSearchParams>,
): AdvancedSearchParams => {
  const validated: AdvancedSearchParams = {};

  if (params.query !== undefined) {
    validated.query = validateSearchQuery(params.query);
  }

  if (params.filters) {
    validated.filters = validateTaskFilters(params.filters);
  }

  if (params.page !== undefined || params.limit !== undefined) {
    const paginationParams = validatePaginationParams(
      params.page,
      params.limit,
    );
    validated.page = paginationParams.page;
    validated.limit = paginationParams.limit;
  }

  validated.includeCompleted = params.includeCompleted ?? false;
  validated.includeCancelled = params.includeCancelled ?? false;

  if (params.dateRange) {
    if (params.dateRange.from > params.dateRange.to) {
      throw new Error('Date range: "from" date cannot be after "to" date');
    }
    validated.dateRange = params.dateRange;
  }

  return validated;
};

// ==============================================
// INTERFACE PRINCIPAL DEL SERVICIO
// ==============================================

export interface ITaskService {
  // ==============================================
  // OPERACIONES CRUD BÁSICAS
  // ==============================================

  /**
   * Crear nueva tarea
   * @param userId - ID del usuario propietario
   * @param data - Datos de la tarea (sin userId)
   * @returns Tarea creada con categoría
   */
  createTask(
    userId: string,
    data: ServiceCreateTaskData,
  ): Promise<TaskWithCategory>;

  /**
   * Obtener tarea por ID
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Tarea encontrada o null si no existe/sin permisos
   */
  getTaskById(taskId: string, userId: string): Promise<TaskWithCategory | null>;

  /**
   * Actualizar tarea completa
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @param data - Datos a actualizar
   * @returns Tarea actualizada
   */
  updateTask(
    taskId: string,
    userId: string,
    data: UpdateTaskData,
  ): Promise<TaskWithCategory>;

  /**
   * Eliminar tarea
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   */
  deleteTask(taskId: string, userId: string): Promise<void>;

  // ==============================================
  // OPERACIONES DE CONSULTA
  // ==============================================

  /**
   * Obtener tareas del usuario con filtros y paginación
   * @param userId - ID del usuario
   * @param filters - Filtros opcionales
   * @param sort - Opciones de ordenamiento
   * @param page - Página (default: 1)
   * @param limit - Límite por página (default: 20)
   * @returns Lista paginada de tareas
   */
  getUserTasks(
    userId: string,
    filters?: TaskFilters,
    sort?: SortOptions,
    page?: number,
    limit?: number,
  ): Promise<TaskListResponse>;

  /**
   * Obtener tareas por categoría
   * @param categoryId - ID de la categoría
   * @param userId - ID del usuario (para verificar permisos)
   * @param page - Página (default: 1)
   * @param limit - Límite por página (default: 20)
   * @returns Lista paginada de tareas de la categoría
   */
  getTasksByCategory(
    categoryId: string,
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<TaskListResponse>;

  /**
   * Buscar tareas por texto y filtros
   * @param userId - ID del usuario
   * @param query - Texto de búsqueda
   * @param filters - Filtros opcionales
   * @param page - Página (default: 1)
   * @param limit - Límite por página (default: 20)
   * @returns Lista paginada de tareas encontradas
   */
  searchTasks(
    userId: string,
    query: string,
    filters?: TaskFilters,
    page?: number,
    limit?: number,
  ): Promise<TaskListResponse>;

  /**
   * Búsqueda avanzada de tareas
   * @param userId - ID del usuario
   * @param params - Parámetros de búsqueda avanzada
   * @returns Lista paginada de tareas encontradas
   */
  advancedSearchTasks(
    userId: string,
    params: AdvancedSearchParams,
  ): Promise<TaskListResponse>;

  /**
   * Obtener tareas vencidas del usuario
   * @param userId - ID del usuario
   * @returns Array de tareas vencidas
   */
  getOverdueTasks(userId: string): Promise<TaskWithCategory[]>;

  // ==============================================
  // OPERACIONES DE ESTADO Y PRIORIDAD
  // ==============================================

  /**
   * Actualizar solo el estado de una tarea
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @param status - Nuevo estado
   * @returns Tarea actualizada
   */
  updateTaskStatus(
    taskId: string,
    userId: string,
    status: TaskStatus,
  ): Promise<TaskWithCategory>;

  /**
   * Actualizar solo la prioridad de una tarea
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @param priority - Nueva prioridad
   * @returns Tarea actualizada
   */
  updateTaskPriority(
    taskId: string,
    userId: string,
    priority: TaskPriority,
  ): Promise<TaskWithCategory>;

  /**
   * Marcar tarea como completada
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Tarea marcada como completada
   */
  markTaskAsCompleted(
    taskId: string,
    userId: string,
  ): Promise<TaskWithCategory>;

  /**
   * Marcar tarea como pendiente
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Tarea marcada como pendiente
   */
  markTaskAsPending(taskId: string, userId: string): Promise<TaskWithCategory>;

  // ==============================================
  // OPERACIONES EN LOTE
  // ==============================================

  /**
   * Actualizar estado de múltiples tareas
   * @param taskIds - Array de IDs de tareas
   * @param userId - ID del usuario (para verificar permisos)
   * @param status - Nuevo estado para todas las tareas
   * @returns Resultado de la operación bulk
   */
  bulkUpdateStatus(
    taskIds: string[],
    userId: string,
    status: TaskStatus,
  ): Promise<BulkOperationResult>;

  /**
   * Actualizar prioridad de múltiples tareas
   * @param taskIds - Array de IDs de tareas
   * @param userId - ID del usuario (para verificar permisos)
   * @param priority - Nueva prioridad para todas las tareas
   * @returns Resultado de la operación bulk
   */
  bulkUpdatePriority(
    taskIds: string[],
    userId: string,
    priority: TaskPriority,
  ): Promise<BulkOperationResult>;

  /**
   * Eliminar múltiples tareas
   * @param taskIds - Array de IDs de tareas
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Resultado de la operación bulk
   */
  bulkDeleteTasks(
    taskIds: string[],
    userId: string,
  ): Promise<BulkOperationResult>;

  /**
   * Asignar categoría a múltiples tareas
   * @param taskIds - Array de IDs de tareas
   * @param userId - ID del usuario (para verificar permisos)
   * @param categoryId - ID de la categoría a asignar (null para remover categoría)
   * @returns Resultado de la operación bulk
   */
  bulkAssignCategory(
    taskIds: string[],
    userId: string,
    categoryId: string | null,
  ): Promise<BulkOperationResult>;

  // ==============================================
  // ESTADÍSTICAS Y ANÁLISIS
  // ==============================================

  /**
   * Obtener estadísticas generales de tareas del usuario
   * @param userId - ID del usuario
   * @returns Estadísticas completas de tareas
   */
  getUserStats(userId: string): Promise<TaskStatsResponse>;

  /**
   * Obtener estadísticas de productividad del usuario
   * @param userId - ID del usuario
   * @returns Estadísticas de productividad
   */
  getProductivityStats(userId: string): Promise<ProductivityStats>;

  /**
   * Obtener estadísticas por rango de fechas
   * @param userId - ID del usuario
   * @param from - Fecha de inicio
   * @param to - Fecha de fin
   * @returns Estadísticas del período especificado
   */
  getStatsForDateRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<TaskStatsResponse>;

  // ==============================================
  // OPERACIONES ESPECIALES
  // ==============================================

  /**
   * Duplicar una tarea existente
   * @param taskId - ID de la tarea a duplicar
   * @param userId - ID del usuario (para verificar permisos)
   * @param modifications - Modificaciones opcionales para la copia
   * @returns Nueva tarea duplicada
   */
  duplicateTask(
    taskId: string,
    userId: string,
    modifications?: Partial<ServiceCreateTaskData>,
  ): Promise<TaskWithCategory>;

  /**
   * Archivar tarea (marcar como inactiva sin eliminar)
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Tarea archivada
   */
  archiveTask(taskId: string, userId: string): Promise<TaskWithCategory>;

  /**
   * Restaurar tarea archivada
   * @param taskId - ID de la tarea
   * @param userId - ID del usuario (para verificar permisos)
   * @returns Tarea restaurada
   */
  restoreTask(taskId: string, userId: string): Promise<TaskWithCategory>;

  /**
   * Obtener sugerencias de tareas basadas en historial del usuario
   * @param userId - ID del usuario
   * @param limit - Número máximo de sugerencias (default: 5)
   * @returns Array de sugerencias de tareas
   */
  getTaskSuggestions(
    userId: string,
    limit?: number,
  ): Promise<ServiceCreateTaskData[]>;

  /**
   * Exportar tareas del usuario en formato especificado
   * @param userId - ID del usuario
   * @param format - Formato de exportación ('json' | 'csv' | 'xml')
   * @param filters - Filtros opcionales para las tareas a exportar
   * @returns Datos exportados en el formato especificado
   */
  exportUserTasks(
    userId: string,
    format: 'json' | 'csv' | 'xml',
    filters?: TaskFilters,
  ): Promise<string>;
}

// ==============================================
// TIPOS AUXILIARES EXPORTADOS
// ==============================================

export type {
  TaskFilters,
  SortOptions,
  PaginationMeta,
  TaskStatus,
  TaskPriority,
} from '@/utils/constants';

export type {
  DomainTask,
  TaskWithCategory,
  CreateTaskData,
  UpdateTaskData,
  TaskQueryResult,
} from '@/core/domain/types/TaskDomain';

// ==============================================
// CONSTANTES DEL SERVICIO
// ==============================================

/**
 * Límites del servicio para operaciones especiales
 */
export const SERVICE_LIMITS = {
  MAX_BULK_OPERATIONS: 50,
  MAX_SEARCH_RESULTS: 500,
  MAX_EXPORT_RECORDS: 10000,
  MAX_SUGGESTIONS: 10,
  CACHE_DURATION_MINUTES: 15,
} as const;

/**
 * Formatos de exportación soportados
 */
export const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  XML: 'xml',
} as const;

export type ExportFormat = keyof typeof EXPORT_FORMATS;
