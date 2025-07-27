// src/utils/swagger.ts - Task Service
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';
import { config } from '@/config/environment';

// ==============================================
// CONFIGURACIÓN PRINCIPAL DE SWAGGER
// ==============================================
const swaggerDefinition: swaggerJsdoc.SwaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Task Manager - Task Service API',
    version: '1.0.0',
    description: `
# 📋 Task Service API

Microservicio para la gestión completa de tareas y categorías.

## Características principales
- ✅ CRUD completo de tareas
- 📁 Gestión de categorías
- 🔍 Filtros y búsqueda avanzada  
- 📊 Estadísticas de productividad
- 🔐 Autenticación JWT integrada

## Estados de tareas
- **PENDING**: Pendiente
- **IN_PROGRESS**: En progreso
- **COMPLETED**: Completada
- **CANCELLED**: Cancelada
- **ON_HOLD**: En pausa

## Prioridades
- **LOW**: Baja
- **MEDIUM**: Media (por defecto)
- **HIGH**: Alta
- **URGENT**: Urgente
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
      url: config.app.env === 'production' 
        ? 'https://task-manager-task-service.onrender.com/api/v1' 
        : `http://localhost:${config.app.port}/api/v1`,
      description: config.app.env === 'production' ? '🚀 Producción' : '🔧 Desarrollo',
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
        description: 'Token JWT del servicio de autenticación',
      },
    },
    
    schemas: {
      // ==============================================
      // ESQUEMAS PRINCIPALES
      // ==============================================
      Task: {
        type: 'object',
        required: ['id', 'title', 'status', 'priority', 'userId', 'createdAt', 'updatedAt'],
        properties: {
          id: { 
            type: 'string', 
            description: 'ID único de la tarea',
            example: 'clp123abc456def789' 
          },
          title: { 
            type: 'string', 
            maxLength: 200, 
            description: 'Título de la tarea',
            example: 'Completar documentación API' 
          },
          description: { 
            type: 'string', 
            maxLength: 2000, 
            nullable: true,
            description: 'Descripción detallada',
            example: 'Finalizar documentación con ejemplos' 
          },
          status: { 
            type: 'string', 
            enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
            description: 'Estado actual',
            example: 'PENDING'
          },
          priority: { 
            type: 'string', 
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Nivel de prioridad',
            example: 'MEDIUM'
          },
          dueDate: { 
            type: 'string', 
            format: 'date-time', 
            nullable: true,
            description: 'Fecha límite',
            example: '2024-12-31T23:59:59Z' 
          },
          completedAt: { 
            type: 'string', 
            format: 'date-time', 
            nullable: true,
            description: 'Fecha de finalización'
          },
          userId: { 
            type: 'string', 
            description: 'ID del usuario propietario',
            example: 'user123' 
          },
          categoryId: { 
            type: 'string', 
            nullable: true, 
            description: 'ID de categoría',
            example: 'cat456' 
          },
          tags: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Etiquetas',
            example: ['documentación', 'api'] 
          },
          estimatedHours: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 999, 
            nullable: true,
            description: 'Horas estimadas',
            example: 8 
          },
          actualHours: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 999, 
            nullable: true,
            description: 'Horas reales',
            example: 6 
          },
          createdAt: { 
            type: 'string', 
            format: 'date-time',
            description: 'Fecha de creación'
          },
          updatedAt: { 
            type: 'string', 
            format: 'date-time',
            description: 'Última actualización'
          },
          category: { 
            $ref: '#/components/schemas/Category',
            description: 'Categoría asociada'
          },
        },
      },

      Category: {
        type: 'object',
        required: ['id', 'name', 'userId', 'createdAt', 'updatedAt'],
        properties: {
          id: { 
            type: 'string', 
            description: 'ID único de categoría',
            example: 'cat123abc456def789' 
          },
          name: { 
            type: 'string', 
            maxLength: 100, 
            description: 'Nombre de la categoría',
            example: 'Desarrollo' 
          },
          description: { 
            type: 'string', 
            maxLength: 500, 
            nullable: true,
            description: 'Descripción',
            example: 'Tareas de desarrollo' 
          },
          color: { 
            type: 'string', 
            pattern: '^#[0-9a-fA-F]{6}$', 
            description: 'Color hexadecimal',
            example: '#6366f1' 
          },
          icon: { 
            type: 'string', 
            description: 'Icono',
            example: 'code' 
          },
          isActive: { 
            type: 'boolean', 
            description: 'Estado activo',
            example: true 
          },
          userId: { 
            type: 'string', 
            description: 'ID del propietario',
            example: 'user123' 
          },
          createdAt: { 
            type: 'string', 
            format: 'date-time',
            description: 'Fecha creación'
          },
          updatedAt: { 
            type: 'string', 
            format: 'date-time',
            description: 'Última actualización'
          },
        },
      },

      TaskStats: {
        type: 'object',
        description: 'Estadísticas de tareas',
        properties: {
          totalTasks: { type: 'integer', example: 25 },
          completedTasks: { type: 'integer', example: 15 },
          pendingTasks: { type: 'integer', example: 8 },
          inProgressTasks: { type: 'integer', example: 2 },
          overdueTasks: { type: 'integer', example: 3 },
          urgentTasks: { type: 'integer', example: 1 },
          highTasks: { type: 'integer', example: 4 },
          mediumTasks: { type: 'integer', example: 15 },
          lowTasks: { type: 'integer', example: 5 },
          lastUpdated: { 
            type: 'string', 
            format: 'date-time',
            description: 'Última actualización'
          },
        },
      },

      // ==============================================
      // DTOs DE ENTRADA
      // ==============================================
      CreateTaskRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { 
            type: 'string', 
            maxLength: 200,
            description: 'Título de la tarea',
            example: 'Nueva tarea importante'
          },
          description: { 
            type: 'string', 
            maxLength: 2000,
            description: 'Descripción detallada',
            example: 'Descripción completa de la tarea'
          },
          priority: { 
            type: 'string', 
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            default: 'MEDIUM',
            example: 'HIGH'
          },
          dueDate: { 
            type: 'string', 
            format: 'date-time',
            description: 'Fecha límite',
            example: '2024-02-15T18:00:00Z'
          },
          categoryId: { 
            type: 'string',
            description: 'ID de categoría',
            example: 'cat456'
          },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 10,
            example: ['desarrollo', 'api']
          },
          estimatedHours: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 999,
            example: 8
          }
        }
      },

      UpdateTaskRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          status: { 
            type: 'string', 
            enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']
          },
          priority: { 
            type: 'string', 
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
          },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          categoryId: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          estimatedHours: { type: 'integer', minimum: 1, maximum: 999, nullable: true },
          actualHours: { type: 'integer', minimum: 1, maximum: 999, nullable: true }
        }
      },

      CreateCategoryRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { 
            type: 'string', 
            maxLength: 100,
            description: 'Nombre de categoría',
            example: 'Nueva Categoría'
          },
          description: { 
            type: 'string', 
            maxLength: 500,
            example: 'Descripción de la categoría'
          },
          color: { 
            type: 'string', 
            pattern: '^#[0-9a-fA-F]{6}$',
            default: '#6366f1',
            example: '#10b981'
          },
          icon: { 
            type: 'string',
            default: 'folder',
            example: 'home'
          }
        }
      },

      // ==============================================
      // RESPUESTAS ESTÁNDAR
      // ==============================================
      ApiResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operación exitosa' },
          data: { type: 'object', description: 'Datos de respuesta' },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string', example: 'req_123abc' },
              pagination: { $ref: '#/components/schemas/PaginationMeta' },
            },
          },
        },
      },

      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 150 },
          pages: { type: 'integer', example: 8 },
          hasNext: { type: 'boolean', example: true },
          hasPrev: { type: 'boolean', example: false },
        },
      },

      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error en la operación' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: { type: 'string', example: 'Detalles del error' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string', example: 'req_123abc' },
            },
          },
        },
      },
    },

    // ==============================================
    // PARÁMETROS REUTILIZABLES
    // ==============================================
    parameters: {
      TaskIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'ID único de la tarea',
        example: 'clp123abc456def789'
      },
      CategoryIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'ID único de la categoría',
        example: 'cat123abc456def789'
      },
      PageParam: {
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Número de página'
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        description: 'Elementos por página'
      },
      StatusFilterParam: {
        name: 'status',
        in: 'query',
        required: false,
        schema: { 
          type: 'string', 
          enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']
        },
        description: 'Filtrar por estado'
      },
      PriorityFilterParam: {
        name: 'priority',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        description: 'Filtrar por prioridad'
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        required: false,
        schema: { type: 'string', minLength: 2 },
        description: 'Buscar en título y descripción',
        example: 'documentación'
      },
    },

    // ==============================================
    // RESPUESTAS REUTILIZABLES
    // ==============================================
    responses: {
      BadRequest: {
        description: 'Solicitud inválida',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      Unauthorized: {
        description: 'No autorizado - Token requerido',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      Forbidden: {
        description: 'Acceso denegado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      NotFound: {
        description: 'Recurso no encontrado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      InternalError: {
        description: 'Error interno del servidor',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
    },
  },

  security: [{ BearerAuth: [] }],

  tags: [
    {
      name: '📋 Tasks',
      description: 'Gestión completa de tareas',
    },
    {
      name: '📁 Categories',
      description: 'Organización por categorías',
    },
    {
      name: '📊 Statistics',
      description: 'Métricas y estadísticas',
    },
    {
      name: '❤️ Health',
      description: 'Estado del servicio',
    },
  ],
};

// ==============================================
// CONFIGURACIÓN SWAGGER-JSDOC
// ==============================================
const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ==============================================
// OPCIONES DE SWAGGER UI
// ==============================================
export const swaggerUiOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #6366f1; font-size: 2rem; }
    .swagger-ui .info .description { font-size: 1rem; line-height: 1.6; }
    .swagger-ui .opblock.opblock-post { border-color: #10b981; }
    .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
    .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
  `,
  customSiteTitle: 'Task Service API - Docs',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
  },
};

// ==============================================
// UTILIDADES
// ==============================================
export const validateSwaggerSpec = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!swaggerSpec?.openapi) errors.push('OpenAPI version missing');
  if (!swaggerSpec?.info?.title) errors.push('API title missing');
  if (!swaggerSpec?.info?.version) errors.push('API version missing');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  swaggerSpec,
  swaggerUiOptions,
  validateSwaggerSpec
};