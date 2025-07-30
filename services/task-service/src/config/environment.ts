// src/config/environment.ts - Task Service Configuration
// Gestión centralizada de variables de entorno con validación Zod
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
dotenvConfig();

// Schema de validación para variables de entorno usando Zod
const envSchema = z.object({

  // APP CONFIGURATION
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  API_VERSION: z.string().default('v1'),


  // DATABASE CONFIGURATION
  DATABASE_URL: z.string().min(1, 'Database URL is required'),


  // REDIS CONFIGURATION
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  REDIS_PREFIX: z.string().default('tasks:'),


  // AUTH SERVICE CONFIGURATION
  AUTH_SERVICE_URL: z.string().url('Invalid Auth Service URL'),
  AUTH_SERVICE_VERIFY_ENDPOINT: z.string().default('/api/v1/auth/verify-token'),
  AUTH_SERVICE_API_KEY: z.string().min(1, 'Auth Service API Key is required'),
  AUTH_SERVICE_TIMEOUT: z.coerce.number().default(10000),


  // JWT CONFIGURATION (para validación local)
  JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 characters'),
  JWT_ISSUER: z.string().default('task-manager-auth'),


  // CORS CONFIGURATION
  CORS_ORIGIN: z.string().default('http://localhost:3000'),


  // SECURITY CONFIGURATION
  HELMET_ENABLED: z.coerce.boolean().default(true),


  // RATE LIMITING CONFIGURATION
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(200),

  // Rate limits específicos por endpoint
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(20),
  RATE_LIMIT_CREATE_TASK_MAX: z.coerce.number().default(10),
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().default(30),
  RATE_LIMIT_BULK_MAX: z.coerce.number().default(5),
  RATE_LIMIT_ADMIN_MAX: z.coerce.number().default(50),

  // Ventanas de tiempo específicas (en millisegundos)
  RATE_LIMIT_CREATE_TASK_WINDOW_MS: z.coerce.number().default(60000), // 1 minuto
  RATE_LIMIT_SEARCH_WINDOW_MS: z.coerce.number().default(60000), // 1 minuto
  RATE_LIMIT_BULK_WINDOW_MS: z.coerce.number().default(300000), // 5 minutos
  RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(60000), // 1 minuto

  // Configuración de store Redis para rate limiting
  RATE_LIMIT_REDIS_KEY_PREFIX: z.string().default('rate_limit:'),
  RATE_LIMIT_SKIP_SUCCESSFUL: z.coerce.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED: z.coerce.boolean().default(false),


  // LOGGING CONFIGURATION
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),


  // PAGINATION CONFIGURATION
  DEFAULT_PAGE_SIZE: z.coerce.number().default(20),
  MAX_PAGE_SIZE: z.coerce.number().default(100),


  // CACHE TTL CONFIGURATION (segundos)
  CACHE_TTL_TASKS: z.coerce.number().default(300),           // 5 minutos
  CACHE_TTL_CATEGORIES: z.coerce.number().default(600),      // 10 minutos
  CACHE_TTL_USER_TASKS: z.coerce.number().default(180),      // 3 minutos
  CACHE_TTL_USER_CATEGORIES: z.coerce.number().default(600), // 10 minutos
  CACHE_TTL_USER_STATS: z.coerce.number().default(300),      // 5 minutos
  CACHE_TTL_TASK_DETAIL: z.coerce.number().default(300),     // 5 minutos
  CACHE_TTL_CATEGORY_DETAIL: z.coerce.number().default(600), // 10 minutos
  CACHE_TTL_SEARCH_RESULTS: z.coerce.number().default(120),  // 2 minutos


  // BACKGROUND JOBS CONFIGURATION
  JOBS_CLEANUP_ENABLED: z.coerce.boolean().default(true),
  JOBS_CLEANUP_INTERVAL_MS: z.coerce.number().default(86400000), // 24 horas
  JOBS_CLEANUP_RETENTION_DAYS: z.coerce.number().default(90),

  JOBS_STATS_UPDATE_ENABLED: z.coerce.boolean().default(true),
  JOBS_STATS_UPDATE_INTERVAL_MS: z.coerce.number().default(300000), // 5 minutos


  // HEALTH CHECK & SWAGGER
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_PATH: z.string().default('/docs'),


  // SECURITY HEADERS
  CSP_ENABLED: z.coerce.boolean().default(true),
  HSTS_ENABLED: z.coerce.boolean().default(true),
  HSTS_MAX_AGE: z.coerce.number().default(31536000), // 1 año
});

