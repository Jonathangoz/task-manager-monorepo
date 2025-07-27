// src/commons/validators/task.validator.ts
import { z } from 'zod';
import { 
  TASK_CONFIG, 
  CATEGORY_CONFIG,
  TASK_STATUSES, 
  TASK_PRIORITIES, 
  SORT_FIELDS, 
  SORT_ORDERS,
  PAGINATION_CONFIG,
  ERROR_MESSAGES,
  ERROR_CODES
} from '@/utils/constants';

/**
 * TaskValidator with Zod
 * 
 * Provides type-safe validation schemas for all task-related operations.
 * Uses Zod for better type inference, composition, and developer experience.
 */

// ==============================================
// BASE SCHEMAS (Reusable components)
// ==============================================

// CUID validation schema
const cuidSchema = z.string()
  .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format')
  .describe('Valid CUID identifier');

// Optional CUID (allows null for updates)
const optionalCuidSchema = z.union([cuidSchema, z.null()]).optional();

// Date schemas
const futureDateSchema = z
  .string()
  .datetime({ message: 'Must be a valid ISO 8601 datetime' })
  .refine((date) => {
    const parsed = new Date(date);
    const now = new Date();
    const minDate = new Date(now.getTime() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60000);
    return parsed > minDate;
  }, {
    message: `Due date must be at least ${TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES} minutes in the future`
  });

const optionalFutureDateSchema = z.union([futureDateSchema, z.null()]).optional();

// Title schema
const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(TASK_CONFIG.MAX_TITLE_LENGTH, `Title must be at most ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`)
  .regex(/^[\w\s\-.,!?()]+$/, 'Title contains invalid characters');

