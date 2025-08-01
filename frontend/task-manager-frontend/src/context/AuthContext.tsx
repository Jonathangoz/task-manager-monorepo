'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import { authApi } from '@/lib/api/authApi';
import { toast } from 'sonner';

// Types
interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  // State
  state: AuthState;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

// Action types
type AuthAction =
  | { type: 'AUTH_START' }
  | {
      type: 'AUTH_SUCCESS';
      payload: {
        user: User;
        token: string;
        refreshToken: string;
        sessionId: string;
      };
    }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'TOKEN_REFRESH'; payload: { token: string } }
  | { type: 'USER_UPDATE'; payload: User }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  sessionId: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        sessionId: action.payload.sessionId,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        sessionId: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };

    case 'TOKEN_REFRESH':
      return {
        ...state,
        token: action.payload.token,
        error: null,
      };

    case 'USER_UPDATE':
      return {
        ...state,
        user: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys (from constants)
const TOKEN_KEY =
  process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token';
const REFRESH_TOKEN_KEY =
  process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY ||
  'task_manager_refresh_token';
const SESSION_KEY =
  process.env.NEXT_PUBLIC_SESSION_STORAGE_KEY || 'task_manager_session';

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const sessionId = localStorage.getItem(SESSION_KEY);

        if (token && refreshToken && sessionId) {
          // Verify token and get user data
          const userData = await authApi.getProfile();

          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: userData,
              token,
              refreshToken,
              sessionId,
            },
          });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        // Token might be expired, try to refresh
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          try {
            await refreshAuth();
          } catch (refreshError) {
            // Refresh failed, clear all tokens
            clearTokens();
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    };

    initializeAuth();
  }, []);

  // Helper functions
  const saveTokens = (
    token: string,
    refreshToken: string,
    sessionId: string,
  ) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(SESSION_KEY, sessionId);
  };

  const clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  };

  // Actions
  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await authApi.login(credentials);
      const { user, token, refreshToken, sessionId } = response;

      saveTokens(token, refreshToken, sessionId);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token, refreshToken, sessionId },
      });

      toast.success('¡Bienvenido de vuelta!');
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Error al iniciar sesión';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await authApi.register(data);
      const { user, token, refreshToken, sessionId } = response;

      saveTokens(token, refreshToken, sessionId);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token, refreshToken, sessionId },
      });

      toast.success('¡Cuenta creada exitosamente!');
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Error al crear la cuenta';
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate session on server
      await authApi.logout();
    } catch (error) {
      // Continue with logout even if server call fails
      console.warn('Logout request failed:', error);
    } finally {
      clearTokens();
      dispatch({ type: 'AUTH_LOGOUT' });
      toast.success('Sesión cerrada exitosamente');
    }
  };

  const refreshAuth = async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken(refreshToken);
      const { token } = response;

      localStorage.setItem(TOKEN_KEY, token);
      dispatch({ type: 'TOKEN_REFRESH', payload: { token } });

      return token;
    } catch (error: any) {
      clearTokens();
      dispatch({ type: 'AUTH_LOGOUT' });
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const updatedUser = await authApi.updateProfile(data);
      dispatch({ type: 'USER_UPDATE', payload: updatedUser });
      toast.success('Perfil actualizado exitosamente');
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Error al actualizar el perfil';
      toast.error(errorMessage);
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Auto token refresh
  useEffect(() => {
    if (!state.isAuthenticated || !state.token) return;

    const REFRESH_THRESHOLD = parseInt(
      process.env.NEXT_PUBLIC_TOKEN_REFRESH_THRESHOLD || '300000',
    ); // 5 minutes
    const refreshInterval = setInterval(async () => {
      try {
        await refreshAuth();
      } catch (error) {
        console.error('Auto refresh failed:', error);
        // Let the error boundary handle this or redirect to login
      }
    }, REFRESH_THRESHOLD);

    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated, state.token]);

  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    refreshAuth,
    updateProfile,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protected routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
) => {
  return function AuthenticatedComponent(props: P) {
    const { state } = useAuth();

    if (!state.isAuthenticated) {
      return null; // or redirect component
    }

    return <Component {...props} />;
  };
};

export default AuthContext;
