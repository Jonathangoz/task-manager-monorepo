import request from 'supertest';
import { app } from '@/app';
import { TestDatabase } from '../../helpers/testDatabase';
import { TestRedis } from '../../helpers/testRedis';
import { testDb } from '../../setup';
import { authFixtures, sessionFixtures } from '../../helpers/fixtures';
import { HTTP_STATUS } from '@/utils/constants';

describe('POST /api/v1/auth/refresh', () => {
  let testDatabase: TestDatabase;
  let testRedis: TestRedis;
  let testUser: any;
  let validRefreshToken: string;

  beforeEach(async () => {
    testDatabase = new TestDatabase(testDb);
    testRedis = new TestRedis();

    await testDatabase.cleanAll();
    await testRedis.flush();

    // Crear usuario de prueba
    testUser = await testDatabase.createTestUser();

    // Hacer login para obtener refresh token válido
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'Password123!', // Password sin hashear para login
    });

    validRefreshToken = loginResponse.body.data.tokens.refreshToken;
  });

  it('should refresh tokens successfully with valid refresh token', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken })
      .expect(HTTP_STATUS.OK);

    // Assert
    expect(response.body).toMatchObject({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
        },
      },
    });

    // Verificar que el nuevo refresh token es diferente
    expect(response.body.data.tokens.refreshToken).not.toBe(validRefreshToken);
  });

  it('should return 401 for invalid refresh token', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid-refresh-token' })
      .expect(HTTP_STATUS.UNAUTHORIZED);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_INVALID',
      },
    });
  });

  it('should return 401 for expired refresh token', async () => {
    // Arrange - Crear token expirado en DB
    const expiredToken = await testDatabase.createRefreshToken(testUser.id, {
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 1000), // Expirado hace 1 segundo
    });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'expired-token' })
      .expect(HTTP_STATUS.UNAUTHORIZED);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_EXPIRED',
      },
    });
  });

  it('should return 401 for revoked refresh token', async () => {
    // Arrange - Crear token revocado en DB
    const revokedToken = await testDatabase.createRefreshToken(testUser.id, {
      token: 'revoked-token',
      isRevoked: true,
    });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'revoked-token' })
      .expect(HTTP_STATUS.UNAUTHORIZED);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_INVALID',
      },
    });
  });

  it('should update session last seen time', async () => {
    // Arrange
    const session = await testDatabase.createUserSession(testUser.id);
    const originalLastSeen = session.lastSeen;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Act
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken })
      .expect(HTTP_STATUS.OK);

    // Assert
    const updatedSession = await testDb.userSession.findUnique({
      where: { id: session.id },
    });

    expect(updatedSession?.lastSeen.getTime()).toBeGreaterThan(
      originalLastSeen.getTime(),
    );
  });
});
