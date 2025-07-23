// src/core/domain/interfaces/ICacheService.ts

export interface CacheData<T = any> {
  data: T;
  cachedAt: string;
  expiresAt?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage?: number;
}

export interface ICacheService {
  // Generic cache operations
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  
  get<T>(key: string): Promise<T | null>;
  
  del(key: string): Promise<void>;
  
  exists(key: string): Promise<boolean>;
  
  expire(key: string, ttlSeconds: number): Promise<void>;
  
  ttl(key: string): Promise<number>;
  
  // JSON operations
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  
  getJson<T>(key: string): Promise<T | null>;
  
  // Bulk operations
  mset(keyValues: Record<string, any>, ttlSeconds?: number): Promise<void>;
  
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  
  mdel(keys: string[]): Promise<void>;
  
  // Pattern operations
  keys(pattern: string): Promise<string[]>;
  
  deleteByPattern(pattern: string): Promise<void>;
  
  // Task-specific cache operations
  cacheUserTasks(userId: string, tasks: any[], ttlSeconds?: number): Promise<void>;
  
  getCachedUserTasks(userId: string): Promise<any[] | null>;
  
  invalidateUserTasksCache(userId: string): Promise<void>;
  
  cacheUserCategories(userId: string, categories: any[], ttlSeconds?: number): Promise<void>;
  
  getCachedUserCategories(userId: string): Promise<any[] | null>;
  
  invalidateUserCategoriesCache(userId: string): Promise<void>;
  
  cacheUserStats(userId: string, stats: any, ttlSeconds?: number): Promise<void>;
  
  getCachedUserStats(userId: string): Promise<any | null>;
  
  invalidateUserStatsCache(userId: string): Promise<void>;
  
  cacheTaskDetail(taskId: string, task: any, ttlSeconds?: number): Promise<void>;
  
  getCachedTaskDetail(taskId: string): Promise<any | null>;
  
  invalidateTaskCache(taskId: string): Promise<void>;
  
  cacheCategoryDetail(categoryId: string, category: any, ttlSeconds?: number): Promise<void>;
  
  getCachedCategoryDetail(categoryId: string): Promise<any | null>;
  
  invalidateCategoryCache(categoryId: string): Promise<void>;
  
  cacheSearchResults(
    userId: string,
    query: string,
    filters: any,
    results: any,
    ttlSeconds?: number
  ): Promise<void>;
  
  getCachedSearchResults(userId: string, query: string, filters: any): Promise<any | null>;
  
  // Cache invalidation patterns
  invalidateUserCache(userId: string): Promise<void>;
  
  invalidateAllTaskCaches(): Promise<void>;
  
  invalidateAllCategoryCaches(): Promise<void>;
  
  // Rate limiting
  incrementRateLimit(key: string, windowSeconds: number, maxRequests: number): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
    allowed: boolean;
  }>;
  
  getRateLimitInfo(key: string): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
  } | null>;
  
  // Health and stats
  isHealthy(): Promise<boolean>;
  
  getStats(): Promise<CacheStats | null>;
  
  flushAll(): Promise<void>;
  
  // Key builders
  buildKey(namespace: string, ...parts: string[]): string;
  
  getUserTasksKey(userId: string): string;
  
  getUserCategoriesKey(userId: string): string;
  
  getUserStatsKey(userId: string): string;
  
  getTaskKey(taskId: string): string;
  
  getCategoryKey(categoryId: string): string;
  
  getSearchKey(userId: string, query: string, filters: string): string;
  
  getRateLimitKey(identifier: string): string;
}