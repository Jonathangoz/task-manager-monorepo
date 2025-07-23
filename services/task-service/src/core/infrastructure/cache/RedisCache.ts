// src/core/infrastructure/cache/RedisCache.ts
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { taskRedisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CACHE_TTL } from '@/utils/constants';

export class RedisCache implements ICacheService {
  private redis = taskRedisConnection;

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.getJson<T>(key);
      if (cached) {
        logger.debug({ key }, 'Cache hit');
      } else {
        logger.debug({ key }, 'Cache miss');
      }
      return cached;
    } catch (error) {
      logger.error({ error, key }, 'Cache get operation failed');
      return null; // Fail gracefully
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.redis.setJson(key, value, ttlSeconds);
      logger.debug({ key, ttl: ttlSeconds }, 'Cache set successful');
    } catch (error) {
      logger.error({ error, key }, 'Cache set operation failed');
      // Don't throw, cache failures shouldn't break the app
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug({ key }, 'Cache delete successful');
    } catch (error) {
      logger.error({ error, key }, 'Cache delete operation failed');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache exists check failed');
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Redis pattern matching for bulk deletion
      const client = this.redis.getClient();
      const keys = await client.keys(`${client.options.keyPrefix || ''}${pattern}`);
      
      if (keys.length > 0) {
        // Remove prefix from keys before deletion
        const prefixLength = client.options.keyPrefix?.length || 0;
        const keysToDelete = keys.map(key => key.substring(prefixLength));
        await this.redis.del(...keysToDelete);
        logger.debug({ pattern, count: keys.length }, 'Cache pattern invalidation successful');
      }
    } catch (error) {
      logger.error({ error, pattern }, 'Cache pattern invalidation failed');
    }
  }

  // Task-specific cache methods
  async cacheUserTasks(userId: string, tasks: any[]): Promise<void> {
    const key = this.redis.getUserTasksKey(userId);
    await this.set(key, tasks, CACHE_TTL.USER_TASKS);
  }

  async getCachedUserTasks(userId: string): Promise<any[] | null> {
    const key = this.redis.getUserTasksKey(userId);
    return this.get<any[]>(key);
  }

  async invalidateUserTasksCache(userId: string): Promise<void> {
    const key = this.redis.getUserTasksKey(userId);
    await this.del(key);
  }

  async cacheUserCategories(userId: string, categories: any[]): Promise<void> {
    const key = this.redis.getUserCategoriesKey(userId);
    await this.set(key, categories, CACHE_TTL.USER_CATEGORIES);
  }

  async getCachedUserCategories(userId: string): Promise<any[] | null> {
    const key = this.redis.getUserCategoriesKey(userId);
    return this.get<any[]>(key);
  }

  async invalidateUserCategoriesCache(userId: string): Promise<void> {
    const key = this.redis.getUserCategoriesKey(userId);
    await this.del(key);
  }

  async cacheTask(taskId: string, task: any): Promise<void> {
    const key = this.redis.getTaskKey(taskId);
    await this.set(key, task, CACHE_TTL.TASK_DETAIL);
  }

  async getCachedTask(taskId: string): Promise<any | null> {
    const key = this.redis.getTaskKey(taskId);
    return this.get<any>(key);
  }

  async invalidateTaskCache(taskId: string): Promise<void> {
    const key = this.redis.getTaskKey(taskId);
    await this.del(key);
  }

  async cacheUserStats(userId: string, stats: any): Promise<void> {
    const key = this.redis.getUserStatsKey(userId);
    await this.set(key, stats, CACHE_TTL.USER_STATS);
  }

  async getCachedUserStats(userId: string): Promise<any | null> {
    const key = this.redis.getUserStatsKey(userId);
    return this.get<any>(key);
  }

  async invalidateUserStatsCache(userId: string): Promise<void> {
    const key = this.redis.getUserStatsKey(userId);
    await this.del(key);
  }

  // Batch invalidation for user data
  async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUserTasksCache(userId),
      this.invalidateUserCategoriesCache(userId),
      this.invalidateUserStatsCache(userId),
    ]);
    
    // Also invalidate search results
    await this.invalidatePattern(`search:${userId}:*`);
    
    logger.info({ userId }, 'User cache fully invalidated');
  }
}