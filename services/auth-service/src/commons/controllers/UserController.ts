// src/commons/controllers/UserController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/typeExpress/express';
import { IUserService } from '@/core/interfaces/IUserService';
import { IAuthService } from '@/core/interfaces/IAuthService';
import { logger } from '@/utils/logger';
import {
  HTTP_STATUS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  DEFAULT_VALUES,
} from '@/utils/constants';
import type {
  ApiResponse,
  PaginationOptions,
  UserFilters,
} from '@/utils/constants';

export class UserController {
  constructor(
    private readonly userService: IUserService,
    private readonly authService: IAuthService,
  ) {}

  /**
   * @swagger
   * /api/v1/users:
   *   get:
   *     tags: [Users]
   *     summary: Get users with pagination and filters
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [createdAt, updatedAt, email, username, firstName, lastName]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort order
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - in: query
   *         name: isVerified
   *         schema:
   *           type: boolean
   *         description: Filter by verified status
   *     responses:
   *       200:
   *         description: Users retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  public getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        page = 1,
        limit = DEFAULT_VALUES.PAGINATION_LIMIT,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        isActive,
        isVerified,
        dateFrom,
        dateTo,
      } = req.query;

      const filters: UserFilters = {
        ...(search && { search: search as string }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(isVerified !== undefined && { isVerified: isVerified === 'true' }),
        ...(dateFrom && { createdAfter: new Date(dateFrom as string) }),
        ...(dateTo && { createdBefore: new Date(dateTo as string) }),
      };

      const pagination: PaginationOptions = {
        page: parseInt(page as string, 10),
        limit: Math.min(
          parseInt(limit as string, 10),
          DEFAULT_VALUES.PAGINATION_MAX_LIMIT,
        ),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await this.userService.findMany(filters, pagination);

      const response: ApiResponse = {
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: result.users.map((user) => ({
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
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.totalPages,
          },
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'get_users_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Get user by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     responses:
   *       200:
   *         description: User retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  public getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userService.findById(id);

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
        message: 'User retrieved successfully',
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
        event: 'get_user_by_id_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}/profile:
   *   get:
   *     tags: [Users]
   *     summary: Get public user profile
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     responses:
   *       200:
   *         description: Public profile retrieved successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: User not found
   */
  public getUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userService.findById(id);

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

