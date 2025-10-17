/**
 * Setup Routes Tests
 * Tests for initial system setup and configuration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';
import { createDatabaseClient } from '../../src/db/client.js';
import type { DatabaseClient } from '../../src/db/client.js';
import { createMockPluginRegistry, createMockStorage } from '../test-helpers.js';

describe('Setup Routes', () => {
  let server: FastifyInstance;
  let db: DatabaseClient;

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
    // Clean up for fresh state
    await db.query('DELETE FROM system_config');
    await db.query('DELETE FROM users');
  });

  describe('GET /api/v1/setup/status', () => {
    it('should return requiresSetup: true when no admin users exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/setup/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.initialized).toBe(false);
      expect(json.data.requiresSetup).toBe(true);
    });

    it('should return requiresSetup: false when admin user exists', async () => {
      // Create an admin user
      await db.users.create({
        email: 'admin@example.com',
        password_hash: 'hashed',
        role: 'admin',
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/setup/status',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.initialized).toBe(true);
      expect(json.data.requiresSetup).toBe(false);
    });

    it('should be publicly accessible (no auth required)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/setup/status',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/setup/initialize', () => {
    it('should initialize system and create admin user', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'secure-password-123',
          instance_name: 'Test Instance',
          instance_url: 'https://test.bugspotter.dev',
          storage_type: 'minio',
          storage_endpoint: 'http://minio:9000',
          storage_access_key: 'minioadmin',
          storage_secret_key: 'minioadmin',
          storage_bucket: 'bugspotter-test',
          storage_region: 'us-east-1',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('admin@test.com');
      expect(json.data.user.role).toBe('admin');
      expect(json.data.access_token).toBeDefined();
      expect(json.data.token_type).toBe('Bearer');
      expect(json.data.expires_in).toBeGreaterThan(0);

      // Should NOT return refresh_token in body (security)
      expect(json.data.refresh_token).toBeUndefined();

      // Should NOT expose password hash
      expect(json.data.user.password_hash).toBeUndefined();
    });

    it('should set refresh_token as httpOnly cookie', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'secure-password-123',
          instance_name: 'Test Instance',
          instance_url: 'https://test.bugspotter.dev',
          storage_type: 'minio',
          storage_access_key: 'minioadmin',
          storage_secret_key: 'minioadmin',
          storage_bucket: 'bugspotter-test',
        },
      });

      expect(response.statusCode).toBe(200);

      // Check for httpOnly cookie
      const cookies = response.cookies;
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie?.httpOnly).toBe(true);
      expect(refreshCookie?.sameSite).toBe('Strict');
      expect(refreshCookie?.path).toBe('/');
      expect(refreshCookie?.maxAge).toBeGreaterThan(0);
    });

    it('should store system settings in database', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'secure-password-123',
          instance_name: 'My Instance',
          instance_url: 'https://bugspotter.example.com',
          storage_type: 's3',
          storage_access_key: 'AKIAIOSFODNN7EXAMPLE',
          storage_secret_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          storage_bucket: 'my-bugspotter-bucket',
          storage_region: 'us-west-2',
        },
      });

      // Verify settings stored in database
      const result = await db.query(
        "SELECT value FROM system_config WHERE key = 'system_settings'",
        []
      );

      expect(result.rows.length).toBe(1);
      const settings = result.rows[0].value;
      expect(settings.instance_name).toBe('My Instance');
      expect(settings.instance_url).toBe('https://bugspotter.example.com');
      expect(settings.storage_type).toBe('s3');
      expect(settings.storage_bucket).toBe('my-bugspotter-bucket');
    });

    it('should reject initialization if already initialized', async () => {
      // Create admin user to mark system as initialized
      await db.users.create({
        email: 'existing@test.com',
        password_hash: 'hashed',
        role: 'admin',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'secure-password-123',
          instance_name: 'Test Instance',
          instance_url: 'https://test.bugspotter.dev',
          storage_type: 'minio',
          storage_endpoint: 'http://minio:9000',
          storage_access_key: 'minioadmin',
          storage_secret_key: 'minioadmin',
          storage_bucket: 'test-bucket',
          storage_region: 'us-east-1',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('AlreadyInitialized');
    });

    it('should validate required admin credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: '',
          admin_password: '',
          storage_type: 'minio',
          storage_access_key: 'key',
          storage_secret_key: 'secret',
          storage_bucket: 'bucket',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
    });

    it('should validate required storage configuration', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'password123',
          storage_type: 'minio',
          storage_access_key: '',
          storage_secret_key: '',
          storage_bucket: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
    });

    it('should be publicly accessible (no auth required)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: 'password123',
          instance_name: 'Test',
          instance_url: 'http://localhost',
          storage_type: 'minio',
          storage_access_key: 'key',
          storage_secret_key: 'secret',
          storage_bucket: 'bucket',
        },
      });

      // Should not require authentication
      expect(response.statusCode).not.toBe(401);
    });

    it('should hash admin password before storing', async () => {
      const plainPassword = 'my-secure-password-123';

      await server.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: {
          admin_email: 'admin@test.com',
          admin_password: plainPassword,
          instance_name: 'Test',
          instance_url: 'http://localhost',
          storage_type: 'minio',
          storage_access_key: 'key',
          storage_secret_key: 'secret',
          storage_bucket: 'bucket',
        },
      });

      // Verify password is hashed
      const result = await db.query('SELECT password_hash FROM users WHERE email = $1', [
        'admin@test.com',
      ]);

      expect(result.rows.length).toBe(1);
      const passwordHash = result.rows[0].password_hash;

      // Should be hashed (bcrypt hash starts with $2b$)
      expect(passwordHash).toMatch(/^\$2[aby]\$/);
      // Should NOT be plain text
      expect(passwordHash).not.toBe(plainPassword);
    });
  });

  describe('POST /api/v1/setup/test-storage', () => {
    it('should test storage connection', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/test-storage',
        payload: {
          storage_type: 'minio',
          storage_endpoint: 'http://minio:9000',
          storage_access_key: 'minioadmin',
          storage_secret_key: 'minioadmin',
          storage_bucket: 'test-bucket',
          storage_region: 'us-east-1',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      // Will succeed or fail depending on actual storage availability
      expect(json.data.success).toBeDefined();
    });

    it('should return failure for invalid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/test-storage',
        payload: {
          storage_type: 'minio',
          storage_endpoint: 'http://invalid-host:9000',
          storage_access_key: 'invalid',
          storage_secret_key: 'invalid',
          storage_bucket: 'invalid',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.success).toBe(false);
      expect(json.data.error).toBeDefined();
    });

    it('should be publicly accessible (no auth required)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/setup/test-storage',
        payload: {
          storage_type: 'minio',
          storage_access_key: 'test',
          storage_secret_key: 'test',
          storage_bucket: 'test',
        },
      });

      // Should not require authentication
      expect(response.statusCode).not.toBe(401);
    });
  });
});
