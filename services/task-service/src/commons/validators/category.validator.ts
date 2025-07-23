// src/presentation/validators/category.validator.ts
import { body, param, query, ValidationChain } from 'express-validator';
import { 
  CATEGORY_CONFIG, 
  SORT_FIELDS, 
  SORT_ORDERS,
  PAGINATION_CONFIG,
  TASK_STATUSES,
  TASK_PRIORITIES,
  ERROR_MESSAGES 
} from '@/utils/constants';

export class CategoryValidator {
  /**
   * Validation for creating a new category
   * POST /api/v1/categories
   */
  static createCategory(): ValidationChain[] {
    return [
      body('name')
        .trim()
        .notEmpty()
        .withMessage('Category name is required')
        .isLength({ min: 1, max: CATEGORY_CONFIG.MAX_NAME_LENGTH })
        .withMessage(`Category name must be between 1 and ${CATEGORY_CONFIG.MAX_NAME_LENGTH} characters`)
        .matches(/^[a-zA-Z0-9\s\-_]+$/)
        .withMessage('Category name can only contain letters, numbers, spaces, hyphens, and underscores'),

      body('description')
        .optional()
        .trim()
        .isLength({ max: CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH })
        .withMessage(`Description cannot exceed ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} characters`),

      body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color must be a valid hex color (e.g., #ff0000 or #f00)')
        .custom((value) => {
          // Additional validation to ensure it's not just # followed by valid hex
          if (value && value.length < 4) {
            throw new Error('Color must be a valid hex color with at least 3 characters after #');
          }
          return true;
        }),

      body('icon')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Icon name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z0-9\-_]+$/)
        .withMessage('Icon name can only contain letters, numbers, hyphens, and underscores'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value'),
    ];
  }

