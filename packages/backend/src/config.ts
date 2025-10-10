/**
 * Application configuration
 * Reads environment variables and provides typed config
 *
 * Note: Call dotenv.config() before importing this module if you need to load .env files
 */

import { getLogger } from './logger.js';

const logger = getLogger();

// Configuration constants
const MIN_JWT_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_TIMEOUT_MS = 1000;
const MIN_RATE_LIMIT_WINDOW_MS = 1000;

// S3 security constants
const MIN_S3_ACCESS_KEY_LENGTH = 16;
const MIN_S3_SECRET_KEY_LENGTH = 32;
const MAX_S3_BUCKET_NAME_LENGTH = 63;
const MIN_S3_BUCKET_NAME_LENGTH = 3;
const VALID_S3_BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
const INVALID_S3_BUCKET_PATTERNS = [
  /\.\./, // No consecutive periods
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // No IP address format
];
const VALID_AWS_REGIONS = [
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

// Valid storage backends
const VALID_STORAGE_BACKENDS = ['local', 's3', 'minio', 'r2'] as const;
export type StorageBackend = (typeof VALID_STORAGE_BACKENDS)[number];

export const config = {
  database: {
    url: process.env.DATABASE_URL ?? '',
    poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '30000', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10),
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS ?? '3', 10),
    retryDelayMs: parseInt(process.env.DB_RETRY_DELAY_MS ?? '1000', 10),
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    env: process.env.NODE_ENV ?? 'development',
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE ?? '10485760', 10), // 10MB default
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },
  storage: {
    backend: (process.env.STORAGE_BACKEND ?? 'local') as StorageBackend,
    // Local storage config
    local: {
      baseDirectory: process.env.STORAGE_BASE_DIR ?? './data/uploads',
      baseUrl: process.env.STORAGE_BASE_URL ?? 'http://localhost:3000/uploads',
    },
    // S3-compatible storage config
    s3: {
      endpoint: process.env.S3_ENDPOINT, // Required for MinIO/R2, optional for AWS S3
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      bucket: process.env.S3_BUCKET,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for MinIO
      maxRetries: parseInt(process.env.S3_MAX_RETRIES ?? '3', 10),
      timeout: parseInt(process.env.S3_TIMEOUT_MS ?? '30000', 10),
    },
  },
} as const;

/**
 * Helper to validate a numeric config value
 * @returns Error message if validation fails, null otherwise
 */
