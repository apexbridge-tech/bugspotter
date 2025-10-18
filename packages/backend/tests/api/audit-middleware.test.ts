/**
 * Audit Middleware Tests
 * Tests for automatic audit logging and sanitization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';
import { createDatabaseClient } from '../../src/db/client.js';
import type { DatabaseClient } from '../../src/db/client.js';
import { createMockPluginRegistry, createMockStorage } from '../test-helpers.js';

describe('Audit Middleware', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;
  let testAccessToken: string;
  let testUserId: string;

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
    // Generate unique identifiers for test isolation
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    // Create test user and get JWT token
    const registerResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `audit-test-${timestamp}-${randomId}@example.com`,
        password: 'TestPassword123!',
        name: 'Audit Test User',
      },
    });

    const registerData = JSON.parse(registerResponse.body);
    testAccessToken = registerData.data.access_token;
    testUserId = registerData.data.user.id;
  });

  describe('Sensitive Data Sanitization', () => {
    it('should redact top-level sensitive fields', async () => {
      const timestamp = Date.now();

      // Create a project with sensitive data in body
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: `Audit Project ${timestamp}`,
          password: 'secret123', // Should be redacted
          api_key: 'custom_key_123', // Should be redacted
          token: 'bearer_token_xyz', // Should be redacted
        },
      });

      expect(response.statusCode).toBe(201);

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch recent audit logs for this user
      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const projectCreationLog = auditLogs.find((log) => log.resource === '/api/v1/projects');

      expect(projectCreationLog).toBeDefined();
      expect(projectCreationLog?.details).toBeDefined();

      const details = projectCreationLog?.details as { body: Record<string, unknown> };
      expect(details.body).toBeDefined();
      expect(details.body.name).toBe(`Audit Project ${timestamp}`);
      expect(details.body.password).toBe('[REDACTED]');
      expect(details.body.api_key).toBe('[REDACTED]');
      expect(details.body.token).toBe('[REDACTED]');
    });

    it('should redact nested sensitive fields in objects', async () => {
      const timestamp = Date.now();

      // Create a project with nested sensitive data
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: `Nested Audit Project ${timestamp}`,
          settings: {
            user: {
              name: 'John Doe',
              password: 'nested_secret', // Should be redacted
              access_token: 'nested_token_123', // Should be redacted
            },
            api: {
              secret: 'api_secret_key', // Should be redacted
            },
          },
        },
      });

      expect(response.statusCode).toBe(201);

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch recent audit logs
      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const projectCreationLog = auditLogs.find(
        (log) => log.resource === '/api/v1/projects' && log.action === 'POST'
      );

      expect(projectCreationLog).toBeDefined();

      const details = projectCreationLog?.details as {
        body: {
          settings: {
            user: Record<string, unknown>;
            api: Record<string, unknown>;
          };
        };
      };

      expect(details.body.settings.user.name).toBe('John Doe');
      expect(details.body.settings.user.password).toBe('[REDACTED]');
      expect(details.body.settings.user.access_token).toBe('[REDACTED]');
      expect(details.body.settings.api.secret).toBe('[REDACTED]');
    });

    it('should redact sensitive fields in arrays', async () => {
      const timestamp = Date.now();

      // Create project with array of sensitive data
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: `Array Audit Project ${timestamp}`,
          credentials: [
            { service: 'github', api_key: 'github_key_123' }, // Should be redacted
            { service: 'jira', token: 'jira_token_456' }, // Should be redacted
          ],
        },
      });

      expect(response.statusCode).toBe(201);

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch recent audit logs
      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const projectCreationLog = auditLogs.find(
        (log) => log.resource === '/api/v1/projects' && log.action === 'POST'
      );

      expect(projectCreationLog).toBeDefined();

      const details = projectCreationLog?.details as {
        body: {
          credentials: Array<{ service: string; api_key?: string; token?: string }>;
        };
      };

      expect(details.body.credentials).toHaveLength(2);
      expect(details.body.credentials[0].service).toBe('github');
      expect(details.body.credentials[0].api_key).toBe('[REDACTED]');
      expect(details.body.credentials[1].service).toBe('jira');
      expect(details.body.credentials[1].token).toBe('[REDACTED]');
    });

    it('should handle case-insensitive field matching', async () => {
      const timestamp = Date.now();

      // Create project with various password casings
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: `Case Test Project ${timestamp}`,
          Password: 'should_be_redacted_1', // Should be redacted
          PASSWORD: 'should_be_redacted_2', // Should be redacted
          pAsSwOrD: 'should_be_redacted_3', // Should be redacted
        },
      });

      expect(response.statusCode).toBe(201);

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch recent audit logs
      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const projectCreationLog = auditLogs.find(
        (log) => log.resource === '/api/v1/projects' && log.action === 'POST'
      );

      expect(projectCreationLog).toBeDefined();

      const details = projectCreationLog?.details as { body: Record<string, unknown> };

      expect(details.body.Password).toBe('[REDACTED]');
      expect(details.body.PASSWORD).toBe('[REDACTED]');
      expect(details.body.pAsSwOrD).toBe('[REDACTED]');
    });
  });

  describe('Audit Log Creation', () => {
    it('should create audit log for POST requests', async () => {
      const timestamp = Date.now();

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: `POST Test Project ${timestamp}`,
        },
      });

      expect(response.statusCode).toBe(201);

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const log = auditLogs.find((l) => l.action === 'POST' && l.resource === '/api/v1/projects');

      expect(log).toBeDefined();
      expect(log?.user_id).toBe(testUserId);
      expect(log?.success).toBe(true);
      expect(log?.action).toBe('POST');
    });

    it('should NOT create audit log for GET requests', async () => {
      // Get projects
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Wait for potential audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLogs = await db.auditLogs.findByUserId(testUserId, 10);
      const getLog = auditLogs.find((l) => l.action === 'GET');

      expect(getLog).toBeUndefined();
    });

    it('should NOT create audit log for public routes', async () => {
      // Login is a public route (excluded from audit)
      await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      // Wait for potential audit log creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLogs = await db.auditLogs.getRecent(50);
      const loginLog = auditLogs.find((l) => l.resource === '/api/v1/auth/login');

      expect(loginLog).toBeUndefined();
    });
  });
});
