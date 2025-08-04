// src/utils/logger.ts - Task Service Logger
// Sistema de logging con Pino, timezone Bogotá y rotación de archivos
// Específico para operaciones de tareas y categorías

import pino from 'pino';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { AppConfig } from '@/config/environment';

// CONFIGURACIÓN DE TIMEZONE BOGOTÁ
const BOGOTA_TIMEZONE = 'America/Bogota';

// CONFIGURACIÓN TEMPORAL HASTA QUE SE CARGUE ENVIRONMENT
const getLogLevel = (): pino.LevelWithSilent => {
  const level = process.env.LOG_LEVEL as pino.LevelWithSilent;
  return ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)
    ? level
    : 'info';
};

const getLogPretty = (): boolean => {
  return (
    process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development'
  );
};

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// CONFIGURACIÓN DE DIRECTORIOS DE LOGS
const LOG_DIR = path.join(process.cwd(), 'logs');

// Crear directorio de logs si no existe
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// Interfaz para el objeto de log con un error
interface LogObjectWithError {
  err?: Error & { code?: string; statusCode?: number };
  [key: string]: unknown;
}

// CONFIGURACIÓN BASE DEL LOGGER
const baseLoggerConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  base: {
    service: 'task-service',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    timezone: BOGOTA_TIMEZONE,
  },
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      const logObject = object as LogObjectWithError;
      if (logObject.err) {
        const err = logObject.err;
        const errorDetails = {
          type: err.constructor.name,
          message: err.message,
          stack: isDevelopment ? err.stack : undefined,
          code: err.code,
          statusCode: err.statusCode,
        };
        const { err: _err, ...rest } = logObject;
        return { ...rest, error: errorDetails };
      }
      return object;
    },
  },
};

// CONFIGURACIÓN PARA DESARROLLO
const createDevelopmentLogger = (): pino.Logger => {
  const devConfig = { ...baseLoggerConfig };

  if (getLogPretty()) {
    devConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,timezone',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        messageFormat: '[{service}] {msg}',
        singleLine: false,
      },
    };
  }

  return pino(devConfig);
};

