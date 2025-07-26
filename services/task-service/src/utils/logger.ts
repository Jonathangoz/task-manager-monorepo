// ==============================================
// src/utils/logger.ts - Task Service Logger
// Sistema de logging con Pino, timezone Bogotá y rotación de archivos
// ==============================================
// Rotación de Logs (Opcional)
// Para rotación automática, puedes agregar esta dependencia:
// pnpm add pino-roll
// Y modificar la configuración de producción:
// En lugar de 'pino/file', usar:
    /*  {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'app.log'),
          frequency: 'daily',
          size: '10M',
          mkdir: true,
        }
      } */
// ==============================================

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { config } from '@/config/environment';

// ==============================================
// CONFIGURACIÓN DE TIMEZONE BOGOTÁ
// ==============================================
const BOGOTA_TIMEZONE = 'America/Bogota';

// Función para formatear timestamp con timezone Bogotá
const formatTimestamp = () => {
  const now = new Date();
  const bogotaTime = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const parts = bogotaTime.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

// ==============================================
// CONFIGURACIÓN DE DIRECTORIOS DE LOGS
// ==============================================
const LOG_DIR = path.join(process.cwd(), 'logs');

// Crear directorio de logs si no existe
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// ==============================================
// CONFIGURACIÓN BASE DEL LOGGER
// ==============================================
const baseLoggerConfig: pino.LoggerOptions = {
  level: config.logging.level,
  base: {
    service: 'task-service',
    version: process.env.npm_package_version || '1.0.0',
    env: config.app.env,
    timezone: BOGOTA_TIMEZONE,
  },
  timestamp: () => `,"timestamp":"${formatTimestamp()}"`,
  formatters: {
    level: (label) => ({ level: label }),
    error: (err) => ({
      error: {
        type: err.constructor.name,
        message: err.message,
        stack: config.app.isDevelopment ? err.stack : undefined,
        code: (err as any).code,
        statusCode: (err as any).statusCode,
      },
    }),
  },
};

// ==============================================
// CONFIGURACIÓN PARA DESARROLLO
// ==============================================
const createDevelopmentLogger = (): pino.Logger => {
  const devConfig = { ...baseLoggerConfig };
  
  if (config.logging.pretty) {
    devConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,timezone',
        translateTime: false, // Usamos nuestro timestamp personalizado
        messageFormat: '[{service}] {msg}',
        customPrettifiers: {
          timestamp: (timestamp: string) => `🕐 ${timestamp}`,
          level: (logLevel: string) => {
            const levelEmojis: Record<string, string> = {
              trace: '🔍',
              debug: '🐛',
              info: 'ℹ️',
              warn: '⚠️',
              error: '❌',
              fatal: '💀',
            };
            return `${levelEmojis[logLevel] || '📝'} ${logLevel}`;
          },
        },
      },
    };
  }

  return pino(devConfig);
};

// ==============================================
// CONFIGURACIÓN PARA PRODUCCIÓN
// ==============================================
const createProductionLogger = (): pino.Logger => {
  const productionConfig = { ...baseLoggerConfig };

  // En producción, escribimos a múltiples destinos
  const destinations = [
    // Archivo general (todos los logs)
    {
      level: config.logging.level,
      dest: path.join(LOG_DIR, 'app.log'),
    },
    // Archivo de errores (solo errores y fatales)
    {
      level: 'error',
      dest: path.join(LOG_DIR, 'error.log'),
    },
    // Stdout para contenedores/PM2
    {
      level: config.logging.level,
      dest: 1, // stdout
    },
  ];

  // Configurar transporte múltiple
  productionConfig.transport = {
    targets: destinations.map(dest => ({
      target: 'pino/file',
      level: dest.level,
      options: {
        destination: dest.dest,
        mkdir: true,
      },
    })),
  };

  return pino(productionConfig);
};

