// ==============================================
// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from './environment';

declare global {
  var __taskDb__: PrismaClient | undefined;
}

// Singleton pattern para PrismaClient
let db: PrismaClient;

if (config.app.env === 'production') {
  db = new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'minimal',
  });
} else {
  // En desarrollo, usar global para evitar múltiples instancias con HMR
  if (!global.__taskDb__) {
    global.__taskDb__ = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty',
    });
  }
  db = global.__taskDb__;
}

// Event handlers para logging
db.$on('info' as never, (e: any) => {
  logger.info({ prisma: e }, 'Prisma info');
});

db.$on('warn' as never, (e: any) => {
  logger.warn({ prisma: e }, 'Prisma warning');
});

db.$on('error' as never, (e: any) => {
  logger.error({ prisma: e }, 'Prisma error');
});

// Función para conectar a la base de datos
export const connectDatabase = async (): Promise<void> => {
  try {
    await db.$connect();
    logger.info('Connected to Task Service PostgreSQL database successfully');
    
    // Health check de la base de datos
    await db.$queryRaw`SELECT 1`;
    logger.info('Task database health check passed');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to task database');
    throw error;
  }
};

// Función para desconectar de la base de datos
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await db.$disconnect();
    logger.info('Disconnected from task database');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from task database');
    throw error;
  }
};

// Función de cleanup para tareas completadas antiguas
export const cleanupOldCompletedTasks = async (daysOld: number = 90): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db.task.deleteMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lt: cutoffDate
        }
      }
    });
    
    logger.info({ deletedCount: result.count, daysOld }, 'Cleaned up old completed tasks');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup old completed tasks');
  }
};

// Función para actualizar estadísticas de usuario
export const updateUserStats = async (userId: string): Promise<void> => {
  try {
    const stats = await db.task.groupBy({
      by: ['status', 'priority'],
      where: { userId },
      _count: true,
    });

    const totalTasks = await db.task.count({ where: { userId } });
    const completedTasks = stats.find(s => s.status === 'COMPLETED')?._count || 0;
    const pendingTasks = stats.find(s => s.status === 'PENDING')?._count || 0;
    const inProgressTasks = stats.find(s => s.status === 'IN_PROGRESS')?._count || 0;
    
    const overdueTasks = await db.task.count({
      where: {
        userId,
        dueDate: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] }
      }
    });

    const urgentTasks = stats.find(s => s.priority === 'URGENT')?._count || 0;
    const highTasks = stats.find(s => s.priority === 'HIGH')?._count || 0;
    const mediumTasks = stats.find(s => s.priority === 'MEDIUM')?._count || 0;
    const lowTasks = stats.find(s => s.priority === 'LOW')?._count || 0;

    await db.taskStats.upsert({
      where: { userId },
      update: {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        overdueTasks,
        urgentTasks,
        highTasks,
        mediumTasks,
        lowTasks,
      },
      create: {
        userId,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        overdueTasks,
        urgentTasks,
        highTasks,
        mediumTasks,
        lowTasks,
      },
    });

    logger.info({ userId }, 'Updated user task statistics');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to update user stats');
  }
};

export { db };