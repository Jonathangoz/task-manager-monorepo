import { UserRepository } from '@/core/infrastructure/repositories/UserRepository';
import { userFixtures } from '../../../../helpers/fixtures';
import { mockPrisma, clearAllMocks } from '../../../../helpers/mocks';

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    clearAllMocks();
    userRepository = new UserRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = userFixtures.validUser;
      const expectedUser = { id: 'user-123', ...userData };

      mockPrisma.user.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData,
        select: expect.objectContaining({
          id: true,
          email: true,
          username: true,
          password: false, // Nunca retornar password
        }),
      });
    });

    it('should throw error when creation fails', async () => {
      // Arrange
      const userData = userFixtures.validUser;
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userRepository.create(userData)).rejects.toThrow(
        'Failed to create user',
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      // Arrange
      const email = 'test@example.com';
      const expectedUser = { id: 'user-123', email, username: 'testuser' };

      mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

      // Act
      const result = await userRepository.findByEmail(email);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: expect.any(Object),
      });
    });

    it('should return null when user not found', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByEmail(email);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when user exists with email', async () => {
      // Arrange
      const email = 'existing@example.com';
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-123' });

      // Act
      const result = await userRepository.exists(email);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email }, { username: undefined }],
        },
      });
    });

    it('should return false when user does not exist', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Act
      const result = await userRepository.exists(email);

      // Assert
      expect(result).toBe(false);
    });
  });
});