// ==============================================
// CREAR INSTANCIA DEL LOGGER
// ==============================================
export const logger = config.app.isDevelopment 
  ? createDevelopmentLogger() 
  : createProductionLogger();

// ==============================================
// LOGGER CON CONTEXTO DE REQUEST
// ==============================================
export const createRequestLogger = (requestId?: string) => {
  const reqId = requestId || uuidv4();
  return logger.child({ 
    requestId: reqId,
    context: 'request',
  });
};

// ==============================================
// LOGGERS ESTRUCTURADOS POR DOMINIO
// ==============================================
export const loggers = {
  // ==============================================
  // OPERACIONES DE TAREAS
  // ==============================================
  taskCreated: (userId: string, taskId: string, title: string, categoryId?: string) =>
    logger.info({ 
      userId, 
      taskId, 
      title, 
      categoryId,
      event: 'task.created',
      domain: 'tasks',
    }, `📝 Tarea creada: "${title}"`),

  taskUpdated: (userId: string, taskId: string, changes: object) =>
    logger.info({ 
      userId, 
      taskId, 
      changes, 
      event: 'task.updated',
      domain: 'tasks',
    }, `✏️ Tarea actualizada: ${taskId}`),

  taskDeleted: (userId: string, taskId: string, title?: string) =>
    logger.info({ 
      userId, 
      taskId, 
      title,
      event: 'task.deleted',
      domain: 'tasks',
    }, `🗑️ Tarea eliminada: ${title || taskId}`),

  taskStatusChanged: (userId: string, taskId: string, oldStatus: string, newStatus: string) =>
    logger.info({ 
      userId, 
      taskId, 
      oldStatus, 
      newStatus, 
      event: 'task.status.changed',
      domain: 'tasks',
    }, `🔄 Estado de tarea cambiado: ${oldStatus} → ${newStatus}`),

  taskCompleted: (userId: string, taskId: string, completedAt: Date) =>
    logger.info({
      userId,
      taskId,
      completedAt,
      event: 'task.completed',
      domain: 'tasks',
    }, `✅ Tarea completada: ${taskId}`),

  // ==============================================
  // OPERACIONES DE CATEGORÍAS
  // ==============================================
  categoryCreated: (userId: string, categoryId: string, name: string, color?: string) =>
    logger.info({ 
      userId, 
      categoryId, 
      name, 
      color,
      event: 'category.created',
      domain: 'categories',
    }, `📁 Categoría creada: "${name}"`),

  categoryUpdated: (userId: string, categoryId: string, changes: object) =>
    logger.info({ 
      userId, 
      categoryId, 
      changes, 
      event: 'category.updated',
      domain: 'categories',
    }, `📝 Categoría actualizada: ${categoryId}`),

  categoryDeleted: (userId: string, categoryId: string, name?: string) =>
    logger.info({ 
      userId, 
      categoryId, 
      name,
      event: 'category.deleted',
      domain: 'categories',
    }, `🗑️ Categoría eliminada: ${name || categoryId}`),

  // ==============================================
  // EVENTOS DE AUTENTICACIÓN
  // ==============================================
  tokenValidated: (userId: string, method: 'jwt' | 'auth-service', ip?: string) =>
    logger.info({ 
      userId, 
      method, 
      ip,
      event: 'auth.validated',
      domain: 'auth',
    }, `🔐 Token validado para usuario: ${userId}`),

  tokenValidationFailed: (reason: string, ip?: string, token?: string) =>
    logger.warn({
      reason,
      ip,
      tokenPreview: token ? `${token.substring(0, 10)}...` : undefined,
      event: 'auth.validation.failed',
      domain: 'auth',
    }, `🚫 Validación de token falló: ${reason}`),

  authServiceError: (error: Error, endpoint: string, statusCode?: number) =>
    logger.error({ 
      error, 
      endpoint, 
      statusCode,
      event: 'auth.service.error',
      domain: 'auth',
    }, `❌ Error en servicio de autenticación: ${endpoint}`),

  // ==============================================
  // EVENTOS DE CACHE
  // ==============================================
  cacheHit: (key: string, ttl?: number) =>
    logger.debug({ 
      key, 
      ttl, 
      event: 'cache.hit',
      domain: 'cache',
    }, `💾 Cache hit: ${key}`),

  cacheMiss: (key: string) =>
    logger.debug({ 
      key, 
      event: 'cache.miss',
      domain: 'cache',
    }, `🔍 Cache miss: ${key}`),

  cacheSet: (key: string, ttl: number) =>
    logger.debug({
      key,
      ttl,
      event: 'cache.set',
      domain: 'cache',
    }, `💾 Cache set: ${key} (TTL: ${ttl}s)`),

  cacheError: (error: Error, key: string, operation: 'get' | 'set' | 'del') =>
    logger.error({ 
      error, 
      key, 
      operation, 
      event: 'cache.error',
      domain: 'cache',
    }, `❌ Error en cache (${operation}): ${key}`),

  // ==============================================
  // EVENTOS DE BASE DE DATOS
  // ==============================================
  dbQuery: (operation: string, table: string, duration: number, rowCount?: number) =>
    logger.debug({ 
      operation,
      table,
      duration, 
      rowCount, 
      event: 'db.query',
      domain: 'database',
    }, `🗄️ Query ${operation} en ${table} (${duration}ms)`),

  dbError: (error: Error, operation: string, table?: string) =>
    logger.error({ 
      error, 
      operation, 
      table,
      event: 'db.error',
      domain: 'database',
    }, `❌ Error en base de datos (${operation})`),

  dbConnection: (status: 'connected' | 'disconnected' | 'error', details?: object) =>
    logger.info({
      status,
      details,
      event: 'db.connection',
      domain: 'database',
    }, `🔌 Base de datos: ${status}`),

  slowQuery: (operation: string, table: string, duration: number, threshold: number) =>
    logger.warn({ 
      operation,
      table,
      duration, 
      threshold, 
      event: 'performance.slow_query',
      domain: 'performance',
    }, `🐌 Query lenta detectada: ${operation} en ${table} (${duration}ms > ${threshold}ms)`),

  // ==============================================
  // EVENTOS DE SEGURIDAD
  // ==============================================
  rateLimitExceeded: (ip: string, endpoint: string, limit: number, windowMs: number) =>
    logger.warn({ 
      ip, 
      endpoint, 
      limit, 
      windowMs,
      event: 'security.rate_limit',
      domain: 'security',
    }, `🚫 Rate limit excedido: ${ip} en ${endpoint} (${limit} requests/${windowMs}ms)`),

  unauthorizedAccess: (ip: string, endpoint: string, reason: string, userAgent?: string) =>
    logger.warn({ 
      ip, 
      endpoint, 
      reason, 
      userAgent,
      event: 'security.unauthorized',
      domain: 'security',
    }, `🚫 Acceso no autorizado: ${ip} en ${endpoint} - ${reason}`),

  suspiciousActivity: (ip: string, activity: string, details?: object) =>
    logger.warn({
      ip,
      activity,
      details,
      event: 'security.suspicious',
      domain: 'security',
    }, `⚠️ Actividad sospechosa: ${activity} desde ${ip}`),

  // ==============================================
  // MONITOREO DE RENDIMIENTO
  // ==============================================
  requestCompleted: (method: string, path: string, statusCode: number, duration: number, userId?: string) =>
    logger.info({ 
      method, 
      path, 
      statusCode, 
      duration, 
      userId,
      event: 'request.completed',
      domain: 'performance',
    }, `🌐 ${method} ${path} - ${statusCode} (${duration}ms)`),

  highMemoryUsage: (usage: number, threshold: number) =>
    logger.warn({
      memoryUsage: usage,
      threshold,
      event: 'performance.high_memory',
      domain: 'performance',
    }, `🧠 Alto uso de memoria: ${usage}MB > ${threshold}MB`),

  highCpuUsage: (usage: number, threshold: number) =>
    logger.warn({
      cpuUsage: usage,
      threshold,
      event: 'performance.high_cpu',
      domain: 'performance',
    }, `⚡ Alto uso de CPU: ${usage}% > ${threshold}%`),
};

