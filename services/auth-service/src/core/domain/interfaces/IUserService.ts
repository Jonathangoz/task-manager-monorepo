// src/core/domain/interfaces/IUserService.ts
import { User } from '@/core/entities/User';

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

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UserFilters {
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserSession {
  id: string;
  sessionId: string;
  userId: string;
  device?: string;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
  isActive: boolean;
  lastSeen: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IUserService {
  // Crear usuario
  create(data: CreateUserData): Promise<User>;
  
  // Buscar usuarios
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  
  // Actualizar usuario
  update(id: string, data: UpdateUserData): Promise<User>;
  updateProfile(id: string, data: UpdateProfileData): Promise<User>;
  updateLastLogin(id: string): Promise<void>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
  
  // Listar usuarios con paginación
  findMany(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedUsers>;
  
  // Verificar existencia
  exists(email: string, username?: string): Promise<boolean>;
  
  // Sesiones
  getUserSessions(userId: string): Promise<UserSession[]>;
  
  // Eliminar usuario (soft delete)
  deactivate(id: string, reason?: string): Promise<void>;
  activate(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Email verification
  sendEmailVerification(userId: string): Promise<void>;
  verifyEmail(userId: string, token: string): Promise<void>;
}