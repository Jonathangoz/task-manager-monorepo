// src/utils/constants.ts - Task-Service Constants (Updated)
import { config } from '@/config/environment';
import { Prisma } from '@prisma/client';

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
  INVALID_HEX_COLOR: 'INVALID_HEX_COLOR',
  INVALID_ICON: 'INVALID_ICON',
  INVALID_CUID: 'INVALID_CUID',
  INVALID_SEARCH_QUERY: 'INVALID_SEARCH_QUERY',
  RESERVED_NAME_ERROR: 'RESERVED_NAME_ERROR',

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
  CATEGORIES_BULK_DELETED: 'Categorias eliminadas en lote exitosamente',

  TASKS_RETRIEVED: 'Tareas obtenidas exitosamente',
  CATEGORIES_RETRIEVED: 'Categorias obtenidas exitosamente',
  STATS_RETRIEVED: 'Estatísticas obtenidas exitosamente',
  CATEGORIES_EXPORTED: 'Categorias exportadas exitosamente',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  TASK_NOT_FOUND: 'Tarea no encontrada o acceso denegado',
  TASK_ALREADY_EXISTS: 'Una tarea con este título ya existe',
  TASK_ACCESS_DENIED: 'Acceso denagado a la tarea',
  CATEGORY_NOT_FOUND: 'Categoria no encontrada o acceso denegado',
  CATEGORY_ALREADY_EXISTS: 'Una categoria con este nombre ya existe',
  CATEGORY_HAS_TASKS:
    'No se puede eliminar la categoria porque tiene tareas asociadas',
  CATEGORY_LIMIT_EXCEEDED:
    'Se ha alcanzado el límite máximo de categorías por usuario',

  INVALID_TOKEN: 'Token de autenticación inválido',
  TOKEN_EXPIRED: 'Token expirado',
  TOKEN_REQUIRED: 'Token de autenticación requerido',
  UNAUTHORIZED_ACCESS: 'Acceso no autorizado',

  VALIDATION_ERROR: 'Validación fallida',
  INVALID_DATE_FORMAT: 'Formato de fecha inválido',
  INVALID_DUE_DATE:
    'No se puede establecer una fecha de vencimiento en el pasado',
  INVALID_HEX_COLOR: 'Color hexadecimal inválido',
  INVALID_ICON: 'Icono inválido o no permitido',
  INVALID_CUID: 'Identificador CUID inválido',
  INVALID_SEARCH_QUERY: 'Consulta de búsqueda inválida',
  RESERVED_NAME_ERROR: 'Este nombre está reservado y no puede ser utilizado',

  AUTH_SERVICE_ERROR: 'Servicio de autenticación no disponible',
  DATABASE_ERROR: 'Base de datos no disponible',
  REDIS_ERROR: 'Servicio Redis no disponible',
  INTERNAL_ERROR: 'Error interno del servidor',
  SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible',

  RATE_LIMIT_EXCEEDED:
    'Límite de solicitudes excedido, por favor intente más tarde',
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
  MAX_TASKS_PER_USER: 5,
} as const;

// Category Configuration (Enhanced)
export const CATEGORY_CONFIG = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_CATEGORIES_PER_USER: 50,
  MAX_BULK_DELETE: 20,
  DEFAULT_COLOR: '#6366f1',
  DEFAULT_ICON: 'folder',

  // Allowed colors palette for enhanced validation
  ALLOWED_COLORS: [
    '#6366f1', // Indigo (default)
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#ec4899', // Pink
    '#64748b', // Slate
    '#dc2626', // Red (dark)
    '#059669', // Emerald (dark)
    '#7c3aed', // Violet (dark)
    '#0284c7', // Sky
    '#0f172a', // Slate (darkest)
    '#1e293b', // Slate (darker)
    '#374151', // Gray
    '#6b7280', // Gray (light)
    '#9ca3af', // Gray (lighter)
  ] as const,

  // Allowed icons for enhanced validation
  ALLOWED_ICONS: [
    // Basic icons
    'folder',
    'home',
    'briefcase',
    'school',
    'heart',
    'dollar-sign',
    'shopping-cart',
    'plane',
    'utensils',
    'gamepad-2',
    'dumbbell',
    'laptop',
    'palette',
    'music',
    'book',
    'users',
    'user',
    'building',
    'target',
    'calendar',
    'clock',
    'star',
    'flag',
    'tag',
    'bookmark',
    'file-text',
    'image',
    'video',
    'settings',
    'wrench',
    'inbox',
    'archive',
    'trash-2',

    // Additional professional icons
    'briefcase-business',
    'chart-bar',
    'chart-pie',
    'chart-line',
    'clipboard',
    'clipboard-check',
    'clipboard-list',
    'code',
    'database',
    'file-code',
    'folder-open',
    'git-branch',
    'globe',
    'hard-drive',
    'layers',
    'layout-dashboard',
    'lightbulb',
    'mail',
    'map-pin',
    'monitor',
    'network',
    'package',
    'phone',
    'printer',
    'search',
    'server',
    'shield',
    'smartphone',
    'tablet',
    'trending-up',
    'truck',
    'wifi',
    'zap',
  ] as const,

  // Reserved names that cannot be used for categories
  RESERVED_NAMES: [
    'all',
    'none',
    'default',
    'uncategorized',
    'sin categoria',
    'admin',
    'administrator',
    'system',
    'root',
    'null',
    'undefined',
    'void',
    'empty',
    'blank',
    'general',
    'misc',
    'miscellaneous',
    'other',
    'others',
    'todo',
    'todos',
    'task',
    'tasks',
    'category',
    'categories',
    'grupo',
    'grupos',
    'group',
    'groups',
    'api',
    'app',
    'application',
    'config',
    'configuration',
    'settings',
    'preferences',
    'profile',
    'user',
    'users',
  ] as const,
} as const;

