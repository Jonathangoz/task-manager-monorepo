// src/utils/pagination.ts

import { Request } from 'express';
import { z } from 'zod';
import {
  PAGINATION_CONFIG,
  SORT_FIELDS,
  SORT_ORDERS,
  DEFAULT_VALUES,
  PaginationMeta,
  SortOptions,
  TASK_PRIORITIES,
  PRIORITY_WEIGHTS,
  ERROR_CODES,
  TASK_STATUSES,
} from './constants';

// Zod schemas for validation
const PageSchema = z
  .number()
  .int()
  .min(1)
  .default(PAGINATION_CONFIG.DEFAULT_PAGE);
const LimitSchema = z
  .number()
  .int()
  .min(PAGINATION_CONFIG.MIN_LIMIT)
  .max(PAGINATION_CONFIG.MAX_LIMIT)
  .default(PAGINATION_CONFIG.DEFAULT_LIMIT);
const SortFieldSchema = z
  .enum([
    SORT_FIELDS.CREATED_AT,
    SORT_FIELDS.UPDATED_AT,
    SORT_FIELDS.DUE_DATE,
    SORT_FIELDS.PRIORITY,
    SORT_FIELDS.STATUS,
    SORT_FIELDS.TITLE,
    SORT_FIELDS.NAME, // Added for categories
    SORT_FIELDS.TASK_COUNT, // Added for categories
  ] as const)
  .default(SORT_FIELDS.CREATED_AT);
const SortOrderSchema = z
  .enum([SORT_ORDERS.ASC, SORT_ORDERS.DESC] as const)
  .default(SORT_ORDERS.DESC);

// Main pagination schema
const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : PAGINATION_CONFIG.DEFAULT_PAGE))
    .pipe(PageSchema),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : PAGINATION_CONFIG.DEFAULT_LIMIT))
    .pipe(LimitSchema),
  sortBy: z
    .string()
    .optional()
    .default(SORT_FIELDS.CREATED_AT)
    .pipe(SortFieldSchema),
  sortOrder: z
    .string()
    .optional()
    .default(SORT_ORDERS.DESC)
    .transform((val) => val?.toLowerCase() as 'asc' | 'desc')
    .pipe(SortOrderSchema),
});

// Multi-sort schema for advanced sorting
const MultiSortSchema = z
  .string()
  .optional()
  .transform((sortQuery) => {
    if (!sortQuery) return [];

    const sortItems = sortQuery.split(',').filter((item) => item.trim());
    const validSorts: SortOptions[] = [];
    const seenFields = new Set<string>();

    for (const sortItem of sortItems) {
      const [field, order = SORT_ORDERS.DESC] = sortItem.trim().split(':');

      if (!field || seenFields.has(field)) continue;

      // Validate field: Ensure 'field' is one of the actual string values from SORT_FIELDS
      if (
        !Object.values(SORT_FIELDS).includes(
          field as (typeof SORT_FIELDS)[keyof typeof SORT_FIELDS],
        )
      )
        continue;

      // Validate and normalize order
      const normalizedOrder =
        order?.toLowerCase() === SORT_ORDERS.ASC
          ? SORT_ORDERS.ASC
          : SORT_ORDERS.DESC;

      validSorts.push({
        field: field as (typeof SORT_FIELDS)[keyof typeof SORT_FIELDS],
        order: normalizedOrder,
      }); // Assert field type
      seenFields.add(field);
    }

    return validSorts;
  });

// Cursor pagination schema
const CursorPaginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : PAGINATION_CONFIG.DEFAULT_LIMIT))
    .pipe(LimitSchema),
  cursor: z
    .string()
    .optional()
    .transform((val) => val?.trim() || undefined),
  sortBy: z
    .string()
    .optional()
    .default(SORT_FIELDS.CREATED_AT)
    .pipe(SortFieldSchema),
  sortOrder: z
    .string()
    .optional()
    .default(SORT_ORDERS.DESC)
    .transform((val) => val?.toLowerCase() as 'asc' | 'desc')
    .pipe(SortOrderSchema),
});

// Pagination parameters interface
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sort: SortOptions;
}

// Enhanced pagination result interface
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Cursor pagination interfaces
export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
  sort: SortOptions;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
    count: number;
  };
}

// Enhanced sort options for complex sorting
export interface EnhancedSortOptions extends SortOptions {
  nullsLast?: boolean;
}

// Pagination error class
export class PaginationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PaginationError';
  }
}

/**
 * Extract and validate pagination parameters from request using Zod
 * Throws PaginationError if validation fails
 */
export const extractPaginationParams = (req: Request): PaginationParams => {
  try {
    const validatedQuery = PaginationQuerySchema.parse(req.query);

    const { page, limit, sortBy: field, sortOrder: order } = validatedQuery;
    const offset = (page - 1) * limit;

    return {
      page,
      limit,
      offset,
      sort: { field, order },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      throw new PaginationError(
        errorMessages.join(', '),
        ERROR_CODES.INVALID_PAGINATION,
      );
    }
    throw error;
  }
};

