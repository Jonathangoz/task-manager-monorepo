import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { redisConnection } from '@/config/redis';
import { logger } from '@/utils/logger';

// Cargar variables de entorno para testing
config({ path: '.env.test' });

// Global test database instance
let testDb: PrismaClient;
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;

// Configuración global antes de todos los tests
beforeAll(async () => {
  // Silenciar logs durante testing (opcional)
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  console.log = jest.fn();
  console.error = jest.fn();

  // Inicializar base de datos de prueba
  testDb = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          'postgresql://test_user:test_password@localhost:5432/auth_test_db',
      },
    },
  });

  try {
    await testDb.$connect();

    // Ejecutar migraciones de prueba
    await testDb.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
    await testDb.$executeRaw`CREATE SCHEMA public`;

    // Aquí se ejecutarían las migraciones reales en un entorno real
    // Por ahora, creamos las tablas manualmente para testing
  } catch (error) {
    logger.error('Failed to setup test database:', error);
    throw error;
  }

  // Inicializar Redis para pruebas
  try {
    await redisConnection.connect();
  } catch (error) {
    logger.error('Failed to connect to test Redis:', error);
    throw error;
  }
});

// Limpieza después de todos los tests
afterAll(async () => {
  // Restaurar console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  // Limpiar base de datos
  if (testDb) {
    await testDb.$executeRaw`DROP SCHEMA public CASCADE`;
    await testDb.$disconnect();
  }

  // Desconectar Redis
  await redisConnection.disconnect();
});

// Limpieza entre tests
beforeEach(async () => {
  // Limpiar Redis cache
  const redis = redisConnection.getClient();
  await redis.flushdb();
});

// Exportar instancia de prueba
export { testDb };
