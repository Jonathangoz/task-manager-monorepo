// src/core/application/UserService.ts

import { User } from '@/core/domain/entities/User';
import { IUserRepository, CreateUserData, UpdateUserData, UserFilters } from '@/core/domain/interfaces/IUserRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { hashPassword, validatePasswordStrength } from '@/utils/crypto';
import { logger } from '@/utils/logger';
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  SECURITY_CONFIG,
  CACHE_KEYS,
  CACHE_TTL 
} from '@/utils/constants';

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UserListOptions {
  page?: number;
  limit?: number;
  filters?: UserFilters;
}

export interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cacheService: ICacheService
  ) {}

  /**
   * Crear un nuevo usuario
   */
  async createUser(data: CreateUserData): Promise<User> {
    try {
      logger.info({ email: data.email, username: data.username }, 'Creating new user');

      // Validar que el email y username no existan
      const userExists = await this.userRepository.exists(data.email, data.username);
      if (userExists) {
        logger.warn({ email: data.email, username: data.username }, 'User already exists');
        throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }

      // Validar fortaleza de la contraseña
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        logger.warn({ errors: passwordValidation.errors }, 'Password validation failed');
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Hashear la contraseña
      const hashedPassword = await hashPassword(data.password);

      // Crear el usuario en la base de datos
      const user = await this.userRepository.create({
        ...data,
        password: hashedPassword,
      });

      logger.info({ userId: user.id, email: user.email }, 'User created successfully');

      // Cachear el perfil del usuario
      await this.cacheUserProfile(user);

      return user;
    } catch (error) {
      logger.error({ error, email: data.email }, 'Failed to create user');
      throw error;
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id: string): Promise<User> {
    try {
      // Intentar obtener del cache primero
      const cachedUser = await this.getCachedUserProfile(id);
      if (cachedUser) {
        logger.debug({ userId: id }, 'User found in cache');
        return cachedUser;
      }

      // Si no está en cache, buscar en la base de datos
      const user = await this.userRepository.findById(id);
      if (!user) {
        logger.warn({ userId: id }, 'User not found');
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Cachear el resultado
      await this.cacheUserProfile(user);

      logger.debug({ userId: id }, 'User found in database');
      return user;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to get user by ID');
      throw error;
    }
  }

  /**
   * Obtener usuario por email
   */
  async getUserByEmail(email: string): Promise<User> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        logger.warn({ email }, 'User not found by email');
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      logger.debug({ userId: user.id, email }, 'User found by email');
      return user;
    } catch (error) {
      logger.error({ error, email }, 'Failed to get user by email');
      throw error;
    }
  }

  /**
   * Obtener usuario por username
   */
  async getUserByUsername(username: string): Promise<User> {
    try {
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        logger.warn({ username }, 'User not found by username');
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      logger.debug({ userId: user.id, username }, 'User found by username');
      return user;
    } catch (error) {
      logger.error({ error, username }, 'Failed to get user by username');
      throw error;
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  async updateUserProfile(userId: string, updateData: UserProfileUpdate): Promise<User> {
    try {
      logger.info({ userId, updateData }, 'Updating user profile');

      // Verificar que el usuario existe
      const existingUser = await this.getUserById(userId);
      if (!existingUser.isActive) {
        throw new Error(ERROR_MESSAGES.USER_INACTIVE);
      }

      // Actualizar en la base de datos
      const updatedUser = await this.userRepository.update(userId, updateData);

      // Invalidar cache y cachear nueva información
      await this.invalidateUserCache(userId);
      await this.cacheUserProfile(updatedUser);

      logger.info({ userId }, 'User profile updated successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update user profile');
      throw error;
    }
  }

  /**
   * Cambiar contraseña de usuario
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    try {
      logger.info({ userId }, 'Changing user password');

      // Validar fortaleza de la nueva contraseña
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        logger.warn({ userId, errors: passwordValidation.errors }, 'New password validation failed');
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Hashear la nueva contraseña
      const hashedPassword = await hashPassword(newPassword);

      // Actualizar en la base de datos
      await this.userRepository.updatePassword(userId, hashedPassword);

      logger.info({ userId }, 'Password changed successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to change password');
      throw error;
    }
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.userRepository.updateLastLogin(userId);
      
      // Invalidar cache para que se actualice con el nuevo lastLoginAt
      await this.invalidateUserCache(userId);
      
      logger.debug({ userId }, 'Last login updated');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to update last login');
      throw error;
    }
  }

  /**
   * Activar/Desactivar usuario
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    try {
      logger.info({ userId, isActive }, 'Toggling user status');

      const updatedUser = await this.userRepository.update(userId, { isActive });

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheUserProfile(updatedUser);

      logger.info({ userId, isActive }, 'User status updated successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to toggle user status');
      throw error;
    }
  }

  /**
   * Verificar email de usuario
   */
  async verifyUserEmail(userId: string): Promise<User> {
    try {
      logger.info({ userId }, 'Verifying user email');

      const updatedUser = await this.userRepository.update(userId, { isVerified: true });

      // Invalidar cache
      await this.invalidateUserCache(userId);
      await this.cacheUserProfile(updatedUser);

      logger.info({ userId }, 'User email verified successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to verify user email');
      throw error;
    }
  }

  /**
   * Listar usuarios con paginación y filtros
   */
  async listUsers(options: UserListOptions = {}): Promise<UserListResponse> {
    try {
      const { page = 1, limit = 20, filters } = options;
      const offset = (page - 1) * limit;

      logger.debug({ page, limit, filters }, 'Listing users');

      const result = await this.userRepository.findMany(filters, limit, offset);

      const response: UserListResponse = {
        users: result.users,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      };

      logger.debug({ 
        totalUsers: result.total, 
        returnedUsers: result.users.length 
      }, 'Users listed successfully');

      return response;
    } catch (error) {
      logger.error({ error, options }, 'Failed to list users');
      throw error;
    }
  }

  /**
   * Desactivar usuario (soft delete)
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      logger.info({ userId }, 'Deactivating user');

      await this.userRepository.deactivate(userId);
      await this.invalidateUserCache(userId);

      logger.info({ userId }, 'User deactivated successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to deactivate user');
      throw error;
    }
  }

  /**
   * Verificar si un usuario existe
   */
  async userExists(email: string, username?: string): Promise<boolean> {
    try {
      return await this.userRepository.exists(email, username);
    } catch (error) {
      logger.error({ error, email, username }, 'Failed to check user existence');
      throw error;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    recentRegistrations: number;
  }> {
    try {
      const [
        totalResult,
        activeResult,
        verifiedResult,
        recentResult
      ] = await Promise.all([
        this.userRepository.findMany({}, 1, 0),
        this.userRepository.findMany({ isActive: true }, 1, 0),
        this.userRepository.findMany({ isVerified: true }, 1, 0),
        this.userRepository.findMany({ 
          createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        }, 1, 0)
      ]);

      const stats = {
        total: totalResult.total,
        active: activeResult.total,
        verified: verifiedResult.total,
        recentRegistrations: recentResult.total,
      };

      logger.debug(stats, 'User statistics retrieved');
      return stats;
    } catch (error) {
      logger.error({ error }, 'Failed to get user statistics');
      throw error;
    }
  }

  // ==============================================
  // Métodos privados para manejo de cache
  // ==============================================

  /**
   * Cachear perfil de usuario
   */
  private async cacheUserProfile(user: User): Promise<void> {
    try {
      const cacheKey = CACHE_KEYS.USER_PROFILE(user.id);
      await this.cacheService.set(cacheKey, JSON.stringify(user), CACHE_TTL.USER_PROFILE);
    } catch (error) {
      logger.warn({ error, userId: user.id }, 'Failed to cache user profile');
      // No lanzar error, el cache es opcional
    }
  }

  /**
   * Obtener perfil de usuario del cache
   */
  private async getCachedUserProfile(userId: string): Promise<User | null> {
    try {
      const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as User;
      }
      
      return null;
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to get cached user profile');
      return null;
    }
  }

  /**
   * Invalidar cache de usuario
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
      await this.cacheService.delete(cacheKey);
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user cache');
      // No lanzar error, el cache es opcional
    }
  }
}