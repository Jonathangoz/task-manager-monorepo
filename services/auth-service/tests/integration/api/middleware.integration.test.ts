import request from 'supertest';
import { app } from '@/app';
import { TestDatabase } from '../../helpers/testDatabase';
import { TestRedis } from '../../helpers/testRedis';
import { testDb } from '../../setup';
import { HTTP_STATUS } from '@/utils/constants';

describe('Middleware Integration Tests', () => {
  let testDatabase: TestDatabase;
  let testRedis: TestRedis;
  let testUser: any;
  let accessToken: string;

  beforeEach(async () => {
    testDatabase = new TestDatabase(testDb);
    testRedis = new TestRedis();

    await testDatabase.cleanAll();
    await testRedis.flush();

    // Crear usuario y obtener token para pruebas de autenticación
    testUser = await testDatabase.createTestUser();

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'Password123!',
    });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  describe('Rate Limiting Middleware', () => {
    it('should allow requests within rate limit', async () => {
      // Act & Assert - Hacer múltiples requests dentro del límite
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
          .expect(HTTP_STATUS.UNAUTHORIZED); // Error esperado por credenciales, no por rate limit
      }
    });

    it('should block requests when rate limit exceeded', async () => {
      // Arrange - Simular muchos requests rápidos
      const requests = Array(101)
        .fill(null)
        .map(() =>
          request(app).post('/api/v1/auth/login').send({
            email: 'test@example.com',
            password: 'wrongpassword',
          }),
        );

      // Act
      const responses = await Promise.all(requests);

      // Assert - Los últimos requests deberían ser bloqueados
      const rateLimitedResponses = responses.filter(
        (res) => res.status === HTTP_STATUS.TOO_MANY_REQUESTS,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Middleware', () => {
    it('should allow access to protected routes with valid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(HTTP_STATUS.OK);

      // Assert
      expect(response.body.success).toBe(true);
    });

    it('should deny access to protected routes without token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/user/profile')
        .expect(HTTP_STATUS.UNAUTHORIZED);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
        },
      });
    });

    it('should deny access with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(HTTP_STATUS.UNAUTHORIZED);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
        },
      });
    });
  });

  describe('Validation Middleware', () => {
    it('should validate request body correctly', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          username: '', // Campo requerido vacío
          password: '123', // Password muy corto
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('valid email'),
            }),
            expect.objectContaining({
              field: 'username',
              message: expect.stringContaining('required'),
            }),
            expect.objectContaining({
              field: 'password',
              message: expect.stringContaining('length'),
            }),
          ]),
        },
      });
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle and format errors consistently', async () => {
      // Act - Intentar login con usuario inexistente
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'somepassword',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: {
          code: expect.any(String),
        },
        meta: {
          timestamp: expect.any(String),
        },
      });
    });
  });
});
