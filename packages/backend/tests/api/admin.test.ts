/**
 * Admin Routes Tests
 * Tests for admin-only endpoints (health, settings)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';
import { createDatabaseClient } from '../../src/db/client.js';
import type { DatabaseClient } from '../../src/db/client.js';
import { createMockPluginRegistry, createMockStorage } from '../test-helpers.js';

describe('Admin Routes', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;
  let adminToken: string;
  let userToken: string;

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
    // Clean up users table
    await db.query('DELETE FROM users');

    // Create admin user directly in database
    const admin = await db.users.create({
      email: 'admin@example.com',
      password_hash: 'hashed',
      role: 'admin',
    });

    // Create regular user directly in database
    const user = await db.users.create({
      email: 'user@example.com',
      password_hash: 'hashed',
      role: 'user',
    });

    // Generate JWT tokens manually
    adminToken = server.jwt.sign({ userId: admin.id, role: 'admin' }, { expiresIn: '1h' });
    userToken = server.jwt.sign({ userId: user.id, role: 'user' }, { expiresIn: '1h' });
  });

  describe('GET /api/v1/admin/health', () => {
    it('should return health status for admin', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/health',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBeDefined();
      expect(json.data.services).toBeDefined();
      expect(json.data.services.database).toBeDefined();
      expect(json.data.services.redis).toBeDefined();
      expect(json.data.services.storage).toBeDefined();
      expect(json.data.system).toBeDefined();
      expect(json.data.system.uptime).toBeGreaterThan(0);
    });

    it('should reject non-admin users', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/health',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/health',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should reject invalid tokens', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/health',
        headers: {
          authorization: 'Bearer invalid-token-12345',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/admin/settings', () => {
    it('should return settings for admin', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.instance_name).toBeDefined();
      expect(json.data.storage_type).toBeDefined();
      expect(json.data.retention_days).toBeGreaterThan(0);
      expect(json.data.jwt_access_expiry).toBeGreaterThan(0);
    });

    it('should reject non-admin users', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/admin/settings', () => {
    it('should update settings for admin', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instance_name: 'Updated BugSpotter',
          retention_days: 120,
          session_replay_enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.instance_name).toBe('Updated BugSpotter');
      expect(json.data.retention_days).toBe(120);
      expect(json.data.session_replay_enabled).toBe(false);
    });

    it('should persist settings across requests', async () => {
      // Update settings
      await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instance_name: 'Persistent Test',
        },
      });

      // Verify settings persisted
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.instance_name).toBe('Persistent Test');
    });

    it('should reject non-admin users', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          instance_name: 'Hacked',
        },
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        payload: {
          instance_name: 'Hacked',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid settings', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          instance_name: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should ignore read-only settings', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/admin/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          storage_type: 's3', // Read-only, should be ignored
          storage_bucket: 'new-bucket', // Read-only, should be ignored
          instance_name: 'Valid Update',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      // instance_name should update
      expect(json.data.instance_name).toBe('Valid Update');
      // storage settings should remain unchanged (from env)
      expect(json.data.storage_bucket).not.toBe('new-bucket');
    });
  });
});