// Validation Configuration (New)
export const VALIDATION_CONFIG = {
  // CUID validation
  CUID: {
    MIN_LENGTH: 20,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_-]+$/,
  },

  // Hex color validation
  HEX_COLOR: {
    MIN_LENGTH: 4, // #RGB format
    MAX_LENGTH: 7, // #RRGGBB format
    PATTERN: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  },

  // Icon validation
  ICON: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\-_]+$/,
  },

  // Name validation (categories, tasks, etc.)
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 200,
    PATTERN: /^[a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]+$/,
  },

  // Search query validation
  SEARCH: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]+$/,
  },

  // Bulk operations
  BULK: {
    MIN_ITEMS: 1,
    MAX_ITEMS: 50,
    MAX_CATEGORY_DELETE: 20,
  },
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
  NAME: 'name', // For categories
  TASK_COUNT: 'taskCount', // For categories
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
  IS_ACTIVE: 'isActive', // For categories
  HAS_ICON: 'hasIcon', // For categories
  COLOR: 'color', // For categories
} as const;

// Cache Keys Patterns
export const CACHE_KEYS = {
  USER_TASKS: (userId: string) => `user:${userId}:tasks`,
  USER_CATEGORIES: (userId: string) => `user:${userId}:categories`,
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  TASK_DETAIL: (taskId: string) => `task:${taskId}`,
  CATEGORY_DETAIL: (categoryId: string) => `category:${categoryId}`,
  CATEGORY_TASKS: (categoryId: string) => `category:${categoryId}:tasks`,
  SEARCH_RESULTS: (userId: string, query: string) =>
    `search:${userId}:${Buffer.from(query).toString('base64')}`,
  RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  USER_CATEGORY_COUNT: (userId: string) => `user:${userId}:category_count`,
  CATEGORY_NAME_UNIQUE: (userId: string, name: string) =>
    `unique:${userId}:${name.toLowerCase()}`,
} as const;

// Cache TTL (Time To Live) in seconds - From Environment Configuration
export const CACHE_TTL = {
  USER_TASKS: config.cache.ttl.userTasks,
  USER_CATEGORIES: config.cache.ttl.userCategories,
  USER_STATS: config.cache.ttl.userStats,
  TASK_DETAIL: config.cache.ttl.taskDetail,
  CATEGORY_DETAIL: config.cache.ttl.categoryDetail,
  CATEGORY_TASKS: config.cache.ttl.userTasks,
  SEARCH_RESULTS: config.cache.ttl.searchResults,
  RATE_LIMIT: 900,
  USER_CATEGORY_COUNT: 300, // 5 minutes
  CATEGORY_NAME_UNIQUE: 600, // 10 minutes
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
  CATEGORY_BULK_DELETED: 'category.bulk.deleted',
  CATEGORY_LIMIT_REACHED: 'category.limit.reached',
  CATEGORY_NAME_CONFLICT: 'category.name.conflict',

  USER_STATS_UPDATED: 'stats.updated',

  AUTH_TOKEN_VALIDATED: 'auth.token.validated',
  AUTH_SERVICE_ERROR: 'auth.service.error',

  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_ERROR: 'cache.error',

  VALIDATION_ERROR: 'validation.error',
  VALIDATION_SUCCESS: 'validation.success',

  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
} as const;

// Default Values
export const DEFAULT_VALUES = {
  TASK_STATUS: TASK_STATUSES.PENDING,
  TASK_PRIORITY: TASK_PRIORITIES.MEDIUM,
  CATEGORY_COLOR: CATEGORY_CONFIG.DEFAULT_COLOR,
  CATEGORY_ICON: CATEGORY_CONFIG.DEFAULT_ICON,
  CATEGORY_IS_ACTIVE: true,
  PAGE_SIZE: PAGINATION_CONFIG.DEFAULT_LIMIT,
  SORT_FIELD: SORT_FIELDS.CREATED_AT,
  SORT_ORDER: SORT_ORDERS.DESC,
} as const;

// Interfaz para el mapeo de errores de Prisma
interface PrismaErrorMapping {
  statusCode: number;
  message: string;
  errorCode: string;
  getMessage?: (error: Prisma.PrismaClientKnownRequestError) => string;
}

