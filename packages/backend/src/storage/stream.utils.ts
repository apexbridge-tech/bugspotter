/**
 * Stream utilities for storage operations
 * Handles buffer/stream conversions and multipart uploads
 */

import { Readable, PassThrough, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageError } from './types.js';
import {
  STREAM_LIMITS,
  FILE_SIGNATURES,
  isWebPFormat,
  type FileSignature,
} from './stream.constants.js';

/**
 * Generic stream processor with consistent event handling
 * Eliminates duplicate event handler patterns across functions
 *
 * @param stream - Readable stream to process
 * @param onData - Callback invoked for each data chunk
 * @param onComplete - Function called when stream ends, returns final result
 * @returns Promise that resolves with result from onComplete
 * @throws StorageError on stream errors
 */
async function processStream<T>(
  stream: Readable,
  onData: (chunk: Buffer) => void,
  onComplete: () => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      try {
        onData(chunk);
      } catch (error) {
        stream.destroy();
        reject(error);
      }
    });

    stream.on('end', () => {
      try {
        resolve(onComplete());
      } catch (error) {
        reject(error);
      }
    });

    stream.on('error', (error) => {
      reject(new StorageError(`Stream error: ${error.message}`, 'STREAM_ERROR', error));
    });
  });
}

/**
 * Convert a Readable stream to a Buffer
 * Useful for small files that need to be fully loaded into memory
 * Refactored to use processStream helper for consistent error handling
 *
 * @param stream - Readable stream to convert
 * @param maxSize - Maximum allowed size in bytes (default: 10MB)
 * @returns Buffer containing stream data
 * @throws StorageError if stream exceeds maxSize
 */
export async function streamToBuffer(
  stream: Readable,
  maxSize: number = STREAM_LIMITS.MAX_BUFFER_SIZE
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  return processStream(
    stream,
    (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        throw new StorageError(
          `Stream exceeds maximum size of ${maxSize} bytes`,
          'STREAM_SIZE_EXCEEDED'
        );
      }
      chunks.push(chunk);
    },
    () => Buffer.concat(chunks)
  );
}

/**
 * Convert a Buffer to a Readable stream
 * @param buffer - Buffer to convert
 * @returns Readable stream
 */
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // Signal end of stream
  return stream;
}

/**
 * Create a pass-through stream with progress tracking
 * Useful for monitoring upload/download progress
 *
 * @param onProgress - Callback invoked with bytes transferred
 * @returns PassThrough stream
 */
export function createProgressStream(onProgress?: (bytesTransferred: number) => void): PassThrough {
  const passThrough = new PassThrough();
  let bytesTransferred = 0;

  if (onProgress) {
    passThrough.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      onProgress(bytesTransferred);
    });
  }

  return passThrough;
}

/**
 * Split a stream into chunks for multipart upload
 * Refactored to use processStream helper for consistent error handling
 *
 * @param stream - Source stream
 * @param chunkSize - Size of each chunk in bytes
 * @returns Array of buffers (chunks)
 */
export async function splitStreamIntoChunks(
  stream: Readable,
  chunkSize: number
): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  let currentChunk: Buffer[] = [];
  let currentSize = 0;

  return processStream(
    stream,
    (data) => {
      currentChunk.push(data);
      currentSize += data.length;

      // If we've accumulated enough data, create a chunk
      while (currentSize >= chunkSize) {
        const chunk = Buffer.concat(currentChunk);
        chunks.push(chunk.slice(0, chunkSize));

        // Keep remainder for next chunk
        const remainder = chunk.slice(chunkSize);
        currentChunk = remainder.length > 0 ? [remainder] : [];
        currentSize = remainder.length;
      }
    },
    () => {
      // Add any remaining data as final chunk
      if (currentChunk.length > 0) {
        chunks.push(Buffer.concat(currentChunk));
      }
      return chunks;
    }
  );
}

/**
 * Calculate stream size without consuming it
 * Uses a pass-through stream to count bytes
 *
 * @param stream - Stream to measure
 * @returns Tuple of [size in bytes, new stream with same data]
 */
export function measureStream(stream: Readable): [Promise<number>, Readable] {
  let size = 0;
  const passThrough = new PassThrough();

  const sizePromise = new Promise<number>((resolve, reject) => {
    passThrough.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });

    passThrough.on('end', () => {
      resolve(size);
    });

    passThrough.on('error', reject);
  });

  // Pipe original stream through pass-through
  stream.pipe(passThrough);

  return [sizePromise, passThrough];
}

/**
 * Retry a stream operation with exponential backoff
 * Creates a new stream for each retry attempt
 * Now uses unified retry utility for consistency
 *
 * @param streamFactory - Function that creates a new stream
 * @param operation - Async operation to perform with the stream
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @param shouldRetry - Optional predicate to determine if error should be retried (default: retry all errors)
 * @returns Result of the operation
 */
