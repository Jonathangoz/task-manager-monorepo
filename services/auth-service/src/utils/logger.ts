// ==============================================
// src/utils/logger.ts - Auth Service Logger
// Sistema de logging con Pino, timezone Bogotá y rotación de archivos
// ==============================================

import pino from 'pino';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

// ==============================================
// CONFIGURACIÓN DE TIMEZONE BOGOTÁ
// ==============================================
const BOGOTA_TIMEZONE = 'America/Bogota';

// ==============================================
// CONFIGURACIÓN TEMPORAL HASTA QUE SE CARGUE ENVIRONMENT
// ==============================================
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

interface LogObject {
  [key: string]: unknown;
}

interface ErrorObject extends Error {
  code?: string;
  statusCode?: number;
}

const baseLoggerConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  base: {
    service: 'auth-service',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    timezone: BOGOTA_TIMEZONE,
  },
  formatters: {
    level: (label: string) => ({ level: label }),
    log: (object: LogObject) => {
      if (object.err) {
        const err = object.err as ErrorObject;
        return {
          ...object,
          error: {
            type: err.constructor.name,
            message: err.message,
            stack: isDevelopment ? err.stack : undefined,
            code: err.code,
            statusCode: err.statusCode,
          },
        };
      }
      return object;
    },
  },
};

// ==============================================
// CONFIGURACIÓN PARA DESARROLLO
// ==============================================
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

