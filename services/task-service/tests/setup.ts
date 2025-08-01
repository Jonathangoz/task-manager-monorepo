import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { testDb } from './helpers/testDb';
import { testRedis } from './helpers/testRedis';
import { logger } from '@/utils/logger';

// Configurar logger para tests
logger.level = 'silent';

// Setup global antes de todas las pruebas
beforeAll(async () => {
  // Conectar a base de datos de prueba
  await testDb.connect();

  // Conectar a Redis de prueba
  await testRedis.connect();

  console.log('🧪 Test environment setup complete');
});

// Cleanup después de todas las pruebas
afterAll(async () => {
  await testDb.disconnect();
  await testRedis.disconnect();

  console.log('🧹 Test environment cleanup complete');
});

// Limpiar datos antes de cada prueba
beforeEach(async () => {
  await testDb.clearAll();
  await testRedis.flushAll();
});

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://test_user:test_password@localhost:5432/task_test_db';
process.env.REDIS_URL = 'redis://localhost:/1';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.LOG_LEVEL = 'silent';
