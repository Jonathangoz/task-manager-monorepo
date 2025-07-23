// src/utils/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';
import { config } from '@/config/environment';

// Definición básica de Swagger
const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Task Manager - Auth Service API',
    version: '1.0.0',
    description: 'Microservicio de autenticación para Task Manager. Maneja registro, login, JWT tokens y gestión de sesiones de usuario.',
    contact: {
      name: 'Task Manager Team',
      email: 'support@taskmanager.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
      description: 'Desarrollo Local',
    },
    {
      url: `https://auth-service.render.com/api/${config.app.apiVersion}`,
      description: 'Producción',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT para autenticación. Formato: Bearer <token>',
      },
      RefreshAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Refresh token para renovar access tokens',
      },
    },
    schemas: {
      // User schemas
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID único del usuario',
            example: 'clxxxxx',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email del usuario',
            example: 'user@example.com',
          },
          username: {
            type: 'string',
            description: 'Nombre de usuario único',
            example: 'johndoe',
          },
          firstName: {
            type: 'string',
            nullable: true,
            description: 'Nombre del usuario',
            example: 'John',
          },
          lastName: {
            type: 'string',
            nullable: true,
            description: 'Apellido del usuario',
            example: 'Doe',
          },
          avatar: {
            type: 'string',
            nullable: true,
            description: 'URL del avatar del usuario',
            example: 'https://example.com/avatar.jpg',
          },
          isActive: {
            type: 'boolean',
            description: 'Estado activo del usuario',
            example: true,
          },
          isVerified: {
            type: 'boolean',
            description: 'Estado de verificación del usuario',
            example: true,
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Fecha y hora del último login',
            example: '2025-01-20T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de creación del usuario',
            example: '2025-01-15T08:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de última actualización',
            example: '2025-01-20T10:30:00.000Z',
          },
        },
        required: ['id', 'email', 'username', 'isActive', 'isVerified', 'createdAt', 'updatedAt'],
      },
      
      // Auth schemas
      RegisterRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email válido del usuario',
            example: 'user@example.com',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            description: 'Nombre de usuario único (3-30 caracteres, solo letras, números y _)',
            example: 'johndoe',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Contraseña segura (mínimo 8 caracteres)',
            example: 'SecurePass123!',
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            description: 'Nombre del usuario (opcional)',
            example: 'John',
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            description: 'Apellido del usuario (opcional)',
            example: 'Doe',
          },
        },
        required: ['email', 'username', 'password'],
      },
      
      LoginRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email del usuario',
            example: 'user@example.com',
          },
          password: {
            type: 'string',
            description: 'Contraseña del usuario',
            example: 'SecurePass123!',
          },
        },
        required: ['email', 'password'],
      },
      
      AuthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Authentication successful',
          },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: {
                type: 'string',
                description: 'JWT access token',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
              refreshToken: {
                type: 'string',
                description: 'JWT refresh token',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
              expiresIn: {
                type: 'number',
                description: 'Tiempo de expiración en segundos',
                example: 900,
              },
            },
          },
        },
      },
      
      RefreshTokenRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Token de refresh válido',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
        required: ['refreshToken'],
      },
      
      // Session schemas
      UserSession: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'clxxxxx',
          },
          sessionId: {
            type: 'string',
            example: 'sess_abc123',
          },
          device: {
            type: 'string',
            nullable: true,
            example: 'Chrome on Windows',
          },
          ipAddress: {
            type: 'string',
            nullable: true,
            example: '192.168.1.100',
          },
          location: {
            type: 'string',
            nullable: true,
            example: 'Bucaramanga, Colombia',
          },
          isActive: {
            type: 'boolean',
            example: true,
          },
          lastSeen: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-20T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-20T08:00:00.000Z',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-27T08:00:00.000Z',
          },
        },
      },
      
      // Error schemas
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              details: {
                type: 'array',
                items: {
                  type: 'string',
                },
                example: ['Email is required', 'Password must be at least 8 characters'],
              },
            },
          },
        },
      },
      
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Validation failed',
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string', example: 'email' },
                    message: { type: 'string', example: 'Invalid email format' },
                  },
                },
              },
            },
          },
        },
      },
      
      // Health check schema
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy'],
            example: 'healthy',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-20T10:30:00.000Z',
          },
          uptime: {
            type: 'number',
            description: 'Uptime en segundos',
            example: 3600,
          },
          services: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'connected' },
                  responseTime: { type: 'number', example: 15 },
                },
              },
              redis: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'connected' },
                  responseTime: { type: 'number', example: 5 },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Auth',
      description: 'Endpoints de autenticación y autorización',
    },
    {
      name: 'Users',
      description: 'Gestión de usuarios',
    },
    {
      name: 'Sessions',
      description: 'Gestión de sesiones de usuario',
    },
    {
      name: 'Health',
      description: 'Endpoints de salud del servicio',
    },
  ],
};

// Opciones para swagger-jsdoc
const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/presentation/routes/*.ts', // Rutas con comentarios JSDoc
    './src/presentation/controllers/*.ts', // Controladores con documentación
  ],
};

// Generar especificación Swagger
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Exportar la especificación para usar en el servidor
export default swaggerSpec;