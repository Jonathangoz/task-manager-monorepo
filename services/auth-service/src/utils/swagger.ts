// src/utils/swagger.ts - Auth Service
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';
import { OpenAPIV3 } from 'openapi-types';
import { environment } from '@/config/environment';
import { ValidationResult, SwaggerInfo } from '@/types/swaggerTypes';

// ==============================================
// CONFIGURACIÓN PRINCIPAL DE SWAGGER
// ==============================================
const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Task Manager - Auth Service API',
    version: process.env.npm_package_version || '1.0.0',
    description: `
# 🔐 Authentication Service API

Microservicio de autenticación y gestión de usuarios para Task Manager.

## Características principales
- 🔑 Registro y login de usuarios
- 🔐 Gestión de tokens JWT/JWE  
- 👤 Perfiles de usuario
- 🎫 Control de sesiones
- 🛡️ Seguridad avanzada

## Tecnologías
- **Runtime**: Node.js 22+
- **Database**: PostgreSQL + Prisma
- **Cache**: Redis
- **Auth**: JWT con JWE encryption
- **Validation**: Zod

## Autenticación
Para endpoints protegidos, incluye el header:
\`Authorization: Bearer <access_token>\`
    `,
    contact: {
      name: 'Task Manager Team',
      email: 'dev@taskmanager.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: environment.app.isDevelopment 
        ? `http://localhost:${environment.app.port}/api/v1`
        : `https://task-manager-auth-service.onrender.com/api/v1`,
      description: environment.app.isDevelopment ? '🔧 Desarrollo' : '🚀 Producción',
    },
  ],
  
  // ==============================================
  // COMPONENTES
  // ==============================================
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access Token JWT (válido 15 minutos)',
      },
    },
    
    schemas: {
      // ==============================================
      // ESQUEMAS PRINCIPALES
      // ==============================================
      User: {
        type: 'object',
        required: ['id', 'email', 'username', 'isActive', 'isVerified', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            pattern: '^c[a-z0-9]{24}$',
            description: 'ID único del usuario (CUID)',
            example: 'cluser123456789abc',
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255,
            description: 'Email único',
            example: 'john.doe@example.com',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            description: 'Nombre de usuario único',
            example: 'john_doe_2024',
          },
          firstName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nombre',
            example: 'John',
          },
          lastName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Apellido',
            example: 'Doe',
          },
          avatar: {
            type: 'string',
            nullable: true,
            format: 'uri',
            description: 'URL del avatar',
            example: 'https://cdn.example.com/avatars/user123.jpg',
          },
          isActive: {
            type: 'boolean',
            description: 'Usuario activo',
            example: true,
          },
          isVerified: {
            type: 'boolean',
            description: 'Email verificado',
            example: true,
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Último login',
            example: '2024-01-20T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de creación',
            example: '2024-01-15T08:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Última actualización',
            example: '2024-01-20T10:30:00.000Z',
          },
        },
      },

      UserProfile: {
        type: 'object',
        description: 'Perfil público del usuario',
        properties: {
          id: { $ref: '#/components/schemas/User/properties/id' },
          username: { $ref: '#/components/schemas/User/properties/username' },
          firstName: { $ref: '#/components/schemas/User/properties/firstName' },
          lastName: { $ref: '#/components/schemas/User/properties/lastName' },
          avatar: { $ref: '#/components/schemas/User/properties/avatar' },
          isVerified: { $ref: '#/components/schemas/User/properties/isVerified' },
          createdAt: { $ref: '#/components/schemas/User/properties/createdAt' },
        },
      },
      
      // ==============================================
      // DTOs DE ENTRADA
      // ==============================================
      RegisterRequest: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255,
            description: 'Email válido y único',
            example: 'john.doe@example.com',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            description: 'Username único (3-30 caracteres)',
            example: 'john_doe_2024',
          },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            description: 'Contraseña segura (min 8 caracteres)',
            example: 'SecurePass123!',
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            description: 'Nombre (opcional)',
            example: 'John',
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            description: 'Apellido (opcional)',
            example: 'Doe',
          },
        },
      },
      
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email registrado',
            example: 'john.doe@example.com',
          },
          password: {
            type: 'string',
            minLength: 1,
            description: 'Contraseña del usuario',
            example: 'SecurePass123!',
          },
          rememberMe: {
            type: 'boolean',
            description: 'Mantener sesión activa',
            example: false,
            default: false,
          },
        },
      },

      UpdateProfileRequest: {
        type: 'object',
        properties: {
          firstName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nuevo nombre',
            example: 'John Updated',
          },
          lastName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nuevo apellido',
            example: 'Doe Updated',
          },
          avatar: {
            type: 'string',
            nullable: true,
            format: 'uri',
            description: 'Nueva URL del avatar',
            example: 'https://cdn.example.com/avatars/user123-new.jpg',
          },
        },
      },

      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: {
            type: 'string',
            description: 'Contraseña actual',
            example: 'OldPassword123!',
          },
          newPassword: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            description: 'Nueva contraseña segura',
            example: 'NewSecurePass456@',
          },
        },
      },
      
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Refresh token válido',
            example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
          },
        },
      },

      VerifyTokenRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string',
            description: 'Access token a verificar',
            example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
          },
        },
      },
      
      // ==============================================
      // RESPUESTAS
      // ==============================================
      AuthResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Authentication successful' },
          data: {
            type: 'object',
            required: ['user', 'accessToken', 'refreshToken', 'expiresIn', 'tokenType'],
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: {
                type: 'string',
                description: 'JWT access token (válido 15 minutos)',
                example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
              },
              refreshToken: {
                type: 'string',
                description: 'JWT refresh token (válido 7 días)',
                example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
              },
              expiresIn: {
                type: 'number',
                description: 'Tiempo de expiración en segundos',
                example: 900,
              },
              tokenType: {
                type: 'string',
                example: 'Bearer',
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },

      UserResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'User data retrieved successfully' },
          data: { $ref: '#/components/schemas/User' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },

      TokenVerificationResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Token is valid' },
          data: {
            type: 'object',
            required: ['userId', 'email', 'username', 'isActive', 'isVerified'],
            properties: {
              userId: { type: 'string', example: 'cluser123456789abc' },
              email: { type: 'string', example: 'user@example.com' },
              username: { type: 'string', example: 'johndoe' },
              sessionId: { type: 'string', example: 'sess_abc123' },
              isActive: { type: 'boolean', example: true },
              isVerified: { type: 'boolean', example: true },
            },
          },
        },
      },
      
      // ==============================================
      // SESSION SCHEMAS
      // ==============================================
      UserSession: {
        type: 'object',
        required: ['id', 'sessionId', 'isActive', 'lastSeen', 'createdAt', 'expiresAt'],
        properties: {
          id: { type: 'string', example: 'clsession123456' },
          sessionId: {
            type: 'string',
            description: 'ID único de la sesión',
            example: 'sess_abc123456789',
          },
          device: {
            type: 'string',
            nullable: true,
            description: 'Información del device/browser',
            example: 'Chrome 120.0 on Windows 10',
          },
          ipAddress: {
            type: 'string',
            nullable: true,
            format: 'ipv4',
            description: 'Dirección IP de la sesión',
            example: '192.168.1.100',
          },
          location: {
            type: 'string',
            nullable: true,
            description: 'Ubicación geográfica estimada',
            example: 'Bucaramanga, Colombia',
          },
          isActive: {
            type: 'boolean',
            description: 'Si la sesión está activa',
            example: true,
          },
          lastSeen: {
            type: 'string',
            format: 'date-time',
            description: 'Última actividad registrada',
            example: '2024-01-20T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de creación de la sesión',
            example: '2024-01-20T08:00:00.000Z',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de expiración de la sesión',
            example: '2024-01-27T08:00:00.000Z',
          },
        },
      },

      SessionsResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'User sessions retrieved successfully' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/UserSession' },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },

      // ==============================================
      // METADATA Y ERRORES
      // ==============================================
      ResponseMeta: {
        type: 'object',
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp de la respuesta',
            example: '2024-01-20T10:30:00.000Z',
          },
          correlationId: {
            type: 'string',
            description: 'ID de correlación para tracking',
            example: 'req_abc123456789',
          },
          requestId: {
            type: 'string',
            description: 'ID único de la request',
            example: 'req_xyz987654321',
          },
          path: {
            type: 'string',
            description: 'Path del endpoint',
            example: '/api/v1/auth/login',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'Método HTTP usado',
            example: 'POST',
          },
        },
      },
      
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          message: {
            type: 'string',
            description: 'Mensaje de error legible',
            example: 'Authentication failed',
          },
          error: {
            type: 'object',
            required: ['code'],
            properties: {
              code: {
                type: 'string',
                description: 'Código de error único',
                example: 'INVALID_CREDENTIALS',
              },
              details: {
                type: 'string',
                nullable: true,
                description: 'Detalles adicionales del error',
                example: 'The provided email or password is incorrect',
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      
      ValidationErrorResponse: {
        type: 'object',
        required: ['success', 'message', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['field', 'message'],
                  properties: {
                    field: { 
                      type: 'string', 
                      example: 'email',
                      description: 'Campo que falló la validación'
                    },
                    message: { 
                      type: 'string', 
                      example: 'Invalid email format',
                      description: 'Mensaje específico del error'
                    },
                    value: {
                      type: 'string',
                      nullable: true,
                      example: 'invalid-email',
                      description: 'Valor que causó el error'
                    }
                  },
                },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      
      // ==============================================
      // HEALTH CHECK
      // ==============================================
      HealthResponse: {
        type: 'object',
        required: ['status', 'timestamp', 'uptime', 'version', 'environment', 'services'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded'],
            description: 'Estado general del servicio',
            example: 'healthy',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp del health check',
            example: '2024-01-20T10:30:00.000Z',
          },
          uptime: {
            type: 'number',
            description: 'Tiempo de funcionamiento en segundos',
            example: 3600,
          },
          version: {
            type: 'string',
            description: 'Versión del servicio',
            example: '1.0.0',
          },
          environment: {
            type: 'string',
            enum: ['development', 'production', 'test'],
            description: 'Entorno donde se ejecuta',
            example: 'production',
          },
          services: {
            type: 'object',
            required: ['database', 'redis'],
            properties: {
              database: {
                type: 'object',
                required: ['status', 'responseTime', 'lastChecked'],
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['connected', 'disconnected', 'error'],
                    example: 'connected' 
                  },
                  responseTime: { 
                    type: 'number', 
                    description: 'Tiempo de respuesta en ms',
                    example: 15 
                  },
                  lastChecked: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-20T10:29:45.000Z'
                  }
                },
              },
              redis: {
                type: 'object',
                required: ['status', 'responseTime', 'lastChecked'],
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['connected', 'disconnected', 'error'],
                    example: 'connected' 
                  },
                  responseTime: { 
                    type: 'number',
                    description: 'Tiempo de respuesta en ms', 
                    example: 5 
                  },
                  lastChecked: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-20T10:29:50.000Z'
                  }
                },
              },
            },
          },
        },
      },
    },

    // ==============================================
    // PARÁMETROS REUTILIZABLES
    // ==============================================
    parameters: {
      UserIdParam: {
        name: 'userId',
        in: 'path',
        required: true,
        description: 'ID único del usuario (CUID)',
        schema: {
          type: 'string',
          pattern: '^c[a-z0-9]{24}',
          example: 'cluser123456789abc',
        },
      },
      SessionIdParam: {
        name: 'sessionId',
        in: 'path',
        required: true,
        description: 'ID único de la sesión',
        schema: {
          type: 'string',
          example: 'sess_abc123456789'
        }
      }
    },

    // ==============================================
    // RESPUESTAS REUTILIZABLES
    // ==============================================
    responses: {
      UnauthorizedError: {
        description: '🚫 Token inválido, expirado o no proporcionado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            examples: {
              TokenExpired: {
                summary: 'Token expirado',
                value: {
                  success: false,
                  message: 'Token has expired',
                  error: { code: 'TOKEN_EXPIRED' }
                }
              },
              TokenInvalid: {
                summary: 'Token inválido',
                value: {
                  success: false,
                  message: 'Invalid token',
                  error: { code: 'TOKEN_INVALID' }
                }
              },
              TokenMissing: {
                summary: 'Token no proporcionado',
                value: {
                  success: false,
                  message: 'Authentication token is required',
                  error: { code: 'TOKEN_REQUIRED' }
                }
              }
            }
          }
        }
      },
      ForbiddenError: {
        description: '🔒 Acceso denegado - privilegios insuficientes',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              message: 'Access denied',
              error: { code: 'FORBIDDEN' }
            }
          }
        }
      },
      NotFoundError: {
        description: '❌ Recurso no encontrado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              message: 'Resource not found',
              error: { code: 'NOT_FOUND' }
            }
          }
        }
      },
      ValidationError: {
        description: '⚠️ Error de validación de datos',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
          }
        }
      },
      RateLimitError: {
        description: '🚦 Límite de solicitudes excedido',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              message: 'Too many requests, please try again later',
              error: { 
                code: 'RATE_LIMIT_EXCEEDED',
                details: 'Maximum 100 requests per 15 minutes exceeded'
              }
            }
          }
        }
      },
      InternalServerError: {
        description: '💥 Error interno del servidor',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              message: 'Internal server error',
              error: { code: 'INTERNAL_ERROR' }
            }
          }
        }
      }
    }
  },
  paths: {},

  security: [{ BearerAuth: [] }],

  // ==============================================
  // TAGS
  // ==============================================
  tags: [
    {
      name: '🔐 Authentication',
      description: 'Registro, login y gestión de tokens',
    },
    {
      name: '👤 User Management',
      description: 'Gestión de perfiles y datos de usuario',
    },
    {
      name: '🎫 Session Management', 
      description: 'Control y monitoreo de sesiones activas',
    },
    {
      name: '🔍 Token Verification',
      description: 'Endpoints internos para verificación de tokens',
    },
    {
      name: '❤️ Health & Monitoring',
      description: 'Estado y monitoreo del servicio',
    },
  ],

  // ==============================================
  // DOCUMENTACIÓN EXTERNA
  // ==============================================
  externalDocs: {
    description: '📚 Documentación completa en GitHub',
    url: 'https://github.com/Jonathangoz/task-manager-monorepo'
  }
};

