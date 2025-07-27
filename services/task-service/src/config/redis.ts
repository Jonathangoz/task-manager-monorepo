// src/config/redis.ts - Configuración Redis para Task Service
import Redis, { RedisOptions } from 'ioredis';
import { logger } from '@/utils/logger';
import { config } from './environment';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  EVENT_TYPES,
} from '@/utils/constants';

// Configuración optimizada para producción
const getRedisConfig = (): RedisOptions => {
  const baseConfig: RedisOptions = {
    retryDelayOnFailover: 1000,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keyPrefix: config.redis.prefix,
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // Pool de conexiones para alta concurrencia
    family: 4,
    keepAlive: 30000,
    
    // Configuración de cluster si es necesario
    enableReadyCheck: true,
    maxLoadingTimeout: 10000,
    
    // Configuración de reintentos mejorada
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    
    // Configuración de reconexión
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
  };

  // Configuraciones adicionales para producción
  if (config.app.isProduction) {
    Object.assign(baseConfig, {
      commandTimeout: 3000,
      connectTimeout: 5000,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
  }

  return baseConfig;
};

/**
 * Clase singleton para manejar la conexión Redis del Task Service
 * Responsabilidad única: Gestionar la conexión y el ciclo de vida de Redis
 */
class TaskRedisConnection {
  private static instance: TaskRedisConnection;
  private client: Redis;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  private constructor() {
    this.client = new Redis(config.redis.url, getRedisConfig());
    this.setupEventHandlers();
  }

  public static getInstance(): TaskRedisConnection {
    if (!TaskRedisConnection.instance) {
      TaskRedisConnection.instance = new TaskRedisConnection();
    }
    return TaskRedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info({
        event: EVENT_TYPES.CACHE_HIT,
        component: 'redis',
      }, 'Task Service Redis conectado exitosamente');
    });

    this.client.on('ready', () => {
      logger.info({
        event: EVENT_TYPES.CACHE_HIT,
        component: 'redis',
      }, 'Task Service Redis listo para comandos');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error({
        error,
        event: EVENT_TYPES.CACHE_ERROR,
        component: 'redis',
        reconnectAttempts: this.reconnectAttempts,
      }, 'Error de conexión Task Service Redis');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn({
        event: EVENT_TYPES.CACHE_ERROR,
        component: 'redis',
      }, 'Conexión Task Service Redis cerrada');
    });

    this.client.on('reconnecting', (delay: number) => {
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        logger.error('Máximo número de intentos de reconexión Redis alcanzado');
        this.client.disconnect();
        return;
      }

      logger.info({
        event: EVENT_TYPES.CACHE_ERROR,
        component: 'redis',
        delay,
        attempt: this.reconnectAttempts,
      }, 'Task Service Redis reconectando...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      
      // Health check
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        logger.info('Task Service Redis health check exitoso');
      }
    } catch (error) {
      logger.error({ error }, 'Fallo al conectar con Task Service Redis');
      throw new Error(ERROR_MESSAGES.REDIS_ERROR);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Task Service Redis desconectado correctamente');
    } catch (error) {
      logger.error({ error }, 'Error al desconectar Task Service Redis');
      throw new Error(ERROR_MESSAGES.REDIS_ERROR);
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Health check avanzado con métricas
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    memory: any;
    connections: number;
  }> {
    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info('memory');
      const connections = await this.client.info('clients');

      return {
        status: pong === 'PONG' ? 'healthy' : 'unhealthy',
        latency,
        memory: this.parseInfoString(info),
        connections: parseInt(connections.split('\r\n')[1]?.split(':')[1] || '0'),
      };
    } catch (error) {
      logger.error({ error }, 'Redis health check falló');
      return {
        status: 'unhealthy',
        latency: -1,
        memory: {},
        connections: 0,
      };
    }
  }

  private parseInfoString(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Limpieza de claves expiradas
   */
  public async clearExpiredKeys(): Promise<number> {
    try {
      // En Redis, las claves con TTL se eliminan automáticamente
      // Este método puede implementar lógica adicional si es necesario
      const info = await this.client.info('keyspace');
      logger.info({ info }, 'Información keyspace Redis');
      return 0;
    } catch (error) {
      logger.error({ error }, 'Fallo al obtener información keyspace Redis');
      return -1;
    }
  }
}

// Exportaciones
export const taskRedisConnection = TaskRedisConnection.getInstance();
export const redis = taskRedisConnection.getClient();

// Función helper para inicialización
export const initializeRedis = async (): Promise<void> => {
  try {
    await taskRedisConnection.connect();
    logger.info('Redis inicializado exitosamente');
  } catch (error) {
    logger.error({ error }, 'Fallo al inicializar Redis');
    throw error;
  }
};

// Función helper para cleanup
export const cleanupRedis = async (): Promise<void> => {
  try {
    await taskRedisConnection.disconnect();
    logger.info('Limpieza de Redis completada');
  } catch (error) {
    logger.error({ error }, 'Fallo al limpiar Redis');
  }
};