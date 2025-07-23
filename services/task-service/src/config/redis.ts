// ==============================================
// src/config/redis.ts
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { config } from './environment';

class TaskRedisConnection {
  private static instance: TaskRedisConnection;
  private client: Redis;
  private isConnected = false;

  private constructor() {
    this.client = new Redis(config.redis.url, {
      retryDelayOnFailover: 1000,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: config.redis.prefix,
      // Configuración para producción
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

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
      logger.info('Task Service Redis connected successfully');
    });

    this.client.on('ready', () => {
      logger.info('Task Service Redis ready for commands');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error({ error }, 'Task Service Redis connection error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Task Service Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Task Service Redis reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      
      // Health check
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        logger.info('Task Service Redis health check passed');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Task Service Redis');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Task Service Redis disconnected gracefully');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Task Service Redis');
      throw error;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  // Métodos específicos para el Task Service
  public async cacheUserTasks(userId: string, tasks: any[], ttl?: number): Promise<void> {
    const key = this.getUserTasksKey(userId);
    const cacheData = {
      tasks,
      cachedAt: new Date().toISOString(),
    };
    await this.setJson(key, cacheData, ttl || config.cache.ttl.userTasks);
  }

  public async getCachedUserTasks(userId: string): Promise<any[] | null> {
    const key = this.getUserTasksKey(userId);
    const cached = await this.getJson<{ tasks: any[]; cachedAt: string }>(key);
    return cached?.tasks || null;
  }

  public async invalidateUserTasksCache(userId: string): Promise<void> {
    const key = this.getUserTasksKey(userId);
    await this.del(key);
  }

  public async cacheUserCategories(userId: string, categories: any[], ttl?: number): Promise<void> {
    const key = this.getUserCategoriesKey(userId);
    const cacheData = {
      categories,
      cachedAt: new Date().toISOString(),
    };
    await this.setJson(key, cacheData, ttl || config.cache.ttl.categories);
  }

  public async getCachedUserCategories(userId: string): Promise<any[] | null> {
    const key = this.getUserCategoriesKey(userId);
    const cached = await this.getJson<{ categories: any[]; cachedAt: string }>(key);
    return cached?.categories || null;
  }

  public async invalidateUserCategoriesCache(userId: string): Promise<void> {
    const key = this.getUserCategoriesKey(userId);
    await this.del(key);
  }

  // Métodos de utilidad heredados del auth-service
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error({ error, key }, 'Failed to set Redis key');
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to get Redis key');
      throw error;
    }
  }

  public async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete Redis key');
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to check Redis key existence');
      throw error;
    }
  }

  public async setJson(key: string, value: object, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  public async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Patterns para claves específicas del Task Service
  public getUserTasksKey(userId: string): string {
    return `user:${userId}:tasks`;
  }

  public getUserCategoriesKey(userId: string): string {
    return `user:${userId}:categories`;
  }

  public getTaskKey(taskId: string): string {
    return `task:${taskId}`;
  }

  public getCategoryKey(categoryId: string): string {
    return `category:${categoryId}`;
  }

  public getUserStatsKey(userId: string): string {
    return `user:${userId}:stats`;
  }

  public getRateLimitKey(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  // Métodos para cache de búsquedas
  public getSearchKey(userId: string, query: string, filters: string): string {
    return `search:${userId}:${Buffer.from(query + filters).toString('base64')}`;
  }
}

// Exportar instancia singleton
export const taskRedisConnection = TaskRedisConnection.getInstance();
export const redis = taskRedisConnection.getClient();