// ==============================================
// CONFIGURACIÓN SWAGGER-JSDOC
// ==============================================
const swaggerOptions: swaggerJsdoc.Options = {
    swaggerDefinition,
    apis: ['./src/routes/*.ts', './src/schemas/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions) as OpenAPIV3.Document;

// ==============================================
// OPCIONES DE SWAGGER UI
// ==============================================
export const swaggerUiOptions: SwaggerUiOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #2563eb; font-size: 2rem; }
    .swagger-ui .info .description { font-size: 1rem; line-height: 1.6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; }
    .swagger-ui .opblock.opblock-post { border-color: #16a34a; }
    .swagger-ui .opblock.opblock-get { border-color: #2563eb; }
    .swagger-ui .opblock.opblock-put { border-color: #ea580c; }
    .swagger-ui .opblock.opblock-delete { border-color: #dc2626; }
  `,
  customSiteTitle: 'Auth Service API - Docs',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    requestInterceptor: (req: any) => {
      if (environment.app.isDevelopment) {
        console.log('🔍 Swagger Request:', req.url);
      }
      return req;
    },
  },
};

// ==============================================
// UTILIDADES
// ==============================================
export function validateSwaggerSpec(): ValidationResult {
    const errors: string[] = [];
    const spec = swaggerSpec;

    if (!spec?.openapi) errors.push('OpenAPI version missing');
    if (!spec?.info?.title) errors.push('API title missing');
    if (!spec?.info?.version) errors.push('API version missing');
    if (!spec?.servers || spec.servers.length === 0) {
        errors.push('Servers configuration missing');
    }

    return { isValid: errors.length === 0, errors };
}

export const getSwaggerInfo = () => ({
  title: swaggerSpec.info?.title,
  version: swaggerSpec.info?.version,
  servers: swaggerSpec.servers?.length || 0,
  paths: Object.keys(swaggerSpec.paths || {}).length,
  schemas: Object.keys(swaggerSpec.components?.schemas || {}).length,
  tags: swaggerSpec.tags?.length || 0,
});

export const getSwaggerUrl = (): string => {
  const baseUrl = environment.app.isDevelopment 
    ? `http://localhost:${environment.app.port}`
    : 'https://task-manager-auth-service.onrender.com';
  
  return `${baseUrl}/api/v1/docs`;
};

// ==============================================
// VALIDACIÓN AL CARGAR
// ==============================================
if (environment.app.isDevelopment) {
  const validation = validateSwaggerSpec();
  if (!validation.isValid) {
    console.warn('⚠️ Swagger Documentation Issues:');
    validation.errors.forEach(error => console.warn(`  - ${error}`));
  } else {
    console.log('✅ Swagger documentation is valid');
    console.log(`📚 Swagger URL: ${getSwaggerUrl()}`);
  }
}

export default {
  swaggerSpec,
  swaggerUiOptions,
  validateSwaggerSpec,
  getSwaggerInfo,
  getSwaggerUrl
};