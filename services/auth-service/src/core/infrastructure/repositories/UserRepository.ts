// src/core/infrastructure/repositories/UserRepository.ts - Repositorio de usuarios con logging estructurado y manejo de errores
import { PrismaClient } from '@prisma/client';
import { db } from '@/config/database';
import { loggers, dbLogger } from '@/utils/logger';
import { User } from '@/core/entities/User';
import {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
  UserWithPassword,
  UserWithoutPassword,
} from '@/core/domain/interfaces/IUserRepository';
import {
  UserFilters,
  PaginationOptions,
  PaginatedUsers,
  UserSession,
} from '@/core/domain/interfaces/IUserService';
import {
  ERROR_MESSAGES,
  PRISMA_ERROR_CODES,
  DEFAULT_VALUES,
} from '@/utils/constants';

// Tipos específicos para manejo de errores de Prisma
interface PrismaError extends Error {
  code?: string;
  meta?: {
    target?: string[];
    [key: string]: unknown;
  };
}

// Tipo para sesiones de Prisma
interface PrismaUserSession {
  id: string;
  sessionId: string | null;
  userId: string;
  device: string | null;
  ipAddress: string | null;
  location: string | null;
  userAgent: string | null;
  isActive: boolean;
  lastSeen: Date;
  createdAt: Date;
  expiresAt: Date;
}

export class UserRepository implements IUserRepository {
  constructor(private database: PrismaClient = db) {}

