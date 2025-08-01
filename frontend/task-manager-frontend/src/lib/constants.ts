// src/lib/constants.ts

// ==============================================
// FRONTEND CONSTANTS - Task Manager
// Configuración centralizada para el Frontend
// ==============================================

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

// API Endpoints
export const API_ENDPOINTS = {
  // Auth Service
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify-token',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  // User Service
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    SESSIONS: '/users/sessions',
    TERMINATE_SESSION: '/users/sessions',
  },
  // Task Service
  TASKS: {
    LIST: '/tasks',
    CREATE: '/tasks',
    DETAIL: (id: string) => `/tasks/${id}`,
    UPDATE: (id: string) => `/tasks/${id}`,
    DELETE: (id: string) => `/tasks/${id}`,
    STATS: '/tasks/stats',
    SEARCH: '/tasks/search',
  },
  // Category Service
  CATEGORIES: {
    LIST: '/categories',
    CREATE: '/categories',
    DETAIL: (id: string) => `/categories/${id}`,
    UPDATE: (id: string) => `/categories/${id}`,
    DELETE: (id: string) => `/categories/${id}`,
    TASKS: (id: string) => `/categories/${id}/tasks`,
  },
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',

  // Task errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ACCESS_DENIED: 'TASK_ACCESS_DENIED',
  INVALID_TASK_STATUS: 'INVALID_TASK_STATUS',
  INVALID_TASK_PRIORITY: 'INVALID_TASK_PRIORITY',

  // Category errors
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_ALREADY_EXISTS: 'CATEGORY_ALREADY_EXISTS',
  CATEGORY_HAS_TASKS: 'CATEGORY_HAS_TASKS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  // Auth
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Sesión cerrada correctamente',
  REGISTER_SUCCESS: 'Cuenta creada exitosamente',
  PASSWORD_CHANGED: 'Contraseña cambiada exitosamente',

  // Tasks
  TASK_CREATED: 'Tarea creada exitosamente',
  TASK_UPDATED: 'Tarea actualizada exitosamente',
  TASK_DELETED: 'Tarea eliminada exitosamente',
  TASK_COMPLETED: 'Tarea marcada como completada',

  // Categories
  CATEGORY_CREATED: 'Categoría creada exitosamente',
  CATEGORY_UPDATED: 'Categoría actualizada exitosamente',
  CATEGORY_DELETED: 'Categoría eliminada exitosamente',

  // Profile
  PROFILE_UPDATED: 'Perfil actualizado exitosamente',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Email o contraseña incorrectos',
  TOKEN_EXPIRED: 'La sesión ha expirado. Por favor, inicia sesión nuevamente',
  UNAUTHORIZED: 'No tienes permisos para realizar esta acción',
  USER_NOT_FOUND: 'Usuario no encontrado',

  // Tasks
  TASK_NOT_FOUND: 'Tarea no encontrada',
  TASK_ACCESS_DENIED: 'No tienes permisos para acceder a esta tarea',

  // Categories
  CATEGORY_NOT_FOUND: 'Categoría no encontrada',
  CATEGORY_HAS_TASKS: 'No se puede eliminar una categoría que contiene tareas',

  // Network
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet',
  SERVICE_UNAVAILABLE: 'Servicio no disponible temporalmente',
  TIMEOUT_ERROR: 'La petición ha excedido el tiempo límite',

  // Generic
  UNKNOWN_ERROR: 'Ha ocurrido un error inesperado',
  VALIDATION_ERROR: 'Los datos ingresados no son válidos',
} as const;

// Task Configuration
export const TASK_CONFIG = {
  STATUSES: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    ON_HOLD: 'ON_HOLD',
  },
  PRIORITIES: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_TAGS_COUNT: 10,
} as const;

// Category Configuration
export const CATEGORY_CONFIG = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  DEFAULT_COLORS: [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#84cc16', // Lime
  ],
  DEFAULT_ICONS: [
    'folder',
    'briefcase',
    'heart',
    'star',
    'flag',
    'tag',
    'bookmark',
    'target',
  ],
} as const;

