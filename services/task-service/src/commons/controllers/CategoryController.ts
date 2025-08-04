// src/commons/controllers/CategoryController.ts

import { Request, Response, NextFunction } from 'express';
import { ParsedQs } from 'qs';
import { ICategoryService } from '@/core/domain/interfaces/ICategoryService';
import {
  HTTP_STATUS,
  SUCCESS_MESSAGES,
  ERROR_CODES,
  ApiResponse,
  PaginationMeta,
} from '@/utils/constants';
import { logger } from '@/utils/logger';
import { extractPaginationParams } from '@/utils/pagination';
import {
  CreateCategoryData,
  UpdateCategoryData,
} from '@/core/domain/interfaces/ICategoryRepository';
import { TaskWithCategory } from '@/core/types/TaskDomain';

// Validation Error for consistency
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = ERROR_CODES.VALIDATION_ERROR,
    public readonly statusCode: number = HTTP_STATUS.BAD_REQUEST,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Interface para request autenticado
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

interface BulkDeleteRequest {
  categoryIds: string[];
}

// interfaz específica para respuesta de tareas de categoría
interface CategoryTasksResponse {
  data: TaskWithCategory[];
  meta: PaginationMeta;
}

// interfaz para los resultados paginados del servicio
// que será usada consistentemente.
interface PaginatedServiceResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface SearchCategoriesRequest {
  query?: string;
  includeInactive?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Type guard para validar que un objeto es un resultado paginado
function _isPaginatedResult<T>(obj: object): obj is PaginatedServiceResult<T> {
  return (
    obj &&
    typeof obj === 'object' &&
    'data' in obj &&
    'meta' in obj &&
    Array.isArray(obj.data)
  );
}

export class CategoryController {
  constructor(private readonly categoryService: ICategoryService) {}

  /**
   * Get user categories
   * GET /api/v1/categories
   * Query params: ?includeTaskCount=true
   */
  getCategories = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const includeTaskCount = this.parseIncludeTaskCountParam(
        req.query.includeTaskCount,
      );

      logger.info({ userId, includeTaskCount }, 'Fetching user categories');