/**
 * Extract sort options from request with Zod validation
 */
export const extractSortOptions = (req: Request): SortOptions => {
  try {
    const { sortBy: field, sortOrder: order } = PaginationQuerySchema.pick({
      sortBy: true,
      sortOrder: true,
    }).parse(req.query);

    return { field, order };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new PaginationError(
        'Invalid sort parameters',
        ERROR_CODES.INVALID_SORT_FIELD,
      );
    }
    throw error;
  }
};

/**
 * Validate pagination query parameters (legacy method for backward compatibility)
 */
export const validatePaginationQuery = (query: any): ValidationResult => {
  try {
    PaginationQuerySchema.parse(query);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      );
      return { isValid: false, errors };
    }
    return { isValid: false, errors: ['Unknown validation error'] };
  }
};

/**
 * Validate if sort field is allowed
 */
export const isValidSortField = (field: string): boolean => {
  // Fix: Assert 'field' as one of the actual string values from SORT_FIELDS
  return Object.values(SORT_FIELDS).includes(
    field as (typeof SORT_FIELDS)[keyof typeof SORT_FIELDS],
  );
};

/**
 * Validate if sort order is allowed
 */
export const isValidSortOrder = (order: string): boolean => {
  // Fix: Assert 'order?.toLowerCase()' as one of the actual string values from SORT_ORDERS
  return Object.values(SORT_ORDERS).includes(
    order?.toLowerCase() as (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS],
  );
};

/**
 * Normalize sort order to ensure consistency
 */
export const normalizeSortOrder = (order?: string): 'asc' | 'desc' => {
  return order?.toLowerCase() === SORT_ORDERS.ASC
    ? SORT_ORDERS.ASC
    : SORT_ORDERS.DESC;
};

/**
 * Create pagination metadata with enhanced information
 */
export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number,
): PaginationMeta => {
  const pages = Math.ceil(total / limit) || 1;
  const hasNext = page < pages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    pages,
    hasNext,
    hasPrev,
  };
};