// UI Configuration
export const UI_CONFIG = {
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
    MAX_PAGE_SIZE: 100,
  },

  // Toasts
  TOAST: {
    DURATION: 4000,
    POSITIONS: {
      TOP_RIGHT: 'top-right',
      TOP_LEFT: 'top-left',
      BOTTOM_RIGHT: 'bottom-right',
      BOTTOM_LEFT: 'bottom-left',
      TOP_CENTER: 'top-center',
      BOTTOM_CENTER: 'bottom-center',
    } as const,
  },

  // Animations
  ANIMATIONS: {
    DURATIONS: {
      FAST: 150,
      NORMAL: 300,
      SLOW: 500,
    },
    EASINGS: {
      IN: 'ease-in',
      OUT: 'ease-out',
      IN_OUT: 'ease-in-out',
    },
  },

  // Themes
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system',
  } as const,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'task_manager_token',
  REFRESH_TOKEN: 'task_manager_refresh_token',
  USER_DATA: 'task_manager_user',
  SESSION_ID: 'task_manager_session',

  // UI State
  THEME: 'task_manager_theme',
  SIDEBAR_COLLAPSED: 'task_manager_sidebar_collapsed',
  TASK_VIEW_MODE: 'task_manager_task_view',
  LAST_CATEGORY: 'task_manager_last_category',

  // Filters & Sorting
  TASK_FILTERS: 'task_manager_task_filters',
  TASK_SORT: 'task_manager_task_sort',

  // Settings
  NOTIFICATION_SETTINGS: 'task_manager_notifications',
  LANGUAGE: 'task_manager_language',
} as const;

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MAX_LENGTH: 255,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  TASK: {
    TITLE: {
      MIN_LENGTH: 1,
      MAX_LENGTH: TASK_CONFIG.MAX_TITLE_LENGTH,
    },
    DESCRIPTION: {
      MAX_LENGTH: TASK_CONFIG.MAX_DESCRIPTION_LENGTH,
    },
  },
  CATEGORY: {
    NAME: {
      MIN_LENGTH: 1,
      MAX_LENGTH: CATEGORY_CONFIG.MAX_NAME_LENGTH,
    },
  },
} as const;

// Route Paths
export const ROUTES = {
  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Main App
  DASHBOARD: '/dashboard',
  TASKS: '/tasks',
  TASK_DETAIL: (id: string) => `/tasks/${id}`,
  CATEGORIES: '/categories',
  PROFILE: '/profile',
  SETTINGS: '/settings',

  // Landing
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_DARK_MODE: true,
  ENABLE_CATEGORIES: true,
  ENABLE_TASK_ATTACHMENTS: false,
  ENABLE_TASK_TAGS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_STATS_DASHBOARD: true,
  ENABLE_EXPORT_TASKS: false,
  ENABLE_OFFLINE_MODE: false,
} as const;

// Environment URLs
export const ENV_URLS = {
  AUTH_SERVICE:
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_AUTH_SERVICE_URL_DEV
      : process.env.NEXT_PUBLIC_AUTH_SERVICE_URL,
  TASK_SERVICE:
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_TASK_SERVICE_URL_DEV
      : process.env.NEXT_PUBLIC_TASK_SERVICE_URL,
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  DATE_ONLY: 'yyyy-MM-dd',
  HUMAN_READABLE: 'PPP',
  WITH_TIME: "PPP 'a las' p",
  RELATIVE: 'relative',
} as const;

// Query Keys for React Query
export const QUERY_KEYS = {
  // Auth
  AUTH_USER: 'auth.user',
  AUTH_SESSIONS: 'auth.sessions',

  // Tasks
  TASKS: 'tasks',
  TASK: (id: string) => ['tasks', id],
  TASK_STATS: 'tasks.stats',

  // Categories
  CATEGORIES: 'categories',
  CATEGORY: (id: string) => ['categories', id],
  CATEGORY_TASKS: (id: string) => ['categories', id, 'tasks'],
} as const;

// Mutation Keys for React Query
export const MUTATION_KEYS = {
  // Auth
  LOGIN: 'auth.login',
  REGISTER: 'auth.register',
  LOGOUT: 'auth.logout',
  REFRESH_TOKEN: 'auth.refresh',

  // Tasks
  CREATE_TASK: 'tasks.create',
  UPDATE_TASK: 'tasks.update',
  DELETE_TASK: 'tasks.delete',

  // Categories
  CREATE_CATEGORY: 'categories.create',
  UPDATE_CATEGORY: 'categories.update',
  DELETE_CATEGORY: 'categories.delete',

  // Profile
  UPDATE_PROFILE: 'profile.update',
  CHANGE_PASSWORD: 'profile.changePassword',
} as const;