// ==============================================
// MANEJO DE ERRORES POR SEVERIDAD
// ==============================================
export const logError = {
  critical: (error: Error, context?: object, userId?: string) => {
    logger.fatal({ 
      error, 
      userId,
      severity: 'critical',
      ...context 
    }, `💀 ERROR CRÍTICO: ${error.message}`);
    
    // En producción, podrías enviar alertas aquí
    if (config.app.isProduction) {
      // TODO: Integrar con sistema de alertas (Slack, email, etc.)
    }
  },

  high: (error: Error, context?: object, userId?: string) =>
    logger.error({ 
      error, 
      userId,
      severity: 'high',
      ...context 
    }, `❌ Error crítico: ${error.message}`),

  medium: (error: Error, context?: object, userId?: string) =>
    logger.warn({ 
      error, 
      userId,
      severity: 'medium',
      ...context 
    }, `⚠️ Error medio: ${error.message}`),

  low: (error: Error, context?: object, userId?: string) =>
    logger.info({ 
      error, 
      userId,
      severity: 'low',
      ...context 
    }, `ℹ️ Error menor: ${error.message}`),
};

// ==============================================
// HEALTH CHECKS Y MONITOREO
// ==============================================
export const healthCheck = {
  passed: (service: string, duration: number, details?: object) =>
    logger.info({ 
      service, 
      duration, 
      status: 'healthy',
      details,
      event: 'health.check.passed',
      domain: 'health',
    }, `✅ Health check OK: ${service} (${duration}ms)`),

  failed: (service: string, error: Error, duration: number) =>
    logger.error({ 
      service, 
      error, 
      duration, 
      status: 'unhealthy',
      event: 'health.check.failed',
      domain: 'health',
    }, `❌ Health check FAILED: ${service} (${duration}ms)`),

  degraded: (service: string, warning: string, duration: number) =>
    logger.warn({ 
      service, 
      warning, 
      duration, 
      status: 'degraded',
      event: 'health.check.degraded',
      domain: 'health',
    }, `⚠️ Health check DEGRADED: ${service} - ${warning} (${duration}ms)`),
};

