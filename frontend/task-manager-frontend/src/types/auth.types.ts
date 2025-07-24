// src/types/auth.types.ts

// ==========================================
// AUTH TYPES - FRONTEND TYPE DEFINITIONS
// ==========================================

// User Related Types
export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  taskReminders: boolean;
  taskUpdates: boolean;
}

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  deviceInfo?: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastAccessAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  location?: string;
}

// Login/Register Forms
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  acceptTerms: boolean;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  session: AuthSession;
}

export interface RegisterResponse {
  user: Omit<User, 'isVerified'>;
  message: string;
  verificationRequired: boolean;
}

// Password Management
export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// Profile Management
export interface ProfileUpdateData {
  username?: string;
  fullName?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

// Token Management
export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenValidationResponse {
  valid: boolean;
  user?: User;
  expiresAt?: string;
}

// Authentication State
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  session: AuthSession | null;
  error: string | null;
}

// Authentication Context
export interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  changePassword: (data: PasswordChangeData) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (data: PasswordResetData) => Promise<void>;
  clearError: () => void;
}

// Form Validation Types
export interface ValidationErrors {
  [key: string]: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationErrors;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// API Request/Response Types
export interface AuthApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface LoginApiRequest {
  email: string;
  password: string;
  deviceInfo?: Partial<DeviceInfo>;
}

export interface RegisterApiRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

// Session Management
export interface SessionInfo {
  current: AuthSession;
  active: AuthSession[];
  total: number;
}

export interface SessionTerminateRequest {
  sessionId: string;
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: string;
}

// Security Types
export interface SecurityEvent {
  type: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, any>;
}

export interface LoginAttempt {
  email: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  failureReason?: string;
}

// Authentication Hooks Types
export interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export interface UseAuthFormReturn<T> {
  formData: T;
  errors: ValidationErrors;
  isSubmitting: boolean;
  isValid: boolean;
  handleChange: (field: keyof T, value: any) => void;
  handleSubmit: (onSubmit: (data: T) => Promise<void>) => (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  setError: (field: keyof T, message: string) => void;
  clearErrors: () => void;
}

// Storage Types
export interface TokenStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: AuthTokens) => void;
  clearTokens: () => void;
  isTokenExpired: (token: string) => boolean;
}

export interface SessionStorage {
  getSession: () => AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  updateLastAccess: () => void;
}

// Component Props Types
export interface LoginFormProps {
  onSuccess?: (user: User) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
  showRegisterLink?: boolean;
}

export interface RegisterFormProps {
  onSuccess?: (user: User) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
  showLoginLink?: boolean;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRoles?: UserRole[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// Event Types
export type AuthEventType = 
  | 'login'
  | 'logout'
  | 'register'
  | 'token_refresh'
  | 'profile_update'
  | 'password_change'
  | 'session_expired'
  | 'auth_error';

export interface AuthEvent {
  type: AuthEventType;
  data?: any;
  timestamp: string;
}

// Constants Types
export type AuthErrorCode = keyof typeof import('../lib/constants').ERROR_CODES;
export type HttpStatusCode = keyof typeof import('../lib/constants').HTTP_STATUS;