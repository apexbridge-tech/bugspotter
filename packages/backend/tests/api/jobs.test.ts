/**
 * Jobs API Route Tests
 * Tests for job queue status and monitoring endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '../../src/db/client.js';
import { createServer } from '../../src/api/server.js';
import type { FastifyInstance } from 'fastify';
import type { QueueManager } from '../../src/queue/queue-manager.js';
import type { Queue } from 'bullmq';

describe('Jobs API Routes', () => {
  let db: DatabaseClient;
  let server: FastifyInstance;
  let mockQueueManager: QueueManager;
  let testProjectId: string;
  let testApiKey: string;
  let testBugReportId: string;

  beforeAll(async () => {
    // Initialize database
    db = createDatabaseClient();
    await db.testConnection();

    // Create mock QueueManager with typed mocks
    const createMockQueue = (): Partial<Queue> => ({
      name: 'test-queue',
      getJobs: vi.fn().mockResolvedValue([]),
      getJob: vi.fn().mockResolvedValue(null),
      getJobCounts: vi.fn().mockResolvedValue({
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        waiting: 0,
      }),
      isPaused: vi.fn().mockResolvedValue(false),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      clean: vi.fn().mockResolvedValue([]),
      obliterate: vi.fn().mockResolvedValue(undefined),
    });

    mockQueueManager = {
      screenshotQueue: createMockQueue() as Queue,
      replayQueue: createMockQueue() as Queue,
      integrationQueue: createMockQueue() as Queue,
      notificationQueue: createMockQueue() as Queue,
      isHealthy: vi.fn().mockResolvedValue(true),
      healthCheck: vi.fn().mockResolvedValue(true),
      getJobStatus: vi.fn().mockResolvedValue(null), // Returns null by default (job not found)
      getQueueMetrics: vi.fn().mockResolvedValue({
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        waiting: 0,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueueManager;

    // Create server with mock queue manager
    server = await createServer({ db, queueManager: mockQueueManager });
  });

  afterAll(async () => {
    await server.close();
    await db.close();
  });

  beforeEach(async () => {
    // Create test project with unique API key for test isolation
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const project = await db.projects.create({
      name: `Test Project Jobs ${timestamp}`,
      api_key: `bgs_test_jobs_${timestamp}_${randomId}`,
    });
    testProjectId = project.id;
    testApiKey = project.api_key;

    // Create test bug report
    const bugReport = await db.bugReports.create({
      project_id: testProjectId,
      title: 'Test Bug',
      description: 'Test description',
      priority: 'medium',
      status: 'open',
      metadata: {},
      screenshot_url: null,
      replay_url: null,
    });
    testBugReportId = bugReport.id;
  });

  describe('GET /api/v1/queues/:queueName/jobs/:id', () => {
    it('should return 404 when job not found', async () => {
      // Mock returns null = job not found
      (mockQueueManager.getJobStatus as any).mockResolvedValueOnce(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/screenshots/jobs/test-job',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
      expect(body.message).toContain('Job test-job not found');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/screenshots/jobs/test-job',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return job status when job exists', async () => {
      // Mock returns job status
      const mockJobStatus = {
        id: 'test-job-123',
        name: 'screenshot-processing',
        state: 'completed',
        progress: 100,
        returnValue: { success: true },
      };
      (mockQueueManager.getJobStatus as any).mockResolvedValueOnce(mockJobStatus);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/screenshots/jobs/test-job-123',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.queueName).toBe('screenshots');
      expect(body.data.jobId).toBe('test-job-123');
      expect(body.data.status).toEqual(mockJobStatus);
    });

    it('should handle invalid queue name', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/invalid-queue/jobs/test-job',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      // Fastify validation should reject invalid queue name
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/reports/:id/jobs', () => {
    it('should get jobs for bug report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${testBugReportId}/jobs`,
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.bugReportId).toBe(testBugReportId);
    });

    it('should return 404 for non-existent bug report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports/00000000-0000-0000-0000-000000000000/jobs',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });

    it('should return 403 for bug report in different project', async () => {
      // Create another project
      const otherProject = await db.projects.create({
        name: 'Other Project',
        api_key: 'other-api-key',
      });

      // Create bug report in other project
      const otherBugReport = await db.bugReports.create({
        project_id: otherProject.id,
        title: 'Other Bug',
        description: 'Test',
        priority: 'medium',
        status: 'open',
        metadata: {},
        screenshot_url: null,
        replay_url: null,
      });

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${otherBugReport.id}/jobs`,
        headers: {
          'x-api-key': testApiKey, // Using wrong API key
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${testBugReportId}/jobs`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/queues/metrics', () => {
    it('should return metrics for all queues', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/metrics',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.queues).toBeInstanceOf(Array);
      expect(body.data.queues.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/metrics',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/queues/health', () => {
    it('should not require authentication (public endpoint)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/health',
        // Explicitly testing without any auth headers
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 503 when queue system is unhealthy', async () => {
      // Mock unhealthy queue
      (mockQueueManager.healthCheck as any).mockResolvedValueOnce(false);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ServiceUnavailable');
      expect(body.message).toContain('Queue system unhealthy');
    });

    it('should return 503 when health check throws error', async () => {
      // Mock health check throwing error
      (mockQueueManager.healthCheck as any).mockRejectedValueOnce(new Error('Connection failed'));

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/queues/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ServiceUnavailable');
      expect(body.message).toContain('Queue health check failed');
    });
  });
});