// Priority & Status Display Maps
export const DISPLAY_MAPS = {
  TASK_STATUS: {
    PENDING: { label: 'Pendiente', color: 'yellow' },
    IN_PROGRESS: { label: 'En Progreso', color: 'blue' },
    COMPLETED: { label: 'Completada', color: 'green' },
    CANCELLED: { label: 'Cancelada', color: 'red' },
    ON_HOLD: { label: 'En Espera', color: 'gray' },
  },
  TASK_PRIORITY: {
    LOW: { label: 'Baja', color: 'gray', weight: 1 },
    MEDIUM: { label: 'Media', color: 'blue', weight: 2 },
    HIGH: { label: 'Alta', color: 'orange', weight: 3 },
    URGENT: { label: 'Urgente', color: 'red', weight: 4 },
  },
} as const;

// Sort Options
export const SORT_OPTIONS = {
  FIELDS: {
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
    DUE_DATE: 'dueDate',
    PRIORITY: 'priority',
    STATUS: 'status',
    TITLE: 'title',
  },
  ORDERS: {
    ASC: 'asc',
    DESC: 'desc',
  },
  DEFAULT: {
    FIELD: 'createdAt',
    ORDER: 'desc',
  },
} as const;

// Filter Options
export const FILTER_OPTIONS = {
  FIELDS: {
    STATUS: 'status',
    PRIORITY: 'priority',
    CATEGORY_ID: 'categoryId',
    DUE_DATE: 'dueDate',
    CREATED_AT: 'createdAt',
    HAS_DUE_DATE: 'hasDueDate',
    IS_OVERDUE: 'isOverdue',
    TAGS: 'tags',
    SEARCH: 'search',
  },
  DUE_DATE_RANGES: {
    TODAY: 'today',
    TOMORROW: 'tomorrow',
    THIS_WEEK: 'thisWeek',
    NEXT_WEEK: 'nextWeek',
    OVERDUE: 'overdue',
    NO_DUE_DATE: 'noDueDate',
  },
} as const;

// Event Types for Analytics
export const EVENT_TYPES = {
  // User Actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',

  // Task Actions
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_COMPLETED: 'task.completed',
  TASK_STATUS_CHANGED: 'task.status.changed',

  // Category Actions
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',

  // UI Interactions
  SIDEBAR_TOGGLED: 'ui.sidebar.toggled',
  THEME_CHANGED: 'ui.theme.changed',
  VIEW_MODE_CHANGED: 'ui.viewMode.changed',

  // Search & Filter
  SEARCH_PERFORMED: 'search.performed',
  FILTER_APPLIED: 'filter.applied',
  SORT_CHANGED: 'sort.changed',

  // Errors
  API_ERROR: 'error.api',
  NETWORK_ERROR: 'error.network',
  VALIDATION_ERROR: 'error.validation',
} as const;

// Cache Keys
export const CACHE_KEYS = {
  // User Data
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  USER_SESSIONS: (userId: string) => `user:${userId}:sessions`,

  // Tasks
  USER_TASKS: (userId: string) => `user:${userId}:tasks`,
  TASK_DETAIL: (taskId: string) => `task:${taskId}`,
  TASK_STATS: (userId: string) => `user:${userId}:stats`,

  // Categories
  USER_CATEGORIES: (userId: string) => `user:${userId}:categories`,
  CATEGORY_DETAIL: (categoryId: string) => `category:${categoryId}`,
  CATEGORY_TASKS: (categoryId: string) => `category:${categoryId}:tasks`,

  // Search & Filters
  SEARCH_RESULTS: (userId: string, query: string) =>
    `search:${userId}:${Buffer.from(query).toString('base64')}`,
  FILTER_RESULTS: (userId: string, filters: string) =>
    `filter:${userId}:${Buffer.from(filters).toString('base64')}`,
} as const;

// Cache TTL (Time To Live) in milliseconds
export const CACHE_TTL = {
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  USER_SESSIONS: 5 * 60 * 1000, // 5 minutes
  TASKS: 3 * 60 * 1000, // 3 minutes
  TASK_DETAIL: 5 * 60 * 1000, // 5 minutes
  CATEGORIES: 10 * 60 * 1000, // 10 minutes
  STATS: 5 * 60 * 1000, // 5 minutes
  SEARCH_RESULTS: 2 * 60 * 1000, // 2 minutes
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  // Global
  TOGGLE_SIDEBAR: 'cmd+b',
  TOGGLE_THEME: 'cmd+shift+t',
  SEARCH: 'cmd+k',

  // Tasks
  NEW_TASK: 'cmd+n',
  SAVE_TASK: 'cmd+s',
  DELETE_TASK: 'cmd+d',
  MARK_COMPLETE: 'cmd+enter',

  // Navigation
  GO_TO_DASHBOARD: 'g d',
  GO_TO_TASKS: 'g t',
  GO_TO_CATEGORIES: 'g c',
  GO_TO_PROFILE: 'g p',

  // Quick Actions
  QUICK_FILTER: 'f',
  QUICK_SORT: 's',
  REFRESH: 'r',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  MAX_FILES: 5,
} as const;

