import type { Readable } from 'node:stream';
import type {
  IStorageService,
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
} from './types.js';
import { StorageError } from './types.js';
import { getContentType } from './stream.utils.js';
import {
  sanitizeFilename,
  buildStorageKey,
  sanitizeS3Key,
  validateProjectId,
  validateBugId,
} from './path.utils.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

export abstract class BaseStorageService implements IStorageService {
  protected async uploadWithKey(
    resourceType: 'screenshots' | 'replays' | 'attachments',
    projectId: string,
    bugId: string,
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<UploadResult> {
    // Validate inputs (common across all implementations)
    const validatedProjectId = validateProjectId(projectId);
    const validatedBugId = validateBugId(bugId);

    // Build and sanitize storage key
    const key = buildStorageKey(resourceType, validatedProjectId, validatedBugId, filename);
    const sanitizedKey = sanitizeS3Key(key);

    // Determine content type
    const resolvedContentType = contentType ?? getContentType(buffer);

    // Delegate to concrete implementation
    return await this.uploadBuffer(sanitizedKey, buffer, resolvedContentType);
  }

  /**
   * Upload a screenshot (original)
   */
  async uploadScreenshot(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult> {
    return this.uploadWithKey('screenshots', projectId, bugId, 'original.png', buffer);
  }

  /**
   * Upload a screenshot thumbnail
   */
  async uploadThumbnail(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult> {
    return this.uploadWithKey(
      'screenshots',
      projectId,
      bugId,
      'thumbnail.jpg',
      buffer,
      'image/jpeg'
    );
  }

  /**
   * Upload session replay metadata
   */
  async uploadReplayMetadata(
    projectId: string,
    bugId: string,
    metadata: Record<string, unknown>
  ): Promise<UploadResult> {
    const buffer = Buffer.from(JSON.stringify(metadata, null, 2));
    return this.uploadWithKey(
      'replays',
      projectId,
      bugId,
      'metadata.json',
      buffer,
      'application/json'
    );
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
    // Validate chunk index
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new StorageError('Invalid chunk index', 'INVALID_CHUNK_INDEX');
    }

    return this.uploadWithKey(
      'replays',
      projectId,
      bugId,
      `chunks/${chunkIndex}.json.gz`,
      data,
      'application/gzip'
    );
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
    const originalFilename = filename;
    const sanitizedFilename = sanitizeFilename(filename);

    // Log if sanitization changed the filename
    if (sanitizedFilename !== originalFilename) {
      this.logFilenameSanitization(projectId, bugId, originalFilename, sanitizedFilename);
    }

    return this.uploadWithKey('attachments', projectId, bugId, sanitizedFilename, buffer);
  }

  /**
   * Hook method for logging filename sanitization
   * Can be overridden by subclasses if needed
   * @protected
   */
  protected logFilenameSanitization(
    projectId: string,
    bugId: string,
    original: string,
    sanitized: string
  ): void {
    logger.info('Attachment filename sanitized', {
      projectId,
      bugId,
      original,
      sanitized,
    });
  }

  /**
   * Abstract method - must be implemented by concrete storage services
   * Handles the actual upload operation specific to the storage backend
   * @protected
   */
  protected abstract uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult>;

  // Abstract methods from IStorageService - must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  abstract deleteObject(key: string): Promise<void>;
  abstract deleteFolder(prefix: string): Promise<number>;
  abstract listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;
  abstract getObject(key: string): Promise<Readable>;
  abstract headObject(key: string): Promise<StorageObject | null>;
  abstract uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult>;
  abstract healthCheck(): Promise<boolean>;
}
