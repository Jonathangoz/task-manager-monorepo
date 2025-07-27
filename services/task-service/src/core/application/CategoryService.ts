// src/core/application/CategoryService.ts
// ==============================================

import { Category } from '@prisma/client';
import { 
  ICategoryService, 
  CategoryStatsResponse 
} from '@/core/domain/interfaces/ICategoryService';
import { 
  ICategoryRepository,
  CategoryWithTaskCount,
  CreateCategoryData as RepositoryCreateCategoryData,
  UpdateCategoryData as RepositoryUpdateCategoryData
} from '@/core/domain/interfaces/ICategoryRepository';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { logger } from '@/utils/logger';
import { 
  ERROR_MESSAGES, 
  ERROR_CODES,
  SUCCESS_MESSAGES,
  CATEGORY_CONFIG,
  EVENT_TYPES,
  CACHE_TTL,
  CACHE_KEYS,
  PAGINATION_CONFIG,
  DEFAULT_VALUES
} from '@/utils/constants';

// Application DTOs - diferentes de las del repository
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

// Custom error class para mejor manejo de errores
class CategoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}

export class CategoryService implements ICategoryService {
  constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly cacheService: ICacheService
  ) {}

  async createCategory(userId: string, data: CreateCategoryData): Promise<Category> {
    try {
      logger.info({ userId, name: data.name }, 'Creating new category');

      // Validaciones de negocio
      this.validateCategoryData(data);
      await this.checkUserCategoryLimits(userId);
      await this.checkCategoryNameUnique(userId, data.name);

      // Mapear a formato del repository
      const repositoryData: RepositoryCreateCategoryData = {
        ...data,
        userId,
        color: data.color || DEFAULT_VALUES.CATEGORY_COLOR,
        icon: data.icon || DEFAULT_VALUES.CATEGORY_ICON
      };

      const category = await this.categoryRepository.create(repositoryData);

      // Invalidar cache del usuario
      await this.invalidateUserCaches(userId);

      logger.info({ 
        userId, 
        categoryId: category.id, 
        name: category.name,
        event: EVENT_TYPES.CATEGORY_CREATED 
      }, SUCCESS_MESSAGES.CATEGORY_CREATED);

      return category;

    } catch (error) {
      logger.error({ error, userId, data }, 'Failed to create category');
      this.handleError(error);
    }
  }

  async getCategoryById(categoryId: string, userId: string): Promise<CategoryWithTaskCount> {
    try {
      logger.debug({ userId, categoryId }, 'Getting category by ID');

      // Intentar obtener del cache primero
      const cacheKey = CACHE_KEYS.CATEGORY_DETAIL(categoryId);
      const cached = await this.cacheService.getJson<CategoryWithTaskCount>(cacheKey);
      
      if (cached && cached.userId === userId) {
        logger.debug({ userId, categoryId, event: EVENT_TYPES.CACHE_HIT }, 'Category retrieved from cache');
        return cached;
      }

      // Si no está en cache, obtener de la base de datos
      const category = await this.categoryRepository.findById(categoryId);
      
      if (!category) {
        throw new CategoryError(
          ERROR_MESSAGES.CATEGORY_NOT_FOUND,
          ERROR_CODES.CATEGORY_NOT_FOUND,
          404
        );
      }

      // Verificar ownership
      if (category.userId !== userId) {
        throw new CategoryError(
          ERROR_MESSAGES.CATEGORY_NOT_FOUND, // No revelar que existe
          ERROR_CODES.CATEGORY_ACCESS_DENIED,
          403
        );
      }

      // Guardar en cache
      await this.cacheService.setJson(cacheKey, category, CACHE_TTL.CATEGORY_DETAIL);
      
      logger.debug({ userId, categoryId, event: EVENT_TYPES.CACHE_MISS }, 'Category retrieved from database');
      return category;

    } catch (error) {
      logger.error({ error, userId, categoryId }, 'Failed to get category by ID');
      this.handleError(error);
    }
  }

  async getUserCategories(userId: string, includeTaskCount = false): Promise<CategoryWithTaskCount[]> {
    try {
      logger.debug({ userId, includeTaskCount }, 'Getting user categories');

      // Para consistency, solo cacheamos la versión simple
      if (!includeTaskCount) {
        const cached = await this.cacheService.getCachedUserCategories(userId);
        if (cached) {
          logger.debug({ userId, event: EVENT_TYPES.CACHE_HIT }, 'User categories retrieved from cache');
          return cached;
        }
      }

      // Obtener de la base de datos
      const categories = await this.categoryRepository.findByUserId(userId, includeTaskCount);

      // Cachear solo la versión simple
      if (!includeTaskCount) {
        await this.cacheService.cacheUserCategories(userId, categories, CACHE_TTL.USER_CATEGORIES);
      }
      
      logger.debug({ 
        userId, 
        count: categories.length,
        event: EVENT_TYPES.CACHE_MISS 
      }, 'User categories retrieved from database');

      return categories;

    } catch (error) {
      logger.error({ error, userId, includeTaskCount }, 'Failed to get user categories');
      this.handleError(error);
    }
  }

  async updateCategory(
    categoryId: string,
    userId: string,
    data: UpdateCategoryData
  ): Promise<Category> {
    try {
      logger.info({ userId, categoryId }, 'Updating category');

      // Verificar ownership primero
      await this.validateCategoryOwnership(categoryId, userId);

      // Validaciones de negocio
      this.validateCategoryData(data);
      
      // Si está cambiando el nombre, verificar unicidad
      if (data.name) {
        await this.checkCategoryNameUnique(userId, data.name, categoryId);
      }

      // Mapear a formato del repository
      const repositoryData: RepositoryUpdateCategoryData = { ...data };
      const updatedCategory = await this.categoryRepository.update(categoryId, repositoryData);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateCategoryCache(categoryId);

      logger.info({ 
        userId, 
        categoryId, 
        changes: Object.keys(data),
        event: EVENT_TYPES.CATEGORY_UPDATED 
      }, SUCCESS_MESSAGES.CATEGORY_UPDATED);

      return updatedCategory;

    } catch (error) {
      logger.error({ error, userId, categoryId, data }, 'Failed to update category');
      this.handleError(error);
    }
  }

  async deleteCategory(categoryId: string, userId: string): Promise<void> {
    try {
      logger.info({ userId, categoryId }, 'Deleting category');

      // Verificar ownership
      await this.validateCategoryOwnership(categoryId, userId);

      // Verificar si tiene tareas asociadas
      const hasActiveTasks = await this.categoryRepository.hasActiveTasks(categoryId);
      
      if (hasActiveTasks) {
        throw new CategoryError(
          ERROR_MESSAGES.CATEGORY_HAS_TASKS,
          ERROR_CODES.CATEGORY_HAS_TASKS,
          400
        );
      }

      // Eliminar la categoría
      await this.categoryRepository.delete(categoryId);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      await this.cacheService.invalidateCategoryCache(categoryId);

      logger.info({ 
        userId, 
        categoryId,
        event: EVENT_TYPES.CATEGORY_DELETED 
      }, SUCCESS_MESSAGES.CATEGORY_DELETED);

    } catch (error) {
      logger.error({ error, userId, categoryId }, 'Failed to delete category');
      this.handleError(error);
    }
  }

  async getCategoryTasks(
    categoryId: string,
    userId: string,
    page = PAGINATION_CONFIG.DEFAULT_PAGE,
    limit = PAGINATION_CONFIG.DEFAULT_LIMIT
  ): Promise<any> {
    try {
      logger.debug({ userId, categoryId, page, limit }, 'Getting category tasks');

      // Verificar ownership de la categoría
      await this.validateCategoryOwnership(categoryId, userId);

      // Obtener tareas de la categoría
      const result = await this.taskRepository.findByCategoryId(categoryId, userId, page, limit);

      logger.debug({ 
        userId, 
        categoryId, 
        taskCount: result.tasks.length 
      }, 'Category tasks retrieved');

      return result;

    } catch (error) {
      logger.error({ error, userId, categoryId, page, limit }, 'Failed to get category tasks');
      this.handleError(error);
    }
  }

  async getCategoryStats(userId: string): Promise<CategoryStatsResponse> {
    try {
      logger.debug({ userId }, 'Getting category statistics');

      // Intentar obtener del cache
      const cached = await this.cacheService.getCachedUserStats(userId);
      if (cached?.categoryStats) {
        logger.debug({ userId, event: EVENT_TYPES.CACHE_HIT }, 'Category stats retrieved from cache');
        return cached.categoryStats;
      }

      // Obtener categorías con conteo de tareas
      const categories = await this.categoryRepository.findByUserId(userId, true);
      
      const stats: CategoryStatsResponse = {
        totalCategories: categories.length,
        activeCategories: categories.filter(c => c.isActive).length,
        categoriesWithTasks: categories.filter(c => c._count && c._count.tasks > 0).length,
        avgTasksPerCategory: categories.length > 0 
          ? categories.reduce((sum, c) => sum + (c._count?.tasks || 0), 0) / categories.length 
          : 0
      };

      // Encontrar la categoría más usada
      const mostUsed = categories
        .filter(c => c._count && c._count.tasks > 0)
        .sort((a, b) => (b._count?.tasks || 0) - (a._count?.tasks || 0))[0];

      if (mostUsed && mostUsed._count) {
        stats.mostUsedCategory = {
          id: mostUsed.id,
          name: mostUsed.name,
          taskCount: mostUsed._count.tasks
        };
      }

      // Cachear las estadísticas
      await this.cacheService.cacheUserStats(userId, { categoryStats: stats }, CACHE_TTL.USER_STATS);

      logger.debug({ userId, stats }, 'Category statistics calculated');
      return stats;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get category stats');
      this.handleError(error);
    }
  }

  async validateCategoryOwnership(categoryId: string, userId: string): Promise<boolean> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category || category.userId !== userId) {
      throw new CategoryError(
        ERROR_MESSAGES.CATEGORY_NOT_FOUND,
        ERROR_CODES.CATEGORY_ACCESS_DENIED,
        403
      );
    }
    return true;
  }

  async checkCategoryLimit(userId: string): Promise<boolean> {
    const categoryCount = await this.categoryRepository.countByUserId(userId);
    return categoryCount < CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER;
  }

  async getActiveCategories(userId: string): Promise<Category[]> {
    try {
      logger.debug({ userId }, 'Getting active categories');

      const categories = await this.categoryRepository.findActiveByUserId(userId);

      logger.debug({ userId, count: categories.length }, 'Active categories retrieved');
      return categories;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get active categories');
      this.handleError(error);
    }
  }

  async bulkDeleteCategories(categoryIds: string[], userId: string): Promise<void> {
    try {
      logger.info({ userId, categoryIds }, 'Bulk deleting categories');

      // Validar ownership de todas las categorías
      for (const categoryId of categoryIds) {
        await this.validateCategoryOwnership(categoryId, userId);
        
        // Verificar que no tengan tareas
        const hasActiveTasks = await this.categoryRepository.hasActiveTasks(categoryId);
        if (hasActiveTasks) {
          throw new CategoryError(
            `Category ${categoryId} has active tasks and cannot be deleted`,
            ERROR_CODES.CATEGORY_HAS_TASKS,
            400
          );
        }
      }

      // Eliminar todas las categorías
      await this.categoryRepository.bulkDelete(categoryIds);

      // Invalidar caches
      await this.invalidateUserCaches(userId);
      for (const categoryId of categoryIds) {
        await this.cacheService.invalidateCategoryCache(categoryId);
      }

      logger.info({ 
        userId, 
        deletedCount: categoryIds.length,
        event: EVENT_TYPES.CATEGORY_DELETED 
      }, 'Categories bulk deleted successfully');

    } catch (error) {
      logger.error({ error, userId, categoryIds }, 'Failed to bulk delete categories');
      this.handleError(error);
    }
  }

  // Métodos privados

  private validateCategoryData(data: CreateCategoryData | UpdateCategoryData): void {
    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new CategoryError(
          'Category name is required',
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
      
      if (data.name.length > CATEGORY_CONFIG.MAX_NAME_LENGTH) {
        throw new CategoryError(
          `Name must be less than ${CATEGORY_CONFIG.MAX_NAME_LENGTH} characters`,
          ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    }

    if (data.description && data.description.length > CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new CategoryError(
        `Description must be less than ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} characters`,
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (data.color && !this.isValidHexColor(data.color)) {
      throw new CategoryError(
        'Color must be a valid hex color code',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
  }

  private async checkUserCategoryLimits(userId: string): Promise<void> {
    const categoryCount = await this.categoryRepository.countByUserId(userId);
    
    if (categoryCount >= CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER) {
      throw new CategoryError(
        `Maximum ${CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER} categories per user exceeded`,
        ERROR_CODES.CATEGORY_LIMIT_EXCEEDED,
        400
      );
    }
  }

  private async checkCategoryNameUnique(userId: string, name: string, excludeId?: string): Promise<void> {
    const existingCategory = await this.categoryRepository.findByName(userId, name);
    
    if (existingCategory && existingCategory.id !== excludeId) {
      throw new CategoryError(
        ERROR_MESSAGES.CATEGORY_ALREADY_EXISTS,
        ERROR_CODES.CATEGORY_ALREADY_EXISTS,
        409
      );
    }
  }

  private isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private async invalidateUserCaches(userId: string): Promise<void> {
    try {
      await this.cacheService.invalidateUserCategoriesCache(userId);
      await this.cacheService.invalidateUserStatsCache(userId);
    } catch (error) {
      logger.warn({ error, userId }, 'Failed to invalidate user caches');
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof CategoryError) {
      throw error;
    }
    
    // Re-throw other known errors
    if (error instanceof Error) {
      throw error;
    }
    
    // Unknown error
    throw new CategoryError(
      ERROR_MESSAGES.INTERNAL_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      500
    );
  }
}