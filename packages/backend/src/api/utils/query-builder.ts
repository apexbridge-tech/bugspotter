/**
 * Query Builder Utilities
 * Helper functions for building query parameters
 */

import { PAGINATION, SORTING } from './constants.js';

/**
 * Pagination options for database queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Sort options for database queries
 */
export interface SortOptions<T extends string = string> {
  sort_by: T;
  order: 'asc' | 'desc';
}

/**
 * Build pagination options with defaults
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Pagination options with defaults applied
 */
export function buildPagination(page?: number, limit?: number): PaginationOptions {
  return {
    page: page || PAGINATION.DEFAULT_PAGE,
    limit: limit || PAGINATION.DEFAULT_LIMIT,
  };
}

/**
 * Build sort options with defaults
 * Generic version that preserves specific string literal types
 *
 * @param sortBy - Field to sort by
 * @param order - Sort order (asc/desc)
 * @param defaultSortBy - Default sort field
 * @returns Sort options with defaults applied
 */
export function buildSort<T extends string>(
  sortBy: T | undefined,
  order: 'asc' | 'desc' | undefined,
  defaultSortBy: T
): SortOptions<T> {
  return {
    sort_by: sortBy || defaultSortBy,
    order: order || (SORTING.DEFAULT_ORDER as 'asc' | 'desc'),
  };
}
