/**
 * S3ClientBuilder Tests
 * Unit tests for S3 client configuration
 */

import { describe, it, expect } from 'vitest';
import { S3ClientBuilder } from '../src/storage/s3-client.builder.js';
import type { S3Config } from '../src/storage/types.js';

describe('S3ClientBuilder', () => {
  describe('hasCredentials', () => {
    it('should return true when both credentials are provided', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      expect(S3ClientBuilder.hasCredentials(config)).toBe(true);
    });

    it('should return false when accessKeyId is missing', () => {
      const config: S3Config = {
        region: 'us-east-1',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      expect(S3ClientBuilder.hasCredentials(config)).toBe(false);
    });

    it('should return false when secretAccessKey is missing', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      expect(S3ClientBuilder.hasCredentials(config)).toBe(false);
    });

    it('should return false when both credentials are missing', () => {
      const config: S3Config = {
        region: 'us-east-1',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      expect(S3ClientBuilder.hasCredentials(config)).toBe(false);
    });

    it('should return false when credentials are empty strings', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: '',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      expect(S3ClientBuilder.hasCredentials(config)).toBe(false);
    });
  });

  describe('build', () => {
    it('should build S3 client with credentials', () => {
      const config: S3Config = {
        region: 'us-west-2',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
      // Region is configured correctly (it's an async function in SDK v3)
      expect(typeof client.config.region).toBe('function');
    });

    it('should build S3 client without credentials (IAM role)', () => {
      const config: S3Config = {
        region: 'us-east-1',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 30000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
    });

    it('should build S3 client with custom endpoint', () => {
      const config: S3Config = {
        endpoint: 'https://minio.example.com',
        region: 'us-east-1',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucket: 'test-bucket',
        forcePathStyle: true,
        maxRetries: 3,
        timeout: 30000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
    });

    it('should build S3 client with forcePathStyle', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'test-bucket',
        forcePathStyle: true,
        maxRetries: 3,
        timeout: 30000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
    });

    it('should build S3 client with max retries', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 5,
        timeout: 30000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
    });

    it('should build S3 client with custom timeout', () => {
      const config: S3Config = {
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        bucket: 'test-bucket',
        forcePathStyle: false,
        maxRetries: 3,
        timeout: 60000,
      };

      const client = S3ClientBuilder.build(config);

      expect(client).toBeDefined();
    });

    it('should build S3 client for different regions', () => {
      const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1', 'sa-east-1'];

      regions.forEach((region) => {
        const config: S3Config = {
          region,
          accessKeyId: 'test',
          secretAccessKey: 'test',
          bucket: 'test-bucket',
          forcePathStyle: false,
          maxRetries: 3,
          timeout: 30000,
        };

        const client = S3ClientBuilder.build(config);

        expect(client).toBeDefined();
      });
    });
  });
});
