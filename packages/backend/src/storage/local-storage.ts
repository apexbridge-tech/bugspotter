import { promises as fs } from 'node:fs';
import { createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import type {
  LocalConfig,
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
} from './types.js';
import { BaseStorageService } from './base-storage-service.js';
import {
  StorageError,
  StorageConnectionError,
  StorageUploadError,
  StorageNotFoundError,
} from './types.js';
import { getLogger } from '../logger.js';

const pipelineAsync = promisify(pipeline);

const logger = getLogger();

export class LocalStorageService extends BaseStorageService {
  private readonly baseDirectory: string;
  private readonly baseUrl: string;
  private initialized = false;

  constructor(config: LocalConfig) {
    super();
    this.baseDirectory = path.resolve(config.baseDirectory);
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

    logger.info('Local storage service created', {
      baseDirectory: this.baseDirectory,
      baseUrl: this.baseUrl,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Storage already initialized');
      return;
    }

    try {
      await fs.mkdir(this.baseDirectory, { recursive: true });
      logger.info('Base directory created/verified', { baseDirectory: this.baseDirectory });

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

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
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

  async deleteObject(key: string): Promise<void> {
    const filePath = this.keyToPath(key);

    try {
      await fs.unlink(filePath);
      logger.debug('File deleted', { key, filePath });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        return;
      }
      throw new StorageError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  async deleteFolder(prefix: string): Promise<number> {
    const folderPath = this.keyToPath(prefix);

    try {
      // Count files efficiently using a lightweight approach
      let deletedCount = 0;

      try {
        deletedCount = await this.countFilesRecursive(folderPath);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'ENOENT') {
          return 0; // Folder doesn't exist
        }
        throw error;
      }

      // Use Node.js built-in recursive deletion (more efficient)
      await fs.rm(folderPath, { recursive: true, force: true });

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

  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const prefix = options?.prefix ?? '';
    const maxKeys = options?.maxKeys ?? 1000;
    const startAfter = options?.continuationToken; // Use continuationToken as startAfter key

    try {
      const objects: StorageObject[] = [];

      // List all files from base directory and filter by prefix
      await this.listFilesRecursive(this.baseDirectory, '', objects, Infinity);

      // Filter by prefix if specified
      let filteredObjects = prefix ? objects.filter((obj) => obj.key.startsWith(prefix)) : objects;

      // Sort for consistent pagination
      filteredObjects.sort((a, b) => a.key.localeCompare(b.key));

      // Apply continuation token (skip to after this key)
      if (startAfter) {
        const startIndex = filteredObjects.findIndex((obj) => obj.key > startAfter);
        if (startIndex > 0) {
          filteredObjects = filteredObjects.slice(startIndex);
        }
      }

      // Paginate results
      const isTruncated = filteredObjects.length > maxKeys;
      const paginatedObjects = filteredObjects.slice(0, maxKeys);
      const nextContinuationToken = isTruncated
        ? paginatedObjects[paginatedObjects.length - 1].key
        : undefined;

      return {
        objects: paginatedObjects,
        isTruncated,
        nextContinuationToken,
      };
    } catch (error) {
      throw new StorageError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getObject(key: string): Promise<Readable> {
    const filePath = this.keyToPath(key);

    try {
      await fs.access(filePath);
      // True streaming - constant memory usage regardless of file size
      return createReadStream(filePath);
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

  async uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    const filePath = this.keyToPath(key);
    const contentType = options?.contentType ?? 'application/octet-stream';

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Use Node.js pipeline for true streaming (constant memory usage)
      let uploadedBytes = 0;
      const writeStream = createWriteStream(filePath);

      // Track progress if callback provided
      if (options?.onProgress) {
        stream.on('data', (chunk: Buffer) => {
          uploadedBytes += chunk.length;
          // Note: We don't know total size for streams, so pass uploadedBytes for both
          options.onProgress!(uploadedBytes, uploadedBytes);
        });
      }

      // Stream directly to file without buffering in memory
      await pipelineAsync(stream, writeStream);

      // Get final file size
      const stats = await fs.stat(filePath);
      const size = stats.size;

      logger.debug('Stream uploaded', { key, filePath, size });

      const url = `${this.baseUrl}/${key}`;

      return {
        key,
        url,
        size,
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
      await fs.access(this.baseDirectory);
      return true;
    } catch {
      return false;
    }
  }

  protected async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const filePath = this.keyToPath(key);

    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
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

  private keyToPath(key: string): string {
    return path.join(this.baseDirectory, key);
  }

  /**
   * Count files in directory recursively (lightweight, no stat calls)
   * Only counts regular files, not directories
   */
  private async countFilesRecursive(dirPath: string): Promise<number> {
    let count = 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        count += await this.countFilesRecursive(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }

    return count;
  }

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
          // Get stats only once (more efficient than separate stat call)
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(this.baseDirectory, fullPath);
          // Normalize path separators to forward slashes for consistency
          const key = relativePath.split(path.sep).join('/');

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
