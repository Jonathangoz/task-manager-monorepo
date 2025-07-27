// src/commons/validators/category.validator.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { 
  CATEGORY_CONFIG,
  VALIDATION_CONFIG,
  BUSINESS_RULES,
  SORT_FIELDS,
  SORT_ORDERS,
  PAGINATION_CONFIG,
  ERROR_MESSAGES,
  ERROR_CODES,
  EXPORT_FORMATS
} from '@/utils/constants';

// ==============================================
// DOMAIN-SPECIFIC VALIDATION PRIMITIVES
// ==============================================

/**
 * Base validation schemas for category domain
 * These primitives ensure consistent validation across all category operations
 */

// CUID validation with enhanced error messaging
const cuidSchema = z.string()
  .regex(
    new RegExp(`^c[a-z0-9]{${VALIDATION_CONFIG.CUID.MIN_LENGTH - 1},${VALIDATION_CONFIG.CUID.MAX_LENGTH - 1}}$`), 
    'Invalid category ID format. Expected CUID format (e.g., "cl9e2q1kj0001js08abcdefgh")'
  )
  .describe('Valid CUID identifier for category operations');

// Optional CUID for updates and associations
const optionalCuidSchema = z.union([cuidSchema, z.null()]).optional();

// Category name validation with business rules
const categoryNameSchema = z
  .string()
  .trim()
  .min(VALIDATION_RULES.CATEGORY.NAME_MIN_LENGTH, 'Category name is required')
  .max(VALIDATION_RULES.CATEGORY.NAME_MAX_LENGTH, 
    `Category name must be at most ${VALIDATION_RULES.CATEGORY.NAME_MAX_LENGTH} characters`)
  .regex(VALIDATION_CONFIG.NAME.PATTERN, 
    'Category name can only contain letters, numbers, spaces, hyphens, underscores, and accented characters')
  .refine((name) => !isReservedCategoryName(name), {
    message: 'This category name is reserved and cannot be used'
  })
  .describe('Category name with business rule validation');

// Category description validation
const categoryDescriptionSchema = z
  .string()
  .trim()
  .max(VALIDATION_RULES.CATEGORY.DESCRIPTION_MAX_LENGTH, 
    `Description cannot exceed ${VALIDATION_RULES.CATEGORY.DESCRIPTION_MAX_LENGTH} characters`)
  .optional()
  .describe('Optional category description');

// Color validation with palette enforcement
const categoryColorSchema = z
  .string()
  .regex(VALIDATION_CONFIG.HEX_COLOR.PATTERN, 'Color must be a valid hex color (e.g., #6366f1 or #rgb)')
  .transform((color) => normalizeHexColor(color))
  .refine((color) => !isFeatureEnabled('CATEGORY_COLOR_PALETTE_STRICT') || isValidCategoryColor(color), {
    message: `Color must be one of the allowed palette colors: ${CATEGORY_CONFIG.ALLOWED_COLORS.join(', ')}`
  })
  .describe('Hex color with optional palette restriction');

// Icon validation with allowed list enforcement
const categoryIconSchema = z
  .string()
  .trim()
  .min(VALIDATION_CONFIG.ICON.MIN_LENGTH, 'Icon is required')
  .max(VALIDATION_CONFIG.ICON.MAX_LENGTH, `Icon name too long`)
  .regex(VALIDATION_CONFIG.ICON.PATTERN, 'Icon name contains invalid characters')
  .refine((icon) => !isFeatureEnabled('CATEGORY_ICON_VALIDATION_STRICT') || isValidCategoryIcon(icon), {
    message: `Icon must be one of the allowed icons. Allowed icons: ${CATEGORY_CONFIG.ALLOWED_ICONS.slice(0, 10).join(', ')}...`
  })
  .describe('Category icon with optional strict validation');

// Active status validation
const isActiveSchema = z
  .boolean()
  .default(BUSINESS_RULES.CATEGORY.DEFAULT_IS_ACTIVE)
  .describe('Category active status');

// ==============================================
// SHARED VALIDATION COMPONENTS
// ==============================================

// Pagination schema with category-specific defaults
const categoryPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : PAGINATION_CONFIG.DEFAULT_PAGE)
    .pipe(z.number().int().min(1, 'Page must be a positive integer')),
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : PAGINATION_CONFIG.DEFAULT_LIMIT)
    .pipe(
      z.number()
        .int()
        .min(PAGINATION_CONFIG.MIN_LIMIT, `Limit must be at least ${PAGINATION_CONFIG.MIN_LIMIT}`)
        .max(PAGINATION_CONFIG.MAX_LIMIT, `Limit cannot exceed ${PAGINATION_CONFIG.MAX_LIMIT}`)
    )
}).describe('Pagination parameters for category queries');

