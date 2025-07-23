// src/core/domain/interfaces/IUserRepository.ts
import { User } from '../entities/User';

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

export interface UserFilters {
  isActive?: boolean;
  isVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface IUserRepository {
  // Crear usuario
  create(data: CreateUserData): Promise<User>;
  
  // Buscar usuarios
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  
  // Actualizar usuario
  update(id: string, data: UpdateUserData): Promise<User>;
  updateLastLogin(id: string): Promise<void>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
  
  // Listar usuarios con paginación
  findMany(filters?: UserFilters, limit?: number, offset?: number): Promise<{
    users: User[];
    total: number;
  }>;
  
  // Verificar existencia
  exists(email: string, username?: string): Promise<boolean>;
  
  // Eliminar usuario (soft delete)
  deactivate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}