// CONFIGURACIÓN PARA PRODUCCIÓN
const createProductionLogger = (): pino.Logger => {
  const productionConfig: pino.LoggerOptions = {
    level: getLogLevel(),
    base: {
      service: 'task-service',
      version: process.env.npm_package_version || '1.0.0',
      env: process.env.NODE_ENV || 'development',
      timezone: BOGOTA_TIMEZONE,
    },
  };

  // En producción, escribimos a múltiples destinos
  const destinations = [
    // Archivo general (todos los logs)
    {
      level: getLogLevel(),
      dest: path.join(LOG_DIR, 'task-service.log'),
    },
    // Archivo de errores (solo errores y fatales)
    {
      level: 'error',
      dest: path.join(LOG_DIR, 'task-service-error.log'),
    },
    // Archivo de seguridad (eventos de autenticación y autorización)
    {
      level: 'info',
      dest: path.join(LOG_DIR, 'task-service-security.log'),
    },
    // Stdout para contenedores/PM2
    {
      level: getLogLevel(),
      dest: 1, // stdout
    },
  ];

  // Configurar transporte múltiple
  productionConfig.transport = {
    targets: destinations.map((dest) => ({
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

// CREAR INSTANCIA DEL LOGGER
export const logger = isDevelopment
  ? createDevelopmentLogger()
  : createProductionLogger();

// LOGGERS ESPECIALIZADOS POR COMPONENTE
export const httpLogger = logger.child({
  component: 'http',
  domain: 'web',
});

export const dbLogger = logger.child({
  component: 'database',
  domain: 'persistence',
});

export const redisLogger = logger.child({
  component: 'redis',
  domain: 'cache',
});

export const taskLogger = logger.child({
  component: 'task',
  domain: 'business',
});

export const categoryLogger = logger.child({
  component: 'category',
  domain: 'business',
});

export const authLogger = logger.child({
  component: 'auth',
  domain: 'security',
});

export const securityLogger = logger.child({
  component: 'security',
  domain: 'security',
});

// LOGGER CON CONTEXTO DE REQUEST
export const createRequestLogger = (requestId?: string, userId?: string) => {
  const context: Record<string, string | undefined> = {
    context: 'request',
    requestId,
    userId,
  };

  // Filtrar propiedades indefinidas para un log más limpio
  Object.keys(context).forEach((key) =>
    context[key] === undefined ? delete context[key] : {},
  );

  return logger.child(context);
};

// Función helper para crear child loggers con contexto
export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// LOGGERS ESTRUCTURADOS POR DOMINIO DE TASK SERVICE
export const loggers = {
  // EVENTOS DE TAREAS
  taskCreated: (
    taskId: string,
    title: string,
    userId: string,
    categoryId?: string,
  ) =>
    taskLogger.info(
      {
        taskId,
        title,
        userId,
        categoryId,
        event: 'task.created',
        domain: 'business',
      },
      `📝 Tarea creada: "${title}" por usuario ${userId}`,
    ),

  taskUpdated: (
    taskId: string,
    title: string,
    userId: string,
    updatedFields: string[],
  ) =>
    taskLogger.info(
      {
        taskId,
        title,
        userId,
        updatedFields,
        event: 'task.updated',
        domain: 'business',
      },
      `✏️ Tarea actualizada: "${title}" - campos: ${updatedFields.join(', ')}`,
    ),

  taskDeleted: (taskId: string, title: string, userId: string) =>
    taskLogger.info(
      {
        taskId,
        title,
        userId,
        event: 'task.deleted',
        domain: 'business',
      },
      `🗑️ Tarea eliminada: "${title}" por usuario ${userId}`,
    ),

  taskStatusChanged: (
    taskId: string,
    title: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
  ) =>
    taskLogger.info(
      {
        taskId,
        title,
        oldStatus,
        newStatus,
        userId,
        event: 'task.status.changed',
        domain: 'business',
      },
      `🔄 Estado de tarea cambiado: "${title}" de ${oldStatus} a ${newStatus}`,
    ),

  taskCompleted: (
    taskId: string,
    title: string,
    userId: string,
    completionTime?: Date,
  ) =>
    taskLogger.info(
      {
        taskId,
        title,
        userId,
        completionTime,
        event: 'task.completed',
        domain: 'business',
      },
      `✅ Tarea completada: "${title}" por usuario ${userId}`,
    ),

  taskOverdue: (taskId: string, title: string, userId: string, dueDate: Date) =>
    taskLogger.warn(
      {
        taskId,
        title,
        userId,
        dueDate,
        event: 'task.overdue',
        domain: 'business',
      },
      `⏰ Tarea vencida: "${title}" (vencimiento: ${dueDate.toISOString()})`,
    ),

  taskPriorityChanged: (
    taskId: string,
    title: string,
    oldPriority: string,
    newPriority: string,
    userId: string,
  ) =>
    taskLogger.info(
      {
        taskId,
        title,
        oldPriority,
        newPriority,
        userId,
        event: 'task.priority.changed',
        domain: 'business',
      },
      `🎯 Prioridad de tarea cambiada: "${title}" de ${oldPriority} a ${newPriority}`,
    ),

  taskBulkOperation: (
    operation: string,
    taskIds: string[],
    userId: string,
    affectedCount: number,
  ) =>
    taskLogger.info(
      {
        operation,
        taskIds,
        userId,
        affectedCount,
        event: 'task.bulk.operation',
        domain: 'business',
      },
      `📦 Operación en lote: ${operation} aplicada a ${affectedCount} tareas`,
    ),

  // EVENTOS DE CATEGORÍAS
  categoryCreated: (
    categoryId: string,
    name: string,
    userId: string,
    color?: string,
    icon?: string,
  ) =>
    categoryLogger.info(
      {
        categoryId,
        name,
        userId,
        color,
        icon,
        event: 'category.created',
        domain: 'business',
      },
      `📁 Categoría creada: "${name}" por usuario ${userId}`,
    ),

  categoryUpdated: (
    categoryId: string,
    name: string,
    userId: string,
    updatedFields: string[],
  ) =>
    categoryLogger.info(
      {
        categoryId,
        name,
        userId,
        updatedFields,
        event: 'category.updated',
        domain: 'business',
      },
      `✏️ Categoría actualizada: "${name}" - campos: ${updatedFields.join(', ')}`,
    ),

  categoryDeleted: (
    categoryId: string,
    name: string,
    userId: string,
    taskCount?: number,
  ) =>
    categoryLogger.info(
      {
        categoryId,
        name,
        userId,
        taskCount,
        event: 'category.deleted',
        domain: 'business',
      },
      `🗑️ Categoría eliminada: "${name}" (${taskCount || 0} tareas afectadas)`,
    ),

  categoryBulkDeleted: (
    categoryIds: string[],
    userId: string,
    affectedCount: number,
    totalTasks: number,
  ) =>
    categoryLogger.info(
      {
        categoryIds,
        userId,
        affectedCount,
        totalTasks,
        event: 'category.bulk.deleted',
        domain: 'business',
      },
      `🗂️ Eliminación en lote: ${affectedCount} categorías (${totalTasks} tareas afectadas)`,
    ),

  categoryTasksReassigned: (
    fromCategoryId: string,
    toCategoryId: string,
    taskCount: number,
    userId: string,
  ) =>
    categoryLogger.info(
      {
        fromCategoryId,
        toCategoryId,
        taskCount,
        userId,
        event: 'category.tasks.reassigned',
        domain: 'business',
      },
      `🔄 ${taskCount} tareas reasignadas de categoría ${fromCategoryId} a ${toCategoryId}`,
    ),

  categoryLimitReached: (
    userId: string,
    currentCount: number,
    maxCount: number,
  ) =>
    categoryLogger.warn(
      {
        userId,
        currentCount,
        maxCount,
        event: 'category.limit.reached',
        domain: 'business',
      },
      `⚠️ Usuario ${userId} alcanzó límite de categorías: ${currentCount}/${maxCount}`,
    ),

  // EVENTOS DE AUTENTICACIÓN Y AUTORIZACIÓN
  tokenValidated: (userId: string, ip?: string, userAgent?: string) =>
    authLogger.info(
      {
        userId,
        ip,
        userAgent,
        event: 'auth.token.validated',
        domain: 'security',
      },
      `🔑 Token validado para usuario ${userId}`,
    ),

  tokenValidationFailed: (reason: string, ip?: string, tokenPreview?: string) =>
    securityLogger.warn(
      {
        reason,
        ip,
        tokenPreview,
        event: 'auth.token.validation.failed',
        domain: 'security',
      },
      `❌ Validación de token falló: ${reason}`,
    ),

  unauthorizedAccess: (
    ip: string,
    endpoint: string,
    reason: string,
    userAgent?: string,
  ) =>
    securityLogger.warn(
      {
        ip,
        endpoint,
        reason,
        userAgent,
        event: 'security.unauthorized',
        domain: 'security',
      },
      `🚫 Acceso no autorizado: ${ip} en ${endpoint} - ${reason}`,
    ),

  forbiddenAccess: (
    userId: string,
    resource: string,
    action: string,
    ip?: string,
  ) =>
    securityLogger.warn(
      {
        userId,
        resource,
        action,
        ip,
        event: 'security.forbidden',
        domain: 'security',
      },
      `🔒 Acceso prohibido: usuario ${userId} intentó ${action} en ${resource}`,
    ),

  // EVENTOS DE SEGURIDAD
  suspiciousActivity: (
    ip: string,
    activity: string,
    details?: object,
    userId?: string,
  ) =>
    securityLogger.warn(
      {
        ip,
        activity,
        details,
        userId,
        event: 'security.suspicious',
        domain: 'security',
      },
      `⚠️ Actividad sospechosa: ${activity} desde ${ip}`,
    ),

  rateLimitExceeded: (
    ip: string,
    endpoint: string,
    limit: number,
    windowMs: number,
    userId?: string,
  ) =>
    securityLogger.warn(
      {
        ip,
        endpoint,
        limit,
        windowMs,
        userId,
        event: 'security.rate_limit',
        domain: 'security',
      },
      `🚫 Rate limit excedido: ${ip} en ${endpoint} (${limit}/${windowMs}ms)`,
    ),

  // EVENTOS DE BASE DE DATOS
  dbQuery: (
    operation: string,
    table: string,
    duration: number,
    recordCount?: string,
  ) =>
    dbLogger.debug(
      {
        operation,
        table,
        duration,
        recordCount,
        event: 'db.query',
        domain: 'database',
      },
      `🗄️ Query ${operation} en ${table} (${duration}ms)${recordCount ? ` - ${recordCount} registros` : ''}`,
    ),

  dbError: (error: Error, operation: string, table?: string, userId?: string) =>
    dbLogger.error(
      {
        error,
        operation,
        table,
        userId,
        event: 'db.error',
        domain: 'database',
      },
      `❌ Error en BD (${operation}): ${error.message}`,
    ),

  dbConnection: (
    status: 'connected' | 'disconnected' | 'error',
    details?: object,
  ) =>
    dbLogger.info(
      {
        status,
        details,
        event: 'db.connection',
        domain: 'database',
      },
      `🔌 Base de datos: ${status}`,
    ),

  slowQuery: (
    operation: string,
    table: string,
    duration: number,
    threshold: number,
  ) =>
    dbLogger.warn(
      {
        operation,
        table,
        duration,
        threshold,
        event: 'performance.slow_query',
        domain: 'performance',
      },
      `🐌 Query lenta: ${operation} en ${table} (${duration}ms > ${threshold}ms)`,
    ),

  // EVENTOS DE CACHE (REDIS)
  cacheHit: (key: string, ttl?: number, userId?: string) =>
    redisLogger.debug(
      {
        key,
        ttl,
        userId,
        event: 'cache.hit',
        domain: 'cache',
      },
      `💾 Cache hit: ${key}`,
    ),

  cacheMiss: (key: string, userId?: string) =>
    redisLogger.debug(
      {
        key,
        userId,
        event: 'cache.miss',
        domain: 'cache',
      },
      `🔍 Cache miss: ${key}`,
    ),

  cacheSet: (key: string, ttl: number, userId?: string) =>
    redisLogger.debug(
      {
        key,
        ttl,
        userId,
        event: 'cache.set',
        domain: 'cache',
      },
      `💾 Cache set: ${key} (TTL: ${ttl}s)`,
    ),

  cacheError: (
    error: Error,
    key: string,
    operation: 'get' | 'set' | 'del',
    userId?: string,
  ) =>
    redisLogger.error(
      {
        error,
        key,
        operation,
        userId,
        event: 'cache.error',
        domain: 'cache',
      },
      `❌ Error en cache (${operation}): ${key}`,
    ),

  cacheInvalidated: (pattern: string, count: number, reason: string) =>
    redisLogger.info(
      {
        pattern,
        count,
        reason,
        event: 'cache.invalidated',
        domain: 'cache',
      },
      `🧹 Cache invalidado: ${count} claves con patrón "${pattern}" - ${reason}`,
    ),

  // EVENTOS DE BÚSQUEDA Y FILTRADO
  searchPerformed: (
    userId: string,
    query: string,
    resultsCount: number,
    duration: number,
  ) =>
    taskLogger.info(
      {
        userId,
        query,
        resultsCount,
        duration,
        event: 'search.performed',
        domain: 'business',
      },
      `🔍 Búsqueda realizada: "${query}" - ${resultsCount} resultados (${duration}ms)`,
    ),

  filterApplied: (userId: string, filters: object, resultsCount: number) =>
    taskLogger.info(
      {
        userId,
        filters,
        resultsCount,
        event: 'filter.applied',
        domain: 'business',
      },
      `🔧 Filtros aplicados - ${resultsCount} resultados`,
    ),

  // EVENTOS DE ESTADÍSTICAS
  statsUpdated: (userId: string, statsData: object, duration: number) =>
    taskLogger.info(
      {
        userId,
        statsData,
        duration,
        event: 'stats.updated',
        domain: 'business',
      },
      `📊 Estadísticas actualizadas para usuario ${userId} (${duration}ms)`,
    ),

  statsGenerated: (userId: string, period: string, metricsCount: number) =>
    taskLogger.info(
      {
        userId,
        period,
        metricsCount,
        event: 'stats.generated',
        domain: 'business',
      },
      `📈 Estadísticas generadas: período ${period}, ${metricsCount} métricas`,
    ),

  // MONITOREO DE RENDIMIENTO
  requestCompleted: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
  ) =>
    httpLogger.info(
      {
        method,
        path,
        statusCode,
        duration,
        userId,
        event: 'request.completed',
        domain: 'web',
      },
      `🌐 ${method} ${path} - ${statusCode} (${duration}ms)`,
    ),

  highMemoryUsage: (usage: number, threshold: number) =>
    logger.warn(
      {
        memoryUsage: usage,
        threshold,
        event: 'performance.high_memory',
        domain: 'performance',
      },
      `🧠 Alto uso de memoria: ${usage}MB > ${threshold}MB`,
    ),

  highCpuUsage: (usage: number, threshold: number) =>
    logger.warn(
      {
        cpuUsage: usage,
        threshold,
        event: 'performance.high_cpu',
        domain: 'performance',
      },
      `⚡ Alto uso de CPU: ${usage}% > ${threshold}%`,
    ),

  // EVENTOS DE INTEGRACIÓN CON AUTH SERVICE
  authServiceCalled: (endpoint: string, duration: number, statusCode: number) =>
    authLogger.debug(
      {
        endpoint,
        duration,
        statusCode,
        event: 'auth_service.called',
        domain: 'integration',
      },
      `🔗 Auth Service llamado: ${endpoint} - ${statusCode} (${duration}ms)`,
    ),

  authServiceError: (endpoint: string, error: Error, duration: number) =>
    authLogger.error(
      {
        endpoint,
        error,
        duration,
        event: 'auth_service.error',
        domain: 'integration',
      },
      `❌ Error en Auth Service: ${endpoint} - ${error.message} (${duration}ms)`,
    ),

  authServiceTimeout: (endpoint: string, timeout: number) =>
    authLogger.warn(
      {
        endpoint,
        timeout,
        event: 'auth_service.timeout',
        domain: 'integration',
      },
      `⏱️ Timeout en Auth Service: ${endpoint} (${timeout}ms)`,
    ),
};

// MANEJO DE ERRORES POR SEVERIDAD
export const logError = {
  critical: (error: Error, context?: object, userId?: string) => {
    logger.fatal(
      {
        error,
        userId,
        severity: 'critical',
        ...context,
      },
      `💀 ERROR CRÍTICO: ${error.message}`,
    );

    // En producción, podrías enviar alertas aquí
    if (isProduction) {
      // TODO: Integrar con sistema de alertas (Slack, email, etc.)
    }
  },

  high: (error: Error, context?: object, userId?: string) =>
    logger.error(
      {
        error,
        userId,
        severity: 'high',
        ...context,
      },
      `❌ Error alto: ${error.message}`,
    ),

  medium: (error: Error, context?: object, userId?: string) =>
    logger.warn(
      {
        error,
        userId,
        severity: 'medium',
        ...context,
      },
      `⚠️ Error medio: ${error.message}`,
    ),

  low: (error: Error, context?: object, userId?: string) =>
    logger.info(
      {
        error,
        userId,
        severity: 'low',
        ...context,
      },
      `ℹ️ Error menor: ${error.message}`,
    ),
};

// HEALTH CHECKS Y MONITOREO
export const healthCheck = {
  passed: (service: string, duration: number, details?: object) =>
    logger.info(
      {
        service,
        duration,
        status: 'healthy',
        details,
        event: 'health.check.passed',
        domain: 'health',
      },
      `✅ Health check OK: ${service} (${duration}ms)`,
    ),

  failed: (service: string, error: Error, duration: number) =>
    logger.error(
      {
        service,
        error,
        duration,
        status: 'unhealthy',
        event: 'health.check.failed',
        domain: 'health',
      },
      `❌ Health check FAILED: ${service} (${duration}ms)`,
    ),

  degraded: (service: string, warning: string, duration: number) =>
    logger.warn(
      {
        service,
        warning,
        duration,
        status: 'degraded',
        event: 'health.check.degraded',
        domain: 'health',
      },
      `⚠️ Health check DEGRADED: ${service} - ${warning} (${duration}ms)`,
    ),
};

// UTILIDADES DE STARTUP
export const startup = {
  serviceStarted: (port: number, env: string) =>
    logger.info(
      {
        port,
        env,
        event: 'service.started',
        domain: 'startup',
      },
      `🚀 Task Service iniciado en puerto ${port} (${env})`,
    ),

  configLoaded: (configSummary: object) =>
    logger.info(
      {
        config: configSummary,
        event: 'config.loaded',
        domain: 'startup',
      },
      '⚙️ Configuración cargada',
    ),

  dependencyConnected: (dependency: string, version?: string) =>
    logger.info(
      {
        dependency,
        version,
        event: 'dependency.connected',
        domain: 'startup',
      },
      `🔌 Conectado a ${dependency}${version ? ` v${version}` : ''}`,
    ),

  gracefulShutdown: (signal: string) =>
    logger.info(
      {
        signal,
        event: 'service.shutdown',
        domain: 'startup',
      },
      `🛑 Apagado graceful recibido: ${signal}`,
    ),
};

// FUNCIÓN PARA RECONFIGURAR EL LOGGER DESPUÉS DE CARGAR ENVIRONMENT
let reconfiguredLogger: pino.Logger | null = null;

export const reconfigureLogger = (envConfig: AppConfig) => {
  if (reconfiguredLogger) return reconfiguredLogger;

  const logLevel = envConfig.logging.level;
  const logPretty = envConfig.logging.pretty;
  const isDev = envConfig.app.isDevelopment;
  const isProd = envConfig.app.isProduction;

  const reconfiguredConfig: pino.LoggerOptions = {
    level: logLevel,
    base: {
      service: 'task-service',
      version: process.env.npm_package_version || '1.0.0',
      env: envConfig.app.env,
      timezone: BOGOTA_TIMEZONE,
    },
  };

  // Se reutiliza la lógica de formateo para consistencia.
  if (isDev) {
    reconfiguredConfig.formatters = {
      level: (label) => ({ level: label }),
      log: (object) => {
        const logObject = object as LogObjectWithError;
        if (logObject.err) {
          const err = logObject.err;
          const errorDetails = {
            type: err.constructor.name,
            message: err.message,
            stack: isDev ? err.stack : undefined,
            code: err.code,
            statusCode: err.statusCode,
          };
          const { err: _err, ...rest } = logObject;
          return { ...rest, error: errorDetails };
        }
        return object;
      },
    };
  }

  if (isDev && logPretty) {
    reconfiguredConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,timezone',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        messageFormat: '[{service}] {msg}',
        singleLine: false,
      },
    };
  } else if (isProd) {
    // Configuración de producción con múltiples destinos - SIN formatters
    const destinations = [
      {
        level: logLevel,
        dest: path.join(LOG_DIR, 'task-service.log'),
      },
      {
        level: 'error',
        dest: path.join(LOG_DIR, 'task-service-error.log'),
      },
      {
        level: 'warn',
        dest: path.join(LOG_DIR, 'task-service-security.log'),
      },
      {
        level: logLevel,
        dest: 1, // stdout
      },
    ];

    reconfiguredConfig.transport = {
      targets: destinations.map((dest) => ({
        target: 'pino/file',
        level: dest.level,
        options: {
          destination: dest.dest,
          mkdir: true,
        },
      })),
    };
  }

  reconfiguredLogger = pino(reconfiguredConfig);

  // Log de reconfiguración
  reconfiguredLogger.info(
    {
      logLevel,
      timezone: BOGOTA_TIMEZONE,
      logDir: LOG_DIR,
      prettyPrint: isDev && logPretty,
      reconfigured: true,
    },
    '🔧 Task Service Logger reconfigurado con environment cargado',
  );

  return reconfiguredLogger;
};

// Función para obtener el logger actual (reconfigurado si está disponible)
export const getLogger = () => reconfiguredLogger || logger;

export default logger;
