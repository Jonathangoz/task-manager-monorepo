// src/core/infrastructure/cache/RedisCache.ts
import { ICacheService, CacheData, CacheStats } from '@/core/domain/interfaces/ICacheService';
import { taskRedisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';
import { 
  CACHE_TTL, 
  CACHE_KEYS, 
  ERROR_CODES, 
  EVENT_TYPES,
  ERROR_MESSAGES 
} from '@/utils/constants';
import Redis from 'ioredis';

/**
 * Implementación del servicio de caché usando Redis
 * Cumple con el principio de responsabilidad única: gestionar operaciones de caché
 * Implementa la interfaz ICacheService para cumplir con el principio de inversión de dependencias
 */
export class RedisCache implements ICacheService {
  private redis = taskRedisConnection;
  private readonly keyPrefix: string;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.keyPrefix = this.redis.getClient().options.keyPrefix || '';
  }

  // ==============================================
  // OPERACIONES GENÉRICAS DE CACHÉ
  // ==============================================

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.getClient().setex(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.getClient().set(key, serializedValue);
      }
      
      logger.debug({ 
        key, 
        ttl: ttlSeconds,
        event: EVENT_TYPES.CACHE_HIT 
      }, 'Caché establecido exitosamente');
    } catch (error) {
      logger.error({ 
        error, 
        key,
        event: EVENT_TYPES.CACHE_ERROR 
      }, 'Falló operación de establecer caché');
      // No lanzar error, las fallas de caché no deben romper la aplicación
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.getClient().get(key);
      
      if (cached) {
        this.stats.hits++;
        logger.debug({ 
          key,
          event: EVENT_TYPES.CACHE_HIT 
        }, 'Cache hit');
        return JSON.parse(cached) as T;
      } else {
        this.stats.misses++;
        logger.debug({ 
          key,
          event: EVENT_TYPES.CACHE_MISS 
        }, 'Cache miss');
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      logger.error({ 
        error, 
        key,
        event: EVENT_TYPES.CACHE_ERROR 
      }, 'Falló operación de obtener caché');
      return null; // Falla silenciosa
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.getClient().del(key);
      logger.debug({ 
        key,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'Eliminación de caché exitosa');
    } catch (error) {
      logger.error({ 
        error, 
        key,
        event: EVENT_TYPES.CACHE_ERROR 
      }, 'Falló operación de eliminar caché');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.getClient().exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ 
        error, 
        key,
        event: EVENT_TYPES.CACHE_ERROR 
      }, 'Falló verificación de existencia de caché');
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.getClient().expire(key, ttlSeconds);
      logger.debug({ key, ttlSeconds }, 'TTL de caché establecido exitosamente');
    } catch (error) {
      logger.error({ error, key, ttlSeconds }, 'Falló operación de expirar caché');
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.getClient().ttl(key);
    } catch (error) {
      logger.error({ error, key }, 'Falló verificación de TTL de caché');
      return -1;
    }
  }

  // ==============================================
  // OPERACIONES JSON
  // ==============================================

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  // ==============================================
  // OPERACIONES EN LOTE
  // ==============================================

  async mset(keyValues: Record<string, any>, ttlSeconds?: number): Promise<void> {
    try {
      const client = this.redis.getClient();
      const pipeline = client.pipeline();

      Object.entries(keyValues).forEach(([key, value]) => {
        const serializedValue = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      });

      await pipeline.exec();
      logger.debug({ 
        keysCount: Object.keys(keyValues).length, 
        ttl: ttlSeconds 
      }, 'Establecimiento masivo de caché exitoso');
    } catch (error) {
      logger.error({ 
        error, 
        keysCount: Object.keys(keyValues).length 
      }, 'Falló establecimiento masivo de caché');
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.getClient().mget(...keys);
      return values.map(value => {
        if (value) {
          this.stats.hits++;
          return JSON.parse(value) as T;
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      logger.error({ error, keysCount: keys.length }, 'Falló obtención masiva de caché');
      return keys.map(() => null);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redis.getClient().del(...keys);
        logger.debug({ keysCount: keys.length }, 'Eliminación masiva de caché exitosa');
      }
    } catch (error) {
      logger.error({ error, keysCount: keys.length }, 'Falló eliminación masiva de caché');
    }
  }

  // ==============================================
  // OPERACIONES POR PATRÓN
  // ==============================================

  async keys(pattern: string): Promise<string[]> {
    try {
      const client = this.redis.getClient();
      const fullPattern = `${this.keyPrefix}${pattern}`;
      const keys = await client.keys(fullPattern);
      
      // Remover prefijo de las claves
      const prefixLength = this.keyPrefix.length;
      return keys.map(key => key.substring(prefixLength));
    } catch (error) {
      logger.error({ error, pattern }, 'Falló operación de obtener claves');
      return [];
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.mdel(keys);
        logger.debug({ 
          pattern, 
          count: keys.length 
        }, 'Eliminación por patrón exitosa');
      }
    } catch (error) {
      logger.error({ error, pattern }, 'Falló eliminación por patrón');
    }
  }

  // ==============================================
  // OPERACIONES ESPECÍFICAS DE TAREAS
  // ==============================================

  async cacheUserTasks(userId: string, tasks: any[], ttlSeconds?: number): Promise<void> {
    const key = this.getUserTasksKey(userId);
    const cacheData: CacheData<any[]> = {
      data: tasks,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.USER_TASKS);
    logger.debug({ userId, tasksCount: tasks.length }, 'Tareas de usuario cacheadas');
  }

  async getCachedUserTasks(userId: string): Promise<any[] | null> {
    const key = this.getUserTasksKey(userId);
    const cached = await this.get<CacheData<any[]>>(key);
    return cached?.data || null;
  }

  async invalidateUserTasksCache(userId: string): Promise<void> {
    const key = this.getUserTasksKey(userId);
    await this.del(key);
    logger.debug({ userId }, 'Caché de tareas de usuario invalidado');
  }

  async cacheUserCategories(userId: string, categories: any[], ttlSeconds?: number): Promise<void> {
    const key = this.getUserCategoriesKey(userId);
    const cacheData: CacheData<any[]> = {
      data: categories,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.USER_CATEGORIES);
    logger.debug({ userId, categoriesCount: categories.length }, 'Categorías de usuario cacheadas');
  }

  async getCachedUserCategories(userId: string): Promise<any[] | null> {
    const key = this.getUserCategoriesKey(userId);
    const cached = await this.get<CacheData<any[]>>(key);
    return cached?.data || null;
  }

  async invalidateUserCategoriesCache(userId: string): Promise<void> {
    const key = this.getUserCategoriesKey(userId);
    await this.del(key);
    logger.debug({ userId }, 'Caché de categorías de usuario invalidado');
  }

  async cacheUserStats(userId: string, stats: any, ttlSeconds?: number): Promise<void> {
    const key = this.getUserStatsKey(userId);
    const cacheData: CacheData<any> = {
      data: stats,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.USER_STATS);
    logger.debug({ userId }, 'Estadísticas de usuario cacheadas');
  }

  async getCachedUserStats(userId: string): Promise<any | null> {
    const key = this.getUserStatsKey(userId);
    const cached = await this.get<CacheData<any>>(key);
    return cached?.data || null;
  }

  async invalidateUserStatsCache(userId: string): Promise<void> {
    const key = this.getUserStatsKey(userId);
    await this.del(key);
    logger.debug({ userId }, 'Caché de estadísticas de usuario invalidado');
  }

  async cacheTaskDetail(taskId: string, task: any, ttlSeconds?: number): Promise<void> {
    const key = this.getTaskKey(taskId);
    const cacheData: CacheData<any> = {
      data: task,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.TASK_DETAIL);
    logger.debug({ taskId }, 'Detalle de tarea cacheado');
  }

  async getCachedTaskDetail(taskId: string): Promise<any | null> {
    const key = this.getTaskKey(taskId);
    const cached = await this.get<CacheData<any>>(key);
    return cached?.data || null;
  }

  async invalidateTaskCache(taskId: string): Promise<void> {
    const key = this.getTaskKey(taskId);
    await this.del(key);
    logger.debug({ taskId }, 'Caché de tarea invalidado');
  }

  async cacheCategoryDetail(categoryId: string, category: any, ttlSeconds?: number): Promise<void> {
    const key = this.getCategoryKey(categoryId);
    const cacheData: CacheData<any> = {
      data: category,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.CATEGORY_DETAIL);
    logger.debug({ categoryId }, 'Detalle de categoría cacheado');
  }

  async getCachedCategoryDetail(categoryId: string): Promise<any | null> {
    const key = this.getCategoryKey(categoryId);
    const cached = await this.get<CacheData<any>>(key);
    return cached?.data || null;
  }

  async invalidateCategoryCache(categoryId: string): Promise<void> {
    const key = this.getCategoryKey(categoryId);
    await this.del(key);
    logger.debug({ categoryId }, 'Caché de categoría invalidado');
  }

  async cacheSearchResults(
    userId: string,
    query: string,
    filters: any,
    results: any,
    ttlSeconds?: number
  ): Promise<void> {
    const key = this.getSearchKey(userId, query, JSON.stringify(filters));
    const cacheData: CacheData<any> = {
      data: {
        results,
        query,
        filters,
        count: Array.isArray(results) ? results.length : 1,
      },
      cachedAt: new Date().toISOString(),
      expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
    };
    
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.SEARCH_RESULTS);
    logger.debug({ userId, query }, 'Resultados de búsqueda cacheados');
  }

  async getCachedSearchResults(userId: string, query: string, filters: any): Promise<any | null> {
    const key = this.getSearchKey(userId, query, JSON.stringify(filters));
    const cached = await this.get<CacheData<any>>(key);
    return cached?.data?.results || null;
  }

  // ==============================================
  // PATRONES DE INVALIDACIÓN DE CACHÉ
  // ==============================================

  async invalidateUserCache(userId: string): Promise<void> {
    const tasks = [
      this.invalidateUserTasksCache(userId),
      this.invalidateUserCategoriesCache(userId),
      this.invalidateUserStatsCache(userId),
      this.deleteByPattern(`search:${userId}:*`),
    ];

    await Promise.all(tasks);
    logger.info({ userId }, 'Caché de usuario completamente invalidado');
  }

  async invalidateAllTaskCaches(): Promise<void> {
    await this.deleteByPattern('task:*');
    await this.deleteByPattern('user:*:tasks');
    await this.deleteByPattern('user:*:stats');
    logger.info('Todos los cachés de tareas invalidados');
  }

  async invalidateAllCategoryCaches(): Promise<void> {
    await this.deleteByPattern('category:*');
    await this.deleteByPattern('user:*:categories');
    logger.info('Todos los cachés de categorías invalidados');
  }

  // ==============================================
  // LIMITACIÓN DE TASA
  // ==============================================

  async incrementRateLimit(
    key: string, 
    windowSeconds: number, 
    maxRequests: number
  ): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
    allowed: boolean;
  }> {
    try {
      const rateLimitKey = this.getRateLimitKey(key);
      const client = this.redis.getClient();
      
      const pipeline = client.pipeline();
      pipeline.incr(rateLimitKey);
      pipeline.expire(rateLimitKey, windowSeconds);
      
      const results = await pipeline.exec();
      const count = (results?.[0]?.[1] as number) || 0;
      
      const remaining = Math.max(0, maxRequests - count);
      const resetTime = new Date(Date.now() + windowSeconds * 1000);
      const allowed = count <= maxRequests;

      return { count, remaining, resetTime, allowed };
    } catch (error) {
      logger.error({ error, key }, 'Falló incremento de límite de tasa');
      // Retornar valores permisivos en caso de error
      return {
        count: 0,
        remaining: maxRequests,
        resetTime: new Date(Date.now() + windowSeconds * 1000),
        allowed: true,
      };
    }
  }

  async getRateLimitInfo(key: string): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
  } | null> {
    try {
      const rateLimitKey = this.getRateLimitKey(key);
      const client = this.redis.getClient();
      
      const [count, ttl] = await Promise.all([
        client.get(rateLimitKey).then(val => parseInt(val || '0')),
        client.ttl(rateLimitKey)
      ]);

      if (ttl <= 0) return null;

      return {
        count,
        remaining: Math.max(0, count), // Esto necesitaría contexto de maxRequests
        resetTime: new Date(Date.now() + ttl * 1000),
      };
    } catch (error) {
      logger.error({ error, key }, 'Falló obtención de información de límite de tasa');
      return null;
    }
  }

  // ==============================================
  // SALUD Y ESTADÍSTICAS
  // ==============================================

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.redis.getClient().ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Falló verificación de salud de Redis');
      return false;
    }
  }

  async getStats(): Promise<CacheStats | null> {
    try {
      const info = await this.redis.getClient().info('memory');
      const keyspaceInfo = await this.redis.getClient().info('keyspace');
      
      // Parsear uso de memoria
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : undefined;

      // Parsear total de claves (simplificado)
      const keyspaceMatch = keyspaceInfo.match(/keys=(\d+)/);
      const totalKeys = keyspaceMatch ? parseInt(keyspaceMatch[1]) : 0;

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        totalKeys,
        memoryUsage,
      };
    } catch (error) {
      logger.error({ error }, 'Falló obtención de estadísticas de caché');
      return null;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.redis.getClient().flushall();
      this.stats.hits = 0;
      this.stats.misses = 0;
      logger.warn('Todos los datos de caché eliminados');
    } catch (error) {
      logger.error({ error }, 'Falló limpieza de caché');
      throw new Error(ERROR_MESSAGES.REDIS_ERROR);
    }
  }

  // ==============================================
  // CONSTRUCTORES DE CLAVES
  // ==============================================

  buildKey(namespace: string, ...parts: string[]): string {
    return [namespace, ...parts].join(':');
  }

  getUserTasksKey(userId: string): string {
    return CACHE_KEYS.USER_TASKS(userId);
  }

  getUserCategoriesKey(userId: string): string {
    return CACHE_KEYS.USER_CATEGORIES(userId);
  }

  getUserStatsKey(userId: string): string {
    return CACHE_KEYS.USER_STATS(userId);
  }

  getTaskKey(taskId: string): string {
    return CACHE_KEYS.TASK_DETAIL(taskId);
  }

  getCategoryKey(categoryId: string): string {
    return CACHE_KEYS.CATEGORY_DETAIL(categoryId);
  }

  getSearchKey(userId: string, query: string, filters: string): string {
    return CACHE_KEYS.SEARCH_RESULTS(userId, `${query}:${Buffer.from(filters).toString('base64')}`);
  }

  getRateLimitKey(identifier: string): string {
    return CACHE_KEYS.RATE_LIMIT(identifier);
  }
}