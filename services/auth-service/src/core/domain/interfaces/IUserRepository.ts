// src/core/domain/interfaces/IUserRepository.ts
import {
  UserSession,
  UserFilters,
  PaginationOptions,
  PaginatedUsers,
} from './IUserService';

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

// Tipo específico para datos de usuario con password (para autenticación)
export interface UserWithPassword {
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
}

// Tipo para datos de usuario sin password (para la mayoría de operaciones)
export interface UserWithoutPassword {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {
  // Crear usuario
  create(data: CreateUserData): Promise<UserWithPassword>;

  // Buscar usuarios - versiones sin password para uso general
  findById(id: string): Promise<UserWithoutPassword | null>;
  findByEmail(email: string): Promise<UserWithoutPassword | null>;
  findByUsername(username: string): Promise<UserWithoutPassword | null>;

  // Buscar usuarios - versiones con password para autenticación
  findByIdWithPassword(id: string): Promise<UserWithPassword | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  findByUsernameWithPassword(
    username: string,
  ): Promise<UserWithPassword | null>;

  // Actualizar usuario
  update(id: string, data: UpdateUserData): Promise<UserWithoutPassword>;
  updateLastLogin(id: string): Promise<void>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;

  // Listar usuarios con paginación
  findMany(
    filters?: UserFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedUsers>;

  // Verificar existencia
  exists(email: string, username?: string): Promise<boolean>;

  // Sesiones
  getUserSessions(userId: string): Promise<UserSession[]>;

  // Eliminar usuario (soft delete)
  deactivate(id: string): Promise<void>;
  activate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
