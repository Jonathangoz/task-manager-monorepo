// src/utils/pagination.ts

import { Request } from 'express';
import { 
  PAGINATION_CONFIG, 
  SORT_FIELDS, 
  SORT_ORDERS, 
  DEFAULT_VALUES,
  PaginationMeta,
  SortOptions 
} from './constants';

// Pagination parameters interface
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sort: SortOptions;
}

// Pagination result interface
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Extract and validate pagination parameters from request
 */
export const extractPaginationParams = (req: Request): PaginationParams => {
  // Extract page and limit from query parameters
  const page = Math.max(1, parseInt(req.query.page as string) || PAGINATION_CONFIG.DEFAULT_PAGE);
  let limit = parseInt(req.query.limit as string) || PAGINATION_CONFIG.DEFAULT_LIMIT;

  // Validate and constrain limit
  limit = Math.min(PAGINATION_CONFIG.MAX_LIMIT, Math.max(PAGINATION_CONFIG.MIN_LIMIT, limit));

  // Calculate offset
  const offset = (page - 1) * limit;

  // Extract and validate sort parameters
  const sortField = (req.query.sortBy as string) || DEFAULT_VALUES.SORT_FIELD;
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  // Validate sort field
  const validSortField = Object.values(SORT_FIELDS).includes(sortField) 
    ? sortField 
    : DEFAULT_VALUES.SORT_FIELD;

  return {
    page,
    limit,
    offset,
    sort: {
      field: validSortField,
      order: sortOrder,
    },
  };
};

/**
 * Create pagination metadata
 */
export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const pages = Math.ceil(total / limit);
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
 * Create paginated response
 */
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResult<T> => {
  const meta = createPaginationMeta(page, limit, total);
  
  return {
    data,
    meta,
  };
};

/**
 * Build Prisma pagination options
 */
export const buildPrismaOptions = (params: PaginationParams) => {
  const { limit, offset, sort } = params;

  return {
    take: limit,
    skip: offset,
    orderBy: {
      [sort.field]: sort.order,
    },
  };
};

/**
 * Build Prisma sort options with multiple fields
 */
export const buildPrismaSort = (sortOptions: SortOptions[], fallback?: SortOptions) => {
  if (sortOptions.length === 0 && fallback) {
    return { [fallback.field]: fallback.order };
  }

  if (sortOptions.length === 1) {
    return { [sortOptions[0].field]: sortOptions[0].order };
  }

  // Multiple sort fields
  return sortOptions.map(({ field, order }) => ({ [field]: order }));
};

/**
 * Parse multiple sort parameters from query string
 * Format: ?sort=createdAt:desc,priority:asc
 */
export const parseMultiSort = (sortQuery?: string): SortOptions[] => {
  if (!sortQuery) return [];

  return sortQuery
    .split(',')
    .map((sortItem) => {
      const [field, order = 'desc'] = sortItem.trim().split(':');
      
      // Validate field
      const validField = Object.values(SORT_FIELDS).includes(field) 
        ? field 
        : DEFAULT_VALUES.SORT_FIELD;
      
      // Validate order
      const validOrder = ['asc', 'desc'].includes(order.toLowerCase()) 
        ? order.toLowerCase() as 'asc' | 'desc'
        : 'desc';

      return { field: validField, order: validOrder };
    })
    .filter((sort, index, arr) => 
      // Remove duplicates (keep first occurrence)
      arr.findIndex(s => s.field === sort.field) === index
    );
};

/**
 * Create cursor-based pagination for large datasets
 */
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

export const extractCursorParams = (req: Request): CursorPaginationParams => {
  let limit = parseInt(req.query.limit as string) || PAGINATION_CONFIG.DEFAULT_LIMIT;
  limit = Math.min(PAGINATION_CONFIG.MAX_LIMIT, Math.max(PAGINATION_CONFIG.MIN_LIMIT, limit));

  const cursor = req.query.cursor as string;
  const sortField = (req.query.sortBy as string) || DEFAULT_VALUES.SORT_FIELD;
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  const validSortField = Object.values(SORT_FIELDS).includes(sortField) 
    ? sortField 
    : DEFAULT_VALUES.SORT_FIELD;

  return {
    limit,
    cursor,
    sort: {
      field: validSortField,
      order: sortOrder,
    },
  };
};

/**
 * Build cursor-based Prisma options
 */
export const buildCursorPrismaOptions = (params: CursorPaginationParams) => {
  const { limit, cursor, sort } = params;

  const options: any = {
    take: limit + 1, // Take one extra to check if there's a next page
    orderBy: {
      [sort.field]: sort.order,
    },
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
  limit: number
): { data: T[]; hasNext: boolean } => {
  const hasNext = results.length > limit;
  const data = hasNext ? results.slice(0, limit) : results;

  return { data, hasNext };
};

/**
 * Validate pagination parameters middleware helper
 */
export const validatePaginationParams = (page?: number, limit?: number) => {
  const errors: string[] = [];

  if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
    errors.push('Page must be a positive integer');
  }

  if (limit !== undefined) {
    if (limit < PAGINATION_CONFIG.MIN_LIMIT || limit > PAGINATION_CONFIG.MAX_LIMIT) {
      errors.push(`Limit must be between ${PAGINATION_CONFIG.MIN_LIMIT} and ${PAGINATION_CONFIG.MAX_LIMIT}`);
    }
    if (!Number.isInteger(limit)) {
      errors.push('Limit must be an integer');
    }
  }

  return errors;
};

/**
 * Generate pagination links for API responses
 */
export const generatePaginationLinks = (
  baseUrl: string,
  page: number,
  limit: number,
  total: number,
  queryParams?: Record<string, string>
) => {
  const pages = Math.ceil(total / limit);
  const query = new URLSearchParams(queryParams);
  
  // Remove existing page parameter
  query.delete('page');
  
  const baseQuery = query.toString();
  const separator = baseQuery ? '&' : '';

  const links: Record<string, string> = {
    self: `${baseUrl}?${baseQuery}${separator}page=${page}&limit=${limit}`,
  };

  if (page > 1) {
    links.first = `${baseUrl}?${baseQuery}${separator}page=1&limit=${limit}`;
    links.prev = `${baseUrl}?${baseQuery}${separator}page=${page - 1}&limit=${limit}`;
  }

  if (page < pages) {
    links.next = `${baseUrl}?${baseQuery}${separator}page=${page + 1}&limit=${limit}`;
    links.last = `${baseUrl}?${baseQuery}${separator}page=${pages}&limit=${limit}`;
  }

  return links;
};