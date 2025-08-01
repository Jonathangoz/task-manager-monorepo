// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/authApi';
import {
  LoginCredentials,
  RegisterData,
  User,
  AuthTokens,
  ApiResponse,
} from '@/types/auth.types';
import {
  TOKEN_CONFIG,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  CACHE_KEYS,
} from '@/lib/constants';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

export const useAuth = (): UseAuthReturn => {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const router = useRouter();

  // Función helper para actualizar el estado
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Función para limpiar tokens y estado
  const clearAuthData = useCallback(() => {
    Cookies.remove(TOKEN_CONFIG.ACCESS_TOKEN_STORAGE_KEY);
    Cookies.remove(TOKEN_CONFIG.REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_CONFIG.SESSION_STORAGE_KEY);

    updateState({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  }, [updateState]);

  // Función para establecer tokens
  const setAuthTokens = useCallback(
    (tokens: AuthTokens, user: User) => {
      // Guardar tokens en cookies seguras
      Cookies.set(TOKEN_CONFIG.ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken, {
        expires: new Date(tokens.expiresAt),
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        httpOnly: false, // Necesario para acceso desde JS
      });

      if (tokens.refreshToken) {
        Cookies.set(
          TOKEN_CONFIG.REFRESH_TOKEN_STORAGE_KEY,
          tokens.refreshToken,
          {
            expires: 7, // 7 días
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            httpOnly: false,
          },
        );
      }

      // Guardar información de sesión
      localStorage.setItem(
        TOKEN_CONFIG.SESSION_STORAGE_KEY,
        JSON.stringify({
          sessionId: tokens.sessionId,
          userId: user.id,
          expiresAt: tokens.expiresAt,
        }),
      );

      updateState({
        user,
        isAuthenticated: true,
        error: null,
      });
    },
    [updateState],
  );

  // Login
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<boolean> => {
      try {
        updateState({ isLoading: true, error: null });

        const response = await authApi.login(credentials);

        if (response.success && response.data) {
          const { user, tokens } = response.data;
          setAuthTokens(tokens, user);

          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESSFUL);
          return true;
        }

        throw new Error(response.message || 'Login failed');
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || error.message || 'Login failed';
        updateState({ error: errorMessage });
        toast.error(errorMessage);
        return false;
      } finally {
        updateState({ isLoading: false });
      }
    },
    [updateState, setAuthTokens],
  );

  // Register
  const register = useCallback(
    async (data: RegisterData): Promise<boolean> => {
      try {
        updateState({ isLoading: true, error: null });

        const response = await authApi.register(data);

        if (response.success && response.data) {
          const { user, tokens } = response.data;
          setAuthTokens(tokens, user);

          toast.success(SUCCESS_MESSAGES.USER_REGISTERED);
          return true;
        }

        throw new Error(response.message || 'Registration failed');
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Registration failed';
        updateState({ error: errorMessage });
        toast.error(errorMessage);
        return false;
      } finally {
        updateState({ isLoading: false });
      }
    },
    [updateState, setAuthTokens],
  );

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      updateState({ isLoading: true });

      const accessToken = Cookies.get(TOKEN_CONFIG.ACCESS_TOKEN_STORAGE_KEY);
      if (accessToken) {
        await authApi.logout();
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      clearAuthData();
      updateState({ isLoading: false });
      toast.success(SUCCESS_MESSAGES.LOGOUT_SUCCESSFUL);
      router.push('/login');
    }
  }, [updateState, clearAuthData, router]);

  // Refresh Token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshTokenValue = Cookies.get(
        TOKEN_CONFIG.REFRESH_TOKEN_STORAGE_KEY,
      );

      if (!refreshTokenValue) {
        clearAuthData();
        return false;
      }

      const response = await authApi.refreshToken();

      if (response.success && response.data) {
        const { user, tokens } = response.data;
        setAuthTokens(tokens, user);
        return true;
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuthData();
      return false;
    }
  }, [clearAuthData, setAuthTokens]);

  // Update Profile
  const updateProfile = useCallback(
    async (data: Partial<User>): Promise<boolean> => {
      try {
        updateState({ isLoading: true, error: null });

        const response = await authApi.updateProfile(data);

        if (response.success && response.data) {
          updateState({ user: response.data });
          toast.success(SUCCESS_MESSAGES.PROFILE_UPDATED);
          return true;
        }

        throw new Error(response.message || 'Profile update failed');
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Profile update failed';
        updateState({ error: errorMessage });
        toast.error(errorMessage);
        return false;
      } finally {
        updateState({ isLoading: false });
      }
    },
    [updateState],
  );

  // Check Authentication Status
  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      const accessToken = Cookies.get(TOKEN_CONFIG.ACCESS_TOKEN_STORAGE_KEY);
      const sessionData = localStorage.getItem(
        TOKEN_CONFIG.SESSION_STORAGE_KEY,
      );

      if (!accessToken || !sessionData) {
        clearAuthData();
        return;
      }

      const session = JSON.parse(sessionData);
      const isExpired = new Date() > new Date(session.expiresAt);

      if (isExpired) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          clearAuthData();
          return;
        }
      }

      // Verificar token con el servidor
      const response = await authApi.getMe();

      if (response.success && response.data) {
        updateState({
          user: response.data,
          isAuthenticated: true,
          error: null,
        });
      } else {
        clearAuthData();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuthData();
    } finally {
      updateState({ isLoading: false });
    }
  }, [clearAuthData, refreshToken, updateState]);

  // Clear Error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Auto token refresh
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(async () => {
      const sessionData = localStorage.getItem(
        TOKEN_CONFIG.SESSION_STORAGE_KEY,
      );
      if (!sessionData) return;

      const session = JSON.parse(sessionData);
      const timeUntilExpiry =
        new Date(session.expiresAt).getTime() - Date.now();

      // Renovar token 5 minutos antes de que expire
      if (timeUntilExpiry < 5 * 60 * 1000) {
        await refreshToken();
      }
    }, 60 * 1000); // Verificar cada minuto

    return () => clearInterval(interval);
  }, [state.isAuthenticated, refreshToken]);

  // Initial auth check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    clearError,
    checkAuth,
  };
};
