// src/utils/constants.ts

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Codes específicos del Task Service
export const ERROR_CODES = {
  // Task errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_EXISTS: 'TASK_ALREADY_EXISTS',
  TASK_ACCESS_DENIED: 'TASK_ACCESS_DENIED',
  TASK_CANNOT_BE_DELETED: 'TASK_CANNOT_BE_DELETED',
  INVALID_TASK_STATUS: 'INVALID_TASK_STATUS',
  INVALID_TASK_PRIORITY: 'INVALID_TASK_PRIORITY',
  TASK_OVERDUE: 'TASK_OVERDUE',
  
  // Category errors
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_ALREADY_EXISTS: 'CATEGORY_ALREADY_EXISTS',
  CATEGORY_ACCESS_DENIED: 'CATEGORY_ACCESS_DENIED',
  CATEGORY_HAS_TASKS: 'CATEGORY_HAS_TASKS',
  CATEGORY_LIMIT_EXCEEDED: 'CATEGORY_LIMIT_EXCEEDED',
  
  // Authentication errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_DUE_DATE: 'INVALID_DUE_DATE',
  INVALID_PAGINATION: 'INVALID_PAGINATION',
  INVALID_SORT_FIELD: 'INVALID_SORT_FIELD',
  INVALID_FILTER: 'INVALID_FILTER',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  AUTH_SERVICE_ERROR: 'AUTH_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TASK_CREATED: 'Tarea creada exitosamente',
  TASK_UPDATED: 'Tarea actualizada exitosamente',
  TASK_DELETED: 'Tarea eliminada exitosamente',
  TASK_STATUS_UPDATED: 'Estado de tarea actualizado exitosamente',
  TASK_PRIORITY_UPDATED: 'Prioridad de tarea actualizada exitosamente',
  TASK_COMPLETED: 'Tarea completada exitosamente',
  
  CATEGORY_CREATED: 'Categoria creada exitosamente',
  CATEGORY_UPDATED: 'Categoria actualizada exitosamente',
  CATEGORY_DELETED: 'Categoria eliminada exitosamente',
  
  TASKS_RETRIEVED: 'Tareas obtenidas exitosamente',
  CATEGORIES_RETRIEVED: 'Categorias obtenidas exitosamente',
  STATS_RETRIEVED: 'Estatísticas obtenidas exitosamente',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  TASK_NOT_FOUND: 'Tarea no encontrada o acceso denegado',
  TASK_ALREADY_EXISTS: 'Una tarea con este título ya existe',
  CATEGORY_NOT_FOUND: 'Categoria no encontrada o acceso denegado',
  CATEGORY_ALREADY_EXISTS: 'Una categoria con este nombre ya existe',
  CATEGORY_HAS_TASKS: 'No se puede eliminar la categoria porque tiene tareas asociadas',
  
  INVALID_TOKEN: 'Token de autenticación inválido',
  TOKEN_EXPIRED: 'Token expirado',
  TOKEN_REQUIRED: 'Token de autenticación requerido',
  UNAUTHORIZED_ACCESS: 'Acceso no autorizado',
  
  VALIDATION_ERROR: 'Validación fallida',
  INVALID_DATE_FORMAT: 'Formato de fecha inválido',
  INVALID_DUE_DATE: 'No se puede establecer una fecha de vencimiento en el pasado',
  
  AUTH_SERVICE_ERROR: 'Servicio de autenticación no disponible',
  DATABASE_ERROR: 'Base de datos no disponible',
  REDIS_ERROR: 'Servicio Redis no disponible',
  INTERNAL_ERROR: 'Error interno del servidor',
  SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible',
  
  RATE_LIMIT_EXCEEDED: 'Límite de solicitudes excedido, por favor intente más tarde',
} as const;

// Task Configuration
export const TASK_CONFIG = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_TAGS_COUNT: 10,
  MAX_TAG_LENGTH: 50,
  MAX_ATTACHMENTS_COUNT: 5,
  MAX_ESTIMATED_HOURS: 999,
  MIN_DUE_DATE_OFFSET_MINUTES: 5,
} as const;

// Category Configuration
export const CATEGORY_CONFIG = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_CATEGORIES_PER_USER: 50,
  DEFAULT_COLOR: '#6366f1',
  DEFAULT_ICON: 'folder',
} as const;

