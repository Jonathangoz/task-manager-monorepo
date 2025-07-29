// src/infrastructure/cache/RedisCache.ts
// Implementación Redis del servicio de cache con validación Zod
import Redis from 'ioredis';
import { z } from 'zod';
import { ICacheService, CacheOptions, RateLimitResult } from '@/core/interfaces/ICacheService';
import { environment } from '@/config/environment';
import { redisLogger, logError } from '@/utils/logger';
import { 
  CACHE_KEYS, 
  CACHE_TTL, 
  ERROR_CODES, 
  SECURITY_CONFIG,
  TIMEOUT_CONFIG 
} from '@/utils/constants';

// SCHEMAS DE VALIDACIÓN ZOD
const CacheKeySchema = z.string().min(1).max(250);
const SessionIdSchema = z.string().regex(/^[a-zA-Z0-9-_]{8,}$/);
const TokenIdSchema = z.string().regex(/^[a-zA-Z0-9-_]{8,}$/);
const EmailSchema = z.string().email();
const TTLSchema = z.number().int().positive().max(7 * 24 * 60 * 60); // Máximo 7 días

const CacheOptionsSchema = z.object({
  ttl: TTLSchema.optional(),
  nx: z.boolean().optional(),
}).optional();

// CLASE REDISCACHE
export class RedisCache implements ICacheService {
  private client: Redis;
  private readonly prefix: string;
  private isConnected = false;

  constructor() {
    this.prefix = environment.redis.prefix;
    this.client = this.createRedisClient();
    this.setupEventHandlers();
  }


  // CONFIGURACIÓN DEL CLIENTE REDIS

