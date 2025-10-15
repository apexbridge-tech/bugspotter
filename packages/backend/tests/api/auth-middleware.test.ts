/**
 * Authentication Middleware Tests
 * Tests for API key and JWT authentication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';
import { createDatabaseClient } from '../../src/db/client.js';
import type { DatabaseClient } from '../../src/db/client.js';
import { createMockPluginRegistry, createMockStorage } from '../test-helpers.js';

describe('Authentication Middleware', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;
  let testApiKey: string;
  let testAccessToken: string;

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

    // Create test project with unique API key
    const project = await db.projects.create({
      name: `Test Project ${timestamp}`,
      api_key: `bgs_test_${timestamp}_${randomId}`,
      settings: {},
    });
    testApiKey = project.api_key;

    // Create test user with unique email and get JWT token
    const registerResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `auth-test-${timestamp}@example.com`,
        password: 'password123',
      },
    });
    testAccessToken = registerResponse.json().data.tokens.access_token;
  });

  describe('Public Routes', () => {
    it('should allow access to /health without auth', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access to /ready without auth', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow access to /api/v1/auth/login without auth', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      // Route should be accessible (not blocked by auth middleware)
      // 401 from route handler (invalid credentials) is acceptable
      // Only auth middleware returns "Authentication required" message
      const json = response.json();
      expect(response.statusCode).toBe(401);
      expect(json.message).toBe('Invalid email or password');
      expect(json.error).toBe('Unauthorized');
    });

    it('should allow access to /api/v1/auth/register without auth', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'new@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key', async () => {
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

      // Should not get 401
      expect(response.statusCode).not.toBe(401);
    });

    it('should reject invalid API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': 'invalid_key',
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

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.error).toBe('Unauthorized');
      expect(json.message).toContain('Invalid API key');
    });
  });

  describe('JWT Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: 'New Project',
          settings: {},
        },
      });

      // Should not get 401
      expect(response.statusCode).not.toBe(401);
    });

    it('should reject invalid JWT token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: 'Bearer invalid_token',
        },
        payload: {
          name: 'New Project',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should reject malformed authorization header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: 'InvalidFormat',
        },
        payload: {
          name: 'New Project',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Protected Routes', () => {
    it('should require authentication for /api/v1/projects', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: {
          name: 'New Project',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.message).toContain('Authentication required');
    });

    it('should require authentication for /api/v1/reports without API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Request Context', () => {
    it('should set authProject on request with API key', async () => {
      // This is tested indirectly through the endpoint behavior
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/reports',
        headers: {
          'x-api-key': testApiKey,
        },
      });

      // Should filter by the authenticated project
      expect(response.statusCode).toBe(200);
    });

    it('should set authUser on request with JWT', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${testAccessToken}`,
        },
        payload: {
          name: 'User Project',
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});
