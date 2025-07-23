import { v4 as uuidv4 } from 'uuid';
import { addDays, subDays } from 'date-fns';

export const fixtures = {
  // Usuarios de prueba
  users: {
    john: {
      id: 'user-john-123',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    jane: {
      id: 'user-jane-456',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  },

  // Categorías de prueba
  categories: {
    work: {
      id: uuidv4(),
      name: 'Work',
      description: 'Work related tasks',
      color: '#3b82f6',
      icon: 'briefcase',
      userId: 'user-john-123',
      isActive: true,
    },
    personal: {
      id: uuidv4(),
      name: 'Personal',
      description: 'Personal tasks',
      color: '#10b981',
      icon: 'user',
      userId: 'user-john-123',
      isActive: true,
    },
  },

  // Tareas de prueba
  tasks: {
    pendingTask: {
      id: uuidv4(),
      title: 'Complete project documentation',
      description: 'Write comprehensive documentation for the new feature',
      status: 'PENDING',
      priority: 'HIGH',
      userId: 'user-john-123',
      dueDate: addDays(new Date(), 7),
      tags: ['documentation', 'project'],
    },
    completedTask: {
      id: uuidv4(),
      title: 'Review pull request',
      description: 'Review the new authentication feature PR',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      userId: 'user-john-123',
      completedAt: subDays(new Date(), 1),
      tags: ['review', 'code'],
    },
    overdueTask: {
      id: uuidv4(),
      title: 'Fix critical bug',
      description: 'Address the login issue reported by users',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      userId: 'user-john-123',
      dueDate: subDays(new Date(), 2),
      tags: ['bug', 'critical'],
    },
  },

  // Estadísticas de prueba
  stats: {
    johnStats: {
      userId: 'user-john-123',
      totalTasks: 10,
      completedTasks: 5,
      pendingTasks: 3,
      inProgressTasks: 2,
      overdueTasks: 1,
      urgentTasks: 1,
      highTasks: 3,
      mediumTasks: 4,
      lowTasks: 2,
    },
  },

  // Request bodies para API tests
  requests: {
    createTask: {
      title: 'New test task',
      description: 'This is a test task',
      priority: 'MEDIUM',
      dueDate: addDays(new Date(), 5).toISOString(),
      tags: ['test', 'api'],
    },
    updateTask: {
      title: 'Updated test task',
      description: 'This task has been updated',
      priority: 'HIGH',
    },
    createCategory: {
      name: 'Test Category',
      description: 'A category for testing',
      color: '#ef4444',
      icon: 'tag',
    },
  },
};

// Helper para generar datos aleatorios
export const generateTestData = {
  user: (override: Partial<any> = {}) => ({
    id: uuidv4(),
    email: `test${Math.random().toString(36).substr(2, 9)}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    ...override,
  }),

  category: (userId: string, override: Partial<any> = {}) => ({
    id: uuidv4(),
    name: `Category ${Math.random().toString(36).substr(2, 5)}`,
    description: 'Test category',
    color: '#6366f1',
    icon: 'folder',
    userId,
    isActive: true,
    ...override,
  }),

  task: (userId: string, override: Partial<any> = {}) => ({
    id: uuidv4(),
    title: `Task ${Math.random().toString(36).substr(2, 8)}`,
    description: 'Test task description',
    status: 'PENDING',
    priority: 'MEDIUM',
    userId,
    tags: ['test'],
    ...override,
  }),
};