// ==============================================
// src/core/infrastructure/repositories/UserRepository.ts
import { PrismaClient } from '@prisma/client';
import { db } from '@/config/database';
import { logger } from '@/utils/logger';
import { User } from '@/core/domain/entities/User';
import { 
  IUserRepository, 
  CreateUserData, 
  UpdateUserData, 
  UserFilters 
} from '@/core/domain/interfaces/IUserRepository';
import { ERROR_CODES, ERROR_MESSAGES } from '@/utils/constants';

export class UserRepository implements IUserRepository {
  constructor(private database: PrismaClient = db) {}

  /**
   * Crear un nuevo usuario
   */
  async create(data: CreateUserData): Promise<User> {
    try {
      logger.info({ email: data.email, username: data.username }, 'Creating new user');
      
      const user = await this.database.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      logger.info({ userId: user.id }, 'User created successfully');
      return this.mapToEntity(user);
    } catch (error: any) {
      logger.error({ error, email: data.email }, 'Failed to create user');
      
      // Manejar errores de unicidad
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'email';
        throw new Error(`User already exists with this ${field}`);
      }
      
      throw new Error('Failed to create user');
    }
  }

  /**
   * Buscar usuario por ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      logger.debug({ userId: id }, 'Finding user by ID');
      
      const user = await this.database.user.findUnique({
        where: { id },
        include: {
          refreshTokens: {
            where: { isRevoked: false },
            orderBy: { createdAt: 'desc' },
          },
          userSessions: {
            where: { isActive: true },
            orderBy: { lastSeen: 'desc' },
          },
        },
      });

      if (!user) {
        logger.debug({ userId: id }, 'User not found');
        return null;
      }

      return this.mapToEntity(user);
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to find user by ID');
      throw new Error('Failed to retrieve user');
    }
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      logger.debug({ email }, 'Finding user by email');
      
      const user = await this.database.user.findUnique({
        where: { email },
        include: {
          refreshTokens: {
            where: { isRevoked: false },
            orderBy: { createdAt: 'desc' },
          },
          userSessions: {
            where: { isActive: true },
            orderBy: { lastSeen: 'desc' },
          },
        },
      });

      if (!user) {
        logger.debug({ email }, 'User not found by email');
        return null;
      }

      return this.mapToEntity(user);
    } catch (error) {
      logger.error({ error, email }, 'Failed to find user by email');
      throw new Error('Failed to retrieve user');
    }
  }

  /**
   * Buscar usuario por username
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      logger.debug({ username }, 'Finding user by username');
      
      const user = await this.database.user.findUnique({
        where: { username },
        include: {
          refreshTokens: {
            where: { isRevoked: false },
            orderBy: { createdAt: 'desc' },
          },
          userSessions: {
            where: { isActive: true },
            orderBy: { lastSeen: 'desc' },
          },
        },
      });

      if (!user) {
        logger.debug({ username }, 'User not found by username');
        return null;
      }

      return this.mapToEntity(user);
    } catch (error) {
      logger.error({ error, username }, 'Failed to find user by username');
      throw new Error('Failed to retrieve user');
    }
  }

  /**
   * Actualizar datos del usuario
   */
  async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      logger.info({ userId: id, updateData: data }, 'Updating user');
      
      const user = await this.database.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          refreshTokens: {
            where: { isRevoked: false },
            orderBy: { createdAt: 'desc' },
          },
          userSessions: {
            where: { isActive: true },
            orderBy: { lastSeen: 'desc' },
          },
        },
      });

      logger.info({ userId: id }, 'User updated successfully');
      return this.mapToEntity(user);
    } catch (error: any) {
      logger.error({ error, userId: id }, 'Failed to update user');
      
      if (error.code === 'P2025') {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      
      throw new Error('Failed to update user');
    }
  }

  /**
   * Actualizar último login del usuario
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      logger.debug({ userId: id }, 'Updating user last login');
      
      await this.database.user.update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.debug({ userId: id }, 'User last login updated');
    } catch (error: any) {
      logger.error({ error, userId: id }, 'Failed to update last login');
      
      if (error.code === 'P2025') {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      
      throw new Error('Failed to update last login');
    }
  }

  /**
   * Actualizar contraseña del usuario
   */
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Updating user password');
      
      await this.database.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      logger.info({ userId: id }, 'User password updated successfully');
    } catch (error: any) {
      logger.error({ error, userId: id }, 'Failed to update password');
      
      if (error.code === 'P2025') {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      
      throw new Error('Failed to update password');
    }
  }

  /**
   * Buscar múltiples usuarios con filtros y paginación
   */
  async findMany(
    filters?: UserFilters, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ users: User[]; total: number }> {
    try {
      logger.debug({ filters, limit, offset }, 'Finding multiple users');
      
      const where: any = {};
      
      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }
      
      if (filters?.isVerified !== undefined) {
        where.isVerified = filters.isVerified;
      }
      
      if (filters?.createdAfter || filters?.createdBefore) {
        where.createdAt = {};
        if (filters.createdAfter) {
          where.createdAt.gte = filters.createdAfter;
        }
        if (filters.createdBefore) {
          where.createdAt.lte = filters.createdBefore;
        }
      }

      const [users, total] = await Promise.all([
        this.database.user.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            refreshTokens: {
              where: { isRevoked: false },
              orderBy: { createdAt: 'desc' },
            },
            userSessions: {
              where: { isActive: true },
              orderBy: { lastSeen: 'desc' },
            },
          },
        }),
        this.database.user.count({ where }),
      ]);

      logger.debug({ count: users.length, total }, 'Found users');
      
      return {
        users: users.map(user => this.mapToEntity(user)),
        total,
      };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to find users');
      throw new Error('Failed to retrieve users');
    }
  }

  /**
   * Verificar si existe un usuario con email o username
   */
  async exists(email: string, username?: string): Promise<boolean> {
    try {
      logger.debug({ email, username }, 'Checking user existence');
      
      const where: any = {
        OR: [{ email }],
      };
      
      if (username) {
        where.OR.push({ username });
      }

      const count = await this.database.user.count({ where });
      
      const exists = count > 0;
      logger.debug({ email, username, exists }, 'User existence check completed');
      
      return exists;
    } catch (error) {
      logger.error({ error, email, username }, 'Failed to check user existence');
      throw new Error('Failed to check user existence');
    }
  }

  /**
   * Desactivar usuario (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    try {
      logger.info({ userId: id }, 'Deactivating user');
      
      await this.database.user.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      logger.info({ userId: id }, 'User deactivated successfully');
    } catch (error: any) {
      logger.error({ error, userId: id }, 'Failed to deactivate user');
      
      if (error.code === 'P2025') {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      
      throw new Error('Failed to deactivate user');
    }
  }

  /**
   * Eliminar usuario completamente (hard delete)
   */
  async delete(id: string): Promise<void> {
    try {
      logger.warn({ userId: id }, 'Hard deleting user');
      
      // Eliminar en transacción para mantener integridad
      await this.database.$transaction(async (tx) => {
        // Eliminar refresh tokens
        await tx.refreshToken.deleteMany({
          where: { userId: id },
        });

        // Eliminar sesiones
        await tx.userSession.deleteMany({
          where: { userId: id },
        });

        // Eliminar intentos de login
        const user = await tx.user.findUnique({
          where: { id },
          select: { email: true },
        });

        if (user) {
          await tx.loginAttempt.deleteMany({
            where: { email: user.email },
          });
        }

        // Eliminar usuario
        await tx.user.delete({
          where: { id },
        });
      });

      logger.warn({ userId: id }, 'User hard deleted successfully');
    } catch (error: any) {
      logger.error({ error, userId: id }, 'Failed to delete user');
      
      if (error.code === 'P2025') {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Mapear datos de Prisma a entidad de dominio
   */
  private mapToEntity(prismaUser: any): User {
    return new User(
      prismaUser.id,
      prismaUser.email,
      prismaUser.username,
      prismaUser.password,
      prismaUser.firstName,
      prismaUser.lastName,
      prismaUser.avatar,
      prismaUser.isActive,
      prismaUser.isVerified,
      prismaUser.lastLoginAt,
      prismaUser.createdAt,
      prismaUser.updatedAt,
      prismaUser.refreshTokens || [],
      prismaUser.userSessions || []
    );
  }

  /**
   * Método para obtener estadísticas de usuarios
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    newThisMonth: number;
  }> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [total, active, verified, newThisMonth] = await Promise.all([
        this.database.user.count(),
        this.database.user.count({ where: { isActive: true } }),
        this.database.user.count({ where: { isVerified: true } }),
        this.database.user.count({
          where: { createdAt: { gte: firstDayOfMonth } },
        }),
      ]);

      return { total, active, verified, newThisMonth };
    } catch (error) {
      logger.error({ error }, 'Failed to get user stats');
      throw new Error('Failed to retrieve user statistics');
    }
  }

  /**
   * Buscar usuarios por criterio de búsqueda (email, username, nombre)
   */
  async searchUsers(
    searchTerm: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ users: User[]; total: number }> {
    try {
      logger.debug({ searchTerm, limit, offset }, 'Searching users');
      
      const where = {
        AND: [
          { isActive: true },
          {
            OR: [
              { email: { contains: searchTerm, mode: 'insensitive' as const } },
              { username: { contains: searchTerm, mode: 'insensitive' as const } },
              { firstName: { contains: searchTerm, mode: 'insensitive' as const } },
              { lastName: { contains: searchTerm, mode: 'insensitive' as const } },
            ],
          },
        ],
      };

      const [users, total] = await Promise.all([
        this.database.user.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
            isVerified: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            // No incluir password en búsquedas
          },
        }),
        this.database.user.count({ where }),
      ]);

      return {
        users: users.map(user => this.mapToEntity({ ...user, password: '', refreshTokens: [], userSessions: [] })),
        total,
      };
    } catch (error) {
      logger.error({ error, searchTerm }, 'Failed to search users');
      throw new Error('Failed to search users');
    }
  }
}