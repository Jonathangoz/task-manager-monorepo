// src/utils/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';
import { environment } from '@/config/environment';

// ==============================================
// CONFIGURACIÓN SWAGGER MEJORADA
// ==============================================

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.3', // Versión más reciente
  info: {
    title: 'Task Manager - Auth Service API',
    version: '1.0.0',
    description: `
    ## 🔐 Microservicio de Autenticación para Task Manager
    
    Este servicio maneja toda la lógica de autenticación y autorización del sistema Task Manager, incluyendo:
    
    - ✅ Registro y login de usuarios
    - 🔑 Gestión de tokens JWT/JWE  
    - 👤 Perfiles de usuario
    - 🛡️ Sesiones y seguridad
    - 📊 Health checks y monitoreo
    
    ### 🚀 Tecnologías
    - **Runtime**: Node.js 22+
    - **Framework**: Express.js
    - **Database**: PostgreSQL con Prisma ORM
    - **Cache**: Redis
    - **Auth**: JWT con JWE encryption
    - **Validation**: Zod + express-validator
    
    ### 🔒 Autenticación
    Para usar los endpoints protegidos, incluye el header de autorización:
    \`Authorization: Bearer <access_token>\`
    `,
    contact: {
      name: 'Task Manager Development Team',
      email: 'dev@taskmanager.com',
      url: 'https://github.com/your-org/task-manager'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    termsOfService: 'https://taskmanager.com/terms'
  },
  servers: [
    {
      url: `http://localhost:${environment.app.port}/api/${environment.app.apiVersion}`,
      description: '🔧 Desarrollo Local',
    },
    {
      url: `https://task-manager-auth-service.onrender.com/api/${environment.app.apiVersion}`,
      description: '🚀 Producción (Render)',
    },
    ...(environment.app.isDevelopment ? [{
      url: `http://host.docker.internal:${environment.app.port}/api/${environment.app.apiVersion}`,
      description: '🐳 Docker Local',
    }] : [])
  ],
  
  // ==============================================
  // ESQUEMAS DE SEGURIDAD MEJORADOS
  // ==============================================
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '🔑 Access Token JWT para autenticación. Válido por 15 minutos.',
      },
      RefreshAuth: {
        type: 'http',
        scheme: 'bearer', 
        bearerFormat: 'JWT',
        description: '🔄 Refresh Token para renovar access tokens. Válido por 7 días.',
      },
      SessionAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-session-id',
        description: '🎫 Session ID para tracking de sesiones activas',
      }
    },
    
    // ==============================================
    // ESQUEMAS DE DATOS MEJORADOS
    // ==============================================
    schemas: {
      // ==============================================
      // USER SCHEMAS
      // ==============================================
      User: {
        type: 'object',
        description: 'Entidad de usuario del sistema',
        properties: {
          id: {
            type: 'string',
            pattern: '^c[a-z0-9]{24}$',
            description: 'ID único del usuario (CUID)',
            example: 'clxxxxx123456789',
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255,
            description: 'Email único del usuario',
            example: 'john.doe@example.com',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            description: 'Nombre de usuario único (solo letras, números y guiones bajos)',
            example: 'john_doe_2024',
          },
          firstName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nombre del usuario',
            example: 'John',
          },
          lastName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Apellido del usuario',
            example: 'Doe',
          },
          avatar: {
            type: 'string',
            nullable: true,
            format: 'uri',
            description: 'URL del avatar del usuario',
            example: 'https://cdn.example.com/avatars/user123.jpg',
          },
          isActive: {
            type: 'boolean',
            description: 'Estado activo del usuario',
            example: true,
          },
          isVerified: {
            type: 'boolean',
            description: 'Estado de verificación del email',
            example: true,
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Fecha y hora del último login (ISO 8601)',
            example: '2024-01-20T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de creación del usuario (ISO 8601)',
            example: '2024-01-15T08:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Fecha de última actualización (ISO 8601)',
            example: '2024-01-20T10:30:00.000Z',
          },
        },
        required: ['id', 'email', 'username', 'isActive', 'isVerified', 'createdAt', 'updatedAt'],
        additionalProperties: false,
      },

      UserProfile: {
        type: 'object',
        description: 'Perfil público del usuario (sin datos sensibles)',
        properties: {
          id: { $ref: '#/components/schemas/User/properties/id' },
          username: { $ref: '#/components/schemas/User/properties/username' },
          firstName: { $ref: '#/components/schemas/User/properties/firstName' },
          lastName: { $ref: '#/components/schemas/User/properties/lastName' },
          avatar: { $ref: '#/components/schemas/User/properties/avatar' },
          isVerified: { $ref: '#/components/schemas/User/properties/isVerified' },
          createdAt: { $ref: '#/components/schemas/User/properties/createdAt' },
        },
        additionalProperties: false,
      },
      
      // ==============================================
      // AUTH REQUEST SCHEMAS
      // ==============================================
      RegisterRequest: {
        type: 'object',
        description: 'Datos necesarios para registrar un nuevo usuario',
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
            description: 'Nombre de usuario único (3-30 caracteres, solo letras, números y _)',
            example: 'john_doe_2024',
          },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            description: 'Contraseña segura (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas, números y símbolos)',
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
        additionalProperties: false,
      },
      
      LoginRequest: {
        type: 'object',
        description: 'Credenciales para iniciar sesión',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email del usuario registrado',
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
            description: 'Mantener sesión activa por más tiempo',
            example: false,
            default: false,
          },
        },
        required: ['email', 'password'],
        additionalProperties: false,
      },

      UpdateProfileRequest: {
        type: 'object',
        description: 'Datos para actualizar el perfil del usuario',
        properties: {
          firstName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nuevo nombre del usuario',
            example: 'John Updated',
          },
          lastName: {
            type: 'string',
            nullable: true,
            maxLength: 50,
            description: 'Nuevo apellido del usuario',
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
        additionalProperties: false,
      },

      ChangePasswordRequest: {
        type: 'object',
        description: 'Datos para cambiar la contraseña',
        properties: {
          currentPassword: {
            type: 'string',
            description: 'Contraseña actual del usuario',
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
        required: ['currentPassword', 'newPassword'],
        additionalProperties: false,
      },
      
      RefreshTokenRequest: {
        type: 'object',
        description: 'Token de refresh para obtener nuevos access tokens',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Token de refresh válido',
            example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
          },
        },
        required: ['refreshToken'],
        additionalProperties: false,
      },

      VerifyTokenRequest: {
        type: 'object',
        description: 'Token a verificar (endpoint interno para otros microservicios)',
        properties: {
          token: {
            type: 'string',
            description: 'Access token JWT a verificar',
            example: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...',
          },
        },
        required: ['token'],
        additionalProperties: false,
      },
      
      // ==============================================
      // RESPONSE SCHEMAS
      // ==============================================
      AuthResponse: {
        type: 'object',
        description: 'Respuesta exitosa de autenticación',
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
                description: 'Tiempo de expiración del access token en segundos',
                example: 900,
              },
              tokenType: {
                type: 'string',
                example: 'Bearer',
              },
            },
            required: ['user', 'accessToken', 'refreshToken', 'expiresIn', 'tokenType'],
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
        required: ['success', 'message', 'data'],
        additionalProperties: false,
      },

      UserResponse: {
        type: 'object',
        description: 'Respuesta con datos del usuario',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'User data retrieved successfully' },
          data: { $ref: '#/components/schemas/User' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
        required: ['success', 'message', 'data'],
        additionalProperties: false,
      },

      TokenVerificationResponse: {
        type: 'object',
        description: 'Respuesta de verificación de token (para otros microservicios)',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Token is valid' },
          data: {
            type: 'object',
            properties: {
              userId: { type: 'string', example: 'clxxxxx123456789' },
              email: { type: 'string', example: 'user@example.com' },
              username: { type: 'string', example: 'johndoe' },
              sessionId: { type: 'string', example: 'sess_abc123' },
              isActive: { type: 'boolean', example: true },
              isVerified: { type: 'boolean', example: true },
            },
            required: ['userId', 'email', 'username', 'isActive', 'isVerified'],
          },
        },
        required: ['success', 'message', 'data'],
        additionalProperties: false,
      },
      
      // ==============================================
      // SESSION SCHEMAS
      // ==============================================
      UserSession: {
        type: 'object',
        description: 'Información de sesión activa del usuario',
        properties: {
          id: {
            type: 'string',
            example: 'clsession123456',
          },
          sessionId: {
            type: 'string',
            description: 'Identificador único de la sesión',
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
        required: ['id', 'sessionId', 'isActive', 'lastSeen', 'createdAt', 'expiresAt'],
        additionalProperties: false,
      },

      SessionsResponse: {
        type: 'object',
        description: 'Lista de sesiones activas del usuario',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'User sessions retrieved successfully' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/UserSession' },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
        required: ['success', 'message', 'data'],
        additionalProperties: false,
      },

      // ==============================================
      // METADATA SCHEMAS
      // ==============================================
      ResponseMeta: {
        type: 'object',
        description: 'Metadata de la respuesta',
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
          version: {
            type: 'string',
            description: 'Versión del API',
            example: 'v1',
          },
        },
        additionalProperties: false,
      },
      
      // ==============================================
      // ERROR SCHEMAS
      // ==============================================
      ErrorResponse: {
        type: 'object',
        description: 'Respuesta de error estándar',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            description: 'Mensaje de error legible',
            example: 'Authentication failed',
          },
          error: {
            type: 'object',
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
            required: ['code'],
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
        required: ['success', 'message', 'error'],
        additionalProperties: false,
      },
      
      ValidationErrorResponse: {
        type: 'object',
        description: 'Respuesta de error de validación con detalles específicos',
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
                  required: ['field', 'message'],
                },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
        required: ['success', 'message', 'error'],
        additionalProperties: false,
      },
      
      // ==============================================
      // HEALTH CHECK SCHEMA
      // ==============================================
      HealthResponse: {
        type: 'object',
        description: 'Estado de salud del servicio',
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
            description: 'Estado de servicios dependientes',
            properties: {
              database: {
                type: 'object',
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
                required: ['status', 'responseTime', 'lastChecked'],
              },
              redis: {
                type: 'object',
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
                required: ['status', 'responseTime', 'lastChecked'],
              },
            },
            required: ['database', 'redis'],
          },
        },
        required: ['status', 'timestamp', 'uptime', 'version', 'environment', 'services'],
        additionalProperties: false,
      },
    },

    // ==============================================
    // EJEMPLOS REUTILIZABLES
    // ==============================================
    examples: {
      ValidUser: {
        summary: 'Usuario válido completo',
        value: {
          id: 'cluser123456789abc',
          email: 'john.doe@example.com',
          username: 'john_doe_2024',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'https://cdn.example.com/avatars/john.jpg',
          isActive: true,
          isVerified: true,
          lastLoginAt: '2024-01-20T10:30:00.000Z',
          createdAt: '2024-01-15T08:00:00.000Z',
          updatedAt: '2024-01-20T10:30:00.000Z'
        }
      },
      InvalidCredentials: {
        summary: 'Error de credenciales inválidas',
        value: {
          success: false,
          message: 'Authentication failed',
          error: {
            code: 'INVALID_CREDENTIALS',
            details: 'The provided email or password is incorrect'
          },
          meta: {
            timestamp: '2024-01-20T10:30:00.000Z',
            correlationId: 'req_abc123',
            path: '/api/v1/auth/login',
            method: 'POST'
          }
        }
      },
      ValidationError: {
        summary: 'Error de validación de campos',
        value: {
          success: false,
          message: 'Validation failed',
          error: {
            code: 'VALIDATION_ERROR',
            details: [
              {
                field: 'email',
                message: 'Invalid email format',
                value: 'invalid-email'
              },
              {
                field: 'password',
                message: 'Password must be at least 8 characters',
                value: '123'
              }
            ]
          }
        }
      }
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
          pattern: '^c[a-z0-9]{24}$',
          example: 'cluser123456789abc'
        }
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
      },
      AuthorizationHeader: {
        name: 'Authorization',
        in: 'header',
        required: true,
        description: 'Bearer token para autenticación',
        schema: {
          type: 'string',
          example: 'Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...'
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
            schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            examples: {
              InvalidEmail: { $ref: '#/components/examples/ValidationError' }
            }
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

  // ==============================================
  // TAGS ORGANIZADOS POR FUNCIONALIDAD
  // ==============================================
  tags: [
    {
      name: '🔐 Authentication',
      description: 'Endpoints para registro, login y gestión de tokens',
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
      description: 'Endpoints internos para verificación de tokens (microservicios)',
    },
    {
      name: '❤️ Health & Monitoring',
      description: 'Endpoints de salud y monitoreo del servicio',
    },
  ],

  // ==============================================
  // CONFIGURACIÓN ADICIONAL
  // ==============================================
  externalDocs: {
    description: '📚 Documentación completa en GitHub',
    url: 'https://github.com/your-org/task-manager-auth-service/blob/main/README.md'
  }
};

// ==============================================
// OPCIONES PARA SWAGGER-JSDOC
// ==============================================
const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/commons/routes/*.ts',        // Rutas con JSDoc
    './src/commons/controllers/*.ts',   // Controladores documentados
    './src/commons/validators/*.ts',    // Validators con ejemplos
  ],
};

// ==============================================
// CONFIGURACIONES ESPECÍFICAS POR ENTORNO
// ==============================================
const getEnvironmentSpecificConfig = () => {
  const baseConfig = { ...swaggerDefinition };

  if (environment.app.isProduction) {
    // En producción, remover servidor de desarrollo
    baseConfig.servers = baseConfig.servers?.filter(
      server => !server.description?.includes('Desarrollo') && !server.description?.includes('Docker')
    );
    
    // Deshabilitar ejemplos detallados en producción
    if (baseConfig.components?.examples) {
      baseConfig.components.examples = {};
    }
  }

  if (environment.app.isDevelopment) {
    // En desarrollo, agregar más detalles y ejemplos
    baseConfig.info.description += `
    
    ### 🛠️ Modo Desarrollo
    - ✅ Swagger UI habilitado
    - 🔍 Logs detallados activados
    - 🚀 Hot reload activado
    - 📝 Ejemplos completos disponibles
    `;
  }

  return baseConfig;
};

// ==============================================
// GENERAR ESPECIFICACIÓN SWAGGER
// ==============================================
export const swaggerSpec = swaggerJsdoc({
  ...swaggerOptions,
  definition: getEnvironmentSpecificConfig(),
});

// ==============================================
// CONFIGURACIÓN DE SWAGGER UI
// ==============================================
export const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',           // No expandir por defecto
    filter: true,                   // Habilitar filtro de búsqueda
    showRequestDuration: true,      // Mostrar duración de requests
    tryItOutEnabled: true,          // Habilitar "Try it out"
    requestInterceptor: (req: any) => {
      if (environment.app.isDevelopment) {
        console.log('🔍 Swagger Request:', req.url);
      }
      return req;
    },
    responseInterceptor: (res: any) => {
      if (environment.app.isDevelopment) {
        console.log('📨 Swagger Response:', res.status);
      }
      return res;
    },
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #2563eb; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; }
    .swagger-ui .info .description p { margin-bottom: 1rem; }
    .swagger-ui .info .description h3 { color: #1e40af; margin-top: 2rem; }
    .swagger-ui .opblock.opblock-post { border-color: #16a34a; }
    .swagger-ui .opblock.opblock-get { border-color: #2563eb; }
    .swagger-ui .opblock.opblock-put { border-color: #ea580c; }
    .swagger-ui .opblock.opblock-delete { border-color: #dc2626; }
  `,
  customSiteTitle: 'Task Manager Auth API',
  customfavIcon: '/favicon.ico',
  customJs: environment.app.isDevelopment ? '/swagger-custom.js' : undefined,
};

// ==============================================
// UTILIDADES ADICIONALES
// ==============================================

/**
 * Valida que la especificación Swagger esté correcta
 */
export const validateSwaggerSpec = (): boolean => {
  try {
    if (!swaggerSpec || typeof swaggerSpec !== 'object') {
      console.error('❌ Swagger spec is invalid');
      return false;
    }

    if (!swaggerSpec.openapi || !swaggerSpec.info || !swaggerSpec.paths) {
      console.error('❌ Swagger spec is missing required fields');
      return false;
    }

    console.log('✅ Swagger specification is valid');
    return true;
  } catch (error) {
    console.error('❌ Error validating Swagger spec:', error);
    return false;
  }
};

/**
 * Obtiene información resumida de la especificación
 */
export const getSwaggerInfo = () => ({
  title: swaggerSpec.info?.title,
  version: swaggerSpec.info?.version,
  description: swaggerSpec.info?.description?.substring(0, 100) + '...',
  servers: swaggerSpec.servers?.length || 0,
  paths: Object.keys(swaggerSpec.paths || {}).length,
  schemas: Object.keys(swaggerSpec.components?.schemas || {}).length,
  tags: swaggerSpec.tags?.length || 0,
});

/**
 * Genera la URL completa de Swagger UI para el entorno actual
 */
export const getSwaggerUrl = (): string => {
  const baseUrl = environment.app.isDevelopment 
    ? `http://localhost:${environment.app.port}`
    : 'https://task-manager-auth-service.onrender.com';
  
  return `${baseUrl}/api/${environment.app.apiVersion}/docs`;
};

// ==============================================
// LOG DE INICIALIZACIÓN
// ==============================================
if (environment.app.isDevelopment && environment.features.swaggerEnabled) {
  console.log('📚 Swagger Configuration Loaded:');
  console.log(`   📖 Title: ${swaggerSpec.info?.title}`);
  console.log(`   🔢 Version: ${swaggerSpec.info?.version}`);
  console.log(`   🌐 Servers: ${swaggerSpec.servers?.length}`);
  console.log(`   🛣️  Paths: ${Object.keys(swaggerSpec.paths || {}).length}`);
  console.log(`   📋 Schemas: ${Object.keys(swaggerSpec.components?.schemas || {}).length}`);
  console.log(`   🏷️  Tags: ${swaggerSpec.tags?.length}`);
  console.log(`   🔗 URL: ${getSwaggerUrl()}`);
}

// Validar especificación al cargar
if (environment.features.swaggerEnabled) {
  validateSwaggerSpec();
}

export default swaggerSpec;