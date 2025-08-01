// ==============================================
// src/utils/crypto.ts - Secure Cryptographic Utilities
// Implementación segura de hash de contraseñas con Argon2 y utilidades crypto
// ==============================================

import * as argon2 from 'argon2';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { environment } from '@/config/environment';
import { logger } from './logger';
import {
  SECURITY_CONFIG,
  PASSWORD_VALIDATION,
  VALIDATION_MESSAGES,
} from './constants';

// ==============================================
// CONFIGURACIÓN ARGON2 BASADA EN OWASP
// ==============================================
const ARGON2_CONFIG = {
  // Configuración para producción (más segura pero más lenta)
  PRODUCTION: {
    type: argon2.argon2id, // Argon2id es resistente a ataques de tiempo y memoria
    memoryCost: 2 ** 16, // 64 MB - Recomendado por OWASP
    timeCost: 3, // 3 iteraciones - Balance seguridad/rendimiento
    parallelism: 1, // 1 thread - Estándar para aplicaciones web
    hashLength: 32, // 32 bytes = 256 bits
    saltLength: 16, // 16 bytes = 128 bits
  },

  // Configuración para desarrollo/testing (más rápida)
  DEVELOPMENT: {
    type: argon2.argon2id,
    memoryCost: 2 ** 12, // 4 MB - Más rápido para desarrollo
    timeCost: 2, // 2 iteraciones
    parallelism: 1,
    hashLength: 32,
    saltLength: 16,
  },

  // Configuración para testing (muy rápida)
  TEST: {
    type: argon2.argon2id,
    memoryCost: 2 ** 10, // 1 MB - Muy rápido para tests
    timeCost: 1, // 1 iteración
    parallelism: 1,
    hashLength: 32,
    saltLength: 16,
  },
} as const;

// ==============================================
// CONFIGURACIÓN DINÁMICA BASADA EN ENTORNO
// ==============================================
const getArgon2Config = () => {
  switch (environment.app.env) {
    case 'production':
      return ARGON2_CONFIG.PRODUCTION;
    case 'test':
      return ARGON2_CONFIG.TEST;
    default:
      return ARGON2_CONFIG.DEVELOPMENT;
  }
};

// ==============================================
// INTERFACES Y TIPOS
// ==============================================
export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
  score: number;
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
}

export interface TokenGenerationOptions {
  length?: number;
  encoding?: 'hex' | 'base64' | 'base64url';
}

// ==============================================
// CLASE PRINCIPAL CRYPTO UTILS
// ==============================================
export class CryptoUtils {
  private static readonly config = getArgon2Config();

  // ==============================================
  // HASH Y VERIFICACIÓN DE CONTRASEÑAS
  // ==============================================

  /**
   * Hash de contraseña usando Argon2id con configuración optimizada
   * @param password - Contraseña en texto plano
   * @returns Promise<string> - Hash de la contraseña
   * @throws Error si ocurre un error durante el hashing
   */
  static async hashPassword(password: string): Promise<string> {
    const startTime = process.hrtime.bigint();

    try {
      // Validar entrada
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      // Validar longitud mínima antes del hash
      if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
        throw new Error(
          `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`,
        );
      }

      // Generar hash con configuración específica del entorno
      const hash = await argon2.hash(password, {
        ...this.config,
        raw: false, // Retornar string codificado, no buffer
      });

      // Log de performance en desarrollo
      if (environment.app.isDevelopment) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convertir a ms
        logger.debug('Password hashed', {
          duration: `${duration.toFixed(2)}ms`,
          memoryCost: this.config.memoryCost,
          timeCost: this.config.timeCost,
        });
      }