// Prisma Error Mappings - Indexado por código de error de Prisma
export const PRISMA_ERROR_MAPPINGS: Record<string, PrismaErrorMapping> = {
  P2000: {
    // The value provided for the column is too long
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'El valor proporcionado es demasiado largo para el campo.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2002: {
    // Unique constraint violation
    statusCode: HTTP_STATUS.CONFLICT,
    message: 'Ya existe un recurso con este valor único.',
    errorCode: ERROR_CODES.TASK_ALREADY_EXISTS,
    getMessage: (error: Prisma.PrismaClientKnownRequestError) => {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('name')) {
        return 'Ya existe una categoría con este nombre.';
      }
      if (target?.includes('title')) {
        return 'Ya existe una tarea con este título.';
      }
      return 'Ya existe un recurso con este valor único.';
    },
  },
  P2003: {
    // Foreign key constraint failed
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message:
      'Violación de clave foránea. El recurso relacionado no existe o no se puede vincular.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2004: {
    // A constraint failed on the database
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Fallo una restricción de la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2005: {
    // The value stored in the database is invalid for the field's type
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'El valor en la base de datos es inválido para el tipo de campo.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2006: {
    // The provided value is not of the correct type
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'El valor proporcionado no es del tipo correcto.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2007: {
    // Validation error
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Error de validación en la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2008: {
    // Failed to parse the query
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error al parsear la consulta de la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2009: {
    // Failed to validate the query
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error al validar la consulta de la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2010: {
    // Raw query failed
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'La consulta SQL falló.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2011: {
    // Null constraint violation
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Faltan campos requeridos.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2012: {
    // Missing a required value
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Falta un valor requerido.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2013: {
    // Missing a required argument
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Falta un argumento requerido.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2014: {
    // The change you are trying to make requires a record that does not exist
    statusCode: HTTP_STATUS.NOT_FOUND,
    message: 'La operación requiere un registro que no existe.',
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
  },
  P2015: {
    // A related record could not be found
    statusCode: HTTP_STATUS.NOT_FOUND,
    message: 'No se encontró un registro relacionado.',
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
  },
  P2016: {
    // A query interpretation error occurred
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error de interpretación de consulta.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2017: {
    // The records for relation are not connected
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Los registros para la relación no están conectados.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2018: {
    // The required connected records were not found
    statusCode: HTTP_STATUS.NOT_FOUND,
    message: 'No se encontraron los registros conectados requeridos.',
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
  },
  P2019: {
    // Input error
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Error en la entrada de datos.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2020: {
    // Value out of range for the type
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Valor fuera de rango para el tipo de dato.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2021: {
    // Table does not exist
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'La tabla de la base de datos no existe.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2022: {
    // Column does not exist
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'La columna de la base de datos no existe.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2023: {
    // Raw query syntax error
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error de sintaxis en la consulta SQL.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2024: {
    // Timed out fetching a new connection
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
    message: 'Tiempo de espera agotado al conectar con la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2025: {
    // An operation failed because it depends on one or more records that were required but not found.
    statusCode: HTTP_STATUS.NOT_FOUND,
    message: 'El registro no fue encontrado.',
    errorCode: ERROR_CODES.TASK_NOT_FOUND,
  },
  P2026: {
    // The client has a mismatch between the Prisma Client and the Prisma Schema.
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error de configuración interna de la base de datos.',
    errorCode: ERROR_CODES.INTERNAL_ERROR,
  },
  P2027: {
    // Multiple errors occurred on the database query.
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Múltiples errores en la consulta de la base de datos.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2028: {
    // Transaction failed
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'La transacción de la base de datos falló.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2030: {
    // Cannot find a fulltext index to use for the search
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'No se encontró un índice de texto completo para la búsqueda.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
  P2033: {
    // A number used in the query is too large for its type.
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message:
      'Un número utilizado en la consulta es demasiado grande para su tipo.',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  },
  P2034: {
    // Transaction failed due to a write conflict or a deadlock.
    statusCode: HTTP_STATUS.CONFLICT,
    message:
      'La transacción falló debido a un conflicto de escritura o un interbloqueo.',
    errorCode: ERROR_CODES.DATABASE_ERROR,
  },
} as const;

// Auth Service Endpoints
export const AUTH_ENDPOINTS = {
  VERIFY_TOKEN: config.authService.verifyEndpoint,
  GET_USER: '/api/v1/users/profile',
  BASE_URL: config.authService.url,
  FULL_VERIFY_URL: config.authService.fullVerifyUrl,
} as const;

// Configuración del Auth Service
export const AUTH_SERVICE_CONFIG = {
  URL: config.authService.url,
  API_KEY: config.authService.apiKey,
  TIMEOUT: config.authService.timeout,
  VERIFY_ENDPOINT: config.authService.verifyEndpoint,
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

// Category Filter Options Type
export type CategoryFilters = {
  isActive?: boolean;
  hasIcon?: boolean;
  color?: string;
  minTasks?: number;
  maxTasks?: number;
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

// Category Color Type
export type CategoryColor = (typeof CATEGORY_CONFIG.ALLOWED_COLORS)[number];

// Category Icon Type
export type CategoryIcon = (typeof CATEGORY_CONFIG.ALLOWED_ICONS)[number];

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
  CSV: 'text/csv',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

// Export Formats
export const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  XLSX: 'xlsx',
} as const;

// Validation Rules Collections (for complex validations)
export const VALIDATION_RULES = {
  // Category specific validation rules
  CATEGORY: {
    NAME_MIN_LENGTH: 1,
    NAME_MAX_LENGTH: CATEGORY_CONFIG.MAX_NAME_LENGTH,
    DESCRIPTION_MAX_LENGTH: CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH,
    REQUIRED_FIELDS: ['name'] as const,
    OPTIONAL_FIELDS: ['description', 'color', 'icon'] as const,
    UPDATABLE_FIELDS: [
      'name',
      'description',
      'color',
      'icon',
      'isActive',
    ] as const,
  },

  // Task specific validation rules
  TASK: {
    TITLE_MIN_LENGTH: 1,
    TITLE_MAX_LENGTH: TASK_CONFIG.MAX_TITLE_LENGTH,
    DESCRIPTION_MAX_LENGTH: TASK_CONFIG.MAX_DESCRIPTION_LENGTH,
    REQUIRED_FIELDS: ['title'] as const,
    OPTIONAL_FIELDS: [
      'description',
      'dueDate',
      'priority',
      'categoryId',
    ] as const,
  },

  // Common validation rules
  COMMON: {
    SEARCH_MIN_LENGTH: VALIDATION_CONFIG.SEARCH.MIN_LENGTH,
    SEARCH_MAX_LENGTH: VALIDATION_CONFIG.SEARCH.MAX_LENGTH,
    CUID_MIN_LENGTH: VALIDATION_CONFIG.CUID.MIN_LENGTH,
    CUID_MAX_LENGTH: VALIDATION_CONFIG.CUID.MAX_LENGTH,
  },
} as const;

// Business Rules Configuration
export const BUSINESS_RULES = {
  CATEGORY: {
    MAX_PER_USER: CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER,
    NAME_MUST_BE_UNIQUE_PER_USER: true,
    CAN_DELETE_WITH_TASKS: false, // Requires force flag
    DEFAULT_COLOR_ON_CREATE: true,
    DEFAULT_ICON_ON_CREATE: true,
    AUTO_ACTIVATE_ON_CREATE: true,
  },

  TASK: {
    REQUIRE_CATEGORY: false, // Tasks can exist without category
    AUTO_SET_CREATION_DATE: true,
    ALLOW_PAST_DUE_DATES: false,
    DEFAULT_PRIORITY_ON_CREATE: true,
  },
} as const;

// Feature Flags Configuration
export const FEATURE_FLAGS = {
  ENHANCED_CATEGORY_VALIDATION:
    process.env.FEATURE_ENHANCED_VALIDATION === 'true',
  CATEGORY_COLOR_PALETTE_STRICT:
    process.env.FEATURE_STRICT_COLOR_PALETTE === 'true',
  CATEGORY_ICON_VALIDATION_STRICT:
    process.env.FEATURE_STRICT_ICON_VALIDATION === 'true',
  BULK_OPERATIONS_ENABLED: process.env.FEATURE_BULK_OPERATIONS !== 'false',
  CATEGORY_EXPORT_ENABLED: process.env.FEATURE_CATEGORY_EXPORT !== 'false',
  ADVANCED_SEARCH_ENABLED: process.env.FEATURE_ADVANCED_SEARCH !== 'false',
} as const;

// Configuración de rate limiting basada en el entorno
export const RATE_LIMIT_CONFIG = {
  // Ventanas de tiempo por defecto (milliseconds) - From Environment
  DEFAULT_WINDOW_MS: config.rateLimit.windowMs,
  SHORT_WINDOW_MS: config.rateLimit.createTask.windowMs,
  MEDIUM_WINDOW_MS: config.rateLimit.bulk.windowMs,

  // Límites por defecto - From Environment
  DEFAULT_MAX_REQUESTS: config.rateLimit.maxRequests,
  AUTH_MAX_REQUESTS: config.rateLimit.auth.max,
  CREATE_TASK_MAX: config.rateLimit.createTask.max,
  SEARCH_MAX: config.rateLimit.search.max,
  BULK_MAX: config.rateLimit.bulk.max,
  ADMIN_MAX: config.rateLimit.admin.max,

  // Prefijos de claves Redis - From Environment
  REDIS_KEY_PREFIX: config.rateLimit.redis.keyPrefix,

  // Configuración Redis
  SKIP_SUCCESSFUL: config.rateLimit.redis.skipSuccessful,
  SKIP_FAILED: config.rateLimit.redis.skipFailed,

  // Tipos de identificadores
  IDENTIFIER_TYPES: {
    IP: 'ip',
    USER: 'user',
    CREATE_TASK: 'create_task',
    SEARCH: 'search',
    BULK: 'bulk',
    ADMIN: 'admin',
    AUTH_USER: 'auth_user',
  },
} as const;

// RATE LIMIT ERROR CODES ADICIONALES
export const RATE_LIMIT_ERROR_CODES = {
  GENERAL_RATE_LIMIT: 'GENERAL_RATE_LIMIT_EXCEEDED',
  AUTH_RATE_LIMIT: 'AUTH_RATE_LIMIT_EXCEEDED',
  CREATE_TASK_RATE_LIMIT: 'CREATE_TASK_RATE_LIMIT_EXCEEDED',
  SEARCH_RATE_LIMIT: 'SEARCH_RATE_LIMIT_EXCEEDED',
  BULK_RATE_LIMIT: 'BULK_OPERATIONS_RATE_LIMIT_EXCEEDED',
  ADMIN_RATE_LIMIT: 'ADMIN_RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_STORE_ERROR: 'RATE_LIMIT_STORE_ERROR',
} as const;

// RATE LIMIT ERROR MESSAGES ADICIONALES
export const RATE_LIMIT_ERROR_MESSAGES = {
  GENERAL_RATE_LIMIT:
    'Límite de solicitudes generales excedido. Intente más tarde.',
  AUTH_RATE_LIMIT: 'Demasiados intentos de autenticación. Intente más tarde.',
  CREATE_TASK_RATE_LIMIT:
    'Límite de creación de tareas excedido. Espere un momento.',
  SEARCH_RATE_LIMIT: 'Demasiadas búsquedas realizadas. Espere un momento.',
  BULK_RATE_LIMIT: 'Límite de operaciones en lote excedido. Intente más tarde.',
  ADMIN_RATE_LIMIT: 'Límite de operaciones administrativas excedido.',
  RATE_LIMIT_STORE_ERROR: 'Error en el sistema de límite de solicitudes.',
} as const;

// EVENT TYPES ADICIONALES PARA RATE LIMITING
export const RATE_LIMIT_EVENT_TYPES = {
  RATE_LIMIT_HIT: 'rate_limit.hit',
  RATE_LIMIT_EXCEEDED: 'rate_limit.exceeded',
  RATE_LIMIT_RESET: 'rate_limit.reset',
  RATE_LIMIT_STORE_ERROR: 'rate_limit.store.error',
  RATE_LIMIT_STORE_FALLBACK: 'rate_limit.store.fallback',
} as const;

// CACHE KEYS ADICIONALES PARA RATE LIMITING
export const RATE_LIMIT_CACHE_KEYS = {
  GENERAL: (identifier: string) => `rate_limit:general:${identifier}`,
  AUTH: (identifier: string) => `rate_limit:auth:${identifier}`,
  CREATE_TASK: (identifier: string) => `rate_limit:create_task:${identifier}`,
  SEARCH: (identifier: string) => `rate_limit:search:${identifier}`,
  BULK: (identifier: string) => `rate_limit:bulk:${identifier}`,
  ADMIN: (identifier: string) => `rate_limit:admin:${identifier}`,
  USER_SPECIFIC: (userId: string, action: string) =>
    `rate_limit:user:${userId}:${action}`,
} as const;

// RATE LIMIT HEADERS
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
  POLICY: 'X-RateLimit-Policy',
} as const;

// TIPOS TYPESCRIPT PARA RATE LIMITING
export type RateLimitIdentifierType =
  keyof typeof RATE_LIMIT_CONFIG.IDENTIFIER_TYPES;
export type RateLimitErrorCode = keyof typeof RATE_LIMIT_ERROR_CODES;
export type RateLimitEventType = keyof typeof RATE_LIMIT_EVENT_TYPES;

export interface RateLimitMetrics {
  identifier: string;
  type: RateLimitIdentifierType;
  current: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
}

export interface RateLimitViolation {
  identifier: string;
  type: RateLimitIdentifierType;
  limit: number;
  attempts: number;
  windowMs: number;
  timestamp: Date;
  ip?: string;
  userId?: string;
  path: string;
  method: string;
  userAgent?: string;
}

// CONFIGURACIÓN DE MONITOREO
export const RATE_LIMIT_MONITORING = {
  // Umbrales para alertas
  WARNING_THRESHOLD: 0.8, // 80% del límite
  CRITICAL_THRESHOLD: 0.95, // 95% del límite

  // Métricas a trackear
  METRICS: {
    REQUESTS_PER_MINUTE: 'rate_limit.requests_per_minute',
    VIOLATIONS_PER_HOUR: 'rate_limit.violations_per_hour',
    TOP_VIOLATORS: 'rate_limit.top_violators',
    STORE_ERRORS: 'rate_limit.store_errors',
    FALLBACK_ACTIVATIONS: 'rate_limit.fallback_activations',
  },

  // Intervalos de limpieza
  CLEANUP_INTERVAL_MS: 300000, // 5 minutos
  METRICS_RETENTION_MS: 86400000, // 24 horas
} as const;

// CONFIGURACIÓN DE ENDPOINTS ESPECÍFICOS
// Configuración de límites por tipo de endpoint
export const ENDPOINT_RATE_LIMITS = {
  // Endpoints públicos (sin autenticación)
  PUBLIC: {
    windowMs: config.rateLimit.windowMs,
    max: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Endpoints de autenticación - From Environment
  AUTH: {
    windowMs: config.rateLimit.auth.windowMs,
    max: config.rateLimit.auth.max,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },

  // Creación de recursos (tareas, categorías) - From Environment
  CREATE_RESOURCE: {
    windowMs: config.rateLimit.createTask.windowMs,
    max: config.rateLimit.createTask.max,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },

  // Búsquedas y filtros - From Environment
  SEARCH: {
    windowMs: config.rateLimit.search.windowMs,
    max: config.rateLimit.search.max,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },

  // Operaciones en lote - From Environment
  BULK_OPERATIONS: {
    windowMs: config.rateLimit.bulk.windowMs,
    max: config.rateLimit.bulk.max,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },

  // Endpoints administrativos - From Environment
  ADMIN: {
    windowMs: config.rateLimit.admin.windowMs,
    max: config.rateLimit.admin.max,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },

  // Usuarios autenticados (límite general) - From Environment
  AUTHENTICATED_USER: {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    skipSuccessfulRequests: config.rateLimit.redis.skipSuccessful,
    skipFailedRequests: config.rateLimit.redis.skipFailed,
  },
} as const;

// PATRONES DE RUTAS PARA RATE LIMITING
export const RATE_LIMIT_ROUTE_PATTERNS = {
  AUTH_ROUTES: [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/verify-token',
  ],

  CREATE_ROUTES: ['POST:/api/v1/tasks', 'POST:/api/v1/categories'],

  SEARCH_ROUTES: [
    'GET:/api/v1/tasks/search',
    'GET:/api/v1/categories/search',
    'POST:/api/v1/tasks/filter',
  ],

  BULK_ROUTES: [
    'POST:/api/v1/tasks/bulk',
    'PUT:/api/v1/tasks/bulk',
    'DELETE:/api/v1/tasks/bulk',
    'POST:/api/v1/categories/bulk',
    'DELETE:/api/v1/categories/bulk',
  ],

  ADMIN_ROUTES: [
    '/api/v1/admin/*',
    '/api/v1/stats/system',
    '/api/v1/health/detailed',
  ],

  PUBLIC_ROUTES: [
    'GET:/api/v1/health',
    'GET:/api/v1/docs',
    'GET:/api/v1/swagger',
  ],
} as const;

// CONFIGURACIÓN DE WHITELIST/BLACKLIST
export const RATE_LIMIT_EXEMPTIONS = {
  // IPs que no tienen rate limiting (desarrollo, health checks)
  WHITELISTED_IPS: ['127.0.0.1', '::1', 'localhost'] as const,

  // User agents que pueden tener límites diferentes
  TRUSTED_USER_AGENTS: [
    'HealthCheck/1.0',
    'LoadBalancer/1.0',
    'Monitoring/1.0',
  ] as const,

  // Rutas que no tienen rate limiting
  EXEMPTED_ROUTES: ['/api/v1/health', '/favicon.ico', '/robots.txt'] as const,
} as const;

// MENSAJES DE ERROR CONTEXTUALES
export const CONTEXTUAL_RATE_LIMIT_MESSAGES = {
  TASK_CREATION:
    'Has alcanzado el límite de creación de tareas por minuto. Espera {seconds} segundos.',
  CATEGORY_CREATION:
    'Has alcanzado el límite de creación de categorías por minuto. Espera {seconds} segundos.',
  SEARCH_QUERIES:
    'Demasiadas búsquedas realizadas. Espera {seconds} segundos antes de buscar nuevamente.',
  BULK_OPERATIONS:
    'Límite de operaciones en lote alcanzado. Espera {minutes} minutos.',
  AUTH_ATTEMPTS:
    'Demasiados intentos de autenticación. Espera {minutes} minutos.',
  GENERAL_API:
    'Límite de solicitudes a la API alcanzado. Espera {minutes} minutos.',
} as const;

// CONFIGURACIÓN DE DEGRADACIÓN GRADUAL
export const RATE_LIMIT_DEGRADATION = {
  // Umbrales para activar degradación
  THRESHOLDS: {
    LIGHT_LOAD: 0.5, // 50% del límite
    MEDIUM_LOAD: 0.7, // 70% del límite
    HEAVY_LOAD: 0.9, // 90% del límite
  },

  // Acciones por nivel de carga
  ACTIONS: {
    LIGHT_LOAD: {
      enabled: false,
      delay: 0,
    },
    MEDIUM_LOAD: {
      enabled: true,
      delay: 100, // 100ms delay
      warnings: true,
    },
    HEAVY_LOAD: {
      enabled: true,
      delay: 500, // 500ms delay
      warnings: true,
      reducedFeatures: true,
    },
  },
} as const;

// TIPOS EXPORTADOS ADICIONALES
export type EndpointRateLimitType = keyof typeof ENDPOINT_RATE_LIMITS;
export type RateLimitRoutePattern = keyof typeof RATE_LIMIT_ROUTE_PATTERNS;
export type RateLimitDegradationLevel =
  keyof typeof RATE_LIMIT_DEGRADATION.THRESHOLDS;

// CONSTANTES DE INTEGRACIÓN CON OTROS SISTEMAS
export const RATE_LIMIT_INTEGRATION = {
  // Headers para comunicación con load balancer
  LOAD_BALANCER_HEADERS: {
    RATE_LIMIT_STATUS: 'X-Internal-RateLimit-Status',
    CLIENT_IP: 'X-Forwarded-For',
    REAL_IP: 'X-Real-IP',
  },

  // Métricas para sistemas de monitoreo
  METRICS_KEYS: {
    REQUESTS_COUNT: 'rate_limit_requests_total',
    VIOLATIONS_COUNT: 'rate_limit_violations_total',
    RESPONSE_TIME: 'rate_limit_response_time',
    STORE_ERRORS: 'rate_limit_store_errors_total',
  },

  // Configuración para alertas
  ALERT_THRESHOLDS: {
    HIGH_VIOLATION_RATE: 100, // violaciones por hora
    HIGH_ERROR_RATE: 10, // errores por minuto
    STORE_UNAVAILABLE_TIME: 60, // segundos
  },
} as const;

// FUNCIONES HELPER PARA CONSTANTS

/**
 * Genera un mensaje de error contextual con tiempo de espera
 */
export const generateRateLimitMessage = (
  type: keyof typeof CONTEXTUAL_RATE_LIMIT_MESSAGES,
  resetTimeMs: number,
): string => {
  const template = CONTEXTUAL_RATE_LIMIT_MESSAGES[type];
  const seconds = Math.ceil(resetTimeMs / 1000);
  const minutes = Math.ceil(seconds / 60);

  return template
    .replace('{seconds}', seconds.toString())
    .replace('{minutes}', minutes.toString());
};

/**
 * Verifica si una IP está en la whitelist
 */
export const isWhitelistedIP = (ip: string): boolean => {
  return (RATE_LIMIT_EXEMPTIONS.WHITELISTED_IPS as readonly string[]).includes(
    ip,
  );
};

/**
 * Verifica si una ruta está exenta de rate limiting
 */
export const isExemptedRoute = (path: string): boolean => {
  return (RATE_LIMIT_EXEMPTIONS.EXEMPTED_ROUTES as readonly string[]).some(
    (route) => path.startsWith(route) || path === route,
  );
};

/**
 * Obtiene la configuración de rate limit para un tipo de endpoint
 */
export const getRateLimitConfig = (type: EndpointRateLimitType) => {
  return ENDPOINT_RATE_LIMITS[type];
};

/**
 * Verifica si un color está en la paleta permitida
 */
export const isValidCategoryColor = (color: string): color is CategoryColor => {
  return (CATEGORY_CONFIG.ALLOWED_COLORS as readonly string[]).includes(color);
};

/**
 * Verifica si un icono está en la lista permitida
 */
export const isValidCategoryIcon = (icon: string): icon is CategoryIcon => {
  return (CATEGORY_CONFIG.ALLOWED_ICONS as readonly string[]).includes(icon);
};

/**
 * Verifica si un nombre de categoría está reservado
 */
export const isReservedCategoryName = (name: string): boolean => {
  const normalizedName = name.toLowerCase().trim();
  return (CATEGORY_CONFIG.RESERVED_NAMES as readonly string[]).includes(
    normalizedName,
  );
};

/**
 * Normaliza un color hex de 3 dígitos a 6 dígitos
 */
export const normalizeHexColor = (color: string): string => {
  if (color.length === 4) {
    return (
      '#' +
      color
        .slice(1)
        .split('')
        .map((c: string) => c + c)
        .join('')
    );
  }
  return color.toLowerCase();
};

/**
 * Obtiene el color por defecto para categorías
 */
export const getDefaultCategoryColor = (): CategoryColor => {
  return CATEGORY_CONFIG.DEFAULT_COLOR as CategoryColor;
};

/**
 * Obtiene el icono por defecto para categorías
 */
export const getDefaultCategoryIcon = (): CategoryIcon => {
  return CATEGORY_CONFIG.DEFAULT_ICON as CategoryIcon;
};

/**
 * Verifica si las operaciones en lote están habilitadas
 */
export const isBulkOperationsEnabled = (): boolean => {
  return FEATURE_FLAGS.BULK_OPERATIONS_ENABLED;
};

/**
 * Verifica si la validación mejorada está habilitada
 */
export const isEnhancedValidationEnabled = (): boolean => {
  return FEATURE_FLAGS.ENHANCED_CATEGORY_VALIDATION;
};

/**
 * Obtiene la configuración de validación para un campo específico
 */
export const getValidationConfig = (
  entity: keyof typeof VALIDATION_RULES,
  field?: string,
) => {
  const entityConfig = VALIDATION_RULES[entity];
  if (field && field in entityConfig) {
    return entityConfig[field as keyof typeof entityConfig];
  }
  return entityConfig;
};

/**
 * Obtiene las reglas de negocio para una entidad específica
 */
export const getBusinessRules = (entity: keyof typeof BUSINESS_RULES) => {
  return BUSINESS_RULES[entity];
};

/**
 * Verifica si una característica está habilitada
 */
export const isFeatureEnabled = (
  feature: keyof typeof FEATURE_FLAGS,
): boolean => {
  return FEATURE_FLAGS[feature];
};

// CONSTANTES DE LOGGING Y DEBUGGING
export const LOGGING_CONFIG = {
  // Niveles de log
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    TRACE: 'trace',
  },

  // Categorías de log
  CATEGORIES: {
    VALIDATION: 'validation',
    RATE_LIMIT: 'rate_limit',
    AUTH: 'auth',
    DATABASE: 'database',
    CACHE: 'cache',
    BUSINESS_LOGIC: 'business_logic',
    EXTERNAL_SERVICE: 'external_service',
  },

  // Contextos para structured logging
  CONTEXTS: {
    REQUEST_ID: 'requestId',
    USER_ID: 'userId',
    CATEGORY_ID: 'categoryId',
    TASK_ID: 'taskId',
    OPERATION: 'operation',
    DURATION: 'duration',
    ERROR_CODE: 'errorCode',
  },
} as const;

// CONSTANTES DE TESTING
export const TESTING_CONFIG = {
  // Datos de prueba para categorías
  MOCK_CATEGORIES: {
    VALID_CATEGORY: {
      name: 'Test Category',
      description: 'A test category for unit tests',
      color: '#6366f1',
      icon: 'folder',
    },
    INVALID_CATEGORY: {
      name: '', // Invalid: empty name
      description: 'A' + 'a'.repeat(CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH), // Invalid: too long
      color: 'invalid-color', // Invalid: not hex format
      icon: 'invalid-icon', // Invalid: not in allowed list
    },
  },

  // IDs de prueba en formato CUID
  MOCK_IDS: {
    VALID_CUID: 'cl9e2q1kj0001js08abcdefgh',
    INVALID_CUID: 'invalid-id',
    USER_ID: 'cl9e2q1kj0002js08user001',
    CATEGORY_ID: 'cl9e2q1kj0003js08cat001',
    TASK_ID: 'cl9e2q1kj0004js08task001',
  },

  // Configuración para tests de rate limiting
  RATE_LIMIT_TEST: {
    FAST_WINDOW_MS: 1000, // 1 segundo para tests rápidos
    LOW_LIMIT: 5, // Límite bajo para disparar rate limiting
    TEST_USER_AGENT: 'Test-Agent/1.0',
  },
} as const;

// CONSTANTES DE DESARROLLO
export const DEVELOPMENT_CONFIG = {
  // Configuración para desarrollo local
  LOCAL: {
    DISABLE_RATE_LIMITING:
      process.env.NODE_ENV === 'development' &&
      process.env.DISABLE_RATE_LIMIT === 'true',
    VERBOSE_VALIDATION_ERRORS: process.env.NODE_ENV === 'development',
    MOCK_AUTH_SERVICE:
      process.env.NODE_ENV === 'development' &&
      process.env.MOCK_AUTH === 'true',
    DETAILED_ERROR_RESPONSES: process.env.NODE_ENV === 'development',
  },

  // Configuración para debugging
  DEBUG: {
    LOG_VALIDATION_DETAILS: process.env.DEBUG_VALIDATION === 'true',
    LOG_RATE_LIMIT_DETAILS: process.env.DEBUG_RATE_LIMIT === 'true',
    LOG_CACHE_OPERATIONS: process.env.DEBUG_CACHE === 'true',
    TRACE_DATABASE_QUERIES: process.env.DEBUG_DATABASE === 'true',
  },
} as const;

// Exportar un objeto combinado si se desea (opcional)
export const ALL_CONSTANTS = {
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  PRISMA_ERROR_MAPPINGS,
  TASK_CONFIG,
  CATEGORY_CONFIG,
  VALIDATION_CONFIG,
  TASK_STATUSES,
  TASK_PRIORITIES,
  PRIORITY_WEIGHTS,
  SORT_FIELDS,
  SORT_ORDERS,
  FILTER_FIELDS,
  CACHE_KEYS,
  CACHE_TTL,
  PAGINATION_CONFIG,
  DATE_FORMATS,
  EVENT_TYPES,
  DEFAULT_VALUES,
  AUTH_ENDPOINTS,
  AUTH_SERVICE_CONFIG,
  HTTP_METHODS,
  API_VERSIONS,
  SERVICE_NAMES,
  REQUEST_HEADERS,
  CONTENT_TYPES,
} as const;
