// src/commons/routes/user.routes.ts - Versión actualizada sin método deprecated

import { Router } from 'express';
import { UserController } from '@/commons/controllers/UserController';
import { 
  verifyToken, 
  requireOwnership, 
  extractSessionInfo 
} from '@/commons/middlewares/auth.middleware';
import { 
  createValidator,
  validatePagination, 
  requireBody, 
  validateCUID, 
  sanitizeInput 
} from '@/commons/middlewares/validation.middleware';
import RateLimitMiddleware from '@/commons/middlewares/rateLimit.middleware';
import { 
  validateGetUsersQuery,
  validateUpdateUserBody,
  validateUpdateAvatarBody,
  validateDeactivateUserBody,
  validateUserParams,
  validateVerifyEmailTokenParams,
  UserParamsSchema,
  VerifyEmailTokenParamsSchema
} from '@/commons/validators/user.validator';
import { asyncHandler } from '@/commons/middlewares/error.middleware';

interface UserRoutesDependencies {
  userController: UserController;
}

export class UserRoutes {
  private userController: UserController;

  constructor(dependencies: UserRoutesDependencies) {
    this.userController = dependencies.userController;
  }

  public get routes(): Router {
    const router = Router();

    // Middleware global para todas las rutas de usuario
    router.use(extractSessionInfo);
    router.use(sanitizeInput);
    router.use(verifyToken); // Todas las rutas de usuario requieren autenticación
    router.use(RateLimitMiddleware.perUser());

    // === RUTAS DE CONSULTA ===

    /**
     * GET /users
     * Obtener lista de usuarios con paginación y filtros
     */
    router.get(
      '/',
      validateGetUsersQuery,
      asyncHandler(this.userController.getUsers)
    );

    /**
     * GET /users/:id
     * Obtener usuario por ID
     */
    router.get(
      '/:id',
      validateUserParams,
      asyncHandler(this.userController.getUserById)
    );

    /**
     * GET /users/:id/profile
     * Obtener perfil público de usuario
     */
    router.get(
      '/:id/profile',
      validateUserParams,
      asyncHandler(this.userController.getUserProfile)
    );

    // === RUTAS DE MODIFICACIÓN (requieren ownership) ===

    /**
     * PUT /users/:id
     * Actualizar información del usuario
     * Solo el propietario puede actualizar sus datos
     */
    router.put(
      '/:id',
      validateUserParams,
      requireOwnership('id'),
      requireBody,
      validateUpdateUserBody,
      asyncHandler(this.userController.updateUser)
    );

    /**
     * PATCH /users/:id/avatar
     * Actualizar avatar del usuario
     */
    router.patch(
      '/:id/avatar',
      validateUserParams,
      requireOwnership('id'),
      requireBody,
      validateUpdateAvatarBody,
      asyncHandler(this.userController.updateAvatar)
    );

    /**
     * DELETE /users/:id
     * Desactivar usuario (soft delete)
     * Solo el propietario puede desactivar su cuenta
     */
    router.delete(
      '/:id',
      validateUserParams,
      requireOwnership('id'),
      validateDeactivateUserBody,
      asyncHandler(this.userController.deactivateUser)
    );

    /**
     * PATCH /users/:id/activate
     * Reactivar usuario
     * Solo el propietario puede reactivar su cuenta
     */
    router.patch(
      '/:id/activate',
      validateUserParams,
      requireOwnership('id'),
      asyncHandler(this.userController.activateUser)
    );

    // === RUTAS DE VERIFICACIÓN ===

    /**
     * POST /users/:id/verify-email
     * Enviar token de verificación de email
     */
    router.post(
      '/:id/verify-email',
      validateUserParams,
      requireOwnership('id'),
      asyncHandler(this.userController.sendEmailVerification)
    );

    /**
     * PATCH /users/:id/verify-email/:token
     * Verificar email con token
     */
    router.patch(
      '/:id/verify-email/:token',
      createValidator(
        UserParamsSchema.merge(VerifyEmailTokenParamsSchema), 
        'params'
      ),
      requireOwnership('id'),
      asyncHandler(this.userController.verifyEmail)
    );

    return router;
  }

  /**
   * Método estático para crear instancia con factory pattern
   */
  static create(dependencies: UserRoutesDependencies): UserRoutes {
    return new UserRoutes(dependencies);
  }
}