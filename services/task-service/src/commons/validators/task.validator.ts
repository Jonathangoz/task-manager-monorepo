// src/presentation/validators/task.validator.ts
import { body, param, query, ValidationChain } from 'express-validator';
import { 
  TASK_CONFIG, 
  TASK_STATUSES, 
  TASK_PRIORITIES, 
  SORT_FIELDS, 
  SORT_ORDERS,
  PAGINATION_CONFIG,
  ERROR_MESSAGES 
} from '@/utils/constants';

export class TaskValidator {
  /**
   * Validation for creating a new task
   * POST /api/v1/tasks
   */
  static createTask(): ValidationChain[] {
    return [
      body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 1, max: TASK_CONFIG.MAX_TITLE_LENGTH })
        .withMessage(`Title must be between 1 and ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`),

      body('description')
        .optional()
        .trim()
        .isLength({ max: TASK_CONFIG.MAX_DESCRIPTION_LENGTH })
        .withMessage(`Description cannot exceed ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`),

      body('status')
        .optional()
        .isIn(Object.values(TASK_STATUSES))
        .withMessage(`Status must be one of: ${Object.values(TASK_STATUSES).join(', ')}`),

      body('priority')
        .optional()
        .isIn(Object.values(TASK_PRIORITIES))
        .withMessage(`Priority must be one of: ${Object.values(TASK_PRIORITIES).join(', ')}`),

      body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid ISO 8601 date')
        .custom((value) => {
          if (value) {
            const dueDate = new Date(value);
            const now = new Date();
            const minDate = new Date(now.getTime() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60000);
            
            if (dueDate <= minDate) {
              throw new Error(`Due date must be at least ${TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES} minutes in the future`);
            }
          }
          return true;
        }),

      body('categoryId')
        .optional()
        .isString()
        .withMessage('Category ID must be a string')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

      body('tags')
        .optional()
        .isArray({ max: TASK_CONFIG.MAX_TAGS_COUNT })
        .withMessage(`Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`)
        .custom((tags: string[]) => {
          if (tags) {
            for (const tag of tags) {
              if (typeof tag !== 'string' || tag.length > TASK_CONFIG.MAX_TAG_LENGTH) {
                throw new Error(`Each tag must be a string with maximum ${TASK_CONFIG.MAX_TAG_LENGTH} characters`);
              }
            }
          }
          return true;
        }),

      body('estimatedHours')
        .optional()
        .isInt({ min: 1, max: TASK_CONFIG.MAX_ESTIMATED_HOURS })
        .withMessage(`Estimated hours must be between 1 and ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`),

      body('actualHours')
        .optional()
        .isInt({ min: 0, max: TASK_CONFIG.MAX_ESTIMATED_HOURS })
        .withMessage(`Actual hours must be between 0 and ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`),

