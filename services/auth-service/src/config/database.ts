// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { environment } from './environment';

declare global {
  var __db__: PrismaClient | undefined;
}

// Singleton pattern para PrismaClient
let db: PrismaClient;

if (environment.app.isProduction) {
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

// Función de cleanup para tokens de refresh expirados
export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    // Usar el nombre correcto del modelo: refreshToken (camelCase)
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
    logger.error({ error }, 'Failed to cleanup expired refresh tokens');
  }
};

// Función de cleanup para sesiones expiradas
export const cleanupExpiredSessions = async (): Promise<void> => {
  try {
    // Usar el nombre correcto del modelo: userSession (camelCase)
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

// Función de cleanup para tokens de verificación expirados
export const cleanupExpiredVerificationTokens = async (): Promise<void> => {
  try {
    const result = await db.verificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } }
        ]
      }
    });
    
    logger.info({ deletedCount: result.count }, 'Cleaned up expired verification tokens');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup expired verification tokens');
  }
};

// Función de cleanup para intentos de login antiguos
export const cleanupOldLoginAttempts = async (): Promise<void> => {
  try {
    // Eliminar intentos de login más antiguos de 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo }
      }
    });
    
    logger.info({ deletedCount: result.count }, 'Cleaned up old login attempts');
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup old login attempts');
  }
};

// Función de cleanup completa (ejecutar periódicamente)
export const runDatabaseCleanup = async (): Promise<void> => {
  logger.info('Starting database cleanup...');
  
  try {
    await Promise.allSettled([
      cleanupExpiredTokens(),
      cleanupExpiredSessions(),
      cleanupExpiredVerificationTokens(),
      cleanupOldLoginAttempts()
    ]);
    
    logger.info('Database cleanup completed');
  } catch (error) {
    logger.error({ error }, 'Database cleanup failed');
  }
};

// Función para verificar la salud de la base de datos
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Función para obtener estadísticas de la base de datos
export const getDatabaseStats = async () => {
  try {
    const [
      userCount,
      activeUserCount,
      refreshTokenCount,
      activeSessionCount,
      recentLoginAttempts
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.refreshToken.count({ where: { isRevoked: false, expiresAt: { gt: new Date() } } }),
      db.userSession.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
      db.loginAttempt.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
        }
      })
    ]);

    return {
      users: {
        total: userCount,
        active: activeUserCount
      },
      tokens: {
        refreshTokens: refreshTokenCount
      },
      sessions: {
        active: activeSessionCount
      },
      security: {
        recentLoginAttempts
      }
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get database stats');
    throw error;
  }
};

export { db };