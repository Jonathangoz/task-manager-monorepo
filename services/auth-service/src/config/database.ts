// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from './environment';

declare global {
  var __db__: PrismaClient | undefined;
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
  if (!global.__db__) {
    global.__db__ = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty',
    });
  }
  db = global.__db__;
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
    logger.info('Connected to PostgreSQL database successfully');
    
    // Health check de la base de datos
    await db.$queryRaw`SELECT 1`;
    logger.info('Database health check passed');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
};

// Función para desconectar de la base de datos
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await db.$disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from database');
    throw error;
  }
};

// Función de cleanup para migraciones
export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    const result = await db.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true }
        ]
      }
    });
    
    logger.info({ deletedCount: result.count }, 'Cleaned up expired refresh tokens');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired tokens');
  }
};

// Función de cleanup para sesiones
export const cleanupExpiredSessions = async (): Promise<void> => {
  try {
    const result = await db.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false }
        ]
      }
    });
    
    logger.info({ deletedCount: result.count }, 'Cleaned up expired sessions');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired sessions');
  }
};

export { db };