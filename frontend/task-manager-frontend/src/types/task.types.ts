// src/types/task.types.ts

// ==========================================
// TASK TYPES - FRONTEND TYPE DEFINITIONS
// ==========================================

// Task Status and Priority Enums
export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Core Task Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  categoryId?: string;
  category?: Category;
  userId: string;
  tags: string[];
  dueDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  userId: string;
  tasksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

// Form Data Types
export interface CreateTaskData {
  title: string;
  description?: string;
  priority: TaskPriority;
  categoryId?: string;
  tags: string[];
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  tags?: string[];
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color: string;
  icon: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// Filter and Search Types
export interface TaskFilters {
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

export interface TaskSearchParams {
  query?: string;
  filters?: TaskFilters;
  sort?: SortOptions;
  pagination?: PaginationParams;
}

export interface SortOptions {
  field:
    | 'createdAt'
    | 'updatedAt'
    | 'dueDate'
    | 'priority'
    | 'status'
    | 'title';
  order: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// API Response Types
export interface TasksResponse {
  tasks: Task[];
  pagination: PaginationMeta;
  filters?: TaskFilters;
  sort?: SortOptions;
}

export interface CategoriesResponse {
  categories: Category[];
  pagination: PaginationMeta;
}

export interface TaskStatsResponse {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  completed: number;
  completionRate: number;
  averageCompletionTime?: number;
  productivity: ProductivityStats;
}

export interface ProductivityStats {
  tasksCreatedThisWeek: number;
  tasksCompletedThisWeek: number;
  completionRateThisWeek: number;
  streak: number;
  bestDay: string;
  averageTasksPerDay: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// State Management Types
export interface TaskState {
  tasks: Task[];
  categories: Category[];
  selectedTask: Task | null;
  selectedCategory: Category | null;
  filters: TaskFilters;
  sortOptions: SortOptions;
  pagination: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  stats: TaskStatsResponse | null;
}

export interface TaskContextType {
  // State
  tasks: Task[];
  categories: Category[];
  selectedTask: Task | null;
  filters: TaskFilters;
  sortOptions: SortOptions;
  pagination: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  stats: TaskStatsResponse | null;

  // Task Actions
  createTask: (data: CreateTaskData) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskData) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task>;
  getTasks: (params?: TaskSearchParams) => Promise<TasksResponse>;
  duplicateTask: (id: string) => Promise<Task>;
  bulkUpdateTasks: (
    ids: string[],
    data: Partial<UpdateTaskData>,
  ) => Promise<void>;
  bulkDeleteTasks: (ids: string[]) => Promise<void>;

  // Category Actions
  createCategory: (data: CreateCategoryData) => Promise<Category>;
  updateCategory: (id: string, data: UpdateCategoryData) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  getCategories: () => Promise<Category[]>;

  // Filter and Search Actions
  setFilters: (filters: Partial<TaskFilters>) => void;
  setSortOptions: (sort: SortOptions) => void;
  setPagination: (pagination: Partial<PaginationParams>) => void;
  searchTasks: (query: string) => Promise<Task[]>;
  clearFilters: () => void;

  // Utility Actions
  getTaskStats: () => Promise<TaskStatsResponse>;
  exportTasks: (format: 'json' | 'csv') => Promise<Blob>;
  setSelectedTask: (task: Task | null) => void;
  clearError: () => void;
  refreshTasks: () => Promise<void>;
}

// Hook Return Types
export interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationMeta;
  createTask: (data: CreateTaskData) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskData) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

export interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  createCategory: (data: CreateCategoryData) => Promise<Category>;
  updateCategory: (id: string, data: UpdateCategoryData) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export interface UseTaskStatsReturn {
  stats: TaskStatsResponse | null;
  isLoading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
}

// Form State Types
export interface TaskFormState {
  data: CreateTaskData | UpdateTaskData;
  errors: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface CategoryFormState {
  data: CreateCategoryData | UpdateCategoryData;
  errors: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Component Props Types
export interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onPriorityChange?: (taskId: string, priority: TaskPriority) => void;
  showCategory?: boolean;
  showDueDate?: boolean;
  compact?: boolean;
}

export interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  onTaskSelect?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  showFilters?: boolean;
  showPagination?: boolean;
  viewMode?: 'grid' | 'list';
}

export interface TaskFiltersProps {
  filters: TaskFilters;
  categories: Category[];
  onFiltersChange: (filters: Partial<TaskFilters>) => void;
  onClearFilters: () => void;
  showAdvanced?: boolean;
}

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (task: Task) => void;
  initialData?: Partial<CreateTaskData>;
  categoryId?: string;
}

export interface EditTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSuccess?: (task: Task) => void;
}

export interface CategorySelectProps {
  categories: Category[];
  value?: string;
  onChange: (categoryId: string | undefined) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  onCreate?: (data: CreateCategoryData) => Promise<Category>;
}

// Utility Types
export interface TaskValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface CategoryValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Dashboard Types
export interface DashboardData {
  recentTasks: Task[];
  stats: TaskStatsResponse;
  upcomingTasks: Task[];
  overdueTasks: Task[];
  categories: Category[];
  productivity: ProductivityStats;
}

// Notification Types
export interface TaskNotification {
  id: string;
  type: 'due_soon' | 'overdue' | 'completed' | 'assigned';
  taskId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// Export/Import Types
export interface TaskExportOptions {
  format: 'json' | 'csv' | 'pdf';
  filters?: TaskFilters;
  includeCompleted?: boolean;
  includeCategories?: boolean;
}

export interface TaskImportData {
  tasks: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[];
  categories?: Omit<
    Category,
    'id' | 'userId' | 'tasksCount' | 'createdAt' | 'updatedAt'
  >[];
}

// Drag and Drop Types
export interface DraggedTask {
  task: Task;
  source: {
    index: number;
    status: TaskStatus;
  };
}

export interface DropResult {
  taskId: string;
  newStatus: TaskStatus;
  newIndex: number;
}

// Error Types
export type TaskErrorCode =
  | 'TASK_NOT_FOUND'
  | 'TASK_ACCESS_DENIED'
  | 'INVALID_TASK_STATUS'
  | 'INVALID_TASK_PRIORITY'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_HAS_TASKS'
  | 'VALIDATION_ERROR';

export interface TaskError {
  code: TaskErrorCode;
  message: string;
  field?: string;
  details?: any;
}

// Event Types
export type TaskEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_status_changed'
  | 'task_completed'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted';

export interface TaskEvent {
  type: TaskEventType;
  taskId?: string;
  categoryId?: string;
  data?: any;
  timestamp: string;
}
