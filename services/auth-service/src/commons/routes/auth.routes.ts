import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { 
  registerSchema, 
  loginSchema, 
  updateProfileSchema,
  verifyTokenSchema 
} from '../schemas/auth.schemas';

export class AuthRoutes {
  static get routes(): Router {
    const router = Router();
    const authController = new AuthController();

    // Rate limiting para rutas de autenticación
    const authRateLimit = RateLimitMiddleware.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 10, // máximo 10 intentos por IP
      message: 'Demasiados intentos de autenticación, intenta de nuevo más tarde'
    });

    const loginRateLimit = RateLimitMiddleware.createRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5, // máximo 5 intentos de login por IP
      message: 'Demasiados intentos de login, intenta de nuevo más tarde'
    });

    // Rutas públicas
    router.post(
      '/register',
      authRateLimit,
      ValidationMiddleware.validateBody(registerSchema),
      authController.register
    );

    router.post(
      '/login',
      loginRateLimit,
      ValidationMiddleware.validateBody(loginSchema),
      authController.login
    );

    router.post(
      '/refresh',
      authRateLimit,
      authController.refreshToken
    );

    // Verificación de token para comunicación entre servicios
    router.post(
      '/verify-token',
      ValidationMiddleware.validateBody(verifyTokenSchema),
      authController.verifyToken
    );

    // Rutas protegidas
    router.post(
      '/logout',
      AuthMiddleware.validateJWT,
      authController.logout
    );

    router.get(
      '/me',
      AuthMiddleware.validateJWT,
      authController.getProfile
    );

    router.put(
      '/me',
      AuthMiddleware.validateJWT,
      ValidationMiddleware.validateBody(updateProfileSchema),
      authController.updateProfile
    );

    return router;
  }
}