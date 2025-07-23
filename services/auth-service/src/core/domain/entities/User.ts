// src/core/domain/entities/User.ts
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
    public readonly updatedAt: Date = new Date()
  ) {}

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

  // Método para verificar si el usuario puede hacer login
  canLogin(): boolean {
    return this.isActive && this.isVerified;
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
      new Date(),
      this.createdAt,
      new Date()
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
      new Date()
    );
  }
}