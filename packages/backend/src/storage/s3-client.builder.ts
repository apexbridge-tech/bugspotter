/**
 * S3 Client Configuration Builder
 * Single Responsibility: Build and configure S3Client instances
 */

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import type { S3Config } from './types.js';
import { DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS } from './constants.js';

export class S3ClientBuilder {
  /**
   * Build S3Client from configuration
   * Handles credential chain and client settings
   */
  static build(config: S3Config): S3Client {
    const clientConfig: S3ClientConfig = {
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? false,
      maxAttempts: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      requestHandler: {
        requestTimeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
      },
    };

    // Only set credentials if provided (allows IAM role usage)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken, // Optional: for STS/assumed roles
      };
    }
    // If no credentials, SDK will use default credential chain:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. IAM role for EC2/ECS/Lambda

    return new S3Client(clientConfig);
  }

  /**
   * Check if config has explicit credentials
   */
  static hasCredentials(config: S3Config): boolean {
    return !!(config.accessKeyId && config.secretAccessKey);
  }
}
