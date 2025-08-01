import request from 'supertest';
import { app } from '@/app';
import { TestDatabase } from '../../helpers/testDatabase';
import { TestRedis } from '../../helpers/testRedis';
import { testDb } from '../../setup';
import { authFixtures } from '../../helpers/fixtures';

describe('POST /api/v1/auth/login', () => {
  let testDatabase: TestDatabase;
  let testRedis: TestRedis;

  beforeEach(async () => {
    testDatabase = new TestDatabase(testDb);
    testRedis = new TestRedis();

    await testDatabase.cleanAll();
    await testRedis.flush();
  });

  it('should login successfully with valid credentials', async () => {
    // Arrange
    await testDatabase.createTestUser({
      email: authFixtures.validLogin.email,
      password: 'hashed-password', // Usar password ya hasheado
    });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(authFixtures.validLogin)
      .expect(200);

    // Assert
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data).toHaveProperty('tokens');
    expect(response.body.data.tokens).toHaveProperty('accessToken');
    expect(response.body.data.tokens).toHaveProperty('refreshToken');
  });

  it('should return 401 for invalid credentials', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(authFixtures.invalidLogin)
      .expect(401);

    // Assert
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 for invalid request format', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invalid-email' })
      .expect(400);

    // Assert
    expect(response.body).toHaveProperty('success', false);
  });
});
