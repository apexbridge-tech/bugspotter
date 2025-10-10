/**
 * Application configuration
 * Reads environment variables and provides typed config
 *
 * Note: Call dotenv.config() before importing this module if you need to load .env files
 */

// Configuration constants
const MIN_JWT_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_TIMEOUT_MS = 1000;
const MIN_RATE_LIMIT_WINDOW_MS = 1000;

// Valid storage backends
const VALID_STORAGE_BACKENDS = ['local', 's3', 'minio', 'r2'] as const;
type StorageBackend = (typeof VALID_STORAGE_BACKENDS)[number];

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
      endpoint: process.env.S3_ENDPOINT, // Optional - for MinIO/R2
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      bucket: process.env.S3_BUCKET ?? 'bugspotter',
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
    if (!config.storage.s3.accessKeyId) {
      errors.push('S3_ACCESS_KEY is required for S3-compatible storage');
    }
    if (!config.storage.s3.secretAccessKey) {
      errors.push('S3_SECRET_KEY is required for S3-compatible storage');
    }
    if (!config.storage.s3.bucket) {
      errors.push('S3_BUCKET is required for S3-compatible storage');
    }
    if (!config.storage.s3.region) {
      errors.push('S3_REGION is required for S3-compatible storage');
    }

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