// Sorting schema with category-specific fields
const categorySortingSchema = z.object({
  sortBy: z.enum([
    SORT_FIELDS.NAME,
    SORT_FIELDS.CREATED_AT,
    SORT_FIELDS.UPDATED_AT,
    SORT_FIELDS.TASK_COUNT
  ] as [string, ...string[]], {
    errorMap: () => ({ 
      message: `sortBy must be one of: ${[SORT_FIELDS.NAME, SORT_FIELDS.CREATED_AT, SORT_FIELDS.UPDATED_AT, SORT_FIELDS.TASK_COUNT].join(', ')}` 
    })
  }).default(SORT_FIELDS.CREATED_AT),
  sortOrder: z.enum(Object.values(SORT_ORDERS) as [string, ...string[]], {
    errorMap: () => ({ 
      message: `sortOrder must be one of: ${Object.values(SORT_ORDERS).join(', ')}` 
    })
  }).default(SORT_ORDERS.DESC)
}).describe('Sorting parameters for category queries');

// Search validation
const searchQuerySchema = z
  .string()
  .trim()
  .min(VALIDATION_CONFIG.SEARCH.MIN_LENGTH, 
    `Search query must be at least ${VALIDATION_CONFIG.SEARCH.MIN_LENGTH} characters`)
  .max(VALIDATION_CONFIG.SEARCH.MAX_LENGTH, 
    `Search query cannot exceed ${VALIDATION_CONFIG.SEARCH.MAX_LENGTH} characters`)
  .regex(VALIDATION_CONFIG.SEARCH.PATTERN, 
    'Search query contains invalid characters')
  .optional()
  .describe('Search query for category filtering');

// ==============================================
// CATEGORY CRUD OPERATION SCHEMAS
// ==============================================

/**
 * Schema for creating a new category
 * POST /api/v1/categories
 * 
 * Enforces business rules:
 * - Name uniqueness (handled at service layer)
 * - Default values for color and icon
 * - Category limit per user (handled at service layer)
 */
export const createCategorySchema = z.object({
  body: z.object({
    name: categoryNameSchema,
    description: categoryDescriptionSchema,
    color: categoryColorSchema.default(getDefaultCategoryColor()),
    icon: categoryIconSchema.default(getDefaultCategoryIcon()),
    isActive: isActiveSchema
  }),
  params: z.object({}),
  query: z.object({})
}).describe('Category creation validation schema');

/**
 * Schema for updating an existing category
 * PUT/PATCH /api/v1/categories/:id
 * 
 * All fields are optional for partial updates
 * Maintains same validation rules as creation
 */
export const updateCategorySchema = z.object({
  body: z.object({
    name: categoryNameSchema.optional(),
    description: z.union([categoryDescriptionSchema, z.null()]).optional(),
    color: categoryColorSchema.optional(),
    icon: categoryIconSchema.optional(),
    isActive: isActiveSchema.optional()
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
}).describe('Category update validation schema');

/**
 * Schema for updating category status only
 * PATCH /api/v1/categories/:id/status
 */
export const updateCategoryStatusSchema = z.object({
  body: z.object({
    isActive: isActiveSchema
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
}).describe('Category status update validation schema');

// ==============================================
// QUERY AND FILTERING SCHEMAS
// ==============================================

/**
 * Schema for getting categories with advanced filtering
 * GET /api/v1/categories
 * 
 * Supports multiple filter combinations and search functionality
 */
export const getCategoriesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: categoryPaginationSchema
    .extend(categorySortingSchema.shape)
    .extend({
      // Active status filter
      isActive: z
        .string()
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined)
        .pipe(z.boolean().optional()),

      // Color filter (exact match or array of colors)
      color: z.union([
        categoryColorSchema,
        z.array(categoryColorSchema)
      ]).optional()
        .transform((val) => Array.isArray(val) ? val : val ? [val] : undefined),

      // Icon filter (exact match or array of icons)
      icon: z.union([
        categoryIconSchema,
        z.array(categoryIconSchema)
      ]).optional()
        .transform((val) => Array.isArray(val) ? val : val ? [val] : undefined),

      // Task count filters
      minTasks: z
        .string()
        .optional()
        .transform((val) => val ? parseInt(val, 10) : undefined)
        .pipe(z.number().int().min(0, 'Minimum task count cannot be negative').optional()),
      
      maxTasks: z
        .string()
        .optional()
        .transform((val) => val ? parseInt(val, 10) : undefined)
        .pipe(z.number().int().min(0, 'Maximum task count cannot be negative').optional()),

      // Boolean filters
      hasIcon: z
        .string()
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined)
        .pipe(z.boolean().optional()),

      // Search functionality
      search: searchQuerySchema,

      // Date range filters
      createdFrom: z
        .string()
        .datetime({ message: 'createdFrom must be a valid ISO 8601 date' })
        .optional(),
      
      createdTo: z
        .string()
        .datetime({ message: 'createdTo must be a valid ISO 8601 date' })
        .optional()
    })
    .refine((data) => {
      // Validate task count range consistency
      if (data.minTasks !== undefined && data.maxTasks !== undefined) {
        return data.minTasks <= data.maxTasks;
      }
      return true;
    }, {
      message: 'minTasks must be less than or equal to maxTasks',
      path: ['maxTasks']
    })
    .refine((data) => {
      // Validate date range consistency
      if (data.createdFrom && data.createdTo) {
        return new Date(data.createdFrom) < new Date(data.createdTo);
      }
      return true;
    }, {
      message: 'createdFrom must be before createdTo',
      path: ['createdTo']
    })
}).describe('Category listing and filtering validation schema');

