// src/core/domain/interfaces/IUserRepository.ts
import { User } from '@/core/entities/User';
import { UserSession, UserFilters, PaginationOptions, PaginatedUsers } from './IUserService';

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
  findMany(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedUsers>;
  
  // Verificar existencia
  exists(email: string, username?: string): Promise<boolean>;
  
  // Sesiones
  getUserSessions(userId: string): Promise<UserSession[]>;
  
  // Eliminar usuario (soft delete)
  deactivate(id: string): Promise<void>;
  activate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}