// Responsive Breakpoints (matching Tailwind)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Animation Variants for Framer Motion
export const ANIMATION_VARIANTS = {
  FADE_IN: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  SLIDE_UP: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  SLIDE_DOWN: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  SLIDE_LEFT: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  SLIDE_RIGHT: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  SCALE: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
} as const;

// Form Validation Messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'Este campo es obligatorio',
  INVALID_EMAIL: 'Ingresa un email válido',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
  PASSWORD_TOO_WEAK:
    'La contraseña debe contener mayúsculas, minúsculas, números y símbolos',
  PASSWORDS_DONT_MATCH: 'Las contraseñas no coinciden',
  INVALID_DATE: 'Ingresa una fecha válida',
  DATE_IN_PAST: 'La fecha no puede ser en el pasado',
  MAX_LENGTH: (max: number) => `Máximo ${max} caracteres`,
  MIN_LENGTH: (min: number) => `Mínimo ${min} caracteres`,
} as const;

// Social Media Links
export const SOCIAL_LINKS = {
  GITHUB: process.env.NEXT_PUBLIC_GITHUB_URL || '#',
  TWITTER: process.env.NEXT_PUBLIC_TWITTER_URL || '#',
  LINKEDIN: process.env.NEXT_PUBLIC_LINKEDIN_URL || '#',
  DOCS: process.env.NEXT_PUBLIC_DOCS_URL || '#',
} as const;

// Contact Information
export const CONTACT_INFO = {
  EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@taskmanager.com',
  PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+1 (555) 123-4567',
} as const;

// SEO Configuration
export const SEO_CONFIG = {
  DEFAULT_TITLE: 'Task Manager Pro',
  TITLE_TEMPLATE: '%s | Task Manager Pro',
  DEFAULT_DESCRIPTION:
    'Gestiona tus tareas de manera eficiente con Task Manager Pro',
  KEYWORDS: [
    'task manager',
    'productivity',
    'todo list',
    'project management',
    'gestión de tareas',
    'productividad',
  ],
  AUTHOR: 'Task Manager Team',
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://taskmanager.com',
  TWITTER_HANDLE: '@taskmanagerpro',
} as const;

// PWA Configuration
export const PWA_CONFIG = {
  NAME: process.env.NEXT_PUBLIC_PWA_NAME || 'Task Manager Pro',
  SHORT_NAME: process.env.NEXT_PUBLIC_PWA_SHORT_NAME || 'TaskManager',
  DESCRIPTION:
    process.env.NEXT_PUBLIC_PWA_DESCRIPTION ||
    'Gestiona tus tareas de manera eficiente',
  THEME_COLOR: '#6366f1',
  BACKGROUND_COLOR: '#ffffff',
} as const;

// Export types for better TypeScript support
export type TaskStatus = keyof typeof TASK_CONFIG.STATUSES;
export type TaskPriority = keyof typeof TASK_CONFIG.PRIORITIES;
export type Theme = keyof typeof UI_CONFIG.THEMES;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export type SortField = keyof typeof SORT_OPTIONS.FIELDS;
export type SortOrder = keyof typeof SORT_OPTIONS.ORDERS;
export type FilterField = keyof typeof FILTER_OPTIONS.FIELDS;

// Export all constants as default
export default {
  HTTP_STATUS,
  API_ENDPOINTS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  TASK_CONFIG,
  CATEGORY_CONFIG,
  UI_CONFIG,
  STORAGE_KEYS,
  API_CONFIG,
  VALIDATION_RULES,
  ROUTES,
  FEATURES,
  ENV_URLS,
  DATE_FORMATS,
  QUERY_KEYS,
  MUTATION_KEYS,
  DISPLAY_MAPS,
  SORT_OPTIONS,
  FILTER_OPTIONS,
  EVENT_TYPES,
  CACHE_KEYS,
  CACHE_TTL,
  KEYBOARD_SHORTCUTS,
  NOTIFICATION_TYPES,
  FILE_UPLOAD,
  BREAKPOINTS,
  ANIMATION_VARIANTS,
  VALIDATION_MESSAGES,
  SOCIAL_LINKS,
  CONTACT_INFO,
  SEO_CONFIG,
  PWA_CONFIG,
};