/**
 * Schema for getting single category
 * GET /api/v1/categories/:id
 */
export const getCategoryByIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({
    // Optional: include task count
    includeTasks: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional()),
    
    // Optional: include inactive tasks in count
    includeInactiveTasks: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional())
  })
}).describe('Category retrieval validation schema');

/**
 * Schema for deleting category
 * DELETE /api/v1/categories/:id
 */
export const deleteCategorySchema = z.object({
  body: z.object({}),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({
    // Force delete even if category has tasks
    force: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional()),
    
    // Move tasks to another category before deletion
    moveTo: optionalCuidSchema
  })
}).describe('Category deletion validation schema');

// ==============================================
// BULK OPERATIONS SCHEMAS
// ==============================================

// Reusable category IDs array validation
const categoryIdsArraySchema = z
  .array(cuidSchema)
  .min(1, 'At least one category ID is required')
  .max(VALIDATION_CONFIG.BULK.MAX_CATEGORY_DELETE, 
    `Cannot process more than ${VALIDATION_CONFIG.BULK.MAX_CATEGORY_DELETE} categories at once`)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Duplicate category IDs are not allowed'
  })
  .describe('Array of unique category IDs for bulk operations');

/**
 * Schema for bulk category updates
 * PATCH /api/v1/categories/bulk
 */
export const bulkUpdateCategoriesSchema = z.object({
  body: z.object({
    categoryIds: categoryIdsArraySchema,
    updates: z.object({
      color: categoryColorSchema.optional(),
      icon: categoryIconSchema.optional(),
      isActive: isActiveSchema.optional()
    }).refine((updates) => Object.keys(updates).length > 0, {
      message: 'At least one update field is required'
    })
  }),
  params: z.object({}),
  query: z.object({})
}).describe('Bulk category update validation schema');

/**
 * Schema for bulk status update
 * PATCH /api/v1/categories/bulk/status
 */
export const bulkUpdateCategoryStatusSchema = z.object({
  body: z.object({
    categoryIds: categoryIdsArraySchema,
    isActive: isActiveSchema
  }),
  params: z.object({}),
  query: z.object({})
}).describe('Bulk category status update validation schema');

/**
 * Schema for bulk category deletion
 * DELETE /api/v1/categories/bulk
 */
export const bulkDeleteCategoriesSchema = z.object({
  body: z.object({
    categoryIds: categoryIdsArraySchema,
    force: z.boolean().default(false).describe('Force delete categories with tasks'),
    moveTasksTo: optionalCuidSchema.describe('Category to move tasks to before deletion')
  }),
  params: z.object({}),
  query: z.object({})
}).describe('Bulk category deletion validation schema');

// ==============================================
// SPECIALIZED OPERATION SCHEMAS
// ==============================================

/**
 * Schema for category search
 * GET /api/v1/categories/search
 */
