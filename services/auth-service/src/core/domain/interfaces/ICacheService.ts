// src/core/domain/interfaces/ICacheService.ts
import { z } from 'zod';

// Schemas de validación
export const CacheOptionsSchema = z
  .object({
    ttl: z.number().positive().optional(),
    nx: z.boolean().optional(),
  })
  .strict();

export const RateLimitResultSchema = z
  .object({
    count: z.number().nonnegative(),
    resetTime: z.number().positive(),
  })
  .strict();

export const SessionDataSchema = z.record(z.unknown());

export const RefreshTokenDataSchema = z
  .object({
    userId: z.string().min(1),
    tokenId: z.string().min(1),
    issuedAt: z.number().positive(),
    expiresAt: z.number().positive(),
    deviceInfo: z.string().optional(),
  })
  .strict();

// Tipos inferidos de los schemas
export type CacheOptions = z.infer<typeof CacheOptionsSchema>;
export type RateLimitResult = z.infer<typeof RateLimitResultSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type RefreshTokenData = z.infer<typeof RefreshTokenDataSchema>;

// Interfaz principal del servicio de caché
export interface ICacheService {
  // Operaciones básicas
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<number>;
  setJson<T>(
    key: string,
    value: T,
    ttl?: number,
    options?: CacheOptions,
  ): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
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
  storeSession(
    sessionId: string,
    sessionData: SessionData,
    ttl: number,
  ): Promise<void>;
  getSession<T = SessionData>(sessionId: string): Promise<T | null>;
  deleteSession(sessionId: string): Promise<boolean>;

  storeRefreshToken(
    tokenId: string,
    tokenData: RefreshTokenData,
    ttl: number,
  ): Promise<void>;
  getRefreshToken<T = RefreshTokenData>(tokenId: string): Promise<T | null>;
  deleteRefreshToken(tokenId: string): Promise<boolean>;

  // Rate limiting
  incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<RateLimitResult>;

  // Login attempts tracking
  recordLoginAttempt(email: string): Promise<number>;
  getLoginAttempts(email: string): Promise<number>;
  clearLoginAttempts(email: string): Promise<boolean>;

  // Health check
  ping(): Promise<string>;
}

// Factory para crear validadores específicos (Dependency Inversion Principle)
export interface ICacheValidatorFactory {
  createCacheOptionsValidator(): z.ZodSchema<CacheOptions>;
  createRateLimitResultValidator(): z.ZodSchema<RateLimitResult>;
  createSessionDataValidator(): z.ZodSchema<SessionData>;
  createRefreshTokenDataValidator(): z.ZodSchema<RefreshTokenData>;
}

// Implementación concreta del factory
export class CacheValidatorFactory implements ICacheValidatorFactory {
  createCacheOptionsValidator(): z.ZodSchema<CacheOptions> {
    return CacheOptionsSchema;
  }

  createRateLimitResultValidator(): z.ZodSchema<RateLimitResult> {
    return RateLimitResultSchema;
  }

  createSessionDataValidator(): z.ZodSchema<SessionData> {
    return SessionDataSchema;
  }

  createRefreshTokenDataValidator(): z.ZodSchema<RefreshTokenData> {
    return RefreshTokenDataSchema;
  }
}

// Helper functions para validación (Single Responsibility Principle)
export class CacheValidationHelpers {
  static validateCacheOptions(data: unknown): CacheOptions {
    return CacheOptionsSchema.parse(data);
  }

  static validateRateLimitResult(data: unknown): RateLimitResult {
    return RateLimitResultSchema.parse(data);
  }

  static validateSessionData(data: unknown): SessionData {
    return SessionDataSchema.parse(data);
  }

  static validateRefreshTokenData(data: unknown): RefreshTokenData {
    return RefreshTokenDataSchema.parse(data);
  }

  static safeParseCacheOptions(
    data: unknown,
  ): z.SafeParseReturnType<unknown, CacheOptions> {
    return CacheOptionsSchema.safeParse(data);
  }

  static safeParseRateLimitResult(
    data: unknown,
  ): z.SafeParseReturnType<unknown, RateLimitResult> {
    return RateLimitResultSchema.safeParse(data);
  }

  static safeParseSessionData(
    data: unknown,
  ): z.SafeParseReturnType<unknown, SessionData> {
    return SessionDataSchema.safeParse(data);
  }

  static safeParseRefreshTokenData(
    data: unknown,
  ): z.SafeParseReturnType<unknown, RefreshTokenData> {
    return RefreshTokenDataSchema.safeParse(data);
  }
}

// Wrapper decorator para validación automática (Open/Closed Principle)
export function validateCacheMethod<T extends (...args: any[]) => any>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<T>,
): TypedPropertyDescriptor<T> | void {
  const method = descriptor.value!;

  descriptor.value = function (this: any, ...args: any[]) {
    // Aquí se puede agregar lógica de validación específica por método
    return method.apply(this, args);
  } as T;
}

// Tipos de utilidad para extender funcionalidad
export type CacheKey = string;
export type CacheValue<T = any> = T;
export type CacheTTL = number;

// Enums para constantes del caché
export enum CacheKeyPrefix {
  SESSION = 'session:',
  REFRESH_TOKEN = 'refresh_token:',
  RATE_LIMIT = 'rate_limit:',
  LOGIN_ATTEMPTS = 'login_attempts:',
  USER_DATA = 'user_data:',
}

export enum CacheDefaults {
  DEFAULT_TTL = 3600, // 1 hour
  RATE_LIMIT_WINDOW = 900, // 15 minutes
  LOGIN_ATTEMPTS_WINDOW = 900, // 15 minutes
  SESSION_TTL = 86400, // 24 hours
  REFRESH_TOKEN_TTL = 604800, // 7 days
}
