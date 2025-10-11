/**
 * Application configuration
 * Reads environment variables and provides typed config
 *
 * Note: Call dotenv.config() before importing this module if you need to load .env files
 */

import { getLogger } from './logger.js';
import {
  VALID_STORAGE_BACKENDS,
  type StorageBackend,
  type LogLevel,
  type AppConfig,
} from './config/types.js';
import {
  MIN_PORT,
  MAX_PORT,
  MIN_TIMEOUT_MS,
  MIN_RATE_LIMIT_WINDOW_MS,
  validateNumber,
  validateDatabaseUrl,
  validateDatabasePoolConfig,
  validateJwtSecret,
  validateS3Credentials,
  validateS3BucketName,
  validateS3Region,
  validateS3Endpoint,
  validateS3ForcePathStyle,
  validateLocalStorageConfig,
} from './config/validators.js';

const logger = getLogger();

// Re-export types for convenience
export type { StorageBackend, LogLevel } from './config/types.js';

export const config: AppConfig = {
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
    logLevel: (process.env.LOG_LEVEL ?? 'info') as LogLevel,
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
 * Validate application configuration
 * Delegates to focused validator functions for each concern
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Database validation
  errors.push(...validateDatabaseUrl(config.database.url));

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

  errors.push(...numericChecks.filter((error): error is string => error !== null));

  // Pool size relationship
  errors.push(...validateDatabasePoolConfig(config.database.poolMin, config.database.poolMax));

  // JWT validation
  errors.push(...validateJwtSecret(config.jwt.secret, config.server.env));

  // Storage backend validation
  if (!VALID_STORAGE_BACKENDS.includes(config.storage.backend)) {
    errors.push(
      `Invalid STORAGE_BACKEND: ${config.storage.backend}. Must be one of: ${VALID_STORAGE_BACKENDS.join(', ')}`
    );
  }

  // S3-compatible storage validation
  if (['s3', 'minio', 'r2'].includes(config.storage.backend)) {
    const { accessKeyId, secretAccessKey, bucket, region, endpoint, forcePathStyle } =
      config.storage.s3;

    // Warn if no credentials in non-production
    if (!accessKeyId && config.server.env !== 'production') {
      logger.warn(
        'No S3 credentials provided - will attempt to use IAM role or default credential chain'
      );
    }

    errors.push(...validateS3Credentials(accessKeyId, secretAccessKey));
    errors.push(...validateS3BucketName(bucket));
    errors.push(...validateS3Region(region, config.storage.backend));
    errors.push(...validateS3Endpoint(endpoint, config.storage.backend, config.server.env));
    errors.push(...validateS3ForcePathStyle(forcePathStyle, config.storage.backend));

    // S3 numeric validations
    const s3NumericChecks = [
      validateNumber(config.storage.s3.maxRetries, 'S3_MAX_RETRIES', 0),
      validateNumber(config.storage.s3.timeout, 'S3_TIMEOUT_MS', MIN_TIMEOUT_MS),
    ];

    errors.push(...s3NumericChecks.filter((error): error is string => error !== null));
  }

  // Local storage validation
  if (config.storage.backend === 'local') {
    errors.push(
      ...validateLocalStorageConfig(
        config.storage.local.baseDirectory,
        config.storage.local.baseUrl
      )
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}
