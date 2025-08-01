// __tests__/integration/api/tasks.integration.test.ts
import request from 'supertest';
import { app } from '@/app';
import { testDb } from '../../helpers/testDb';
import { AuthTestHelper } from '../../helpers/authHelper';
import { fixtures, generateTestData } from '../../helpers/fixtures';

describe('Tasks API Integration', () => {
  const userId = fixtures.users.john.id;
  let authToken: string;

  beforeEach(async () => {
    // Crear token válido
    authToken = await AuthTestHelper.createValidToken(
      userId,
      fixtures.users.john.email,
    );

    // Preparar datos de prueba
    await testDb.createTestUser(userId);
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task', async () => {
      // Arrange
      const taskData = fixtures.requests.createTask;

      // Act
      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        message: 'Task created successfully',
        data: {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          status: 'PENDING',
          userId,
        },
      });

      // Verificar en base de datos
      const createdTask = await testDb.getClient().task.findUnique({
        where: { id: response.body.data.id },
      });
      expect(createdTask).toBeTruthy();
      expect(createdTask?.title).toBe(taskData.title);
    });

    it('should return 401 without authentication', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/tasks')
        .send(fixtures.requests.createTask)
        .expect(401);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
        },
      });
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const invalidTaskData = {
        title: '', // Título vacío
        description: 'Test description',
      };

      // Act
      const response = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTaskData)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('GET /api/v1/tasks', () => {
    beforeEach(async () => {
      // Crear tareas de prueba
      await testDb.createTestTask({
        ...fixtures.tasks.pendingTask,
        userId,
      });
      await testDb.createTestTask({
        ...fixtures.tasks.completedTask,
        userId,
      });
    });

    it('should return paginated tasks', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/tasks?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/tasks?status=PENDING')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('PENDING');
    });
  });
});
