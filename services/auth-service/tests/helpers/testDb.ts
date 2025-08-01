import { PrismaClient, User } from '@prisma/client';
import { hashPassword } from '@/utils/crypto';

export class TestDatabase {
  constructor(private prisma: PrismaClient) {}

  async cleanAll(): Promise<void> {
    // Limpiar en orden correcto debido a foreign keys
    await this.prisma.loginAttempt.deleteMany();
    await this.prisma.userSession.deleteMany();
    await this.prisma.refreshToken.deleteMany();
    await this.prisma.user.deleteMany();
  }

  async createTestUser(overrides?: Partial<User>): Promise<User> {
    const defaultUser = {
      email: 'test@example.com',
      username: 'testuser',
      password: await hashPassword('Password123!'),
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      isVerified: true,
      ...overrides,
    };

    return this.prisma.user.create({
      data: defaultUser,
    });
  }

  async createMultipleUsers(count: number): Promise<User[]> {
    const users: User[] = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        email: `test${i}@example.com`,
        username: `testuser${i}`,
      });
      users.push(user);
    }

    return users;
  }

  async createRefreshToken(userId: string, overrides?: any) {
    return this.prisma.refreshToken.create({
      data: {
        token: 'test-refresh-token',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        ...overrides,
      },
    });
  }

  async createUserSession(userId: string, overrides?: any) {
    return this.prisma.userSession.create({
      data: {
        userId,
        sessionId: 'test-session-id',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        ...overrides,
      },
    });
  }
}
