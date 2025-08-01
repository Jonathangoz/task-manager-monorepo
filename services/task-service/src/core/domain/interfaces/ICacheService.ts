// src/core/domain/interfaces/ICacheService.ts - Interfaz del Servicio de Caché

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

/**
 * Interfaz principal del servicio de caché
 * Define el contrato para todas las operaciones de caché del sistema
 * Principio de Segregación de Interfaces: agrupa métodos relacionados por funcionalidad
 */
export interface ICacheService {
  // ==============================================
  // OPERACIONES GENÉRICAS DE CACHÉ
  // ==============================================

  /**
   * Establece un valor en el caché
   * @param key Clave del caché
   * @param value Valor a almacenar
   * @param ttlSeconds Tiempo de vida en segundos (opcional)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene un valor del caché
   * @param key Clave del caché
   * @returns Valor almacenado o null si no existe
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Elimina una clave del caché
   * @param key Clave a eliminar
   */
  del(key: string): Promise<void>;

  /**
   * Verifica si una clave existe en el caché
   * @param key Clave a verificar
   * @returns true si existe, false en caso contrario
   */
  exists(key: string): Promise<boolean>;

  /**
   * Establece un tiempo de expiración para una clave
   * @param key Clave del caché
   * @param ttlSeconds Tiempo de vida en segundos
   */
  expire(key: string, ttlSeconds: number): Promise<void>;

  /**
   * Obtiene el tiempo de vida restante de una clave
   * @param key Clave del caché
   * @returns Segundos restantes (-1 si no tiene TTL, -2 si no existe)
   */
  ttl(key: string): Promise<number>;

  // ==============================================
  // OPERACIONES JSON
  // ==============================================

  /**
   * Establece un objeto JSON en el caché
   * @param key Clave del caché
   * @param value Objeto a almacenar
   * @param ttlSeconds Tiempo de vida en segundos (opcional)
   */
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene un objeto JSON del caché
   * @param key Clave del caché
   * @returns Objeto almacenado o null si no existe
   */
  getJson<T>(key: string): Promise<T | null>;

  // ==============================================
  // OPERACIONES EN LOTE
  // ==============================================

