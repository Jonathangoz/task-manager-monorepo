// src/core/domain/interfaces/ICategoryRepository.ts
import { Category } from '@prisma/client';

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  userId: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export interface CategoryWithTaskCount extends Category {
  _count?: {
    tasks: number;
  };
}

export interface ICategoryRepository {
  create(data: CreateCategoryData): Promise<Category>;
  
  findById(id: string): Promise<CategoryWithTaskCount | null>;
  
  findByUserId(userId: string, includeTaskCount?: boolean): Promise<CategoryWithTaskCount[]>;
  
  findByName(userId: string, name: string): Promise<Category | null>;
  
  update(id: string, data: UpdateCategoryData): Promise<Category>;
  
  delete(id: string): Promise<void>;
  
  countByUserId(userId: string): Promise<number>;
  
  findActiveByUserId(userId: string): Promise<Category[]>;
  
  hasActiveTasks(categoryId: string): Promise<boolean>;
  
  bulkDelete(ids: string[]): Promise<void>;
}