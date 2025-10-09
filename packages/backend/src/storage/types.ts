/**
 * Storage layer types and interfaces
 * Defines contracts for S3-compatible object storage
 */

import type { Readable } from 'node:stream';

/**
 * Supported storage backends
 */
export type StorageBackend = 'local' | 's3' | 'minio' | 'r2';

/**
 * Storage configuration
 */
export interface StorageConfig {
  backend: StorageBackend;
  s3?: S3Config;
  local?: LocalConfig;
}

/**
 * S3-compatible storage configuration
 */
export interface S3Config {
  endpoint?: string; // For MinIO/R2 - omit for AWS S3
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean; // Required for MinIO
  maxRetries?: number;
  timeout?: number;
}

/**
 * Local filesystem storage configuration
 */
export interface LocalConfig {
  baseDirectory: string; // e.g., './data/uploads'
  baseUrl: string; // e.g., 'http://localhost:3000/uploads'
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  key: string; // S3 object key
  url: string; // Public or signed URL
  size: number; // File size in bytes
  etag?: string; // S3 ETag for verification
  contentType?: string;
}

/**
 * Image metadata extracted from buffer
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  space?: string; // Color space (e.g., 'srgb')
}

/**
 * Options for signed URL generation
 */
export interface SignedUrlOptions {
  expiresIn?: number; // Seconds (default: 3600)
  responseContentType?: string;
  responseContentDisposition?: string;
}

/**
 * Options for multipart upload
 */
export interface MultipartUploadOptions {
  partSize?: number; // Bytes per part (default: 5MB)
  onProgress?: (uploaded: number, total: number) => void;
}

/**
 * Object metadata from storage
 */
export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
}

/**
 * Options for listing objects
 */
export interface ListObjectsOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

/**
 * Result of listing objects
 */
export interface ListObjectsResult {
  objects: StorageObject[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

/**
 * Main storage service interface
 * All storage backends must implement this contract
 */
export interface IStorageService {
  /**
   * Upload a screenshot image (original)
   * @param projectId - Project identifier
   * @param bugId - Bug report identifier
   * @param buffer - Image buffer
   * @returns Upload result with URL
   */
  uploadScreenshot(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult>;

  /**
   * Upload a screenshot thumbnail
   * @param projectId - Project identifier
   * @param bugId - Bug report identifier
   * @param buffer - Thumbnail image buffer
   * @returns Upload result with URL
   */
  uploadThumbnail(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult>;

  /**
   * Upload session replay metadata
   * @param projectId - Project identifier
   * @param bugId - Bug report identifier
   * @param metadata - Replay metadata object
   * @returns Upload result with URL
   */
  uploadReplayMetadata(
    projectId: string,
    bugId: string,
    metadata: Record<string, unknown>
  ): Promise<UploadResult>;

  /**
   * Upload a session replay chunk
   * @param projectId - Project identifier
   * @param bugId - Bug report identifier
   * @param chunkIndex - Chunk sequence number (1-based)
   * @param data - Compressed chunk data
   * @returns Upload result with URL
   */
  uploadReplayChunk(
    projectId: string,
    bugId: string,
    chunkIndex: number,
    data: Buffer
  ): Promise<UploadResult>;

  /**
   * Upload an attachment file
   * @param projectId - Project identifier
   * @param bugId - Bug report identifier
   * @param filename - Original filename
   * @param buffer - File buffer
   * @returns Upload result with URL
   */
  uploadAttachment(
    projectId: string,
    bugId: string,
    filename: string,
    buffer: Buffer
  ): Promise<UploadResult>;

  /**
   * Generate a temporary signed URL for private access
   * @param key - Object key
   * @param options - Signed URL options
   * @returns Temporary access URL
   */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;

  /**
   * Delete a single object
   * @param key - Object key to delete
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Delete all objects with a given prefix (folder)
   * @param prefix - Key prefix (e.g., 'screenshots/proj-1/bug-123/')
   * @returns Number of objects deleted
   */
  deleteFolder(prefix: string): Promise<number>;

  /**
   * List objects with a given prefix
   * @param options - Listing options
   * @returns List of objects
   */
  listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;

  /**
   * Retrieve an object as a stream
   * @param key - Object key
   * @returns Readable stream of object data
   */
  getObject(key: string): Promise<Readable>;

  /**
   * Check if an object exists and get its metadata
   * @param key - Object key
   * @returns Object metadata or null if not found
   */
  headObject(key: string): Promise<StorageObject | null>;

  /**
   * Upload a stream with multipart support for large files
   * @param key - Object key
   * @param stream - Readable stream
   * @param options - Multipart upload options
   * @returns Upload result
   */
  uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult>;

  /**
   * Initialize the storage backend (create bucket, verify credentials, etc.)
   * Called during application startup
   */
  initialize(): Promise<void>;

  /**
   * Health check for storage backend
   * @returns true if storage is accessible
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Error types for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageConnectionError extends StorageError {
  constructor(message: string, originalError?: Error) {
    super(message, 'STORAGE_CONNECTION_ERROR', originalError);
    this.name = 'StorageConnectionError';
  }
}

export class StorageUploadError extends StorageError {
  constructor(message: string, originalError?: Error) {
    super(message, 'STORAGE_UPLOAD_ERROR', originalError);
    this.name = 'StorageUploadError';
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(key: string) {
    super(`Object not found: ${key}`, 'STORAGE_NOT_FOUND');
    this.name = 'StorageNotFoundError';
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string) {
    super(message, 'STORAGE_VALIDATION_ERROR');
    this.name = 'StorageValidationError';
  }
}