  private createRedisClient(): Redis {
    return new Redis(environment.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 30000,
      keyPrefix: this.prefix,
      connectTimeout: TIMEOUT_CONFIG.REDIS_OPERATION,
      commandTimeout: TIMEOUT_CONFIG.REDIS_OPERATION,
      // Pool de conexiones
      family: 4,
      // Configuración de memoria
      enableOfflineQueue: false,
    });
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      redisLogger.info('Redis client connected successfully');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      redisLogger.info('Redis client ready for operations');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logError.high(error, { component: 'redis', event: 'connection_error' });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      redisLogger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', (delayMs: number) => {
      redisLogger.info({ delayMs }, 'Redis client attempting to reconnect');
    });

    this.client.on('end', () => {
      this.isConnected = false;
      redisLogger.warn('Redis client connection ended');
    });
  }


  // OPERACIONES BÁSICAS

  async get<T>(key: string): Promise<T | null> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const value = await this.client.get(validatedKey);
      if (!value) {
        redisLogger.debug({ key: validatedKey }, 'Cache miss');
        return null;
      }

      const parsed = JSON.parse(value) as T;
      redisLogger.debug({ key: validatedKey }, 'Cache hit');
      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, error: error.errors }, 'Invalid cache key format');
        return null;
      }
      
      logError.medium(error as Error, { 
        operation: 'get', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get cache value`);
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      const validatedOptions = CacheOptionsSchema.parse(options);
      
      const serializedValue = JSON.stringify(value);
      
      if (validatedOptions?.ttl) {
        TTLSchema.parse(validatedOptions.ttl);
        
        if (validatedOptions.nx) {
          const result = await this.client.set(validatedKey, serializedValue, 'EX', validatedOptions.ttl, 'NX');
          if (!result) {
            redisLogger.debug({ key: validatedKey }, 'Key already exists, not set due to NX option');
            return;
          }
        } else {
          await this.client.setex(validatedKey, validatedOptions.ttl, serializedValue);
        }
      } else {
        if (validatedOptions?.nx) {
          const result = await this.client.set(validatedKey, serializedValue, 'NX');
          if (!result) {
            redisLogger.debug({ key: validatedKey }, 'Key already exists, not set due to NX option');
            return;
          }
        } else {
          await this.client.set(validatedKey, serializedValue);
        }
      }

      redisLogger.debug({ 
        key: validatedKey, 
        ttl: validatedOptions?.ttl,
        nx: validatedOptions?.nx 
      }, 'Value set in cache');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, error: error.errors }, 'Invalid cache parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid cache parameters`);
      }
      
      logError.medium(error as Error, { 
        operation: 'set', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to set cache value`);
    }
  }

  async del(key: string): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.del(validatedKey);
      redisLogger.debug({ key: validatedKey, deleted: result > 0 }, 'Key deletion result');
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, error: error.errors }, 'Invalid cache key format');
        return 0;
      }
      
      logError.medium(error as Error, { 
        operation: 'del', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete cache key`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.exists(validatedKey);
      return result === 1;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, error: error.errors }, 'Invalid cache key format');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'exists', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to check key existence`);
    }
  }


  // OPERACIONES CON TTL

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      const validatedTTL = TTLSchema.parse(seconds);
      
      const result = await this.client.expire(validatedKey, validatedTTL);
      return result === 1;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, seconds, error: error.errors }, 'Invalid expire parameters');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'expire', 
        key, 
        seconds,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to set key expiration`);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      return await this.client.ttl(validatedKey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, error: error.errors }, 'Invalid cache key format');
        return -2; // Key doesn't exist
      }
      
      logError.medium(error as Error, { 
        operation: 'ttl', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get key TTL`);
    }
  }


  // OPERACIONES DE CONJUNTOS

  async sadd(key: string, members: string[]): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      if (members.length === 0) return 0;
      
      const result = await this.client.sadd(validatedKey, ...members);
      redisLogger.debug({ key: validatedKey, membersCount: members.length, added: result }, 'Members added to set');
      return result;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'sadd', 
        key, 
        membersCount: members.length,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to add members to set`);
    }
  }

  async srem(key: string, members: string[]): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      if (members.length === 0) return 0;
      
      const result = await this.client.srem(validatedKey, ...members);
      redisLogger.debug({ key: validatedKey, membersCount: members.length, removed: result }, 'Members removed from set');
      return result;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'srem', 
        key, 
        membersCount: members.length,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to remove members from set`);
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const members = await this.client.smembers(validatedKey);
      redisLogger.debug({ key: validatedKey, membersCount: members.length }, 'Set members retrieved');
      return members;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'smembers', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get set members`);
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.sismember(validatedKey, member);
      return result === 1;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'sismember', 
        key, 
        member,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to check set membership`);
    }
  }


  // OPERACIONES DE HASH

  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.hset(validatedKey, field, value);
      redisLogger.debug({ key: validatedKey, field }, 'Hash field set');
      return result;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'hset', 
        key, 
        field,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to set hash field`);
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const value = await this.client.hget(validatedKey, field);
      redisLogger.debug({ key: validatedKey, field, found: !!value }, 'Hash field retrieved');
      return value;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'hget', 
        key, 
        field,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get hash field`);
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.hdel(validatedKey, field);
      redisLogger.debug({ key: validatedKey, field, deleted: result > 0 }, 'Hash field deletion result');
      return result;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'hdel', 
        key, 
        field,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete hash field`);
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      
      const result = await this.client.hgetall(validatedKey);
      redisLogger.debug({ key: validatedKey, fieldsCount: Object.keys(result).length }, 'Hash retrieved');
      return result;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'hgetall', 
        key,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get hash`);
    }
  }


  // UTILIDADES ESPECÍFICAS DEL DOMINIO

  async storeSession(sessionId: string, sessionData: any, ttl: number): Promise<void> {
    try {
      const validatedSessionId = SessionIdSchema.parse(sessionId);
      const validatedTTL = TTLSchema.parse(ttl);
      
      const key = CACHE_KEYS.USER_SESSION(validatedSessionId);
      await this.set(key, sessionData, { ttl: validatedTTL });
      
      redisLogger.info({ sessionId: validatedSessionId, ttl: validatedTTL }, 'Session stored successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ sessionId, error: error.errors }, 'Invalid session parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid session parameters`);
      }
      
      logError.high(error as Error, { 
        operation: 'storeSession', 
        sessionId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to store session`);
    }
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    try {
      const validatedSessionId = SessionIdSchema.parse(sessionId);
      
      const key = CACHE_KEYS.USER_SESSION(validatedSessionId);
      const session = await this.get<T>(key);
      
      redisLogger.debug({ sessionId: validatedSessionId, found: !!session }, 'Session retrieval result');
      return session;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ sessionId, error: error.errors }, 'Invalid session ID format');
        return null;
      }
      
      logError.medium(error as Error, { 
        operation: 'getSession', 
        sessionId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get session`);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const validatedSessionId = SessionIdSchema.parse(sessionId);
      
      const key = CACHE_KEYS.USER_SESSION(validatedSessionId);
      const result = await this.del(key);
      const deleted = result > 0;
      
      redisLogger.info({ sessionId: validatedSessionId, deleted }, 'Session deletion result');
      return deleted;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ sessionId, error: error.errors }, 'Invalid session ID format');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'deleteSession', 
        sessionId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete session`);
    }
  }

  async storeRefreshToken(tokenId: string, tokenData: any, ttl: number): Promise<void> {
    try {
      const validatedTokenId = TokenIdSchema.parse(tokenId);
      const validatedTTL = TTLSchema.parse(ttl);
      
      const key = CACHE_KEYS.REFRESH_TOKEN(validatedTokenId);
      await this.set(key, tokenData, { ttl: validatedTTL });
      
      redisLogger.info({ tokenId: validatedTokenId, ttl: validatedTTL }, 'Refresh token stored successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ tokenId, error: error.errors }, 'Invalid token parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid token parameters`);
      }
      
      logError.high(error as Error, { 
        operation: 'storeRefreshToken', 
        tokenId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to store refresh token`);
    }
  }

  async getRefreshToken<T>(tokenId: string): Promise<T | null> {
    try {
      const validatedTokenId = TokenIdSchema.parse(tokenId);
      
      const key = CACHE_KEYS.REFRESH_TOKEN(validatedTokenId);
      const token = await this.get<T>(key);
      
      redisLogger.debug({ tokenId: validatedTokenId, found: !!token }, 'Refresh token retrieval result');
      return token;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ tokenId, error: error.errors }, 'Invalid token ID format');
        return null;
      }
      
      logError.medium(error as Error, { 
        operation: 'getRefreshToken', 
        tokenId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get refresh token`);
    }
  }

  async deleteRefreshToken(tokenId: string): Promise<boolean> {
    try {
      const validatedTokenId = TokenIdSchema.parse(tokenId);
      
      const key = CACHE_KEYS.REFRESH_TOKEN(validatedTokenId);
      const result = await this.del(key);
      const deleted = result > 0;
      
      redisLogger.info({ tokenId: validatedTokenId, deleted }, 'Refresh token deletion result');
      return deleted;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ tokenId, error: error.errors }, 'Invalid token ID format');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'deleteRefreshToken', 
        tokenId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete refresh token`);
    }
  }


  // RATE LIMITING

  async incrementRateLimit(key: string, windowSeconds: number): Promise<RateLimitResult> {
    try {
      const validatedKey = CacheKeySchema.parse(key);
      const validatedWindow = z.number().int().positive().max(24 * 60 * 60).parse(windowSeconds);
      
      const rateLimitKey = CACHE_KEYS.RATE_LIMIT(validatedKey);
      
      // Usar pipeline para operaciones atómicas
      const pipeline = this.client.pipeline();
      pipeline.incr(rateLimitKey);
      pipeline.ttl(rateLimitKey);
      
      const results = await pipeline.exec();
      
      if (!results || results.length !== 2) {
        throw new Error('Pipeline execution failed');
      }
      
      const [incrResult, ttlResult] = results;
      
      if (incrResult[0] || ttlResult[0]) {
        throw new Error(`Pipeline error: ${incrResult[0] || ttlResult[0]}`);
      }
      
      const count = incrResult[1] as number;
      const currentTTL = ttlResult[1] as number;
      
      // Si es el primer incremento, establecer el TTL
      if (count === 1 && currentTTL === -1) {
        await this.client.expire(rateLimitKey, validatedWindow);
      }
      
      const resetTime = Date.now() + (currentTTL > 0 ? currentTTL * 1000 : validatedWindow * 1000);
      
      redisLogger.debug({ 
        key: validatedKey, 
        count, 
        windowSeconds: validatedWindow,
        resetTime 
      }, 'Rate limit incremented');
      
      return { count, resetTime };
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ key, windowSeconds, error: error.errors }, 'Invalid rate limit parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid rate limit parameters`);
      }
      
      logError.medium(error as Error, { 
        operation: 'incrementRateLimit', 
        key, 
        windowSeconds,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to increment rate limit`);
    }
  }


  // LOGIN ATTEMPTS TRACKING

  async recordLoginAttempt(email: string): Promise<number> {
    try {
      const validatedEmail = EmailSchema.parse(email.toLowerCase());
      
      const key = CACHE_KEYS.LOGIN_ATTEMPTS(validatedEmail);
      const windowSeconds = CACHE_TTL.LOGIN_ATTEMPTS;
      
      const result = await this.incrementRateLimit(validatedEmail, windowSeconds);
      
      redisLogger.info({ 
        email: validatedEmail, 
        attempts: result.count,
        resetTime: result.resetTime 
      }, 'Login attempt recorded');
      
      return result.count;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ email, error: error.errors }, 'Invalid email format for login attempt');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid email format`);
      }
      
      logError.high(error as Error, { 
        operation: 'recordLoginAttempt', 
        email,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to record login attempt`);
    }
  }

  async getLoginAttempts(email: string): Promise<number> {
    try {
      const validatedEmail = EmailSchema.parse(email.toLowerCase());
      
      const key = CACHE_KEYS.LOGIN_ATTEMPTS(validatedEmail);
      const value = await this.client.get(key);
      const attempts = value ? parseInt(value, 10) : 0;
      
      redisLogger.debug({ email: validatedEmail, attempts }, 'Login attempts retrieved');
      return attempts;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ email, error: error.errors }, 'Invalid email format');
        return 0;
      }
      
      logError.medium(error as Error, { 
        operation: 'getLoginAttempts', 
        email,
        component: 'redis' 
      });
      return 0; // Return 0 instead of throwing to allow login process to continue
    }
  }

  async clearLoginAttempts(email: string): Promise<boolean> {
    try {
      const validatedEmail = EmailSchema.parse(email.toLowerCase());
      
      const key = CACHE_KEYS.LOGIN_ATTEMPTS(validatedEmail);
      const result = await this.del(key);
      const cleared = result > 0;
      
      redisLogger.info({ email: validatedEmail, cleared }, 'Login attempts clear result');
      return cleared;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ email, error: error.errors }, 'Invalid email format');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'clearLoginAttempts', 
        email,
        component: 'redis' 
      });
      return false;
    }
  }


  // HEALTH CHECK

  async ping(): Promise<string> {
    try {
      const response = await this.client.ping();
      redisLogger.debug({ response }, 'Redis ping successful');
      return response;
    } catch (error) {
      logError.critical(error as Error, { 
        operation: 'ping',
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Redis health check failed`);
    }
  }


  // UTILIDADES Y MANTENIMIENTO

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isConnected) return false;
      
      const response = await this.ping();
      return response === 'PONG';
    } catch (error) {
      redisLogger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  async getStats(): Promise<{
    keyCount: number;
    memoryUsage: string;
    isConnected: boolean;
    uptime: number;
  }> {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      const server = await this.client.info('server');
      
      const memoryMatch = info.match(/used_memory_human:(.+)\r?\n/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      const keyCountMatch = keyspace.match(/keys=(\d+)/);
      const keyCount = keyCountMatch ? parseInt(keyCountMatch[1], 10) : 0;
      
      const uptimeMatch = server.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;
      
      return {
        keyCount,
        memoryUsage,
        isConnected: this.isConnected,
        uptime,
      };
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'getStats',
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to get cache stats`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      redisLogger.info('Redis client disconnected gracefully');
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'disconnect',
        component: 'redis' 
      });
      this.client.disconnect();
    }
  }


  // MÉTODOS AUXILIARES PRIVADOS

  private validateConnection(): void {
    if (!this.isConnected) {
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Redis client is not connected`);
    }
  }

  // Método para limpiar keys por patrón (usar con cuidado)
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const validatedPattern = z.string().min(1).max(100).parse(pattern);
      
      const keys = await this.client.keys(validatedPattern);
      if (keys.length === 0) return 0;
      
      const deletedCount = await this.client.del(...keys);
      redisLogger.warn({ pattern: validatedPattern, deletedCount }, 'Keys deleted by pattern');
      return deletedCount;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'deleteByPattern', 
        pattern,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete keys by pattern`);
    }
  }


  // MÉTODOS ADICIONALES PARA COMPATIBILIDAD CON LA IMPLEMENTACIÓN ANTERIOR

  
  // Métodos legacy para mantener compatibilidad (marcados como deprecated)
  
  /**
   * @deprecated Use storeSession instead
   */
  async setUserSession(sessionId: string, sessionData: any, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || CACHE_TTL.USER_SESSION;
    await this.storeSession(sessionId, sessionData, ttl);
  }

  /**
   * @deprecated Use getSession instead
   */
  async getUserSession<T>(sessionId: string): Promise<T | null> {
    return await this.getSession<T>(sessionId);
  }

  /**
   * @deprecated Use deleteSession instead
   */
  async deleteUserSession(sessionId: string): Promise<boolean> {
    return await this.deleteSession(sessionId);
  }

  /**
   * @deprecated Use storeRefreshToken instead
   */
  async setRefreshToken(tokenId: string, tokenData: any, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || CACHE_TTL.REFRESH_TOKEN;
    await this.storeRefreshToken(tokenId, tokenData, ttl);
  }

  /**
   * @deprecated Use recordLoginAttempt instead
   */
  async incrementLoginAttempts(email: string): Promise<number> {
    return await this.recordLoginAttempt(email);
  }

  /**
   * @deprecated Use clearLoginAttempts instead
   */
  async resetLoginAttempts(email: string): Promise<boolean> {
    return await this.clearLoginAttempts(email);
  }


  // MÉTODOS ESPECÍFICOS DE GESTIÓN DE USUARIOS


  async setUserSessions(userId: string, sessionIds: string[], ttlSeconds?: number): Promise<void> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      const validatedSessionIds = z.array(SessionIdSchema).parse(sessionIds);
      const ttl = ttlSeconds ? TTLSchema.parse(ttlSeconds) : CACHE_TTL.USER_SESSION;
      
      const key = CACHE_KEYS.USER_SESSIONS(validatedUserId);
      await this.set(key, validatedSessionIds, { ttl });
      
      redisLogger.info({ 
        userId: validatedUserId, 
        sessionCount: validatedSessionIds.length, 
        ttl 
      }, 'User sessions list updated');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user sessions parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid user sessions parameters`);
      }
      
      logError.medium(error as Error, { 
        operation: 'setUserSessions', 
        userId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to set user sessions`);
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      
      const key = CACHE_KEYS.USER_SESSIONS(validatedUserId);
      const sessions = await this.get<string[]>(key);
      
      return sessions || [];
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user ID format');
        return [];
      }
      
      logError.medium(error as Error, { 
        operation: 'getUserSessions', 
        userId,
        component: 'redis' 
      });
      return [];
    }
  }

  async setUserProfile(userId: string, profile: any, ttlSeconds?: number): Promise<void> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      const ttl = ttlSeconds ? TTLSchema.parse(ttlSeconds) : CACHE_TTL.USER_PROFILE;
      
      const key = CACHE_KEYS.USER_PROFILE(validatedUserId);
      await this.set(key, profile, { ttl });
      
      redisLogger.debug({ userId: validatedUserId, ttl }, 'User profile cached');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user profile parameters');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid user profile parameters`);
      }
      
      logError.medium(error as Error, { 
        operation: 'setUserProfile', 
        userId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to cache user profile`);
    }
  }

  async getUserProfile<T>(userId: string): Promise<T | null> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      
      const key = CACHE_KEYS.USER_PROFILE(validatedUserId);
      return await this.get<T>(key);
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user ID format');
        return null;
      }
      
      logError.medium(error as Error, { 
        operation: 'getUserProfile', 
        userId,
        component: 'redis' 
      });
      return null;
    }
  }

  async deleteUserProfile(userId: string): Promise<boolean> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      
      const key = CACHE_KEYS.USER_PROFILE(validatedUserId);
      const result = await this.del(key);
      return result > 0;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user ID format');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'deleteUserProfile', 
        userId,
        component: 'redis' 
      });
      return false;
    }
  }


  // GESTIÓN DE DATOS DE USUARIO COMPLETA


  async deleteUserData(userId: string): Promise<void> {
    try {
      const validatedUserId = z.string().min(1).parse(userId);
      
      // Patrones para eliminar todos los datos del usuario
      const patterns = [
        `*user:${validatedUserId}:*`,
        `*session:*:${validatedUserId}`,
        `*profile:${validatedUserId}*`,
        `*refresh:*:${validatedUserId}*`,
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await this.deleteByPattern(pattern);
        totalDeleted += deleted;
      }

      redisLogger.info({ 
        userId: validatedUserId, 
        totalDeleted,
        patterns: patterns.length 
      }, 'All user data deleted from cache');
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ userId, error: error.errors }, 'Invalid user ID format');
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Invalid user ID format`);
      }
      
      logError.high(error as Error, { 
        operation: 'deleteUserData', 
        userId,
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to delete user data`);
    }
  }


  // OPERACIONES DE MANTENIMIENTO Y LIMPIEZA


  async cleanupExpiredSessions(): Promise<number> {
    try {
      const pattern = `${this.prefix}*session:*`;
      const keys = await this.client.keys(pattern);
      let cleanedCount = 0;

      // Procesar en lotes para evitar bloquear Redis
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        for (const key of batch) {
          const ttl = await this.client.ttl(key);
          if (ttl === -2) { // Key doesn't exist (expired)
            cleanedCount++;
          }
        }
      }

      redisLogger.info({ 
        totalKeys: keys.length,
        cleanedCount,
        batchSize 
      }, 'Expired sessions cleanup completed');
      
      return cleanedCount;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'cleanupExpiredSessions',
        component: 'redis' 
      });
      return 0;
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const pattern = `${this.prefix}*refresh:*`;
      const keys = await this.client.keys(pattern);
      let cleanedCount = 0;

      // Procesar en lotes
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        for (const key of batch) {
          const ttl = await this.client.ttl(key);
          if (ttl === -2) { // Key doesn't exist (expired)
            cleanedCount++;
          }
        }
      }

      redisLogger.info({ 
        totalKeys: keys.length,
        cleanedCount,
        batchSize 
      }, 'Expired tokens cleanup completed');
      
      return cleanedCount;
    } catch (error) {
      logError.medium(error as Error, { 
        operation: 'cleanupExpiredTokens',
        component: 'redis' 
      });
      return 0;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      redisLogger.warn('All cache data flushed - this should only be done in development/testing');
    } catch (error) {
      logError.critical(error as Error, { 
        operation: 'flushAll',
        component: 'redis' 
      });
      throw new Error(`${ERROR_CODES.REDIS_ERROR}: Failed to flush cache`);
    }
  }


  // MÉTODOS DE RATE LIMITING ESPECÍFICOS


  async getRateLimit(identifier: string): Promise<number> {
    try {
      const validatedIdentifier = z.string().min(1).parse(identifier);
      
      const key = CACHE_KEYS.RATE_LIMIT(validatedIdentifier);
      const count = await this.client.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ identifier, error: error.errors }, 'Invalid rate limit identifier');
        return 0;
      }
      
      logError.medium(error as Error, { 
        operation: 'getRateLimit', 
        identifier,
        component: 'redis' 
      });
      return 0;
    }
  }

  async resetRateLimit(identifier: string): Promise<boolean> {
    try {
      const validatedIdentifier = z.string().min(1).parse(identifier);
      
      const key = CACHE_KEYS.RATE_LIMIT(validatedIdentifier);
      const result = await this.del(key);
      return result > 0;
    } catch (error) {
      if (error instanceof z.ZodError) {
        redisLogger.warn({ identifier, error: error.errors }, 'Invalid rate limit identifier');
        return false;
      }
      
      logError.medium(error as Error, { 
        operation: 'resetRateLimit', 
        identifier,
        component: 'redis' 
      });
      return false;
    }
  }


  // MÉTODOS DE UTILIDAD PARA JSON


  /**
   * @deprecated Use set with generic type instead
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, value, { ttl: ttlSeconds });
  }

  /**
   * @deprecated Use get with generic type instead
   */
  async getJson<T>(key: string): Promise<T | null> {
    return await this.get<T>(key);
  }


  // HEALTH CHECK MEJORADO


  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    latency: number;
    isConnected: boolean;
    keyCount?: number;
    memoryUsage?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Test básico de conectividad
      const pingResponse = await this.ping();
      const latency = Date.now() - startTime;
      
      if (pingResponse !== 'PONG') {
        return {
          status: 'unhealthy',
          latency,
          isConnected: false,
          error: 'Invalid ping response'
        };
      }

      // Test de operaciones básicas
      const testKey = `health:check:${Date.now()}`;
      await this.set(testKey, { test: true }, { ttl: 10 });
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      if (!retrieved) {
        return {
          status: 'degraded',
          latency,
          isConnected: true,
          error: 'Cache operations not working properly'
        };
      }

      // Obtener estadísticas adicionales
      const stats = await this.getStats();

      // Determinar estado basado en la latencia
      const status = latency > 1000 ? 'degraded' : 'healthy';

      return {
        status,
        latency,
        isConnected: this.isConnected,
        keyCount: stats.keyCount,
        memoryUsage: stats.memoryUsage
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      logError.high(error as Error, { 
        operation: 'healthCheck',
        latency,
        component: 'redis' 
      });

      return {
        status: 'unhealthy',
        latency,
        isConnected: false,
        error: (error as Error).message
      };
    }
  }
}