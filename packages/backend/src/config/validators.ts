/**
 * Configuration validators
 * Each validator is focused on a single concern and returns errors as strings
 */

import type { StorageBackend } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_JWT_SECRET_LENGTH = 32;
export const MIN_PORT = 1;
export const MAX_PORT = 65535;
export const MIN_TIMEOUT_MS = 1000;
export const MIN_RATE_LIMIT_WINDOW_MS = 1000;

export const MIN_S3_ACCESS_KEY_LENGTH = 16;
export const MIN_S3_SECRET_KEY_LENGTH = 32;
export const MAX_S3_BUCKET_NAME_LENGTH = 63;
export const MIN_S3_BUCKET_NAME_LENGTH = 3;

export const VALID_S3_BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
export const INVALID_S3_BUCKET_PATTERNS = [
  /\.\./, // No consecutive periods
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // No IP address format
];

export const VALID_AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'af-south-1',
  'ap-east-1',
  'ap-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-south-1',
  'eu-north-1',
  'me-south-1',
  'sa-east-1',
];

// ============================================================================
// HELPER VALIDATORS
// ============================================================================

/**
 * Validate a numeric config value
 * @returns Error message if validation fails, null otherwise
 */
export function validateNumber(
  value: number,
  name: string,
  min?: number,
  max?: number
): string | null {
  if (Number.isNaN(value)) {
    return `${name} must be a valid number`;
  }
  if (min !== undefined && value < min) {
    return `${name} must be at least ${min}`;
  }
  if (max !== undefined && value > max) {
    return `${name} must be at most ${max}`;
  }
  return null;
}

/**
 * Check if hostname is localhost variation
 */
function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');
}

/**
 * Check if hostname is loopback address (IPv4 or IPv6)
 */
