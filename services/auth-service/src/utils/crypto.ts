// src/utils/crypto.ts
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { environment } from '@/config/environment';
import { logger } from './logger';

export class CryptoUtils {
  /**
   * Hash de contraseña usando Argon2
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });
    } catch (error) {
      throw new Error('Error hashing password');
    }
  }

  /**
   * Verificar contraseña
   */
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generar token aleatorio
   */
  static generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generar salt
   */
  static generateSalt(length: number = 16): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Crear un hash SHA-256
   */
  static createSHA256Hash(data: string): string {
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  /**
   * Genera un ID de sesión único
   */
  static generateSessionId = (): string => {
    const timestamp = Date.now().toString();
    const random = generateSecureToken(16);
    return createSHA256Hash(`${timestamp}-${random}`);
  };

  /**
   * Genera un CSRF token
   */
  static generateCSRFToken = (): string => {
    return generateSecureToken(32);
  };

  /**
   * Valida la fortaleza de una contraseña
   */
  static validatePasswordStrength = (password: string): {
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
}