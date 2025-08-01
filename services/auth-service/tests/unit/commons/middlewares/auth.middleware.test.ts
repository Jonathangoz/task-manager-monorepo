import { authMiddleware } from '@/presentation/middlewares/auth.middleware';
import { TokenService } from '@/core/application/TokenService';
import { UserRepository } from '@/core/infrastructure/repositories/UserRepository';
import { tokenFixtures } from '../../../helpers/fixtures';
import {
  createMockReq,
  createMockRes,
  createMockNext,
  clearAllMocks,
} from '../../../helpers/mocks';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

jest.mock('@/core/application/TokenService');
jest.mock('@/core/infrastructure/repositories/UserRepository');

describe('authMiddleware', () => {
  let mockTokenService: jest.Mocked<TokenService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    clearAllMocks();
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;
    mockUserRepository = new UserRepository(
      {} as any,
    ) as jest.Mocked<UserRepository>;
  });

  it('should authenticate user with valid token', async () => {
    // Arrange
    const validToken = 'Bearer valid-access-token';
    const tokenPayload = tokenFixtures.validTokenPayload;
    const mockUser = { id: tokenPayload.sub, email: tokenPayload.email };

    const req = createMockReq({
      headers: { authorization: validToken },
    });
    const res = createMockRes();
    const next = createMockNext();

    mockTokenService.extractTokenFromHeader.mockReturnValue(
      'valid-access-token',
    );
    mockTokenService.validateAccessToken.mockResolvedValue(tokenPayload);
    mockUserRepository.findById.mockResolvedValue(mockUser);

    // Act
    await authMiddleware(req, res, next);

    // Assert
    expect(req.user).toEqual(mockUser);
    expect(req.sessionId).toBe(tokenPayload.sessionId);
    expect(next).toHaveBeenCalledWith();
  });

  it('should return 401 when no token provided', async () => {
    // Arrange
    const req = createMockReq({ headers: {} });
    const res = createMockRes();
    const next = createMockNext();

    mockTokenService.extractTokenFromHeader.mockReturnValue(null);

    // Act
    await authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ERROR_CODES.TOKEN_REQUIRED,
        message: 'Authentication token is required',
      },
    });
  });

  it('should return 401 when token is invalid', async () => {
    // Arrange
    const invalidToken = 'Bearer invalid-token';
    const req = createMockReq({
      headers: { authorization: invalidToken },
    });
    const res = createMockRes();
    const next = createMockNext();

    mockTokenService.extractTokenFromHeader.mockReturnValue('invalid-token');
    mockTokenService.validateAccessToken.mockRejectedValue(
      new Error('Invalid token'),
    );

    // Act
    await authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ERROR_CODES.TOKEN_INVALID,
        message: 'Invalid token',
      },
    });
  });

  it('should return 401 when user not found', async () => {
    // Arrange
    const validToken = 'Bearer valid-access-token';
    const tokenPayload = tokenFixtures.validTokenPayload;

    const req = createMockReq({
      headers: { authorization: validToken },
    });
    const res = createMockRes();
    const next = createMockNext();

    mockTokenService.extractTokenFromHeader.mockReturnValue(
      'valid-access-token',
    );
    mockTokenService.validateAccessToken.mockResolvedValue(tokenPayload);
    mockUserRepository.findById.mockResolvedValue(null);

    // Act
    await authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ERROR_CODES.USER_NOT_FOUND,
        message: 'User not found',
      },
    });
  });
});
