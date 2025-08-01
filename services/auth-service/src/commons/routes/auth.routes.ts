// src/commons/routes/auth.routes.ts
import express, { Router } from 'express';
import { AuthController } from '@/commons/controllers/AuthController';
import { IAuthService } from '@/core/interfaces/IAuthService';
import { IUserService } from '@/core/interfaces/IUserService';
import { ITokenService } from '@/core/interfaces/ITokenService';
import { verifyToken, extractSessionInfo, checkConcurrentSessions } from '@/commons/middlewares/auth.middleware';
import { validate, requireBody, sanitizeInput, validateEmail } from '@/commons/middlewares/validation.middleware';
import { 
  rateLimitAuth, 
  rateLimitRefreshToken, 
  rateLimitRegistration, 
  rateLimitPasswordReset 
} from '@/commons/middlewares/rateLimit.middleware';
import { 
  validateRegisterBody,
  validateLoginBody,
  validateRefreshTokenBody,
  validateVerifyTokenBody,
  validateUpdateProfileBody,
  validateChangePasswordBody,
  validateForgotPasswordBody,
  validateResetPasswordBody
} from '@/commons/validators/auth.validator';
import { asyncHandler } from '@/commons/middlewares/error.middleware';

interface AuthRoutesConfig {
  authService: IAuthService;
  userService: IUserService;
  tokenService: ITokenService;
}

export class AuthRoutes {
  static create(config: AuthRoutesConfig): Router {
    const router = Router();
    const { authService, userService, tokenService } = config;
    
    const authController = new AuthController(
      authService,
      userService,
      tokenService
    );

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
      validateRegisterBody,
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
      validateLoginBody,
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
      validateRefreshTokenBody,
      asyncHandler(authController.refreshToken.bind(authController))
    );

    /**
     * POST /auth/verify-token
     * Verificar token (para comunicación entre servicios)
     */
    router.post(
      '/verify-token',
      requireBody,
      validateVerifyTokenBody,
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
      validateForgotPasswordBody,
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
      validateResetPasswordBody,
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
      validateUpdateProfileBody,
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
      validateChangePasswordBody,
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

  // Método backward compatible (deprecated)
  static get routes(): Router {
    console.warn('AuthRoutes.routes is deprecated. Use AuthRoutes.create(config) instead.');
    
    // Este método necesitará las implementaciones reales de los servicios
    // Por ahora lanza un error para forzar el uso del nuevo método
    throw new Error(
      'AuthRoutes.routes requires service implementations. Use AuthRoutes.create() with proper service instances.'
    );
  }
}