// Función de validación con manejo de errores mejorado
function validateEnvironment() {
  try {
    const result = envSchema.safeParse(process.env);
    
    if (!result.success) {
      console.error('❌ Error de validación de variables de entorno:');
      result.error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\nVerifica tu archivo .env y las variables de entorno requeridas.');
      process.exit(1);
    }
    
    return result.data;
  } catch (error) {
    console.error('💀 Error crítico validando variables de entorno:', error);
    process.exit(1);
  }
}

// Validar y parsear variables de entorno
const env = validateEnvironment();

// CONFIGURACIÓN EXPORTADA
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
    apiKey: env.AUTH_SERVICE_API_KEY,
    timeout: env.AUTH_SERVICE_TIMEOUT,
    fullVerifyUrl: `${env.AUTH_SERVICE_URL}${env.AUTH_SERVICE_VERIFY_ENDPOINT}`,
  },

  // Configuración JWT
  jwt: {
    secret: env.JWT_SECRET,
    issuer: env.JWT_ISSUER,
  },

  // Configuración CORS
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },

  // Configuración de seguridad
  security: {
    helmetEnabled: env.HELMET_ENABLED,
    cspEnabled: env.CSP_ENABLED,
    hstsEnabled: env.HSTS_ENABLED,
    hstsMaxAge: env.HSTS_MAX_AGE,
  },

  // Configuración de rate limiting
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    
    // Configuraciones específicas por endpoint
    auth: {
      max: env.RATE_LIMIT_AUTH_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    },
    
    createTask: {
      max: env.RATE_LIMIT_CREATE_TASK_MAX,
      windowMs: env.RATE_LIMIT_CREATE_TASK_WINDOW_MS,
    },
    
    search: {
      max: env.RATE_LIMIT_SEARCH_MAX,
      windowMs: env.RATE_LIMIT_SEARCH_WINDOW_MS,
    },
    
    bulk: {
      max: env.RATE_LIMIT_BULK_MAX,
      windowMs: env.RATE_LIMIT_BULK_WINDOW_MS,
    },
    
    admin: {
      max: env.RATE_LIMIT_ADMIN_MAX,
      windowMs: env.RATE_LIMIT_ADMIN_WINDOW_MS,
    },
    
    // Configuración del store Redis
    redis: {
      keyPrefix: env.RATE_LIMIT_REDIS_KEY_PREFIX,
      skipSuccessful: env.RATE_LIMIT_SKIP_SUCCESSFUL,
      skipFailed: env.RATE_LIMIT_SKIP_FAILED,
    },
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
      userTasks: env.CACHE_TTL_USER_TASKS,
      userCategories: env.CACHE_TTL_USER_CATEGORIES,
      userStats: env.CACHE_TTL_USER_STATS,
      taskDetail: env.CACHE_TTL_TASK_DETAIL,
      categoryDetail: env.CACHE_TTL_CATEGORY_DETAIL,
      searchResults: env.CACHE_TTL_SEARCH_RESULTS,
    },
  },

  // Configuración de trabajos en segundo plano
  jobs: {
    cleanup: {
      enabled: env.JOBS_CLEANUP_ENABLED,
      intervalMs: env.JOBS_CLEANUP_INTERVAL_MS,
      retentionDays: env.JOBS_CLEANUP_RETENTION_DAYS,
    },
    statsUpdate: {
      enabled: env.JOBS_STATS_UPDATE_ENABLED,
      intervalMs: env.JOBS_STATS_UPDATE_INTERVAL_MS,
    },
  },

  // Configuración de features
  features: {
    healthCheckEnabled: env.HEALTH_CHECK_ENABLED,
    swaggerEnabled: env.SWAGGER_ENABLED,
  },

  // Configuración de Swagger
  swagger: {
    enabled: env.SWAGGER_ENABLED,
    path: env.SWAGGER_PATH,
  },
} as const;

// TIPOS TYPESCRIPT EXPORTADOS
export type AppConfig = typeof config;
export type Environment = typeof env.NODE_ENV;

// VALIDACIONES ADICIONALES
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
  console.log(`   Jobs Enabled: cleanup=${config.jobs.cleanup.enabled}, stats=${config.jobs.statsUpdate.enabled}`);
  console.log(`   Swagger: ${config.swagger.enabled ? 'enabled' : 'disabled'}`);
}

export default config;