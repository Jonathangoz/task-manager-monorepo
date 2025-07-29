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
    // CORRECCIÓN 1: Acceder a config.authService en lugar de config.auth
    this.baseURL = config.authService.url;
    this.apiKey = config.authService.apiKey;
    this.timeout = config.authService.timeout;

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
    this.client.interceptors.request.use(
      (req) => {
        logger.debug({ req: { method: req.method, url: req.url, headers: req.headers } }, 'AuthService Request');
        return req;
      },
      (error: AxiosError) => {
        logger.error({ error: this.extractErrorDetails(error) }, 'AuthService Request Error');
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (res) => {
        logger.debug({ res: { status: res.status, data: res.data } }, 'AuthService Response');
        return res;
      },
      (error: AxiosError) => {
        logger.error({ error: this.extractErrorDetails(error) }, 'AuthService Response Error');
        return Promise.reject(this.handleError(error));
      }
    );
  }

  public async verifyToken(token: string): Promise<TokenValidationResponse> {
    try {
      const response = await this.client.post<TokenValidationResponse>(
        AUTH_ENDPOINTS.VERIFY_TOKEN,
        { token }
      );
      return response.data;
    } catch (error: any) {
      logger.error(`Error verifying token: ${this.getErrorMessage(error)}`);
      // Devuelve una estructura que coincide con TokenValidationResponse para el error
      return { valid: false, error: this.getErrorMessage(error) };
    }
  }

  private extractErrorDetails(error: AxiosError): any {
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      };
    } else if (error.request) {
      return {
        request: error.request,
        message: 'No response received from auth service',
      };
    } else {
      return {
        message: error.message,
      };
    }
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      const message = this.getErrorMessage(error); // Usa la función corregida
      switch (error.response.status) {
        case 400:
          return new Error(`Auth service bad request: ${message}`);
        case 401:
          return new Error(`Auth service unauthorized: ${message}`);
        case 403:
          return new Error(`Auth service forbidden: ${message}`);
        case 404:
          return new Error(`Auth service endpoint not found: ${message}`);
        case 409:
          return new Error(`Auth service conflict: ${message}`);
        case 422:
          return new Error(`Auth service unprocessable entity: ${message}`);
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
      // Asegura que error.message exista antes de acceder a ella
      return new Error(`Auth service client error: ${error.message || 'unknown error'}`);
    }
  }

  private getErrorMessage(error: any): string {
    // CORRECCIÓN 2: Acceso más seguro a la propiedad 'message'
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    // Asegurarse de que 'error' es un objeto y contiene la propiedad 'message'
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return error.message;
    }
    return 'Auth service communication error';
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
  }
}