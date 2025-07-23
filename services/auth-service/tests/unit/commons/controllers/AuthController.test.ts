import { AuthController } from '@/presentation/controllers/AuthController';
import { AuthService } from '@/core/application/AuthService';
import { authFixtures, sessionFixtures } from '../../../helpers/fixtures';
import { createMockReq, createMockRes, createMockNext, clearAllMocks } from '../../../helpers/mocks';
import { HTTP_STATUS } from '@/utils/constants';

jest.mock('@/core/application/AuthService');

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    clearAllMocks();
    mockAuthService = new AuthService({} as any, {} as any, {} as any) as jest.Mocked<AuthService>;
    authController = new AuthController(mockAuthService);
  });

  describe('login', () => {
    it('should login successfully', async () => {
      // Arrange
      const loginData = authFixtures.validLogin;
      const mockAuthResult = {
        user: { id: 'user-123', email: loginData.email },
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 },
        sessionId: 'session-123'
      };

      const req = createMockReq({
        body: loginData,
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      });
      const res = createMockRes();
      const next = createMockNext();

      mockAuthService.login.mockResolvedValue(mockAuthResult);

      // Act
      await authController.login(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: mockAuthResult.user,
          tokens: mockAuthResult.tokens
        }
      });
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', mockAuthResult.tokens.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: expect.any(Number)
      });
    });

    it('should handle login failure', async () => {
      // Arrange
      const loginData = authFixtures.invalidLogin;
      const req = createMockReq({ body: loginData });
      const res = createMockRes();
      const next = createMockNext();

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      // Act
      await authController.login(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      // Arrange
      const registerData = authFixtures.validRegister;
      const mockUser = { id: 'user-123', ...registerData };

      const req = createMockReq({ body: registerData });
      const res = createMockRes();
      const next = createMockNext();

      mockAuthService.register.mockResolvedValue(mockUser);

      // Act
      await authController.register(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: { user: mockUser }
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      const req = createMockReq({
        user: { id: 'user-123' },
        sessionId: 'session-123'
      });
      const res = createMockRes();
      const next = createMockNext();

      mockAuthService.logout.mockResolvedValue();

      // Act
      await authController.logout(req, res, next);

      // Assert
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });
  });
});