// src/utils/crypto.ts
import argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { config } from '@/config/environment';
import { logger } from './logger';

// Configuración de Argon2 basada en variables de entorno
const argon2Options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: config.argon2.memoryCost,
  timeCost: config.argon2.timeCost,
  parallelism: config.argon2.parallelism,
  hashLength: config.argon2.hashLength,
  saltLength: config.argon2.saltLength,
};

/**
 * Hashea una contraseña usando Argon2
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const hashedPassword = await argon2.hash(password, argon2Options);
    logger.debug('Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    logger.error({ error }, 'Failed to hash password');
    throw new Error('Password hashing failed');
  }
};

/**
 * Verifica una contraseña contra un hash
 */
export const verifyPassword = async (
  hashedPassword: string, 
  plainPassword: string
): Promise<boolean> => {
  try {
    const isValid = await argon2.verify(hashedPassword, plainPassword);
    logger.debug({ isValid }, 'Password verification completed');
    return isValid;
  } catch (error) {
    logger.error({ error }, 'Failed to verify password');
    return false;
  }
};

/**
 * Genera un token aleatorio seguro
 */
export const generateSecureToken = (length: number = 32): string => {
  return randomBytes(length).toString('hex');
};

/**
 * Genera un salt aleatorio
 */
export const generateSalt = (length: number = 16): string => {
  return randomBytes(length).toString('hex');
};

/**
 * Crea un hash SHA-256 de un string
 */
export const createSHA256Hash = (data: string): string => {
  return createHash('sha256').update(data).digest('hex');
};

/**
 * Genera un ID de sesión único
 */
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString();
  const random = generateSecureToken(16);
  return createSHA256Hash(`${timestamp}-${random}`);
};

/**
 * Genera un CSRF token
 */
export const generateCSRFToken = (): string => {
  return generateSecureToken(32);
};

/**
 * Valida la fortaleza de una contraseña
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} => {
  const errors: string[] = [];
  let score = 0;

  // Longitud mínima
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Al menos un número
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Al menos un carácter especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Puntuación adicional por longitud
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  return {
    isValid: errors.length === 0,
    errors,
    score,
  };
};