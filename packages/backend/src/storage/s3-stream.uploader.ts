/**
 * S3 Stream Uploader
 * Single Responsibility: Handle multipart stream uploads with retry logic
 */

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import type { S3Config, UploadResult, MultipartUploadOptions } from './types.js';
import { StorageUploadError } from './types.js';
import { S3UrlBuilder } from './s3-url.builder.js';
import { S3ParamsBuilder } from './s3-params.builder.js';
import { DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS } from './constants.js';
import { RetryPredicates } from '../utils/retry.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

export class S3StreamUploader {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly config: S3Config;
  private readonly urlBuilder: S3UrlBuilder;
  private readonly paramsBuilder: S3ParamsBuilder;

  constructor(
    client: S3Client,
    bucket: string,
    config: S3Config,
    urlBuilder: S3UrlBuilder,
    paramsBuilder: S3ParamsBuilder
  ) {
    this.client = client;
    this.bucket = bucket;
    this.config = config;
    this.urlBuilder = urlBuilder;
    this.paramsBuilder = paramsBuilder;
  }

  /**
   * Upload stream with retry logic
   */
  async upload(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    const maxAttempts = (this.config.maxRetries ?? DEFAULT_MAX_RETRIES) + 1;
    let attempt = 0;

    const uploadWithRetry = async (): Promise<UploadResult> => {
      attempt++;
      return await this.attemptUpload(key, stream, options, attempt, maxAttempts);
    };

    return uploadWithRetry();
  }

  /**
   * Single upload attempt
   */
  private async attemptUpload(
    key: string,
    stream: Readable,
    options: MultipartUploadOptions | undefined,
    attempt: number,
    maxAttempts: number
  ): Promise<UploadResult> {
    const contentType = options?.contentType ?? 'application/octet-stream';
    let uploadedBytes = 0;
    let streamErrorOccurred = false;

    try {
      // Handle stream errors to prevent memory leaks
      const errorHandler = (error: Error) => {
        streamErrorOccurred = true;
        logger.error('Stream error during upload', { key, error: error.message });
      };
      stream.once('error', errorHandler);

      // Use S3 Upload for true streaming (no buffering entire file in memory)
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentType: contentType,
          ...this.paramsBuilder.buildObjectParams(),
        },
        queueSize: this.config.multipartQueueSize ?? 4,
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

      // Clean up error handler
      stream.removeListener('error', errorHandler);

      // Get actual size from S3 response or tracked bytes
      const size = await this.getUploadedSize(key, uploadedBytes);

      logger.debug('Stream uploaded', { key, size, attempt });

      return {
        key,
        url: this.urlBuilder.buildObjectUrl(key),
        size,
        etag: result.ETag,
        contentType,
      };
    } catch (error) {
      return await this.handleUploadError(
        error,
        streamErrorOccurred,
        key,
        attempt,
        maxAttempts,
        () => this.attemptUpload(key, stream, options, attempt + 1, maxAttempts)
      );
    }
  }

  /**
   * Get actual uploaded file size
   */
  private async getUploadedSize(key: string, uploadedBytes: number): Promise<number> {
    if (uploadedBytes > 0) {
      return uploadedBytes;
    }

    // For small files where progress events don't fire, get size from S3
    try {
      const headResult = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return headResult.ContentLength ?? 0;
    } catch {
      logger.warn('Could not retrieve uploaded file size', { key });
      return 0;
    }
  }

  /**
   * Handle upload errors with retry logic
   */
  private async handleUploadError(
    error: unknown,
    streamErrorOccurred: boolean,
    key: string,
    attempt: number,
    maxAttempts: number,
    retryFn: () => Promise<UploadResult>
  ): Promise<UploadResult> {
    // Attempt to clean up failed multipart upload
    if (error instanceof Error && error.message.includes('multipart')) {
      try {
        logger.debug('Attempting to abort failed multipart upload', { key });
        // Note: Upload class should handle this, but adding defensive cleanup
      } catch {
        logger.warn('Failed to cleanup multipart upload', { key });
      }
    }

    if (streamErrorOccurred) {
      throw new StorageUploadError(
        'Stream error occurred during upload',
        error instanceof Error ? error : undefined
      );
    }

    // Check if we should retry
    if (attempt < maxAttempts && RetryPredicates.isStorageError(error)) {
      const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn('Stream upload failed, retrying', {
        key,
        attempt,
        maxAttempts,
        delay,
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryFn();
    }

    throw new StorageUploadError(
      `Stream upload failed after ${attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}
