// src/config/redis.ts - auth-service
import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { environment } from './environment';

class RedisConnection {
  private static instance: RedisConnection;
  private client: Redis;
  private isConnected = false;

  private constructor() {
    this.client = new Redis(environment.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: environment.redis.prefix,
      // Configuración para producción
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error({ error }, 'Redis connection error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();

      // Health check
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        logger.info('Redis health check passed');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected gracefully');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Redis');
      throw error;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  // Métodos de utilidad para operaciones comunes
  public async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
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

  public async setJson(
    key: string,
    value: object,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  public async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Pattern para claves de sesión
  public getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  // Pattern para claves de tokens
  public getTokenKey(tokenId: string): string {
    return `token:${tokenId}`;
  }

  // Pattern para claves de usuarios
  public getUserKey(userId: string): string {
    return `user:${userId}`;
  }

  // Pattern para rate limiting
  public getRateLimitKey(identifier: string): string {
    return `ratelimit:${identifier}`;
  }
}

// Exportar instancia singleton
export const redisConnection = RedisConnection.getInstance();
export const redis = redisConnection.getClient();
