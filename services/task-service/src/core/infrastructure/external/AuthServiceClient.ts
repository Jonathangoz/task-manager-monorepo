// src/core/infrastructure/external/AuthServiceClient.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { AUTH_ENDPOINTS } from '@/utils/constants';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  role: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export class AuthServiceClient {
  private client: AxiosInstance;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor() {
    this.baseURL = config.auth.serviceUrl;
    this.apiKey = config.auth.serviceApiKey;
    this.timeout = config.auth.serviceTimeout;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-API-Key': this.apiKey,
        'User-Agent': 'TaskService/1.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        
        logger.debug({
          url: config.url,
          method: config.method,
          requestId,
        }, 'Auth service request');
        
        return config;
      },
      (error) => {
        logger.error({ error }, 'Auth service request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          url: response.config.url,
          status: response.status,
          requestId: response.config.headers['X-Request-ID'],
        }, 'Auth service response');
        
        return response;
      },
      (error: AxiosError) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        
        logger.error({
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          requestId,
          error: error.message,
        }, 'Auth service response error');
        
        return Promise.reject(this.handleError(error));
      }
    );
  }

  async validateToken(token: string): Promise<TokenValidationResponse> {
    try {
      const response = await this.client.post(AUTH_ENDPOINTS.VERIFY_TOKEN, {
        token: token.replace('Bearer ', ''), // Remove Bearer prefix if present
      });

      if (response.data.success) {
        return {
          valid: true,
          user: response.data.data.user,
        };
      } else {
        return {
          valid: false,
          error: response.data.message || 'Token validation failed',
        };
      }
    } catch (error: any) {
      logger.error({ error: error.message, token: token.substring(0, 20) + '...' }, 'Token validation failed');
      
      return {
        valid: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  async getUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      const response = await this.client.get(`${AUTH_ENDPOINTS.GET_USER}/${userId}`);

      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn({ userId }, 'User profile not found');
        return null;
      }
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'Failed to get user profile');
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health', {
        timeout: 5000, // Shorter timeout for health checks
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error({ error }, 'Auth service health check failed');
      return false;
    }
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      switch (status) {
        case 401:
          return new Error('Authentication failed');
        case 403:
          return new Error('Access forbidden');
        case 404:
          return new Error('Auth service endpoint not found');
        case 429:
          return new Error('Too many requests to auth service');
        case 500:
          return new Error('Auth service internal error');
        case 503:
          return new Error('Auth service unavailable');
        default:
          return new Error(`Auth service error: ${message}`);
      }
    } else if (error.request) {
      // Network error
      return new Error('Auth service unreachable');
    } else {
      // Other error
      return new Error(`Auth service client error: ${error.message}`);
    }
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    return error.message || 'Auth service communication error';
  }

  private generateRequestId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to update auth service configuration
  updateConfig(newConfig: { serviceUrl?: string; apiKey?: string; timeout?: number }): void {
    if (newConfig.serviceUrl) {
      this.client.defaults.baseURL = newConfig.serviceUrl;
    }
    
    if (newConfig.apiKey) {
      this.client.defaults.headers['X-Service-API-Key'] = newConfig.apiKey;
    }
    
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
    
    logger.info({ newConfig }, 'Auth service client configuration updated');
  }

  // Method to check if auth service is configured
  isConfigured(): boolean {
    return !!(this.baseURL && this.apiKey);
  }
}