// Description schema
const descriptionSchema = z
  .string()
  .trim()
  .max(TASK_CONFIG.MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`)
  .optional();

// Status schema
const statusSchema = z.enum(Object.values(TASK_STATUSES) as [string, ...string[]], {
  errorMap: () => ({ message: `Status must be one of: ${Object.values(TASK_STATUSES).join(', ')}` })
});

// Priority schema
const prioritySchema = z.enum(Object.values(TASK_PRIORITIES) as [string, ...string[]], {
  errorMap: () => ({ message: `Priority must be one of: ${Object.values(TASK_PRIORITIES).join(', ')}` })
});

// Tags schema
const tagsSchema = z
  .array(
    z.string()
      .trim()
      .min(1, 'Tag cannot be empty')
      .max(TASK_CONFIG.MAX_TAG_LENGTH, `Each tag must be at most ${TASK_CONFIG.MAX_TAG_LENGTH} characters`)
      .regex(/^[\w\s\-]+$/, 'Tags can only contain letters, numbers, spaces, hyphens, and underscores')
  )
  .max(TASK_CONFIG.MAX_TAGS_COUNT, `Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`)
  .optional();

// Attachments schema
const attachmentsSchema = z
  .array(
    z.string().url('Each attachment must be a valid URL')
  )
  .max(TASK_CONFIG.MAX_ATTACHMENTS_COUNT, `Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`)
  .optional();

// Hours schemas
const estimatedHoursSchema = z
  .number()
  .int('Estimated hours must be an integer')
  .min(1, 'Estimated hours must be at least 1')
  .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Estimated hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
  .optional();

const optionalEstimatedHoursSchema = z.union([estimatedHoursSchema, z.null()]).optional();

const actualHoursSchema = z
  .number()
  .int('Actual hours must be an integer')
  .min(0, 'Actual hours cannot be negative')
  .max(TASK_CONFIG.MAX_ESTIMATED_HOURS, `Actual hours cannot exceed ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`)
  .optional();

const optionalActualHoursSchema = z.union([actualHoursSchema, z.null()]).optional();

// Pagination schemas
const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val) : undefined)
    .pipe(z.number().int().min(1, 'Page must be a positive integer').optional()),
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val) : undefined)
    .pipe(
      z.number()
        .int()
        .min(PAGINATION_CONFIG.MIN_LIMIT, `Limit must be at least ${PAGINATION_CONFIG.MIN_LIMIT}`)
        .max(PAGINATION_CONFIG.MAX_LIMIT, `Limit cannot exceed ${PAGINATION_CONFIG.MAX_LIMIT}`)
        .optional()
    )
});

// Sorting schemas
const sortingSchema = z.object({
  sortBy: z.enum(Object.values(SORT_FIELDS) as [string, ...string[]], {
    errorMap: () => ({ message: `sortBy must be one of: ${Object.values(SORT_FIELDS).join(', ')}` })
  }).optional(),
  sortOrder: z.enum(Object.values(SORT_ORDERS) as [string, ...string[]], {
    errorMap: () => ({ message: `sortOrder must be one of: ${Object.values(SORT_ORDERS).join(', ')}` })
  }).optional()
});

// ==============================================
// TASK CRUD OPERATION SCHEMAS
// ==============================================

/**
 * Schema for creating a new task
 * POST /api/v1/tasks
 */
export const createTaskSchema = z.object({
  body: z.object({
    title: titleSchema,
    description: descriptionSchema,
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: futureDateSchema.optional(),
    categoryId: cuidSchema.optional(),
    tags: tagsSchema,
    estimatedHours: estimatedHoursSchema,
    attachments: attachmentsSchema
  }),
  params: z.object({}),
  query: z.object({})
});

/**
 * Schema for updating a task
 * PUT/PATCH /api/v1/tasks/:id
 */
export const updateTaskSchema = z.object({
  body: z.object({
    title: titleSchema.optional(),
    description: z.union([descriptionSchema, z.null()]).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: optionalFutureDateSchema,
    categoryId: optionalCuidSchema,
    tags: tagsSchema,
    estimatedHours: optionalEstimatedHoursSchema,
    actualHours: optionalActualHoursSchema,
    attachments: attachmentsSchema
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

/**
 * Schema for updating task status only
 * PATCH /api/v1/tasks/:id/status
 */
export const updateTaskStatusSchema = z.object({
  body: z.object({
    status: statusSchema
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

/**
 * Schema for updating task priority only
 * PATCH /api/v1/tasks/:id/priority
 */
export const updateTaskPrioritySchema = z.object({
  body: z.object({
    priority: prioritySchema
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

// ==============================================
// QUERY AND FILTERING SCHEMAS
// ==============================================

/**
 * Schema for getting tasks with filters
 * GET /api/v1/tasks
 */
export const getTasksSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationSchema
    .extend(sortingSchema.shape)
    .extend({
      // Status filters - support multiple values
      status: z.union([
        statusSchema,
        z.array(statusSchema)
      ]).optional()
        .transform((val) => Array.isArray(val) ? val : val ? [val] : undefined),

      // Priority filters - support multiple values  
      priority: z.union([
        prioritySchema,
        z.array(prioritySchema)
      ]).optional()
        .transform((val) => Array.isArray(val) ? val : val ? [val] : undefined),

      // Category filter
      categoryId: cuidSchema.optional(),

      // Date range filters
      dueDateFrom: z
        .string()
        .datetime({ message: 'dueDateFrom must be a valid ISO 8601 date' })
        .optional(),
      dueDateTo: z
        .string()
        .datetime({ message: 'dueDateTo must be a valid ISO 8601 date' })
        .optional(),

      // Boolean filters
      isOverdue: z
        .string()
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined)
        .pipe(z.boolean().optional()),
      hasDueDate: z
        .string()
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined)
        .pipe(z.boolean().optional()),

      // Search functionality
      search: z
        .string()
        .trim()
        .min(2, 'Search term must be at least 2 characters')
        .max(100, 'Search term cannot exceed 100 characters')
        .optional(),

      // Tags filter
      tags: z.union([
        z.string(),
        z.array(z.string())
      ]).optional()
        .transform((val) => Array.isArray(val) ? val : val ? [val] : undefined)
        .pipe(z.array(z.string().max(TASK_CONFIG.MAX_TAG_LENGTH)).optional())
    })
    .refine((data) => {
      // Validate date range consistency
      if (data.dueDateFrom && data.dueDateTo) {
        return new Date(data.dueDateFrom) < new Date(data.dueDateTo);
      }
      return true;
    }, {
      message: 'dueDateFrom must be before dueDateTo',
      path: ['dueDateTo']
    })
});

/**
 * Schema for getting single task
 * GET /api/v1/tasks/:id
 */
export const getTaskByIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

/**
 * Schema for deleting task
 * DELETE /api/v1/tasks/:id
 */
export const deleteTaskSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

// ==============================================
// BULK OPERATIONS SCHEMAS
// ==============================================

const taskIdsArraySchema = z
  .array(cuidSchema)
  .min(1, 'At least one task ID is required')
  .max(50, 'Cannot process more than 50 tasks at once')
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Duplicate task IDs are not allowed'
  });

/**
 * Schema for bulk task updates
 * PATCH /api/v1/tasks/bulk
 */
export const bulkUpdateTasksSchema = z.object({
  body: z.object({
    taskIds: taskIdsArraySchema,
    updates: z.object({
      status: statusSchema.optional(),
      priority: prioritySchema.optional(),
      categoryId: optionalCuidSchema,
      tags: tagsSchema
    }).refine((updates) => Object.keys(updates).length > 0, {
      message: 'At least one update field is required'
    })
  }),
  params: z.object({}),
  query: z.object({})
});

/**
 * Schema for bulk status update
 * PATCH /api/v1/tasks/bulk/status
 */
export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    taskIds: taskIdsArraySchema,
    status: statusSchema
  }),
  params: z.object({}),
  query: z.object({})
});

/**
 * Schema for bulk delete
 * DELETE /api/v1/tasks/bulk
 */
export const bulkDeleteTasksSchema = z.object({
  body: z.object({
    taskIds: taskIdsArraySchema
  }),
  params: z.object({}),
  query: z.object({})
});

// ==============================================
// SPECIALIZED SCHEMAS
// ==============================================

/**
 * Schema for task search
 * GET /api/v1/tasks/search
 */
export const searchTasksSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    q: z
      .string()
      .trim()
      .min(2, 'Search query must be at least 2 characters')
      .max(100, 'Search query cannot exceed 100 characters')
  }).merge(getTasksSchema.shape.query.omit({ search: true }))
});

/**
 * Schema for tasks by category
 * GET /api/v1/tasks/category/:categoryId
 */
export const getTasksByCategorySchema = z.object({
  body: z.object({}),
  params: z.object({
    categoryId: cuidSchema
  }),
  query: paginationSchema
});

/**
 * Schema for task duplication
 * POST /api/v1/tasks/:id/duplicate
 */
export const duplicateTaskSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
});

/**
 * Schema for marking task as completed
 * PATCH /api/v1/tasks/:id/complete
 */
export const markTaskAsCompletedSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema  
  }),
  query: z.object({})
});

// ==============================================
// TYPE EXPORTS (Generated automatically by Zod)
// ==============================================

// Infer types from schemas for use in controllers/services
export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type GetTasksQuery = z.infer<typeof getTasksSchema>['query'];
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>['body'];
export type SearchTasksQuery = z.infer<typeof searchTasksSchema>['query'];

// ==============================================
// VALIDATION MIDDLEWARE HELPER
// ==============================================

import { Request, Response, NextFunction } from 'express';

/**
 * Generic validation middleware factory for Zod schemas
 */
export const validateSchema = <T extends z.ZodSchema>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schema.parseAsync({
        body: req.body,
        params: req.params, 
        query: req.query
      });
      
      // Replace request objects with validated/transformed data
      req.body = result.body;
      req.params = result.params;
      req.query = result.query;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            details: formattedErrors
          }
        });
      }
      
      next(error);
    }
  };
};

// ==============================================
// USAGE EXAMPLES
// ==============================================

/*
// In your route files:
import { validateSchema, createTaskSchema, getTasksSchema } from './validators/task.validator';

// Create task route
router.post('/tasks', validateSchema(createTaskSchema), TaskController.createTask);

// Get tasks route  
router.get('/tasks', validateSchema(getTasksSchema), TaskController.getTasks);

// In your controller:
export class TaskController {
  static async createTask(req: Request, res: Response) {
    // req.body is now fully typed and validated
    const taskData: CreateTaskInput = req.body;
    // ... rest of controller logic
  }
  
  static async getTasks(req: Request, res: Response) {
    // req.query is now fully typed and validated
    const filters: GetTasksQuery = req.query;
    // ... rest of controller logic
  }
}
*/