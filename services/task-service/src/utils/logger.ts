// src/utils/logger.ts - Task Service Logger - Estructura logging con Pino

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';
const logPretty = process.env.LOG_PRETTY === 'true';

// Logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: logLevel,
  base: {
    service: 'task-service',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    error: (err) => ({
      error: {
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
      },
    }),
  },
};

// Pretty printing for development
if (isDevelopment && logPretty) {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'yyyy-mm-dd HH:MM:ss',
    },
  };
}

// Create logger instance
export const logger = pino(loggerConfig);

// Request ID context for tracing
export const createRequestLogger = (requestId?: string) => {
  const reqId = requestId || uuidv4();
  return logger.child({ requestId: reqId });
};

// Structured logging helpers
export const loggers = {
  // Task operations
  taskCreated: (userId: string, taskId: string, title: string) =>
    logger.info({ userId, taskId, title, event: 'task.created' }, 'Task created'),

  taskUpdated: (userId: string, taskId: string, changes: object) =>
    logger.info({ userId, taskId, changes, event: 'task.updated' }, 'Task updated'),

  taskDeleted: (userId: string, taskId: string) =>
    logger.info({ userId, taskId, event: 'task.deleted' }, 'Task deleted'),

  taskStatusChanged: (userId: string, taskId: string, oldStatus: string, newStatus: string) =>
    logger.info({ userId, taskId, oldStatus, newStatus, event: 'task.status.changed' }, 'Task status changed'),

  // Category operations
  categoryCreated: (userId: string, categoryId: string, name: string) =>
    logger.info({ userId, categoryId, name, event: 'category.created' }, 'Category created'),

  categoryUpdated: (userId: string, categoryId: string, changes: object) =>
    logger.info({ userId, categoryId, changes, event: 'category.updated' }, 'Category updated'),

  categoryDeleted: (userId: string, categoryId: string) =>
    logger.info({ userId, categoryId, event: 'category.deleted' }, 'Category deleted'),

  // Authentication events
  tokenValidated: (userId: string, method: string) =>
    logger.info({ userId, method, event: 'auth.validated' }, 'Token validated'),

  authServiceError: (error: Error, endpoint: string) =>
    logger.error({ error, endpoint, event: 'auth.service.error' }, 'Auth service error'),

  // Cache events
  cacheHit: (key: string, ttl?: number) =>
    logger.debug({ key, ttl, event: 'cache.hit' }, 'Cache hit'),

  cacheMiss: (key: string) =>
    logger.debug({ key, event: 'cache.miss' }, 'Cache miss'),

  cacheError: (error: Error, key: string, operation: string) =>
    logger.error({ error, key, operation, event: 'cache.error' }, 'Cache operation failed'),

  // Database events
  dbQuery: (query: string, duration: number, rowCount?: number) =>
    logger.debug({ query, duration, rowCount, event: 'db.query' }, 'Database query executed'),

  dbError: (error: Error, operation: string) =>
    logger.error({ error, operation, event: 'db.error' }, 'Database operation failed'),

  // Security events
  rateLimitExceeded: (ip: string, endpoint: string, limit: number) =>
    logger.warn({ ip, endpoint, limit, event: 'security.rate_limit' }, 'Rate limit exceeded'),

  unauthorizedAccess: (ip: string, endpoint: string, reason: string) =>
    logger.warn({ ip, endpoint, reason, event: 'security.unauthorized' }, 'Unauthorized access attempt'),

  // Performance monitoring
  requestDuration: (method: string, path: string, statusCode: number, duration: number) =>
    logger.info({ method, path, statusCode, duration, event: 'request.completed' }, 'Request completed'),

  slowQuery: (query: string, duration: number, threshold: number) =>
    logger.warn({ query, duration, threshold, event: 'performance.slow_query' }, 'Slow database query detected'),
};

// Error severity levels
export const logError = {
  critical: (error: Error, context?: object) =>
    logger.fatal({ error, ...context }, 'Critical error occurred'),

  high: (error: Error, context?: object) =>
    logger.error({ error, ...context }, 'High severity error'),

  medium: (error: Error, context?: object) =>
    logger.warn({ error, ...context }, 'Medium severity error'),

  low: (error: Error, context?: object) =>
    logger.info({ error, ...context }, 'Low severity error'),
};

// Health check logging
export const healthCheck = {
  passed: (service: string, duration: number) =>
    logger.info({ service, duration, status: 'healthy' }, 'Health check passed'),

  failed: (service: string, error: Error, duration: number) =>
    logger.error({ service, error, duration, status: 'unhealthy' }, 'Health check failed'),

  degraded: (service: string, warning: string, duration: number) =>
    logger.warn({ service, warning, duration, status: 'degraded' }, 'Health check degraded'),
};

export default logger;