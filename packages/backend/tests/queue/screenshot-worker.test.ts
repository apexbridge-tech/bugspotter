/**
 * Screenshot Worker Tests
 * Unit tests for screenshot processing worker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScreenshotWorker } from '../../src/queue/workers/screenshot-worker.js';
import type { DatabaseClient } from '../../src/db/client.js';
import type { IStorageService } from '../../src/storage/types.js';
import type { Redis } from 'ioredis';
import {
  validateScreenshotJobData,
  createScreenshotJobResult,
} from '../../src/queue/jobs/screenshot-job.js';

describe('Screenshot Worker', () => {
  let mockDb: Partial<DatabaseClient>;
  let mockStorage: Partial<IStorageService>;
  let mockRedis: Partial<Redis>;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    mockStorage = {
      uploadScreenshot: vi.fn().mockResolvedValue({
        key: 'screenshots/proj-123/bug-456/screenshot.png',
        url: 'https://storage.example.com/screenshots/proj-123/bug-456/screenshot.png',
      }),
      uploadThumbnail: vi.fn().mockResolvedValue({
        key: 'screenshots/proj-123/bug-456/thumbnail.png',
        url: 'https://storage.example.com/screenshots/proj-123/bug-456/thumbnail.png',
      }),
    };

    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
      on: vi.fn(),
      once: vi.fn(),
      duplicate: vi.fn().mockReturnThis(),
    };
  });

  describe('Worker Creation', () => {
    it('should create screenshot worker successfully', () => {
      const worker = createScreenshotWorker(
        mockDb as DatabaseClient,
        mockStorage as IStorageService,
        mockRedis as Redis
      );

      expect(worker).toBeDefined();
      expect(worker.getWorker).toBeDefined();
      expect(worker.close).toBeDefined();
    });

    it('should create worker with correct configuration', () => {
      const worker = createScreenshotWorker(
        mockDb as DatabaseClient,
        mockStorage as IStorageService,
        mockRedis as Redis
      );

      const bullWorker = worker.getWorker();
      expect(bullWorker).toBeDefined();
      expect(bullWorker.name).toBe('screenshots');
    });
  });

  describe('Job Data Validation', () => {
    it('should validate correct screenshot job data', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      expect(validateScreenshotJobData(validData)).toBe(true);
    });

    it('should reject data without bugReportId', () => {
      const invalidData = {
        projectId: 'proj-456',
        screenshotData: 'data:image/png;base64,abc123',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject data without projectId', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        screenshotData: 'data:image/png;base64,abc123',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject data without screenshotData', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should validate data with base64 encoded image', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        screenshotData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/',
      };

      expect(validateScreenshotJobData(validData)).toBe(true);
    });
  });

  describe('Job Result Creation', () => {
    it('should create result with screenshot URLs and metadata', () => {
      const result = createScreenshotJobResult(
        'https://storage.example.com/screenshots/screenshot.png',
        'https://storage.example.com/screenshots/thumbnail.png',
        {
          originalSize: 1024000,
          thumbnailSize: 51200,
          width: 1920,
          height: 1080,
          processingTimeMs: 150,
        }
      );

      expect(result.originalUrl).toBe('https://storage.example.com/screenshots/screenshot.png');
      expect(result.thumbnailUrl).toBe('https://storage.example.com/screenshots/thumbnail.png');
      expect(result.originalSize).toBe(1024000);
      expect(result.thumbnailSize).toBe(51200);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.processingTimeMs).toBe(150);
    });

    it('should handle large file sizes', () => {
      const largeSize = 10 * 1024 * 1024; // 10MB
      const result = createScreenshotJobResult(
        'https://example.com/large.png',
        'https://example.com/thumb.png',
        {
          originalSize: largeSize,
          thumbnailSize: 100000,
          width: 3840,
          height: 2160,
          processingTimeMs: 500,
        }
      );

      expect(result.originalSize).toBe(largeSize);
      expect(result.thumbnailSize).toBe(100000);
    });

    it('should track processing time', () => {
      const result = createScreenshotJobResult(
        'https://example.com/screenshot.png',
        'https://example.com/thumbnail.png',
        {
          originalSize: 500000,
          thumbnailSize: 50000,
          width: 1024,
          height: 768,
          processingTimeMs: 250,
        }
      );

      expect(result.processingTimeMs).toBe(250);
    });

    it('should include image dimensions', () => {
      const result = createScreenshotJobResult(
        'https://example.com/screenshot.png',
        'https://example.com/thumbnail.png',
        {
          originalSize: 500000,
          thumbnailSize: 50000,
          width: 1920,
          height: 1080,
          processingTimeMs: 200,
        }
      );

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should allow closing the worker', async () => {
      const worker = createScreenshotWorker(
        mockDb as DatabaseClient,
        mockStorage as IStorageService,
        mockRedis as Redis
      );

      await expect(worker.close()).resolves.not.toThrow();
    });

    it('should provide access to underlying BullMQ worker', () => {
      const worker = createScreenshotWorker(
        mockDb as DatabaseClient,
        mockStorage as IStorageService,
        mockRedis as Redis
      );

      const bullWorker = worker.getWorker();
      expect(bullWorker).toBeDefined();
      expect(bullWorker.name).toBe('screenshots');
    });

    it('should support pause and resume', async () => {
      const worker = createScreenshotWorker(
        mockDb as DatabaseClient,
        mockStorage as IStorageService,
        mockRedis as Redis
      );

      await expect(worker.pause()).resolves.not.toThrow();
      await expect(worker.resume()).resolves.not.toThrow();
    });
  });

  describe('Image Processing', () => {
    it('should validate different image formats', () => {
      const formats = [
        'data:image/png;base64,iVBORw0KGg==',
        'data:image/jpeg;base64,/9j/4AAQSkZJ==',
        'data:image/webp;base64,UklGRiQAAABXRUJQ==',
      ];

      formats.forEach((screenshotData) => {
        const data = {
          bugReportId: 'bug-123',
          projectId: 'proj-456',
          screenshotData,
        };
        expect(validateScreenshotJobData(data)).toBe(true);
      });
    });

    it('should track original and thumbnail sizes', () => {
      const result = createScreenshotJobResult(
        'https://example.com/screenshot.png',
        'https://example.com/thumbnail.png',
        {
          originalSize: 2048000, // 2MB original
          thumbnailSize: 204800, // 200KB thumbnail
          width: 1920,
          height: 1080,
          processingTimeMs: 300,
        }
      );

      expect(result.originalSize).toBeGreaterThan(result.thumbnailSize);
      expect(result.originalSize / result.thumbnailSize).toBeCloseTo(10, 0);
    });

    it('should measure processing performance', () => {
      const processingTimes = [100, 250, 500, 1000];

      processingTimes.forEach((timeMs) => {
        const result = createScreenshotJobResult(
          'https://example.com/screenshot.png',
          'https://example.com/thumbnail.png',
          {
            originalSize: 1000000,
            thumbnailSize: 100000,
            width: 1920,
            height: 1080,
            processingTimeMs: timeMs,
          }
        );
        expect(result.processingTimeMs).toBe(timeMs);
      });
    });
  });

  describe('Error Handling', () => {
    it('should validate data structure before processing', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        // Missing projectId and screenshotData
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should require all mandatory fields', () => {
      const testCases = [
        { projectId: 'proj-123', screenshotData: 'data:image/png;base64,abc' }, // missing bugReportId
        { bugReportId: 'bug-123', screenshotData: 'data:image/png;base64,abc' }, // missing projectId
        { bugReportId: 'bug-123', projectId: 'proj-123' }, // missing screenshotData
      ];

      testCases.forEach((data) => {
        expect(validateScreenshotJobData(data)).toBe(false);
      });
    });

    it('should handle empty screenshot data', () => {
      const data = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        screenshotData: '',
      };

      expect(validateScreenshotJobData(data)).toBe(false);
    });
  });

  describe('Storage Integration', () => {
    it('should generate correct URLs for screenshots', () => {
      const result = createScreenshotJobResult(
        'https://storage.example.com/screenshots/proj-123/bug-456/screenshot.png',
        'https://storage.example.com/screenshots/proj-123/bug-456/thumbnail.png',
        {
          originalSize: 1000000,
          thumbnailSize: 100000,
          width: 1920,
          height: 1080,
          processingTimeMs: 200,
        }
      );

      expect(result.originalUrl).toContain('screenshot.png');
      expect(result.thumbnailUrl).toContain('thumbnail.png');
      expect(result.originalUrl).not.toBe(result.thumbnailUrl);
    });

    it('should handle different storage URL formats', () => {
      const storageUrls = [
        'https://cdn.example.com/screenshots/file.png',
        'https://s3.amazonaws.com/bucket/screenshots/file.png',
        'http://localhost:3000/uploads/screenshots/file.png',
      ];

      storageUrls.forEach((url) => {
        const result = createScreenshotJobResult(url, `${url}.thumb`, {
          originalSize: 1000000,
          thumbnailSize: 100000,
          width: 1920,
          height: 1080,
          processingTimeMs: 150,
        });
        expect(result.originalUrl).toBe(url);
      });
    });
  });
});
