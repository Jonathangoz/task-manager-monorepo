// src/commons/controllers/AuthController.ts
import { Request, Response, NextFunction } from 'express';
import { IAuthService } from '@/core/interfaces/IAuthService';
import { IUserService } from '@/core/interfaces/IUserService';
import { ITokenService } from '@/core/interfaces/ITokenService';
import { logger } from '@/utils/logger';
import {
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  DEVICE_PATTERNS,
} from '@/utils/constants';
import type { ApiResponse } from '@/utils/constants';

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly userService: IUserService,
    private readonly tokenService: ITokenService,
  ) {}

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     tags: [Authentication]
   *     summary: Register a new user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - username
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               username:
   *                 type: string
   *                 minLength: 3
   *                 maxLength: 30
   *               password:
   *                 type: string
   *                 minLength: 8
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Validation error
   *       409:
   *         description: User already exists
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, username, password, firstName, lastName } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');

      logger.info({
        event: 'user_registration_attempt',
        email,
        username,
        ipAddress,
        userAgent,
      });

      // Verificar si el usuario ya existe
      const existingUserByEmail = await this.userService.findByEmail(email);
      if (existingUserByEmail) {
        logger.warn({
          event: 'registration_failed',
          reason: 'email_exists',
          email,
          ipAddress,
        });

        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
          error: {
            code: ERROR_CODES.USER_ALREADY_EXISTS,
            message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.CONFLICT).json(response);
        return;
      }

      const existingUserByUsername =
        await this.userService.findByUsername(username);
      if (existingUserByUsername) {
        logger.warn({
          event: 'registration_failed',
          reason: 'username_exists',
          username,
          ipAddress,
        });

        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
          error: {
            code: ERROR_CODES.USER_ALREADY_EXISTS,
            message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.CONFLICT).json(response);
        return;
      }

      // Registrar usuario
      const user = await this.authService.register({
        email,
        username,
        password,
        firstName,
        lastName,
      });

      logger.info({
        event: 'user_registered',
        userId: user.id,
        email: user.email,
        username: user.username,
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.USER_REGISTERED,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            isActive: user.isActive,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error) {
      logger.error({
        event: 'registration_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: User login
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   *       429:
   *         description: Too many login attempts
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      const device = this.extractDeviceInfo(userAgent);

      const sessionInfo = {
        ipAddress,
        userAgent,
        device,
        location: req.get('CF-IPCountry') || 'Unknown',
      };

      logger.info({
        event: 'login_attempt',
        email,
        ipAddress,
        userAgent,
        device,
      });

      // Intentar login
      const authResult = await this.authService.login(
        { email, password },
        sessionInfo,
      );

      // Registrar intento exitoso
      await this.authService.recordLoginAttempt({
        email,
        userId: authResult.user.id,
        ipAddress,
        userAgent,
        success: true,
      });

      logger.info({
        event: 'login_successful',
        userId: authResult.user.id,
        email,
        sessionId: authResult.sessionId,
        ipAddress,
      });

      // Configurar cookies seguras para el refresh token
      res.cookie('task_manager_refresh_token', authResult.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        path: '/api/v1/auth/refresh',
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.LOGIN_SUCCESSFUL,
        data: {
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            username: authResult.user.username,
            firstName: authResult.user.firstName,
            lastName: authResult.user.lastName,
            fullName: authResult.user.fullName,
            avatar: authResult.user.avatar,
            isVerified: authResult.user.isVerified,
            lastLoginAt: authResult.user.lastLoginAt,
          },
          tokens: {
            accessToken: authResult.tokens.accessToken,
            expiresIn: authResult.tokens.expiresIn,
          },
          sessionId: authResult.sessionId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      // Registrar intento fallido
      try {
        await this.authService.recordLoginAttempt({
          email: req.body.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          reason: 'invalid_credentials',
        });
      } catch (recordError) {
        logger.error({
          event: 'login_attempt_record_failed',
          error:
            recordError instanceof Error
              ? recordError.message
              : 'Unknown error',
        });
      }

      logger.warn({
        event: 'login_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     tags: [Authentication]
   *     summary: Refresh access token
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *       401:
   *         description: Invalid refresh token
   */
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken =
        req.cookies.task_manager_refresh_token || req.body.refreshToken;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      const device = this.extractDeviceInfo(userAgent);

      const sessionInfo = {
        ipAddress,
        userAgent,
        device,
      };

      logger.info({
        event: 'token_refresh_attempt',
        ipAddress,
        userAgent,
      });

      const tokens = await this.authService.refreshToken(
        refreshToken,
        sessionInfo,
      );

      // Actualizar cookie con el nuevo refresh token
      res.cookie('task_manager_refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        path: '/api/v1/auth/refresh',
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.TOKEN_REFRESHED,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.warn({
        event: 'token_refresh_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     tags: [Authentication]
   *     summary: User logout
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *       401:
   *         description: Unauthorized
   */
  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const sessionId = req.user?.sessionId;

      if (!userId || !sessionId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      logger.info({
        event: 'logout_attempt',
        userId,
        sessionId,
      });

      await this.authService.logout(userId, sessionId);

      // Limpiar cookie del refresh token
      res.clearCookie('task_manager_refresh_token', {
        path: '/api/v1/auth/refresh',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });

      logger.info({
        event: 'logout_successful',
        userId,
        sessionId,
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESSFUL,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'logout_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/logout-all:
   *   post:
   *     tags: [Authentication]
   *     summary: Logout from all sessions
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout from all sessions successful
   *       401:
   *         description: Unauthorized
   */
  public logoutAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      logger.info({
        event: 'logout_all_attempt',
        userId,
      });

      await this.authService.logoutAll(userId);

      // Limpiar cookie del refresh token
      res.clearCookie('task_manager_refresh_token', {
        path: '/api/v1/auth/refresh',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });

      logger.info({
        event: 'logout_all_successful',
        userId,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Logged out from all sessions successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'logout_all_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/verify-token:
   *   post:
   *     tags: [Authentication]
   *     summary: Verify token (for inter-service communication)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *               service:
   *                 type: string
   *     responses:
   *       200:
   *         description: Token is valid
   *       401:
   *         description: Invalid token
   */
  public verifyToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { token, service } = req.body;

      if (!token) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.TOKEN_REQUIRED,
          error: {
            code: ERROR_CODES.TOKEN_REQUIRED,
            message: ERROR_MESSAGES.TOKEN_REQUIRED,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      const payload = await this.tokenService.validateAccessToken(token);
      const user = await this.userService.findById(payload.sub);

      if (!user || !user.isActive) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      logger.info({
        event: 'token_verification_successful',
        userId: user.id,
        service: service || 'unknown',
      });

      const response: ApiResponse = {
        success: true,
        message: 'Token is valid',
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            isActive: user.isActive,
            isVerified: user.isVerified,
          },
          payload: {
            sub: payload.sub,
            email: payload.email,
            username: payload.username,
            sessionId: payload.sessionId,
            exp: payload.exp,
            iat: payload.iat,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.warn({
        event: 'token_verification_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     tags: [Authentication]
   *     summary: Get current user profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  public getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const user = await this.userService.findById(userId);

      if (!user) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.NOT_FOUND).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            avatar: user.avatar,
            isActive: user.isActive,
            isVerified: user.isVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'get_profile_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/me:
   *   put:
   *     tags: [Authentication]
   *     summary: Update current user profile
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               avatar:
   *                 type: string
   *                 format: uri
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  public updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { firstName, lastName, avatar } = req.body;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const updatedUser = await this.userService.updateProfile(userId, {
        firstName,
        lastName,
        avatar,
      });

      logger.info({
        event: 'profile_updated',
        userId,
        changes: {
          firstName,
          lastName,
          avatar: avatar ? 'updated' : 'unchanged',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.PROFILE_UPDATED,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            username: updatedUser.username,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            fullName: updatedUser.fullName,
            avatar: updatedUser.avatar,
            isActive: updatedUser.isActive,
            isVerified: updatedUser.isVerified,
            lastLoginAt: updatedUser.lastLoginAt,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'update_profile_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/change-password:
   *   patch:
   *     tags: [Authentication]
   *     summary: Change user password
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 minLength: 8
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Invalid current password
   */
  public changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      await this.authService.changePassword(
        userId,
        currentPassword,
        newPassword,
      );

      // Log de seguridad
      logger.info({
        event: 'password_changed',
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.PASSWORD_UPDATED,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.warn({
        event: 'password_change_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ipAddress: req.ip,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/sessions:
   *   get:
   *     tags: [Authentication]
   *     summary: Get user active sessions
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Sessions retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  public getActiveSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const sessions = await this.userService.getUserSessions(userId);

      const response: ApiResponse = {
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions: sessions.map((session) => ({
            id: session.id,
            sessionId: session.sessionId,
            device: session.device,
            ipAddress: session.ipAddress,
            location: session.location,
            isActive: session.isActive,
            lastSeen: session.lastSeen,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrent: session.sessionId === req.user?.sessionId,
          })),
          total: sessions.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'get_sessions_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/sessions/{sessionId}:
   *   delete:
   *     tags: [Authentication]
   *     summary: Terminate a specific session
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Session terminated successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Session not found
   */
  public terminateSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: ERROR_MESSAGES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      await this.authService.terminateSession(sessionId);

      logger.info({
        event: 'session_terminated',
        userId,
        sessionId,
        terminatedBy: req.user?.sessionId,
      });

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.SESSION_TERMINATED,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'terminate_session_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        sessionId: req.params.sessionId,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/forgot-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Request password reset
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Password reset email sent
   *       404:
   *         description: User not found
   */
  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email } = req.body;

      logger.info({
        event: 'forgot_password_request',
        email,
        ipAddress: req.ip,
      });

      await this.authService.forgotPassword(email);

      // Siempre devolver éxito por seguridad (no revelar si el email existe)
      const response: ApiResponse = {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'forgot_password_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/reset-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Reset password with token
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - password
   *               - email
   *             properties:
   *               token:
   *                 type: string
   *               password:
   *                 type: string
   *                 minLength: 8
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Password reset successfully
   *       400:
   *         description: Invalid or expired token
   */
  public resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { token, password, email } = req.body;

      logger.info({
        event: 'password_reset_attempt',
        email,
        ipAddress: req.ip,
      });

      await this.authService.resetPassword(token, password, email);

      logger.info({
        event: 'password_reset_successful',
        email,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.warn({
        event: 'password_reset_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
      });
      next(error);
    }
  };

  /**
   * Extrae información del dispositivo desde el User-Agent
   */
  private extractDeviceInfo(userAgent?: string): string {
    if (!userAgent) return 'Unknown';

    // Detectar tipo de dispositivo usando patrones de constants.ts
    if (DEVICE_PATTERNS.MOBILE.test(userAgent)) {
      if (/iPhone/.test(userAgent)) return 'iPhone';
      if (/iPad/.test(userAgent)) return 'iPad';
      if (/Android/.test(userAgent)) return 'Android';
      return 'Mobile';
    }

    if (DEVICE_PATTERNS.TABLET.test(userAgent)) return 'Tablet';

    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';

    if (DEVICE_PATTERNS.BOT.test(userAgent)) return 'Bot';

    return 'Desktop';
  }
}