function validateNumber(value: number, name: string, min?: number, max?: number): string | null {
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

// Validate required config
export function validateConfig(): void {
  const errors: string[] = [];

  // Database URL validation
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  } else if (
    !config.database.url.startsWith('postgres://') &&
    !config.database.url.startsWith('postgresql://')
  ) {
    errors.push(
      'DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)'
    );
  }

  // Numeric validations
  const numericChecks = [
    validateNumber(config.database.poolMin, 'DB_POOL_MIN', 0),
    validateNumber(config.database.poolMax, 'DB_POOL_MAX', 1),
    validateNumber(config.database.connectionTimeout, 'DB_CONNECTION_TIMEOUT_MS', MIN_TIMEOUT_MS),
    validateNumber(config.database.idleTimeout, 'DB_IDLE_TIMEOUT_MS', MIN_TIMEOUT_MS),
    validateNumber(config.database.retryAttempts, 'DB_RETRY_ATTEMPTS', 0),
    validateNumber(config.database.retryDelayMs, 'DB_RETRY_DELAY_MS', 0),
    validateNumber(config.server.port, 'PORT', MIN_PORT, MAX_PORT),
    validateNumber(config.server.maxUploadSize, 'MAX_UPLOAD_SIZE', 1024),
    validateNumber(config.rateLimit.windowMs, 'RATE_LIMIT_WINDOW_MS', MIN_RATE_LIMIT_WINDOW_MS),
    validateNumber(config.rateLimit.maxRequests, 'RATE_LIMIT_MAX_REQUESTS', 1),
  ];

  errors.push(
    ...numericChecks.filter((error): error is string => {
      return error !== null;
    })
  );

  // Pool size relationship (only check if both values are valid numbers)
  if (config.database.poolMin > config.database.poolMax) {
    errors.push('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  // JWT validation
  if (!config.jwt.secret && config.server.env === 'production') {
    errors.push('JWT_SECRET is required in production');
  } else if (config.jwt.secret && config.jwt.secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters for security`);
  }

  // Storage validation
  if (!VALID_STORAGE_BACKENDS.includes(config.storage.backend as StorageBackend)) {
    errors.push(
      `Invalid STORAGE_BACKEND: ${config.storage.backend}. Must be one of: ${VALID_STORAGE_BACKENDS.join(', ')}`
    );
  }

  // Validate S3 config if using S3-compatible backend
  if (['s3', 'minio', 'r2'].includes(config.storage.backend)) {
    const { accessKeyId, secretAccessKey, bucket, region, endpoint, forcePathStyle } =
      config.storage.s3;

    // Credential validation (optional for IAM roles, required for development/non-AWS)
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

    // Warn if no credentials in non-production (IAM roles likely not available)
    if (!hasAccessKey && config.server.env !== 'production') {
      logger.warn(
        'No S3 credentials provided - will attempt to use IAM role or default credential chain'
      );
    }

    // Bucket name validation (S3 naming rules)
    if (!bucket) {
      errors.push(`S3_BUCKET is required for ${config.storage.backend} storage`);
    } else {
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
        errors.push(
          'S3_BUCKET cannot contain consecutive periods or be formatted as an IP address'
        );
      }
    }

    // Region validation (AWS S3 only - MinIO/R2 regions are custom)
    if (config.storage.backend === 's3' && !VALID_AWS_REGIONS.includes(region)) {
      errors.push(`S3_REGION must be a valid AWS region. Got: ${region}`);
    }

    // Endpoint validation for MinIO/R2
    if (config.storage.backend === 'minio' || config.storage.backend === 'r2') {
      if (!endpoint) {
        errors.push(`S3_ENDPOINT is required for ${config.storage.backend} storage`);
      } else {
        // Validate endpoint URL format
        try {
          const url = new URL(endpoint);
          // Must be HTTP or HTTPS
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            errors.push(`S3_ENDPOINT must use http:// or https:// protocol. Got: ${url.protocol}`);
          }
          // In production, require HTTPS for security
          if (config.server.env === 'production' && url.protocol !== 'https:') {
            errors.push('S3_ENDPOINT must use https:// in production for security');
          }
          // Prevent localhost/internal IPs in production
          if (config.server.env === 'production') {
            const hostname = url.hostname.toLowerCase();
            if (
              hostname === 'localhost' ||
              hostname === '127.0.0.1' ||
              hostname.startsWith('192.168.') ||
              hostname.startsWith('10.') ||
              hostname.startsWith('172.')
            ) {
              errors.push('S3_ENDPOINT cannot use localhost or private IP addresses in production');
            }
          }
        } catch {
          errors.push(`S3_ENDPOINT must be a valid URL. Got: ${endpoint}`);
        }
      }
    }

    // Warn about deprecated forcePathStyle for AWS S3
    if (config.storage.backend === 's3' && forcePathStyle) {
      errors.push('S3_FORCE_PATH_STYLE is deprecated for AWS S3 and should not be used');
    }

    // Numeric validations
    const s3NumericChecks = [
      validateNumber(config.storage.s3.maxRetries, 'S3_MAX_RETRIES', 0),
      validateNumber(config.storage.s3.timeout, 'S3_TIMEOUT_MS', MIN_TIMEOUT_MS),
    ];

    errors.push(
      ...s3NumericChecks.filter((error): error is string => {
        return error !== null;
      })
    );
  }

  // Validate local storage config
  if (config.storage.backend === 'local') {
    if (!config.storage.local.baseDirectory) {
      errors.push('STORAGE_BASE_DIR is required for local storage');
    }
    if (!config.storage.local.baseUrl) {
      errors.push('STORAGE_BASE_URL is required for local storage');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors
        .map((e) => {
          return `  - ${e}`;
        })
        .join('\n')}`
    );
  }
}
