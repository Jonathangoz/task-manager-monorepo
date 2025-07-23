// src/core/application/CategoryService.ts
// ==============================================

import { Category } from '@prisma/client';
import { ICategoryService } from '@/core/domain/interfaces/ICategoryService';
import { ICategoryRepository } from '@/core/domain/interfaces/ICategoryRepository';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { logger } from '@/utils/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  CATEGORY_CONFIG,
  EVENT_TYPES,
  CACHE_TTL
} from '@/utils/constants';

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export interface CategoryWithTaskCount extends Category {
  taskCount: number;
}

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private taskRepository: ITaskRepository,
    private cacheService: ICacheService
  ) {}

  async createCategory(userId: string, data: CreateCategoryData): Promise<Category> {
    try {
      logger.info({ userId, name: data.name }, 'Creating new category');

      // Validaciones de negocio
      await this.validateCategoryData(data);
      await this.checkUserCategoryLimits(userId);
      await this.checkCategoryNameUnique(userId, data.name);

      // Crear la categoría con valores por defecto
      const categoryData = {
        ...data,
        color: data.color || CATEGORY_CONFIG.DEFAULT_COLOR,
        icon: data.icon || CATEGORY_CONFIG.DEFAULT_ICON
      };

      const category = await this.categoryRepository.create(userId, categoryData);

      // Invalidar cache del usuario
      await this.invalidateUserCategoriesCache(userId);

      logger.info({ 
        userId, 
        categoryId: category.id, 
        name: category.name,
        event: EVENT_TYPES.CATEGORY_CREATED 
      }, SUCCESS_MESSAGES.CATEGORY_CREATED);

      return category;

    } catch (error) {
      logger.error({ error, userId, data }, 'Failed to create category');
      throw error;
    }
  }

  async updateCategory(userId: string, categoryId: string, data: UpdateCategoryData): Promise<Category> {
    try {
      logger.info({ userId, categoryId }, 'Updating category');

      // Verificar que existe y pertenece al usuario
      const existingCategory = await this.getCategoryById(userId, categoryId);
      if (!existingCategory) {
        throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }

      // Validaciones de negocio
      await this.validateCategoryData(data);
      
      // Si está cambiando el nombre, verificar unicidad
      if (data.name && data.name !== existingCategory.name) {
        await this.checkCategoryNameUnique(userId, data.name);
      }

      // Actualizar la categoría
      const updatedCategory = await this.categoryRepository.update(categoryId, data);

      // Invalidar cache
      await this.invalidateUserCategoriesCache(userId);
      await this.cacheService.del(`category:${categoryId}`);

      logger.info({ 
        userId, 
        categoryId, 
        changes: Object.keys(data),
        event: EVENT_TYPES.CATEGORY_UPDATED 
      }, SUCCESS_MESSAGES.CATEGORY_UPDATED);

      return updatedCategory;

    } catch (error) {
      logger.error({ error, userId, categoryId, data }, 'Failed to update category');
      throw error;
    }
  }

  async deleteCategory(userId: string, categoryId: string, forceDelete = false): Promise<void> {
    try {
      logger.info({ userId, categoryId, forceDelete }, 'Deleting category');

      // Verificar que existe y pertenece al usuario
      const existingCategory = await this.getCategoryById(userId, categoryId);
      if (!existingCategory) {
        throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }

      // Verificar si tiene tareas asociadas
      const taskCount = await this.taskRepository.countByCategory(categoryId);
      
      if (taskCount > 0 && !forceDelete) {
        throw new Error(ERROR_MESSAGES.CATEGORY_HAS_TASKS);
      }

      // Si es eliminación forzada, actualizar tareas para remover la categoría
      if (taskCount > 0 && forceDelete) {
        await this.taskRepository.removeCategoryFromTasks(categoryId);
      }

      // Eliminar la categoría
      await this.categoryRepository.delete(categoryId);

      // Invalidar cache
      await this.invalidateUserCategoriesCache(userId);
      await this.cacheService.del(`category:${categoryId}`);
      await this.cacheService.del(`category:${categoryId}:tasks`);

      logger.info({ 
        userId, 
        categoryId,
        forceDelete,
        removedFromTasks: taskCount,
        event: EVENT_TYPES.CATEGORY_DELETED 
      }, SUCCESS_MESSAGES.CATEGORY_DELETED);

    } catch (error) {
      logger.error({ error, userId, categoryId, forceDelete }, 'Failed to delete category');
      throw error;
    }
  }

  async getCategoryById(userId: string, categoryId: string): Promise<Category | null> {
    try {
      // Intentar obtener del cache primero
      const cacheKey = `category:${categoryId}`;
      const cached = await this.cacheService.getJson<Category>(cacheKey);
      
      if (cached && cached.userId === userId) {
        logger.info({ userId, categoryId, event: EVENT_TYPES.CACHE_HIT }, 'Category retrieved from cache');
        return cached;
      }

      // Si no está en cache, obtener de la base de datos
      const category = await this.categoryRepository.findById(categoryId);
      
      if (!category || category.userId !== userId) {
        return null;
      }

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, category, CACHE_TTL.CATEGORY_DETAIL);
      
      logger.info({ userId, categoryId, event: EVENT_TYPES.CACHE_MISS }, 'Category retrieved from database');
      return category;

    } catch (error) {
      logger.error({ error, userId, categoryId }, 'Failed to get category by ID');
      throw error;
    }
  }

  async getUserCategories(userId: string, includeTaskCount = false): Promise<CategoryWithTaskCount[]> {
    try {
      logger.info({ userId, includeTaskCount }, 'Getting user categories');

      // Generar clave de cache
      const cacheKey = `user:${userId}:categories:${includeTaskCount ? 'with-count' : 'simple'}`;
      
      // Intentar obtener del cache
      const cached = await this.cacheService.getJson<CategoryWithTaskCount[]>(cacheKey);
      if (cached) {
        logger.info({ userId, event: EVENT_TYPES.CACHE_HIT }, 'User categories retrieved from cache');
        return cached;
      }

      // Obtener de la base de datos
      const categories = await this.categoryRepository.findByUserId(userId, includeTaskCount);

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, categories, CACHE_TTL.USER_CATEGORIES);
      
      logger.info({ 
        userId, 
        count: categories.length,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'User categories retrieved from database');

      return categories;

    } catch (error) {
      logger.error({ error, userId, includeTaskCount }, 'Failed to get user categories');
      throw error;
    }
  }

  async getActiveCategories(userId: string): Promise<Category[]> {
    try {
      logger.info({ userId }, 'Getting active categories');

      const categories = await this.categoryRepository.findActiveByUserId(userId);

      logger.info({ userId, count: categories.length }, 'Active categories retrieved');
      return categories;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get active categories');
      throw error;
    }
  }

  async toggleCategoryStatus(userId: string, categoryId: string): Promise<Category> {
    try {
      logger.info({ userId, categoryId }, 'Toggling category status');

      // Verificar que existe y pertenece al usuario
      const existingCategory = await this.getCategoryById(userId, categoryId);
      if (!existingCategory) {
        throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }

      // Cambiar el estado
      const updatedCategory = await this.categoryRepository.update(categoryId, {
        isActive: !existingCategory.isActive
      });

      // Invalidar cache
      await this.invalidateUserCategoriesCache(userId);
      await this.cacheService.del(`category:${categoryId}`);

      logger.info({ 
        userId, 
        categoryId, 
        oldStatus: existingCategory.isActive,
        newStatus: updatedCategory.isActive 
      }, 'Category status toggled');

      return updatedCategory;

    } catch (error) {
      logger.error({ error, userId, categoryId }, 'Failed to toggle category status');
      throw error;
    }
  }

  async getCategoryStats(userId: string, categoryId: string): Promise<any> {
    try {
      logger.info({ userId, categoryId }, 'Getting category statistics');

      // Verificar que la categoría existe y pertenece al usuario
      const category = await this.getCategoryById(userId, categoryId);
      if (!category) {
        throw new Error(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }

      // Obtener estadísticas de tareas
      const stats = await this.taskRepository.getCategoryStats(categoryId);

      logger.info({ userId, categoryId, stats }, 'Category statistics retrieved');
      return {
        category,
        stats
      };

    } catch (error) {
      logger.error({ error, userId, categoryId }, 'Failed to get category stats');
      throw error;
    }
  }

  // Métodos privados de utilidad

  private async validateCategoryData(data: CreateCategoryData | UpdateCategoryData): Promise<void> {
    if (data.name && data.name.length > CATEGORY_CONFIG.MAX_NAME_LENGTH) {
      throw new Error(`Name must be less than ${CATEGORY_CONFIG.MAX_NAME_LENGTH} characters`);
    }

    if (data.description && data.description.length > CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description must be less than ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} characters`);
    }

    if (data.color && !this.isValidHexColor(data.color)) {
      throw new Error('Color must be a valid hex color code');
    }
  }

  private async checkUserCategoryLimits(userId: string): Promise<void> {
    const categoryCount = await this.categoryRepository.countByUserId(userId);
    
    if (categoryCount >= CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER) {
      throw new Error(`Maximum ${CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER} categories per user exceeded`);
    }
  }

  private async checkCategoryNameUnique(userId: string, name: string): Promise<void> {
    const existingCategory = await this.categoryRepository.findByUserIdAndName(userId, name);
    
    if (existingCategory) {
      throw new Error(ERROR_MESSAGES.CATEGORY_ALREADY_EXISTS);
    }
  }

  private isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private async invalidateUserCategoriesCache(userId: string): Promise<void> {
    try {
      // Invalidar ambas versiones del cache de categorías
      await this.cacheService.del(`user:${userId}:categories:simple`);
      await this.cacheService.del(`user:${userId}:categories:with-count`);
      
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user categories cache');
    }
  }
}