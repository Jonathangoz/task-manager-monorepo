// src/types/api.types.ts

// ==============================================
// HTTP & API CORE TYPES
// ==============================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type HttpStatus = 
  | 200 | 201 | 204 
  | 400 | 401 | 403 | 404 | 409 | 422 | 429 
  | 500 | 503;

// ==============================================
// GENERIC API RESPONSE TYPES
// ==============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  details?: any;
  field?: string;
  timestamp?: string;
}

export interface ApiMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
  version?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==============================================
// REQUEST/RESPONSE WRAPPER TYPES
// ==============================================

export interface ApiRequest<T = any> {
  method: HttpMethod;
  url: string;
  data?: T;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: ApiError;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

// ==============================================
// AUTH SERVICE TYPES
// ==============================================

// Auth Request Types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
}

// Auth Response Types
export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  session: UserSession;
}

export interface RegisterResponse {
  user: User;
  message: string;
  verificationRequired: boolean;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: 'Bearer';
}

export interface UserSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  bio?: string;
  avatar?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  role: UserRole;
  preferences?: UserPreferences;
  stats?: UserStats;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  taskReminders: boolean;
  taskDeadlines: boolean;
  weeklyReport: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private';
  taskVisibility: 'public' | 'private';
  showOnlineStatus: boolean;
}

export interface UserStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueeTasks: number;
  categoriesCount: number;
  completionRate: number;
  averageCompletionTime?: number;
}

export type UserRole = 'user' | 'admin' | 'moderator';

// Token Verification Types
export interface TokenVerificationResponse {
  valid: boolean;
  user?: User;
  session?: UserSession;
  permissions?: string[];
}

// ==============================================
// TASK SERVICE TYPES
// ==============================================

// Task Request Types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  dueDate?: string;
  estimatedHours?: number;
  tags?: string[];
  attachments?: TaskAttachment[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  attachments?: TaskAttachment[];
  completedAt?: string;
}

export interface TaskFiltersRequest {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  categoryId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
  hasDueDate?: boolean;
  tags?: string | string[];
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface TaskSortRequest {
  field: TaskSortField;
  order: SortOrder;
}

export interface GetTasksRequest {
  page?: number;
  limit?: number;
  filters?: TaskFiltersRequest;
  sort?: TaskSortRequest;
  includeCompleted?: boolean;
  includeDeleted?: boolean;
}

// Task Response Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  categoryId?: string;
  category?: TaskCategory;
  userId: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  progress?: number;
}

export interface TasksResponse {
  tasks: Task[];
  meta: PaginationMeta;
  filters?: TaskFiltersRequest;
  sort?: TaskSortRequest;
}

export interface TaskStatsResponse {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byCategory: Record<string, number>;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completionRate: number;
  averageCompletionTime?: number;
  productivityTrends?: ProductivityTrend[];
}

export interface ProductivityTrend {
  date: string;
  completed: number;
  created: number;
  productivity: number;
}

// Category Request Types
export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface GetCategoriesRequest {
  includeTaskCount?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'createdAt' | 'taskCount';
  sortOrder?: SortOrder;
}

// Category Response Types
export interface TaskCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  userId: string;
  isDefault: boolean;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesResponse {
  categories: TaskCategory[];
  defaultCategory?: TaskCategory;
  totalCount: number;
}

