// ==============================================
// src/config/database.ts - Task Service Database Configuration
// Configuración centralizada de Prisma con logging, health checks y mantenimiento
// ==============================================

import { PrismaClient } from '@prisma/client';
import type { TaskStatus, Priority } from '@prisma/client';
import { logger, loggers, logError, healthCheck } from '@/utils/logger';
import { config } from './environment';

// ==============================================
// TIPOS Y CONFIGURACIÓN
// ==============================================
interface DatabaseStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  highTasks: number;
  mediumTasks: number;
  lowTasks: number;
}

interface StatusGroupBy {
  status: TaskStatus;
  _count: {
    status: number;
  };
}

interface PriorityGroupBy {
  priority: Priority;
  _count: {
    priority: number;
  };
}

// ==============================================
// GLOBAL TYPE DECLARATION
// ==============================================
declare global {
  var __taskServiceDb__: PrismaClient | undefined;
}

// ==============================================
// PRISMA CLIENT SINGLETON
// ==============================================
class TaskDatabase {
  private static instance: TaskDatabase;
  private client: PrismaClient;
  private isConnected = false;
  private connectionStartTime = 0;

  private constructor() {
    this.client = this.createPrismaClient();
    this.setupEventHandlers();
  }

  public static getInstance(): TaskDatabase {
    if (!TaskDatabase.instance) {
      TaskDatabase.instance = new TaskDatabase();
    }
    return TaskDatabase.instance;
  }

