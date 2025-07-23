
// src/core/domain/interfaces/ICacheService.ts

import { ICacheService } from './ICacheService';
/**
 Interfaz para el servicio de cache
 Define los métodos que debe implementar cualquier servicio de cache
 */
export interface ICacheService {

  // Métodos básicos de cache

  /** Establece un valor en cache con TTL opcional */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /** Obtiene un valor del cache */
  get(key: string): Promise<string | null>;

  /** Elimina una clave del cache */
  del(key: string): Promise<boolean>;

  /** Verifica si existe una clave en cache */
  exists(key: string): Promise<boolean>;

  /** Establece el tiempo de expiración de una clave */
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Obtiene el tiempo de vida restante de una clave
   */
  ttl(key: string): Promise<number>;


  // Métodos para objetos JSON


  /**
   * Almacena un objeto JSON en cache
   */
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene un objeto JSON del cache
   */
  getJson<T>(key: string): Promise<T | null>;


  // Métodos específicos para sesiones


  /**
   * Almacena datos de sesión de usuario
   */
  setUserSession(sessionId: string, sessionData: any, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene datos de sesión de usuario
   */
  getUserSession<T>(sessionId: string): Promise<T | null>;

  /**
   * Elimina sesión de usuario
   */
  deleteUserSession(sessionId: string): Promise<boolean>;

  /**
   * Almacena lista de sesiones activas de un usuario
   */
  setUserSessions(userId: string, sessionIds: string[], ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene lista de sesiones activas de un usuario
   */
  getUserSessions(userId: string): Promise<string[]>;


  // Métodos específicos para tokens


  /**
   * Almacena datos de refresh token
   */
  setRefreshToken(tokenId: string, tokenData: any, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene datos de refresh token
   */
  getRefreshToken<T>(tokenId: string): Promise<T | null>;

  /**
   * Elimina refresh token
   */
  deleteRefreshToken(tokenId: string): Promise<boolean>;


  // Métodos para rate limiting


  /**
   * Incrementa contador de rate limiting
   */
  incrementRateLimit(identifier: string, windowMs: number): Promise<number>;

  /**
   * Obtiene contador actual de rate limiting
   */
  getRateLimit(identifier: string): Promise<number>;

  /**
   * Resetea contador de rate limiting
   */
  resetRateLimit(identifier: string): Promise<boolean>;


  // Métodos para intentos de login


  /**
   * Incrementa contador de intentos de login fallidos
   */
  incrementLoginAttempts(email: string): Promise<number>;

  /**
   * Obtiene número de intentos de login fallidos
   */
  getLoginAttempts(email: string): Promise<number>;

  /**
   * Resetea contador de intentos de login
   */
  resetLoginAttempts(email: string): Promise<boolean>;


  // Métodos para perfil de usuario


  /**
   * Almacena perfil de usuario en cache
   */
  setUserProfile(userId: string, profile: any, ttlSeconds?: number): Promise<void>;

  /**
   * Obtiene perfil de usuario del cache
   */
  getUserProfile<T>(userId: string): Promise<T | null>;

  /**
   * Elimina perfil de usuario del cache
   */
  deleteUserProfile(userId: string): Promise<boolean>;


  // Métodos de utilidad y mantenimiento


  /**
   * Elimina claves que coincidan con un patrón
   */
  deletePattern(pattern: string): Promise<number>;

  /**
   * Elimina todos los datos de cache relacionados con un usuario
   */
  deleteUserData(userId: string): Promise<void>;

  /**
   * Limpia todo el cache
   */
  flushAll(): Promise<void>;

  /**
   * Obtiene estadísticas del cache
   */
  getStats(): Promise<{
    keyCount: number;
    memoryUsage: string;
    hitRatio?: string;
  }>;

  /**
   * Verifica el estado de salud del servicio de cache
   */
  healthCheck(): Promise<boolean>;

  /**
   * Limpia sesiones expiradas
   */
  cleanupExpiredSessions(): Promise<number>;

  /**
   * Limpia tokens expirados
   */
  cleanupExpiredTokens(): Promise<number>;
}