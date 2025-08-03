// src/config/environment.ts - Auth Service Configuration
// Gestión centralizada de variables de entorno con validación Zod
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
dotenvConfig();

// SCHEMA DE VALIDACIÓN CON ZOD
const envSchema = z.object({
  // APP CONFIGURATION
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().positive().default(3001),
  API_VERSION: z.string().default('v1'),

  // DATABASE CONFIGURATION
  DATABASE_URL: z.string().min(1, 'URL de la Base de Datos es Requerida'),

  // REDIS CONFIGURATION
  REDIS_URL: z.string().min(1, 'URL de Redis es Requerida'),
  REDIS_PREFIX: z.string().default('auth:'),

  // JWT CONFIGURATION
  JWT_SECRET: z
    .string()
    .min(32, 'JWT Secret debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('task-manager-auth'),

  // REFRESH TOKEN CONFIGURATION
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, 'Refresh Token Secret must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // JWE CONFIGURATION
  JWE_SECRET: z.string().min(32, 'JWE Secret must be at least 32 characters'),
  JWE_ALGORITHM: z.string().default('dir'),
  JWE_ENCRYPTION: z.string().default('A256GCM'),

  // CORS CONFIGURATION
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // SECURITY CONFIGURATION
  HELMET_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // API_KEY
  AUTH_SERVICE_API_KEY: z
    .string()
    .min(1, 'La API Key del servicio es requerida'),

  // RATE LIMITING CONFIGURATION
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('900000'), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('100'),

  // ACCOUNT SECURITY
  MAX_LOGIN_ATTEMPTS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('5'),
  ACCOUNT_LOCK_TIME: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('1800000'), // 30 minutos
  PASSWORD_RESET_TOKEN_EXPIRES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('3600000'), // 1 hora

  // LOGGING CONFIGURATION
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // CACHE TTL CONFIGURATION (segundos)
  CACHE_TTL_USER_SESSIONS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('900'), // 15 minutos
  CACHE_TTL_USER_DATA: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('300'), // 5 minutos
  CACHE_TTL_BLACKLIST: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('86400'), // 24 horas

  // FEATURES & HEALTH CHECK
  HEALTH_CHECK_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  SWAGGER_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  EMAIL_VERIFICATION_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

// VALIDACIÓN CON MANEJO DE ERRORES
function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Error de validación de variables de entorno:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error(
        '\n💡 Verifica tu archivo .env y asegúrate de que todas las variables requeridas estén definidas.',
      );
      process.exit(1);
    }
    throw error;
  }
}

// Validar y parsear variables de entorno
const env = validateEnvironment();

// CONFIGURACIÓN EXPORTADA
export const environment = {
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

  // Configuración JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
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
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  },

  // Configuración de seguridad
  security: {
    helmetEnabled: env.HELMET_ENABLED,
    apiKey: env.AUTH_SERVICE_API_KEY,
    maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
    accountLockTime: env.ACCOUNT_LOCK_TIME,
    passwordResetTokenExpires: env.PASSWORD_RESET_TOKEN_EXPIRES,
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

  // Configuración de cache TTL
  cache: {
    ttl: {
      userSessions: env.CACHE_TTL_USER_SESSIONS,
      userData: env.CACHE_TTL_USER_DATA,
      blacklist: env.CACHE_TTL_BLACKLIST,
    },
  },

  // Configuración de features
  features: {
    healthCheckEnabled: env.HEALTH_CHECK_ENABLED,
    swaggerEnabled: env.SWAGGER_ENABLED,
    emailVerificationEnabled: env.EMAIL_VERIFICATION_ENABLED,
  },

  // Exponer valores originales para compatibilidad (DEPRECATED - usar las propiedades estructuradas)
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  LOG_LEVEL: env.LOG_LEVEL,
  LOG_PRETTY: env.LOG_PRETTY,
  HELMET_ENABLED: env.HELMET_ENABLED,
  RATE_LIMIT_WINDOW_MS: env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: env.RATE_LIMIT_MAX_REQUESTS,
  HEALTH_CHECK_ENABLED: env.HEALTH_CHECK_ENABLED,
  SWAGGER_ENABLED: env.SWAGGER_ENABLED,
} as const;

// TIPOS TYPESCRIPT EXPORTADOS
export type AppConfig = typeof environment;
export type Environment = typeof env.NODE_ENV;

// VALIDACIONES ADICIONALES
// Validar secretos en producción
if (environment.app.isProduction) {
  // Validar que las URLs no contengan localhost
  if (environment.cors.origin.some((origin) => origin.includes('localhost'))) {
    console.warn('⚠️  Warning: CORS contiene orígenes localhost en producción');
  }

  // Validar longitud de secretos
  if (environment.jwt.secret.length < 64) {
    console.warn(
      '⚠️  Warning: JWT Secret debería tener al menos 64 caracteres en producción',
    );
  }

  if (environment.refreshToken.secret.length < 64) {
    console.warn(
      '⚠️  Warning: Refresh Token Secret debería tener al menos 64 caracteres en producción',
    );
  }

  if (environment.jwe.secret.length < 32) {
    console.warn(
      '⚠️  Warning: JWE Secret debería tener al menos 32 caracteres en producción',
    );
  }
}

// Validar configuración de rate limiting
if (environment.rateLimit.maxRequests > 1000) {
  console.warn(
    '⚠️  Warning: Rate limit muy alto, considera reducirlo por seguridad',
  );
}

// Validar configuración de bloqueo de cuentas
if (environment.security.maxLoginAttempts > 10) {
  console.warn(
    '⚠️  Warning: Muchos intentos de login permitidos antes del bloqueo',
  );
}

// Log de configuración en desarrollo
if (environment.app.isDevelopment) {
  console.log('🔧 Auth Service Configuration Loaded:');
  console.log(`   Environment: ${environment.app.env}`);
  console.log(`   Port: ${environment.app.port}`);
  console.log(`   JWT Expires: ${environment.jwt.expiresIn}`);
  console.log(
    `   Refresh Token Expires: ${environment.refreshToken.expiresIn}`,
  );
  console.log(
    `   Max Login Attempts: ${environment.security.maxLoginAttempts}`,
  );
  console.log(
    `   Account Lock Time: ${environment.security.accountLockTime / 1000 / 60} minutos`,
  );
  console.log(`   Redis Prefix: ${environment.redis.prefix}`);
  console.log(`   Log Level: ${environment.logging.level}`);
  console.log(
    `   Rate Limit: ${environment.rateLimit.maxRequests}/${environment.rateLimit.windowMs / 1000}s`,
  );
}

// FUNCIÓN PARA OBTENER RESUMEN DE CONFIGURACIÓN (sin secretos)
export const getConfigSummary = () => ({
  service: 'auth-service',
  environment: environment.app.env,
  port: environment.app.port,
  apiVersion: environment.app.apiVersion,
  features: {
    healthCheck: environment.features.healthCheckEnabled,
    swagger: environment.features.swaggerEnabled,
    emailVerification: environment.features.emailVerificationEnabled,
  },
  security: {
    maxLoginAttempts: environment.security.maxLoginAttempts,
    accountLockTimeMinutes: environment.security.accountLockTime / 1000 / 60,
    jwtExpiresIn: environment.jwt.expiresIn,
    refreshTokenExpiresIn: environment.refreshToken.expiresIn,
  },
  rateLimit: {
    maxRequests: environment.rateLimit.maxRequests,
    windowMinutes: environment.rateLimit.windowMs / 1000 / 60,
  },
  cache: {
    ttl: environment.cache.ttl,
  },
  cors: {
    originsCount: environment.cors.origin.length,
  },
});

export default environment;