      const categories = await this.categoryService.getUserCategories(
        userId,
        includeTaskCount,
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.CATEGORIES_RETRIEVED,
        categories,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, categoriesCount: categories.length, includeTaskCount },
        'Categories retrieved successfully',
      );
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error retrieving categories',
      );
      next(error);
    }
  };

  /**
   * Get single category by ID
   * GET /api/v1/categories/:id
   */
  getCategoryById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categoryId = this.validateAndExtractId(req.params.id);
      const userId = req.user.id;

      logger.info({ categoryId, userId }, 'Fetching category by ID');

      const category = await this.categoryService.getCategoryById(
        categoryId,
        userId,
      );

      const response = this.createSuccessResponse(
        'Category retrieved successfully',
        category,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId, userId, categoryName: category.name },
        'Category retrieved by ID',
      );
    } catch (error) {
      logger.error(
        { categoryId: req.params.id, userId: req.user?.id, error },
        'Error retrieving category',
      );
      next(error);
    }
  };

  /**
   * Create new category
   * POST /api/v1/categories
   */
  createCategory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const categoryData = this.validateCreateCategoryData(req.body);

      logger.info(
        { userId, categoryName: categoryData.name },
        'Creating new category',
      );

      const category = await this.categoryService.createCategory(
        userId,
        categoryData,
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.CATEGORY_CREATED,
        category,
        req,
      );

      res.status(HTTP_STATUS.CREATED).json(response);

      logger.info(
        { categoryId: category.id, userId, name: category.name },
        'Category created successfully',
      );
    } catch (error) {
      logger.error({ userId: req.user?.id, error }, 'Error creating category');
      next(error);
    }
  };

  /**
   * Update category
   * PUT /api/v1/categories/:id
   */
  updateCategory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categoryId = this.validateAndExtractId(req.params.id);
      const userId = req.user.id;
      const updateData = this.validateUpdateCategoryData(req.body);

      logger.info(
        { categoryId, userId, updateFields: Object.keys(updateData) },
        'Updating category',
      );

      const category = await this.categoryService.updateCategory(
        categoryId,
        userId,
        updateData,
      );

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.CATEGORY_UPDATED,
        category,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId, userId, changes: Object.keys(updateData) },
        'Category updated successfully',
      );
    } catch (error) {
      logger.error(
        { categoryId: req.params.id, userId: req.user?.id, error },
        'Error updating category',
      );
      next(error);
    }
  };

  /**
   * Delete category
   * DELETE /api/v1/categories/:id
   */
  deleteCategory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categoryId = this.validateAndExtractId(req.params.id);
      const userId = req.user.id;

      logger.info({ categoryId, userId }, 'Deleting category');

      await this.categoryService.deleteCategory(categoryId, userId);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.CATEGORY_DELETED,
        undefined, // No data for delete operation
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ categoryId, userId }, 'Category deleted successfully');
    } catch (error) {
      logger.error(
        { categoryId: req.params.id, userId: req.user?.id, error },
        'Error deleting category',
      );
      next(error);
    }
  };

  /**
   * Get tasks from a specific category with pagination
   * GET /api/v1/categories/:id/tasks
   */
  getCategoryTasks = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categoryId = this.validateAndExtractId(req.params.id);
      const userId = req.user.id;
      const paginationParams = extractPaginationParams(req);

      logger.info(
        { categoryId, userId, pagination: paginationParams },
        'Fetching category tasks',
      );

      // Asegurar que el servicio devuelve el tipo correcto
      const serviceResult = await this.categoryService.getCategoryTasks(
        categoryId,
        userId,
        paginationParams.page,
        paginationParams.limit,
      );

      // Type assertion segura con verificación
      if (!serviceResult || typeof serviceResult !== 'object') {
        throw new Error('Invalid response from category service');
      }

      // Verificar que el resultado tiene la estructura esperada
      const result = serviceResult as CategoryTasksResponse;

      if (!Array.isArray(result.data) || !result.meta) {
        throw new Error('Invalid task list response structure');
      }

      const response = this.createPaginatedResponse(
        'Category tasks retrieved successfully',
        result,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        {
          categoryId,
          userId,
          page: paginationParams.page,
          limit: paginationParams.limit,
          total: result.meta.total,
        },
        'Category tasks retrieved successfully',
      );
    } catch (error) {
      logger.error(
        { categoryId: req.params.id, userId: req.user?.id, error },
        'Error retrieving category tasks',
      );
      next(error);
    }
  };

  /**
   * Get category statistics for the user
   * GET /api/v1/categories/stats
   */
  getCategoryStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;

      logger.info({ userId }, 'Fetching category statistics');

      const stats = await this.categoryService.getCategoryStats(userId);

      const response = this.createSuccessResponse(
        SUCCESS_MESSAGES.STATS_RETRIEVED,
        stats,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info({ userId, stats }, 'Category statistics retrieved');
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error retrieving category statistics',
      );
      next(error);
    }
  };

  /**
   * Get active categories only
   * GET /api/v1/categories/active
   */
  getActiveCategories = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;

      logger.info({ userId }, 'Fetching active categories');

      const categories = await this.categoryService.getActiveCategories(userId);

      const response = this.createSuccessResponse(
        'Active categories retrieved successfully',
        categories,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, activeCategoriesCount: categories.length },
        'Active categories retrieved successfully',
      );
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error retrieving active categories',
      );
      next(error);
    }
  };

  /**
   * Search categories - MÉTODO AGREGADO
   * GET /api/v1/categories/search
   */
  searchCategories = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const searchParams = this.validateSearchCategoriesData(req.query);
      const paginationParams = extractPaginationParams(req);

      logger.info(
        { userId, searchParams, pagination: paginationParams },
        'Searching categories',
      );

      // ✅ CORRECCIÓN (TS2739): Se llama al nuevo método `searchUserCategories` que está
      // diseñado para la búsqueda y paginación. Ahora los argumentos coinciden y el
      // tipo de retorno (PaginatedCategoriesResult) es el esperado.
      const result = await this.categoryService.searchUserCategories(
        userId,
        searchParams,
        paginationParams,
      );

      // 💡 EXPLICACIÓN: Asumimos que createPaginatedResponse está preparado para
      // recibir el objeto `result` que ahora contiene `data` y `meta`.
      const response = this.createPaginatedResponse(
        'Categories search completed successfully',
        result,
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        {
          userId,
          query: searchParams.query,
          resultsCount: result.meta.total,
        },
        'Categories search completed successfully',
      );
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error searching categories',
      );
      next(error);
    }
  };

  /**
   * Bulk delete categories
   * DELETE /api/v1/categories/bulk
   */
  bulkDeleteCategories = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { categoryIds } = this.validateBulkDeleteData(req.body);
      const userId = req.user.id;

      logger.info({ userId, categoryIds }, 'Bulk deleting categories');

      await this.categoryService.bulkDeleteCategories(categoryIds, userId);

      const response = this.createSuccessResponse(
        `${categoryIds.length} categories deleted successfully`,
        { deletedCount: categoryIds.length },
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, deletedCount: categoryIds.length },
        'Bulk category deletion completed',
      );
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error in bulk delete categories',
      );
      next(error);
    }
  };

  // UTILITY ENDPOINTS - Consider moving to a separate utility controller

  /**
   * Validate category ownership
   * GET /api/v1/categories/:id/validate
   */
  validateCategoryOwnership = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categoryId = this.validateAndExtractId(req.params.id);
      const userId = req.user.id;

      logger.info({ categoryId, userId }, 'Validating category ownership');

      const isOwner = await this.categoryService.validateCategoryOwnership(
        categoryId,
        userId,
      );

      const response = this.createSuccessResponse(
        'Category ownership validation completed',
        { isOwner },
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { categoryId, userId, isOwner },
        'Category ownership validated',
      );
    } catch (error) {
      logger.error(
        { categoryId: req.params.id, userId: req.user?.id, error },
        'Error validating category ownership',
      );
      next(error);
    }
  };

  /**
   * Check if user can create more categories
   * GET /api/v1/categories/check-limit
   */
  checkCategoryLimit = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user.id;

      logger.info({ userId }, 'Checking category limit');

      const canCreate = await this.categoryService.checkCategoryLimit(userId);

      const response = this.createSuccessResponse(
        'Category limit check completed',
        { canCreateMore: canCreate },
        req,
      );

      res.status(HTTP_STATUS.OK).json(response);

      logger.info(
        { userId, canCreateMore: canCreate },
        'Category limit checked',
      );
    } catch (error) {
      logger.error(
        { userId: req.user?.id, error },
        'Error checking category limit',
      );
      next(error);
    }
  };

  // PRIVATE VALIDATION METHODS

  /**
   * Validate and extract ID parameter
   */
  private validateAndExtractId(id: string): string {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new ValidationError(
        'Invalid category ID',
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    return id.trim();
  }

  /**
   * Parse includeTaskCount parameter
   */
  private parseIncludeTaskCountParam(param: unknown): boolean {
    return param === 'true' || param === true;
  }

  /**
   * Validate create category request data
   */
  private validateCreateCategoryData(
    body: unknown,
  ): Omit<CreateCategoryData, 'userId'> {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Invalid request body: must be an object.');
    }
    const bodyRecord = body as Record<string, unknown>;

    const { name, description, color, icon } = bodyRecord;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError(
        'Category name is required and must be a non-empty string',
      );
    }

    return {
      name: name.trim(),
      description:
        typeof description === 'string' ? description.trim() : undefined,
      color: typeof color === 'string' ? color.trim() : undefined,
      icon: typeof icon === 'string' ? icon.trim() : undefined,
    };
  }

  /**
   * Validate update category request data
   */
  private validateUpdateCategoryData(body: unknown): UpdateCategoryData {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Invalid request body: must be an object.');
    }
    const bodyRecord = body as Record<string, unknown>;
    const { name, description, color, icon, isActive } = bodyRecord;
    const updateData: UpdateCategoryData = {};

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new ValidationError('Category name must be a non-empty string');
      }
      const trimmedName = name.trim();
      if (trimmedName.length > 100) {
        throw new ValidationError('Category name cannot exceed 100 characters');
      }
      updateData.name = trimmedName;
    }

    // Validate other fields
    if (description !== undefined) {
      updateData.description =
        typeof description === 'string' ? description.trim() : undefined;
    }
    if (color !== undefined) {
      updateData.color = typeof color === 'string' ? color.trim() : undefined;
    }
    if (icon !== undefined) {
      updateData.icon = typeof icon === 'string' ? icon.trim() : undefined;
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // Check if there's something to update
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    return updateData;
  }

  /**
   * Validate bulk delete request data
   */
  private validateBulkDeleteData(body: unknown): BulkDeleteRequest {
    const { categoryIds } = body as { categoryIds: unknown };

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new ValidationError(
        'Category IDs array is required and must not be empty',
      );
    }

    if (
      categoryIds.some((id: unknown) => typeof id !== 'string' || !id.trim())
    ) {
      throw new ValidationError(
        'All category IDs must be valid non-empty strings',
      );
    }

    return { categoryIds };
  }

  /**
   * Validate search categories request data - MÉTODO AGREGADO
   */
  private validateSearchCategoriesData(
    query: ParsedQs,
  ): SearchCategoriesRequest {
    const { query: searchQuery, includeInactive, sortBy, sortOrder } = query;
    const searchParams: SearchCategoriesRequest = {};

    if (searchQuery && typeof searchQuery === 'string') {
      searchParams.query = searchQuery;
    }

    if (includeInactive !== undefined) {
      searchParams.includeInactive = includeInactive === 'true';
    }

    if (sortBy !== undefined) {
      if (typeof sortBy !== 'string') {
        throw new ValidationError('sortBy must be a string.');
      }
      const validSortFields = ['name', 'createdAt', 'updatedAt'];
      if (!validSortFields.includes(sortBy)) {
        throw new ValidationError(
          `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`,
        );
      }
      searchParams.sortBy = sortBy as 'name' | 'createdAt' | 'updatedAt';
    }

    if (sortOrder !== undefined) {
      if (typeof sortOrder !== 'string') {
        throw new ValidationError('sortOrder must be a string.');
      }
      const validSortOrders = ['asc', 'desc'];
      if (!validSortOrders.includes(sortOrder)) {
        throw new ValidationError(
          `Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`,
        );
      }
      searchParams.sortOrder = sortOrder as 'asc' | 'desc';
    }

    return searchParams;
  }

  // PRIVATE RESPONSE HELPER METHODS

  /**
   * Create standard success response
   */
  private createSuccessResponse<T>(
    message: string,
    data: T,
    req: AuthenticatedRequest,
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string,
      },
    };
  }

  /**
   * Create paginated response
   */
  private createPaginatedResponse<T>(
    message: string,
    result: PaginatedServiceResult<T>,
    req: AuthenticatedRequest,
  ): ApiResponse<T[]> {
    return {
      success: true,
      message,
      data: result.data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string,
        pagination: result.meta,
      },
    };
  }
}