  /**
   * Validation for updating a category
   * PUT /api/v1/categories/:id
   */
  static updateCategory(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

      body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Category name cannot be empty')
        .isLength({ min: 1, max: CATEGORY_CONFIG.MAX_NAME_LENGTH })
        .withMessage(`Category name must be between 1 and ${CATEGORY_CONFIG.MAX_NAME_LENGTH} characters`)
        .matches(/^[a-zA-Z0-9\s\-_]+$/)
        .withMessage('Category name can only contain letters, numbers, spaces, hyphens, and underscores'),

      body('description')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true; // Allow null to clear description
          if (value && (typeof value !== 'string' || value.length > CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH)) {
            throw new Error(`Description cannot exceed ${CATEGORY_CONFIG.MAX_DESCRIPTION_LENGTH} characters`);
          }
          return true;
        }),

      body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color must be a valid hex color (e.g., #ff0000 or #f00)')
        .custom((value) => {
          if (value && value.length < 4) {
            throw new Error('Color must be a valid hex color with at least 3 characters after #');
          }
          return true;
        }),

      body('icon')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true; // Allow null to clear icon
          if (value && (typeof value !== 'string' || value.length < 1 || value.length > 50)) {
            throw new Error('Icon name must be between 1 and 50 characters');
          }
          if (value && !value.match(/^[a-zA-Z0-9\-_]+$/)) {
            throw new Error('Icon name can only contain letters, numbers, hyphens, and underscores');
          }
          return true;
        }),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value'),
    ];
  }

  /**
   * Validation for getting categories
   * GET /api/v1/categories
   */
  static getCategories(): ValidationChain[] {
    return [
      query('includeInactive')
        .optional()
        .isBoolean()
        .withMessage('includeInactive must be a boolean'),

      query('includeTaskCount')
        .optional()
        .isBoolean()
        .withMessage('includeTaskCount must be a boolean'),
    ];
  }

  /**
   * Validation for getting single category
   * GET /api/v1/categories/:id
   */
  static getCategoryById(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

      query('includeTaskCount')
        .optional()
        .isBoolean()
        .withMessage('includeTaskCount must be a boolean'),
    ];
  }

  /**
   * Validation for deleting category
   * DELETE /api/v1/categories/:id
   */
  static deleteCategory(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

      query('force')
        .optional()
        .isBoolean()
        .withMessage('force must be a boolean'),
    ];
  }

  /**
   * Validation for getting category tasks
   * GET /api/v1/categories/:id/tasks
   */
  static getCategoryTasks(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

      query('limit')
        .optional()
        .isInt({ min: PAGINATION_CONFIG.MIN_LIMIT, max: PAGINATION_CONFIG.MAX_LIMIT })
        .withMessage(`Limit must be between ${PAGINATION_CONFIG.MIN_LIMIT} and ${PAGINATION_CONFIG.MAX_LIMIT}`),

      query('status')
        .optional()
        .custom((value) => {
          const statuses = Array.isArray(value) ? value : [value];
          for (const status of statuses) {
            if (!Object.values(TASK_STATUSES).includes(status)) {
              throw new Error(`Invalid status: ${status}. Must be one of: ${Object.values(TASK_STATUSES).join(', ')}`);
            }
          }
          return true;
        }),

      query('priority')
        .optional()
        .custom((value) => {
          const priorities = Array.isArray(value) ? value : [value];
          for (const priority of priorities) {
            if (!Object.values(TASK_PRIORITIES).includes(priority)) {
              throw new Error(`Invalid priority: ${priority}. Must be one of: ${Object.values(TASK_PRIORITIES).join(', ')}`);
            }
          }
          return true;
        }),

      query('dueDateFrom')
        .optional()
        .isISO8601()
        .withMessage('dueDateFrom must be a valid ISO 8601 date'),

      query('dueDateTo')
        .optional()
        .isISO8601()
        .withMessage('dueDateTo must be a valid ISO 8601 date'),

      query('isOverdue')
        .optional()
        .isBoolean()
        .withMessage('isOverdue must be a boolean'),

      query('hasDueDate')
        .optional()
        .isBoolean()
        .withMessage('hasDueDate must be a boolean'),

      query('search')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be between 1 and 100 characters'),

      query('sortBy')
        .optional()
        .isIn(Object.values(SORT_FIELDS))
        .withMessage(`sortBy must be one of: ${Object.values(SORT_FIELDS).join(', ')}`),

      query('sortOrder')
        .optional()
        .isIn(Object.values(SORT_ORDERS))
        .withMessage(`sortOrder must be one of: ${Object.values(SORT_ORDERS).join(', ')}`),
    ];
  }

  /**
   * Validation for toggling category status
   * PATCH /api/v1/categories/:id/toggle
   */
  static toggleCategoryStatus(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),
    ];
  }

  /**
   * Validation for getting category statistics
   * GET /api/v1/categories/:id/stats
   */
  static getCategoryStats(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),
    ];
  }

  /**
   * Validation for bulk category operations
   * PATCH /api/v1/categories/bulk
   */
  static bulkUpdateCategories(): ValidationChain[] {
    return [
      body('categoryIds')
        .isArray({ min: 1, max: 20 })
        .withMessage('categoryIds must be an array with 1-20 items')
        .custom((categoryIds: string[]) => {
          for (const id of categoryIds) {
            if (typeof id !== 'string' || !id.match(/^[a-zA-Z0-9_-]+$/)) {
              throw new Error('All category IDs must be valid strings');
            }
          }
          return true;
        }),

      body('updates')
        .isObject()
        .withMessage('updates must be an object')
        .custom((updates) => {
          const allowedFields = ['name', 'description', 'color', 'icon', 'isActive'];
          const updateKeys = Object.keys(updates);
          
          if (updateKeys.length === 0) {
            throw new Error('At least one update field is required');
          }

          for (const key of updateKeys) {
            if (!allowedFields.includes(key)) {
              throw new Error(`Invalid update field: ${key}. Allowed fields: ${allowedFields.join(', ')}`);
            }
          }

          // Validate individual update fields
          if (updates.name && (typeof updates.name !== 'string' || 
              updates.name.length > CATEGORY_CONFIG.MAX_NAME_LENGTH ||
              !updates.name.match(/^[a-zA-Z0-9\s\-_]+$/))) {
            throw new Error('Invalid name in updates');
          }

          if (updates.description && typeof updates.description !== 'string') {
            throw new Error('Description must be a string');
          }

          if (updates.color && !updates.color.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
            throw new Error('Invalid color format in updates');
          }

          if (updates.icon && (typeof updates.icon !== 'string' || 
              !updates.icon.match(/^[a-zA-Z0-9\-_]+$/))) {
            throw new Error('Invalid icon format in updates');
          }

          if (updates.isActive !== undefined && typeof updates.isActive !== 'boolean') {
            throw new Error('isActive must be a boolean');
          }

          return true;
        }),
    ];
  }

  /**
   * Validation for moving tasks between categories
   * PATCH /api/v1/categories/:id/move-tasks
   */
  static moveTasksToCategory(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Source category ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid source category ID format'),

      body('taskIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('taskIds must be an array with 1-50 items')
        .custom((taskIds: string[]) => {
          for (const id of taskIds) {
            if (typeof id !== 'string' || !id.match(/^[a-zA-Z0-9_-]+$/)) {
              throw new Error('All task IDs must be valid strings');
            }
          }
          return true;
        }),

      body('targetCategoryId')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true; // Allow null to remove category from tasks
          if (value && (typeof value !== 'string' || !value.match(/^[a-zA-Z0-9_-]+$/))) {
            throw new Error('Invalid target category ID format');
          }
          return true;
        }),
    ];
  }

  /**
   * Custom validation for hex colors with extended support
   */
  static validateHexColor(): ValidationChain {
    return body('color')
      .optional()
      .custom((value) => {
        if (!value) return true;
        
        // Support both #RGB and #RRGGBB formats
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        
        if (!hexColorRegex.test(value)) {
          throw new Error('Color must be a valid hex color (e.g., #ff0000 or #f00)');
        }
        
        // Additional validation for common color values
        const validColors = [
          '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
          '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'
        ];
        
        // Convert 3-digit hex to 6-digit for consistency
        let normalizedColor = value.toLowerCase();
        if (normalizedColor.length === 4) {
          normalizedColor = '#' + normalizedColor.slice(1).split('').map(c => c + c).join('');
        }
        
        return true;
      });
  }

  /**
   * Custom validation for category name uniqueness (to be used with service layer)
   */
  static validateCategoryNameUniqueness(): ValidationChain {
    return body('name')
      .custom(async (name, { req }) => {
        // This would typically be implemented in the service layer
        // but we can add the validation structure here
        if (!name || typeof name !== 'string') {
          throw new Error('Category name is required');
        }
        
        // Remove extra whitespace and validate format
        const cleanName = name.trim().replace(/\s+/g, ' ');
        
        if (cleanName !== name) {
          throw new Error('Category name contains invalid whitespace');
        }
        
        // Reserved category names
        const reservedNames = [
          'all', 'none', 'default', 'uncategorized', 
          'admin', 'system', 'root', 'null', 'undefined'
        ];
        
        if (reservedNames.includes(cleanName.toLowerCase())) {
          throw new Error(`"${cleanName}" is a reserved category name`);
        }
        
        return true;
      });
  }

  /**
   * Validation for category color palette restrictions
   */
  static validateColorPalette(): ValidationChain {
    return body('color')
      .optional()
      .custom((value) => {
        if (!value) return true;
        
        // Define allowed color palette for consistency
        const allowedColors = [
          '#6366f1', // Indigo (default)
          '#ef4444', // Red
          '#10b981', // Green
          '#f59e0b', // Yellow/Amber
          '#3b82f6', // Blue
          '#8b5cf6', // Purple
          '#06b6d4', // Cyan
          '#84cc16', // Lime
          '#f97316', // Orange
          '#ec4899', // Pink
          '#64748b', // Slate
          '#dc2626', // Red-600
          '#059669', // Green-600
          '#7c3aed', // Violet-600
          '#0284c7', // Sky-600
        ];
        
        // Convert 3-digit hex to 6-digit for comparison
        let normalizedColor = value.toLowerCase();
        if (normalizedColor.length === 4) {
          normalizedColor = '#' + normalizedColor.slice(1).split('').map(c => c + c).join('');
        }
        
        if (!allowedColors.includes(normalizedColor)) {
          throw new Error(`Color must be from the predefined palette. Allowed colors: ${allowedColors.join(', ')}`);
        }
        
        return true;
      });
  }

  /**
   * Validation for icon name with predefined icons
   */
  static validateIconName(): ValidationChain {
    return body('icon')
      .optional()
      .custom((value) => {
        if (!value) return true;
        
        // Define allowed icon names (assuming we're using a specific icon library)
        const allowedIcons = [
          'folder', 'home', 'work', 'school', 'health', 'finance',
          'shopping', 'travel', 'food', 'entertainment', 'sports',
          'technology', 'art', 'music', 'books', 'games', 'social',
          'family', 'personal', 'business', 'project', 'task',
          'calendar', 'clock', 'star', 'heart', 'flag', 'tag',
          'bookmark', 'note', 'document', 'image', 'video',
          'settings', 'tools', 'inbox', 'archive', 'trash'
        ];
        
        if (!allowedIcons.includes(value.toLowerCase())) {
          throw new Error(`Icon must be one of the predefined icons. Allowed icons: ${allowedIcons.join(', ')}`);
        }
        
        return true;
      });
  }

  /**
   * Comprehensive validation for category creation with all custom validators
   */
  static createCategoryWithCustomValidation(): ValidationChain[] {
    return [
      ...this.createCategory(),
      this.validateCategoryNameUniqueness(),
      this.validateColorPalette(),
      this.validateIconName(),
    ];
  }

  /**
   * Validation for category search and filtering
   * GET /api/v1/categories/search
   */
  static searchCategories(): ValidationChain[] {
    return [
      query('q')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_]+$/)
        .withMessage('Search query can only contain letters, numbers, spaces, hyphens, and underscores'),

      query('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color filter must be a valid hex color'),

      query('hasIcon')
        .optional()
        .isBoolean()
        .withMessage('hasIcon must be a boolean'),

      query('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),

      query('minTasks')
        .optional()
        .isInt({ min: 0 })
        .withMessage('minTasks must be a non-negative integer'),

      query('maxTasks')
        .optional()
        .isInt({ min: 0 })
        .withMessage('maxTasks must be a non-negative integer'),

      query('sortBy')
        .optional()
        .isIn(['name', 'createdAt', 'updatedAt', 'taskCount'])
        .withMessage('sortBy must be one of: name, createdAt, updatedAt, taskCount'),

      query('sortOrder')
        .optional()
        .isIn(Object.values(SORT_ORDERS))
        .withMessage(`sortOrder must be one of: ${Object.values(SORT_ORDERS).join(', ')}`),
    ];
  }

  /**
   * Helper method to validate category limits per user
   */
  static validateCategoryLimit(): ValidationChain {
    return body()
      .custom(async (_, { req }) => {
        // This validation would typically be handled in the service layer
        // but we can define the structure here
        const userId = (req as any).user?.id;
        
        if (!userId) {
          throw new Error('User authentication required');
        }
        
        // The actual count check would be done in the service layer
        // This is just the validation structure
        return true;
      });
  }

  /**
   * Validation for category export functionality
   * GET /api/v1/categories/export
   */
  static exportCategories(): ValidationChain[] {
    return [
      query('format')
        .optional()
        .isIn(['json', 'csv', 'xlsx'])
        .withMessage('Export format must be one of: json, csv, xlsx'),

      query('includeInactive')
        .optional()
        .isBoolean()
        .withMessage('includeInactive must be a boolean'),

      query('includeTasks')
        .optional()
        .isBoolean()
        .withMessage('includeTasks must be a boolean'),

      query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('dateFrom must be a valid ISO 8601 date'),

      query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('dateTo must be a valid ISO 8601 date'),
    ];
  }
}