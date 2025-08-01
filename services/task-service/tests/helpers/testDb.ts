import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

class TestDatabase {
  private prisma: PrismaClient;
  private static instance: TestDatabase;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async connect(): Promise<void> {
    try {
      // Aplicar migraciones
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        stdio: 'ignore',
      });

      await this.prisma.$connect();
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async clearAll(): Promise<void> {
    // Limpiar en orden correcto (considerando foreign keys)
    await this.prisma.task.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.taskStats.deleteMany();
  }

  getClient(): PrismaClient {
    return this.prisma;
  }

  // Métodos helper para crear datos de prueba
  async createTestUser(userId: string): Promise<void> {
    // En el Task Service no tenemos tabla de usuarios,
    // pero podemos crear estadísticas base
    await this.prisma.taskStats.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        urgentTasks: 0,
        highTasks: 0,
        mediumTasks: 0,
        lowTasks: 0,
      },
    });
  }

  async createTestCategory(data: any) {
    return this.prisma.category.create({ data });
  }

  async createTestTask(data: any) {
    return this.prisma.task.create({ data });
  }
}

export const testDb = TestDatabase.getInstance();