// Attachment Types
export interface TaskAttachment {
  id: string;
  taskId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface UploadAttachmentRequest {
  file: File;
  taskId: string;
}

export interface UploadAttachmentResponse {
  attachment: TaskAttachment;
  uploadUrl?: string;
}

// ==============================================
// ENUM TYPES
// ==============================================

export type TaskStatus = 
  | 'PENDING' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'ON_HOLD';

export type TaskPriority = 
  | 'LOW' 
  | 'MEDIUM' 
  | 'HIGH' 
  | 'URGENT';

export type TaskSortField = 
  | 'createdAt' 
  | 'updatedAt' 
  | 'dueDate' 
  | 'priority' 
  | 'status' 
  | 'title';

export type SortOrder = 'asc' | 'desc';

// ==============================================
// ERROR CODE TYPES
// ==============================================

// Auth Service Error Codes
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_REQUIRED'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'USER_NOT_FOUND'
  | 'USER_ALREADY_EXISTS'
  | 'USER_INACTIVE'
  | 'USER_NOT_VERIFIED'
  | 'VALIDATION_ERROR'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'INVALID_USERNAME'
  | 'PASSWORD_TOO_WEAK'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'MAX_SESSIONS_EXCEEDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TOO_MANY_LOGIN_ATTEMPTS'
  | 'DATABASE_ERROR'
  | 'REDIS_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// Task Service Error Codes
export type TaskErrorCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_EXISTS'
  | 'TASK_ACCESS_DENIED'
  | 'TASK_CANNOT_BE_DELETED'
  | 'INVALID_TASK_STATUS'
  | 'INVALID_TASK_PRIORITY'
  | 'TASK_OVERDUE'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_ALREADY_EXISTS'
  | 'CATEGORY_ACCESS_DENIED'
  | 'CATEGORY_HAS_TASKS'
  | 'CATEGORY_LIMIT_EXCEEDED'
  | 'INVALID_TOKEN'
  | 'UNAUTHORIZED_ACCESS'
  | 'VALIDATION_ERROR'
  | 'INVALID_DATE_FORMAT'
  | 'INVALID_DUE_DATE'
  | 'INVALID_PAGINATION'
  | 'INVALID_SORT_FIELD'
  | 'INVALID_FILTER'
  | 'DATABASE_ERROR'
  | 'REDIS_ERROR'
  | 'AUTH_SERVICE_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED';

export type ApiErrorCode = AuthErrorCode | TaskErrorCode;

// ==============================================
// SEARCH & ANALYTICS TYPES
// ==============================================

export interface SearchRequest {
  query: string;
  filters?: TaskFiltersRequest;
  limit?: number;
  includeCategories?: boolean;
}

export interface SearchResponse {
  tasks: Task[];
  categories: TaskCategory[];
  totalResults: number;
  query: string;
  suggestions?: string[];
}

export interface AnalyticsRequest {
  dateFrom?: string;
  dateTo?: string;
  granularity?: 'day' | 'week' | 'month';
  includeCategories?: boolean;
}

export interface AnalyticsResponse {
  productivity: ProductivityTrend[];
  categoryBreakdown: CategoryStats[];
  priorityDistribution: PriorityStats[];
  completionRateOverTime: CompletionRateData[];
  summary: AnalyticsSummary;
}

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  taskCount: number;
  completedCount: number;
  completionRate: number;
}

export interface PriorityStats {
  priority: TaskPriority;
  count: number;
  percentage: number;
  averageCompletionTime?: number;
}

export interface CompletionRateData {
  date: string;
  rate: number;
  completed: number;
  total: number;
}

export interface AnalyticsSummary {
  totalTasks: number;
  completedTasks: number;
  averageCompletionTime: number;
  productivityScore: number;
  mostProductiveDay: string;
  topCategory: string;
  improvementSuggestions: string[];
}

// ==============================================
// NOTIFICATION TYPES
// ==============================================

export interface NotificationRequest {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  scheduleFor?: string;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export type NotificationType =
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'weekly_summary'
  | 'system_update'
  | 'achievement_unlocked';

// ==============================================
// EXPORT TYPES
// ==============================================

export interface ExportRequest {
  format: 'json' | 'csv' | 'pdf';
  filters?: TaskFiltersRequest;
  includeCompleted?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface ExportResponse {
  url: string;
  filename: string;
  size: number;
  expiresAt: string;
  format: string;
}

// ==============================================
// WEBHOOK TYPES (Future feature)
// ==============================================

export interface WebhookRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive?: boolean;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.completed'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted';

// ==============================================
// UTILITY TYPES
// ==============================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// API Client Configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers?: Record<string, string>;
}

// Request interceptor types
export interface RequestInterceptor {
  onRequest?: (config: any) => any;
  onRequestError?: (error: any) => Promise<any>;
}

export interface ResponseInterceptor {
  onResponse?: (response: any) => any;
  onResponseError?: (error: any) => Promise<any>;
}