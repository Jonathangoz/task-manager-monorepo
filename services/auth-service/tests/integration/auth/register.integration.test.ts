import request from 'supertest';
import { app } from '@/app';
import { TestDatabase } from '../../helpers/testDatabase';
import { TestRedis } from '../../helpers/testRedis';
import { testDb } from '../../setup';
import { authFixtures } from '../../helpers/fixtures';
import { HTTP_STATUS } from '@/utils/constants';

describe('POST /api/v1/auth/register', () => {
  let testDatabase: TestDatabase;
  let testRedis: TestRedis;

  beforeEach(async () => {
    testDatabase = new TestDatabase(testDb);
    testRedis = new TestRedis();
    
    await testDatabase.cleanAll();
    await testRedis.flush();
  });

  it('should register user successfully with valid data', async () => {
    // Arrange
    const registerData = authFixtures.validRegister;

    // Act
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registerData)
      .expect(HTTP_STATUS.CREATED);

    // Assert
    expect(response.body).toMatchObject({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          email: registerData.email,
          username: registerData.username,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          isActive: true,
          isVerified: false
        }
      }
    });

    // Verificar que el usuario se guardó en la base de datos
    const savedUser = await testDb.user.findUnique({
      where: { email: registerData.email }
    });
    expect(savedUser).toBeTruthy();
    expect(savedUser?.password).not.toBe(registerData.password); // Password debe estar hasheado
  });

  it('should return 400 for invalid email format', async () => {
    // Arrange
    const invalidData = {
      ...authFixtures.validRegister,
      email: 'invalid-email-format'
    };

    // Act
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(invalidData)
      .expect(HTTP_STATUS.BAD_REQUEST);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR'
      }
    });
  });

  it('should return 409 when user already exists', async () => {
    // Arrange
    const registerData = authFixtures.validRegister;
    
    // Crear usuario existente
    await testDatabase.createTestUser({
      email: registerData.email,
      username: registerData.username
    });

    // Act
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registerData)
      .expect(HTTP_STATUS.CONFLICT);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'USER_ALREADY_EXISTS'
      }
    });
  });

  it('should return 400 for weak password', async () => {
    // Arrange
    const weakPasswordData = {
      ...authFixtures.validRegister,
      password: '123' // Password muy débil
    };

    // Act
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(weakPasswordData)
      .expect(HTTP_STATUS.BAD_REQUEST);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR'
      }
    });
  });

  it('should handle database errors gracefully', async () => {
    // Arrange
    const registerData = authFixtures.validRegister;
    
    // Simular error de DB desconectando temporalmente
    await testDb.$disconnect();

    // Act
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registerData)
      .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

    // Assert
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INTERNAL_ERROR'
      }
    });

    // Reconectar para próximos tests
    await testDb.$connect();
  });
});