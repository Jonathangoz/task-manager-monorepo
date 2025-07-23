import { z } from 'zod';

// Schema para registro de usuario
export const registerSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .min(1, 'El email es requerido')
    .max(255, 'El email no puede exceder 255 caracteres'),
  
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial'
    ),
  
  firstName: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El nombre solo puede contener letras y espacios'),
  
  lastName: z
    .string()
    .min(1, 'El apellido es requerido')
    .max(50, 'El apellido no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El apellido solo puede contener letras y espacios'),
});

// Schema para login
export const loginSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .min(1, 'El email es requerido'),
  
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});

// Schema para refresh token
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'El refresh token es requerido'),
});

// Schema para verificación de token (usado por otros servicios)
export const verifyTokenSchema = z.object({
  token: z
    .string()
    .min(1, 'El token es requerido'),
  
  service: z
    .string()
    .optional()
    .describe('Servicio que está verificando el token'),
});

// Schema para actualizar perfil
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El nombre solo puede contener letras y espacios')
    .optional(),
  
  lastName: z
    .string()
    .min(1, 'El apellido es requerido')
    .max(50, 'El apellido no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El apellido solo puede contener letras y espacios')
    .optional(),
  
  phone: z
    .string()
    .regex(/^[+]?[\d\s\-()]+$/, 'El teléfono debe tener un formato válido')
    .min(10, 'El teléfono debe tener al menos 10 dígitos')
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .optional(),
  
  avatar: z
    .string()
    .url('La URL del avatar debe ser válida')
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'Debe proporcionar al menos un campo para actualizar',
  }
);

// Schema para cambio de contraseña
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'La contraseña actual es requerida'),
  
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128, 'La nueva contraseña no puede exceder 128 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'La nueva contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial'
    ),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'La nueva contraseña debe ser diferente a la actual',
    path: ['newPassword'],
  }
);

// Tipos TypeScript derivados de los schemas
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type VerifyTokenRequest = z.infer<typeof verifyTokenSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

// Validador para headers de autorización
export const authorizationHeaderSchema = z.object({
  authorization: z
    .string()
    .regex(/^Bearer\s+[\w\-._~+/]+=*$/, 'El header Authorization debe tener el formato: Bearer <token>')
    .transform((value) => value.replace('Bearer ', '')),
});

export type AuthorizationHeader = z.infer<typeof authorizationHeaderSchema>;

// Función helper para validar y extraer token del header
export const extractTokenFromHeader = (authHeader?: string): string => {
  if (!authHeader) {
    throw new Error('Header de autorización requerido');
  }
  
  const result = authorizationHeaderSchema.safeParse({ authorization: authHeader });
  
  if (!result.success) {
    throw new Error('Formato de token inválido');
  }
  
  return result.data.authorization;
};