// src/core/infrastructure/repositories/TaskRepository.ts
import { PrismaClient, Task, TaskStatus, Priority } from '@prisma/client';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { Task as TaskEntity } from '@/core/domain/entities/Task';
import { logger } from '@/utils/logger';
import { db } from '@/config/database';

export class TaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaClient = db) {}

  async create(taskData: Omit<TaskEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskEntity> {
    try {
      const task = await this.prisma.task.create({
        data: {
          title: taskData.title,
          description: taskData.description,
          status: taskData.status as TaskStatus,
          priority: taskData.priority as Priority,
          dueDate: taskData.dueDate,
          userId: taskData.userId,
          categoryId: taskData.categoryId,
          tags: taskData.tags || [],
          estimatedHours: taskData.estimatedHours,
          attachments: taskData.attachments || [],
        },
        include: {
          category: true,
        },
      });

      logger.info({ taskId: task.id, userId: taskData.userId }, 'Task created successfully');
      return this.mapToEntity(task);
    } catch (error) {
      logger.error({ error, taskData }, 'Failed to create task');
      throw error;
    }
  }

  async findById(id: string, userId: string): Promise<TaskEntity | null> {
    try {
      const task = await this.prisma.task.findFirst({
        where: { id, userId },
        include: { category: true },
      });

      return task ? this.mapToEntity(task) : null;
    } catch (error) {
      logger.error({ error, id, userId }, 'Failed to find task by id');
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: TaskStatus[];
      priority?: Priority[];
      categoryId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      dueDateFrom?: Date;
      dueDateTo?: Date;
      isOverdue?: boolean;
    } = {}
  ): Promise<{ tasks: TaskEntity[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        categoryId,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dueDateFrom,
        dueDateTo,
        isOverdue,
      } = options;

      const skip = (page - 1) * limit;
      const where: any = { userId };

      // Apply filters
      if (status?.length) where.status = { in: status };
      if (priority?.length) where.priority = { in: priority };
      if (categoryId) where.categoryId = categoryId;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (dueDateFrom || dueDateTo) {
        where.dueDate = {};
        if (dueDateFrom) where.dueDate.gte = dueDateFrom;
        if (dueDateTo) where.dueDate.lte = dueDateTo;
      }
      if (isOverdue === true) {
        where.dueDate = { lt: new Date() };
        where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      }

      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where,
          include: { category: true },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.task.count({ where }),
      ]);

      return {
        tasks: tasks.map(this.mapToEntity),
        total,
      };
    } catch (error) {
      logger.error({ error, userId, options }, 'Failed to find tasks by user');
      throw error;
    }
  }

  async update(id: string, userId: string, updates: Partial<TaskEntity>): Promise<TaskEntity | null> {
    try {
      const task = await this.prisma.task.updateMany({
        where: { id, userId },
        data: {
          ...(updates.title && { title: updates.title }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.status && { status: updates.status as TaskStatus }),
          ...(updates.priority && { priority: updates.priority as Priority }),
          ...(updates.dueDate !== undefined && { dueDate: updates.dueDate }),
          ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
          ...(updates.tags && { tags: updates.tags }),
          ...(updates.estimatedHours !== undefined && { estimatedHours: updates.estimatedHours }),
          ...(updates.actualHours !== undefined && { actualHours: updates.actualHours }),
          ...(updates.attachments && { attachments: updates.attachments }),
          ...(updates.completedAt !== undefined && { completedAt: updates.completedAt }),
        },
      });

      if (task.count === 0) return null;

      const updatedTask = await this.findById(id, userId);
      if (updatedTask) {
        logger.info({ taskId: id, userId }, 'Task updated successfully');
      }

      return updatedTask;
    } catch (error) {
      logger.error({ error, id, userId, updates }, 'Failed to update task');
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.task.deleteMany({
        where: { id, userId },
      });

      const deleted = result.count > 0;
      if (deleted) {
        logger.info({ taskId: id, userId }, 'Task deleted successfully');
      }

      return deleted;
    } catch (error) {
      logger.error({ error, id, userId }, 'Failed to delete task');
      throw error;
    }
  }

  async updateStatus(id: string, userId: string, status: TaskStatus): Promise<TaskEntity | null> {
    try {
      const updates: any = { status };
      if (status === 'COMPLETED') {
        updates.completedAt = new Date();
      }

      return this.update(id, userId, updates);
    } catch (error) {
      logger.error({ error, id, userId, status }, 'Failed to update task status');
      throw error;
    }
  }

  async findOverdueTasks(userId: string): Promise<TaskEntity[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: { category: true },
        orderBy: { dueDate: 'asc' },
      });

      return tasks.map(this.mapToEntity);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to find overdue tasks');
      throw error;
    }
  }

  async countTasksByStatus(userId: string): Promise<Record<TaskStatus, number>> {
    try {
      const results = await this.prisma.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: { id: true },
      });

      const counts: Record<TaskStatus, number> = {
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        ON_HOLD: 0,
      };

      results.forEach((result) => {
        counts[result.status] = result._count.id;
      });

      return counts;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count tasks by status');
      throw error;
    }
  }

  private mapToEntity(task: any): TaskEntity {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      userId: task.userId,
      categoryId: task.categoryId,
      category: task.category
        ? {
            id: task.category.id,
            name: task.category.name,
            description: task.category.description,
            color: task.category.color,
            icon: task.category.icon,
          }
        : null,
      tags: task.tags || [],
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      attachments: task.attachments || [],
    };
  }
}