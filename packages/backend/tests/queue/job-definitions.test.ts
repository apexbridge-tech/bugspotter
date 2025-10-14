/**
 * Job Definitions Tests
 * Tests for job data validation and result creation functions
 */

import { describe, it, expect } from 'vitest';
import {
  SCREENSHOT_JOB_NAME,
  validateScreenshotJobData,
  createScreenshotJobResult,
} from '../../src/queue/jobs/screenshot-job.js';
import {
  REPLAY_JOB_NAME,
  validateReplayJobData,
  createReplayJobResult,
} from '../../src/queue/jobs/replay-job.js';
import {
  INTEGRATION_JOB_NAME,
  validateIntegrationJobData,
  createIntegrationJobResult,
} from '../../src/queue/jobs/integration-job.js';
import {
  NOTIFICATION_JOB_NAME,
  validateNotificationJobData,
  createNotificationJobResult,
} from '../../src/queue/jobs/notification-job.js';

describe('Screenshot Job', () => {
  describe('validateScreenshotJobData()', () => {
    it('should validate correct screenshot job data', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      expect(validateScreenshotJobData(validData)).toBe(true);
    });

    it('should validate with optional originalFilename', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalFilename: 'screenshot.png',
      };

      expect(validateScreenshotJobData(validData)).toBe(true);
    });

    it('should reject missing bugReportId', () => {
      const invalidData = {
        projectId: 'proj-456',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject missing projectId', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject missing screenshotData', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject non-string fields', () => {
      const invalidData = {
        bugReportId: 123,
        projectId: 'proj-456',
        screenshotData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      expect(validateScreenshotJobData(invalidData)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateScreenshotJobData(null)).toBe(false);
      expect(validateScreenshotJobData(undefined)).toBe(false);
    });

    it('should reject non-object data', () => {
      expect(validateScreenshotJobData('string')).toBe(false);
      expect(validateScreenshotJobData(123)).toBe(false);
      expect(validateScreenshotJobData(true)).toBe(false);
    });
  });

  describe('createScreenshotJobResult()', () => {
    it('should create screenshot job result', () => {
      const result = createScreenshotJobResult(
        'https://example.com/optimized.jpg',
        'https://example.com/thumbnail.jpg',
        {
          originalSize: 1024000,
          thumbnailSize: 51200,
          width: 1920,
          height: 1080,
          processingTimeMs: 150,
        }
      );

      expect(result).toEqual({
        originalUrl: 'https://example.com/optimized.jpg',
        thumbnailUrl: 'https://example.com/thumbnail.jpg',
        originalSize: 1024000,
        thumbnailSize: 51200,
        width: 1920,
        height: 1080,
        processingTimeMs: 150,
      });
    });
  });

  it('should have correct job name constant', () => {
    expect(SCREENSHOT_JOB_NAME).toBe('process-screenshot');
  });
});

describe('Replay Job', () => {
  describe('validateReplayJobData()', () => {
    it('should validate correct replay job data with string replayData', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        replayData: '{"events": []}',
      };

      expect(validateReplayJobData(validData)).toBe(true);
    });

    it('should validate correct replay job data with object replayData', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        replayData: { events: [] },
      };

      expect(validateReplayJobData(validData)).toBe(true);
    });

    it('should validate with optional duration and eventCount', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        replayData: '{"events": []}',
        duration: 30000,
        eventCount: 100,
      };

      expect(validateReplayJobData(validData)).toBe(true);
    });

    it('should reject missing bugReportId', () => {
      const invalidData = {
        projectId: 'proj-456',
        replayData: '{"events": []}',
      };

      expect(validateReplayJobData(invalidData)).toBe(false);
    });

    it('should reject missing replayData', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
      };

      expect(validateReplayJobData(invalidData)).toBe(false);
    });

    it('should reject replayData that is neither string nor object', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        replayData: 123,
      };

      expect(validateReplayJobData(invalidData)).toBe(false);
    });
  });

  describe('createReplayJobResult()', () => {
    it('should create replay job result', () => {
      const result = createReplayJobResult(
        'https://example.com/replay.json',
        'https://example.com/metadata.json',
        {
          chunkCount: 5,
          totalSize: 1024000,
          duration: 150000,
          eventCount: 500,
          processingTimeMs: 2500,
        }
      );

      expect(result).toEqual({
        replayUrl: 'https://example.com/replay.json',
        metadataUrl: 'https://example.com/metadata.json',
        chunkCount: 5,
        totalSize: 1024000,
        duration: 150000,
        eventCount: 500,
        processingTimeMs: 2500,
      });
    });
  });

  it('should have correct job name constant', () => {
    expect(REPLAY_JOB_NAME).toBe('process-replay');
  });
});