  /**
   * Crear un nuevo usuario
   */
  async create(data: CreateUserData): Promise<UserWithPassword> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        {
          operation: 'create',
          table: 'user',
          email: data.email,
          username: data.username,
        },
        'Creating new user',
      );

      const user = await this.database.user.create({
        data: {
          email: data.email.toLowerCase(),
          username: data.username,
          password: data.password,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('create', 'user', duration, user.id);

      dbLogger.info(
        {
          userId: user.id,
          email: data.email,
          duration,
        },
        'User created successfully',
      );

      return this.mapToUserWithPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'create', 'user');

      dbLogger.error(
        {
          error,
          email: data.email,
          username: data.username,
          duration,
        },
        'Failed to create user',
      );

      // Manejar errores específicos de Prisma
      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION) {
        const target = prismaError.meta?.target;
        if (target?.includes('email') || target?.includes('username')) {
          throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por ID (sin password)
   */
  async findById(id: string): Promise<UserWithoutPassword | null> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        { userId: id, operation: 'findById' },
        'Finding user by ID',
      );

      const user = await this.database.user.findUnique({
        where: { id },
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
          // password: false - explícitamente excluido
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration, id);

      if (!user) {
        dbLogger.debug({ userId: id, duration }, 'User not found by ID');
        return null;
      }

      dbLogger.debug({ userId: id, duration }, 'User found by ID');
      return this.mapToUserWithoutPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'findById',
        },
        'Failed to find user by ID',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por ID (con password para autenticación)
   */
  async findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        { userId: id, operation: 'findByIdWithPassword' },
        'Finding user by ID with password',
      );

      const user = await this.database.user.findUnique({
        where: { id },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration, id);

      if (!user) {
        dbLogger.debug({ userId: id, duration }, 'User not found by ID');
        return null;
      }

      dbLogger.debug(
        { userId: id, duration },
        'User found by ID with password',
      );
      return this.mapToUserWithPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'findByIdWithPassword',
        },
        'Failed to find user by ID with password',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por email (sin password)
   */
  async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();

    try {
      dbLogger.debug(
        {
          email: normalizedEmail,
          operation: 'findByEmail',
        },
        'Finding user by email',
      );

      const user = await this.database.user.findUnique({
        where: { email: normalizedEmail },
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
          // password: false - explícitamente excluido
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration);

      if (!user) {
        dbLogger.debug(
          {
            email: normalizedEmail,
            duration,
          },
          'User not found by email',
        );
        return null;
      }

      dbLogger.debug(
        {
          userId: user.id,
          email: normalizedEmail,
          duration,
        },
        'User found by email',
      );

      return this.mapToUserWithoutPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user');

      dbLogger.error(
        {
          error,
          email: normalizedEmail,
          duration,
          operation: 'findByEmail',
        },
        'Failed to find user by email',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por email (con password para autenticación)
   */
  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();

    try {
      dbLogger.debug(
        {
          email: normalizedEmail,
          operation: 'findByEmailWithPassword',
        },
        'Finding user by email with password',
      );

      const user = await this.database.user.findUnique({
        where: { email: normalizedEmail },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration);

      if (!user) {
        dbLogger.debug(
          {
            email: normalizedEmail,
            duration,
          },
          'User not found by email',
        );
        return null;
      }

      dbLogger.debug(
        {
          userId: user.id,
          email: normalizedEmail,
          duration,
        },
        'User found by email with password',
      );

      return this.mapToUserWithPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user');

      dbLogger.error(
        {
          error,
          email: normalizedEmail,
          duration,
          operation: 'findByEmailWithPassword',
        },
        'Failed to find user by email with password',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por username (sin password)
   */
  async findByUsername(username: string): Promise<UserWithoutPassword | null> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        {
          username,
          operation: 'findByUsername',
        },
        'Finding user by username',
      );

      const user = await this.database.user.findUnique({
        where: { username },
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
          // password: false - explícitamente excluido
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration);

      if (!user) {
        dbLogger.debug(
          {
            username,
            duration,
          },
          'User not found by username',
        );
        return null;
      }

      dbLogger.debug(
        {
          userId: user.id,
          username,
          duration,
        },
        'User found by username',
      );

      return this.mapToUserWithoutPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user');

      dbLogger.error(
        {
          error,
          username,
          duration,
          operation: 'findByUsername',
        },
        'Failed to find user by username',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar usuario por username (con password para autenticación)
   */
  async findByUsernameWithPassword(
    username: string,
  ): Promise<UserWithPassword | null> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        {
          username,
          operation: 'findByUsernameWithPassword',
        },
        'Finding user by username with password',
      );

      const user = await this.database.user.findUnique({
        where: { username },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findUnique', 'user', duration);

      if (!user) {
        dbLogger.debug(
          {
            username,
            duration,
          },
          'User not found by username',
        );
        return null;
      }

      dbLogger.debug(
        {
          userId: user.id,
          username,
          duration,
        },
        'User found by username with password',
      );

      return this.mapToUserWithPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findUnique', 'user');

      dbLogger.error(
        {
          error,
          username,
          duration,
          operation: 'findByUsernameWithPassword',
        },
        'Failed to find user by username with password',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Actualizar datos del usuario
   */
  async update(id: string, data: UpdateUserData): Promise<UserWithoutPassword> {
    const startTime = Date.now();

    try {
      dbLogger.info(
        {
          userId: id,
          updateFields: Object.keys(data),
          operation: 'update',
        },
        'Updating user',
      );

      const user = await this.database.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
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
          // password: false - explícitamente excluido
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('update', 'user', duration, id);

      dbLogger.info(
        {
          userId: id,
          updatedFields: Object.keys(data),
          duration,
        },
        'User updated successfully',
      );

      return this.mapToUserWithoutPassword(user);
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'update', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          updateData: data,
          duration,
          operation: 'update',
        },
        'Failed to update user',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      if (prismaError.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION) {
        const target = prismaError.meta?.target;
        if (target?.includes('email') || target?.includes('username')) {
          throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Actualizar último login del usuario
   */
  async updateLastLogin(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        {
          userId: id,
          operation: 'updateLastLogin',
        },
        'Updating user last login',
      );

      await this.database.user.update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('update', 'user', duration, id);

      dbLogger.debug(
        {
          userId: id,
          duration,
        },
        'User last login updated',
      );
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'update', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'updateLastLogin',
        },
        'Failed to update last login',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Actualizar contraseña del usuario
   */
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    const startTime = Date.now();

    try {
      dbLogger.info(
        {
          userId: id,
          operation: 'updatePassword',
        },
        'Updating user password',
      );

      await this.database.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('update', 'user', duration, id);

      dbLogger.info(
        {
          userId: id,
          duration,
        },
        'User password updated successfully',
      );

      // Log de seguridad
      loggers.passwordChanged(id, '', ''); // Email se obtendría en el servicio
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'update', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'updatePassword',
        },
        'Failed to update password',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Buscar múltiples usuarios con filtros y paginación
   */
  async findMany(
    filters?: UserFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedUsers> {
    const startTime = Date.now();

    try {
      const limit = Math.min(
        pagination?.limit || DEFAULT_VALUES.PAGINATION_LIMIT,
        DEFAULT_VALUES.PAGINATION_MAX_LIMIT,
      );
      const page = Math.max(pagination?.page || 1, 1);
      const offset = (page - 1) * limit;

      dbLogger.debug(
        {
          filters,
          pagination: { ...pagination, limit, page },
          operation: 'findMany',
        },
        'Finding multiple users',
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      // Aplicar filtros
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

      // Filtro de búsqueda por texto
      if (filters?.search) {
        const searchTerm = filters.search.trim();
        if (searchTerm) {
          where.OR = [
            { email: { contains: searchTerm, mode: 'insensitive' as const } },
            {
              username: { contains: searchTerm, mode: 'insensitive' as const },
            },
            {
              firstName: { contains: searchTerm, mode: 'insensitive' as const },
            },
            {
              lastName: { contains: searchTerm, mode: 'insensitive' as const },
            },
          ];
        }
      }

      // Configurar ordenamiento
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderBy: any = { createdAt: 'desc' };
      if (pagination?.sortBy) {
        const validSortFields = [
          'createdAt',
          'updatedAt',
          'email',
          'username',
          'lastLoginAt',
        ];
        if (validSortFields.includes(pagination.sortBy)) {
          orderBy = { [pagination.sortBy]: pagination.sortOrder || 'asc' };
        }
      }

      const [users, total] = await Promise.all([
        this.database.user.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy,
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
            // Excluir password explícitamente
          },
        }),
        this.database.user.count({ where }),
      ]);

      const duration = Date.now() - startTime;
      loggers.dbQuery('findMany', 'user', duration);

      dbLogger.debug(
        {
          count: users.length,
          total,
          page,
          limit,
          duration,
        },
        'Found users',
      );

      const totalPages = Math.ceil(total / limit);

      // Mapear usuarios sin password
      const mappedUsers = users.map((user) =>
        User.fromPrisma({
          ...user,
          password: '', // Password vacío para listados
        }),
      );

      return {
        users: mappedUsers,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findMany', 'user');

      dbLogger.error(
        {
          error,
          filters,
          pagination,
          duration,
          operation: 'findMany',
        },
        'Failed to find users',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Verificar si existe un usuario con email o username
   */
  async exists(email: string, username?: string): Promise<boolean> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();

    try {
      dbLogger.debug(
        {
          email: normalizedEmail,
          username,
          operation: 'exists',
        },
        'Checking user existence',
      );

      const where: any = {
        OR: [{ email: normalizedEmail }],
      };

      if (username) {
        where.OR.push({ username });
      }

      const count = await this.database.user.count({ where });

      const duration = Date.now() - startTime;
      loggers.dbQuery('count', 'user', duration);

      const exists = count > 0;

      dbLogger.debug(
        {
          email: normalizedEmail,
          username,
          exists,
          duration,
        },
        'User existence check completed',
      );

      return exists;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'count', 'user');

      dbLogger.error(
        {
          error,
          email: normalizedEmail,
          username,
          duration,
          operation: 'exists',
        },
        'Failed to check user existence',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Obtener sesiones activas del usuario
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const startTime = Date.now();

    try {
      dbLogger.debug(
        {
          userId,
          operation: 'getUserSessions',
        },
        'Getting user sessions',
      );

      const sessions = await this.database.userSession.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: { lastSeen: 'desc' },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('findMany', 'userSession', duration, userId);

      dbLogger.debug(
        {
          userId,
          sessionCount: sessions.length,
          duration,
        },
        'User sessions retrieved',
      );

      return sessions.map((session: PrismaUserSession) => ({
        id: session.id,
        sessionId: session.sessionId || session.id, // Fallback si no existe sessionId
        userId: session.userId,
        device: session.device || undefined,
        ipAddress: session.ipAddress || undefined,
        location: session.location || undefined,
        userAgent: session.userAgent || undefined,
        isActive: session.isActive,
        lastSeen: session.lastSeen,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      }));
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'findMany', 'userSession', userId);

      dbLogger.error(
        {
          error,
          userId,
          duration,
          operation: 'getUserSessions',
        },
        'Failed to get user sessions',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Desactivar usuario (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      dbLogger.info(
        {
          userId: id,
          operation: 'deactivate',
        },
        'Deactivating user',
      );

      await this.database.user.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('update', 'user', duration, id);

      dbLogger.info(
        {
          userId: id,
          duration,
        },
        'User deactivated successfully',
      );
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'update', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'deactivate',
        },
        'Failed to deactivate user',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Activar usuario
   */
  async activate(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      dbLogger.info(
        {
          userId: id,
          operation: 'activate',
        },
        'Activating user',
      );

      await this.database.user.update({
        where: { id },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('update', 'user', duration, id);

      dbLogger.info(
        {
          userId: id,
          duration,
        },
        'User activated successfully',
      );
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'update', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'activate',
        },
        'Failed to activate user',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Eliminar usuario completamente (hard delete)
   */
  async delete(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      dbLogger.warn(
        {
          userId: id,
          operation: 'delete',
        },
        'Hard deleting user',
      );

      // Eliminar en transacción para mantener integridad referencial
      await this.database.$transaction(async (tx) => {
        // Obtener email del usuario para eliminar loginAttempts
        const user = await tx.user.findUnique({
          where: { id },
          select: { email: true },
        });

        if (!user) {
          throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        // Eliminar refresh tokens
        await tx.refreshToken.deleteMany({
          where: { userId: id },
        });

        // Eliminar sesiones de usuario
        await tx.userSession.deleteMany({
          where: { userId: id },
        });

        // Eliminar intentos de login por email
        await tx.loginAttempt.deleteMany({
          where: { email: user.email },
        });

        // Eliminar tokens de verificación/reset si existen en tu schema
        // await tx.verificationToken.deleteMany({
        //   where: { userId: id },
        // });

        // Finalmente eliminar el usuario
        await tx.user.delete({
          where: { id },
        });
      });

      const duration = Date.now() - startTime;
      loggers.dbQuery('delete', 'user', duration, id);

      dbLogger.warn(
        {
          userId: id,
          duration,
        },
        'User hard deleted successfully',
      );
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'delete', 'user', id);

      dbLogger.error(
        {
          error,
          userId: id,
          duration,
          operation: 'delete',
        },
        'Failed to delete user',
      );

      const prismaError = error as PrismaError;
      if (prismaError.code === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }

  /**
   * Mapear datos de Prisma a UserWithPassword
   */
  private mapToUserWithPassword(prismaUser: any): UserWithPassword {
    try {
      return {
        id: prismaUser.id,
        email: prismaUser.email,
        username: prismaUser.username,
        password: prismaUser.password,
        firstName: prismaUser.firstName,
        lastName: prismaUser.lastName,
        avatar: prismaUser.avatar,
        isActive: prismaUser.isActive,
        isVerified: prismaUser.isVerified,
        lastLoginAt: prismaUser.lastLoginAt,
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      };
    } catch (error: unknown) {
      dbLogger.error(
        {
          error,
          userId: prismaUser?.id,
          operation: 'mapToUserWithPassword',
        },
        'Failed to map Prisma user to UserWithPassword',
      );

      throw new Error('Invalid user data structure');
    }
  }

  /**
   * Mapear datos de Prisma a UserWithoutPassword
   */
  private mapToUserWithoutPassword(prismaUser: any): UserWithoutPassword {
    try {
      return {
        id: prismaUser.id,
        email: prismaUser.email,
        username: prismaUser.username,
        firstName: prismaUser.firstName,
        lastName: prismaUser.lastName,
        avatar: prismaUser.avatar,
        isActive: prismaUser.isActive,
        isVerified: prismaUser.isVerified,
        lastLoginAt: prismaUser.lastLoginAt,
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      };
    } catch (error: unknown) {
      dbLogger.error(
        {
          error,
          userId: prismaUser?.id,
          operation: 'mapToUserWithoutPassword',
        },
        'Failed to map Prisma user to UserWithoutPassword',
      );

      throw new Error('Invalid user data structure');
    }
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
    const startTime = Date.now();

    try {
      dbLogger.debug({ operation: 'getUserStats' }, 'Getting user statistics');

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

      const duration = Date.now() - startTime;
      loggers.dbQuery('count', 'user', duration);

      const stats = { total, active, verified, newThisMonth };

      dbLogger.debug(
        {
          stats,
          duration,
        },
        'User statistics retrieved',
      );

      return stats;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      loggers.dbError(error as Error, 'count', 'user');

      dbLogger.error(
        {
          error,
          duration,
          operation: 'getUserStats',
        },
        'Failed to get user stats',
      );

      throw new Error(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
    }
  }
}