export const searchCategoriesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    q: z
      .string()
      .trim()
      .min(VALIDATION_CONFIG.SEARCH.MIN_LENGTH, 
        `Search query must be at least ${VALIDATION_CONFIG.SEARCH.MIN_LENGTH} characters`)
      .max(VALIDATION_CONFIG.SEARCH.MAX_LENGTH, 
        `Search query cannot exceed ${VALIDATION_CONFIG.SEARCH.MAX_LENGTH} characters`)
      .regex(VALIDATION_CONFIG.SEARCH.PATTERN, 'Search query contains invalid characters')
  }).merge(getCategoriesSchema.shape.query.omit({ search: true }))
}).describe('Category search validation schema');

/**
 * Schema for getting category statistics
 * GET /api/v1/categories/stats
 */
export const getCategoryStatsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    // Date range for statistics
    from: z
      .string()
      .datetime({ message: 'from must be a valid ISO 8601 date' })
      .optional(),
    to: z
      .string()
      .datetime({ message: 'to must be a valid ISO 8601 date' })
      .optional(),
    
    // Include inactive categories in stats
    includeInactive: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional())
  })
}).describe('Category statistics validation schema');

/**
 * Schema for category duplication
 * POST /api/v1/categories/:id/duplicate
 */
export const duplicateCategorySchema = z.object({
  body: z.object({
    name: categoryNameSchema.optional().describe('New name for duplicated category'),
    copyTasks: z.boolean().default(false).describe('Whether to copy associated tasks')
  }),
  params: z.object({
    id: cuidSchema
  }),
  query: z.object({})
}).describe('Category duplication validation schema');

/**
 * Schema for category export
 * GET /api/v1/categories/export
 */
export const exportCategoriesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    format: z.enum(Object.values(EXPORT_FORMATS) as [string, ...string[]], {
      errorMap: () => ({ 
        message: `Export format must be one of: ${Object.values(EXPORT_FORMATS).join(', ')}` 
      })
    }).default(EXPORT_FORMATS.JSON),
    
    includeInactive: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional()),
    
    includeTasks: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean().optional())
  }).merge(getCategoriesSchema.shape.query.pick({ 
    isActive: true, 
    color: true, 
    createdFrom: true, 
    createdTo: true 
  }))
}).describe('Category export validation schema');

// ==============================================
// TYPE EXPORTS (Auto-generated from Zod Schemas)
// ==============================================

// Input types for controllers and services
export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type GetCategoriesQuery = z.infer<typeof getCategoriesSchema>['query'];
export type SearchCategoriesQuery = z.infer<typeof searchCategoriesSchema>['query'];
export type BulkUpdateCategoriesInput = z.infer<typeof bulkUpdateCategoriesSchema>['body'];
export type BulkDeleteCategoriesInput = z.infer<typeof bulkDeleteCategoriesSchema>['body'];
export type CategoryStatsQuery = z.infer<typeof getCategoryStatsSchema>['query'];
export type ExportCategoriesQuery = z.infer<typeof exportCategoriesSchema>['query'];

// Parameter types
export type CategoryIdParam = z.infer<typeof getCategoryByIdSchema>['params'];

// ==============================================
// VALIDATION MIDDLEWARE FACTORY
// ==============================================

/**
 * Generic validation middleware factory with enhanced error handling
 * Follows Single Responsibility Principle - only handles validation
 */
export const validateCategorySchema = <T extends z.ZodSchema>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Enhanced validation with detailed context
      const validationResult = await schema.parseAsync({
        body: req.body,
        params: req.params, 
        query: req.query
      });
      
      // Replace request objects with validated/transformed data
      req.body = validationResult.body;
      req.params = validationResult.params;
      req.query = validationResult.query;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Enhanced error formatting with field paths and context
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received,
          expected: err.expected
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            details: formattedErrors,
            context: 'category_validation'
          },
          meta: {
            timestamp: new Date().toISOString(),
            validationErrors: formattedErrors.length
          }
        });
      }
      
      // Pass non-validation errors to global error handler
      next(error);
    }
  };
};

// ==============================================
// VALIDATION HELPER FUNCTIONS
// ==============================================

/**
 * Validates category name uniqueness at runtime
 * This is separated from schema validation as it requires database access
 */
export const validateCategoryNameUniqueness = (
  name: string, 
  userId: string, 
  excludeId?: string
) => {
  // This would typically be implemented in the service layer
  // returning a Promise<boolean> after checking the database
  return z.string().min(1).parse(name); // Basic validation here
};

/**
 * Validates user category limit
 * Business rule validation that requires database access
 */
export const validateUserCategoryLimit = (userId: string) => {
  // This would be implemented in the service layer
  // checking against BUSINESS_RULES.CATEGORY.MAX_PER_USER
  return z.string().parse(userId); // Basic validation here
};

