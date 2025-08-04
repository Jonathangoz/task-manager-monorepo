// src/core/infrastructure/repositories/CategoryRepository.ts
import { PrismaClient, Category, Prisma } from '@prisma/client';
import {
  ICategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
  CategoryWithTaskCount,
  PaginatedCategoriesResult,
  SearchParams,
  PaginationParams,
} from '@/core/domain/interfaces/ICategoryRepository';
import { logger } from '@/utils/logger';
import { db } from '@/config/database';
import { ERROR_CODES, CATEGORY_CONFIG } from '@/utils/constants';

export class CategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient = db) {}

  // ... (métodos create, findById, etc. sin cambios) ...

  async create(data: CreateCategoryData): Promise<Category> {
    const startTime = Date.now();

    try {
      const userCategoryCount = await this.countByUserId(data.userId);
      if (userCategoryCount >= CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER) {
        throw new Error(
          `${ERROR_CODES.CATEGORY_LIMIT_EXCEEDED}: Maximum ${CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER} categories allowed per user`,
        );
      }

      const existingCategory = await this.findByName(data.userId, data.name);
      if (existingCategory) {
        throw new Error(
          `${ERROR_CODES.CATEGORY_ALREADY_EXISTS}: Category with name "${data.name}" already exists`,
        );
      }

      const category = await this.prisma.category.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          color: data.color || CATEGORY_CONFIG.DEFAULT_COLOR,
          icon: data.icon || CATEGORY_CONFIG.DEFAULT_ICON,
          userId: data.userId,
          isActive: true,
        },
      });

      const duration = Date.now() - startTime;
      logger.info(
        {
          categoryId: category.id,
          userId: data.userId,
          name: category.name,
          duration,
          event: 'category.created',
        },
        'Category created successfully',
      );

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryData: { ...data, userId: '[MASKED]' },
          duration,
          event: 'category.create.error',
        },
        'Failed to create category',
      );
      throw error;
    }
  }

  async findById(id: string): Promise<CategoryWithTaskCount | null> {
    const startTime = Date.now();

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          categoryId: id,
          found: !!category,
          duration,
          event: 'category.findById',
        },
        'Category search by ID completed',
      );

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryId: id,
          duration,
          event: 'category.findById.error',
        },
        'Failed to find category by id',
      );
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    includeTaskCount: boolean = false,
  ): Promise<CategoryWithTaskCount[]> {
    const startTime = Date.now();

    try {
      const categories = await this.prisma.category.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: includeTaskCount
          ? {
              _count: {
                select: { tasks: true },
              },
            }
          : undefined,
        orderBy: { createdAt: 'asc' },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          userId: '[MASKED]',
          count: categories.length,
          includeTaskCount,
          duration,
          event: 'category.findByUserId',
        },
        'Categories retrieved for user',
      );

      return categories;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: '[MASKED]',
          duration,
          event: 'category.findByUserId.error',
        },
        'Failed to find categories by user',
      );
      throw error;
    }
  }

  async findByName(userId: string, name: string): Promise<Category | null> {
    const startTime = Date.now();

    try {
      const category = await this.prisma.category.findUnique({
        where: {
          userId_name: {
            userId,
            name: name.trim(),
          },
        },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          userId: '[MASKED]',
          name,
          found: !!category,
          duration,
          event: 'category.findByName',
        },
        'Category search by name completed',
      );

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: '[MASKED]',
          name,
          duration,
          event: 'category.findByName.error',
        },
        'Failed to find category by name',
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const startTime = Date.now();

    try {
      const existingCategory = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw new Error(
          `${ERROR_CODES.CATEGORY_NOT_FOUND}: Category with id "${id}" not found`,
        );
      }

      if (data.name && data.name !== existingCategory.name) {
        const duplicateCategory = await this.findByName(
          existingCategory.userId,
          data.name,
        );
        if (duplicateCategory && duplicateCategory.id !== id) {
          throw new Error(
            `${ERROR_CODES.CATEGORY_ALREADY_EXISTS}: Category with name "${data.name}" already exists`,
          );
        }
      }

      const updateData: Partial<UpdateCategoryData> = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || undefined;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      logger.info(
        {
          categoryId: id,
          userId: '[MASKED]',
          changes: Object.keys(updateData),
          duration,
          event: 'category.updated',
        },
        'Category updated successfully',
      );

      return updatedCategory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryId: id,
          updateData: data,
          duration,
          event: 'category.update.error',
        },
        'Failed to update category',
      );
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new Error(
          `${ERROR_CODES.CATEGORY_NOT_FOUND}: Category with id "${id}" not found`,
        );
      }

      const hasActiveTasks = await this.hasActiveTasks(id);

      if (hasActiveTasks) {
        await this.prisma.category.update({
          where: { id },
          data: { isActive: false },
        });

        const duration = Date.now() - startTime;
        logger.info(
          {
            categoryId: id,
            userId: '[MASKED]',
            deleteType: 'soft',
            duration,
            event: 'category.soft_deleted',
          },
          'Category soft deleted (has active tasks)',
        );
      } else {
        await this.prisma.category.delete({
          where: { id },
        });

        const duration = Date.now() - startTime;
        logger.info(
          {
            categoryId: id,
            userId: '[MASKED]',
            deleteType: 'hard',
            duration,
            event: 'category.hard_deleted',
          },
          'Category hard deleted (no active tasks)',
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryId: id,
          duration,
          event: 'category.delete.error',
        },
        'Failed to delete category',
      );
      throw error;
    }
  }

  async countByUserId(userId: string): Promise<number> {
    const startTime = Date.now();

    try {
      const count = await this.prisma.category.count({
        where: {
          userId,
          isActive: true,
        },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          userId: '[MASKED]',
          count,
          duration,
          event: 'category.countByUserId',
        },
        'Category count retrieved for user',
      );

      return count;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: '[MASKED]',
          duration,
          event: 'category.countByUserId.error',
        },
        'Failed to count user categories',
      );
      throw error;
    }
  }

  async findActiveByUserId(userId: string): Promise<Category[]> {
    const startTime = Date.now();

    try {
      const categories = await this.prisma.category.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          userId: '[MASKED]',
          count: categories.length,
          duration,
          event: 'category.findActiveByUserId',
        },
        'Active categories retrieved for user',
      );

      return categories;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: '[MASKED]',
          duration,
          event: 'category.findActiveByUserId.error',
        },
        'Failed to find active categories by user',
      );
      throw error;
    }
  }

  async hasActiveTasks(categoryId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      const taskCount = await this.prisma.task.count({
        where: {
          categoryId,
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          categoryId,
          hasActiveTasks: taskCount > 0,
          activeTaskCount: taskCount,
          duration,
          event: 'category.hasActiveTasks',
        },
        'Active tasks check completed for category',
      );

      return taskCount > 0;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryId,
          duration,
          event: 'category.hasActiveTasks.error',
        },
        'Failed to check active tasks for category',
      );
      throw error;
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const startTime = Date.now();

    if (ids.length === 0) {
      logger.warn(
        { event: 'category.bulkDelete.empty' },
        'Bulk delete called with empty IDs array',
      );
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const id of ids) {
          const category = await tx.category.findUnique({
            where: { id },
          });

          if (!category) {
            logger.warn(
              {
                categoryId: id,
                event: 'category.bulkDelete.notFound',
              },
              'Category not found during bulk delete, skipping',
            );
            continue;
          }

          const activeTaskCount = await tx.task.count({
            where: {
              categoryId: id,
              status: {
                notIn: ['COMPLETED', 'CANCELLED'],
              },
            },
          });

          if (activeTaskCount > 0) {
            await tx.category.update({
              where: { id },
              data: { isActive: false },
            });
          } else {
            await tx.category.delete({
              where: { id },
            });
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.info(
        {
          categoryIds: ids.length,
          duration,
          event: 'category.bulkDeleted',
        },
        `Bulk delete completed for ${ids.length} categories`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          categoryIds: ids.length,
          duration,
          event: 'category.bulkDelete.error',
        },
        'Failed to bulk delete categories',
      );
      throw error;
    }
  }

  /**
   * ✅ NUEVO MÉTODO IMPLEMENTADO
   * Busca categorías con paginación, filtros y ordenamiento.
   * @param userId - ID del usuario
   * @param searchParams - Parámetros de búsqueda y filtro
   * @param paginationParams - Parámetros de paginación
   * @returns Promise<PaginatedCategoriesResult> - Resultado paginado
   */
  async search(
    userId: string,
    searchParams: SearchParams,
    paginationParams: PaginationParams,
  ): Promise<PaginatedCategoriesResult> {
    const { query, includeInactive, sortBy, sortOrder } = searchParams;
    const { page, limit } = paginationParams;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {
      userId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: categories,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
