import { describe, it, expect, beforeEach } from 'vitest';
import { BaseStorageService } from '../src/storage/base-storage.service.js';
import { StorageError } from '../src/storage/types.js';
import type {
  UploadResult,
  SignedUrlOptions,
  ListObjectsOptions,
  ListObjectsResult,
  StorageObject,
  MultipartUploadOptions,
} from '../src/storage/types.js';
import type { Readable } from 'node:stream';

class MockStorageService extends BaseStorageService {
  public uploadBufferCalls: Array<{ key: string; buffer: Buffer; contentType: string }> = [];
  public shouldFail = false;
  public filenameLog: Array<{
    projectId: string;
    bugId: string;
    original: string;
    sanitized: string;
  }> = [];

  protected async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    this.uploadBufferCalls.push({ key, buffer, contentType });

    if (this.shouldFail) {
      throw new Error('Mock upload failure');
    }

    return {
      key,
      url: `http://mock-storage.example.com/${key}`,
      size: buffer.length,
      etag: 'mock-etag-' + key,
      contentType,
    };
  }

  protected logFilenameSanitization(
    projectId: string,
    bugId: string,
    original: string,
    sanitized: string
  ): void {
    this.filenameLog.push({ projectId, bugId, original, sanitized });
  }

  async initialize(): Promise<void> {}

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    return `http://mock-storage.example.com/${key}?signed=true`;
  }

  async deleteObject(key: string): Promise<void> {}

  async deleteFolder(prefix: string): Promise<number> {
    return 0;
  }

  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    return { objects: [], isTruncated: false };
  }

  async getObject(key: string): Promise<Readable> {
    throw new Error('Not implemented in mock');
  }

  async headObject(key: string): Promise<StorageObject | null> {
    return null;
  }

  async uploadStream(
    key: string,
    stream: Readable,
    options?: MultipartUploadOptions
  ): Promise<UploadResult> {
    throw new Error('Not implemented in mock');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('BaseStorageService', () => {
  let storage: MockStorageService;

  beforeEach(() => {
    storage = new MockStorageService();
  });

  describe('Template Method Pattern', () => {
    describe('uploadScreenshot', () => {
      it('should validate project and bug IDs', async () => {
        const buffer = Buffer.from('screenshot data');

        const result = await storage.uploadScreenshot('proj-123', 'bug-456', buffer);

        expect(result.key).toBe('screenshots/proj-123/bug-456/original.png');
        expect(storage.uploadBufferCalls).toHaveLength(1);
        expect(storage.uploadBufferCalls[0].key).toBe('screenshots/proj-123/bug-456/original.png');
      });

      it('should sanitize invalid project ID', async () => {
        const buffer = Buffer.from('test');

        const result = await storage.uploadScreenshot('../invalid', 'bug-123', buffer);

        expect(result.key).not.toContain('..');
        expect(result.key).toContain('---invalid');
      });

      it('should sanitize invalid bug ID', async () => {
        const buffer = Buffer.from('test');

        const result = await storage.uploadScreenshot('proj-123', '../invalid', buffer);

        expect(result.key).not.toContain('..');
        expect(result.key).toContain('---invalid');
      });

      it('should detect content type from buffer', async () => {
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

        await storage.uploadScreenshot('proj-123', 'bug-456', pngBuffer);

        expect(storage.uploadBufferCalls[0].contentType).toBe('image/png');
      });
    });

    describe('uploadThumbnail', () => {
      it('should use correct path and content type', async () => {
        const buffer = Buffer.from('thumbnail data');

        const result = await storage.uploadThumbnail('proj-123', 'bug-456', buffer);

        expect(result.key).toBe('screenshots/proj-123/bug-456/thumbnail.jpg');
        expect(storage.uploadBufferCalls[0].key).toBe('screenshots/proj-123/bug-456/thumbnail.jpg');
        expect(storage.uploadBufferCalls[0].contentType).toBe('image/jpeg');
      });

      it('should validate inputs', async () => {
        await expect(storage.uploadThumbnail('', 'bug-123', Buffer.from('test'))).rejects.toThrow();
      });
    });

    describe('uploadReplayMetadata', () => {
      it('should serialize metadata to JSON', async () => {
        const metadata = {
          duration: 5000,
          events: 42,
          startTime: Date.now(),
        };

        const result = await storage.uploadReplayMetadata('proj-123', 'bug-456', metadata);

        expect(result.key).toBe('replays/proj-123/bug-456/metadata.json');
        expect(storage.uploadBufferCalls[0].contentType).toBe('application/json');

        const uploadedJson = storage.uploadBufferCalls[0].buffer.toString();
        const parsed = JSON.parse(uploadedJson);
        expect(parsed).toEqual(metadata);
      });

      it('should format JSON with indentation', async () => {
        const metadata = { test: 'value' };

        await storage.uploadReplayMetadata('proj-123', 'bug-456', metadata);

        const uploadedJson = storage.uploadBufferCalls[0].buffer.toString();
        expect(uploadedJson).toContain('\n');
        expect(uploadedJson).toContain('  ');
      });
    });

    describe('uploadReplayChunk', () => {
      it('should build correct chunk path', async () => {
        const chunkData = Buffer.from('compressed chunk data');

        const result = await storage.uploadReplayChunk('proj-123', 'bug-456', 5, chunkData);

        expect(result.key).toBe('replays/proj-123/bug-456/chunks/5.json.gz');
        expect(storage.uploadBufferCalls[0].contentType).toBe('application/gzip');
      });

      it('should reject negative chunk index', async () => {
        await expect(
          storage.uploadReplayChunk('proj-123', 'bug-456', -1, Buffer.from('test'))
        ).rejects.toThrow(StorageError);
      });

      it('should reject non-integer chunk index', async () => {
        await expect(
          storage.uploadReplayChunk('proj-123', 'bug-456', 3.14, Buffer.from('test'))
        ).rejects.toThrow(StorageError);
      });

      it('should accept chunk index 0', async () => {
        const result = await storage.uploadReplayChunk(
          'proj-123',
          'bug-456',
          0,
          Buffer.from('test')
        );

        expect(result.key).toBe('replays/proj-123/bug-456/chunks/0.json.gz');
      });
    });

    describe('uploadAttachment', () => {
      it('should sanitize filename', async () => {
        const maliciousFilename = '../../../etc/passwd';
        const buffer = Buffer.from('test');

        const result = await storage.uploadAttachment(
          'proj-123',
          'bug-456',
          maliciousFilename,
          buffer
        );

        expect(result.key).not.toContain('..');
        expect(result.key).toMatch(/^attachments\/proj-123\/bug-456\//);
        expect(result.key).toBe('attachments/proj-123/bug-456/passwd');
      });

      it('should log when filename is sanitized', async () => {
        const originalFilename = 'test/../malicious.txt';
        const buffer = Buffer.from('test');

        await storage.uploadAttachment('proj-123', 'bug-456', originalFilename, buffer);

        expect(storage.filenameLog).toHaveLength(1);
        expect(storage.filenameLog[0]).toEqual({
          projectId: 'proj-123',
          bugId: 'bug-456',
          original: originalFilename,
          sanitized: 'malicious.txt',
        });
      });

      it('should not log when filename unchanged', async () => {
        const cleanFilename = 'document.pdf';
        const buffer = Buffer.from('test');

        await storage.uploadAttachment('proj-123', 'bug-456', cleanFilename, buffer);

        expect(storage.filenameLog).toHaveLength(0);
      });

      it('should handle Windows reserved names', async () => {
        const filename = 'CON.txt';
        const buffer = Buffer.from('test');

        const result = await storage.uploadAttachment('proj-123', 'bug-456', filename, buffer);

        expect(result.key).toMatch(/^attachments\/proj-123\/bug-456\//);
        expect(storage.filenameLog).toHaveLength(1);
      });

      it('should detect content type from buffer', async () => {
        const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);

        await storage.uploadAttachment('proj-123', 'bug-456', 'document.pdf', pdfBuffer);

        expect(storage.uploadBufferCalls[0].contentType).toBe('application/pdf');
      });
    });
  });

  describe('Validation Consistency', () => {
    it('should apply same sanitization to all upload methods', async () => {
      const maliciousProjectId = '../invalid';
      const validBugId = 'bug-123';
      const buffer = Buffer.from('test');

      const screenshot = await storage.uploadScreenshot(maliciousProjectId, validBugId, buffer);
      const thumbnail = await storage.uploadThumbnail(maliciousProjectId, validBugId, buffer);
      const metadata = await storage.uploadReplayMetadata(maliciousProjectId, validBugId, {});
      const chunk = await storage.uploadReplayChunk(maliciousProjectId, validBugId, 0, buffer);
      const attachment = await storage.uploadAttachment(
        maliciousProjectId,
        validBugId,
        'file.txt',
        buffer
      );

      expect(screenshot.key).not.toContain('..');
      expect(thumbnail.key).not.toContain('..');
      expect(metadata.key).not.toContain('..');
      expect(chunk.key).not.toContain('..');
      expect(attachment.key).not.toContain('..');
    });

    it('should sanitize keys consistently', async () => {
      const projectId = 'proj-123';
      const bugId = 'bug-456';
      const buffer = Buffer.from('test');

      await storage.uploadScreenshot(projectId, bugId, buffer);
      await storage.uploadThumbnail(projectId, bugId, buffer);
      await storage.uploadReplayMetadata(projectId, bugId, {});
      await storage.uploadReplayChunk(projectId, bugId, 0, buffer);

      const keys = storage.uploadBufferCalls.map((call) => call.key);
      expect(keys).toEqual([
        'screenshots/proj-123/bug-456/original.png',
        'screenshots/proj-123/bug-456/thumbnail.jpg',
        'replays/proj-123/bug-456/metadata.json',
        'replays/proj-123/bug-456/chunks/0.json.gz',
      ]);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate upload errors', async () => {
      storage.shouldFail = true;

      await expect(
        storage.uploadScreenshot('proj-123', 'bug-456', Buffer.from('test'))
      ).rejects.toThrow('Mock upload failure');
    });

    it('should sanitize inputs even when upload fails', async () => {
      storage.shouldFail = true;

      await expect(
        storage.uploadScreenshot('../invalid', 'bug-123', Buffer.from('test'))
      ).rejects.toThrow('Mock upload failure');

      expect(storage.uploadBufferCalls).toHaveLength(1);
      expect(storage.uploadBufferCalls[0].key).not.toContain('..');
    });
  });

  describe('Content Type Detection', () => {
    it('should detect PNG images', async () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await storage.uploadScreenshot('proj-1', 'bug-1', pngSignature);
      expect(storage.uploadBufferCalls[0].contentType).toBe('image/png');
    });

    it('should detect JPEG images', async () => {
      const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
      await storage.uploadScreenshot('proj-1', 'bug-1', jpegSignature);
      expect(storage.uploadBufferCalls[0].contentType).toBe('image/jpeg');
    });

    it('should use application/octet-stream as fallback', async () => {
      const unknownBuffer = Buffer.from('unknown content type');
      await storage.uploadScreenshot('proj-1', 'bug-1', unknownBuffer);
      expect(storage.uploadBufferCalls[0].contentType).toBe('application/octet-stream');
    });
  });

  describe('Hook Customization', () => {
    it('should allow overriding logFilenameSanitization', async () => {
      class CustomStorage extends MockStorageService {
        public customLogCalls = 0;

        protected logFilenameSanitization(
          projectId: string,
          bugId: string,
          original: string,
          sanitized: string
        ): void {
          this.customLogCalls++;
        }
      }

      const customStorage = new CustomStorage();
      await customStorage.uploadAttachment(
        'proj-1',
        'bug-1',
        '../malicious.txt',
        Buffer.from('test')
      );

      expect(customStorage.customLogCalls).toBe(1);
      expect(customStorage.filenameLog).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffers', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await storage.uploadScreenshot('proj-1', 'bug-1', emptyBuffer);

      expect(result.size).toBe(0);
    });

    it('should handle large buffers', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024);
      const result = await storage.uploadScreenshot('proj-1', 'bug-1', largeBuffer);

      expect(result.size).toBe(largeBuffer.length);
    });

    it('should handle special characters in IDs', async () => {
      const projectId = 'proj-123-abc_def';
      const bugId = 'bug-456-xyz_123';

      const result = await storage.uploadScreenshot(projectId, bugId, Buffer.from('test'));

      expect(result.key).toContain(projectId);
      expect(result.key).toContain(bugId);
    });

    it('should handle metadata with nested objects', async () => {
      const complexMetadata = {
        user: { id: '123', name: 'Test User' },
        metrics: { cpu: 75, memory: 60 },
        tags: ['bug', 'critical'],
      };

      await storage.uploadReplayMetadata('proj-1', 'bug-1', complexMetadata);

      const uploaded = JSON.parse(storage.uploadBufferCalls[0].buffer.toString());
      expect(uploaded).toEqual(complexMetadata);
    });
  });

  describe('Integration with Concrete Implementations', () => {
    it('should provide consistent interface for S3 and Local storage', async () => {
      const calls: Array<{ method: string; key: string }> = [];

      class TrackingStorage extends MockStorageService {
        protected async uploadBuffer(
          key: string,
          buffer: Buffer,
          contentType: string
        ): Promise<UploadResult> {
          calls.push({ method: 'uploadBuffer', key });
          return super.uploadBuffer(key, buffer, contentType);
        }
      }

      const tracker = new TrackingStorage();

      await tracker.uploadScreenshot('proj-1', 'bug-1', Buffer.from('test'));
      await tracker.uploadThumbnail('proj-1', 'bug-1', Buffer.from('test'));
      await tracker.uploadAttachment('proj-1', 'bug-1', 'file.txt', Buffer.from('test'));

      expect(calls).toHaveLength(3);
      expect(calls.every((call) => call.method === 'uploadBuffer')).toBe(true);
    });
  });
});