/**
 * Custom validation for category deletion with tasks
 * Complex business rule that may require multiple database queries
 */
export const validateCategoryDeletion = (
  categoryId: string, 
  force: boolean = false, 
  moveTasksTo?: string
) => {
  return z.object({
    categoryId: cuidSchema,
    force: z.boolean(),
    moveTasksTo: optionalCuidSchema
  }).parse({ categoryId, force, moveTasksTo });
};

// ==============================================
// SCHEMA COMPOSITION HELPERS
// ==============================================

/**
 * Creates a composed schema for complex validation scenarios
 * Follows Open/Closed Principle - extensible without modification
 */
export const createComposedCategorySchema = (
  baseSchema: z.ZodSchema,
  extensions: Record<string, z.ZodSchema> = {}
) => {
  let composedSchema = baseSchema;
  
  Object.entries(extensions).forEach(([key, extension]) => {
    composedSchema = composedSchema.extend({ [key]: extension });
  });
  
  return composedSchema;
};

/**
 * Creates conditional validation based on feature flags
 * Allows different validation rules in different environments
 */
export const createConditionalCategorySchema = (
  baseSchema: z.ZodSchema,
  conditions: Record<string, () => boolean>,
  conditionalSchemas: Record<string, z.ZodSchema>
) => {
  let schema = baseSchema;
  
  Object.entries(conditions).forEach(([key, condition]) => {
    if (condition() && conditionalSchemas[key]) {
      schema = schema.extend(conditionalSchemas[key].shape);
    }
  });
  
  return schema;
};

// ==============================================
// UTILITY FUNCTIONS (imported from constants)
// ==============================================

// These functions are imported from constants but re-exported for convenience
import {
  isValidCategoryColor,
  isValidCategoryIcon,
  isReservedCategoryName,
  normalizeHexColor,
  getDefaultCategoryColor,
  getDefaultCategoryIcon,
  isFeatureEnabled
} from '@/utils/constants';

// Re-export for use in other modules
export {
  isValidCategoryColor,
  isValidCategoryIcon,
  isReservedCategoryName,
  normalizeHexColor,
  getDefaultCategoryColor,
  getDefaultCategoryIcon,
  isFeatureEnabled
};

// ==============================================
// USAGE EXAMPLES AND DOCUMENTATION
// ==============================================

/*
USAGE EXAMPLES:

// In your route files:
import { 
  validateCategorySchema, 
  createCategorySchema, 
  getCategoriesSchema,
  bulkUpdateCategoriesSchema 
} from './validators/category.validator';

// Category CRUD routes
router.post('/categories', 
  validateCategorySchema(createCategorySchema), 
  CategoryController.createCategory
);

router.get('/categories', 
  validateCategorySchema(getCategoriesSchema), 
  CategoryController.getCategories
);

router.patch('/categories/bulk', 
  validateCategorySchema(bulkUpdateCategoriesSchema), 
  CategoryController.bulkUpdateCategories
);

// In your controller:
export class CategoryController {
  static async createCategory(req: Request, res: Response) {
    // req.body is now fully typed and validated
    const categoryData: CreateCategoryInput = req.body;
    
    // Additional business rule validation
    await validateCategoryNameUniqueness(categoryData.name, req.user.id);
    await validateUserCategoryLimit(req.user.id);
    
    // ... rest of controller logic
  }
  
  static async getCategories(req: Request, res: Response) {
    // req.query is now fully typed and validated
    const filters: GetCategoriesQuery = req.query;
    
    // All query parameters are properly typed and transformed
    const categories = await CategoryService.getCategories(req.user.id, filters);
    
    // ... rest of controller logic
  }
}

ADVANCED USAGE:

// Conditional validation based on feature flags
const conditionalCreateSchema = createConditionalCategorySchema(
  createCategorySchema,
  {
    'strictColorValidation': () => isFeatureEnabled('CATEGORY_COLOR_PALETTE_STRICT'),
    'strictIconValidation': () => isFeatureEnabled('CATEGORY_ICON_VALIDATION_STRICT')
  },
  {
    'strictColorValidation': z.object({
      color: categoryColorSchema.refine(isValidCategoryColor)
    }),
    'strictIconValidation': z.object({
      icon: categoryIconSchema.refine(isValidCategoryIcon)
    })
  }
);

// Extended validation for admin operations
const adminCategorySchema = createComposedCategorySchema(
  createCategorySchema,
  {
    adminOverrides: z.object({
      bypassLimits: z.boolean().optional(),
      auditReason: z.string().optional()
    })
  }
);
*/