/**
 * Local filesystem storage implementation
 * For development/testing without S3/MinIO
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type {
  IStorageService,
  LocalConfig,
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
import { streamToBuffer, bufferToStream, getContentType } from './stream.utils.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

/**
 * Local filesystem storage service
 * Implements same interface as S3 storage for development
 */
export class LocalStorageService implements IStorageService {
  private readonly baseDirectory: string;
  private readonly baseUrl: string;
  private initialized = false;

  constructor(config: LocalConfig) {
    this.baseDirectory = path.resolve(config.baseDirectory);
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

    logger.info('Local storage service created', {
      baseDirectory: this.baseDirectory,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Initialize local storage (create base directory)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Storage already initialized');
      return;
    }

    try {
      // Create base directory if it doesn't exist
      await fs.mkdir(this.baseDirectory, { recursive: true });
      logger.info('Base directory created/verified', { baseDirectory: this.baseDirectory });

      // Test write permissions
      const testFile = path.join(this.baseDirectory, '.health-check');
      await fs.writeFile(testFile, 'OK');
      await fs.unlink(testFile);

      logger.info('Local storage initialized successfully');
    } catch (error) {
      throw new StorageConnectionError(
        `Failed to initialize local storage: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }

    this.initialized = true;
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
   * Generate a "signed" URL (in local mode, just returns public URL)
   */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    // For local storage, we can't really sign URLs
    // Just return the public URL with optional query params
    const url = `${this.baseUrl}/${key}`;

    if (options?.responseContentType || options?.responseContentDisposition) {
      const params = new URLSearchParams();
      if (options.responseContentType) {
        params.set('content-type', options.responseContentType);
      }
      if (options.responseContentDisposition) {
        params.set('content-disposition', options.responseContentDisposition);
      }
      return `${url}?${params.toString()}`;
    }

    return url;
  }

  /**
   * Delete a single file
   */
  async deleteObject(key: string): Promise<void> {
    const filePath = this.keyToPath(key);

    try {
      await fs.unlink(filePath);
      logger.debug('File deleted', { key, filePath });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        // File doesn't exist, that's okay
        return;
      }
      throw new StorageError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete all files with a given prefix (folder)
   */
  async deleteFolder(prefix: string): Promise<number> {
    const folderPath = this.keyToPath(prefix);
    let deletedCount = 0;

    try {
      // Check if folder exists
      try {
        await fs.access(folderPath);
      } catch {
        // Folder doesn't exist, nothing to delete
        return 0;
      }

      // Recursively delete folder contents
      deletedCount = await this.deleteFolderRecursive(folderPath);

      logger.info('Folder deleted', { prefix, folderPath, deletedCount });
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
   * List files with a given prefix
   */
  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const prefix = options?.prefix ?? '';
    const maxKeys = options?.maxKeys ?? 1000;
    const folderPath = this.keyToPath(prefix);

    try {
      const objects: StorageObject[] = [];

      // Check if folder exists
      try {
        await fs.access(folderPath);
      } catch {
        // Folder doesn't exist, return empty list
        return { objects: [], isTruncated: false };
      }

      // Recursively list files
      await this.listFilesRecursive(folderPath, prefix, objects, maxKeys);

      return {
        objects: objects.slice(0, maxKeys),
        isTruncated: objects.length > maxKeys,
      };
    } catch (error) {
      throw new StorageError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve a file as a stream
   */
  async getObject(key: string): Promise<Readable> {
    const filePath = this.keyToPath(key);

    try {
      // Check if file exists
      await fs.access(filePath);

      // Read file and create stream
      const buffer = await fs.readFile(filePath);
      return bufferToStream(buffer);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        throw new StorageNotFoundError(key);
      }
      throw new StorageError(
        `Failed to get file: ${error instanceof Error ? error.message : String(error)}`,
        'GET_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a file exists and get its metadata
   */
  async headObject(key: string): Promise<StorageObject | null> {
    const filePath = this.keyToPath(key);

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        key,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        return null;
      }
      throw new StorageError(
        `Failed to stat file: ${error instanceof Error ? error.message : String(error)}`,
        'HEAD_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upload a stream
   */
  async uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    try {
      const buffer = await streamToBuffer(stream);

      if (options?.onProgress) {
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
      await fs.access(this.baseDirectory);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upload a buffer to local filesystem
   * @private
   */
  private async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const filePath = this.keyToPath(key);

    try {
      // Create directory structure
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      logger.debug('File uploaded', { key, filePath, size: buffer.length });

      const url = `${this.baseUrl}/${key}`;

      return {
        key,
        url,
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      throw new StorageUploadError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build a standardized storage key path
   * @private
   */
  private buildKey(type: string, projectId: string, bugId: string, filename: string): string {
    return `${type}/${projectId}/${bugId}/${filename}`;
  }

  /**
   * Convert storage key to filesystem path
   * @private
   */
  private keyToPath(key: string): string {
    return path.join(this.baseDirectory, key);
  }

  /**
   * Recursively delete folder contents
   * @private
   */
  private async deleteFolderRecursive(folderPath: string): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          count += await this.deleteFolderRecursive(fullPath);
          await fs.rmdir(fullPath);
        } else {
          await fs.unlink(fullPath);
          count++;
        }
      }

      // Try to remove the folder itself (may fail if not empty)
      try {
        await fs.rmdir(folderPath);
      } catch {
        // Ignore errors removing the folder itself
      }
    } catch (error) {
      logger.warn('Error during recursive delete', { folderPath, error });
    }

    return count;
  }

  /**
   * Recursively list files
   * @private
   */
  private async listFilesRecursive(
    dirPath: string,
    prefix: string,
    results: StorageObject[],
    maxKeys: number
  ): Promise<void> {
    if (results.length >= maxKeys) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxKeys) {
          break;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.listFilesRecursive(fullPath, prefix, results, maxKeys);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(this.baseDirectory, fullPath);
          const key = relativePath.replace(/\\/g, '/'); // Normalize to forward slashes

          results.push({
            key,
            size: stats.size,
            lastModified: stats.mtime,
          });
        }
      }
    } catch (error) {
      logger.warn('Error listing directory', { dirPath, error });
    }
  }
}
