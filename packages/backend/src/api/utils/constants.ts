/**
 * API constants
 * Centralized constants for the API layer
 */

/**
 * Password hashing configuration
 */
export const PASSWORD = {
  SALT_ROUNDS: 10,
} as const;

/**
 * Time unit multipliers for converting to seconds
 */
export const TIME_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
} as const;

/**
 * Default expiry time in seconds (24 hours)
 */
export const DEFAULT_TOKEN_EXPIRY_SECONDS = 86400;

/**
 * API key prefix
 */
export const API_KEY_PREFIX = 'bgs_';

/**
 * API key random bytes length
 */
export const API_KEY_BYTES = 32;

/**
 * Default pagination values
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;

/**
 * Default sorting configuration
 */
export const SORTING = {
  DEFAULT_SORT_BY: 'created_at',
  DEFAULT_ORDER: 'desc',
} as const;
