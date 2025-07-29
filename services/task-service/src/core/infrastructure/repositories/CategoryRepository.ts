// src/core/infrastructure/repositories/CategoryRepository.ts
import { PrismaClient, Category } from '@prisma/client';
import { 
  ICategoryRepository, 
  CreateCategoryData, 
  UpdateCategoryData, 
  CategoryWithTaskCount } from '@/core/domain/interfaces/ICategoryRepository';
import { logger } from '@/utils/logger';
import { db } from '@/config/database';
import { ERROR_CODES, CATEGORY_CONFIG } from '@/utils/constants';

/**
 * Implementación del repositorio de categorías usando Prisma ORM
 * Maneja la persistencia de categorías con validaciones de negocio
 * y operaciones optimizadas para producción
 */
export class CategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient = db) {}

  /**
   * Crea una nueva categoría
   * @param data - Datos de la categoría a crear
   * @returns Promise<Category> - Categoría creada
   * @throws Error si hay problemas de validación o persistencia
   */
  async create(data: CreateCategoryData): Promise<Category> {
    const startTime = Date.now();
    
    try {
      // Validar límite de categorías por usuario antes de crear
      const userCategoryCount = await this.countByUserId(data.userId);
      if (userCategoryCount >= CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER) {
        throw new Error(`${ERROR_CODES.CATEGORY_LIMIT_EXCEEDED}: Maximum ${CATEGORY_CONFIG.MAX_CATEGORIES_PER_USER} categories allowed per user`);
      }

      // Verificar que no exista una categoría con el mismo nombre para el usuario
      const existingCategory = await this.findByName(data.userId, data.name);
      if (existingCategory) {
        throw new Error(`${ERROR_CODES.CATEGORY_ALREADY_EXISTS}: Category with name "${data.name}" already exists`);
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
      logger.info({ 
        categoryId: category.id, 
        userId: data.userId,
        name: category.name,
        duration,
        event: 'category.created'
      }, 'Category created successfully');

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryData: { ...data, userId: '[MASKED]' },
        duration,
        event: 'category.create.error'
      }, 'Failed to create category');
      throw error;
    }
  }

  /**
   * Busca una categoría por ID
   * @param id - ID de la categoría
   * @returns Promise<CategoryWithTaskCount | null> - Categoría con conteo de tareas o null
   */
  async findById(id: string): Promise<CategoryWithTaskCount | null> {
    const startTime = Date.now();
    
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { tasks: true }
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        categoryId: id, 
        found: !!category,
        duration,
        event: 'category.findById'
      }, 'Category search by ID completed');

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryId: id,
        duration,
        event: 'category.findById.error'
      }, 'Failed to find category by id');
      throw error;
    }
  }

  /**
   * Busca categorías por ID de usuario
   * @param userId - ID del usuario
   * @param includeTaskCount - Si incluir el conteo de tareas
   * @returns Promise<CategoryWithTaskCount[]> - Lista de categorías
   */
  async findByUserId(userId: string, includeTaskCount: boolean = false): Promise<CategoryWithTaskCount[]> {
    const startTime = Date.now();
    
    try {
      const categories = await this.prisma.category.findMany({
        where: { 
          userId,
          isActive: true 
        },
        include: includeTaskCount ? {
          _count: {
            select: { tasks: true }
          }
        } : undefined,
        orderBy: { createdAt: 'asc' },
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        userId: '[MASKED]', 
        count: categories.length,
        includeTaskCount,
        duration,
        event: 'category.findByUserId'
      }, 'Categories retrieved for user');

      return categories;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        userId: '[MASKED]',
        duration,
        event: 'category.findByUserId.error'
      }, 'Failed to find categories by user');
      throw error;
    }
  }

  /**
   * Busca una categoría por nombre y usuario
   * @param userId - ID del usuario
   * @param name - Nombre de la categoría
   * @returns Promise<Category | null> - Categoría encontrada o null
   */
  async findByName(userId: string, name: string): Promise<Category | null> {
    const startTime = Date.now();
    
    try {
      const category = await this.prisma.category.findUnique({
        where: { 
          userId_name: {
            userId,
            name: name.trim()
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        userId: '[MASKED]', 
        name,
        found: !!category,
        duration,
        event: 'category.findByName'
      }, 'Category search by name completed');

      return category;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        userId: '[MASKED]',
        name,
        duration,
        event: 'category.findByName.error'
      }, 'Failed to find category by name');
      throw error;
    }
  }

  /**
   * Actualiza una categoría
   * @param id - ID de la categoría
   * @param data - Datos a actualizar
   * @returns Promise<Category> - Categoría actualizada
   * @throws Error si la categoría no existe o hay conflictos
   */
  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const startTime = Date.now();
    
    try {
      // Verificar que la categoría existe
      const existingCategory = await this.prisma.category.findUnique({
        where: { id }
      });

      if (!existingCategory) {
        throw new Error(`${ERROR_CODES.CATEGORY_NOT_FOUND}: Category with id "${id}" not found`);
      }

      // Si se está actualizando el nombre, verificar que no cause duplicado
      if (data.name && data.name !== existingCategory.name) {
        const duplicateCategory = await this.findByName(existingCategory.userId, data.name);
        if (duplicateCategory && duplicateCategory.id !== id) {
          throw new Error(`${ERROR_CODES.CATEGORY_ALREADY_EXISTS}: Category with name "${data.name}" already exists`);
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined) updateData.description = data.description?.trim() || null;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      logger.info({ 
        categoryId: id, 
        userId: '[MASKED]',
        changes: Object.keys(updateData),
        duration,
        event: 'category.updated'
      }, 'Category updated successfully');

      return updatedCategory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryId: id,
        updateData: data,
        duration,
        event: 'category.update.error'
      }, 'Failed to update category');
      throw error;
    }
  }

  /**
   * Elimina una categoría
   * Si tiene tareas asociadas, se hace soft delete, de lo contrario hard delete
   * @param id - ID de la categoría
   * @throws Error si la categoría no existe
   */
  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Verificar si la categoría existe
      const category = await this.prisma.category.findUnique({
        where: { id }
      });

      if (!category) {
        throw new Error(`${ERROR_CODES.CATEGORY_NOT_FOUND}: Category with id "${id}" not found`);
      }

      // Verificar si tiene tareas asociadas
      const hasActiveTasks = await this.hasActiveTasks(id);

      if (hasActiveTasks) {
        // Soft delete: marcar como inactiva
        await this.prisma.category.update({
          where: { id },
          data: { isActive: false }
        });

        const duration = Date.now() - startTime;
        logger.info({ 
          categoryId: id, 
          userId: '[MASKED]',
          deleteType: 'soft',
          duration,
          event: 'category.soft_deleted'
        }, 'Category soft deleted (has active tasks)');
      } else {
        // Hard delete: eliminar completamente
        await this.prisma.category.delete({
          where: { id }
        });

        const duration = Date.now() - startTime;
        logger.info({ 
          categoryId: id, 
          userId: '[MASKED]',
          deleteType: 'hard',
          duration,
          event: 'category.hard_deleted'
        }, 'Category hard deleted (no active tasks)');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryId: id,
        duration,
        event: 'category.delete.error'
      }, 'Failed to delete category');
      throw error;
    }
  }

  /**
   * Cuenta el número de categorías activas de un usuario
   * @param userId - ID del usuario
   * @returns Promise<number> - Número de categorías
   */
  async countByUserId(userId: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      const count = await this.prisma.category.count({
        where: { 
          userId, 
          isActive: true 
        }
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        userId: '[MASKED]', 
        count,
        duration,
        event: 'category.countByUserId'
      }, 'Category count retrieved for user');

      return count;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        userId: '[MASKED]',
        duration,
        event: 'category.countByUserId.error'
      }, 'Failed to count user categories');
      throw error;
    }
  }

  /**
   * Busca categorías activas de un usuario (sin conteo de tareas)
   * @param userId - ID del usuario
   * @returns Promise<Category[]> - Lista de categorías activas
   */
  async findActiveByUserId(userId: string): Promise<Category[]> {
    const startTime = Date.now();
    
    try {
      const categories = await this.prisma.category.findMany({
        where: { 
          userId,
          isActive: true 
        },
        orderBy: { createdAt: 'asc' },
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        userId: '[MASKED]', 
        count: categories.length,
        duration,
        event: 'category.findActiveByUserId'
      }, 'Active categories retrieved for user');

      return categories;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        userId: '[MASKED]',
        duration,
        event: 'category.findActiveByUserId.error'
      }, 'Failed to find active categories by user');
      throw error;
    }
  }

  /**
   * Verifica si una categoría tiene tareas activas (no completadas/canceladas)
   * @param categoryId - ID de la categoría
   * @returns Promise<boolean> - true si tiene tareas activas
   */
  async hasActiveTasks(categoryId: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const taskCount = await this.prisma.task.count({
        where: { 
          categoryId,
          status: {
            notIn: ['COMPLETED', 'CANCELLED']
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.debug({ 
        categoryId, 
        hasActiveTasks: taskCount > 0,
        activeTaskCount: taskCount,
        duration,
        event: 'category.hasActiveTasks'
      }, 'Active tasks check completed for category');

      return taskCount > 0;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryId,
        duration,
        event: 'category.hasActiveTasks.error'
      }, 'Failed to check active tasks for category');
      throw error;
    }
  }

  /**
   * Elimina múltiples categorías por IDs
   * Aplica la misma lógica que delete individual para cada categoría
   * @param ids - Array de IDs de categorías
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const startTime = Date.now();
    
    if (ids.length === 0) {
      logger.warn({ event: 'category.bulkDelete.empty' }, 'Bulk delete called with empty IDs array');
      return;
    }

    try {
      // Usar transacción para asegurar consistencia
      await this.prisma.$transaction(async (tx) => {
        for (const id of ids) {
          // Verificar si la categoría existe
          const category = await tx.category.findUnique({
            where: { id }
          });

          if (!category) {
            logger.warn({ 
              categoryId: id,
              event: 'category.bulkDelete.notFound'
            }, 'Category not found during bulk delete, skipping');
            continue;
          }

          // Verificar si tiene tareas activas
          const activeTaskCount = await tx.task.count({
            where: { 
              categoryId: id,
              status: {
                notIn: ['COMPLETED', 'CANCELLED']
              }
            }
          });

          if (activeTaskCount > 0) {
            // Soft delete
            await tx.category.update({
              where: { id },
              data: { isActive: false }
            });
          } else {
            // Hard delete
            await tx.category.delete({
              where: { id }
            });
          }
        }
      });

      const duration = Date.now() - startTime;
      logger.info({ 
        categoryIds: ids.length,
        duration,
        event: 'category.bulkDeleted'
      }, `Bulk delete completed for ${ids.length} categories`);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error instanceof Error ? error.message : String(error), 
        categoryIds: ids.length,
        duration,
        event: 'category.bulkDelete.error'
      }, 'Failed to bulk delete categories');
      throw error;
    }
  }
}