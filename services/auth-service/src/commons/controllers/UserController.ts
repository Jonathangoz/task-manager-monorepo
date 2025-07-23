// src/presentation/controllers/UserController.ts

import { Request, Response, NextFunction } from 'express';
import { IUserService } from '@/core/domain/interfaces/IUserService';
import { IAuthService } from '@/core/domain/interfaces/IAuthService';
import { logger, authLogger } from '@/utils/logger';
import { 
  HTTP_STATUS, 
  ERROR_CODES, 
  SUCCESS_MESSAGES, 
  ERROR_MESSAGES 
} from '@/utils/constants';
import { ApiResponse } from '@/utils/constants';

export class UserController {
  constructor(
    private readonly userService: IUserService,
    private readonly authService: IAuthService
  ) {}

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     tags: [User]
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
  public getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
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
        message: 'User profile retrieved successfully',
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isActive: user.isActive,
          isVerified: user.isVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Failed to get user profile');
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/me:
   *   put:
   *     tags: [User]
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
  public updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { firstName, lastName, avatar } = req.body;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
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

      authLogger.info(
        { userId, changes: { firstName, lastName, avatar } },
        'User profile updated'
      );

      const response: ApiResponse = {
        success: true,
        message: SUCCESS_MESSAGES.PROFILE_UPDATED,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          avatar: updatedUser.avatar,
          isActive: updatedUser.isActive,
          isVerified: updatedUser.isVerified,
          lastLoginAt: updatedUser.lastLoginAt,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Failed to update user profile');
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/change-password:
   *   post:
   *     tags: [User]
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
  public changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      await this.authService.changePassword(userId, currentPassword, newPassword);

      // Log de seguridad
      authLogger.info(
        { 
          userId, 
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        'Password changed successfully'
      );

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
      authLogger.warn(
        { 
          error: error.message, 
          userId: req.user?.id,
          ipAddress: req.ip
        },
        'Password change failed'
      );
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/sessions:
   *   get:
   *     tags: [User]
   *     summary: Get user active sessions
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Sessions retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  public getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
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
          sessions: sessions.map(session => ({
            id: session.id,
            sessionId: session.sessionId,
            device: session.device,
            ipAddress: session.ipAddress,
            location: session.location,
            isActive: session.isActive,
            lastSeen: session.lastSeen,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
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
      logger.error({ error, userId: req.user?.id }, 'Failed to get user sessions');
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/sessions/{sessionId}:
   *   delete:
   *     tags: [User]
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
  public terminateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
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

      authLogger.info(
        { userId, sessionId },
        'Session terminated by user'
      );

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
      logger.error({ error, userId: req.user?.id }, 'Failed to terminate session');
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/auth/sessions:
   *   delete:
   *     tags: [User]
   *     summary: Terminate all user sessions except current
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All sessions terminated successfully
   *       401:
   *         description: Unauthorized
   */
  public terminateAllSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const currentSessionId = req.user?.sessionId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: ERROR_MESSAGES.USER_NOT_FOUND,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };
        
        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      await this.authService.terminateAllSessions(userId, currentSessionId);

      authLogger.info(
        { userId, currentSessionId },
        'All user sessions terminated except current'
      );

      const response: ApiResponse = {
        success: true,
        message: 'All sessions terminated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Failed to terminate all sessions');
      next(error);
    }
  };
}