        res.status(HTTP_STATUS.NOT_FOUND).json(response);
        return;
      }

      // Perfil público (sin información sensible)
      const response: ApiResponse = {
        success: true,
        message: 'Public profile retrieved successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            avatar: user.avatar,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
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
        event: 'get_user_profile_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   put:
   *     tags: [Users]
   *     summary: Update user information (owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               username:
   *                 type: string
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               avatar:
   *                 type: string
   *                 format: uri
   *     responses:
   *       200:
   *         description: User updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   *       409:
   *         description: Email or username already exists
   */
  public updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const { email, username, firstName, lastName, avatar } = req.body;

      // Verificar ownership (middleware requireOwnership debería manejar esto)
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message: 'Forbidden: You can only update your own profile',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Forbidden: You can only update your own profile',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      // Verificar si email/username ya existen (si se están actualizando)
      if (email || username) {
        const currentUser = await this.userService.findById(id);
        if (!currentUser) {
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

        // Verificar email duplicado
        if (email && email !== currentUser.email) {
          const existingUserByEmail = await this.userService.findByEmail(email);
          if (existingUserByEmail) {
            const response: ApiResponse = {
              success: false,
              message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
              error: {
                code: ERROR_CODES.USER_ALREADY_EXISTS,
                message: 'Email already in use',
              },
              meta: {
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
              },
            };

            res.status(HTTP_STATUS.CONFLICT).json(response);
            return;
          }
        }

        // Verificar username duplicado
        if (username && username !== currentUser.username) {
          const existingUserByUsername =
            await this.userService.findByUsername(username);
          if (existingUserByUsername) {
            const response: ApiResponse = {
              success: false,
              message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
              error: {
                code: ERROR_CODES.USER_ALREADY_EXISTS,
                message: 'Username already in use',
              },
              meta: {
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
              },
            };

            res.status(HTTP_STATUS.CONFLICT).json(response);
            return;
          }
        }
      }

      const updatedUser = await this.userService.update(id, {
        ...(email && { email }),
        ...(username && { username }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(avatar !== undefined && { avatar }),
      });

      logger.info({
        event: 'user_updated',
        userId: id,
        changes: {
          email: email ? 'updated' : 'unchanged',
          username,
          firstName,
          lastName,
          avatar: avatar ? 'updated' : 'unchanged',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'User updated successfully',
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
        event: 'update_user_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}/avatar:
   *   patch:
   *     tags: [Users]
   *     summary: Update user avatar (owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - avatar
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: uri
   *     responses:
   *       200:
   *         description: Avatar updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   */
  public updateAvatar = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const { avatar } = req.body;

      // Verificar ownership
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message: 'Forbidden: You can only update your own avatar',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Forbidden: You can only update your own avatar',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      const updatedUser = await this.userService.updateProfile(id, { avatar });

      logger.info({
        event: 'avatar_updated',
        userId: id,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Avatar updated successfully',
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
        event: 'update_avatar_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}:
   *   delete:
   *     tags: [Users]
   *     summary: Deactivate user account (soft delete, owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *                 maxLength: 500
   *     responses:
   *       200:
   *         description: User deactivated successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   */
  public deactivateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const { reason } = req.body;

      // Verificar ownership
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message: 'Forbidden: You can only deactivate your own account',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Forbidden: You can only deactivate your own account',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      await this.userService.deactivate(id, reason);

      // Logout all sessions when deactivating
      await this.authService.logoutAll(id);

      logger.info({
        event: 'user_deactivated',
        userId: id,
        reason: reason || 'No reason provided',
      });

      const response: ApiResponse = {
        success: true,
        message: 'Account deactivated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'deactivate_user_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}/activate:
   *   patch:
   *     tags: [Users]
   *     summary: Reactivate user account (owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     responses:
   *       200:
   *         description: User reactivated successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   */
  public activateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;

      // Verificar ownership
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message: 'Forbidden: You can only reactivate your own account',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Forbidden: You can only reactivate your own account',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      await this.userService.activate(id);

      logger.info({
        event: 'user_reactivated',
        userId: id,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Account reactivated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'activate_user_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}/verify-email:
   *   post:
   *     tags: [Users]
   *     summary: Send email verification token (owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *     responses:
   *       200:
   *         description: Verification email sent
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   */
  public sendEmailVerification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;

      // Verificar ownership
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message:
            'Forbidden: You can only request verification for your own email',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message:
              'Forbidden: You can only request verification for your own email',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      await this.userService.sendEmailVerification(id);

      logger.info({
        event: 'email_verification_sent',
        userId: id,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Verification email sent successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'send_email_verification_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };

  /**
   * @swagger
   * /api/v1/users/{id}/verify-email/{token}:
   *   patch:
   *     tags: [Users]
   *     summary: Verify email with token (owner only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (CUID)
   *       - in: path
   *         name: token
   *         required: true
   *         schema:
   *           type: string
   *         description: Verification token
   *     responses:
   *       200:
   *         description: Email verified successfully
   *       400:
   *         description: Invalid or expired token
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - not owner
   *       404:
   *         description: User not found
   */
  public verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id, token } = req.params;
      const currentUserId = req.user?.id;

      // Verificar ownership
      if (currentUserId !== id) {
        const response: ApiResponse = {
          success: false,
          message: 'Forbidden: You can only verify your own email',
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'Forbidden: You can only verify your own email',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
          },
        };

        res.status(HTTP_STATUS.FORBIDDEN).json(response);
        return;
      }

      await this.userService.verifyEmail(id, token);

      logger.info({
        event: 'email_verified',
        userId: id,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Email verified successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string,
        },
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
      logger.error({
        event: 'verify_email_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.id,
        requesterId: req.user?.id,
      });
      next(error);
    }
  };
}