describe('Integration Job', () => {
  describe('validateIntegrationJobData()', () => {
    it('should validate correct integration job data', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        platform: 'jira',
        credentials: { apiKey: 'key123', domain: 'example.atlassian.net' },
        config: { projectKey: 'BUG', issueType: 'Bug' },
      };

      expect(validateIntegrationJobData(validData)).toBe(true);
    });

    it('should validate all supported platforms', () => {
      const platforms = ['jira', 'github', 'linear', 'slack'];

      platforms.forEach((platform) => {
        const validData = {
          bugReportId: 'bug-123',
          projectId: 'proj-456',
          platform,
          credentials: { token: 'abc' },
          config: {},
        };

        expect(validateIntegrationJobData(validData)).toBe(true);
      });
    });

    it('should reject missing platform', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        credentials: {},
        config: {},
      };

      expect(validateIntegrationJobData(invalidData)).toBe(false);
    });

    it('should reject missing credentials', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        platform: 'jira',
        config: {},
      };

      expect(validateIntegrationJobData(invalidData)).toBe(false);
    });

    it('should reject missing config', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        platform: 'jira',
        credentials: {},
      };

      expect(validateIntegrationJobData(invalidData)).toBe(false);
    });

    it('should reject non-object credentials', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        platform: 'jira',
        credentials: 'not-an-object',
        config: {},
      };

      expect(validateIntegrationJobData(invalidData)).toBe(false);
    });
  });

  describe('createIntegrationJobResult()', () => {
    it('should create integration job result', () => {
      const result = createIntegrationJobResult(
        'jira',
        'BUG-123',
        'https://example.atlassian.net/browse/BUG-123',
        'created',
        { projectKey: 'BUG' }
      );

      expect(result).toEqual({
        platform: 'jira',
        externalId: 'BUG-123',
        externalUrl: 'https://example.atlassian.net/browse/BUG-123',
        status: 'created',
        metadata: { projectKey: 'BUG' },
      });
    });

    it('should create result without optional metadata', () => {
      const result = createIntegrationJobResult(
        'github',
        '#456',
        'https://github.com/owner/repo/issues/456',
        'updated'
      );

      expect(result).toEqual({
        platform: 'github',
        externalId: '#456',
        externalUrl: 'https://github.com/owner/repo/issues/456',
        status: 'updated',
      });
    });
  });

  it('should have correct job name constant', () => {
    expect(INTEGRATION_JOB_NAME).toBe('process-integration');
  });
});

describe('Notification Job', () => {
  describe('validateNotificationJobData()', () => {
    it('should validate correct notification job data', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        recipients: ['user1@example.com', 'user2@example.com'],
        event: 'created',
      };

      expect(validateNotificationJobData(validData)).toBe(true);
    });

    it('should validate all notification types', () => {
      const types = ['email', 'slack', 'webhook'];

      types.forEach((type) => {
        const validData = {
          bugReportId: 'bug-123',
          projectId: 'proj-456',
          type,
          recipients: ['recipient@example.com'],
          event: 'created',
        };

        expect(validateNotificationJobData(validData)).toBe(true);
      });
    });

    it('should validate with optional metadata', () => {
      const validData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        recipients: ['user@example.com'],
        event: 'created',
        metadata: { priority: 'high', source: 'api' },
      };

      expect(validateNotificationJobData(validData)).toBe(true);
    });

    it('should reject missing type', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        recipients: ['user@example.com'],
        event: 'created',
      };

      expect(validateNotificationJobData(invalidData)).toBe(false);
    });

    it('should reject missing recipients', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        event: 'created',
      };

      expect(validateNotificationJobData(invalidData)).toBe(false);
    });

    it('should reject non-array recipients', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        recipients: 'not-an-array',
        event: 'created',
      };

      expect(validateNotificationJobData(invalidData)).toBe(false);
    });

    it('should reject empty recipients array', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        recipients: [],
        event: 'created',
      };

      expect(validateNotificationJobData(invalidData)).toBe(false);
    });

    it('should reject missing event', () => {
      const invalidData = {
        bugReportId: 'bug-123',
        projectId: 'proj-456',
        type: 'email',
        recipients: ['user@example.com'],
      };

      expect(validateNotificationJobData(invalidData)).toBe(false);
    });
  });

  describe('createNotificationJobResult()', () => {
    it('should create notification job result', () => {
      const result = createNotificationJobResult('email', 10, 8, 2, [
        'Failed to send to user1@example.com',
        'Failed to send to user2@example.com',
      ]);

      expect(result).toEqual({
        type: 'email',
        recipientCount: 10,
        successCount: 8,
        failureCount: 2,
        errors: ['Failed to send to user1@example.com', 'Failed to send to user2@example.com'],
      });
    });

    it('should create result without errors', () => {
      const result = createNotificationJobResult('slack', 5, 5, 0);

      expect(result).toEqual({
        type: 'slack',
        recipientCount: 5,
        successCount: 5,
        failureCount: 0,
      });
    });
  });

  it('should have correct job name constant', () => {
    expect(NOTIFICATION_JOB_NAME).toBe('send-notification');
  });
});
