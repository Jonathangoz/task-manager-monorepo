// src/config/environment.ts
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { logger } from '@/utils/logger';

// Cargar variables de entorno
dotenvConfig();

// Schema de validación para variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.number().transform(Number).default(3001),
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
  HELMET_ENABLED: z.boolean().default(true),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.number().default(100),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.boolean().default(true),
  
  // Health Check
  HEALTH_CHECK_ENABLED: z.boolean().default(true),
  SWAGGER_ENABLED: z.boolean().default(true),
});

// Validar y exportar configuración
let environment: z.infer<typeof envSchema>;

try {
  environment = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    ).join('\n');
    
    logger.error('Environment validation failed:\n' + formattedErrors);
    process.exit(1);
  }
  throw error;
}

export { environment };