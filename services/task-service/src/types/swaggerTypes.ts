// src/types/swagger.ts - Tipos TypeScript para Swagger
import { OpenAPIV3 } from 'openapi-types';

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
  servers: OpenAPIV3.ServerObject[];
  paths: OpenAPIV3.PathsObject;
  schemas: OpenAPIV3.SchemaObject;
  tags: OpenAPIV3.TagObject[];
}