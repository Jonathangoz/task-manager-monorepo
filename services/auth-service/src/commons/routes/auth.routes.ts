// src/commons/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { verifyToken, extractSessionInfo, checkConcurrentSessions } from '@/middlewares/auth.middleware';
import { validate, requireBody, sanitizeInput, validateEmail } from '@/middlewares/validation.middleware';
import { 
  rateLimitAuth, 
  rateLimitRefreshToken, 
  rateLimitRegistration, 
  rateLimitPasswordReset 
} from '@/middlewares/rateLimit.middleware';
import { 
  registerValidation, 
  loginValidation, 
  refreshTokenValidation,
  verifyTokenValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} from '@/validators/auth.validator';
import { asyncHandler } from '@/middlewares/error.middleware';

export class AuthRoutes {
  static get routes(): Router {
    const router = Router();
    const authController = new AuthController();

    // Middleware global para todas las rutas
    router.use(extractSessionInfo);
    router.use(sanitizeInput);

    // === RUTAS PÚBLICAS ===

    /**
     * POST /auth/register
     * Registro de nuevo usuario
     */
    router.post(
      '/register',
      rateLimitRegistration,
      requireBody,
      validate(registerValidation),
      asyncHandler(authController.register.bind(authController))
    );

    /**
     * POST /auth/login
     * Inicio de sesión
     */
    router.post(
      '/login',
      rateLimitAuth,
      requireBody,
      validate(loginValidation),
      asyncHandler(authController.login.bind(authController))
    );

    /**
     * POST /auth/refresh
     * Renovar token de acceso usando refresh token
     */
    router.post(
      '/refresh',
      rateLimitRefreshToken,
      requireBody,
      validate(refreshTokenValidation),
      asyncHandler(authController.refreshToken.bind(authController))
    );

    /**
     * POST /auth/verify-token
     * Verificar token (para comunicación entre servicios)
     */
    router.post(
      '/verify-token',
      requireBody,
      validate(verifyTokenValidation),
      asyncHandler(authController.verifyToken.bind(authController))
    );

    /**
     * POST /auth/forgot-password
     * Solicitar reset de contraseña
     */
    router.post(
      '/forgot-password',
      rateLimitPasswordReset,
      requireBody,
      validateEmail,
      validate(forgotPasswordValidation),
      asyncHandler(authController.forgotPassword.bind(authController))
    );

    /**
     * POST /auth/reset-password
     * Confirmar reset de contraseña con token
     */
    router.post(
      '/reset-password',
      rateLimitPasswordReset,
      requireBody,
      validate(resetPasswordValidation),
      asyncHandler(authController.resetPassword.bind(authController))
    );

    // === RUTAS PROTEGIDAS ===

    /**
     * POST /auth/logout
     * Cerrar sesión
     */
    router.post(
      '/logout',
      verifyToken,
      asyncHandler(authController.logout.bind(authController))
    );

    /**
     * POST /auth/logout-all
     * Cerrar todas las sesiones del usuario
     */
    router.post(
      '/logout-all',
      verifyToken,
      asyncHandler(authController.logoutAll.bind(authController))
    );

    /**
     * GET /auth/me
     * Obtener perfil del usuario autenticado
     */
    router.get(
      '/me',
      verifyToken,
      asyncHandler(authController.getProfile.bind(authController))
    );

    /**
     * PUT /auth/me
     * Actualizar perfil del usuario autenticado
     */
    router.put(
      '/me',
      verifyToken,
      requireBody,
      validate(updateProfileValidation),
      asyncHandler(authController.updateProfile.bind(authController))
    );

    /**
     * PATCH /auth/change-password
     * Cambiar contraseña del usuario autenticado
     */
    router.patch(
      '/change-password',
      verifyToken,
      requireBody,
      validate(changePasswordValidation),
      asyncHandler(authController.changePassword.bind(authController))
    );

    /**
     * GET /auth/sessions
     * Obtener sesiones activas del usuario
     */
    router.get(
      '/sessions',
      verifyToken,
      asyncHandler(authController.getActiveSessions.bind(authController))
    );

    /**
     * DELETE /auth/sessions/:sessionId
     * Terminar sesión específica
     */
    router.delete(
      '/sessions/:sessionId',
      verifyToken,
      asyncHandler(authController.terminateSession.bind(authController))
    );

    return router;
  }
}