// ==============================================
// UTILIDADES ADICIONALES
// ==============================================

// Logger para startup de la aplicación
export const startup = {
  serviceStarted: (port: number, env: string) =>
    logger.info({
      port,
      env,
      event: 'service.started',
      domain: 'startup',
    }, `🚀 Task Service iniciado en puerto ${port} (${env})`),

  configLoaded: (config: object) =>
    logger.info({
      config,
      event: 'config.loaded',
      domain: 'startup',
    }, '⚙️ Configuración cargada'),

  dependencyConnected: (dependency: string, version?: string) =>
    logger.info({
      dependency,
      version,
      event: 'dependency.connected',
      domain: 'startup',
    }, `🔌 Conectado a ${dependency}${version ? ` v${version}` : ''}`),

  gracefulShutdown: (signal: string) =>
    logger.info({
      signal,
      event: 'service.shutdown',
      domain: 'startup',
    }, `🛑 Apagado graceful recibido: ${signal}`),
};

// Log de información del sistema al inicializar
if (config.app.isDevelopment) {
  logger.info({
    logLevel: config.logging.level,
    timezone: BOGOTA_TIMEZONE,
    logDir: LOG_DIR,
    prettyPrint: config.logging.pretty,
  }, '🔧 Logger inicializado con configuración de desarrollo');
} else {
  logger.info({
    logLevel: config.logging.level,
    timezone: BOGOTA_TIMEZONE,
    logDir: LOG_DIR,
  }, '🔧 Logger inicializado para producción');
}

export default logger;