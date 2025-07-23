// src/config/environment.ts
import { config } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
config();

// Schema de validación para variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3001),
  API_VERSION: z.string().default('v1'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string(),
  REDIS_PREFIX: z.string().default('auth:'),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('task-manager-auth'),
  
  // Refresh Token
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  
  // JWE
  JWE_SECRET: z.string().min(32),
  JWE_ALGORITHM: z.string().default('dir'),
  JWE_ENCRYPTION: z.string().default('A256GCM'),
  
  // CORS
  CORS_ORIGIN: z.string(),
  
  // Security
  HELMET_ENABLED: z.string().transform(Boolean).default(true),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  RATE_LIMIT_ENABLED: z.string().transform(Boolean).default(true),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.string().transform(Boolean).default(true),
  
  // Session
  SESSION_MAX_AGE: z.string().transform(Number).default(86400000),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default(3600000),
  
  // Argon2
  ARGON2_MEMORY_COST: z.string().transform(Number).default(65536),
  ARGON2_TIME_COST: z.string().transform(Number).default(3),
  ARGON2_PARALLELISM: z.string().transform(Number).default(4),
  ARGON2_HASH_LENGTH: z.string().transform(Number).default(32),
  ARGON2_SALT_LENGTH: z.string().transform(Number).default(16),
  
  // Features
  HEALTH_CHECK_ENABLED: z.string().transform(Boolean).default(true),
  SWAGGER_ENABLED: z.string().transform(Boolean).default(true),
  SWAGGER_PATH: z.string().default('/api/v1/docs'),
});

// Validar y exportar configuración
const validatedEnv = envSchema.parse(process.env);

export const config = {
  app: {
    env: validatedEnv.NODE_ENV,
    port: validatedEnv.PORT,
    apiVersion: validatedEnv.API_VERSION,
  },
  database: {
    url: validatedEnv.DATABASE_URL,
  },
  redis: {
    url: validatedEnv.REDIS_URL,
    prefix: validatedEnv.REDIS_PREFIX,
  },
  jwt: {
    secret: validatedEnv.JWT_SECRET,
    expiresIn: validatedEnv.JWT_EXPIRES_IN,
    issuer: validatedEnv.JWT_ISSUER,
  },
  refreshToken: {
    secret: validatedEnv.REFRESH_TOKEN_SECRET,
    expiresIn: validatedEnv.REFRESH_TOKEN_EXPIRES_IN,
  },
  jwe: {
    secret: validatedEnv.JWE_SECRET,
    algorithm: validatedEnv.JWE_ALGORITHM,
    encryption: validatedEnv.JWE_ENCRYPTION,
  },
  cors: {
    origin: validatedEnv.CORS_ORIGIN.split(',').map(url => url.trim()),
  },
  security: {
    helmetEnabled: validatedEnv.HELMET_ENABLED,
  },
  rateLimit: {
    windowMs: validatedEnv.RATE_LIMIT_WINDOW_MS,
    maxRequests: validatedEnv.RATE_LIMIT_MAX_REQUESTS,
    enabled: validatedEnv.RATE_LIMIT_ENABLED,
  },
  logging: {
    level: validatedEnv.LOG_LEVEL,
    pretty: validatedEnv.LOG_PRETTY,
  },
  session: {
    maxAge: validatedEnv.SESSION_MAX_AGE,
    cleanupInterval: validatedEnv.SESSION_CLEANUP_INTERVAL,
  },
  argon2: {
    memoryCost: validatedEnv.ARGON2_MEMORY_COST,
    timeCost: validatedEnv.ARGON2_TIME_COST,
    parallelism: validatedEnv.ARGON2_PARALLELISM,
    hashLength: validatedEnv.ARGON2_HASH_LENGTH,
    saltLength: validatedEnv.ARGON2_SALT_LENGTH,
  },
  features: {
    healthCheck: validatedEnv.HEALTH_CHECK_ENABLED,
    swagger: validatedEnv.SWAGGER_ENABLED,
    swaggerPath: validatedEnv.SWAGGER_PATH,
  },
} as const;

// Exportar tipo de configuración
export type Config = typeof config;