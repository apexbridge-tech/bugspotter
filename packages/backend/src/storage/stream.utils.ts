/**
 * Stream utilities for storage operations
 * Handles buffer/stream conversions and multipart uploads
 */

import { Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageError } from './types.js';

/**
 * Convert a Readable stream to a Buffer
 * Useful for small files that need to be fully loaded into memory
 *
 * @param stream - Readable stream to convert
 * @param maxSize - Maximum allowed size in bytes (default: 10MB)
 * @returns Buffer containing stream data
 * @throws StorageError if stream exceeds maxSize
 */
export async function streamToBuffer(
  stream: Readable,
  maxSize: number = 10485760
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;

      if (totalSize > maxSize) {
        stream.destroy();
        reject(
          new StorageError(
            `Stream exceeds maximum size of ${maxSize} bytes`,
            'STREAM_SIZE_EXCEEDED'
          )
        );
        return;
      }

      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (error) => {
      reject(new StorageError(`Stream error: ${error.message}`, 'STREAM_ERROR', error));
    });
  });
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

  return new Promise((resolve, reject) => {
    stream.on('data', (data: Buffer) => {
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
    });

    stream.on('end', () => {
      // Add any remaining data as final chunk
      if (currentChunk.length > 0) {
        chunks.push(Buffer.concat(currentChunk));
      }
      resolve(chunks);
    });

    stream.on('error', reject);
  });
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
 *
 * @param streamFactory - Function that creates a new stream
 * @param operation - Async operation to perform with the stream
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in ms for exponential backoff
 * @returns Result of the operation
 */
export async function retryStreamOperation<T>(
  streamFactory: () => Readable,
  operation: (stream: Readable) => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = streamFactory();
      return await operation(stream);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff: baseDelay * 2^attempt
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new StorageError(
    `Stream operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    'STREAM_OPERATION_FAILED',
    lastError
  );
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
 * Create a transform stream that limits read rate
 * Useful for rate-limiting uploads/downloads
 *
 * @param bytesPerSecond - Maximum bytes per second
 * @returns PassThrough stream with rate limiting
 */
export function createRateLimitedStream(bytesPerSecond: number): PassThrough {
  const passThrough = new PassThrough();
  let bytesThisSecond = 0;
  let lastReset = Date.now();

  const originalPush = passThrough.push.bind(passThrough);

  passThrough.push = function (chunk: Buffer | null, encoding?: BufferEncoding): boolean {
    if (chunk === null) {
      return originalPush(chunk, encoding);
    }

    const now = Date.now();
    if (now - lastReset >= 1000) {
      // Reset counter every second
      bytesThisSecond = 0;
      lastReset = now;
    }

    bytesThisSecond += chunk.length;

    if (bytesThisSecond > bytesPerSecond) {
      // Delay to stay under rate limit
      const delayMs = 1000 - (now - lastReset);
      setTimeout(() => {
        originalPush(chunk, encoding);
      }, delayMs);
      return false;
    }

    return originalPush(chunk, encoding);
  };

  return passThrough;
}

/**
 * Validate stream is readable and not closed
 * @param stream - Stream to validate
 * @throws StorageError if stream is invalid
 */
export function validateStream(stream: Readable): void {
  if (!stream) {
    throw new StorageError('Stream is null or undefined', 'INVALID_STREAM');
  }

  if (stream.destroyed) {
    throw new StorageError('Stream has been destroyed', 'STREAM_DESTROYED');
  }

  if (!stream.readable) {
    throw new StorageError('Stream is not readable', 'STREAM_NOT_READABLE');
  }
}

/**
 * Get content type from buffer by checking magic numbers
 * @param buffer - Buffer to check
 * @returns MIME type or 'application/octet-stream' if unknown
 */
export function getContentType(buffer: Buffer): string {
  if (buffer.length < 12) {
    return 'application/octet-stream';
  }

  // Check common file signatures
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }

  // JSON
  const text = buffer.slice(0, 100).toString('utf8').trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    return 'application/json';
  }

  // XML/SVG
  if (text.startsWith('<?xml') || text.startsWith('<svg')) {
    return 'image/svg+xml';
  }

  // PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  return 'application/octet-stream';
}
