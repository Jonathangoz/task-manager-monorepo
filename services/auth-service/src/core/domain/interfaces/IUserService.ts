// src/core/interfaces/IUserService.ts
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

  // Buscar usuarios - retornan null si no se encuentra
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;

  // Actualizar usuario
  update(id: string, data: UpdateUserData): Promise<User>;
  updateProfile(id: string, data: UpdateProfileData): Promise<User>;
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

  // Gestión de estado del usuario
  deactivate(id: string, reason?: string): Promise<void>;
  activate(id: string): Promise<void>;
  delete(id: string): Promise<void>;

  // Email verification
  sendEmailVerification(userId: string): Promise<void>;
  verifyEmail(userId: string, token: string): Promise<void>;

  // Métodos legacy (para compatibilidad hacia atrás) - lanzan errores si no encuentran
  createUser?(data: CreateUserData): Promise<User>;
  getUserById?(id: string): Promise<User>;
  getUserByEmail?(email: string): Promise<User>;
  getUserByUsername?(username: string): Promise<User>;
  updateUserProfile?(id: string, data: UpdateProfileData): Promise<User>;
  changePassword?(userId: string, newPassword: string): Promise<void>;
  userExists?(email: string, username?: string): Promise<boolean>;
  deactivateUser?(userId: string): Promise<void>;
  toggleUserStatus?(userId: string, isActive: boolean): Promise<User>;
  verifyUserEmail?(userId: string): Promise<User>;
  listUsers?(options?: {
    page?: number;
    limit?: number;
    filters?: UserFilters;
  }): Promise<{
    users: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>;
  getUserStats?(): Promise<{
    total: number;
    active: number;
    verified: number;
    recentRegistrations: number;
  }>;
}