// Task Status Options
export const TASK_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD',
} as const;

// Task Priority Options
export const TASK_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

// Priority Weights for Sorting
export const PRIORITY_WEIGHTS = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
} as const;

// Sort Options
export const SORT_FIELDS = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  DUE_DATE: 'dueDate',
  PRIORITY: 'priority',
  STATUS: 'status',
  TITLE: 'title',
} as const;

export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

// Filter Options
export const FILTER_FIELDS = {
  STATUS: 'status',
  PRIORITY: 'priority',
  CATEGORY_ID: 'categoryId',
  DUE_DATE: 'dueDate',
  CREATED_AT: 'createdAt',
  HAS_DUE_DATE: 'hasDueDate',
  IS_OVERDUE: 'isOverdue',
  TAGS: 'tags',
} as const;

// Cache Keys Patterns
export const CACHE_KEYS = {
  USER_TASKS: (userId: string) => `user:${userId}:tasks`,
  USER_CATEGORIES: (userId: string) => `user:${userId}:categories`,
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  TASK_DETAIL: (taskId: string) => `task:${taskId}`,
  CATEGORY_DETAIL: (categoryId: string) => `category:${categoryId}`,
  CATEGORY_TASKS: (categoryId: string) => `category:${categoryId}:tasks`,
  SEARCH_RESULTS: (userId: string, query: string) => `search:${userId}:${Buffer.from(query).toString('base64')}`,
  RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  USER_TASKS: 180,
  USER_CATEGORIES: 600,
  USER_STATS: 300,
  TASK_DETAIL: 300,
  CATEGORY_DETAIL: 600,
  CATEGORY_TASKS: 180,
  SEARCH_RESULTS: 120,
  RATE_LIMIT: 900,
} as const;

// Pagination Configuration
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  HUMAN_READABLE: 'MMM DD, YYYY',
  WITH_TIME: 'MMM DD, YYYY HH:mm',
} as const;

// Event Types para logging y auditoria
export const EVENT_TYPES = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_STATUS_CHANGED: 'task.status.changed',
  TASK_COMPLETED: 'task.completed',
  
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',
  
  USER_STATS_UPDATED: 'stats.updated',
  
  AUTH_TOKEN_VALIDATED: 'auth.token.validated',
  AUTH_SERVICE_ERROR: 'auth.service.error',
  
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_ERROR: 'cache.error',
  
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
} as const;

// Default Values
export const DEFAULT_VALUES = {
  TASK_STATUS: TASK_STATUSES.PENDING,
  TASK_PRIORITY: TASK_PRIORITIES.MEDIUM,
  CATEGORY_COLOR: CATEGORY_CONFIG.DEFAULT_COLOR,
  CATEGORY_ICON: CATEGORY_CONFIG.DEFAULT_ICON,
  PAGE_SIZE: PAGINATION_CONFIG.DEFAULT_LIMIT,
  SORT_FIELD: SORT_FIELDS.CREATED_AT,
  SORT_ORDER: SORT_ORDERS.DESC,
} as const;

// Auth Service Endpoints
export const AUTH_ENDPOINTS = {
  VERIFY_TOKEN: '/api/v1/auth/verify-token',
  GET_USER: '/api/v1/users/profile',
} as const;

// API Response Types
export type ApiResponse<T = any> = {
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
};

// Pagination Meta Type
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// Filter Options Type
export type TaskFilters = {
  status?: string | string[];
  priority?: string | string[];
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
  hasDueDate?: boolean;
  tags?: string | string[];
  search?: string;
};

// Sort Options Type
export type SortOptions = {
  field: string;
  order: 'asc' | 'desc';
};

// Task Priority Values Type
export type TaskPriority = keyof typeof TASK_PRIORITIES;

// Task Status Values Type
export type TaskStatus = keyof typeof TASK_STATUSES;

// HTTP Methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
} as const;

// API Versions
export const API_VERSIONS = {
  V1: 'v1',
} as const;

// Service Names
export const SERVICE_NAMES = {
  TASK_SERVICE: 'task-service',
  AUTH_SERVICE: 'auth-service',
  USER_SERVICE: 'user-service',
} as const;

// Request Headers
export const REQUEST_HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  X_REQUEST_ID: 'X-Request-ID',
  X_FORWARDED_FOR: 'X-Forwarded-For',
} as const;

// Content Types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
} as const;