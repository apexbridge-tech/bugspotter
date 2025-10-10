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
  type ServerSideEncryption,
  type StorageClass,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import type {
  S3Config,
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
} from './types.js';
import { BaseStorageService } from './base-storage.service.js';
import {
  StorageError,
  StorageConnectionError,
  StorageUploadError,
  StorageNotFoundError,
} from './types.js';
import {
  DEFAULT_EXPIRATION_SECONDS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_KEYS_PER_REQUEST,
} from './constants.js';
import { executeWithRetry, RetryPredicates } from '../utils/retry.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

/**
 * S3-compatible storage service implementation
 */
export class StorageService extends BaseStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly config: S3Config;
  private initialized = false;

  constructor(config: S3Config) {
    super();
    this.config = config;
    this.bucket = config.bucket;

    // Build S3 client config
    const clientConfig: S3ClientConfig = {
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? false,
      maxAttempts: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      requestHandler: {
        requestTimeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
      },
    };

    // Only set credentials if provided (allows IAM role usage)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken, // Optional: for STS/assumed roles
      };
    }
    // If no credentials, SDK will use default credential chain:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. IAM role for EC2/ECS/Lambda

    this.client = new S3Client(clientConfig);

    logger.info('S3 storage service created', {
      bucket: this.bucket,
      region: config.region,
      endpoint: config.endpoint ?? 'AWS S3',
      forcePathStyle: config.forcePathStyle,
      authMethod: config.accessKeyId ? 'access-key' : 'iam-role/default-chain',
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Storage already initialized');
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      logger.info('Bucket exists and is accessible', { bucket: this.bucket });
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };

      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        logger.info('Bucket not found, attempting to create', { bucket: this.bucket });
        try {
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

  async deleteFolder(prefix: string): Promise<number> {
    try {
      let deletedCount = 0;
      let continuationToken: string | undefined;

      do {
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

  async uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    try {
      const contentType = options?.contentType ?? 'application/octet-stream';
      let uploadedBytes = 0;

      // Use S3 Upload for true streaming (no buffering entire file in memory)
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentType: contentType,
          ...this.buildS3ObjectParams(), // Apply encryption and storage class
        },
        queueSize: 4, // Number of concurrent part uploads
        partSize: options?.partSize ?? 5 * 1024 * 1024, // Default 5MB parts (S3 minimum)
      });

      // Track upload progress if callback provided
      if (options?.onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded && progress.total) {
            uploadedBytes = progress.loaded;
            options.onProgress!(progress.loaded, progress.total);
          }
        });
      }

      const result = await upload.done();

      // Use tracked bytes if available, otherwise estimate from result
      const size = uploadedBytes || 0;

      logger.debug('Stream uploaded', { key, size });

      return {
        key,
        url: this.buildObjectUrl(key),
        size,
        etag: result.ETag,
        contentType,
      };
    } catch (error) {
      throw new StorageUploadError(
        `Stream upload failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build common S3 object parameters from config
   * Applies encryption and storage class settings
   */
  private buildS3ObjectParams(): {
    ServerSideEncryption?: ServerSideEncryption;
    SSEKMSKeyId?: string;
    StorageClass?: StorageClass;
  } {
    const params: {
      ServerSideEncryption?: ServerSideEncryption;
      SSEKMSKeyId?: string;
      StorageClass?: StorageClass;
    } = {};

    if (this.config.serverSideEncryption) {
      params.ServerSideEncryption = this.config.serverSideEncryption as ServerSideEncryption;
      if (this.config.serverSideEncryption === 'aws:kms' && this.config.sseKmsKeyId) {
        params.SSEKMSKeyId = this.config.sseKmsKeyId;
      }
    }

    if (this.config.storageClass) {
      params.StorageClass = this.config.storageClass as StorageClass;
    }

    return params;
  }

  /**
   * Build public URL for an S3 object
   * Handles both custom endpoints and standard S3 URLs
   */
  private buildObjectUrl(key: string): string {
    if (this.config.endpoint) {
      // Custom endpoint (MinIO, R2, etc.)
      return `${this.config.endpoint}/${this.bucket}/${key}`;
    }
    // Standard AWS S3 URL
    return `https://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Build retry configuration for upload operations
   */
  private buildRetryConfig(key: string, maxAttempts: number) {
    return {
      maxAttempts,
      baseDelay: DEFAULT_RETRY_DELAY_MS,
      shouldRetry: RetryPredicates.isStorageError,
      onRetry: (error: unknown, attempt: number, delay: number) => {
        logger.warn('Upload attempt failed, retrying', {
          key,
          attempt,
          maxAttempts,
          delay: Math.round(delay),
          error: error instanceof Error ? error.message : String(error),
        });
      },
    };
  }

  protected async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const maxAttempts = (this.config.maxRetries ?? DEFAULT_MAX_RETRIES) + 1;

    try {
      return await executeWithRetry(
        async () => {
          const params: PutObjectCommandInput = {
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentLength: buffer.length,
            ...this.buildS3ObjectParams(), // Apply encryption and storage class
          };

          const result = await this.client.send(new PutObjectCommand(params));

          logger.debug('Object uploaded', { key, size: buffer.length });

          return {
            key,
            url: this.buildObjectUrl(key),
            size: buffer.length,
            etag: result.ETag,
            contentType,
          };
        },
        this.buildRetryConfig(key, maxAttempts)
      );
    } catch (error) {
      throw new StorageUploadError(
        `Upload failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async destroy(): Promise<void> {
    try {
      this.client.destroy();
      logger.info('Storage service destroyed');
    } catch (error) {
      logger.error('Error destroying storage service', { error });
    }
  }
}
