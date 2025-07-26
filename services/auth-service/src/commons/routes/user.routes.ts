// src/commons/routes/user.routes.ts
import { Router } from 'express';
import { UserController } from '@/commons/controllers/UserController';
import { 
  verifyToken, 
  requireOwnership, 
  extractSessionInfo 
} from '@/commons/middlewares/auth.middleware';
import { 
  validate, 
  validatePagination, 
  requireBody, 
  validateCUID, 
  sanitizeInput 
} from '@/commons/middlewares/validation.middleware';
import { rateLimitPerUser } from '@/commons/middlewares/rateLimit.middleware';
import { 
  updateUserValidation,
  getUsersQueryValidation,
  deactivateUserValidation
} from '@/commons/validators/user.validator';
import { asyncHandler } from '@/commons/middlewares/error.middleware';

export class UserRoutes {
  static get routes(): Router {
    const router = Router();
    const userController = new UserController();

    // Middleware global para todas las rutas de usuario
    router.use(extractSessionInfo);
    router.use(sanitizeInput);
    router.use(verifyToken); // Todas las rutas de usuario requieren autenticación
    router.use(rateLimitPerUser);

    // === RUTAS DE CONSULTA ===

    /**
     * GET /users
     * Obtener lista de usuarios con paginación y filtros
     */
    router.get(
      '/',
      validatePagination,
      validate(getUsersQueryValidation),
      asyncHandler(userController.getUsers.bind(userController))
    );

    /**
     * GET /users/:id
     * Obtener usuario por ID
     */
    router.get(
      '/:id',
      validateCUID('id'),
      asyncHandler(userController.getUserById.bind(userController))
    );

    /**
     * GET /users/:id/profile
     * Obtener perfil público de usuario
     */
    router.get(
      '/:id/profile',
      validateCUID('id'),
      asyncHandler(userController.getUserProfile.bind(userController))
    );

    // === RUTAS DE MODIFICACIÓN (requieren ownership) ===

    /**
     * PUT /users/:id
     * Actualizar información del usuario
     * Solo el propietario puede actualizar sus datos
     */
    router.put(
      '/:id',
      validateCUID('id'),
      requireOwnership('id'),
      requireBody,
      validate(updateUserValidation),
      asyncHandler(userController.updateUser.bind(userController))
    );

    /**
     * PATCH /users/:id/avatar
     * Actualizar avatar del usuario
     */
    router.patch(
      '/:id/avatar',
      validateCUID('id'),
      requireOwnership('id'),
      requireBody,
      asyncHandler(userController.updateAvatar.bind(userController))
    );

    /**
     * DELETE /users/:id
     * Desactivar usuario (soft delete)
     * Solo el propietario puede desactivar su cuenta
     */
    router.delete(
      '/:id',
      validateCUID('id'),
      requireOwnership('id'),
      validate(deactivateUserValidation),
      asyncHandler(userController.deactivateUser.bind(userController))
    );

    /**
     * PATCH /users/:id/activate
     * Reactivar usuario
     * Solo el propietario puede reactivar su cuenta
     */
    router.patch(
      '/:id/activate',
      validateCUID('id'),
      requireOwnership('id'),
      asyncHandler(userController.activateUser.bind(userController))
    );

    // === RUTAS DE VERIFICACIÓN ===

    /**
     * POST /users/:id/verify-email
     * Enviar token de verificación de email
     */
    router.post(
      '/:id/verify-email',
      validateCUID('id'),
      requireOwnership('id'),
      asyncHandler(userController.sendEmailVerification.bind(userController))
    );

    /**
     * PATCH /users/:id/verify-email/:token
     * Verificar email con token
     */
    router.patch(
      '/:id/verify-email/:token',
      validateCUID('id'),
      requireOwnership('id'),
      asyncHandler(userController.verifyEmail.bind(userController))
    );

    return router;
  }
}