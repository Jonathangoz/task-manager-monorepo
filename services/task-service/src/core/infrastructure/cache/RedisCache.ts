// src/core/infrastructure/cache/RedisCache.ts
import {
  ICacheService,
  CacheData,
  CacheStats,
} from '@/core/domain/interfaces/ICacheService';
import { taskRedisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CACHE_TTL, CACHE_KEYS } from '@/utils/constants';
import { TaskWithCategory } from '@/core/domain/types/TaskDomain';
import { CategoryWithTaskCount } from '@/core/domain/interfaces/ICategoryRepository';

// Type guard para validar la estructura de CacheData
function isCacheData<T>(
  obj: any,
  dataValidator: (d: any) => boolean,
): obj is CacheData<T> {
  return (
    obj && typeof obj === 'object' && 'data' in obj && dataValidator(obj.data)
  );
}

// Type guard para validar que un objeto es TaskWithCategory
function isTaskWithCategory(obj: any): obj is TaskWithCategory {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string';
}

// Type guard para validar que un objeto es CategoryWithTaskCount
function isCategoryWithTaskCount(obj: any): obj is CategoryWithTaskCount {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
}

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

  // ... (métodos genéricos set, get, del, etc. sin cambios) ...
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.getClient().setex(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.getClient().set(key, serializedValue);
      }
    } catch (error) {
      logger.error({ error, key }, 'Failed to set cache');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.getClient().get(key);
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached) as T;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      logger.error({ error, key }, 'Failed to get cache');
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.getClient().del(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete cache key');
    }
  }

  // ... (otros métodos genéricos) ...
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.getClient().exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to check cache key existence');
      return false;
    }
  }

  // ✅ CORRECCIÓN: Se implementan los métodos específicos del dominio con tipado fuerte.

  async cacheUserTasks(
    userId: string,
    tasks: TaskWithCategory[],
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.USER_TASKS(userId);
    const cacheData: CacheData<TaskWithCategory[]> = {
      data: tasks,
      cachedAt: new Date().toISOString(),
    };
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.USER_TASKS);
  }

  async getCachedUserTasks(userId: string): Promise<TaskWithCategory[] | null> {
    const key = CACHE_KEYS.USER_TASKS(userId);
    const cached = await this.get<CacheData<TaskWithCategory[]>>(key);
    if (
      isCacheData(
        cached,
        (d) => Array.isArray(d) && d.every(isTaskWithCategory),
      )
    ) {
      return cached.data;
    }
    return null;
  }

  async invalidateUserTasksCache(userId: string): Promise<void> {
    await this.del(CACHE_KEYS.USER_TASKS(userId));
  }

  async cacheUserCategories(
    userId: string,
    categories: CategoryWithTaskCount[],
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.USER_CATEGORIES(userId);
    const cacheData: CacheData<CategoryWithTaskCount[]> = {
      data: categories,
      cachedAt: new Date().toISOString(),
    };
    await this.set(key, cacheData, ttlSeconds || CACHE_TTL.USER_CATEGORIES);
  }

  async getCachedUserCategories(
    userId: string,
  ): Promise<CategoryWithTaskCount[] | null> {
    const key = CACHE_KEYS.USER_CATEGORIES(userId);
    const cached = await this.get<CacheData<CategoryWithTaskCount[]>>(key);
    if (
      isCacheData(
        cached,
        (d) => Array.isArray(d) && d.every(isCategoryWithTaskCount),
      )
    ) {
      return cached.data;
    }
    return null;
  }

  async invalidateUserCategoriesCache(userId: string): Promise<void> {
    await this.del(CACHE_KEYS.USER_CATEGORIES(userId));
  }

  async cacheUserStats(
    userId: string,
    stats: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.USER_STATS(userId);
    await this.set(
      key,
      { data: stats, cachedAt: new Date().toISOString() },
      ttlSeconds || CACHE_TTL.USER_STATS,
    );
  }

  async getCachedUserStats(userId: string): Promise<unknown | null> {
    const key = CACHE_KEYS.USER_STATS(userId);
    const cached = await this.get<CacheData<unknown>>(key);
    return cached?.data || null;
  }

  async invalidateUserStatsCache(userId: string): Promise<void> {
    await this.del(CACHE_KEYS.USER_STATS(userId));
  }

  async cacheTaskDetail(
    taskId: string,
    task: TaskWithCategory,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.TASK_DETAIL(taskId);
    await this.set(
      key,
      { data: task, cachedAt: new Date().toISOString() },
      ttlSeconds || CACHE_TTL.TASK_DETAIL,
    );
  }

  async getCachedTaskDetail(taskId: string): Promise<TaskWithCategory | null> {
    const key = CACHE_KEYS.TASK_DETAIL(taskId);
    const cached = await this.get<CacheData<TaskWithCategory>>(key);
    if (isCacheData(cached, isTaskWithCategory)) {
      return cached.data;
    }
    return null;
  }

  async invalidateTaskCache(taskId: string): Promise<void> {
    await this.del(CACHE_KEYS.TASK_DETAIL(taskId));
  }

  async cacheCategoryDetail(
    categoryId: string,
    category: CategoryWithTaskCount,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.CATEGORY_DETAIL(categoryId);
    await this.set(
      key,
      { data: category, cachedAt: new Date().toISOString() },
      ttlSeconds || CACHE_TTL.CATEGORY_DETAIL,
    );
  }

  async getCachedCategoryDetail(
    categoryId: string,
  ): Promise<CategoryWithTaskCount | null> {
    const key = CACHE_KEYS.CATEGORY_DETAIL(categoryId);
    const cached = await this.get<CacheData<CategoryWithTaskCount>>(key);
    if (isCacheData(cached, isCategoryWithTaskCount)) {
      return cached.data;
    }
    return null;
  }

  async invalidateCategoryCache(categoryId: string): Promise<void> {
    await this.del(CACHE_KEYS.CATEGORY_DETAIL(categoryId));
  }

  async cacheSearchResults(
    userId: string,
    query: string,
    filters: unknown,
    results: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = CACHE_KEYS.SEARCH_RESULTS(
      userId,
      `${query}:${Buffer.from(JSON.stringify(filters)).toString('base64')}`,
    );
    await this.set(
      key,
      { data: { results }, cachedAt: new Date().toISOString() },
      ttlSeconds || CACHE_TTL.SEARCH_RESULTS,
    );
  }

  async getCachedSearchResults(
    userId: string,
    query: string,
    filters: unknown,
  ): Promise<unknown | null> {
    const key = CACHE_KEYS.SEARCH_RESULTS(
      userId,
      `${query}:${Buffer.from(JSON.stringify(filters)).toString('base64')}`,
    );
    const cached = await this.get<CacheData<{ results: unknown }>>(key);
    // ✅ CORRECCIÓN: Se añade una guarda de tipo para evitar el error.
    if (
      cached &&
      typeof cached.data === 'object' &&
      cached.data !== null &&
      'results' in cached.data
    ) {
      return cached.data.results;
    }
    return null;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      const fullPattern = `${this.keyPrefix}${pattern}`;
      const keys = await client.keys(fullPattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      logger.error({ error, pattern }, 'Failed to delete by pattern');
    }
  }

  // ... (resto de métodos como isHealthy, getStats, flushAll sin cambios) ...
  async isHealthy(): Promise<boolean> {
    try {
      return (await this.redis.getClient().ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async getStats(): Promise<CacheStats | null> {
    try {
      const info = await this.redis.getClient().info();
      const totalKeys = await this.redis.getClient().dbsize();
      const totalRequests = this.stats.hits + this.stats.misses;
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
        totalKeys: totalKeys,
        memoryUsage: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0'),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get cache stats');
      return null;
    }
  }

  async flushAll(): Promise<void> {
    await this.redis.getClient().flushall();
  }
}
