// src/core/domain/interfaces/ICacheService.ts
import { TaskWithCategory } from '@/core/domain/types/TaskDomain';
import { CategoryWithTaskCount } from './ICategoryRepository';

// Estructura para los datos guardados en caché
export interface CacheData<T> {
  data: T;
  cachedAt: string;
  expiresAt?: string;
}

// Estadísticas del servicio de caché
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys?: number;
  memoryUsage?: number;
}

// Interfaz para un servicio de caché genérico
export interface ICacheService {
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flushAll(): Promise<void>;
  isHealthy(): Promise<boolean>;
  getStats(): Promise<CacheStats | null>;

  // Métodos específicos para el dominio de la aplicación
  cacheUserTasks(
    userId: string,
    tasks: TaskWithCategory[],
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedUserTasks(userId: string): Promise<TaskWithCategory[] | null>;
  invalidateUserTasksCache(userId: string): Promise<void>;

  cacheUserCategories(
    userId: string,
    categories: CategoryWithTaskCount[],
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedUserCategories(
    userId: string,
  ): Promise<CategoryWithTaskCount[] | null>;
  invalidateUserCategoriesCache(userId: string): Promise<void>;

  cacheUserStats(
    userId: string,
    stats: unknown,
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedUserStats(userId: string): Promise<unknown | null>;
  invalidateUserStatsCache(userId: string): Promise<void>;

  cacheTaskDetail(
    taskId: string,
    task: TaskWithCategory,
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedTaskDetail(taskId: string): Promise<TaskWithCategory | null>;
  invalidateTaskCache(taskId: string): Promise<void>;

  cacheCategoryDetail(
    categoryId: string,
    category: CategoryWithTaskCount,
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedCategoryDetail(
    categoryId: string,
  ): Promise<CategoryWithTaskCount | null>;
  invalidateCategoryCache(categoryId: string): Promise<void>;

  cacheSearchResults(
    userId: string,
    query: string,
    filters: unknown,
    results: unknown,
    ttlSeconds?: number,
  ): Promise<void>;
  getCachedSearchResults(
    userId: string,
    query: string,
    filters: unknown,
  ): Promise<unknown | null>;

  deleteByPattern(pattern: string): Promise<void>;
}
