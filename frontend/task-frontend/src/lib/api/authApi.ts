// src/lib/api/authApi.ts
import { AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { authApiClient } from './apiClient';
import { 
  SUCCESS_MESSAGES, 
  TOKEN_CONFIG,
  CACHE_TTL 
} from '@/lib/constants';

// Types
interface ApiResponse<T = any> {
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
  };
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  session: {
    id: string;
    expiresAt: string;
  };
}

interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

class AuthApi {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<ApiResponse<LoginResponse>> = await authApiClient.post(
        '/auth/login',
        credentials
      );

      if (response.data.success && response.data.data) {
        this.handleSuccessfulAuth(response.data.data, credentials.rememberMe);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      console.error('[AuthApi] Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<ApiResponse<LoginResponse>> = await authApiClient.post(
        '/auth/register',
        userData
      );

      if (response.data.success && response.data.data) {
        this.handleSuccessfulAuth(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Registration failed');
    } catch (error) {
      console.error('[AuthApi] Register error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Get session ID for server-side logout
      const sessionId = this.getStoredSessionId();
      
      if (sessionId) {
        await authApiClient.post('/auth/logout', { sessionId });
      }
    } catch (error) {
      console.warn('[AuthApi] Logout error (continuing with client cleanup):', error);
    } finally {
      // Always clear client-side data
      this.clearAuthData();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response: AxiosResponse<ApiResponse<RefreshTokenResponse>> = await authApiClient.post(
        '/auth/refresh-token',
        { refreshToken }
      );

      if (response.data.success && response.data.data) {
        const { accessToken, expiresIn } = response.data.data;
        this.storeAccessToken(accessToken, expiresIn);
        return accessToken;
      }

      throw new Error(response.data.message || 'Token refresh failed');
    } catch (error) {
      console.error('[AuthApi] Token refresh error:', error);
      this.clearAuthData();
      throw error;
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken(token?: string): Promise<UserProfile> {
    try {
      const tokenToVerify = token || this.getStoredAccessToken();
      if (!tokenToVerify) {
        throw new Error('No token to verify');
      }

      const response: AxiosResponse<ApiResponse<UserProfile>> = await authApiClient.post(
        '/auth/verify-token',
        { token: tokenToVerify }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error(response.data.message || 'Token verification failed');
    } catch (error) {
      console.error('[AuthApi] Token verification error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    try {
      const response: AxiosResponse<ApiResponse<UserProfile>> = await authApiClient.get(
        '/users/profile'
      );

      if (response.data.success && response.data.data) {
        // Cache profile data
        this.cacheUserProfile(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to get profile');
    } catch (error) {
      console.error('[AuthApi] Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const response: AxiosResponse<ApiResponse<UserProfile>> = await authApiClient.put(
        '/users/profile',
        profileData
      );

      if (response.data.success && response.data.data) {
        // Update cached profile
        this.cacheUserProfile(response.data.data);
        return response.data.data;
      }

      throw new Error(response.data.message || 'Profile update failed');
    } catch (error) {
      console.error('[AuthApi] Update profile error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(passwordData: ChangePasswordRequest): Promise<void> {
    try {
      const response: AxiosResponse<ApiResponse> = await authApiClient.put(
        '/users/change-password',
        passwordData
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Password change failed');
      }
    } catch (error) {
      console.error('[AuthApi] Change password error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getStoredAccessToken();
    const refreshToken = this.getStoredRefreshToken();
    return !!(token || refreshToken);
  }

  /**
   * Get current access token
   */
  getCurrentToken(): string | null {
    return this.getStoredAccessToken();
  }

  /**
   * Get cached user profile
   */
  getCachedProfile(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem('user_profile_cache');
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_TTL.USER_PROFILE * 1000;
      
      return isExpired ? null : data;
    } catch {
      return null;
    }
  }

  // Private methods
  private handleSuccessfulAuth(authData: LoginResponse, rememberMe = false): void {
    const { tokens, session, user } = authData;
    
    // Store tokens
    this.storeAccessToken(tokens.accessToken, tokens.expiresIn, rememberMe);
    this.storeRefreshToken(tokens.refreshToken, rememberMe);
    this.storeSessionId(session.id, rememberMe);
    
    // Cache user profile
    this.cacheUserProfile(user);
    
    // Set token in API client
    authApiClient.setAuthToken(tokens.accessToken);
  }

  private storeAccessToken(token: string, expiresIn: number, persistent = false): void {
    const storage = persistent ? 'localStorage' : 'sessionStorage';
    const storageKey = process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token';
    
    // Store in cookies (for SSR)
    const cookieOptions = {
      expires: persistent ? 7 : undefined, // 7 days if persistent
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };
    Cookies.set(storageKey, token, cookieOptions);
    
    // Store in browser storage
    if (typeof window !== 'undefined') {
      const storageMethod = persistent ? localStorage : sessionStorage;
      storageMethod.setItem(storageKey, token);
      storageMethod.setItem(`${storageKey}_expires`, (Date.now() + expiresIn * 1000).toString());
    }
  }

  private storeRefreshToken(token: string, persistent = false): void {
    const storageKey = process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY || 'task_manager_refresh_token';
    
    // Store in cookies
    const cookieOptions = {
      expires: persistent ? 7 : undefined,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };
    Cookies.set(storageKey, token, cookieOptions);
    
    // Store in browser storage
    if (typeof window !== 'undefined') {
      const storageMethod = persistent ? localStorage : sessionStorage;
      storageMethod.setItem(storageKey, token);
    }
  }

  private storeSessionId(sessionId: string, persistent = false): void {
    const storageKey = process.env.NEXT_PUBLIC_SESSION_STORAGE_KEY || 'task_manager_session';
    
    if (typeof window !== 'undefined') {
      const storageMethod = persistent ? localStorage : sessionStorage;
      storageMethod.setItem(storageKey, sessionId);
    }
  }

  private cacheUserProfile(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheData = {
        data: profile,
        timestamp: Date.now(),
      };
      localStorage.setItem('user_profile_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[AuthApi] Failed to cache user profile:', error);
    }
  }

  private getStoredAccessToken(): string | null {
    const storageKey = process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token';
    
    // Try cookies first (for SSR compatibility)
    const cookieToken = Cookies.get(storageKey);
    if (cookieToken) return cookieToken;
    
    // Try browser storage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    }
    
    return null;
  }

  private getStoredRefreshToken(): string | null {
    const storageKey = process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY || 'task_manager_refresh_token';
    
    const cookieToken = Cookies.get(storageKey);
    if (cookieToken) return cookieToken;
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    }
    
    return null;
  }

  private getStoredSessionId(): string | null {
    const storageKey = process.env.NEXT_PUBLIC_SESSION_STORAGE_KEY || 'task_manager_session';
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
    }
    
    return null;
  }

  private clearAuthData(): void {
    const tokenKey = process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token';
    const refreshKey = process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY || 'task_manager_refresh_token';
    const sessionKey = process.env.NEXT_PUBLIC_SESSION_STORAGE_KEY || 'task_manager_session';
    
    // Clear cookies
    Cookies.remove(tokenKey);
    Cookies.remove(refreshKey);
    
    // Clear browser storage
    if (typeof window !== 'undefined') {
      [localStorage, sessionStorage].forEach(storage => {
        storage.removeItem(tokenKey);
        storage.removeItem(`${tokenKey}_expires`);
        storage.removeItem(refreshKey);
        storage.removeItem(sessionKey);
        storage.removeItem('user_profile_cache');
      });
    }
    
    // Remove token from API client
    authApiClient.removeAuthToken();
  }
}

// Export singleton instance
export const authApi = new AuthApi();
export default authApi;