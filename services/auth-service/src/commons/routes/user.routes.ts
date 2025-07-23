import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { 
  updateUserSchema,
  changePasswordSchema,
  getUsersQuerySchema 
} from '../schemas/user.schemas';

export class UserRoutes {
  static get routes(): Router {
    const router = Router();
    const userController = new UserController();

    // Rate limiting para operaciones de usuarios
    const userRateLimit = RateLimitMiddleware.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 50, // máximo 50 requests por IP
      message: 'Demasiadas peticiones, intenta de nuevo más tarde'
    });

    // Todas las rutas de usuario requieren autenticación
    router.use(AuthMiddleware.validateJWT);
    router.use(userRateLimit);

    // Obtener lista de usuarios (con paginación y filtros)
    router.get(
      '/',
      ValidationMiddleware.validateQuery(getUsersQuerySchema),
      userController.getUsers
    );

    // Obtener usuario por ID
    router.get(
      '/:id',
      ValidationMiddleware.validateParams({ id: 'string' }),
      userController.getUserById
    );

    // Actualizar usuario
    router.put(
      '/:id',
      ValidationMiddleware.validateParams({ id: 'string' }),
      ValidationMiddleware.validateBody(updateUserSchema),
      userController.updateUser
    );

    // Cambiar contraseña
    router.patch(
      '/:id/password',
      ValidationMiddleware.validateParams({ id: 'string' }),
      ValidationMiddleware.validateBody(changePasswordSchema),
      userController.changePassword
    );

    // Desactivar usuario (soft delete)
    router.delete(
      '/:id',
      ValidationMiddleware.validateParams({ id: 'string' }),
      userController.deactivateUser
    );

    // Reactivar usuario
    router.patch(
      '/:id/activate',
      ValidationMiddleware.validateParams({ id: 'string' }),
      userController.activateUser
    );

    return router;
  }
}