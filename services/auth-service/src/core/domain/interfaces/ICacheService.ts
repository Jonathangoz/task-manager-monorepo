// src/core/domain/interfaces/ICacheService.ts

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if not exists
}

export interface ICacheService {
  // Operaciones básicas
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;

  // Operaciones con TTL
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;

  // Operaciones de listas/conjuntos
  sadd(key: string, members: string[]): Promise<number>;
  srem(key: string, members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;

  // Operaciones de hash
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, field: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;

  // Utilidades específicas del dominio
  storeSession(sessionId: string, sessionData: any, ttl: number): Promise<void>;
  getSession<T>(sessionId: string): Promise<T | null>;
  deleteSession(sessionId: string): Promise<boolean>;

  storeRefreshToken(tokenId: string, tokenData: any, ttl: number): Promise<void>;
  getRefreshToken<T>(tokenId: string): Promise<T | null>;
  deleteRefreshToken(tokenId: string): Promise<boolean>;

  // Rate limiting
  incrementRateLimit(key: string, windowSeconds: number): Promise<{
    count: number;
    resetTime: number;
  }>;

  // Login attempts tracking
  recordLoginAttempt(email: string): Promise<number>;
  getLoginAttempts(email: string): Promise<number>;
  clearLoginAttempts(email: string): Promise<boolean>;

  // Health check
  ping(): Promise<string>;
}
