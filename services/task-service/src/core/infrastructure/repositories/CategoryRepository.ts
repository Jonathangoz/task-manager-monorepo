// src/core/infrastructure/repositories/CategoryRepository.ts
import { PrismaClient, Category } from '@prisma/client';
import { ICategoryRepository } from '@/core/domain/interfaces/ICategoryRepository';
import { Category as CategoryEntity } from '@/core/domain/entities/Category';
import { logger } from '@/utils/logger';
import { db } from '@/config/database';

export class CategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient = db) {}

  async create(categoryData: Omit<CategoryEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<CategoryEntity> {
    try {
      const category = await this.prisma.category.create({
        data: {
          name: categoryData.name,
          description: categoryData.description,
          color: categoryData.color,
          icon: categoryData.icon,
          userId: categoryData.userId,
          isActive: categoryData.isActive,
        },
      });

      logger.info({ categoryId: category.id, userId: categoryData.userId }, 'Category created successfully');
      return this.mapToEntity(category);
    } catch (error) {
      logger.error({ error, categoryData }, 'Failed to create category');
      throw error;
    }
  }

  async findById(id: string, userId: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findFirst({
        where: { id, userId, isActive: true },
      });

      return category ? this.mapToEntity(category) : null;
    } catch (error) {
      logger.error({ error, id, userId }, 'Failed to find category by id');
      throw error;
    }
  }

  async findByName(name: string, userId: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findFirst({
        where: { name, userId, isActive: true },
      });

      return category ? this.mapToEntity(category) : null;
    } catch (error) {
      logger.error({ error, name, userId }, 'Failed to find category by name');
      throw error;
    }
  }

  async findByUserId(userId: string, includeInactive = false): Promise<CategoryEntity[]> {
    try {
      const where: any = { userId };
      if (!includeInactive) {
        where.isActive = true;
      }

      const categories = await this.prisma.category.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      return categories.map(this.mapToEntity);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find categories by user');
      throw error;
    }
  }

  async update(id: string, userId: string, updates: Partial<CategoryEntity>): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.updateMany({
        where: { id, userId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.color && { color: updates.color }),
          ...(updates.icon && { icon: updates.icon }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        },
      });

      if (category.count === 0) return null;

      const updatedCategory = await this.findById(id, userId);
      if (updatedCategory) {
        logger.info({ categoryId: id, userId }, 'Category updated successfully');
      }

      return updatedCategory;
    } catch (error) {
      logger.error({ error, id, userId, updates }, 'Failed to update category');
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      // Check if category has tasks
      const taskCount = await this.prisma.task.count({
        where: { categoryId: id, userId },
      });

      if (taskCount > 0) {
        // Soft delete by marking as inactive
        const result = await this.prisma.category.updateMany({
          where: { id, userId },
          data: { isActive: false },
        });
        
        const deleted = result.count > 0;
        if (deleted) {
          logger.info({ categoryId: id, userId, taskCount }, 'Category soft deleted (has tasks)');
        }
        
        return deleted;
      } else {
        // Hard delete if no tasks
        const result = await this.prisma.category.deleteMany({
          where: { id, userId },
        });
        
        const deleted = result.count > 0;
        if (deleted) {
          logger.info({ categoryId: id, userId }, 'Category hard deleted');
        }
        
        return deleted;
      }
    } catch (error) {
      logger.error({ error, id, userId }, 'Failed to delete category');
      throw error;
    }
  }

  async countTasksInCategory(categoryId: string, userId: string): Promise<number> {
    try {
      return await this.prisma.task.count({
        where: { categoryId, userId },
      });
    } catch (error) {
      logger.error({ error, categoryId, userId }, 'Failed to count tasks in category');
      throw error;
    }
  }

  async getUserCategoryCount(userId: string): Promise<number> {
    try {
      return await this.prisma.category.count({
        where: { userId, isActive: true },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count user categories');
      throw error;
    }
  }

  private mapToEntity(category: Category): CategoryEntity {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      icon: category.icon,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      userId: category.userId,
    };
  }
}