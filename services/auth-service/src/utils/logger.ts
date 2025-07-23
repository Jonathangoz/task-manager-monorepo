// src/utils/logger.ts
import pino from 'pino';
import { config } from '@/config/environment';

// Configuración del logger basada en el entorno
const loggerConfig: pino.LoggerOptions = {
  level: config.logging.level,
  ...(config.logging.pretty && config.app.env !== 'production' 
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: true,
          },
        },
      } 
    : {}),
  base: {
    service: 'auth-service',
    env: config.app.env,
    version: process.env.npm_package_version || '1.0.0',
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};

// Crear el logger principal
export const logger = pino(loggerConfig);

// Logger específico para requests HTTP
export const httpLogger = logger.child({ component: 'http' });

// Logger específico para base de datos
export const dbLogger = logger.child({ component: 'database' });

// Logger específico para Redis
export const redisLogger = logger.child({ component: 'redis' });

// Logger específico para autenticación
export const authLogger = logger.child({ component: 'auth' });

// Función para logs de seguridad
export const securityLogger = logger.child({ component: 'security' });

// Función helper para crear child loggers con contexto
export const createContextLogger = (context: Record<string, any>) => {
  return logger.child(context);
};