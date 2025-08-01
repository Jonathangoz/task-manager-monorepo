// src/core/domain/entities/User.ts
import {
  VALIDATION_PATTERNS,
  SECURITY_CONFIG,
  ERROR_CODES,
} from '@/utils/constants';

export class UserValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'UserValidationError';
  }
}

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly username: string,
    private _password: string,
    public readonly firstName: string | null = null,
    public readonly lastName: string | null = null,
    public readonly avatar: string | null = null,
    public readonly isActive: boolean = true,
    public readonly isVerified: boolean = false,
    public readonly lastLoginAt: Date | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    this.validateUser();
  }

  // Validación completa del usuario
  private validateUser(): void {
    this.validateEmail();
    this.validateUsername();
    this.validatePassword();
    this.validateNames();
  }

  // Validar email según las constantes
  private validateEmail(): void {
    if (!this.email) {
      throw new UserValidationError(
        'Email es requerido',
        ERROR_CODES.INVALID_EMAIL,
        'email',
      );
    }

    if (!VALIDATION_PATTERNS.EMAIL.test(this.email)) {
      throw new UserValidationError(
        'Formato de email inválido',
        ERROR_CODES.INVALID_EMAIL,
        'email',
      );
    }

    if (this.email.length > SECURITY_CONFIG.EMAIL_MAX_LENGTH) {
      throw new UserValidationError(
        `Email no puede exceder ${SECURITY_CONFIG.EMAIL_MAX_LENGTH} caracteres`,
        ERROR_CODES.INVALID_EMAIL,
        'email',
      );
    }
  }

  // Validar username según las constantes
  private validateUsername(): void {
    if (!this.username) {
      throw new UserValidationError(
        'Username es requerido',
        ERROR_CODES.INVALID_USERNAME,
        'username',
      );
    }

    if (this.username.length < SECURITY_CONFIG.USERNAME_MIN_LENGTH) {
      throw new UserValidationError(
        `Username debe tener al menos ${SECURITY_CONFIG.USERNAME_MIN_LENGTH} caracteres`,
        ERROR_CODES.INVALID_USERNAME,
        'username',
      );
    }

    if (this.username.length > SECURITY_CONFIG.USERNAME_MAX_LENGTH) {
      throw new UserValidationError(
        `Username no puede exceder ${SECURITY_CONFIG.USERNAME_MAX_LENGTH} caracteres`,
        ERROR_CODES.INVALID_USERNAME,
        'username',
      );
    }

    if (!VALIDATION_PATTERNS.USERNAME.test(this.username)) {
      throw new UserValidationError(
        'Username solo puede contener letras, números y guiones bajos',
        ERROR_CODES.INVALID_USERNAME,
        'username',
      );
    }
  }

  // Validar password (solo longitud, el hash se valida externamente)
  private validatePassword(): void {
    if (!this._password) {
      throw new UserValidationError(
        'Password es requerido',
        ERROR_CODES.INVALID_PASSWORD,
        'password',
      );
    }

    // Para passwords hasheados, esta validación puede ser diferente
    // Si es un hash, típicamente será más largo que el mínimo
    if (
      this._password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH &&
      !this.isPasswordHashed()
    ) {
      throw new UserValidationError(
        `Password debe tener al menos ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} caracteres`,
        ERROR_CODES.PASSWORD_TOO_WEAK,
        'password',
      );
    }
  }

  // Validar nombres opcionales
  private validateNames(): void {
    if (this.firstName && this.firstName.trim().length === 0) {
      throw new UserValidationError(
        'First name no puede estar vacío',
        ERROR_CODES.VALIDATION_ERROR,
        'firstName',
      );
    }

    if (this.lastName && this.lastName.trim().length === 0) {
      throw new UserValidationError(
        'Last name no puede estar vacío',
        ERROR_CODES.VALIDATION_ERROR,
        'lastName',
      );
    }
  }

  // Verificar si el password está hasheado (heurística simple)
  private isPasswordHashed(): boolean {
    // Argon2 hashes típicamente empiezan con $argon2
    // bcrypt hashes empiezan con $2a$, $2b$, etc.
    return (
      this._password.startsWith('$argon2') ||
      this._password.startsWith('$2a$') ||
      this._password.startsWith('$2b$') ||
      this._password.length > 50
    ); // Los hashes son típicamente largos
  }

  // Método para obtener el nombre completo
  get fullName(): string {
    if (!this.firstName && !this.lastName) return this.username;
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  // Método para obtener información pública del usuario (sin password)
  toPublic(): Omit<User, '_password'> {
    const { _password, ...publicData } = this;
    return publicData as Omit<User, '_password'>;
  }

  // Método para serializar a JSON (excluye password automáticamente)
  toJSON(): Omit<User, '_password'> {
    return this.toPublic();
  }

  // Método para obtener datos básicos del usuario
  toBasicInfo(): {
    id: string;
    email: string;
    username: string;
    fullName: string;
    avatar: string | null;
    isActive: boolean;
    isVerified: boolean;
  } {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
      avatar: this.avatar,
      isActive: this.isActive,
      isVerified: this.isVerified,
    };
  }

  // Método para verificar si el usuario puede hacer login
  canLogin(): boolean {
    return this.isActive && this.isVerified;
  }

  // Método para verificar si el usuario está activo
  get isActiveUser(): boolean {
    return this.isActive;
  }

  // Método para verificar si el usuario está verificado
  get isVerifiedUser(): boolean {
    return this.isVerified;
  }

  // Método para verificar si es un usuario nuevo (menos de 24 horas)
  get isNewUser(): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
  }

  // Método para verificar si ha hecho login recientemente
  hasRecentLogin(hours: number = 24): boolean {
    if (!this.lastLoginAt) return false;
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.lastLoginAt > hoursAgo;
  }

  // Método para actualizar el último login
  updateLastLogin(): User {
    return new User(
      this.id,
      this.email,
      this.username,
      this._password,
      this.firstName,
      this.lastName,
      this.avatar,
      this.isActive,
      this.isVerified,
      new Date(), // lastLoginAt
      this.createdAt,
      new Date(), // updatedAt
    );
  }

  // Método para crear una copia con datos actualizados
  update(data: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    isActive?: boolean;
    isVerified?: boolean;
  }): User {
    return new User(
      this.id,
      this.email,
      this.username,
      this._password,
      data.firstName !== undefined ? data.firstName : this.firstName,
      data.lastName !== undefined ? data.lastName : this.lastName,
      data.avatar !== undefined ? data.avatar : this.avatar,
      data.isActive !== undefined ? data.isActive : this.isActive,
      data.isVerified !== undefined ? data.isVerified : this.isVerified,
      this.lastLoginAt,
      this.createdAt,
      new Date(),
    );
  }

  // Método para activar el usuario
  activate(): User {
    if (this.isActive) return this;
    return this.update({ isActive: true });
  }

  // Método para desactivar el usuario
  deactivate(): User {
    if (!this.isActive) return this;
    return this.update({ isActive: false });
  }

  // Método para verificar el usuario
  verify(): User {
    if (this.isVerified) return this;
    return this.update({ isVerified: true });
  }

  // Método para actualizar el avatar
  updateAvatar(avatarUrl: string | null): User {
    return this.update({ avatar: avatarUrl });
  }

  // Método para actualizar el perfil
  updateProfile(data: {
    firstName?: string | null;
    lastName?: string | null;
  }): User {
    return this.update(data);
  }

  // Método estático para crear un usuario desde datos de Prisma
  static fromPrisma(userData: {
    id: string;
    email: string;
    username: string;
    password: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      userData.id,
      userData.email,
      userData.username,
      userData.password,
      userData.firstName,
      userData.lastName,
      userData.avatar,
      userData.isActive,
      userData.isVerified,
      userData.lastLoginAt,
      userData.createdAt,
      userData.updatedAt,
    );
  }

  // Método para convertir a datos de Prisma
  toPrisma(): {
    id: string;
    email: string;
    username: string;
    password: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      password: this._password,
      firstName: this.firstName,
      lastName: this.lastName,
      avatar: this.avatar,
      isActive: this.isActive,
      isVerified: this.isVerified,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// Tipos adicionales para mayor type safety
export type UserPublicData = Omit<User, '_password'>;
export type UserBasicInfo = ReturnType<User['toBasicInfo']>;
export type UserUpdateData = Parameters<User['update']>[0];
export type UserProfileData = Parameters<User['updateProfile']>[0];