      body('attachments')
        .optional()
        .isArray({ max: TASK_CONFIG.MAX_ATTACHMENTS_COUNT })
        .withMessage(`Maximum ${TASK_CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed`)
        .custom((attachments: string[]) => {
          if (attachments) {
            for (const attachment of attachments) {
              if (typeof attachment !== 'string' || !this.isValidUrl(attachment)) {
                throw new Error('Each attachment must be a valid URL');
              }
            }
          }
          return true;
        }),
    ];
  }

  /**
   * Validation for updating a task
   * PUT /api/v1/tasks/:id
   */
  static updateTask(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Task ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid task ID format'),

      body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Title cannot be empty')
        .isLength({ min: 1, max: TASK_CONFIG.MAX_TITLE_LENGTH })
        .withMessage(`Title must be between 1 and ${TASK_CONFIG.MAX_TITLE_LENGTH} characters`),

      body('description')
        .optional()
        .trim()
        .isLength({ max: TASK_CONFIG.MAX_DESCRIPTION_LENGTH })
        .withMessage(`Description cannot exceed ${TASK_CONFIG.MAX_DESCRIPTION_LENGTH} characters`),

      body('status')
        .optional()
        .isIn(Object.values(TASK_STATUSES))
        .withMessage(`Status must be one of: ${Object.values(TASK_STATUSES).join(', ')}`),

      body('priority')
        .optional()
        .isIn(Object.values(TASK_PRIORITIES))
        .withMessage(`Priority must be one of: ${Object.values(TASK_PRIORITIES).join(', ')}`),

      body('dueDate')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true; // Allow null to clear due date
          
          if (value && !this.isValidDate(value)) {
            throw new Error('Due date must be a valid ISO 8601 date');
          }
          
          if (value) {
            const dueDate = new Date(value);
            const now = new Date();
            const minDate = new Date(now.getTime() + TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES * 60000);
            
            if (dueDate <= minDate) {
              throw new Error(`Due date must be at least ${TASK_CONFIG.MIN_DUE_DATE_OFFSET_MINUTES} minutes in the future`);
            }
          }
          return true;
        }),

      body('categoryId')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true; // Allow null to remove category
          if (value && (typeof value !== 'string' || !value.match(/^[a-zA-Z0-9_-]+$/))) {
            throw new Error('Invalid category ID format');
          }
          return true;
        }),

      body('tags')
        .optional()
        .isArray({ max: TASK_CONFIG.MAX_TAGS_COUNT })
        .withMessage(`Maximum ${TASK_CONFIG.MAX_TAGS_COUNT} tags allowed`)
        .custom((tags: string[]) => {
          if (tags) {
            for (const tag of tags) {
              if (typeof tag !== 'string' || tag.length > TASK_CONFIG.MAX_TAG_LENGTH) {
                throw new Error(`Each tag must be a string with maximum ${TASK_CONFIG.MAX_TAG_LENGTH} characters`);
              }
            }
          }
          return true;
        }),

      body('estimatedHours')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true;
          if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > TASK_CONFIG.MAX_ESTIMATED_HOURS)) {
            throw new Error(`Estimated hours must be between 1 and ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`);
          }
          return true;
        }),

      body('actualHours')
        .optional({ nullable: true })
        .custom((value) => {
          if (value === null) return true;
          if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > TASK_CONFIG.MAX_ESTIMATED_HOURS)) {
            throw new Error(`Actual hours must be between 0 and ${TASK_CONFIG.MAX_ESTIMATED_HOURS}`);
          }
          return true;
        }),
    ];
  }

  /**
   * Validation for updating task status
   * PATCH /api/v1/tasks/:id/status
   */
  static updateTaskStatus(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Task ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid task ID format'),

      body('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn(Object.values(TASK_STATUSES))
        .withMessage(`Status must be one of: ${Object.values(TASK_STATUSES).join(', ')}`),
    ];
  }

  /**
   * Validation for updating task priority
   * PATCH /api/v1/tasks/:id/priority
   */
  static updateTaskPriority(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Task ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid task ID format'),

      body('priority')
        .notEmpty()
        .withMessage('Priority is required')
        .isIn(Object.values(TASK_PRIORITIES))
        .withMessage(`Priority must be one of: ${Object.values(TASK_PRIORITIES).join(', ')}`),
    ];
  }

  /**
   * Validation for getting tasks with query parameters
   * GET /api/v1/tasks
   */
  static getTasks(): ValidationChain[] {
    return [
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

      query('categoryId')
        .optional()
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid category ID format'),

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
   * Validation for getting single task
   * GET /api/v1/tasks/:id
   */
  static getTaskById(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Task ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid task ID format'),
    ];
  }

  /**
   * Validation for deleting task
   * DELETE /api/v1/tasks/:id
   */
  static deleteTask(): ValidationChain[] {
    return [
      param('id')
        .isString()
        .notEmpty()
        .withMessage('Task ID is required')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Invalid task ID format'),
    ];
  }

  /**
   * Validation for bulk operations
   * PATCH /api/v1/tasks/bulk
   */
  static bulkUpdateTasks(): ValidationChain[] {
    return [
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

      body('updates')
        .isObject()
        .withMessage('updates must be an object')
        .custom((updates) => {
          const allowedFields = ['status', 'priority', 'categoryId', 'tags'];
          const updateKeys = Object.keys(updates);
          
          if (updateKeys.length === 0) {
            throw new Error('At least one update field is required');
          }

          for (const key of updateKeys) {
            if (!allowedFields.includes(key)) {
              throw new Error(`Invalid update field: ${key}. Allowed fields: ${allowedFields.join(', ')}`);
            }
          }

          if (updates.status && !Object.values(TASK_STATUSES).includes(updates.status)) {
            throw new Error(`Invalid status in updates: ${updates.status}`);
          }

          if (updates.priority && !Object.values(TASK_PRIORITIES).includes(updates.priority)) {
            throw new Error(`Invalid priority in updates: ${updates.priority}`);
          }

          return true;
        }),
    ];
  }

  /**
   * Helper method to validate URL format
   */
  private static isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper method to validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString.includes('T');
  }
}