import { z } from 'zod';

// Schema para consulta de usuarios con paginación y filtros
export const getUsersQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'La página debe ser mayor a 0')
    .default('1'),
  
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, 'El límite debe estar entre 1 y 100')
    .default('10'),
  
  search: z
    .string()
    .min(1, 'El término de búsqueda debe tener al menos 1 carácter')
    .max(100, 'El término de búsqueda no puede exceder 100 caracteres')
    .optional(),
  
  status: z
    .enum(['active', 'inactive', 'pending', 'suspended'])
    .optional(),
  
  role: z
    .enum(['admin', 'user', 'moderator'])
    .optional(),
  
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'email', 'firstName', 'lastName'])
    .default('createdAt'),
  
  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc'),
  
  dateFrom: z
    .string()
    .datetime('La fecha debe tener formato ISO 8601')
    .optional(),
  
  dateTo: z
    .string()
    .datetime('La fecha debe tener formato ISO 8601')
    .optional(),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  {
    message: 'La fecha de inicio debe ser anterior a la fecha de fin',
    path: ['dateTo'],
  }
);

// Schema para parámetros de usuario por ID
export const userParamsSchema = z.object({
  userId: z
    .string()
    .uuid('El ID del usuario debe ser un UUID válido'),
});

// Schema para actualización de usuario (admin)
export const updateUserSchema = z.object({
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
  
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .max(255, 'El email no puede exceder 255 caracteres')
    .optional(),
  
  phone: z
    .string()
    .regex(/^[+]?[\d\s\-()]+$/, 'El teléfono debe tener un formato válido')
    .min(10, 'El teléfono debe tener al menos 10 dígitos')
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .optional(),
  
  role: z
    .enum(['admin', 'user', 'moderator'])
    .optional(),
  
  status: z
    .enum(['active', 'inactive', 'pending', 'suspended'])
    .optional(),
  
  avatar: z
    .string()
    .url('La URL del avatar debe ser válida')
    .optional(),
  
  metadata: z
    .record(z.any())
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'Debe proporcionar al menos un campo para actualizar',
  }
);

// Schema para crear usuario (admin)
export const createUserSchema = z.object({
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
  
  role: z
    .enum(['admin', 'user', 'moderator'])
    .default('user'),
  
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
  
  metadata: z
    .record(z.any())
    .optional(),
});

// Schema para cambio de estado de usuario
export const changeUserStatusSchema = z.object({
  status: z
    .enum(['active', 'inactive', 'suspended']),
  
  reason: z
    .string()
    .min(1, 'La razón del cambio de estado es requerida')
    .max(500, 'La razón no puede exceder 500 caracteres')
    .optional(),
});

// Schema para asignación de rol
export const assignRoleSchema = z.object({
  role: z
    .enum(['admin', 'user', 'moderator']),
  
  assignedBy: z
    .string()
    .uuid('El ID del usuario asignador debe ser un UUID válido')
    .optional(),
});

// Schema para búsqueda avanzada de usuarios
export const searchUsersSchema = z.object({
  query: z
    .string()
    .min(1, 'El término de búsqueda es requerido')
    .max(100, 'El término de búsqueda no puede exceder 100 caracteres'),
  
  fields: z
    .array(z.enum(['email', 'firstName', 'lastName', 'phone']))
    .min(1, 'Debe especificar al menos un campo para buscar')
    .default(['email', 'firstName', 'lastName']),
  
  exactMatch: z
    .boolean()
    .default(false),
  
  caseSensitive: z
    .boolean()
    .default(false),
});

// Schema para exportación de usuarios
export const exportUsersSchema = z.object({
  format: z
    .enum(['csv', 'excel', 'json'])
    .default('csv'),
  
  fields: z
    .array(z.enum(['id', 'email', 'firstName', 'lastName', 'role', 'status', 'createdAt', 'updatedAt', 'phone']))
    .min(1, 'Debe especificar al menos un campo para exportar')
    .optional(),
  
  filters: getUsersQuerySchema.omit({ page: true, limit: true }).optional(),
});

// Schema para importación masiva de usuarios
export const bulkCreateUsersSchema = z.object({
  users: z
    .array(createUserSchema.omit({ password: true }).extend({
      password: z.string().optional(), // Password opcional para bulk import
      sendInvite: z.boolean().default(true),
    }))
    .min(1, 'Debe proporcionar al menos un usuario')
    .max(1000, 'No se pueden importar más de 1000 usuarios a la vez'),
  
  skipDuplicates: z
    .boolean()
    .default(true),
  
  notifyUsers: z
    .boolean()
    .default(false),
});

// Tipos TypeScript derivados de los schemas
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type ChangeUserStatusRequest = z.infer<typeof changeUserStatusSchema>;
export type AssignRoleRequest = z.infer<typeof assignRoleSchema>;
export type SearchUsersRequest = z.infer<typeof searchUsersSchema>;
export type ExportUsersRequest = z.infer<typeof exportUsersSchema>;
export type BulkCreateUsersRequest = z.infer<typeof bulkCreateUsersSchema>;

// Función helper para validar UUID
export const validateUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Función helper para sanitizar query de búsqueda
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[<>\"'%;()&+]/g, '') // Remover caracteres peligrosos
    .substring(0, 100); // Limitar longitud
};