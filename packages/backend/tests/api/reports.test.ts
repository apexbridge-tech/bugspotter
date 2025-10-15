/**
 * Bug Report Routes Tests
 * Tests for CRUD operations on bug reports
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';
import { createDatabaseClient } from '../../src/db/client.js';
import type { DatabaseClient } from '../../src/db/client.js';
import { createMockPluginRegistry, createMockStorage } from '../test-helpers.js';

describe('Bug Report Routes', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;
  let testApiKey: string;
  let testProjectId: string;

  beforeAll(async () => {
    const testDbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/bugspotter_test';
    db = createDatabaseClient(testDbUrl);
    const pluginRegistry = createMockPluginRegistry();
    const storage = createMockStorage();
    server = await createServer({ db, storage, pluginRegistry });
    await server.ready();
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
      name: `Test Project ${timestamp}`,
      api_key: `bgs_test_${timestamp}_${randomId}`,
      settings: {},
    });
    testApiKey = project.api_key;
    testProjectId = project.id;
  });

  describe('POST /api/v1/reports', () => {
    it('should create a bug report with API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          title: 'Login button not working',
          description: 'Users cannot log in',
          priority: 'high',
          report: {
            consoleLogs: [
              {
                level: 'error',
                message: 'Uncaught TypeError',
                timestamp: '2025-10-08T12:00:00Z',
              },
            ],
            networkRequests: [],
            browserMetadata: {
              userAgent: 'Mozilla/5.0',
              url: 'https://example.com',
            },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Login button not working');
      expect(json.data.priority).toBe('high');
      expect(json.data.status).toBe('open');
      expect(json.data.project_id).toBe(testProjectId);
    });

    it('should create report with session replay', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          title: 'Test Report',
          report: {
            consoleLogs: [],
            networkRequests: [],
            browserMetadata: {},
            sessionReplay: {
              events: [{ type: 'click', target: '#button' }],
              duration: 5000,
            },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.id).toBeDefined();
    });

    it('should default to medium priority', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          title: 'Test Report',
          report: {
            consoleLogs: [],
            networkRequests: [],
            browserMetadata: {},
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.priority).toBe('medium');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        payload: {
          title: 'Test Report',
          report: {
            consoleLogs: [],
            networkRequests: [],
            browserMetadata: {},
          },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          // Missing title and report
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('ValidationError');
    });
  });

  describe('GET /api/v1/reports', () => {
    beforeEach(async () => {
      // Create some test reports
      await db.bugReports.create({
        project_id: testProjectId,
        title: 'Report 1',
        status: 'open',
        priority: 'high',
        metadata: {},
      });
      await db.bugReports.create({
        project_id: testProjectId,
        title: 'Report 2',
        status: 'resolved',
        priority: 'low',
        metadata: {},
      });
    });

    it('should list bug reports', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeInstanceOf(Array);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.limit).toBe(20);
    });

    it('should filter by status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?status=open',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.every((r: any) => r.status === 'open')).toBe(true);
    });

    it('should filter by priority', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?priority=high',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.every((r: any) => r.priority === 'high')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?page=1&limit=1',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBeLessThanOrEqual(1);
      expect(json.pagination.limit).toBe(1);
    });

    it('should support sorting', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?sort_by=created_at&order=asc',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/reports/:id', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Single Report',
        status: 'open',
        priority: 'medium',
        metadata: {},
      });
      reportId = report.id;
    });

    it('should get a single bug report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${reportId}`,
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(reportId);
      expect(json.data.title).toBe('Single Report');
    });

    it('should return 404 for non-existent report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports/00000000-0000-0000-0000-000000000000',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error).toBe('NotFound');
    });

    it('should enforce project access control', async () => {
      // Create another project
      const otherProject = await db.projects.create({
        name: 'Other Project',
        api_key: 'bgs_other_key',
        settings: {},
      });

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${reportId}`,
        headers: {
          'x-api-key': otherProject.api_key,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/reports/:id', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Report to Update',
        status: 'open',
        priority: 'medium',
        metadata: {},
      });
      reportId = report.id;
    });

    it('should update bug report status', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/reports/${reportId}`,
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          status: 'resolved',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('resolved');
    });

    it('should update bug report priority', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/reports/${reportId}`,
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          priority: 'critical',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.priority).toBe('critical');
    });

    it('should require at least one field', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/reports/${reportId}`,
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent report', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/reports/00000000-0000-0000-0000-000000000000',
        headers: {
          'x-api-key': testApiKey,
        },
        payload: {
          status: 'resolved',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