export async function retryStreamOperation<T>(
  streamFactory: () => Readable,
  operation: (stream: Readable) => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  shouldRetry?: (error: unknown) => boolean
): Promise<T> {
  // Import at function level to avoid circular dependencies
  const { executeWithRetry } = await import('../utils/retry.js');

  try {
    return await executeWithRetry(
      async () => {
        const stream = streamFactory();
        return await operation(stream);
      },
      {
        maxAttempts: maxRetries + 1,
        baseDelay,
        shouldRetry, // Use provided predicate or default to retrying all errors
      }
    );
  } catch (error) {
    throw new StorageError(
      `Stream operation failed after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
      'STREAM_OPERATION_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Pipe a stream with error handling and cleanup
 * Ensures proper cleanup even if an error occurs
 *
 * @param source - Source stream
 * @param destination - Destination stream
 * @returns Promise that resolves when piping completes
 */
export async function safePipe(
  source: Readable,
  destination: NodeJS.WritableStream
): Promise<void> {
  try {
    await pipeline(source, destination);
  } catch (error) {
    // Ensure streams are destroyed on error
    if (!source.destroyed) {
      source.destroy();
    }
    throw new StorageError(
      `Stream pipe failed: ${error instanceof Error ? error.message : String(error)}`,
      'STREAM_PIPE_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Create a rate-limited stream using Transform stream with proper async handling.
 * Uses a token bucket algorithm to limit throughput while maintaining backpressure.
 *
 * @param bytesPerSecond - Maximum bytes per second
 * @returns Transform stream with rate limiting
 */
export function createRateLimitedStream(bytesPerSecond: number): Transform {
  let bytesThisSecond = 0;
  let lastReset = Date.now();

  return new Transform({
    async transform(chunk: Buffer, _encoding, callback) {
      try {
        const now = Date.now();
        const elapsed = now - lastReset;

        // Reset counter every second
        if (elapsed >= 1000) {
          bytesThisSecond = 0;
          lastReset = now;
        }

        const chunkSize = chunk.length;
        bytesThisSecond += chunkSize;

        // If we've exceeded the rate limit, delay until next second
        if (bytesThisSecond > bytesPerSecond) {
          const delayMs = Math.max(0, 1000 - elapsed);
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Reset after delay
          bytesThisSecond = chunkSize;
          lastReset = Date.now();
        }

        callback(null, chunk);
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

/**
 * Validate stream is readable and not closed
 * @param stream - Stream to validate
 * @throws StorageError if stream is invalid
 */
export function validateStream(stream: Readable): void {
  if (!stream) {
    throw new StorageError('Invalid stream', 'INVALID_STREAM');
  }

  if (stream.destroyed) {
    throw new StorageError('Stream has been destroyed', 'STREAM_DESTROYED');
  }

  if (!stream.readable) {
    throw new StorageError('Stream is not readable', 'STREAM_NOT_READABLE');
  }
}

/**
 * Check if buffer matches a file signature
 * Helper function for MIME type detection
 *
 * @param buffer - Buffer to check
 * @param signature - File signature definition
 * @returns True if buffer matches signature
 */
function matchesSignature(buffer: Buffer, signature: FileSignature): boolean {
  const offset = signature.offset || 0;
  // Always convert to regular array to ensure proper iteration
  const sigBytes = Array.from(signature.signature);

  if (buffer.length < offset + sigBytes.length) {
    return false;
  }

  return sigBytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Get content type from buffer by checking magic numbers
 * Refactored to use signature lookup table for maintainability
 *
 * @param buffer - Buffer to check
 * @returns MIME type or 'application/octet-stream' if unknown
 */
export function getContentType(buffer: Buffer): string {
  if (buffer.length < STREAM_LIMITS.MIN_BUFFER_CHECK) {
    return 'application/octet-stream';
  }

  // Special case: WEBP requires checking two locations
  if (isWebPFormat(buffer)) {
    return 'image/webp';
  }

  // Check binary signatures using lookup table
  for (const sig of FILE_SIGNATURES) {
    if (matchesSignature(buffer, sig)) {
      return sig.mimeType;
    }
  }

  // Check text-based formats (JSON, XML, SVG)
  if (buffer.length >= 10) {
    const text = buffer.slice(0, STREAM_LIMITS.TEXT_PREVIEW_SIZE).toString('utf8').trim();

    if (text.startsWith('{') || text.startsWith('[')) {
      return 'application/json';
    }

    if (text.startsWith('<?xml') || text.startsWith('<svg')) {
      return 'image/svg+xml';
    }
  }

  return 'application/octet-stream';
}