// ==============================================
// CONFIGURACIÓN PARA PRODUCCIÓN
// ==============================================
const createProductionLogger = (): pino.Logger => {
  const productionConfig: pino.LoggerOptions = {
    level: getLogLevel(),
    base: {
      service: 'auth-service',
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
      dest: path.join(LOG_DIR, 'auth-service.log'),
    },
    // Archivo de errores (solo errores y fatales)
    {
      level: 'error',
      dest: path.join(LOG_DIR, 'auth-service-error.log'),
    },
    // Archivo de seguridad (eventos de autenticación y autorización)
    {
      level: 'info',
      dest: path.join(LOG_DIR, 'auth-service-security.log'),
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

// ==============================================
// CREAR INSTANCIA DEL LOGGER
// ==============================================
export const logger = isDevelopment
  ? createDevelopmentLogger()
  : createProductionLogger();

// ==============================================
// LOGGERS ESPECIALIZADOS POR COMPONENTE
// ==============================================
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

export const authLogger = logger.child({
  component: 'auth',
  domain: 'security',
});

export const securityLogger = logger.child({
  component: 'security',
  domain: 'security',
});

// ==============================================
// LOGGER CON CONTEXTO DE REQUEST
// ==============================================
export const createRequestLogger = (requestId?: string, userId?: string) => {
  const context: Record<string, unknown> = { context: 'request' };

  if (requestId) context.requestId = requestId;
  if (userId) context.userId = userId;

  return logger.child(context);
};

// Función helper para crear child loggers con contexto
export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// ==============================================
// LOGGERS ESTRUCTURADOS POR DOMINIO DE AUTH
// ==============================================
export const loggers = {
  // ==============================================
  // EVENTOS DE AUTENTICACIÓN
  // ==============================================
  userRegistered: (userId: string, email: string, ip?: string) =>
    authLogger.info(
      {
        userId,
        email: email.toLowerCase(),
        ip,
        event: 'user.registered',
        domain: 'auth',
      },
      `👤 Usuario registrado: ${email}`,
    ),

  userLogin: (userId: string, email: string, ip?: string, userAgent?: string) =>
    authLogger.info(
      {
        userId,
        email: email.toLowerCase(),
        ip,
        userAgent,
        event: 'user.login',
        domain: 'auth',
      },
      `🔑 Login exitoso: ${email}`,
    ),

  userLoginFailed: (
    email: string,
    reason: string,
    ip?: string,
    userAgent?: string,
  ) =>
    securityLogger.warn(
      {
        email: email.toLowerCase(),
        reason,
        ip,
        userAgent,
        event: 'user.login.failed',
        domain: 'security',
      },
      `❌ Login fallido: ${email} - ${reason}`,
    ),

  userLogout: (userId: string, email?: string, ip?: string) =>
    authLogger.info(
      {
        userId,
        email: email?.toLowerCase(),
        ip,
        event: 'user.logout',
        domain: 'auth',
      },
      `👋 Logout: ${email || userId}`,
    ),

  passwordChanged: (userId: string, email: string, ip?: string) =>
    securityLogger.info(
      {
        userId,
        email: email.toLowerCase(),
        ip,
        event: 'password.changed',
        domain: 'security',
      },
      `🔐 Contraseña cambiada: ${email}`,
    ),

  accountLocked: (
    userId: string,
    email: string,
    attempts: number,
    ip?: string,
  ) =>
    securityLogger.warn(
      {
        userId,
        email: email.toLowerCase(),
        attempts,
        ip,
        event: 'account.locked',
        domain: 'security',
      },
      `🔒 Cuenta bloqueada: ${email} (${attempts} intentos)`,
    ),

  accountUnlocked: (userId: string, email: string, method: string) =>
    securityLogger.info(
      {
        userId,
        email: email.toLowerCase(),
        method,
        event: 'account.unlocked',
        domain: 'security',
      },
      `🔓 Cuenta desbloqueada: ${email} (${method})`,
    ),

  // ==============================================
  // GESTIÓN DE TOKENS
  // ==============================================
  tokenGenerated: (
    userId: string,
    tokenType: 'access' | 'refresh' | 'reset',
    expiresIn?: string,
  ) =>
    authLogger.info(
      {
        userId,
        tokenType,
        expiresIn,
        event: 'token.generated',
        domain: 'auth',
      },
      `🎫 Token ${tokenType} generado para usuario ${userId}`,
    ),

  tokenValidated: (
    userId: string,
    tokenType: 'access' | 'refresh',
    ip?: string,
  ) =>
    authLogger.debug(
      {
        userId,
        tokenType,
        ip,
        event: 'token.validated',
        domain: 'auth',
      },
      `✅ Token ${tokenType} validado para usuario ${userId}`,
    ),

  tokenValidationFailed: (
    reason: string,
    tokenType: 'access' | 'refresh',
    ip?: string,
    tokenPreview?: string,
  ) =>
    securityLogger.warn(
      {
        reason,
        tokenType,
        ip,
        tokenPreview,
        event: 'token.validation.failed',
        domain: 'security',
      },
      `❌ Validación de token ${tokenType} falló: ${reason}`,
    ),

  tokenRevoked: (
    userId: string,
    tokenType: 'access' | 'refresh' | 'all',
    reason?: string,
  ) =>
    securityLogger.info(
      {
        userId,
        tokenType,
        reason,
        event: 'token.revoked',
        domain: 'security',
      },
      `🚫 Token ${tokenType} revocado para usuario ${userId}`,
    ),

  refreshTokenRotated: (
    userId: string,
    oldTokenId?: string,
    newTokenId?: string,
  ) =>
    authLogger.info(
      {
        userId,
        oldTokenId,
        newTokenId,
        event: 'refresh_token.rotated',
        domain: 'auth',
      },
      `🔄 Refresh token rotado para usuario ${userId}`,
    ),

  // ==============================================
  // EVENTOS DE SEGURIDAD
  // ==============================================
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
  ) =>
    securityLogger.warn(
      {
        ip,
        endpoint,
        limit,
        windowMs,
        event: 'security.rate_limit',
        domain: 'security',
      },
      `🚫 Rate limit excedido: ${ip} en ${endpoint} (${limit}/${windowMs}ms)`,
    ),

  bruteForceAttempt: (
    ip: string,
    email: string,
    attempts: number,
    windowMs: number,
  ) =>
    securityLogger.error(
      {
        ip,
        email: email.toLowerCase(),
        attempts,
        windowMs,
        event: 'security.brute_force',
        domain: 'security',
      },
      `🔥 Intento de fuerza bruta: ${email} desde ${ip} (${attempts} intentos)`,
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

  // ==============================================
  // EVENTOS DE BASE DE DATOS
  // ==============================================
  dbQuery: (
    operation: string,
    table: string,
    duration: number,
    userId?: string,
  ) =>
    dbLogger.debug(
      {
        operation,
        table,
        duration,
        userId,
        event: 'db.query',
        domain: 'database',
      },
      `🗄️ Query ${operation} en ${table} (${duration}ms)`,
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

  // ==============================================
  // EVENTOS DE CACHE (REDIS)
  // ==============================================
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

  sessionStored: (userId: string, sessionId: string, ttl: number) =>
    redisLogger.info(
      {
        userId,
        sessionId,
        ttl,
        event: 'session.stored',
        domain: 'auth',
      },
      `💾 Sesión almacenada: ${sessionId} (TTL: ${ttl}s)`,
    ),

  sessionDestroyed: (userId: string, sessionId: string, reason?: string) =>
    redisLogger.info(
      {
        userId,
        sessionId,
        reason,
        event: 'session.destroyed',
        domain: 'auth',
      },
      `🗑️ Sesión destruida: ${sessionId}`,
    ),

  // ==============================================
  // MONITOREO DE RENDIMIENTO
  // ==============================================
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
};

// ==============================================
// MANEJO DE ERRORES POR SEVERIDAD
// ==============================================
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
      `❌ Error crítico: ${error.message}`,
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

// ==============================================
// HEALTH CHECKS Y MONITOREO
// ==============================================
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

// ==============================================
// UTILIDADES DE STARTUP
// ==============================================
export const startup = {
  serviceStarted: (port: number, env: string) =>
    logger.info(
      {
        port,
        env,
        event: 'service.started',
        domain: 'startup',
      },
      `🚀 Auth Service iniciado en puerto ${port} (${env})`,
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

// ==============================================
// FUNCIÓN PARA RECONFIGURER EL LOGGER DESPUÉS DE CARGAR ENVIRONMENT
// ==============================================
let reconfiguredLogger: pino.Logger | null = null;

interface ReconfigureLoggerConfig {
  logging?: {
    level?: string;
    pretty?: boolean;
  };
  LOG_LEVEL?: string;
  LOG_PRETTY?: boolean;
  app?: {
    isDevelopment?: boolean;
    isProduction?: boolean;
    env?: string;
  };
  NODE_ENV?: string;
}

export const reconfigureLogger = (envConfig: ReconfigureLoggerConfig) => {
  if (reconfiguredLogger) return reconfiguredLogger;

  const logLevel = envConfig.logging?.level || envConfig.LOG_LEVEL || 'info';
  const logPretty = envConfig.logging?.pretty ?? envConfig.LOG_PRETTY ?? true;
  const isDev =
    envConfig.app?.isDevelopment ?? envConfig.NODE_ENV === 'development';
  const isProd =
    envConfig.app?.isProduction ?? envConfig.NODE_ENV === 'production';

  const reconfiguredConfig: pino.LoggerOptions = {
    level: logLevel,
    base: {
      service: 'auth-service',
      version: process.env.npm_package_version || '1.0.0',
      env: envConfig.app?.env || envConfig.NODE_ENV || 'development',
      timezone: BOGOTA_TIMEZONE,
    },
  };

  // Solo agregar formatters si NO estás en producción con transport.targets
  if (isDev) {
    reconfiguredConfig.formatters = {
      level: (label) => ({ level: label }),
      log: (object) => {
        if (object.err) {
          const err = object.err as ErrorObject;
          return {
            ...object,
            error: {
              type: err.constructor.name,
              message: err.message,
              stack: isDev ? err.stack : undefined,
              code: err.code,
              statusCode: err.statusCode,
            },
          };
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
        dest: path.join(LOG_DIR, 'auth-service.log'),
      },
      {
        level: 'error',
        dest: path.join(LOG_DIR, 'auth-service-error.log'),
      },
      {
        level: 'warn',
        dest: path.join(LOG_DIR, 'auth-service-security.log'),
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
    '🔧 auth Service Logger reconfigurado con environment cargado',
  );

  return reconfiguredLogger;
};

// Función para obtener el logger actual (reconfigurado si está disponible)
export const getLogger = () => reconfiguredLogger || logger;

export default logger;
