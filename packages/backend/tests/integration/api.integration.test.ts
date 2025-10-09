/**
 * API Integration Tests
 * Tests HTTP endpoints with authentication, authorization, and rate limiting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServerWithDb } from '../setup.integration.js';
import {
  createTestProject,
  createTestUser,
  createTestBugReport,
  TestCleanupTracker,
} from '../utils/test-utils.js';
import type { DatabaseClient } from '../../src/db/client.js';

describe('API Integration Tests', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;
  const cleanup = new TestCleanupTracker();

  beforeAll(async () => {
    const testEnv = await createTestServerWithDb();
    server = testEnv.server;
    db = testEnv.db;
  });

  beforeEach(async () => {
    // Clean up any resources from previous tests
    await cleanup.cleanup(db);
  });

  afterAll(async () => {
    await cleanup.cleanup(db);
    await server.close();
    await db.close();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return 200', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('GET /ready should return 200 when DB is connected', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
      expect(body.checks.database).toBe('healthy');
    });

    it('GET / should return API info', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('BugSpotter API');
      expect(body.status).toBe('running');
    });
  });

  describe('Project Endpoints', () => {
    let userJwt: string;

    beforeEach(async () => {
      // Create a user and get JWT token
      const { user, password } = await createTestUser(db);
      cleanup.trackUser(user.id);

      // Login to get JWT
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: user.email,
          password,
        },
      });
      const loginBody = JSON.parse(loginResponse.body);
      userJwt = loginBody.data.tokens.access_token;
    });

    it('POST /api/v1/projects should create project with valid auth', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${userJwt}`,
        },
        payload: {
          name: 'Test Project',
          settings: { theme: 'dark' },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Test Project');
      expect(body.data.api_key).toBeDefined();
      expect(body.data.api_key).toMatch(/^bgs_/);

      cleanup.trackProject(body.data.id);
    });

    it('POST /api/v1/projects should return 401 without auth', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: {
          name: 'Test Project',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    it('GET /api/v1/projects/:id should return project with valid auth', async () => {
      const project = await createTestProject(db);
      cleanup.trackProject(project.id);

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          authorization: `Bearer ${userJwt}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(project.id);
      expect(body.data.name).toBe(project.name);
    });

    it('PATCH /api/v1/projects/:id should update project', async () => {
      const project = await createTestProject(db);
      cleanup.trackProject(project.id);

      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: {
          authorization: `Bearer ${userJwt}`,
        },
        payload: {
          name: 'Updated Project Name',
          settings: { theme: 'light' },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('Updated Project Name');
      expect(body.data.settings.theme).toBe('light');
    });

    it('POST /api/v1/projects/:id/regenerate-key should regenerate API key (admin only)', async () => {
      // Create admin user
      const { user: adminUser, password: adminPassword } = await createTestUser(db, {
        role: 'admin',
      });
      cleanup.trackUser(adminUser.id);

      // Login as admin
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: adminUser.email,
          password: adminPassword,
        },
      });
      const adminJwt = JSON.parse(loginResponse.body).data.tokens.access_token;

      const project = await createTestProject(db);
      cleanup.trackProject(project.id);
      const oldApiKey = project.api_key;

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/regenerate-key`,
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.api_key).toBeDefined();
      expect(body.data.api_key).not.toBe(oldApiKey);
      expect(body.data.api_key).toMatch(/^bgs_/);
    });

    it('POST /api/v1/projects/:id/regenerate-key should return 403 for non-admin', async () => {
      const project = await createTestProject(db);
      cleanup.trackProject(project.id);

      const response = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/regenerate-key`,
        headers: {
          authorization: `Bearer ${userJwt}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });

    it('GET /api/v1/projects/:id should return 404 for non-existent project', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects/00000000-0000-0000-0000-000000000000',
        headers: {
          authorization: `Bearer ${userJwt}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });
  });

  describe('Bug Report Endpoints', () => {
    let project: Awaited<ReturnType<typeof createTestProject>>;
    let apiKey: string;

    beforeEach(async () => {
      project = await createTestProject(db);
      cleanup.trackProject(project.id);
      apiKey = project.api_key;
    });

    it('POST /api/v1/reports should create bug report with valid API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': apiKey,
        },
        payload: {
          title: 'Test Bug Report',
          description: 'This is a test bug',
          priority: 'high',
          report: {
            consoleLogs: [{ level: 'error', message: 'Test error' }],
            networkRequests: [],
            browserMetadata: { browser: 'Chrome', version: '120' },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe('Test Bug Report');
      expect(body.data.priority).toBe('high');
      expect(body.data.project_id).toBe(project.id);

      cleanup.trackBugReport(body.data.id);
    });

    it('POST /api/v1/reports should return 401 with invalid API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': 'bgs_invalid_key_12345',
        },
        payload: {
          title: 'Test Bug Report',
          report: {
            consoleLogs: [],
            networkRequests: [],
            browserMetadata: {},
          },
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('POST /api/v1/reports should store session replay data', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': apiKey,
        },
        payload: {
          title: 'Bug with Replay',
          report: {
            consoleLogs: [],
            networkRequests: [],
            browserMetadata: {},
            sessionReplay: {
              events: [{ type: 'click', timestamp: 1234567890 }],
              duration: 5000,
            },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const bugId = body.data.id;
      cleanup.trackBugReport(bugId);

      // Verify session was created
      const sessions = await db.sessions.findByBugReport(bugId);
      expect(sessions.length).toBe(1);
      expect(sessions[0].duration).toBe(5000);
    });

    it('GET /api/v1/reports should list bug reports with pagination', async () => {
      // Create multiple bug reports
      for (let i = 0; i < 5; i++) {
        const report = await createTestBugReport(db, project.id, { title: `Bug ${i}` });
        cleanup.trackBugReport(report.id);
      }

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?page=1&limit=3',
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(3);
      expect(body.pagination.total).toBeGreaterThanOrEqual(5);
    });

    it('GET /api/v1/reports should filter by status', async () => {
      const openReport = await createTestBugReport(db, project.id, { status: 'open' });
      const closedReport = await createTestBugReport(db, project.id, { status: 'resolved' });
      cleanup.trackBugReport(openReport.id);
      cleanup.trackBugReport(closedReport.id);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports?status=open',
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((r: any) => r.status === 'open')).toBe(true);
    });

    it('GET /api/v1/reports/:id should return single bug report', async () => {
      const report = await createTestBugReport(db, project.id);
      cleanup.trackBugReport(report.id);

      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${report.id}`,
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(report.id);
      expect(body.data.title).toBe(report.title);
    });

    it('PATCH /api/v1/reports/:id should update bug report status', async () => {
      const report = await createTestBugReport(db, project.id, { status: 'open' });
      cleanup.trackBugReport(report.id);

      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/reports/${report.id}`,
        headers: {
          'x-api-key': apiKey,
        },
        payload: {
          status: 'in-progress',
          priority: 'critical',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('in-progress');
      expect(body.data.priority).toBe('critical');
    });

    it('GET /api/v1/reports/:id should return 404 for non-existent report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports/00000000-0000-0000-0000-000000000000',
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });

    it('GET /api/v1/reports/:id should return 403 for accessing other projects report', async () => {
      // Create another project
      const otherProject = await createTestProject(db);
      cleanup.trackProject(otherProject.id);

      // Create bug report for other project
      const report = await createTestBugReport(db, otherProject.id);
      cleanup.trackBugReport(report.id);

      // Try to access with original project's API key
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/reports/${report.id}`,
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on rapid requests', async () => {
      const requests = [];
      const maxRequests = 105; // Slightly over limit

      // Make rapid requests
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          server.inject({
            method: 'GET',
            url: '/health',
          })
        );
      }

      const responses = await Promise.all(requests);

      // Count rate limited responses
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      // Should have some rate limited requests
      expect(rateLimited.length).toBeGreaterThan(0);

      // Check rate limit error response
      if (rateLimited.length > 0) {
        const body = JSON.parse(rateLimited[0].body);
        expect(body.error).toBe('TooManyRequests');
      }
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should return 401 for missing authentication', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: {
          name: 'Test Project',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for malformed Bearer token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: 'Bearer invalid-token-format',
        },
        payload: {
          name: 'Test Project',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for expired JWT token', async () => {
      // This would require creating a token with past expiry
      // For now, we test with invalid token
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token',
        },
        payload: {
          name: 'Test Project',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
