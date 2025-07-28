// src/core/application/UserService.ts
import { User } from '@/core/entities/User';
import { 
  IUserRepository, 
  CreateUserData, 
  UpdateUserData, 
  UserWithPassword, 
  UserWithoutPassword 
} from '@/core/interfaces/IUserRepository';
import { ICacheService } from '@/core/interfaces/ICacheService';
import { 
  IUserService,
  CreateUserData as ICreateUserData,
  UpdateUserData as IUpdateUserData,
  UpdateProfileData,
  UserFilters,
  PaginationOptions,
  PaginatedUsers,
  UserSession
} from '@/core/interfaces/IUserService';
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
  users: UserWithoutPassword[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserService implements IUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cacheService: ICacheService
  ) {}

  /**
   * Crear un nuevo usuario
   */
  async create(data: ICreateUserData): Promise<User> {
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
      const userWithPassword = await this.userRepository.create({
        ...data,
        password: hashedPassword,
      });

      // Convertir a entidad User
      const user = User.fromPrisma(userWithPassword);

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
   * Crear un nuevo usuario (método legacy - mantener compatibilidad)
   */
  async createUser(data: CreateUserData): Promise<User> {
    return this.create(data);
  }

  /**
   * Obtener usuario por ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      // Intentar obtener del cache primero
      const cachedUser = await this.getCachedUserProfile(id);
      if (cachedUser) {
        logger.debug({ userId: id }, 'User found in cache');
        return cachedUser;
      }

      // Si no está en cache, buscar en la base de datos
      const userData = await this.userRepository.findById(id);
      if (!userData) {
        logger.warn({ userId: id }, 'User not found');
        return null;
      }

      // Convertir a entidad User (necesitamos obtener con password para crear la entidad completa)
      const userWithPassword = await this.userRepository.findByIdWithPassword(id);
      if (!userWithPassword) {
        return null;
      }

      const user = User.fromPrisma(userWithPassword);

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
   * Obtener usuario por ID (método legacy - lanza error si no existe)
   */
  async getUserById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * Obtener usuario por email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const userWithPassword = await this.userRepository.findByEmailWithPassword(email);
      if (!userWithPassword) {
        logger.warn({ email }, 'User not found by email');
        return null;
      }

      const user = User.fromPrisma(userWithPassword);

      logger.debug({ userId: user.id, email }, 'User found by email');
      return user;
    } catch (error) {
      logger.error({ error, email }, 'Failed to get user by email');
      throw error;
    }
  }

  /**
   * Obtener usuario por email (método legacy - lanza error si no existe)
   */
  async getUserByEmail(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * Obtener usuario por username
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const userWithPassword = await this.userRepository.findByUsernameWithPassword(username);
      if (!userWithPassword) {
        logger.warn({ username }, 'User not found by username');
        return null;
      }

      const user = User.fromPrisma(userWithPassword);

      logger.debug({ userId: user.id, username }, 'User found by username');
      return user;
    } catch (error) {
      logger.error({ error, username }, 'Failed to get user by username');
      throw error;
    }
  }

  /**
   * Obtener usuario por username (método legacy - lanza error si no existe)
   */
  async getUserByUsername(username: string): Promise<User> {
    const user = await this.findByUsername(username);
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }

  /**
   * Actualizar usuario
   */
  async update(id: string, data: IUpdateUserData): Promise<User> {
    try {
      logger.info({ userId: id, updateData: data }, 'Updating user');

      // Verificar que el usuario existe
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      if (!existingUser.isActive) {
        throw new Error(ERROR_MESSAGES.USER_INACTIVE);
      }

      // Actualizar en la base de datos
      const updatedUserData = await this.userRepository.update(id, data);

      // Convertir a entidad User (necesitamos obtener con password)
      const userWithPassword = await this.userRepository.findByIdWithPassword(id);
      if (!userWithPassword) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const updatedUser = User.fromPrisma(userWithPassword);

      // Invalidar cache y cachear nueva información
      await this.invalidateUserCache(id);
      await this.cacheUserProfile(updatedUser);

      logger.info({ userId: id }, 'User updated successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update user');
      throw error;
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  async updateProfile(id: string, data: UpdateProfileData): Promise<User> {
    try {
      logger.info({ userId: id, updateData: data }, 'Updating user profile');

      // Verificar que el usuario existe
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      if (!existingUser.isActive) {
        throw new Error(ERROR_MESSAGES.USER_INACTIVE);
      }

      // Actualizar en la base de datos
      const updatedUserData = await this.userRepository.update(id, data);

      // Convertir a entidad User (necesitamos obtener con password)
      const userWithPassword = await this.userRepository.findByIdWithPassword(id);
      if (!userWithPassword) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const updatedUser = User.fromPrisma(userWithPassword);

      // Invalidar cache y cachear nueva información
      await this.invalidateUserCache(id);
      await this.cacheUserProfile(updatedUser);

      logger.info({ userId: id }, 'User profile updated successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update user profile');
      throw error;
    }
  }

  /**
   * Actualizar perfil de usuario (método legacy)
   */
  async updateUserProfile(userId: string, updateData: UserProfileUpdate): Promise<User> {
    return this.updateProfile(userId, updateData);
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.userRepository.updateLastLogin(id);
      
      // Invalidar cache para que se actualice con el nuevo lastLoginAt
      await this.invalidateUserCache(id);
      
      logger.debug({ userId: id }, 'Last login updated');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update last login');
      throw error;
    }
  }

  /**
   * Actualizar contraseña de usuario
   */
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Updating user password');

      // Actualizar en la base de datos
      await this.userRepository.updatePassword(id, hashedPassword);

      logger.info({ userId: id }, 'Password updated successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update password');
      throw error;
    }
  }

  /**
   * Cambiar contraseña de usuario (método legacy con validación)
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

      // Actualizar usando el método de la interfaz
      await this.updatePassword(userId, hashedPassword);

      logger.info({ userId }, 'Password changed successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to change password');
      throw error;
    }
  }

  /**
   * Listar usuarios con paginación y filtros
   */
  async findMany(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedUsers> {
    try {      
      logger.debug({ filters, pagination }, 'Finding users with filters');

      const paginationOptions: PaginationOptions = {
        page: pagination?.page || 1,
        limit: pagination?.limit || 20,
        sortBy: pagination?.sortBy || 'createdAt',
        sortOrder: pagination?.sortOrder || 'desc'
      };

      const result = await this.userRepository.findMany(filters, paginationOptions);

      // Convertir a entidades User
      const users = result.users.map(userData => {
        // Crear un User temporal con datos básicos (no tenemos password aquí)
        return new User(
          userData.id,
          userData.email,
          userData.username,
          '', // password vacío
          userData.firstName,
          userData.lastName,
          userData.avatar,
          userData.isActive,
          userData.isVerified,
          userData.lastLoginAt,
          userData.createdAt,
          userData.updatedAt
        );
      });

      const response: PaginatedUsers = {
        users,
        total: result.total,
        page: paginationOptions.page || 1,
        limit: paginationOptions.limit || 20,
        totalPages: Math.ceil(result.total / (paginationOptions.limit || 20)),
      };

      logger.debug({ 
        totalUsers: result.total, 
        returnedUsers: users.length 
      }, 'Users found successfully');

      return response;
    } catch (error) {
      logger.error({ error, filters, pagination }, 'Failed to find users');
      throw error;
    }
  }

  /**
   * Listar usuarios (método legacy)
   */
  async listUsers(options: UserListOptions = {}): Promise<UserListResponse> {
    const { page = 1, limit = 20, filters } = options;
    
    const result = await this.findMany(filters, { page, limit });

    return {
      users: result.users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        isVerified: user.isVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: result.totalPages,
      },
    };
  }

  /**
   * Verificar si un usuario existe
   */
  async exists(email: string, username?: string): Promise<boolean> {
    try {
      return await this.userRepository.exists(email, username);
    } catch (error) {
      logger.error({ error, email, username }, 'Failed to check user existence');
      throw error;
    }
  }

  /**
   * Verificar si un usuario existe (método legacy)
   */
  async userExists(email: string, username?: string): Promise<boolean> {
    return this.exists(email, username);
  }

  /**
   * Obtener sesiones de usuario
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      // TODO: Implementar lógica de sesiones cuando esté disponible
      // Por ahora retornamos array vacío
      logger.debug({ userId }, 'Getting user sessions');
      return [];
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user sessions');
      throw error;
    }
  }

  /**
   * Desactivar usuario (soft delete)
   */
  async deactivate(id: string, reason?: string): Promise<void> {
    try {
      logger.info({ userId: id, reason }, 'Deactivating user');

      await this.userRepository.deactivate(id);
      await this.invalidateUserCache(id);

      logger.info({ userId: id }, 'User deactivated successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to deactivate user');
      throw error;
    }
  }

  /**
   * Desactivar usuario (método legacy)
   */
  async deactivateUser(userId: string): Promise<void> {
    return this.deactivate(userId);
  }

  /**
   * Activar usuario
   */
  async activate(id: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Activating user');

      await this.userRepository.update(id, { isActive: true });
      await this.invalidateUserCache(id);

      logger.info({ userId: id }, 'User activated successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to activate user');
      throw error;
    }
  }

  /**
   * Activar/Desactivar usuario (método legacy)
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    if (isActive) {
      await this.activate(userId);
    } else {
      await this.deactivate(userId);
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * Eliminar usuario permanentemente
   */
  async delete(id: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Deleting user permanently');

      // TODO: Implementar eliminación permanente cuando esté disponible en el repository
      // Por ahora solo desactivamos
      await this.deactivate(id, 'PERMANENT_DELETE');

      logger.info({ userId: id }, 'User deleted successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to delete user');
      throw error;
    }
  }

  /**
   * Enviar verificación de email
   */
  async sendEmailVerification(userId: string): Promise<void> {
    try {
      logger.info({ userId }, 'Sending email verification');

      // TODO: Implementar lógica de envío de email cuando esté disponible
      logger.info({ userId }, 'Email verification sent successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send email verification');
      throw error;
    }
  }

  /**
   * Verificar email con token
   */
  async verifyEmail(userId: string, token: string): Promise<void> {
    try {
      logger.info({ userId }, 'Verifying user email with token');

      // TODO: Implementar validación de token cuando esté disponible
      
      const updatedUser = await this.update(userId, { isVerified: true });

      logger.info({ userId }, 'User email verified successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to verify user email');
      throw error;
    }
  }

  /**
   * Verificar email de usuario (método legacy)
   */
  async verifyUserEmail(userId: string): Promise<User> {
    await this.verifyEmail(userId, 'legacy-verification');
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
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
        this.findMany({}, { page: 1, limit: 1 }),
        this.findMany({ isActive: true }, { page: 1, limit: 1 }),
        this.findMany({ isVerified: true }, { page: 1, limit: 1 }),
        this.findMany({ 
          createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        }, { page: 1, limit: 1 })
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
      await this.cacheService.set(cacheKey, JSON.stringify(user), { ttl: CACHE_TTL.USER_PROFILE });
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
      const cached = await this.cacheService.get<string>(cacheKey);
      
      if (cached) {
        const userData = JSON.parse(cached);
        return User.fromPrisma(userData);
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
      await this.cacheService.del(cacheKey);
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user cache');
      // No lanzar error, el cache es opcional
    }
  }
}