      return hash;
    } catch (error) {
      logger.error('Error hashing password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        memoryCost: this.config.memoryCost,
        timeCost: this.config.timeCost,
      });

      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verificar contraseña contra hash usando timing-safe comparison
   * @param hash - Hash almacenado en la base de datos
   * @param password - Contraseña en texto plano a verificar
   * @returns Promise<boolean> - true si la contraseña es correcta
   */
  static async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    const startTime = process.hrtime.bigint();

    try {
      // Validar entradas
      if (
        !hash ||
        !password ||
        typeof hash !== 'string' ||
        typeof password !== 'string'
      ) {
        logger.warn('Invalid parameters for password verification');
        return false;
      }

      // Verificar usando Argon2
      const isValid = await argon2.verify(hash, password);

      // Log de performance en desarrollo
      if (environment.app.isDevelopment) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        logger.debug('Password verified', {
          duration: `${duration.toFixed(2)}ms`,
          result: isValid,
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying password', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // En caso de error, retornar false (falla cerrada)
      return false;
    }
  }

  /**
   * Verificar si un hash necesita ser rehashed (por cambio de configuración)
   * @param hash - Hash a verificar
   * @returns boolean - true si necesita rehash
   */
  static needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.config);
    } catch (error) {
      logger.error('Error checking if hash needs rehashing', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // ==============================================
  // GENERACIÓN DE TOKENS SEGUROS
  // ==============================================

  /**
   * Generar token criptográficamente seguro
   * @param options - Opciones de generación
   * @returns string - Token generado
   */
  static generateSecureToken(options: TokenGenerationOptions = {}): string {
    const { length = 32, encoding = 'hex' } = options;

    try {
      const buffer = randomBytes(length);

      switch (encoding) {
        case 'base64':
          return buffer.toString('base64');
        case 'base64url':
          return buffer.toString('base64url');
        case 'hex':
        default:
          return buffer.toString('hex');
      }
    } catch (error) {
      logger.error('Error generating secure token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        length,
        encoding,
      });
      throw new Error('Failed to generate secure token');
    }
  }

  /**
   * Generar salt criptográficamente seguro
   * @param length - Longitud del salt en bytes (default: 16)
   * @returns string - Salt en formato hex
   */
  static generateSalt(length: number = 16): string {
    return this.generateSecureToken({ length, encoding: 'hex' });
  }

  /**
   * Generar ID de sesión único y seguro
   * @returns string - ID de sesión
   */
  static generateSessionId(): string {
    try {
      const timestamp = Date.now().toString();
      const random = this.generateSecureToken({ length: 16 });
      const combined = `${timestamp}-${random}-${environment.app.env}`;

      return this.createSHA256Hash(combined);
    } catch (error) {
      logger.error('Error generating session ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to generate session ID');
    }
  }

  /**
   * Generar token CSRF
   * @returns string - Token CSRF
   */
  static generateCSRFToken(): string {
    return this.generateSecureToken({
      length: 32,
      encoding: 'base64url',
    });
  }

  /**
   * Generar token para reset de contraseña
   * @returns string - Token para reset
   */
  static generatePasswordResetToken(): string {
    return this.generateSecureToken({
      length: 48,
      encoding: 'base64url',
    });
  }

  /**
   * Generar token para verificación de email
   * @returns string - Token para verificación
   */
  static generateEmailVerificationToken(): string {
    return this.generateSecureToken({
      length: 32,
      encoding: 'base64url',
    });
  }

  // ==============================================
  // UTILIDADES DE HASH
  // ==============================================

  /**
   * Crear hash SHA-256 de un string
   * @param data - Datos a hashear
   * @returns string - Hash SHA-256 en formato hex
   */
  static createSHA256Hash(data: string): string {
    try {
      return createHash('sha256').update(data, 'utf8').digest('hex');
    } catch (error) {
      logger.error('Error creating SHA256 hash', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to create SHA256 hash');
    }
  }

  /**
   * Crear hash SHA-512 de un string
   * @param data - Datos a hashear
   * @returns string - Hash SHA-512 en formato hex
   */
  static createSHA512Hash(data: string): string {
    try {
      return createHash('sha512').update(data, 'utf8').digest('hex');
    } catch (error) {
      logger.error('Error creating SHA512 hash', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to create SHA512 hash');
    }
  }

  /**
   * Comparación timing-safe de strings
   * @param a - Primer string
   * @param b - Segundo string
   * @returns boolean - true si son iguales
   */
  static timingSafeEqual(a: string, b: string): boolean {
    try {
      // Convertir a buffers de la misma longitud para evitar timing attacks
      const bufferA = Buffer.from(a, 'utf8');
      const bufferB = Buffer.from(b, 'utf8');

      // Si las longitudes son diferentes, crear buffers del mismo tamaño
      if (bufferA.length !== bufferB.length) {
        const maxLength = Math.max(bufferA.length, bufferB.length);
        const paddedA = Buffer.alloc(maxLength);
        const paddedB = Buffer.alloc(maxLength);

        bufferA.copy(paddedA);
        bufferB.copy(paddedB);

        return timingSafeEqual(paddedA, paddedB);
      }

      return timingSafeEqual(bufferA, bufferB);
    } catch (error) {
      logger.error('Error in timing safe comparison', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // ==============================================
  // VALIDACIÓN DE CONTRASEÑAS
  // ==============================================

  /**
   * Validar la fortaleza de una contraseña según las políticas de seguridad
   * @param password - Contraseña a validar
   * @returns PasswordStrengthResult - Resultado de la validación
   */
  static validatePasswordStrength(password: string): PasswordStrengthResult {
    const errors: string[] = [];
    let score = 0;

    // Validar entrada
    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        errors: [VALIDATION_MESSAGES.PASSWORD_REQUIRED],
        score: 0,
        strength: 'very-weak',
      };
    }

    // Validar longitud mínima
    if (password.length < PASSWORD_VALIDATION.MIN_LENGTH) {
      errors.push(VALIDATION_MESSAGES.PASSWORD_TOO_SHORT);
    } else {
      score += 1;
    }

    // Validar longitud máxima
    if (password.length > PASSWORD_VALIDATION.MAX_LENGTH) {
      errors.push(
        `La contraseña debe tener menos de ${PASSWORD_VALIDATION.MAX_LENGTH} caracteres`,
      );
    }

    // Validar letra minúscula
    if (PASSWORD_VALIDATION.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra minúscula');
    } else if (PASSWORD_VALIDATION.REQUIRE_LOWERCASE) {
      score += 1;
    }

    // Validar letra mayúscula
    if (PASSWORD_VALIDATION.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra mayúscula');
    } else if (PASSWORD_VALIDATION.REQUIRE_UPPERCASE) {
      score += 1;
    }

    // Validar números
    if (PASSWORD_VALIDATION.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('La contraseña debe contener al menos un número');
    } else if (PASSWORD_VALIDATION.REQUIRE_NUMBERS) {
      score += 1;
    }

    // Validar símbolos
    if (
      PASSWORD_VALIDATION.REQUIRE_SYMBOLS &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
    ) {
      errors.push('La contraseña debe contener al menos un carácter especial');
    } else if (PASSWORD_VALIDATION.REQUIRE_SYMBOLS) {
      score += 1;
    }

    // Validar patrones prohibidos
    for (const pattern of PASSWORD_VALIDATION.FORBIDDEN_PATTERNS) {
      if (pattern.test(password)) {
        errors.push('La contraseña contiene patrones no permitidos');
        break;
      }
    }

    // Bonificaciones por longitud
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (password.length >= 20) score += 1;

    // Bonificaciones por diversidad de caracteres
    const uniqueChars = new Set(password).size;
    const diversity = uniqueChars / password.length;
    if (diversity > 0.7) score += 1;

    // Determinar nivel de fortaleza
    let strength: PasswordStrengthResult['strength'];
    if (score <= 1) strength = 'very-weak';
    else if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'fair';
    else if (score <= 6) strength = 'good';
    else if (score <= 7) strength = 'strong';
    else strength = 'very-strong';

    return {
      isValid: errors.length === 0,
      errors,
      score,
      strength,
    };
  }

  // ==============================================
  // UTILIDADES DE CONFIGURACIÓN
  // ==============================================

  /**
   * Obtener la configuración actual de Argon2
   * @returns Configuración de Argon2 (sin información sensible)
   */
  static getArgon2ConfigSummary() {
    return {
      environment: environment.app.env,
      memoryCostMB: this.config.memoryCost / 1024, // Convertir a MB
      timeCost: this.config.timeCost,
      parallelism: this.config.parallelism,
      hashLength: this.config.hashLength,
      saltLength: this.config.saltLength,
      type: 'argon2id',
    };
  }

  /**
   * Verificar la configuración del sistema crypto
   * @returns Resultado de la verificación
   */
  static verifyCryptoSetup(): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Verificar configuración de producción
    if (environment.app.isProduction) {
      if (this.config.memoryCost < 2 ** 15) {
        // Menos de 32MB
        warnings.push('Memory cost muy bajo para producción');
        recommendations.push('Incrementar memory cost a al menos 32MB (2^15)');
      }

      if (this.config.timeCost < 2) {
        warnings.push('Time cost muy bajo para producción');
        recommendations.push('Incrementar time cost a al menos 2');
      }
    }

    // Verificar disponibilidad de algoritmos
    try {
      createHash('sha256');
      createHash('sha512');
    } catch (error) {
      warnings.push('Algoritmos de hash no disponibles');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations,
    };
  }
}

// ==============================================
// EXPORTACIONES ADICIONALES
// ==============================================
export const hashPassword = CryptoUtils.hashPassword.bind(CryptoUtils);
export const verifyPassword = CryptoUtils.verifyPassword.bind(CryptoUtils);
export const validatePasswordStrength =
  CryptoUtils.validatePasswordStrength.bind(CryptoUtils);
export const generateSecureToken =
  CryptoUtils.generateSecureToken.bind(CryptoUtils);
export const generateSalt = CryptoUtils.generateSalt.bind(CryptoUtils);
export const generateSessionId =
  CryptoUtils.generateSessionId.bind(CryptoUtils);
export const generateCSRFToken =
  CryptoUtils.generateCSRFToken.bind(CryptoUtils);
export const generatePasswordResetToken =
  CryptoUtils.generatePasswordResetToken.bind(CryptoUtils);
export const generateEmailVerificationToken =
  CryptoUtils.generateEmailVerificationToken.bind(CryptoUtils);
export const createSHA256Hash = CryptoUtils.createSHA256Hash.bind(CryptoUtils);
export const createSHA512Hash = CryptoUtils.createSHA512Hash.bind(CryptoUtils);
export default CryptoUtils;
