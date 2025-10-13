/**
 * Tests for Storage URL Builder
 * Ensures consistent API URL generation for stored resources
 */

import { describe, it, expect } from 'vitest';
import {
  buildReplayChunkUrl,
  buildReplayManifestUrl,
  buildScreenshotUrl,
  buildAttachmentUrl,
} from '../src/storage/storage-url-builder.js';

describe('Storage URL Builder', () => {
  const projectId = 'proj-123';
  const bugReportId = 'bug-456';

  describe('buildReplayChunkUrl', () => {
    it('should build URL with zero-padded chunk index', () => {
      const url = buildReplayChunkUrl(projectId, bugReportId, 0);
      expect(url).toBe('/api/v1/storage/replays/proj-123/bug-456/chunk-0000.json.gz');
    });

    it('should pad chunk index to 4 digits', () => {
      const url = buildReplayChunkUrl(projectId, bugReportId, 42);
      expect(url).toBe('/api/v1/storage/replays/proj-123/bug-456/chunk-0042.json.gz');
    });

    it('should handle large chunk indices', () => {
      const url = buildReplayChunkUrl(projectId, bugReportId, 9999);
      expect(url).toBe('/api/v1/storage/replays/proj-123/bug-456/chunk-9999.json.gz');
    });

    it('should not truncate chunk indices larger than 4 digits', () => {
      const url = buildReplayChunkUrl(projectId, bugReportId, 12345);
      expect(url).toBe('/api/v1/storage/replays/proj-123/bug-456/chunk-12345.json.gz');
    });
  });

  describe('buildReplayManifestUrl', () => {
    it('should build manifest URL', () => {
      const url = buildReplayManifestUrl(projectId, bugReportId);
      expect(url).toBe('/api/v1/storage/replays/proj-123/bug-456/manifest.json');
    });
  });

  describe('buildScreenshotUrl', () => {
    it('should build original screenshot URL by default', () => {
      const url = buildScreenshotUrl(projectId, bugReportId);
      expect(url).toBe('/api/v1/storage/screenshots/proj-123/bug-456/original.png');
    });

    it('should build original screenshot URL explicitly', () => {
      const url = buildScreenshotUrl(projectId, bugReportId, 'original');
      expect(url).toBe('/api/v1/storage/screenshots/proj-123/bug-456/original.png');
    });

    it('should build thumbnail screenshot URL', () => {
      const url = buildScreenshotUrl(projectId, bugReportId, 'thumbnail');
      expect(url).toBe('/api/v1/storage/screenshots/proj-123/bug-456/thumbnail.jpg');
    });
  });

  describe('buildAttachmentUrl', () => {
    it('should build attachment URL with filename', () => {
      const url = buildAttachmentUrl(projectId, bugReportId, 'test.pdf');
      expect(url).toBe('/api/v1/storage/attachments/proj-123/bug-456/test.pdf');
    });

    it('should preserve filename extensions', () => {
      const url = buildAttachmentUrl(projectId, bugReportId, 'report.log.txt');
      expect(url).toBe('/api/v1/storage/attachments/proj-123/bug-456/report.log.txt');
    });
  });

  describe('URL consistency', () => {
    it('should use consistent API base path across all builders', () => {
      const chunkUrl = buildReplayChunkUrl(projectId, bugReportId, 0);
      const manifestUrl = buildReplayManifestUrl(projectId, bugReportId);
      const screenshotUrl = buildScreenshotUrl(projectId, bugReportId);
      const attachmentUrl = buildAttachmentUrl(projectId, bugReportId, 'test.txt');

      expect(chunkUrl).toMatch(/^\/api\/v1\/storage\//);
      expect(manifestUrl).toMatch(/^\/api\/v1\/storage\//);
      expect(screenshotUrl).toMatch(/^\/api\/v1\/storage\//);
      expect(attachmentUrl).toMatch(/^\/api\/v1\/storage\//);
    });

    it('should consistently structure resource paths', () => {
      const chunkUrl = buildReplayChunkUrl(projectId, bugReportId, 0);
      const manifestUrl = buildReplayManifestUrl(projectId, bugReportId);

      // Both replay URLs should share same base path
      const chunkBase = chunkUrl.substring(0, chunkUrl.lastIndexOf('/'));
      const manifestBase = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
      expect(chunkBase).toBe(manifestBase);
    });
  });
});
