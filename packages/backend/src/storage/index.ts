/**
 * Storage factory and exports
 * Provides unified interface for creating storage services
 */

import type { StorageConfig, IStorageService, StorageBackend } from './types.js';
import { StorageError } from './types.js';
import { StorageService } from './storage.service.js';
import { LocalStorageService } from './local.storage.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_STORAGE_BACKEND: StorageBackend = 'local';
const DEFAULT_BASE_DIRECTORY = './data/uploads';
const DEFAULT_BASE_URL = 'http://localhost:3000/uploads';

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Validate required S3 configuration fields
 * @throws StorageError if any required field is missing
 */
function validateRequiredS3Config(config: {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
}): asserts config is Required<typeof config> {
  if (!config.region) {
    throw new StorageError('S3_REGION environment variable is required', 'MISSING_CONFIG');
  }
  if (!config.accessKeyId) {
    throw new StorageError('S3_ACCESS_KEY environment variable is required', 'MISSING_CONFIG');
  }
  if (!config.secretAccessKey) {
    throw new StorageError('S3_SECRET_KEY environment variable is required', 'MISSING_CONFIG');
  }
  if (!config.bucket) {
    throw new StorageError('S3_BUCKET environment variable is required', 'MISSING_CONFIG');
  }
}

/**
 * Parse S3 configuration from environment variables
 */
function parseS3ConfigFromEnv() {
  return {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    maxRetries: process.env.S3_MAX_RETRIES ? parseInt(process.env.S3_MAX_RETRIES, 10) : undefined,
    timeout: process.env.S3_TIMEOUT_MS ? parseInt(process.env.S3_TIMEOUT_MS, 10) : undefined,
  };
}

/**
 * Parse local storage configuration from environment variables
 */
function parseLocalConfigFromEnv() {
  return {
    baseDirectory: process.env.STORAGE_BASE_DIR ?? DEFAULT_BASE_DIRECTORY,
    baseUrl: process.env.STORAGE_BASE_URL ?? DEFAULT_BASE_URL,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a storage service based on configuration
 * Auto-detects backend type and returns appropriate implementation
 *
 * @param config - Storage configuration
 * @returns Configured storage service
 * @throws StorageError if configuration is invalid
 *
 * @example
 * // S3/MinIO/R2 storage
 * const storage = createStorage({
 *   backend: 's3',
 *   s3: {
 *     endpoint: 'http://localhost:9000', // MinIO
 *     region: 'us-east-1',
 *     accessKeyId: 'minioadmin',
 *     secretAccessKey: 'minioadmin',
 *     bucket: 'bugspotter',
 *     forcePathStyle: true,
 *   }
 * });
 *
 * @example
 * // Local filesystem storage
 * const storage = createStorage({
 *   backend: 'local',
 *   local: {
 *     baseDirectory: './data/uploads',
 *     baseUrl: 'http://localhost:3000/uploads',
 *   }
 * });
 */
export function createStorage(config: StorageConfig): IStorageService {
  logger.info('Creating storage service', { backend: config.backend });

  switch (config.backend) {
    case 's3':
    case 'minio':
    case 'r2':
      if (!config.s3) {
        throw new StorageError(
          `S3 configuration required for backend: ${config.backend}`,
          'INVALID_CONFIG'
        );
      }
      return new StorageService(config.s3);

    case 'local':
      if (!config.local) {
        throw new StorageError('Local storage configuration required', 'INVALID_CONFIG');
      }
      return new LocalStorageService(config.local);

    default:
      throw new StorageError(`Unsupported storage backend: ${config.backend}`, 'INVALID_CONFIG');
  }
}

/**
 * Create storage from environment variables
 * Detects backend from STORAGE_BACKEND env var (defaults to 'local')
 *
 * Required environment variables by backend:
 * - S3/MinIO/R2: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 * - Local: STORAGE_BASE_DIR, STORAGE_BASE_URL
 *
 * @returns Configured storage service
 * @throws StorageError if required env vars are missing
 */
export function createStorageFromEnv(): IStorageService {
  const backend = (process.env.STORAGE_BACKEND ??
    DEFAULT_STORAGE_BACKEND) as StorageConfig['backend'];

  logger.info('Creating storage from environment', { backend });

  if (backend === 'local') {
    return createStorage({
      backend: 'local',
      local: parseLocalConfigFromEnv(),
    });
  }

  // S3-compatible backends
  const s3Config = parseS3ConfigFromEnv();
  validateRequiredS3Config(s3Config);

  return createStorage({
    backend,
    s3: s3Config,
  });
}

/**
 * Validate storage configuration
 * @param config - Storage configuration to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateStorageConfig(config: StorageConfig): string[] {
  const errors: string[] = [];

  if (!config.backend) {
    errors.push('Storage backend is required');
    return errors;
  }

  switch (config.backend) {
    case 's3':
    case 'minio':
    case 'r2':
      if (!config.s3) {
        errors.push('S3 configuration is required for S3-compatible backends');
      } else {
        if (!config.s3.region) {
          errors.push('S3 region is required');
        }
        if (!config.s3.accessKeyId) {
          errors.push('S3 access key ID is required');
        }
        if (!config.s3.secretAccessKey) {
          errors.push('S3 secret access key is required');
        }
        if (!config.s3.bucket) {
          errors.push('S3 bucket name is required');
        }
        if (config.s3.maxRetries !== undefined && config.s3.maxRetries < 0) {
          errors.push('S3 max retries must be >= 0');
        }
        if (config.s3.timeout !== undefined && config.s3.timeout < 1000) {
          errors.push('S3 timeout must be >= 1000ms');
        }
      }
      break;

    case 'local':
      if (!config.local) {
        errors.push('Local storage configuration is required');
      } else {
        if (!config.local.baseDirectory) {
          errors.push('Local storage base directory is required');
        }
        if (!config.local.baseUrl) {
          errors.push('Local storage base URL is required');
        }
      }
      break;

    default:
      errors.push(`Unsupported storage backend: ${config.backend}`);
  }

  return errors;
}

// Re-export types and utilities for convenience
export type {
  IStorageService,
  StorageConfig,
  StorageBackend,
  S3Config,
  LocalConfig,
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
  ImageMetadata,
} from './types.js';

export {
  StorageError,
  StorageConnectionError,
  StorageUploadError,
  StorageNotFoundError,
  StorageValidationError,
} from './types.js';

export {
  generateThumbnail,
  optimizeImage,
  extractMetadata,
  validateImage,
  detectImageFormat,
  isImage,
} from './image.processor.js';

export {
  streamToBuffer,
  bufferToStream,
  createProgressStream,
  splitStreamIntoChunks,
  measureStream,
  retryStreamOperation,
  safePipe,
  createRateLimitedStream,
  validateStream,
  getContentType,
} from './stream.utils.js';

export { detectFormat, isFormat, isImageFormat, type FormatInfo } from './format-detection.js';

export {
  STREAM_LIMITS,
  FILE_SIGNATURES,
  isWebPFormat,
  type FileSignature,
} from './stream.constants.js';

export {
  sanitizeFilename,
  buildStorageKey,
  sanitizeS3Key,
  validateProjectId,
  validateBugId,
  isValidUUID,
} from './path.utils.js';

// Export base class for custom implementations
export { BaseStorageService } from './base-storage.service.js';
