// src/utils/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';
import { config } from '@/config/environment';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Task Manager - Task Service API',
    version: '1.0.0',
    description: 'Microservicio independiente para gestión de tareas y categorías',
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
      url: config.app.env === 'production' 
        ? 'https://task-manager-task-service.onrender.com' 
        : `http://localhost:${config.app.port}`,
      description: config.app.env === 'production' ? 'Production Server' : 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtenido del Auth Service',
      },
    },
    schemas: {
      Task: {
        type: 'object',
        required: ['id', 'title', 'status', 'priority', 'userId', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', example: 'clp123abc456def789' },
          title: { type: 'string', maxLength: 200, example: 'Completar documentación API' },
          description: { type: 'string', maxLength: 2000, example: 'Finalizar la documentación de la API REST' },
          status: { 
            type: 'string', 
            enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
            example: 'PENDING'
          },
          priority: { 
            type: 'string', 
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            example: 'MEDIUM'
          },
          dueDate: { type: 'string', format: 'date-time', example: '2024-12-31T23:59:59Z' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          userId: { type: 'string', example: 'user123' },
          categoryId: { type: 'string', nullable: true, example: 'cat456' },
          tags: { type: 'array', items: { type: 'string' }, example: ['documentation', 'api'] },
          estimatedHours: { type: 'integer', minimum: 1, maximum: 999, example: 8 },
          actualHours: { type: 'integer', minimum: 1, maximum: 999, example: 6 },
          attachments: { type: 'array', items: { type: 'string' }, example: [] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          category: { $ref: '#/components/schemas/Category' },
        },
      },
      Category: {
        type: 'object',
        required: ['id', 'name', 'userId', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', example: 'cat123abc456def789' },
          name: { type: 'string', maxLength: 100, example: 'Desarrollo' },
          description: { type: 'string', maxLength: 500, example: 'Tareas relacionadas con desarrollo de software' },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#6366f1' },
          icon: { type: 'string', example: 'code' },
          isActive: { type: 'boolean', example: true },
          userId: { type: 'string', example: 'user123' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
        },
      },
      TaskStats: {
        type: 'object',
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
          lastUpdated: { type: 'string', format: 'date-time' },
        },
      },
      ApiResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: { type: 'object' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string', example: 'req_123abc456' },
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
      ValidationError: {
        type: 'object',
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
                    field: { type: 'string', example: 'title' },
                    message: { type: 'string', example: 'Title is required' },
                  },
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'An error occurred' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INTERNAL_ERROR' },
              details: { type: 'string', example: 'Additional error information' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string', example: 'req_123abc456' },
            },
          },
        },
      },
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Número de página',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Número de elementos por página',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      SortByParam: {
        name: 'sortBy',
        in: 'query',
        description: 'Campo por el que ordenar',
        required: false,
        schema: { 
          type: 'string', 
          enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title'],
          default: 'createdAt'
        },
      },
      SortOrderParam: {
        name: 'sortOrder',
        in: 'query',
        description: 'Orden de clasificación',
        required: false,
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      },
      StatusFilterParam: {
        name: 'status',
        in: 'query',
        description: 'Filtrar por estado',
        required: false,
        schema: { 
          type: 'string', 
          enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']
        },
      },
      PriorityFilterParam: {
        name: 'priority',
        in: 'query',
        description: 'Filtrar por prioridad',
        required: false,
        schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      },
      CategoryFilterParam: {
        name: 'categoryId',
        in: 'query',
        description: 'Filtrar por ID de categoría',
        required: false,
        schema: { type: 'string' },
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Buscar en título y descripción',
        required: false,
        schema: { type: 'string' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Solicitud inválida',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' }
          }
        }
      },
      Unauthorized: {
        description: 'Token de autorización requerido o inválido',
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
      name: 'Tasks',
      description: 'Operaciones de gestión de tareas',
    },
    {
      name: 'Categories',
      description: 'Operaciones de gestión de categorías',
    },
    {
      name: 'Statistics',
      description: 'Estadísticas y análisis de productividad',
    },
    {
      name: 'System',
      description: 'Endpoints del sistema',
    },
  ],
};

const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/presentation/routes/*.ts',
    './src/presentation/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export const swaggerUiOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #6366f1 }
  `,
  customSiteTitle: 'Task Service API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
};

/**
 * Genera ejemplos de respuesta para endpoints específicos
 */
export const generateSwaggerExamples = {
  taskListResponse: {
    success: true,
    message: 'Tasks retrieved successfully',
    data: [
      {
        id: 'clp123abc456def789',
        title: 'Completar documentación API',
        description: 'Finalizar la documentación de la API REST',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: '2024-12-31T23:59:59Z',
        userId: 'user123',
        categoryId: 'cat456',
        tags: ['documentation', 'api'],
        estimatedHours: 8,
        actualHours: 6,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-16T14:30:00Z',
        category: {
          id: 'cat456',
          name: 'Desarrollo',
          color: '#6366f1'
        }
      }
    ],
    meta: {
      timestamp: '2024-01-16T15:00:00Z',
      pagination: {
        page: 1,
        limit: 20,
        total: 25,
        pages: 2,
        hasNext: true,
        hasPrev: false
      }
    }
  },
  
  taskCreateRequest: {
    title: 'Implementar autenticación JWT',
    description: 'Agregar middleware de autenticación JWT al sistema',
    priority: 'HIGH',
    dueDate: '2024-02-15T18:00:00Z',
    categoryId: 'cat456',
    tags: ['security', 'jwt'],
    estimatedHours: 12
  },
  
  categoryListResponse: {
    success: true,
    message: 'Categories retrieved successfully',
    data: [
      {
        id: 'cat456',
        name: 'Desarrollo',
        description: 'Tareas relacionadas con desarrollo de software',
        color: '#6366f1',
        icon: 'code',
        isActive: true,
        userId: 'user123',
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-10T09:00:00Z'
      }
    ]
  },
  
  statsResponse: {
    success: true,
    message: 'Statistics retrieved successfully',
    data: {
      totalTasks: 25,
      completedTasks: 15,
      pendingTasks: 8,
      inProgressTasks: 2,
      overdueTasks: 3,
      urgentTasks: 1,
      highTasks: 4,
      mediumTasks: 15,
      lowTasks: 5,
      lastUpdated: '2024-01-16T15:00:00Z'
    }
  }
};

/**
 * Middleware helper para documentar respuestas de error comunes
 */
export const commonErrorResponses = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  500: { $ref: '#/components/responses/InternalError' },
};