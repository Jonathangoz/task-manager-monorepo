// src/hooks/useApi.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { 
  HTTP_STATUS,
  ERROR_CODES,
  REQUEST_HEADERS 
} from '@/lib/constants';
import { ApiResponse } from '@/types/api.types';
import { toast } from 'sonner';

interface UseApiOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  status: number | null;
}

interface UseApiReturn<T> extends ApiState<T> {
  execute: (config: RequestConfig) => Promise<T | null>;
  reset: () => void;
  cancel: () => void;
}

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

const DEFAULT_OPTIONS: UseApiOptions = {
  showSuccessToast: false,
  showErrorToast: true,
  retryAttempts: 0,
  retryDelay: 1000,
  timeout: 10000,
};

export const useApi = <T = any>(options: UseApiOptions = {}): UseApiReturn<T> => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
    status: null,
  });

  // Helper para actualizar estado
  const updateState = useCallback((updates: Partial<ApiState<T>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Función para generar request ID único
  const generateRequestId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Función para manejar errores HTTP
  const handleHttpError = useCallback((error: any, requestId: string) => {
    const status = error.response?.status || 0;
    const errorData = error.response?.data;
    
    let errorMessage = 'An unexpected error occurred';
    let errorCode = ERROR_CODES.INTERNAL_ERROR;

    if (errorData?.message) {
      errorMessage = errorData.message;
      errorCode = errorData.error?.code || errorCode;
    } else {
      switch (status) {
        case HTTP_STATUS.UNAUTHORIZED:
          errorMessage = 'Authentication required';
          errorCode = ERROR_CODES.TOKEN_REQUIRED;
          break;
        case HTTP_STATUS.FORBIDDEN:
          errorMessage = 'Access denied';
          errorCode = ERROR_CODES.UNAUTHORIZED_ACCESS;
          break;
        case HTTP_STATUS.NOT_FOUND:
          errorMessage = 'Resource not found';
          errorCode = ERROR_CODES.NOT_FOUND;
          break;
        case HTTP_STATUS.TOO_MANY_REQUESTS:
          errorMessage = 'Too many requests, please try again later';
          errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;
          break;
        case HTTP_STATUS.SERVICE_UNAVAILABLE:
          errorMessage = 'Service temporarily unavailable';
          errorCode = ERROR_CODES.SERVICE_UNAVAILABLE;
          break;
        case 0:
          errorMessage = 'Network error - please check your connection';
          errorCode = ERROR_CODES.NETWORK_ERROR;
          break;
      }
    }

    console.error(`API Error [${requestId}]:`, {
      status,
      errorCode,
      message: errorMessage,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
    });

    return { message: errorMessage, code: errorCode, status };
  }, []);

  // Función principal para ejecutar peticiones
  const execute = useCallback(async (config: RequestConfig): Promise<T | null> => {
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController();
    const requestId = generateRequestId();

    updateState({
      isLoading: true,
      error: null,
      status: null,
    });

    // Configurar timeout
    if (mergedOptions.timeout) {
      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, mergedOptions.timeout);
    }

    let attempts = 0;
    const maxAttempts = mergedOptions.retryAttempts + 1;

    while (attempts < maxAttempts) {
      try {
        console.log(`API Request [${requestId}] - Attempt ${attempts + 1}:`, {
          method: config.method || 'GET',
          url: config.url,
          hasData: !!config.data,
          hasParams: !!config.params,
        });

        const response = await apiClient.request<ApiResponse<T>>({
          ...config,
          method: config.method || 'GET',
          signal: abortControllerRef.current.signal,
          headers: {
            [REQUEST_HEADERS.X_REQUEST_ID]: requestId,
            ...config.headers,
          },
        });

        // Limpiar timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        console.log(`API Success [${requestId}]:`, {
          status: response.status,
          hasData: !!response.data?.data,
        });

        const responseData = response.data?.data || response.data;

        updateState({
          data: responseData,
          isLoading: false,
          status: response.status,
        });

        // Mostrar toast de éxito si está habilitado
        if (mergedOptions.showSuccessToast && response.data?.message) {
          toast.success(response.data.message);
        }

        // Ejecutar callback de éxito
        if (mergedOptions.onSuccess) {
          mergedOptions.onSuccess(responseData);
        }

        return responseData;

      } catch (error: any) {
        attempts++;

        // Si es cancelación, no hacer nada
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
          console.log(`API Request [${requestId}] cancelled`);
          return null;
        }

        const errorInfo = handleHttpError(error, requestId);

        // Si es el último intento o no es un error retriable
        if (attempts >= maxAttempts || !isRetriableError(errorInfo.status)) {
          updateState({
            isLoading: false,
            error: errorInfo.message,
            status: errorInfo.status,
          });

          // Mostrar toast de error si está habilitado
          if (mergedOptions.showErrorToast) {
            toast.error(errorInfo.message);
          }

          // Ejecutar callback de error
          if (mergedOptions.onError) {
            mergedOptions.onError(error);
          }

          return null;
        }

        // Esperar antes del siguiente intento
        if (attempts < maxAttempts) {
          console.log(`API Retry [${requestId}] - Waiting ${mergedOptions.retryDelay}ms before attempt ${attempts + 1}`);
          await new Promise(resolve => setTimeout(resolve, mergedOptions.retryDelay));
        }
      }
    }

    return null;
  }, [updateState, generateRequestId, handleHttpError, mergedOptions]);

  // Función para determinar si un error es retriable
  const isRetriableError = useCallback((status: number): boolean => {
    return [
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      0 // Network errors
    ].includes(status);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState({
      data: null,
      isLoading: false,
      error: null,
      status: null,
    });
  }, []);

  // Cancel current request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    updateState({ isLoading: false });
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    cancel,
  };
};

