// src/utils/swaggerHelpers.ts - Corregido sin tipos 'any'
import { ValidationResult } from '@/types/swaggerTypes';

// Tipos específicos para las respuestas
interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

interface ApiValidationErrorResponse {
  success: false;
  message: string;
  error: {
    code: 'VALIDATION_ERROR';
    details: ValidationError[];
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// Interfaz para configuración de endpoint
interface ApiEndpointConfig {
  summary: string;
  description?: string;
  tags?: string[];
  responses?: Record<number, unknown>;
}

// Interfaz para schema de validación
interface ValidationSchema {
  required?: string[];
  properties?: Record<string, FieldSchema>;
}

interface FieldSchema {
  type?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
}

/**
 * Genera respuestas estandarizadas para la documentación
 */
export class SwaggerResponseBuilder {
  static success<T = unknown>(
    data: T,
    message = 'Operation successful',
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      },
    };
  }

  static error(
    code: string,
    message: string,
    details?: unknown,
  ): ApiErrorResponse {
    return {
      success: false,
      message,
      error: {
        code,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      },
    };
  }

  static validationError(
    errors: ValidationError[],
  ): ApiValidationErrorResponse {
    return {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: errors,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      },
    };
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Decorador para documentar endpoints automáticamente
 */
export function ApiEndpoint(config: ApiEndpointConfig) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // Almacenar metadata para el endpoint
    const constructor = target.constructor as {
      apiEndpoints?: Record<string, ApiEndpointConfig>;
    };

    if (!constructor.apiEndpoints) {
      constructor.apiEndpoints = {};
    }
    constructor.apiEndpoints[propertyKey] = config;
    return descriptor;
  };
}

/**
 * Validador de schemas Swagger
 */
export class SwaggerValidator {
  static validateSchema(
    schema: ValidationSchema,
    data: Record<string, unknown>,
  ): ValidationResult {
    const errors: string[] = [];

    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Required field '${field}' is missing`);
        }
      }
    }

    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in data) {
          const fieldErrors = this.validateField(
            field,
            fieldSchema,
            data[field],
          );
          errors.push(...fieldErrors);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateField(
    fieldName: string,
    schema: FieldSchema,
    value: unknown,
  ): string[] {
    const errors: string[] = [];

    // Validar tipo
    if (schema.type && typeof value !== schema.type) {
      errors.push(`Field '${fieldName}' must be of type ${schema.type}`);
    }

    // Validar longitud de string
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(
          `Field '${fieldName}' must be at least ${schema.minLength} characters`,
        );
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(
          `Field '${fieldName}' must be at most ${schema.maxLength} characters`,
        );
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`Field '${fieldName}' does not match required pattern`);
      }
    }

    // Validar enums
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(
        `Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`,
      );
    }

    return errors;
  }
}
