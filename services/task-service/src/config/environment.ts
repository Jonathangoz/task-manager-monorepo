// ==============================================
// src/config/environment.ts - Task Service Configuration
// Gestión centralizada de variables de entorno con validación Zod
// ==============================================

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
dotenvConfig();

// Schema de validación para variables de entorno usando Zod
const envSchema = z.object({
  // ==============================================
  // APP CONFIGURATION
  // ==============================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3002),
  API_VERSION: z.string().default('v1'),

  // ==============================================
  // DATABASE CONFIGURATION
  // ==============================================
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // ==============================================
  // REDIS CONFIGURATION
  // ==============================================
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  REDIS_PREFIX: z.string().default('tasks:'),

  // ==============================================
  // AUTH SERVICE CONFIGURATION
  // ==============================================
  AUTH_SERVICE_URL: z.string().url('Invalid Auth Service URL'),
  AUTH_SERVICE_VERIFY_ENDPOINT: z.string().default('/api/v1/auth/verify-token'),

  // ==============================================
  // JWT CONFIGURATION (para validación local)
  // ==============================================
  JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 characters'),
  JWT_ISSUER: z.string().default('task-manager-auth'),

  // ==============================================
  // REFRESH TOKEN CONFIGURATION
  // ==============================================
  REFRESH_TOKEN_SECRET: z.string().min(32, 'Refresh Token Secret must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // ==============================================
  // JWE CONFIGURATION
  // ==============================================
  JWE_SECRET: z.string().min(32, 'JWE Secret must be at least 32 characters'),
  JWE_ALGORITHM: z.string().default('dir'),
  JWE_ENCRYPTION: z.string().default('A256GCM'),

  // ==============================================
  // CORS CONFIGURATION
  // ==============================================
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ==============================================
  // SECURITY CONFIGURATION
  // ==============================================
  HELMET_ENABLED: z.string().transform((val) => val === 'true').default(true),

  // ==============================================
  // RATE LIMITING CONFIGURATION
  // ==============================================
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(200),

  // ==============================================
  // LOGGING CONFIGURATION
  // ==============================================
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().transform((val) => val === 'true').default(true),

  // ==============================================
  // PAGINATION CONFIGURATION
  // ==============================================
  DEFAULT_PAGE_SIZE: z.string().transform(Number).default(20),
  MAX_PAGE_SIZE: z.string().transform(Number).default(100),

  // ==============================================
  // CACHE TTL CONFIGURATION (segundos)
  // ==============================================
  CACHE_TTL_TASKS: z.string().transform(Number).default(300),      // 5 minutos
  CACHE_TTL_CATEGORIES: z.string().transform(Number).default(600), // 10 minutos

  // ==============================================
  // HEALTH CHECK & SWAGGER
  // ==============================================
  HEALTH_CHECK_ENABLED: z.string().transform((val) => val === 'true').default(true),
  SWAGGER_ENABLED: z.string().transform((val) => val === 'true').default(true),
});

// Función de validación con manejo de errores
function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Error de validación de variables de entorno:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Validar y parsear variables de entorno
const env = validateEnvironment();

// ==============================================
// CONFIGURACIÓN EXPORTADA
// ==============================================
export const config = {
  // Configuración de la aplicación
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  // Configuración de base de datos
  database: {
    url: env.DATABASE_URL,
  },

  // Configuración de Redis
  redis: {
    url: env.REDIS_URL,
    prefix: env.REDIS_PREFIX,
  },

  // Configuración del servicio de autenticación
  authService: {
    url: env.AUTH_SERVICE_URL,
    verifyEndpoint: env.AUTH_SERVICE_VERIFY_ENDPOINT,
    fullVerifyUrl: `${env.AUTH_SERVICE_URL}${env.AUTH_SERVICE_VERIFY_ENDPOINT}`,
  },

  // Configuración JWT
  jwt: {
    secret: env.JWT_SECRET,
    issuer: env.JWT_ISSUER,
  },

  // Configuración Refresh Token
  refreshToken: {
    secret: env.REFRESH_TOKEN_SECRET,
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  },

  // Configuración JWE
  jwe: {
    secret: env.JWE_SECRET,
    algorithm: env.JWE_ALGORITHM,
    encryption: env.JWE_ENCRYPTION,
  },

  // Configuración CORS
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },

  // Configuración de seguridad
  security: {
    helmetEnabled: env.HELMET_ENABLED,
  },

  // Configuración de rate limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // Configuración de logging
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },

  // Configuración de paginación
  pagination: {
    defaultPageSize: env.DEFAULT_PAGE_SIZE,
    maxPageSize: env.MAX_PAGE_SIZE,
  },

  // Configuración de cache TTL
  cache: {
    ttl: {
      tasks: env.CACHE_TTL_TASKS,
      categories: env.CACHE_TTL_CATEGORIES,
    },
  },

  // Configuración de health check y documentación
  features: {
    healthCheckEnabled: env.HEALTH_CHECK_ENABLED,
    swaggerEnabled: env.SWAGGER_ENABLED,
  },
} as const;

// ==============================================
// TIPOS TYPESCRIPT EXPORTADOS
// ==============================================
export type AppConfig = typeof config;
export type Environment = typeof env.NODE_ENV;

// ==============================================
// VALIDACIONES ADICIONALES
// ==============================================

// Validar que las URLs del auth service sean correctas
if (config.app.isProduction && !config.authService.url.startsWith('https://')) {
  console.warn('⚠️  Warning: Auth Service URL should use HTTPS in production');
}

// Validar configuración de CORS para producción
if (config.app.isProduction && config.cors.origin.includes('localhost')) {
  console.warn('⚠️  Warning: CORS contains localhost origins in production');
}

// Log de configuración en desarrollo
if (config.app.isDevelopment) {
  console.log('🔧 Task Service Configuration Loaded:');
  console.log(`   Environment: ${config.app.env}`);
  console.log(`   Port: ${config.app.port}`);
  console.log(`   Auth Service: ${config.authService.url}`);
  console.log(`   Redis Prefix: ${config.redis.prefix}`);
  console.log(`   Log Level: ${config.logging.level}`);
}

export default config;