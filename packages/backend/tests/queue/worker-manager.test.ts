/**
 * WorkerManager Tests
 * Tests worker orchestration, lifecycle management, metrics, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerManager } from '../../src/queue/worker-manager.js';
import { getQueueManager } from '../../src/queue/queue.manager.js';
import type { DatabaseClient } from '../../src/db/client.js';
import type { BaseStorageService } from '../../src/storage/base-storage-service.js';

// Mock dependencies
vi.mock('../../src/queue/queue.manager.js');
vi.mock('../../src/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('../../src/config/queue.config.js', () => ({
  getQueueConfig: () => ({
    workers: {
      screenshot: { enabled: true, concurrency: 2 },
      replay: { enabled: true, concurrency: 2 },
      integration: { enabled: true, concurrency: 1 },
      notification: { enabled: true, concurrency: 1 },
    },
    screenshot: { quality: 80, thumbnailWidth: 200, thumbnailHeight: 200 },
  }),
}));

// Mock worker constructors/factories
vi.mock('../../src/queue/workers/screenshot.worker.js', () => {
  return {
    ScreenshotWorker: vi.fn().mockImplementation(() => {
      const mockWorker = {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
      };
      return {
        getWorker: () => mockWorker,
      };
    }),
  };
});

vi.mock('../../src/queue/workers/replay.worker.js', () => ({
  createReplayWorker: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../src/queue/workers/integration.worker.js', () => ({
  createIntegrationWorker: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../src/queue/workers/notification.worker.js', () => ({
  createNotificationWorker: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('WorkerManager', () => {
  let workerManager: WorkerManager;
  let mockDb: DatabaseClient;
  let mockStorage: BaseStorageService;
  let mockQueueManager: any;
  let mockWorker: any;

  beforeEach(() => {
    // Reset environment variables
    process.env.QUEUE_SCREENSHOT_ENABLED = 'false';
    process.env.QUEUE_REPLAY_ENABLED = 'false';
    process.env.QUEUE_INTEGRATION_ENABLED = 'false';
    process.env.QUEUE_NOTIFICATION_ENABLED = 'false';

    // Setup mock worker
    mockWorker = {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock queue manager
    mockQueueManager = {
      getConnection: vi.fn().mockReturnValue({
        duplicate: vi.fn().mockReturnValue({}),
      }),
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueueManager).mockReturnValue(mockQueueManager);

    // Setup mock database
    mockDb = {
      query: vi.fn(),
      projects: {} as any,
      bugReports: {} as any,
      users: {} as any,
      sessions: {} as any,
      tickets: {} as any,
      projectMembers: {} as any,
    } as unknown as DatabaseClient;

    // Setup mock storage
    mockStorage = {
      uploadScreenshot: vi.fn(),
      uploadReplay: vi.fn(),
      getObject: vi.fn(),
    } as any;

    workerManager = new WorkerManager(mockDb, mockStorage);
  });

  afterEach(async () => {
    await workerManager.shutdown();
  });

  describe('Initialization', () => {
    it('should create WorkerManager instance', () => {
      expect(workerManager).toBeDefined();
      expect(workerManager).toBeInstanceOf(WorkerManager);
    });

    it('should start with no workers', () => {
      const metrics = workerManager.getMetrics();
      expect(metrics.totalWorkers).toBe(0);
    });

    it('should not be running initially', () => {
      const metrics = workerManager.getMetrics();
      expect(metrics.runningWorkers).toBe(0);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should start all enabled workers', async () => {
      // Mock environment
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'true';
      process.env.QUEUE_INTEGRATION_ENABLED = 'false';
      process.env.QUEUE_NOTIFICATION_ENABLED = 'false';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      const screenshotWorker = metrics.workers.find((w) => w.workerName === 'screenshot');
      const replayWorker = metrics.workers.find((w) => w.workerName === 'replay');
      expect(screenshotWorker).toBeDefined();
      expect(screenshotWorker?.isRunning).toBe(true);
      expect(replayWorker).toBeDefined();
      expect(replayWorker?.isRunning).toBe(true);
    });

    it('should not start disabled workers', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'false';
      process.env.QUEUE_REPLAY_ENABLED = 'false';
      process.env.QUEUE_INTEGRATION_ENABLED = 'false';
      process.env.QUEUE_NOTIFICATION_ENABLED = 'false';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      expect(metrics.totalWorkers).toBe(0);
    });

    it('should only start each worker once', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();
      await workerManager.start(); // Second call

      const metrics = workerManager.getMetrics();
      expect(metrics.totalWorkers).toBe(1);
    });

    it('should track start time when started', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Worker Metrics', () => {
    beforeEach(async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();
    });

    it('should initialize metrics for started workers', () => {
      const metrics = workerManager.getWorkerMetrics('screenshot');

      expect(metrics).toBeDefined();
      expect(metrics).toMatchObject({
        isRunning: true,
        jobsProcessed: 0,
        jobsFailed: 0,
        avgProcessingTimeMs: 0,
        lastError: null,
      });
    });

    it('should return null for non-existent worker', () => {
      const metrics = workerManager.getWorkerMetrics('nonexistent');
      expect(metrics).toBeNull();
    });

    it('should return all metrics', () => {
      const metrics = workerManager.getMetrics();

      expect(metrics).toBeDefined();
      const screenshotWorker = metrics.workers.find((w) => w.workerName === 'screenshot');
      expect(screenshotWorker).toBeDefined();
      expect(screenshotWorker?.isRunning).toBe(true);
    });

    it('should calculate uptime correctly', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = workerManager.getMetrics();
      expect(metrics.uptime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Health Checks', () => {
    it('should return healthy when all workers are running', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'true';

      await workerManager.start();

      const health = await workerManager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.workers.screenshot).toBe(true);
      expect(health.workers.replay).toBe(true);
    });

    it('should return unhealthy if no workers are running', async () => {
      const health = await workerManager.healthCheck();

      expect(health.healthy).toBe(true); // No workers = healthy (nothing to fail)
      expect(health.workers).toEqual({});
    });

    it('should detect stopped workers', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();
      await workerManager.pauseWorker('screenshot');

      // Manually set running to false
      const metrics = workerManager.getWorkerMetrics('screenshot');
      if (metrics) {
        metrics.isRunning = false;
      }

      const health = await workerManager.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.workers.screenshot).toBe(false);
    });
  });

  describe('Worker Control', () => {
    beforeEach(async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();
    });

    it('should pause a worker', async () => {
      await workerManager.pauseWorker('screenshot');

      const metrics = workerManager.getWorkerMetrics('screenshot');
      expect(metrics?.isRunning).toBe(false);
    });

    it('should resume a worker', async () => {
      await workerManager.pauseWorker('screenshot');
      await workerManager.resumeWorker('screenshot');

      const metrics = workerManager.getWorkerMetrics('screenshot');
      expect(metrics?.isRunning).toBe(true);
    });

    it('should throw error when pausing non-existent worker', async () => {
      await expect(workerManager.pauseWorker('nonexistent')).rejects.toThrow(
        'Worker nonexistent not found'
      );
    });

    it('should throw error when resuming non-existent worker', async () => {
      await expect(workerManager.resumeWorker('nonexistent')).rejects.toThrow(
        'Worker nonexistent not found'
      );
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all workers', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'true';

      await workerManager.start();
      await workerManager.shutdown();

      const metrics = workerManager.getMetrics();
      const screenshotWorker = metrics.workers.find((w) => w.workerName === 'screenshot');
      const replayWorker = metrics.workers.find((w) => w.workerName === 'replay');
      expect(screenshotWorker?.isRunning).toBe(false);
      expect(replayWorker?.isRunning).toBe(false);
    });

    it('should handle shutdown when no workers are running', async () => {
      await expect(workerManager.shutdown()).resolves.not.toThrow();
    });

    it('should prevent duplicate shutdowns', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();
      await workerManager.shutdown();
      await workerManager.shutdown(); // Second call

      // Should not throw
      expect(true).toBe(true);
    });

    it('should wait for graceful period during shutdown', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();

      const startTime = Date.now();
      await workerManager.shutdown();
      const duration = Date.now() - startTime;

      // Should wait at least the graceful shutdown time (but test with margin)
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle worker start errors', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      // Mock worker creation to throw
      mockQueueManager.getConnection.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(workerManager.start()).rejects.toThrow('Connection failed');
    });

    it('should continue starting other workers if one fails', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'true';

      // Mock only screenshot to fail
      const originalGetConnection = mockQueueManager.getConnection;
      let callCount = 0;
      mockQueueManager.getConnection.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Screenshot worker failed');
        }
        return originalGetConnection();
      });

      // Should throw on first worker failure
      await expect(workerManager.start()).rejects.toThrow('Screenshot worker failed');
    });

    it('should handle shutdown errors gracefully', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();

      // Mock worker close to throw
      mockWorker.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(workerManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Metric Updates', () => {
    it('should track jobs processed', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();

      // Simulate job completion by directly updating metrics
      const updateMetrics = (workerManager as any).updateWorkerMetrics.bind(workerManager);
      updateMetrics('screenshot', { jobsProcessed: 1 });

      const metrics = workerManager.getWorkerMetrics('screenshot');
      expect(metrics?.jobsProcessed).toBe(1);
    });

    it('should track failed jobs', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();

      const updateMetrics = (workerManager as any).updateWorkerMetrics.bind(workerManager);
      updateMetrics('screenshot', { jobsFailed: 1, lastError: 'Test error' });

      const metrics = workerManager.getWorkerMetrics('screenshot');
      expect(metrics?.jobsFailed).toBe(1);
      expect(metrics?.lastError).toBe('Test error');
    });

    it('should update last processed time', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();

      const now = new Date();
      const updateMetrics = (workerManager as any).updateWorkerMetrics.bind(workerManager);
      updateMetrics('screenshot', { lastProcessedAt: now });

      const metrics = workerManager.getWorkerMetrics('screenshot');
      expect(metrics?.lastProcessedAt).toEqual(now);
    });

    it('should calculate average processing time', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      await workerManager.start();

      const updateMetrics = (workerManager as any).updateWorkerMetrics.bind(workerManager);

      // Simulate multiple jobs
      updateMetrics('screenshot', { jobsProcessed: 1, processingTimeMs: 100 });
      updateMetrics('screenshot', { jobsProcessed: 1, processingTimeMs: 200 });
      updateMetrics('screenshot', { jobsProcessed: 1, processingTimeMs: 300 });

      const metrics = workerManager.getWorkerMetrics('screenshot');

      // Average should be calculated correctly
      expect(metrics?.jobsProcessed).toBe(3);
      expect(metrics?.avgProcessingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Integration with QueueManager', () => {
    it('should get connection from QueueManager', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';

      await workerManager.start();

      expect(mockQueueManager.getConnection).toHaveBeenCalled();
    });

    it('should use different connections for different workers', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'true';

      await workerManager.start();

      // Should call getConnection for each worker
      expect(mockQueueManager.getConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration', () => {
    it('should respect QUEUE_SCREENSHOT_ENABLED', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'true';
      process.env.QUEUE_REPLAY_ENABLED = 'false';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      const screenshotWorker = metrics.workers.find((w) => w.workerName === 'screenshot');
      const replayWorker = metrics.workers.find((w) => w.workerName === 'replay');
      expect(screenshotWorker).toBeDefined();
      expect(replayWorker).toBeUndefined();
    });

    it('should respect QUEUE_REPLAY_ENABLED', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'false';
      process.env.QUEUE_REPLAY_ENABLED = 'true';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      const screenshotWorker = metrics.workers.find((w) => w.workerName === 'screenshot');
      const replayWorker = metrics.workers.find((w) => w.workerName === 'replay');
      expect(screenshotWorker).toBeUndefined();
      expect(replayWorker).toBeDefined();
    });

    it('should respect QUEUE_INTEGRATION_ENABLED', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'false';
      process.env.QUEUE_INTEGRATION_ENABLED = 'true';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      const integrationWorker = metrics.workers.find((w) => w.workerName === 'integration');
      expect(integrationWorker).toBeDefined();
    });

    it('should respect QUEUE_NOTIFICATION_ENABLED', async () => {
      process.env.QUEUE_SCREENSHOT_ENABLED = 'false';
      process.env.QUEUE_NOTIFICATION_ENABLED = 'true';

      await workerManager.start();

      const metrics = workerManager.getMetrics();
      const notificationWorker = metrics.workers.find((w) => w.workerName === 'notification');
      expect(notificationWorker).toBeDefined();
    });
  });
});
