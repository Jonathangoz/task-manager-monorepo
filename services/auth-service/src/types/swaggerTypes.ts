// src/types/swagger.ts - Tipos TypeScript para Swagger
// ==============================================
export interface SwaggerConfig {
  enabled: boolean;
  path: string;
  jsonPath: string;
  title: string;
  version: string;
  description: string;
  termsOfService?: string;
  contact?: {
    name: string;
    email: string;
    url?: string;
  };
  license?: {
    name: string;
    url: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SwaggerInfo {
  title?: string;
  version?: string;
  description?: string;
  servers: number;
  paths: number;
  schemas: number;
  tags: number;
}
