// src/core/domain/interfaces/ICategoryService.ts
import { Category } from '@prisma/client';
import {
  CategoryWithTaskCount,
  CreateCategoryData,
  UpdateCategoryData,
  PaginatedCategoriesResult,
  SearchParams,
  PaginationParams,
} from './ICategoryRepository';

export interface CategoryStatsResponse {
  totalCategories: number;
  activeCategories: number;
  categoriesWithTasks: number;
  avgTasksPerCategory: number;
  mostUsedCategory?: {
    id: string;
    name: string;
    taskCount: number;
  };
}

export interface ICategoryService {
  createCategory(
    userId: string,
    data: Omit<CreateCategoryData, 'userId'>,
  ): Promise<Category>;

  getCategoryById(
    categoryId: string,
    userId: string,
  ): Promise<CategoryWithTaskCount>;

  getUserCategories(
    userId: string,
    includeTaskCount?: boolean,
  ): Promise<CategoryWithTaskCount[]>;

  searchUserCategories(
    userId: string,
    searchParams: SearchParams,
    paginationParams: PaginationParams,
  ): Promise<PaginatedCategoriesResult>;

  updateCategory(
    categoryId: string,
    userId: string,
    data: UpdateCategoryData,
  ): Promise<Category>;

  deleteCategory(categoryId: string, userId: string): Promise<void>;

  getCategoryTasks(
    categoryId: string,
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<unknown>;

  getCategoryStats(userId: string): Promise<CategoryStatsResponse>;

  validateCategoryOwnership(
    categoryId: string,
    userId: string,
  ): Promise<boolean>;

  checkCategoryLimit(userId: string): Promise<boolean>;

  getActiveCategories(userId: string): Promise<Category[]>;

  bulkDeleteCategories(categoryIds: string[], userId: string): Promise<void>;
}