function isLoopback(hostname: string): boolean {
  return (
    hostname === '127.0.0.1' ||
    hostname.startsWith('127.') ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Check if IPv4 address is in private range (RFC 1918)
 */
function isPrivateIPv4(hostname: string): boolean {
  const ipParts = hostname.split('.');
  if (ipParts.length !== 4 || !ipParts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

  const octets = ipParts.map(Number);
  return (
    octets[0] === 10 || // 10.0.0.0/8
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
    (octets[0] === 192 && octets[1] === 168) || // 192.168.0.0/16
    (octets[0] === 169 && octets[1] === 254) // 169.254.0.0/16 (link-local)
  );
}

// ============================================================================
// DATABASE VALIDATORS
// ============================================================================

export function validateDatabaseUrl(url: string): string[] {
  const errors: string[] = [];

  if (!url) {
    errors.push('DATABASE_URL is required');
  } else if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    errors.push(
      'DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)'
    );
  }

  return errors;
}

export function validateDatabasePoolConfig(poolMin: number, poolMax: number): string[] {
  const errors: string[] = [];

  if (poolMin > poolMax) {
    errors.push('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  return errors;
}

// ============================================================================
// JWT VALIDATORS
// ============================================================================

export function validateJwtSecret(secret: string, env: string): string[] {
  const errors: string[] = [];

  if (!secret && env === 'production') {
    errors.push('JWT_SECRET is required in production');
  } else if (secret && secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters for security`);
  }

  return errors;
}

// ============================================================================
// S3 VALIDATORS
// ============================================================================

export function validateS3Credentials(
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined
): string[] {
  const errors: string[] = [];

  const hasAccessKey = accessKeyId !== undefined;
  const hasSecretKey = secretAccessKey !== undefined;

  // If one credential is provided, both must be provided
  if (hasAccessKey !== hasSecretKey) {
    errors.push('S3_ACCESS_KEY and S3_SECRET_KEY must both be provided or both omitted');
  }

  // If credentials provided, validate their strength
  if (accessKeyId && accessKeyId.length < MIN_S3_ACCESS_KEY_LENGTH) {
    errors.push(
      `S3_ACCESS_KEY must be at least ${MIN_S3_ACCESS_KEY_LENGTH} characters for security`
    );
  }

  if (secretAccessKey && secretAccessKey.length < MIN_S3_SECRET_KEY_LENGTH) {
    errors.push(
      `S3_SECRET_KEY must be at least ${MIN_S3_SECRET_KEY_LENGTH} characters for security`
    );
  }

  return errors;
}

export function validateS3BucketName(bucket: string | undefined): string[] {
  const errors: string[] = [];

  if (!bucket) {
    errors.push('S3_BUCKET is required');
    return errors;
  }

  if (bucket.length < MIN_S3_BUCKET_NAME_LENGTH || bucket.length > MAX_S3_BUCKET_NAME_LENGTH) {
    errors.push(
      `S3_BUCKET must be between ${MIN_S3_BUCKET_NAME_LENGTH} and ${MAX_S3_BUCKET_NAME_LENGTH} characters`
    );
  }

  if (!VALID_S3_BUCKET_PATTERN.test(bucket)) {
    errors.push(
      'S3_BUCKET must contain only lowercase letters, numbers, periods, and hyphens, and start/end with letter or number'
    );
  }

  if (INVALID_S3_BUCKET_PATTERNS.some((pattern) => pattern.test(bucket))) {
    errors.push('S3_BUCKET cannot contain consecutive periods or be formatted as an IP address');
  }

  return errors;
}

export function validateS3Region(region: string, backend: StorageBackend): string[] {
  const errors: string[] = [];

  // Only validate AWS regions for S3 backend (MinIO/R2 use custom regions)
  if (backend === 's3' && !VALID_AWS_REGIONS.includes(region)) {
    errors.push(`S3_REGION must be a valid AWS region. Got: ${region}`);
  }

  return errors;
}

export function validateS3Endpoint(
  endpoint: string | undefined,
  backend: StorageBackend,
  env: string
): string[] {
  const errors: string[] = [];

  // Endpoint is required for MinIO/R2
  if ((backend === 'minio' || backend === 'r2') && !endpoint) {
    errors.push(`S3_ENDPOINT is required for ${backend} storage`);
    return errors;
  }

  if (!endpoint) {
    return errors;
  }

  // Validate URL format
  try {
    const url = new URL(endpoint);

    // Must be HTTP or HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push(`S3_ENDPOINT must use http:// or https:// protocol. Got: ${url.protocol}`);
    }

    // In production, require HTTPS for security
    if (env === 'production' && url.protocol !== 'https:') {
      errors.push('S3_ENDPOINT must use https:// in production for security');
    }

    // Prevent localhost/internal IPs in production
    if (env === 'production') {
      const hostname = url.hostname.toLowerCase();

      if (isLocalhost(hostname)) {
        errors.push('S3_ENDPOINT cannot use localhost domains in production');
      }

      if (isLoopback(hostname)) {
        errors.push('S3_ENDPOINT cannot use loopback addresses in production');
      }

      if (isPrivateIPv4(hostname)) {
        errors.push(`S3_ENDPOINT cannot use private IP addresses in production (${hostname})`);
      }
    }
  } catch {
    errors.push(`S3_ENDPOINT must be a valid URL. Got: ${endpoint}`);
  }

  return errors;
}

export function validateS3ForcePathStyle(
  forcePathStyle: boolean,
  backend: StorageBackend
): string[] {
  const errors: string[] = [];

  // Warn about deprecated forcePathStyle for AWS S3
  if (backend === 's3' && forcePathStyle) {
    errors.push('S3_FORCE_PATH_STYLE is deprecated for AWS S3 and should not be used');
  }

  return errors;
}

// ============================================================================
// STORAGE VALIDATORS
// ============================================================================

export function validateLocalStorageConfig(baseDirectory: string, baseUrl: string): string[] {
  const errors: string[] = [];

  if (!baseDirectory) {
    errors.push('STORAGE_BASE_DIR is required for local storage');
  }

  if (!baseUrl) {
    errors.push('STORAGE_BASE_URL is required for local storage');
  }

  return errors;
}