// Hook especializado para GET requests
export const useApiGet = <T = any>(
  url: string,
  options: UseApiOptions & { autoFetch?: boolean; deps?: any[] } = {}
): UseApiReturn<T> & { refetch: () => Promise<T | null> } => {
  const { autoFetch = false, deps = [], ...apiOptions } = options;
  const api = useApi<T>(apiOptions);

  const refetch = useCallback(() => {
    return api.execute({ url, method: 'GET' });
  }, [api, url]);

  // Auto fetch on mount or when dependencies change
  useEffect(() => {
    if (autoFetch) {
      refetch();
    }
  }, [autoFetch, refetch, ...deps]);

  return {
    ...api,
    refetch,
  };
};

// Hook especializado para POST requests
export const useApiPost = <T = any>(
  options: UseApiOptions = {}
): UseApiReturn<T> & { post: (url: string, data?: any) => Promise<T | null> } => {
  const api = useApi<T>(options);

  const post = useCallback((url: string, data?: any) => {
    return api.execute({ url, method: 'POST', data });
  }, [api]);

  return {
    ...api,
    post,
  };
};

// Hook especializado para PUT requests
export const useApiPut = <T = any>(
  options: UseApiOptions = {}
): UseApiReturn<T> & { put: (url: string, data?: any) => Promise<T | null> } => {
  const api = useApi<T>(options);

  const put = useCallback((url: string, data?: any) => {
    return api.execute({ url, method: 'PUT', data });
  }, [api]);

  return {
    ...api,
    put,
  };
};

// Hook especializado para DELETE requests
export const useApiDelete = <T = any>(
  options: UseApiOptions = {}
): UseApiReturn<T> & { remove: (url: string) => Promise<T | null> } => {
  const api = useApi<T>(options);

  const remove = useCallback((url: string) => {
    return api.execute({ url, method: 'DELETE' });
  }, [api]);

  return {
    ...api,
    remove,
  };
};

// Hook para manejar múltiples peticiones en paralelo
export const useApiParallel = <T = any>(
  options: UseApiOptions = {}
): {
  executeParallel: (configs: RequestConfig[]) => Promise<(T | null)[]>;
  isLoading: boolean;
  errors: (string | null)[];
  results: (T | null)[];
  reset: () => void;
} => {
  const [state, setState] = useState({
    isLoading: false,
    errors: [] as (string | null)[],
    results: [] as (T | null)[],
  });

  const executeParallel = useCallback(async (configs: RequestConfig[]): Promise<(T | null)[]> => {
    setState({
      isLoading: true,
      errors: [],
      results: [],
    });

    try {
      const promises = configs.map(async (config, index) => {
        try {
          const api = useApi<T>(options);
          const result = await api.execute(config);
          return { index, result, error: null };
        } catch (error: any) {
          return { index, result: null, error: error.message };
        }
      });

      const responses = await Promise.allSettled(promises);
      
      const results: (T | null)[] = new Array(configs.length).fill(null);
      const errors: (string | null)[] = new Array(configs.length).fill(null);

      responses.forEach((response, index) => {
        if (response.status === 'fulfilled' && response.value) {
          results[response.value.index] = response.value.result;
          errors[response.value.index] = response.value.error;
        } else {
          errors[index] = 'Request failed';
        }
      });

      setState({
        isLoading: false,
        results,
        errors,
      });

      return results;
    } catch (error) {
      setState({
        isLoading: false,
        results: [],
        errors: configs.map(() => 'Parallel execution failed'),
      });
      return [];
    }
  }, [options]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      errors: [],
      results: [],
    });
  }, []);

  return {
    ...state,
    executeParallel,
    reset,
  };
};