  private createPrismaClient(): PrismaClient {
    const clientConfig = {
      datasources: {
        db: {
          url: config.database.url,
        },
      },
    };

    if (config.app.isProduction) {
      // Configuración para producción
      return new PrismaClient({
        ...clientConfig,
        log: [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
        errorFormat: 'minimal',
      });
    } else {
      // Configuración para desarrollo con singleton global
      if (!global.__taskServiceDb__) {
        global.__taskServiceDb__ = new PrismaClient({
          ...clientConfig,
          log: [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
          errorFormat: 'pretty',
        });
      }
      return global.__taskServiceDb__;
    }
  }

  private setupEventHandlers(): void {
    // Manejo de logs de Prisma con nuestro logger estructurado
    this.client.$on('query' as never, (e: any) => {
      const duration = e.duration;
      const target = e.target;
      
      loggers.dbQuery('query', target, duration);
      
      // Detectar queries lentas
      const slowQueryThreshold = 1000; // 1 segundo
      if (duration > slowQueryThreshold) {
        loggers.slowQuery('query', target, duration, slowQueryThreshold);
      }
    });

    this.client.$on('info' as never, (e: any) => {
      logger.info({ prisma: e, domain: 'database' }, `📊 Prisma info: ${e.message}`);
    });

    this.client.$on('warn' as never, (e: any) => {
      logger.warn({ 
        prisma: e, 
        domain: 'database',
        event: 'db.warning' 
      }, `⚠️ Prisma warning: ${e.message}`);
    });

    this.client.$on('error' as never, (e: any) => {
      loggers.dbError(new Error(e.message), 'prisma_event');
    });
  }

  // ==============================================
  // CONEXIÓN Y SALUD DE LA BASE DE DATOS
  // ==============================================
  public async connect(): Promise<void> {
    const startTime = Date.now();
    this.connectionStartTime = startTime;

    try {
      await this.client.$connect();
      const duration = Date.now() - startTime;
      
      // Health check inicial
      await this.client.$queryRaw`SELECT 1 as health_check`;
      
      this.isConnected = true;
      
      loggers.dbConnection('connected', {
        duration,
        url: this.maskDatabaseUrl(config.database.url),
        timestamp: new Date().toISOString(),
      });

      healthCheck.passed('database', duration, {
        prismaVersion: '6.12.0',
        connectionPool: 'active',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.isConnected = false;
      
      loggers.dbConnection('error', { 
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      healthCheck.failed('database', error as Error, duration);
      logError.critical(error as Error, { 
        context: 'database_connection',
        duration,
        url: this.maskDatabaseUrl(config.database.url),
      });
      
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.client.$disconnect();
      const duration = Date.now() - startTime;
      
      this.isConnected = false;
      
      loggers.dbConnection('disconnected', { 
        duration,
        uptime: Date.now() - this.connectionStartTime,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError.high(error as Error, {
        context: 'database_disconnection',
        duration,
      });
      
      throw error;
    }
  }

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const startTime = Date.now();
    
    try {
      // Test de conectividad básico
      const result = await this.client.$queryRaw`SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        NOW() as server_time`;
      
      const duration = Date.now() - startTime;
      
      // Test de conteo rápido
      const taskCount = await this.client.task.count();
      const categoryCount = await this.client.category.count();
      
      const details = {
        connected: this.isConnected,
        responseTime: duration,
        database: result,
        stats: {
          totalTasks: taskCount,
          totalCategories: categoryCount,
        },
        uptime: Date.now() - this.connectionStartTime,
      };

      if (duration < 100) {
        healthCheck.passed('database', duration, details);
      } else if (duration < 500) {
        healthCheck.degraded('database', `Slow response: ${duration}ms`, duration);
      } else {
        healthCheck.failed('database', new Error(`Very slow response: ${duration}ms`), duration);
      }

      return {
        healthy: true,
        details,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      healthCheck.failed('database', error as Error, duration);
      
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
          duration,
          connected: this.isConnected,
        },
      };
    }
  }

  public getClient(): PrismaClient {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  // ==============================================
  // OPERACIONES DE MANTENIMIENTO
  // ==============================================
  public async cleanupOldCompletedTasks(daysOld: number = 90): Promise<number> {
    const startTime = Date.now();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await this.client.task.deleteMany({
        where: {
          status: 'COMPLETED',
          completedAt: {
            lt: cutoffDate,
          },
        },
      });

      const duration = Date.now() - startTime;
      
      // Corregido: pasar count como string
      loggers.dbQuery('cleanup', 'tasks', duration, result.count.toString());
      
      logger.info({
        deletedCount: result.count,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
        duration,
        event: 'maintenance.cleanup.completed',
        domain: 'database',
      }, `🧹 Limpieza de tareas completadas: ${result.count} eliminadas (>${daysOld} días)`);

      return result.count;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'cleanup_old_tasks');
      logError.medium(error as Error, {
        context: 'cleanup_old_completed_tasks',
        daysOld,
        duration,
      });
      
      throw error;
    }
  }

  public async updateUserStats(userId: string): Promise<DatabaseStats> {
    const startTime = Date.now();
    
    try {
      // Obtener estadísticas agrupadas - removido el cast as
      const statusStats = await this.client.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
      });

      const priorityStats = await this.client.task.groupBy({
        by: ['priority'],
        where: { userId },
        _count: { priority: true },
      });

      // Contar tareas vencidas
      const overdueTasks = await this.client.task.count({
        where: {
          userId,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });

      // Calcular totales con tipos seguros
      const totalTasks = statusStats.reduce((sum: number, stat) => 
        sum + stat._count.status, 0);
      
      const completedTasks = statusStats.find((s) => 
        s.status === 'COMPLETED')?._count.status || 0;
      
      const pendingTasks = statusStats.find((s) => 
        s.status === 'PENDING')?._count.status || 0;
      
      const inProgressTasks = statusStats.find((s) => 
        s.status === 'IN_PROGRESS')?._count.status || 0;

      const urgentTasks = priorityStats.find((p) => 
        p.priority === 'URGENT')?._count.priority || 0;
      
      const highTasks = priorityStats.find((p) => 
        p.priority === 'HIGH')?._count.priority || 0;
      
      const mediumTasks = priorityStats.find((p) => 
        p.priority === 'MEDIUM')?._count.priority || 0;
      
      const lowTasks = priorityStats.find((p) => 
        p.priority === 'LOW')?._count.priority || 0;

      const statsData: DatabaseStats = {
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        overdueTasks,
        urgentTasks,
        highTasks,
        mediumTasks,
        lowTasks,
      };

      // Actualizar o crear estadísticas
      await this.client.taskStats.upsert({
        where: { userId },
        update: statsData,
        create: {
          userId,
          ...statsData,
        },
      });

      const duration = Date.now() - startTime;
      
      // Corregido: pasar 1 como string
      loggers.dbQuery('update_stats', 'task_stats', duration, '1');
      
      logger.info({
        userId,
        stats: statsData,
        duration,
        event: 'stats.updated',
        domain: 'database',
      }, `📊 Estadísticas de usuario actualizadas: ${totalTasks} tareas totales`);

      return statsData;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'update_user_stats', 'task_stats');
      logError.medium(error as Error, {
        context: 'update_user_stats',
        userId,
        duration,
      });
      
      throw error;
    }
  }

  public async getUserStats(userId: string): Promise<DatabaseStats | null> {
    const startTime = Date.now();
    
    try {
      const stats = await this.client.taskStats.findUnique({
        where: { userId },
      });

      const duration = Date.now() - startTime;
      
      // Corregido: pasar count como string
      loggers.dbQuery('get_stats', 'task_stats', duration, stats ? '1' : '0');

      return stats;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      loggers.dbError(error as Error, 'get_user_stats', 'task_stats');
      logError.low(error as Error, {
        context: 'get_user_stats',
        userId,
        duration,
      });
      
      return null;
    }
  }

  // ==============================================
  // OPERACIONES DE ANÁLISIS
  // ==============================================
  public async getDatabaseMetrics(): Promise<any> {
    try {
      const [taskCount, categoryCount, userCount, activeUsers] = await Promise.all([
        this.client.task.count(),
        this.client.category.count(),
        this.client.taskStats.count(),
        this.client.task.groupBy({
          by: ['userId'],
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Última semana
            },
          },
          _count: { userId: true },
        }),
      ]);

      return {
        totalTasks: taskCount,
        totalCategories: categoryCount,
        totalUsers: userCount,
        activeUsersLastWeek: activeUsers.length,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      loggers.dbError(error as Error, 'get_database_metrics');
      throw error;
    }
  }

  // ==============================================
  // UTILIDADES PRIVADAS
  // ==============================================
  private maskDatabaseUrl(url: string): string {
    // Enmascarar credenciales en la URL para logs
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }
}

// ==============================================
// INSTANCIA SINGLETON EXPORTADA
// ==============================================
export const taskDatabase = TaskDatabase.getInstance();
export const db = taskDatabase.getClient();

// ==============================================
// FUNCIONES DE CONVENIENCIA EXPORTADAS
// ==============================================
export const connectDatabase = () => taskDatabase.connect();
export const disconnectDatabase = () => taskDatabase.disconnect();
export const cleanupOldCompletedTasks = (daysOld?: number) => 
  taskDatabase.cleanupOldCompletedTasks(daysOld);
export const updateUserStats = (userId: string) => 
  taskDatabase.updateUserStats(userId);
export const getUserStats = (userId: string) => 
  taskDatabase.getUserStats(userId);
export const getDatabaseMetrics = () => 
  taskDatabase.getDatabaseMetrics();
export const isDatabaseHealthy = () => 
  taskDatabase.isHealthy();
export const databaseHealthCheck = () => 
  taskDatabase.healthCheck();

// ==============================================
// INICIALIZACIÓN EN DESARROLLO
// ==============================================
if (config.app.isDevelopment) {
  logger.info({
    databaseUrl: taskDatabase['maskDatabaseUrl'](config.database.url),
    prismaVersion: '6.12.0',
    env: config.app.env,
  }, '🗄️ Configuración de base de datos cargada para Task Service');
}