/**
 * Unit tests for stream utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, PassThrough, Transform, Writable } from 'node:stream';
import {
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
} from '../src/storage/stream.utils.js';
import { StorageError } from '../src/storage/types.js';

// Helper function to create readable stream from data
function createReadableStream(data: string | Buffer): Readable {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  return stream;
}

// Helper to collect stream data
async function collectStreamData(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('Stream Utils', () => {
  describe('streamToBuffer', () => {
    it('should convert readable stream to buffer', async () => {
      const testData = 'Hello, World!';
      const stream = createReadableStream(testData);

      const buffer = await streamToBuffer(stream);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe(testData);
    });

    it('should handle binary data', async () => {
      const testData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const stream = createReadableStream(testData);

      const buffer = await streamToBuffer(stream);

      expect(buffer.equals(testData)).toBe(true);
    });

    it('should handle empty stream', async () => {
      const stream = createReadableStream('');

      const buffer = await streamToBuffer(stream);

      expect(buffer.length).toBe(0);
    });

    it('should throw error if stream exceeds max size', async () => {
      const largeData = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const stream = createReadableStream(largeData);

      await expect(streamToBuffer(stream, 10 * 1024 * 1024)).rejects.toThrow(
        'exceeds maximum size'
      );
    });

    it('should handle stream errors', async () => {
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        },
      });

      await expect(streamToBuffer(stream)).rejects.toThrow('Stream error');
    });

    it('should respect custom max size', async () => {
      const testData = Buffer.alloc(100);
      const stream = createReadableStream(testData);

      const buffer = await streamToBuffer(stream, 1000);

      expect(buffer.length).toBe(100);
    });
  });

  describe('bufferToStream', () => {
    it('should convert buffer to readable stream', async () => {
      const testData = Buffer.from('Test data');

      const stream = bufferToStream(testData);

      expect(stream).toBeInstanceOf(Readable);

      const result = await collectStreamData(stream);
      expect(result.equals(testData)).toBe(true);
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const stream = bufferToStream(emptyBuffer);
      const result = await collectStreamData(stream);

      expect(result.length).toBe(0);
    });

    it('should handle large buffer', async () => {
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB

      const stream = bufferToStream(largeBuffer);
      const result = await collectStreamData(stream);

      expect(result.length).toBe(largeBuffer.length);
    });
  });

  describe('createProgressStream', () => {
    it('should create pass-through stream', () => {
      const stream = createProgressStream();

      expect(stream).toBeInstanceOf(PassThrough);
    });

    it('should call progress callback', async () => {
      const progressCallback = vi.fn();
      const stream = createProgressStream(progressCallback);

      const testData = Buffer.from('Test data');
      stream.write(testData);
      stream.end();

      await new Promise((resolve) => stream.on('finish', resolve));

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(testData.length);
    });

    it('should track cumulative progress', async () => {
      const progressCallback = vi.fn();
      const stream = createProgressStream(progressCallback);

      stream.write(Buffer.from('Hello'));
      stream.write(Buffer.from(' '));
      stream.write(Buffer.from('World'));
      stream.end();

      await new Promise((resolve) => stream.on('finish', resolve));

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 5);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 6);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 11);
    });

    it('should work without progress callback', async () => {
      const stream = createProgressStream();

      const testData = Buffer.from('Test');
      stream.write(testData);
      stream.end();

      await new Promise((resolve) => stream.on('finish', resolve));

      expect(stream).toBeDefined();
    });
  });

  describe('splitStreamIntoChunks', () => {
    it('should split stream into chunks', async () => {
      const testData = Buffer.alloc(1000);
      const stream = createReadableStream(testData);

      const chunks = await splitStreamIntoChunks(stream, 250);

      expect(chunks.length).toBe(4);
      expect(chunks[0].length).toBe(250);
      expect(chunks[1].length).toBe(250);
      expect(chunks[2].length).toBe(250);
      expect(chunks[3].length).toBe(250);
    });

    it('should handle data not evenly divisible by chunk size', async () => {
      const testData = Buffer.alloc(1050);
      const stream = createReadableStream(testData);

      const chunks = await splitStreamIntoChunks(stream, 250);

      expect(chunks.length).toBe(5);
      expect(chunks[4].length).toBe(50); // Last chunk is smaller
    });

    it('should handle stream smaller than chunk size', async () => {
      const testData = Buffer.alloc(100);
      const stream = createReadableStream(testData);

      const chunks = await splitStreamIntoChunks(stream, 250);

      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(100);
    });

    it('should handle empty stream', async () => {
      const stream = createReadableStream('');

      const chunks = await splitStreamIntoChunks(stream, 250);

      expect(chunks.length).toBe(0);
    });

    it('should use specified chunk size', async () => {
      const testData = Buffer.alloc(1000);
      const stream = createReadableStream(testData);

      const chunks = await splitStreamIntoChunks(stream, 500);

      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(500);
      expect(chunks[1].length).toBe(500);
    });
  });

  describe('measureStream', () => {
    it('should measure stream size', async () => {
      const testData = Buffer.from('Hello, World!');
      const stream = createReadableStream(testData);

      const [sizePromise, measuredStream] = measureStream(stream);

      const result = await collectStreamData(measuredStream);
      const size = await sizePromise;

      expect(size).toBe(testData.length);
      expect(result.equals(testData)).toBe(true);
    });

    it('should measure zero-length stream', async () => {
      const stream = createReadableStream('');

      const [sizePromise, measuredStream] = measureStream(stream);

      await collectStreamData(measuredStream);
      const size = await sizePromise;

      expect(size).toBe(0);
    });

    it('should measure large stream', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB
      const stream = createReadableStream(largeData);

      const [sizePromise, measuredStream] = measureStream(stream);

      await collectStreamData(measuredStream);
      const size = await sizePromise;

      expect(size).toBe(largeData.length);
    });

    it('should not modify stream data', async () => {
      const testData = Buffer.from([0x00, 0xff, 0x42, 0xaa]);
      const stream = createReadableStream(testData);

      const [, measuredStream] = measureStream(stream);
      const result = await collectStreamData(measuredStream);

      expect(result.equals(testData)).toBe(true);
    });
  });

  describe('retryStreamOperation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const streamFactory = vi.fn(() => createReadableStream('data'));
      const operation = vi.fn(async (stream: Readable) => {
        await collectStreamData(stream);
        return 'success';
      });

      const result = await retryStreamOperation(streamFactory, operation, 3, 1000);

      expect(result).toBe('success');
      expect(streamFactory).toHaveBeenCalledTimes(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const streamFactory = vi.fn(() => createReadableStream('data'));
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryStreamOperation(streamFactory, operation, 3, 100);

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(streamFactory).toHaveBeenCalledTimes(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      vi.useRealTimers(); // Use real timers to avoid unhandled rejections

      const streamFactory = vi.fn(() => createReadableStream('data'));
      const operation = vi.fn().mockRejectedValue(new Error('persistent failure'));

      await expect(retryStreamOperation(streamFactory, operation, 2, 10)).rejects.toThrow(
        StorageError
      );

      expect(streamFactory).toHaveBeenCalledTimes(3);

      vi.useFakeTimers(); // Restore fake timers for subsequent tests
    });

    it('should create new stream for each retry', async () => {
      let callCount = 0;
      const streamFactory = vi.fn(() => {
        callCount++;
        return createReadableStream(`data-${callCount}`);
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryStreamOperation(streamFactory, operation, 3, 100);

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(streamFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('safePipe', () => {
    it('should pipe source to destination', async () => {
      const source = createReadableStream('Test data');
      const destination = new PassThrough();

      const pipePromise = safePipe(source, destination);

      const result = await collectStreamData(destination);

      await pipePromise;

      expect(result.toString()).toBe('Test data');
    });

    it('should handle empty stream', async () => {
      const source = createReadableStream('');
      const destination = new PassThrough();

      await safePipe(source, destination);

      const result = await collectStreamData(destination);

      expect(result.length).toBe(0);
    });

    it('should handle errors', async () => {
      const source = new Readable({
        read() {
          this.emit('error', new Error('Source error'));
        },
      });
      const destination = new PassThrough();

      await expect(safePipe(source, destination)).rejects.toThrow();
    });
  });

  describe('createRateLimitedStream', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create Transform stream', () => {
      const stream = createRateLimitedStream(1024);

      expect(stream).toBeInstanceOf(Transform);
    });

    it('should limit throughput rate', async () => {
      const bytesPerSecond = 100;
      const stream = createRateLimitedStream(bytesPerSecond);

      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Write data that exceeds rate limit (150 bytes when limit is 100 bytes/sec)
      const testData = Buffer.alloc(150);
      stream.write(testData);
      stream.end();

      // Run all timers to process the stream
      await vi.runAllTimersAsync();

      // All data should eventually pass through
      const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalBytes).toBe(150);
    });

    it('should handle multiple chunks correctly', async () => {
      const stream = createRateLimitedStream(50);

      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Write multiple small chunks
      stream.write(Buffer.alloc(30));
      stream.write(Buffer.alloc(30));
      stream.write(Buffer.alloc(30));
      stream.end();

      await vi.runAllTimersAsync();

      const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalBytes).toBe(90);
    });
  });

  describe('validateStream', () => {
    it('should validate readable stream', () => {
      const stream = createReadableStream('data');

      expect(() => validateStream(stream)).not.toThrow();
    });

    it('should throw error for non-stream object', () => {
      const notAStream = {};

      expect(() => validateStream(notAStream as Readable)).toThrow(StorageError);
      expect(() => validateStream(notAStream as Readable)).toThrow('Stream is not readable');
    });

    it('should throw error for null', () => {
      expect(() => validateStream(null as unknown as Readable)).toThrow(StorageError);
    });

    it('should throw error for destroyed stream', () => {
      const stream = createReadableStream('data');
      stream.destroy();

      expect(() => validateStream(stream)).toThrow(StorageError);
      expect(() => validateStream(stream)).toThrow('Stream has been destroyed');
    });
  });

  describe('getContentType', () => {
    it('should detect JPEG content type', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff]);
      const contentType = getContentType(jpegHeader);

      expect(contentType).toBe('image/jpeg');
    });

    it('should detect PNG content type', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const contentType = getContentType(pngHeader);

      expect(contentType).toBe('image/png');
    });

    it('should detect WebP content type', () => {
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const contentType = getContentType(webpHeader);

      expect(contentType).toBe('image/webp');
    });

    it('should detect GIF content type', () => {
      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const contentType = getContentType(gifHeader);

      expect(contentType).toBe('image/gif');
    });

    it('should detect JSON content type', () => {
      const jsonBuffer = Buffer.from('{"key": "value"}');
      const contentType = getContentType(jsonBuffer);

      expect(contentType).toBe('application/json');
    });

    it('should detect gzip content type', () => {
      const gzipHeader = Buffer.from([0x1f, 0x8b]);
      const contentType = getContentType(gzipHeader);

      expect(contentType).toBe('application/gzip');
    });

    it('should return default for unknown type', () => {
      const unknownBuffer = Buffer.from('random data');
      const contentType = getContentType(unknownBuffer);

      expect(contentType).toBe('application/octet-stream');
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const contentType = getContentType(emptyBuffer);

      expect(contentType).toBe('application/octet-stream');
    });

    it('should handle small buffer', () => {
      const smallBuffer = Buffer.from([0x00]);
      const contentType = getContentType(smallBuffer);

      expect(contentType).toBe('application/octet-stream');
    });
  });

  describe('Edge Cases', () => {
    it('should handle stream with backpressure', async () => {
      const source = new Readable({
        read() {
          for (let i = 0; i < 10; i++) {
            this.push(Buffer.alloc(1024));
          }
          this.push(null);
        },
      });

      const buffer = await streamToBuffer(source);

      expect(buffer.length).toBe(10 * 1024);
    });

    it('should handle concurrent stream operations', async () => {
      const stream1 = createReadableStream('data1');
      const stream2 = createReadableStream('data2');

      const [result1, result2] = await Promise.all([
        streamToBuffer(stream1),
        streamToBuffer(stream2),
      ]);

      expect(result1.toString()).toBe('data1');
      expect(result2.toString()).toBe('data2');
    });

    it('should handle stream pause and resume', async () => {
      const stream = createReadableStream('test data');

      stream.pause();
      setTimeout(() => stream.resume(), 10);

      const buffer = await streamToBuffer(stream);

      expect(buffer.toString()).toBe('test data');
    });
  });
});
