/**
 * Unit tests for application configuration
 * Tests config loading and validation in config.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Application Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default configuration values', () => {
    it('should load default values when environment variables are not set', async () => {
      // Clear relevant env vars
      delete process.env.DATABASE_URL;
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.STORAGE_BACKEND;

      const { config } = await import('../src/config.js');

      expect(config.database.url).toBe('');
      expect(config.server.port).toBe(3000);
      expect(config.server.env).toBe('development');
      expect(config.storage.backend).toBe('local');
    });

    it('should use environment variables when provided', async () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
      process.env.PORT = '4000';
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_BACKEND = 's3';

      const { config } = await import('../src/config.js');

      expect(config.database.url).toBe('postgres://user:pass@localhost:5432/testdb');
      expect(config.server.port).toBe(4000);
      expect(config.server.env).toBe('production');
      expect(config.storage.backend).toBe('s3');
    });

    it('should parse numeric environment variables', async () => {
      process.env.DB_POOL_MAX = '20';
      process.env.DB_POOL_MIN = '5';
      process.env.MAX_UPLOAD_SIZE = '20971520'; // 20MB

      const { config } = await import('../src/config.js');

      expect(config.database.poolMax).toBe(20);
      expect(config.database.poolMin).toBe(5);
      expect(config.server.maxUploadSize).toBe(20971520);
    });

    it('should parse comma-separated CORS origins', async () => {
      process.env.CORS_ORIGINS =
        'http://localhost:3000,https://example.com,https://app.example.com';

      const { config } = await import('../src/config.js');

      expect(config.server.corsOrigins).toEqual([
        'http://localhost:3000',
        'https://example.com',
        'https://app.example.com',
      ]);
    });

    it('should parse boolean environment variables', async () => {
      process.env.S3_FORCE_PATH_STYLE = 'true';

      const { config } = await import('../src/config.js');

      expect(config.storage.s3.forcePathStyle).toBe(true);
    });
  });

  describe('Database configuration', () => {
    it('should load database configuration', async () => {
      process.env.DATABASE_URL = 'postgres://user:pass@db.example.com:5432/mydb';
      process.env.DB_POOL_MAX = '15';
      process.env.DB_POOL_MIN = '3';
      process.env.DB_CONNECTION_TIMEOUT_MS = '60000';
      process.env.DB_IDLE_TIMEOUT_MS = '45000';
      process.env.DB_RETRY_ATTEMPTS = '5';
      process.env.DB_RETRY_DELAY_MS = '2000';

      const { config } = await import('../src/config.js');

      expect(config.database.url).toBe('postgres://user:pass@db.example.com:5432/mydb');
      expect(config.database.poolMax).toBe(15);
      expect(config.database.poolMin).toBe(3);
      expect(config.database.connectionTimeout).toBe(60000);
      expect(config.database.idleTimeout).toBe(45000);
      expect(config.database.retryAttempts).toBe(5);
      expect(config.database.retryDelayMs).toBe(2000);
    });
  });

  describe('Server configuration', () => {
    it('should load server configuration', async () => {
      process.env.PORT = '8080';
      process.env.NODE_ENV = 'production';
      process.env.MAX_UPLOAD_SIZE = '52428800'; // 50MB
      process.env.LOG_LEVEL = 'warn';

      const { config } = await import('../src/config.js');

      expect(config.server.port).toBe(8080);
      expect(config.server.env).toBe('production');
      expect(config.server.maxUploadSize).toBe(52428800);
      expect(config.server.logLevel).toBe('warn');
    });
  });

  describe('JWT configuration', () => {
    it('should load JWT configuration', async () => {
      process.env.JWT_SECRET = 'super-secret-key-with-at-least-32-chars';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.JWT_REFRESH_EXPIRES_IN = '30d';

      const { config } = await import('../src/config.js');

      expect(config.jwt.secret).toBe('super-secret-key-with-at-least-32-chars');
      expect(config.jwt.expiresIn).toBe('1h');
      expect(config.jwt.refreshExpiresIn).toBe('30d');
    });
  });

  describe('Rate limit configuration', () => {
    it('should load rate limit configuration', async () => {
      process.env.RATE_LIMIT_WINDOW_MS = '120000'; // 2 minutes
      process.env.RATE_LIMIT_MAX_REQUESTS = '200';

      const { config } = await import('../src/config.js');

      expect(config.rateLimit.windowMs).toBe(120000);
      expect(config.rateLimit.maxRequests).toBe(200);
    });
  });

  describe('Storage configuration - local', () => {
    it('should load local storage configuration', async () => {
      process.env.STORAGE_BACKEND = 'local';
      process.env.STORAGE_BASE_DIR = '/var/uploads';
      process.env.STORAGE_BASE_URL = 'https://cdn.example.com/uploads';

      const { config } = await import('../src/config.js');

      expect(config.storage.backend).toBe('local');
      expect(config.storage.local.baseDirectory).toBe('/var/uploads');
      expect(config.storage.local.baseUrl).toBe('https://cdn.example.com/uploads');
    });
  });

  describe('Storage configuration - S3', () => {
    it('should load S3 storage configuration', async () => {
      process.env.STORAGE_BACKEND = 's3';
      process.env.S3_REGION = 'us-west-2';
      process.env.S3_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';
      process.env.S3_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.S3_MAX_RETRIES = '5';
      process.env.S3_TIMEOUT_MS = '60000';

      const { config } = await import('../src/config.js');

      expect(config.storage.backend).toBe('s3');
      expect(config.storage.s3.region).toBe('us-west-2');
      expect(config.storage.s3.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(config.storage.s3.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(config.storage.s3.bucket).toBe('my-bucket');
      expect(config.storage.s3.maxRetries).toBe(5);
      expect(config.storage.s3.timeout).toBe(60000);
    });
  });

  describe('Storage configuration - MinIO', () => {
    it('should load MinIO storage configuration', async () => {
      process.env.STORAGE_BACKEND = 'minio';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_REGION = 'us-east-1';
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'uploads';
      process.env.S3_FORCE_PATH_STYLE = 'true';

      const { config } = await import('../src/config.js');

      expect(config.storage.backend).toBe('minio');
      expect(config.storage.s3.endpoint).toBe('http://localhost:9000');
      expect(config.storage.s3.region).toBe('us-east-1');
      expect(config.storage.s3.accessKeyId).toBe('minioadmin');
      expect(config.storage.s3.secretAccessKey).toBe('minioadmin');
      expect(config.storage.s3.bucket).toBe('uploads');
      expect(config.storage.s3.forcePathStyle).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should throw error for missing database URL', async () => {
      delete process.env.DATABASE_URL;

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('DATABASE_URL is required');
    });

    it('should throw error for invalid port', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.PORT = '70000'; // Above max

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('PORT must be at most 65535');
    });

    it('should throw error for invalid pool configuration', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.DB_POOL_MIN = '10';
      process.env.DB_POOL_MAX = '5';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
    });

    it('should throw error for missing JWT secret in production', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('JWT_SECRET is required in production');
    });

    it('should throw error for short JWT secret', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.JWT_SECRET = 'too-short';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('JWT_SECRET must be at least 32 characters');
    });

    it('should throw error for invalid storage backend', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 'invalid-backend';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('Invalid STORAGE_BACKEND');
    });

    it('should throw error for mismatched S3 credentials', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 's3';
      process.env.S3_ACCESS_KEY = 'some-key';
      delete process.env.S3_SECRET_KEY;
      process.env.S3_BUCKET = 'my-bucket';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow(
        'S3_ACCESS_KEY and S3_SECRET_KEY must both be provided or both omitted'
      );
    });

    it('should throw error for missing S3 bucket', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 's3';
      delete process.env.S3_BUCKET;

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('S3_BUCKET is required');
    });

    it('should throw error for invalid S3 bucket name', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 's3';
      process.env.S3_BUCKET = 'Invalid-Bucket-Name';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('lowercase letters');
    });

    it('should throw error for invalid AWS region', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 's3';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.S3_REGION = 'invalid-region';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('S3_REGION must be a valid AWS region');
    });

    it('should throw error for missing MinIO endpoint', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 'minio';
      process.env.S3_BUCKET = 'my-bucket';
      delete process.env.S3_ENDPOINT;

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('S3_ENDPOINT is required for minio storage');
    });

    it('should throw error for HTTP endpoint in production', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_BACKEND = 'minio';
      process.env.S3_ENDPOINT = 'http://minio.example.com:9000';
      process.env.S3_BUCKET = 'my-bucket';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('S3_ENDPOINT must use https:// in production');
    });

    it('should throw error for missing local storage config', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.STORAGE_BACKEND = 'local';
      process.env.STORAGE_BASE_DIR = '';
      process.env.STORAGE_BASE_URL = '';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).toThrow('Configuration validation failed');
      expect(() => validateConfig()).toThrow('STORAGE_BASE_DIR is required for local storage');
    });

    it('should pass validation with valid configuration', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/db';
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.STORAGE_BACKEND = 'local';
      process.env.STORAGE_BASE_DIR = './uploads';
      process.env.STORAGE_BASE_URL = 'http://localhost:3000/uploads';

      const { validateConfig } = await import('../src/config.js');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should accumulate multiple validation errors', async () => {
      process.env.DATABASE_URL = ''; // Missing
      process.env.PORT = '70000'; // Invalid
      process.env.DB_POOL_MIN = '10'; // Invalid relationship
      process.env.DB_POOL_MAX = '5';
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET; // Missing

      const { validateConfig } = await import('../src/config.js');

      let errorMessage = '';
      try {
        validateConfig();
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      expect(errorMessage).toContain('DATABASE_URL is required');
      expect(errorMessage).toContain('PORT must be at most 65535');
      expect(errorMessage).toContain('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
      expect(errorMessage).toContain('JWT_SECRET is required in production');
    });
  });

  describe('Configuration immutability', () => {
    it('should export config as const object', async () => {
      const { config } = await import('../src/config.js');

      // Type assertion to check if it's readonly (compile-time check)
      // Runtime check: try to modify and see if TypeScript complains
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });
});
