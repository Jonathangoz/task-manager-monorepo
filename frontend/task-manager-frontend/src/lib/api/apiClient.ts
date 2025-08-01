// src/lib/api/apiClient.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

import {
  HTTP_STATUS,
  ERROR_CODES,
  TOKEN_CONFIG,
  REQUEST_HEADERS,
  CONTENT_TYPES,
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
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

class ApiClient {
  private instance: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: ApiClientConfig) {
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        [REQUEST_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [REQUEST_HEADERS.USER_AGENT]: this.getUserAgent(),
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private getUserAgent(): string {
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Task Manager';
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    return `${appName}/${appVersion} (Frontend)`;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add request ID
        config.headers[REQUEST_HEADERS.X_REQUEST_ID] = this.generateRequestId();

        // Add auth token if available
        const token = this.getStoredToken();
        if (token) {
          config.headers[REQUEST_HEADERS.AUTHORIZATION] =
            `${TOKEN_CONFIG.TOKEN_PREFIX}${token}`;
        }

        // Log request in development
        if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
          console.log(
            `[API Request] ${config.method?.toUpperCase()} ${config.url}`,
            {
              headers: config.headers,
              data: config.data,
            },
          );
        }

        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        // Log response in development
        if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
          console.log(`[API Response] ${response.status}`, response.data);
        }

        return response;
      },
      async (error: AxiosError<ApiResponse>) => {
        const originalRequest = error.config;

        // Handle network errors
        if (!error.response) {
          this.handleNetworkError(error);
          return Promise.reject(error);
        }

        // Handle different HTTP status codes
        await this.handleResponseError(error);

        // Retry logic for specific errors
        if (
          this.shouldRetry(error) &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;
          return this.retryRequest(originalRequest);
        }

        return Promise.reject(error);
      },
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStoredToken(): string | null {
    const cookieToken = Cookies.get(
      process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token',
    );
    const localToken =
      typeof window !== 'undefined'
        ? localStorage.getItem(
            process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token',
          )
        : null;

    return cookieToken || localToken;
  }

  private handleNetworkError(error: AxiosError): void {
    console.error('[Network Error]', error.message);

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Error de conexión', {
        description:
          'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
        duration: 5000,
      });
    }
  }

  private async handleResponseError(
    error: AxiosError<ApiResponse>,
  ): Promise<void> {
    const { response } = error;
    const status = response?.status;
    const errorData = response?.data;

    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        await this.handleUnauthorizedError(errorData);
        break;

      case HTTP_STATUS.FORBIDDEN:
        this.handleForbiddenError(errorData);
        break;

      case HTTP_STATUS.NOT_FOUND:
        this.handleNotFoundError(errorData);
        break;

      case HTTP_STATUS.TOO_MANY_REQUESTS:
        this.handleRateLimitError(errorData);
        break;

      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        this.handleServerError(errorData);
        break;

      default:
        this.handleGenericError(errorData, status);
    }
  }

  private async handleUnauthorizedError(
    errorData?: ApiResponse,
  ): Promise<void> {
    console.warn('[Auth Error]', errorData?.message || 'Unauthorized');

    // Clear stored tokens
    Cookies.remove(
      process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token',
    );
    if (typeof window !== 'undefined') {
      localStorage.removeItem(
        process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'task_manager_token',
      );
      localStorage.removeItem(
        process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY ||
          'task_manager_refresh_token',
      );
    }

    // Redirect to login if not already there
    if (
      typeof window !== 'undefined' &&
      !window.location.pathname.includes('/login')
    ) {
      window.location.href = '/login';
    }
  }

  private handleForbiddenError(errorData?: ApiResponse): void {
    console.warn('[Access Denied]', errorData?.message || 'Forbidden');

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Acceso denegado', {
        description: 'No tienes permisos para realizar esta acción.',
      });
    }
  }

  private handleNotFoundError(errorData?: ApiResponse): void {
    console.warn('[Not Found]', errorData?.message || 'Resource not found');

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Recurso no encontrado', {
        description: 'El recurso solicitado no existe o no está disponible.',
      });
    }
  }

  private handleRateLimitError(errorData?: ApiResponse): void {
    console.warn('[Rate Limit]', errorData?.message || 'Too many requests');

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Límite de solicitudes excedido', {
        description:
          'Has realizado demasiadas solicitudes. Intenta nuevamente en unos minutos.',
        duration: 8000,
      });
    }
  }

  private handleServerError(errorData?: ApiResponse): void {
    console.error('[Server Error]', errorData?.message || 'Server error');

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Error del servidor', {
        description:
          'Ocurrió un error interno. Por favor, intenta nuevamente más tarde.',
        duration: 6000,
      });
    }
  }

  private handleGenericError(errorData?: ApiResponse, status?: number): void {
    console.error('[API Error]', errorData?.message || 'Unknown error', {
      status,
    });

    if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true') {
      toast.error('Error', {
        description: errorData?.message || 'Ocurrió un error inesperado.',
      });
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) return true; // Network errors

    const retryStatuses = [
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ];

    return retryStatuses.includes(error.response.status);
  }

  private async retryRequest(
    config: AxiosRequestConfig,
    attempt: number = 1,
  ): Promise<AxiosResponse> {
    if (attempt > this.retryAttempts) {
      throw new Error('Max retry attempts reached');
    }

    console.log(`[Retry Attempt] ${attempt}/${this.retryAttempts}`);

    // Exponential backoff
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      return await this.instance.request(config);
    } catch (error) {
      return this.retryRequest(config, attempt + 1);
    }
  }

  // Public methods
  public async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.get(url, config);
  }

  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.post(url, data, config);
  }

  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.put(url, data, config);
  }

  public async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.patch(url, data, config);
  }

  public async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.delete(url, config);
  }

  public setAuthToken(token: string): void {
    this.instance.defaults.headers.common[REQUEST_HEADERS.AUTHORIZATION] =
      `${TOKEN_CONFIG.TOKEN_PREFIX}${token}`;
  }

  public removeAuthToken(): void {
    delete this.instance.defaults.headers.common[REQUEST_HEADERS.AUTHORIZATION];
  }

  public getBaseURL(): string {
    return this.instance.defaults.baseURL || '';
  }
}

// Create instances for different services
const getServiceUrl = (serviceName: 'auth' | 'task'): string => {
  const isDev = process.env.NODE_ENV === 'development';

  switch (serviceName) {
    case 'auth':
      return isDev
        ? process.env.NEXT_PUBLIC_AUTH_SERVICE_URL_DEV ||
            'http://localhost:3001/api/v1'
        : process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
            'https://task-manager-auth-service.onrender.com/api/v1';

    case 'task':
      return isDev
        ? process.env.NEXT_PUBLIC_TASK_SERVICE_URL_DEV ||
            'http://localhost:3002/api/v1'
        : process.env.NEXT_PUBLIC_TASK_SERVICE_URL ||
            'https://task-manager-task-service.onrender.com/api/v1';

    default:
      throw new Error(`Unknown service: ${serviceName}`);
  }
};

// Export configured instances
export const authApiClient = new ApiClient({
  baseURL: getServiceUrl('auth'),
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000'),
});

export const taskApiClient = new ApiClient({
  baseURL: getServiceUrl('task'),
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000'),
});

export default ApiClient;