  /**
   * Establece múltiples claves en una sola operación
   * @param keyValues Objeto con claves y valores
   * @param ttlSeconds Tiempo de vida en segundos (opcional)
   */
  mset(keyValues: Record<string, any>, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene múltiples valores en una sola operación
   * @param keys Array de claves a obtener
   * @returns Array de valores (null para claves inexistentes)
   */
  mget<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Elimina múltiples claves en una sola operación
   * @param keys Array de claves a eliminar
   */
  mdel(keys: string[]): Promise<void>;

  // ==============================================
  // OPERACIONES POR PATRÓN
  // ==============================================

  /**
   * Busca claves que coincidan con un patrón
   * @param pattern Patrón de búsqueda (usando wildcards)
   * @returns Array de claves que coinciden
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Elimina todas las claves que coincidan con un patrón
   * @param pattern Patrón de búsqueda
   */
  deleteByPattern(pattern: string): Promise<void>;

  // ==============================================
  // OPERACIONES ESPECÍFICAS DE TAREAS
  // ==============================================

  /**
   * Cachea las tareas de un usuario
   * @param userId ID del usuario
   * @param tasks Array de tareas
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheUserTasks(
    userId: string,
    tasks: any[],
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene las tareas cacheadas de un usuario
   * @param userId ID del usuario
   * @returns Array de tareas o null si no está cacheado
   */
  getCachedUserTasks(userId: string): Promise<any[] | null>;

  /**
   * Invalida el caché de tareas de un usuario
   * @param userId ID del usuario
   */
  invalidateUserTasksCache(userId: string): Promise<void>;

  /**
   * Cachea las categorías de un usuario
   * @param userId ID del usuario
   * @param categories Array de categorías
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheUserCategories(
    userId: string,
    categories: any[],
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene las categorías cacheadas de un usuario
   * @param userId ID del usuario
   * @returns Array de categorías o null si no está cacheado
   */
  getCachedUserCategories(userId: string): Promise<any[] | null>;

  /**
   * Invalida el caché de categorías de un usuario
   * @param userId ID del usuario
   */
  invalidateUserCategoriesCache(userId: string): Promise<void>;

  /**
   * Cachea las estadísticas de un usuario
   * @param userId ID del usuario
   * @param stats Objeto con estadísticas
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheUserStats(
    userId: string,
    stats: any,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene las estadísticas cacheadas de un usuario
   * @param userId ID del usuario
   * @returns Estadísticas o null si no está cacheado
   */
  getCachedUserStats(userId: string): Promise<any | null>;

  /**
   * Invalida el caché de estadísticas de un usuario
   * @param userId ID del usuario
   */
  invalidateUserStatsCache(userId: string): Promise<void>;

  /**
   * Cachea el detalle de una tarea específica
   * @param taskId ID de la tarea
   * @param task Objeto tarea
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheTaskDetail(
    taskId: string,
    task: any,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene el detalle cacheado de una tarea
   * @param taskId ID de la tarea
   * @returns Tarea o null si no está cacheada
   */
  getCachedTaskDetail(taskId: string): Promise<any | null>;

  /**
   * Invalida el caché de una tarea específica
   * @param taskId ID de la tarea
   */
  invalidateTaskCache(taskId: string): Promise<void>;

  /**
   * Cachea el detalle de una categoría específica
   * @param categoryId ID de la categoría
   * @param category Objeto categoría
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheCategoryDetail(
    categoryId: string,
    category: any,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene el detalle cacheado de una categoría
   * @param categoryId ID de la categoría
   * @returns Categoría o null si no está cacheada
   */
  getCachedCategoryDetail(categoryId: string): Promise<any | null>;

  /**
   * Invalida el caché de una categoría específica
   * @param categoryId ID de la categoría
   */
  invalidateCategoryCache(categoryId: string): Promise<void>;

  /**
   * Cachea resultados de búsqueda
   * @param userId ID del usuario
   * @param query Consulta de búsqueda
   * @param filters Filtros aplicados
   * @param results Resultados de la búsqueda
   * @param ttlSeconds Tiempo de vida opcional
   */
  cacheSearchResults(
    userId: string,
    query: string,
    filters: any,
    results: any,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Obtiene resultados de búsqueda cacheados
   * @param userId ID del usuario
   * @param query Consulta de búsqueda
   * @param filters Filtros aplicados
   * @returns Resultados o null si no están cacheados
   */
  getCachedSearchResults(
    userId: string,
    query: string,
    filters: any,
  ): Promise<any | null>;

  // ==============================================
  // PATRONES DE INVALIDACIÓN DE CACHÉ
  // ==============================================

  /**
   * Invalida todo el caché relacionado con un usuario
   * @param userId ID del usuario
   */
  invalidateUserCache(userId: string): Promise<void>;

  /**
   * Invalida todos los cachés relacionados con tareas
   */
  invalidateAllTaskCaches(): Promise<void>;

  /**
   * Invalida todos los cachés relacionados con categorías
   */
  invalidateAllCategoryCaches(): Promise<void>;

  // ==============================================
  // LIMITACIÓN DE TASA
  // ==============================================

  /**
   * Incrementa el contador de límite de tasa
   * @param key Identificador único
   * @param windowSeconds Ventana de tiempo en segundos
   * @param maxRequests Máximo número de solicitudes
   * @returns Información del límite de tasa
   */
  incrementRateLimit(
    key: string,
    windowSeconds: number,
    maxRequests: number,
  ): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
    allowed: boolean;
  }>;

  /**
   * Obtiene información del límite de tasa
   * @param key Identificador único
   * @returns Información del límite o null si no existe
   */
  getRateLimitInfo(key: string): Promise<{
    count: number;
    remaining: number;
    resetTime: Date;
  } | null>;

  // ==============================================
  // SALUD Y ESTADÍSTICAS
  // ==============================================

  /**
   * Verifica si el servicio de caché está funcionando
   * @returns true si está saludable, false en caso contrario
   */
  isHealthy(): Promise<boolean>;

  /**
   * Obtiene estadísticas del caché
   * @returns Estadísticas del caché o null si hay error
   */
  getStats(): Promise<CacheStats | null>;

  /**
   * Limpia completamente el caché
   * CUIDADO: Esta operación elimina todos los datos
   */
  flushAll(): Promise<void>;

  // ==============================================
  // CONSTRUCTORES DE CLAVES
  // ==============================================

  /**
   * Construye una clave con namespace y partes
   * @param namespace Espacio de nombres
   * @param parts Partes adicionales de la clave
   * @returns Clave construida
   */
  buildKey(namespace: string, ...parts: string[]): string;

  /**
   * Obtiene la clave para tareas de usuario
   * @param userId ID del usuario
   * @returns Clave formateada
   */
  getUserTasksKey(userId: string): string;

  /**
   * Obtiene la clave para categorías de usuario
   * @param userId ID del usuario
   * @returns Clave formateada
   */
  getUserCategoriesKey(userId: string): string;

  /**
   * Obtiene la clave para estadísticas de usuario
   * @param userId ID del usuario
   * @returns Clave formateada
   */
  getUserStatsKey(userId: string): string;

  /**
   * Obtiene la clave para una tarea específica
   * @param taskId ID de la tarea
   * @returns Clave formateada
   */
  getTaskKey(taskId: string): string;

  /**
   * Obtiene la clave para una categoría específica
   * @param categoryId ID de la categoría
   * @returns Clave formateada
   */
  getCategoryKey(categoryId: string): string;

  /**
   * Obtiene la clave para resultados de búsqueda
   * @param userId ID del usuario
   * @param query Consulta de búsqueda
   * @param filters Filtros serializados
   * @returns Clave formateada
   */
  getSearchKey(userId: string, query: string, filters: string): string;

  /**
   * Obtiene la clave para límite de tasa
   * @param identifier Identificador único
   * @returns Clave formateada
   */
  getRateLimitKey(identifier: string): string;
}

// ==============================================
// TIPOS AUXILIARES
// ==============================================

/**
 * Configuración para operaciones de caché
 */
export interface CacheConfig {
  defaultTTL: number;
  keyPrefix: string;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Metadatos de caché extendidos
 */
export interface ExtendedCacheData<T = any> extends CacheData<T> {
  version?: string;
  tags?: string[];
  size?: number;
  hits?: number;
}

/**
 * Resultado de operación de caché
 */
export interface CacheOperationResult {
  success: boolean;
  key: string;
  operation: 'set' | 'get' | 'del' | 'expire';
  timestamp: string;
  error?: string;
}

/**
 * Información de invalidación de caché
 */
export interface CacheInvalidationInfo {
  pattern: string;
  keysAffected: string[];
  timestamp: string;
  reason: string;
}

/**
 * Métricas detalladas de caché
 */
export interface DetailedCacheStats extends CacheStats {
  avgResponseTime: number;
  operationsPerSecond: number;
  errorRate: number;
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
  }>;
  memoryDistribution: {
    [keyspace: string]: number;
  };
}