/**
 * Create paginated response with validation
 */
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> => {
  if (!Array.isArray(data)) {
    throw new PaginationError(
      'Data must be an array',
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  if (total < 0) {
    throw new PaginationError(
      'Total count cannot be negative',
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  const meta = createPaginationMeta(page, limit, total);

  return {
    data,
    meta,
  };
};

/**
 * Build Prisma pagination options with enhanced sorting
 */
export const buildPrismaOptions = (params: PaginationParams) => {
  const { limit, offset, sort } = params;
  const orderBy = buildPrismaOrderBy(sort);

  return {
    take: limit,
    skip: offset,
    orderBy,
  };
};

/**
 * Build Prisma orderBy clause with proper enum handling for the schema
 */
export const buildPrismaOrderBy = (sort: SortOptions) => {
  // Priority sorting - Prisma enum values are: LOW, MEDIUM, HIGH, URGENT
  if (sort.field === SORT_FIELDS.PRIORITY) {
    // For priority, we want URGENT > HIGH > MEDIUM > LOW when DESC
    // Prisma will sort enum values alphabetically unless we use a custom order
    return [
      {
        priority: sort.order,
      },
      // Secondary sort by createdAt for consistent ordering
      {
        createdAt: SORT_ORDERS.DESC,
      },
    ];
  }

  // Status sorting - Prisma enum values are: PENDING, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD
  if (sort.field === SORT_FIELDS.STATUS) {
    return [
      {
        status: sort.order,
      },
      // Secondary sort by priority and then createdAt
      {
        priority: SORT_ORDERS.DESC,
      },
      {
        createdAt: SORT_ORDERS.DESC,
      },
    ];
  }

  // Handle dueDate with null handling
  if (sort.field === SORT_FIELDS.DUE_DATE) {
    return [
      {
        dueDate: {
          sort: sort.order,
          nulls: 'last', // Put null values at the end
        },
      },
      {
        createdAt: SORT_ORDERS.DESC,
      },
    ];
  }

  // Default sorting with secondary sort
  return [
    {
      [sort.field]: sort.order,
    },
    // Always add createdAt as secondary sort for consistency (except when already sorting by it)
    ...(sort.field !== SORT_FIELDS.CREATED_AT
      ? [
          {
            createdAt: SORT_ORDERS.DESC,
          },
        ]
      : []),
  ];
};

/**
 * Parse multiple sort parameters from query string with Zod validation
 * Format: ?sort=createdAt:desc,priority:asc
 */
export const parseMultiSort = (sortQuery?: string): SortOptions[] => {
  return MultiSortSchema.parse(sortQuery);
};

/**
 * Build multi-field Prisma sort options
 */
export const buildMultiFieldSort = (sortOptions: SortOptions[]): any[] => {
  if (sortOptions.length === 0) {
    return [{ [DEFAULT_VALUES.SORT_FIELD]: DEFAULT_VALUES.SORT_ORDER }];
  }

  return sortOptions.map(({ field, order }) => {
    if (field === SORT_FIELDS.PRIORITY) {
      return { priority: order };
    }
    if (field === SORT_FIELDS.DUE_DATE) {
      return {
        dueDate: {
          sort: order,
          nulls: 'last',
        },
      };
    }
    return { [field]: order };
  });
};

// Cursor-based pagination functions

/**
 * Extract cursor pagination parameters with Zod validation
 */
export const extractCursorParams = (req: Request): CursorPaginationParams => {
  try {
    const {
      limit,
      cursor,
      sortBy: field,
      sortOrder: order,
    } = CursorPaginationSchema.parse(req.query);

    return {
      limit,
      cursor,
      sort: { field, order },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new PaginationError(
        'Invalid cursor pagination parameters',
        ERROR_CODES.INVALID_PAGINATION,
      );
    }
    throw error;
  }
};

/**
 * Build cursor-based Prisma options
 */
export const buildCursorPrismaOptions = (params: CursorPaginationParams) => {
  const { limit, cursor, sort } = params;

  const options: any = {
    take: limit + 1, // Take one extra to check if there's a next page
    orderBy: buildPrismaOrderBy(sort),
  };

  if (cursor) {
    options.cursor = { id: cursor };
    options.skip = 1; // Skip the cursor item itself
  }

  return options;
};

/**
 * Process cursor pagination results
 */
export const processCursorResults = <T extends { id: string }>(
  results: T[],
  limit: number,
): { data: T[]; hasNext: boolean; nextCursor?: string } => {
  const hasNext = results.length > limit;
  const data = hasNext ? results.slice(0, limit) : results;
  const nextCursor =
    hasNext && data.length > 0 ? data[data.length - 1].id : undefined;

  return { data, hasNext, nextCursor };
};

/**
 * Generate pagination links for HATEOAS compliance
 */
export interface PaginationLinks {
  self: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export const generatePaginationLinks = (
  baseUrl: string,
  page: number,
  limit: number,
  total: number,
  queryParams?: Record<string, string>,
): PaginationLinks => {
  const pages = Math.ceil(total / limit) || 1;
  const query = new URLSearchParams(queryParams);

  // Remove existing page parameter
  query.delete('page');
  query.delete('limit');

  const baseQuery = query.toString();
  const separator = baseQuery ? '&' : '';

  const links: PaginationLinks = {
    self: `${baseUrl}?${baseQuery}${separator}page=${page}&limit=${limit}`,
  };

  if (pages > 1) {
    links.first = `${baseUrl}?${baseQuery}${separator}page=1&limit=${limit}`;
    links.last = `${baseUrl}?${baseQuery}${separator}page=${pages}&limit=${limit}`;
  }

  if (page > 1) {
    links.prev = `${baseUrl}?${baseQuery}${separator}page=${page - 1}&limit=${limit}`;
  }

  if (page < pages) {
    links.next = `${baseUrl}?${baseQuery}${separator}page=${page + 1}&limit=${limit}`;
  }

  return links;
};

/**
 * Calculate total pages safely
 */
export const calculateTotalPages = (total: number, limit: number): number => {
  if (total <= 0 || limit <= 0) return 1;
  return Math.ceil(total / limit);
};

/**
 * Validate page number against total pages
 */
export const validatePageNumber = (
  page: number,
  totalPages: number,
): boolean => {
  return page >= 1 && page <= Math.max(1, totalPages);
};

/**
 * Get safe page number (clamps to valid range)
 */
export const getSafePageNumber = (page: number, totalPages: number): number => {
  if (page < 1) return 1;
  if (page > totalPages && totalPages > 0) return totalPages;
  return page;
};

/**
 * Create empty paginated result for edge cases
 */
export const createEmptyPaginatedResult = <T>(): PaginatedResult<T> => {
  return {
    data: [],
    meta: {
      page: 1,
      limit: PAGINATION_CONFIG.DEFAULT_LIMIT,
      total: 0,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
};

/**
 * Helper function to build complex Prisma where clauses for filtering
 */
export const buildPrismaWhereClause = (
  filters: Record<string, any>,
  userId: string,
) => {
  const where: any = { userId };

  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  // Priority filter
  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      where.priority = { in: filters.priority };
    } else {
      where.priority = filters.priority;
    }
  }

  // Category filter
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  // Date filters
  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {};
    if (filters.dueDateFrom) {
      where.dueDate.gte = new Date(filters.dueDateFrom);
    }
    if (filters.dueDateTo) {
      where.dueDate.lte = new Date(filters.dueDateTo);
    }
  }

  // Has due date filter
  if (filters.hasDueDate !== undefined) {
    where.dueDate = filters.hasDueDate ? { not: null } : null;
  }

  // Overdue filter
  if (filters.isOverdue === true) {
    where.dueDate = {
      lt: new Date(),
      not: null,
    };
    where.status = {
      notIn: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED],
    };
  }

  // Tags filter
  if (filters.tags) {
    const tagsArray = Array.isArray(filters.tags)
      ? filters.tags
      : [filters.tags];
    where.tags = {
      hasSome: tagsArray,
    };
  }

  // Text search
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
};
