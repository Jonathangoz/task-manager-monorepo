import { AuthService } from '@/core/application/AuthService';
import { UserRepository } from '@/core/infrastructure/repositories/UserRepository';
import { TokenService } from '@/core/application/TokenService';
import { RedisCache } from '@/core/infrastructure/cache/RedisCache';
import { authFixtures, sessionFixtures } from '../../helpers/fixtures';
import { mockPrisma, mockRedis, clearAllMocks } from '../../helpers/mocks';

// Mocks
jest.mock('@/core/infrastructure/repositories/UserRepository');
jest.mock('@/core/application/TokenService');
jest.mock('@/core/infrastructure/cache/RedisCache');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockCache: jest.Mocked<RedisCache>;

  beforeEach(() => {
    clearAllMocks();
    
    mockUserRepository = new UserRepository(mockPrisma as any) as jest.Mocked<UserRepository>;
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;
    mockCache = new RedisCache(mockRedis as any) as jest.Mocked<RedisCache>;
    
    authService = new AuthService(mockUserRepository, mockTokenService, mockCache);
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const loginData = authFixtures.validLogin;
      const sessionInfo = sessionFixtures.validSessionInfo;
      const mockUser = { id: 'user-123', email: loginData.email, isActive: true };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser as any);
      mockTokenService.generateAccessToken.mockResolvedValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue({
        token: 'refresh-token',
        tokenId: 'token-123',
        expiresAt: new Date()
      });

      // Act
      const result = await authService.login(loginData, sessionInfo);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('sessionId');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginData.email);
    });

    it('should throw error with invalid credentials', async () => {
      // Arrange
      const loginData = authFixtures.invalidLogin;
      const sessionInfo = sessionFixtures.validSessionInfo;

      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginData, sessionInfo))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      // Arrange
      const registerData = authFixtures.validRegister;
      const mockUser = { id: 'user-123', ...registerData };

      mockUserRepository.exists.mockResolvedValue(false);
      mockUserRepository.create.mockResolvedValue(mockUser as any);

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.exists).toHaveBeenCalledWith(registerData.email, registerData.username);
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const registerData = authFixtures.validRegister;

      mockUserRepository.exists.mockResolvedValue(true);

      // Act & Assert
      await expect(authService.register(registerData))
        .rejects.toThrow('User already exists');
    });
  });
});