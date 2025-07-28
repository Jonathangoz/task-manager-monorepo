// src/utils/swagger-helpers.ts - Utilidades adicionales
import { ValidationResult } from '@/types/swaggerTypes'

/**
 * Genera respuestas estandarizadas para la documentación
 */
export class SwaggerResponseBuilder {
  static success(data: any, message = 'Operation successful') {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      }
    };
  }

  static error(code: string, message: string, details?: any) {
    return {
      success: false,
      message,
      error: {
        code,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      }
    };
  }

  static validationError(errors: Array<{ field: string; message: string; value?: any }>) {
    return {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: errors
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      }
    };
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Decorador para documentar endpoints automáticamente
 */
export function ApiEndpoint(config: {
  summary: string;
  description?: string;
  tags?: string[];
  responses?: Record<number, any>;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Almacenar metadata para el endpoint
    if (!target.constructor.apiEndpoints) {
      target.constructor.apiEndpoints = {};
    }
    target.constructor.apiEndpoints[propertyKey] = config;
    return descriptor;
  };
}

/**
 * Validador de schemas Swagger
 */
export class SwaggerValidator {
  static validateSchema(schema: any, data: any): ValidationResult {
    const errors: string[] = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Required field '${field}' is missing`);
        }
      }
    }
    
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties as any)) {
        if (field in data) {
          const fieldErrors = this.validateField(field, fieldSchema, data[field]);
          errors.push(...fieldErrors);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private static validateField(fieldName: string, schema: any, value: any): string[] {
    const errors: string[] = [];
    
    // Validar tipo
    if (schema.type && typeof value !== schema.type) {
      errors.push(`Field '${fieldName}' must be of type ${schema.type}`);
    }
    
    // Validar longitud de string
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`Field '${fieldName}' must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`Field '${fieldName}' must be at most ${schema.maxLength} characters`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`Field '${fieldName}' does not match required pattern`);
      }
    }
    
    // Validar enums
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
    }
    
    return errors;
  }
}