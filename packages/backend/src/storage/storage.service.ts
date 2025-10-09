/**
 * S3-compatible storage service
 * Supports AWS S3, MinIO, Cloudflare R2, and other S3-compatible backends
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
  type PutObjectCommandInput,
  type ListObjectsV2CommandOutput,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import type {
  IStorageService,
  S3Config,
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
} from './types.js';
import {
  StorageError,
  StorageConnectionError,
  StorageUploadError,
  StorageNotFoundError,
} from './types.js';
import { streamToBuffer, getContentType } from './stream.utils.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

// Constants
const DEFAULT_EXPIRATION_SECONDS = 3600; // 1 hour
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_KEYS_PER_REQUEST = 1000;

/**
 * S3-compatible storage service implementation
 */
export class StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly config: S3Config;
  private initialized = false;

  constructor(config: S3Config) {
    this.config = config;
    this.bucket = config.bucket;

    // Initialize S3 client with configuration
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false, // MinIO requires true
      maxAttempts: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      requestHandler: {
        requestTimeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
      },
    });

    logger.info('S3 storage service created', {
      bucket: this.bucket,
      region: config.region,
      endpoint: config.endpoint ?? 'AWS S3',
      forcePathStyle: config.forcePathStyle,
    });
  }

  /**
   * Initialize storage backend
   * Verifies bucket exists and creates it if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Storage already initialized');
      return;
    }

    try {
      // Check if bucket exists
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      logger.info('Bucket exists and is accessible', { bucket: this.bucket });
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };

      // If bucket doesn't exist (404), try to create it
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        logger.info('Bucket not found, attempting to create', { bucket: this.bucket });
        try {
          // Create bucket (LocationConstraint only for non-us-east-1)
          await this.client.send(
            new CreateBucketCommand({
              Bucket: this.bucket,
              CreateBucketConfiguration:
                this.config.region !== 'us-east-1'
                  ? { LocationConstraint: this.config.region as BucketLocationConstraint }
                  : undefined,
            })
          );
          logger.info('Bucket created successfully', { bucket: this.bucket });
        } catch (createError) {
          throw new StorageConnectionError(
            `Failed to create bucket: ${createError instanceof Error ? createError.message : String(createError)}`,
            createError instanceof Error ? createError : undefined
          );
        }
      } else {
        throw new StorageConnectionError(
          `Failed to access bucket: ${err.name ?? 'Unknown error'}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Test write permissions with a small test file
    try {
      const testKey = '.health-check';
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: testKey,
          Body: Buffer.from('OK'),
          ContentType: 'text/plain',
        })
      );

      // Clean up test file
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: testKey,
        })
      );

      logger.info('Storage write test successful');
    } catch (error) {
      throw new StorageConnectionError(
        `No write permissions on bucket: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }

    this.initialized = true;
    logger.info('Storage service initialized successfully');
  }

  /**
   * Upload a screenshot (original)
   */
  async uploadScreenshot(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult> {
    const key = this.buildKey('screenshots', projectId, bugId, 'original.png');
    const contentType = getContentType(buffer);
    return await this.uploadBuffer(key, buffer, contentType);
  }

  /**
   * Upload a screenshot thumbnail
   */
  async uploadThumbnail(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult> {
    const key = this.buildKey('screenshots', projectId, bugId, 'thumbnail.jpg');
    return await this.uploadBuffer(key, buffer, 'image/jpeg');
  }

  /**
   * Upload session replay metadata
   */
  async uploadReplayMetadata(
    projectId: string,
    bugId: string,
    metadata: Record<string, unknown>
  ): Promise<UploadResult> {
    const key = this.buildKey('replays', projectId, bugId, 'metadata.json');
    const buffer = Buffer.from(JSON.stringify(metadata, null, 2));
    return await this.uploadBuffer(key, buffer, 'application/json');
  }

  /**
   * Upload a session replay chunk
   */
  async uploadReplayChunk(
    projectId: string,
    bugId: string,
    chunkIndex: number,
    data: Buffer
  ): Promise<UploadResult> {
    const key = this.buildKey('replays', projectId, bugId, `chunks/${chunkIndex}.json.gz`);
    return await this.uploadBuffer(key, data, 'application/gzip');
  }

  /**
   * Upload an attachment file
   */
  async uploadAttachment(
    projectId: string,
    bugId: string,
    filename: string,
    buffer: Buffer
  ): Promise<UploadResult> {
    // Sanitize filename to prevent path traversal
    // First remove any path separators and ".." sequences
    let sanitizedFilename = filename
      .replace(/\.\./g, '') // Remove all ".." sequences
      .replace(/[/\\]/g, '') // Remove path separators
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace other invalid chars

    // Ensure filename is not empty after sanitization
    if (!sanitizedFilename || sanitizedFilename === '.') {
      sanitizedFilename = 'attachment';
    }

    const key = this.buildKey('attachments', projectId, bugId, sanitizedFilename);
    const contentType = getContentType(buffer);
    return await this.uploadBuffer(key, buffer, contentType);
  }

  /**
   * Generate a temporary signed URL
   */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRATION_SECONDS;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: options?.responseContentType,
        ResponseContentDisposition: options?.responseContentDisposition,
      });

      const url = await getS3SignedUrl(this.client, command, { expiresIn });
      logger.debug('Generated signed URL', { key, expiresIn });
      return url;
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`,
        'SIGNED_URL_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a single object
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      logger.debug('Object deleted', { key });
    } catch (error) {
      throw new StorageError(
        `Failed to delete object: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete all objects with a given prefix
   */
  async deleteFolder(prefix: string): Promise<number> {
    try {
      let deletedCount = 0;
      let continuationToken: string | undefined;

      do {
        // List objects with prefix
        const listResult = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            MaxKeys: MAX_KEYS_PER_REQUEST,
            ContinuationToken: continuationToken,
          })
        );

        const objects = listResult.Contents ?? [];

        if (objects.length > 0) {
          // Delete batch of objects
          const deleteResult = await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: {
                Objects: objects.map((obj) => ({ Key: obj.Key! })),
                Quiet: true,
              },
            })
          );

          deletedCount += objects.length - (deleteResult.Errors?.length ?? 0);

          if (deleteResult.Errors && deleteResult.Errors.length > 0) {
            logger.warn('Some objects failed to delete', {
              prefix,
              errors: deleteResult.Errors,
            });
          }
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      logger.info('Folder deleted', { prefix, deletedCount });
      return deletedCount;
    } catch (error) {
      throw new StorageError(
        `Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_FOLDER_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List objects with a given prefix
   */
  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    try {
      const result: ListObjectsV2CommandOutput = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: options?.prefix,
          MaxKeys: options?.maxKeys ?? MAX_KEYS_PER_REQUEST,
          ContinuationToken: options?.continuationToken,
        })
      );

      const objects: StorageObject[] =
        result.Contents?.map((obj) => ({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified!,
          etag: obj.ETag,
        })) ?? [];

      return {
        objects,
        isTruncated: result.IsTruncated ?? false,
        nextContinuationToken: result.NextContinuationToken,
      };
    } catch (error) {
      throw new StorageError(
        `Failed to list objects: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve an object as a stream
   */
  async getObject(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!result.Body) {
        throw new StorageNotFoundError(key);
      }

      return result.Body as Readable;
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'NoSuchKey') {
        throw new StorageNotFoundError(key);
      }
      throw new StorageError(
        `Failed to get object: ${error instanceof Error ? error.message : String(error)}`,
        'GET_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if an object exists and get its metadata
   */
  async headObject(key: string): Promise<StorageObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      return {
        key,
        size: result.ContentLength ?? 0,
        lastModified: result.LastModified ?? new Date(),
        etag: result.ETag,
        contentType: result.ContentType,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw new StorageError(
        `Failed to head object: ${error instanceof Error ? error.message : String(error)}`,
        'HEAD_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upload a stream (supports multipart for large files)
   */
  async uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    try {
      // Convert stream to buffer for simplicity
      // In production, you might want to implement actual multipart upload
      const buffer = await streamToBuffer(stream);

      if (buffer.length >= MULTIPART_THRESHOLD && options?.onProgress) {
        // Report progress for large files
        options.onProgress(buffer.length, buffer.length);
      }

      return await this.uploadBuffer(key, buffer, getContentType(buffer));
    } catch (error) {
      throw new StorageUploadError(
        `Stream upload failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upload a buffer with retry logic
   * @private
   */
  private async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const params: PutObjectCommandInput = {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ContentLength: buffer.length,
        };

        const result = await this.client.send(new PutObjectCommand(params));

        logger.debug('Object uploaded', { key, size: buffer.length, attempt });

        // Generate URL (signed or public based on config)
        const url = this.config.endpoint
          ? `${this.config.endpoint}/${this.bucket}/${key}`
          : `https://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;

        return {
          key,
          url,
          size: buffer.length,
          etag: result.ETag,
          contentType,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          logger.warn('Upload attempt failed, retrying', {
            key,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delay,
            error: lastError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new StorageUploadError(
      `Upload failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      lastError
    );
  }

  /**
   * Build a standardized storage key path
   * @private
   */
  private buildKey(type: string, projectId: string, bugId: string, filename: string): string {
    return `${type}/${projectId}/${bugId}/${filename}`;
  }

  /**
   * Cleanup and close client connections
   */
  async destroy(): Promise<void> {
    try {
      this.client.destroy();
      logger.info('Storage service destroyed');
    } catch (error) {
      logger.error('Error destroying storage service', { error });
    }
  }
}
