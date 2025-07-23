// ==============================================
// src/config/environment.ts - Task Service Configuration
// Gestión centralizada de variables de entorno
// ==============================================

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
dotenvConfig();

// Schema de validación para variables de entorno
const envSchema = z.object({
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3002),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  REDIS_PREFIX: z.string().default('task:'),

  // Auth Service
  AUTH_SERVICE_URL: z.string().url('Invalid Auth Service URL'),
  AUTH_SERVICE_API_KEY: z.string().optional(),
  AUTH_SERVICE_TIMEOUT: z.string().transform(Number).default(5000),

  // JWT (for local validation)
  JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 characters'),
  JWT_ISSUER: z.string().default('task-manager-auth'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Security
  HELMET_ENABLED: z.string().transform(Boolean).default(true),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(200),
  RATE_LIMIT_ENABLED: z.string().transform(Boolean).default(true),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().transform(Boolean).default(true),

  // Pagination
  DEFAULT_PAGE_SIZE: z.string().transform(Number).default(20),
  MAX_PAGE_SIZE: z.string().transform(Number).default(100),

  // Cache TTL (seconds)
  CACHE_TTL_TASKS: z.string().transform(Number).default(300),
  CACHE_TTL_CATEGORIES: z.string().transform(Number).default(600),
  CACHE_TTL_USER_TASKS: z.string().transform(Number).default(180),

  // Background Jobs
  CLEANUP_INTERVAL: z.string().transform(Number).default(3600000),
  STATS_UPDATE_INTERVAL: z.string().transform(Number).default(300000),

  // Health Check
  HEALTH_CHECK_ENABLED: z.string().transform(Boolean).default(true),

  // Swagger
  SWAGGER_ENABLED: z.string().transform(Boolean).default(true),
  SWAGGER_PATH: z.string().default('/api/v1/docs'),

  // File Upload
  UPLOAD_MAX_SIZE: z.string().transform(Number).default(5242880),
  UPLOAD_ALLOWED_TYPES: z.string().default('image/jpeg,image/png,image/gif'),

  // Notifications
  NOTIFICATIONS_ENABLED: z.string().transform(Boolean).default(false),
  WEBHOOK_URL: z.string().optional(),
});

// Validar y exportar configuración
const env = envSchema.parse(process.env);

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    prefix: env.REDIS_PREFIX,
  },
  authService: {
    url: env.AUTH_SERVICE_URL,
    apiKey: env.AUTH_SERVICE_API_KEY,
    timeout: env.AUTH_SERVICE_TIMEOUT,
  },
  jwt: {
    secret: env.JWT_SECRET,
    issuer: env.JWT_ISSUER,
  },
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },
  security: {
    helmetEnabled: env.HELMET_ENABLED,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    enabled: env.RATE_LIMIT_ENABLED,
  },
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
  pagination: {
    defaultPageSize: env.DEFAULT_PAGE_SIZE,
    maxPageSize: env.MAX_PAGE_SIZE,
  },
  cache: {
    ttl: {
      tasks: env.CACHE_TTL_TASKS,
      categories: env.CACHE_TTL_CATEGORIES,
      userTasks: env.CACHE_TTL_USER_TASKS,
    },
  },
  jobs: {
    cleanupInterval: env.CLEANUP_INTERVAL,
    statsUpdateInterval: env.STATS_UPDATE_INTERVAL,
  },
  healthCheck: {
    enabled: env.HEALTH_CHECK_ENABLED,
  },
  swagger: {
    enabled: env.SWAGGER_ENABLED,
    path: env.SWAGGER_PATH,
  },
  upload: {
    maxSize: env.UPLOAD_MAX_SIZE,
    allowedTypes: env.UPLOAD_ALLOWED_TYPES.split(',').map(type => type.trim()),
  },
  notifications: {
    enabled: env.NOTIFICATIONS_ENABLED,
    webhookUrl: env.WEBHOOK_URL,
  },
} as const;

export default config;