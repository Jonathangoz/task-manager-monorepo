// __tests__/unit/core/application/TaskService.test.ts
import { TaskService } from '@/core/application/TaskService';
import { ITaskRepository } from '@/core/domain/interfaces/ITaskRepository';
import { ICacheService } from '@/core/domain/interfaces/ICacheService';
import { fixtures, generateTestData } from '../../../helpers/fixtures';

// Mocks
const mockTaskRepository: jest.Mocked<ITaskRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findWithFilters: jest.fn(),
};

const mockCacheService: jest.Mocked<ICacheService> = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  invalidatePattern: jest.fn(),
};

describe('TaskService', () => {
  let taskService: TaskService;
  const userId = fixtures.users.john.id;

  beforeEach(() => {
    taskService = new TaskService(mockTaskRepository, mockCacheService);
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      // Arrange
      const taskData = generateTestData.task(userId);
      const expectedTask = { ...taskData, createdAt: new Date(), updatedAt: new Date() };
      
      mockTaskRepository.create.mockResolvedValue(expectedTask);

      // Act
      const result = await taskService.createTask(userId, taskData);

      // Assert
      expect(mockTaskRepository.create).toHaveBeenCalledWith({
        ...taskData,
        userId,
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(`user:${userId}:*`);
      expect(result).toEqual(expectedTask);
    });

    it('should throw error for invalid due date', async () => {
      // Arrange
      const taskData = generateTestData.task(userId, {
        dueDate: new Date(Date.now() - 1000), // Fecha en el pasado
      });

      // Act & Assert
      await expect(taskService.createTask(userId, taskData))
        .rejects
        .toThrow('Due date cannot be in the past');
    });
  });

  describe('getTasksByUser', () => {
    it('should return cached tasks when available', async () => {
      // Arrange
      const cachedTasks = [fixtures.tasks.pendingTask];
      mockCacheService.get.mockResolvedValue(cachedTasks);

      // Act
      const result = await taskService.getTasksByUser(userId, {});

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith(`user:${userId}:tasks`);
      expect(mockTaskRepository.findByUserId).not.toHaveBeenCalled();
      expect(result.data).toEqual(cachedTasks);
    });

    it('should fetch from repository when cache miss', async () => {
      // Arrange
      const tasks = [fixtures.tasks.pendingTask, fixtures.tasks.completedTask];
      mockCacheService.get.mockResolvedValue(null);
      mockTaskRepository.findByUserId.mockResolvedValue({
        data: tasks,
        total: tasks.length,
      });

      // Act
      const result = await taskService.getTasksByUser(userId, { page: 1, limit: 20 });

      // Assert
      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 20,
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `user:${userId}:tasks`,
        tasks,
        180
      );
      expect(result.data).toEqual(tasks);
    });
  });
});