/**
 * Queue Configuration
 * Centralized configuration for BullMQ job queues
 */

import { getLogger } from '../logger.js';
import { assertNonNegative, assertPositive, assertRange, assertMinimum } from './validators.js';

const logger = getLogger();

/**
 * Helper to parse integer from environment variable with default
 * Eliminates repeated parseInt pattern throughout config
 */
function getEnvInt(key: string, defaultValue: number): number {
  return parseInt(process.env[key] || String(defaultValue), 10);
}

/**
 * Helper to parse boolean from environment variable
 * Returns false only if explicitly set to 'false', otherwise uses defaultValue
 */
function getEnvBool(key: string, defaultValue: boolean = true): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value !== 'false';
}

/**
 * Worker name constants - single source of truth for worker types
 * Used across worker-manager, queue config, and worker implementations
 */
export const WORKER_NAMES = {
  SCREENSHOT: 'screenshot',
  REPLAY: 'replay',
  INTEGRATION: 'integration',
  NOTIFICATION: 'notification',
} as const;

/**
 * Worker names type - derived from constants
 */
export type WorkerName = (typeof WORKER_NAMES)[keyof typeof WORKER_NAMES];

/**
 * Worker configuration structure
 * Used by all worker types for consistent configuration
 */
export interface WorkerConfig {
  enabled: boolean;
  concurrency: number;
}

/**
 * Load worker configuration from environment
 * Eliminates duplication across 4 worker configs
 */
function loadWorkerConfig(workerName: WorkerName, defaultConcurrency: number): WorkerConfig {
  const upperName = workerName.toUpperCase();
  return {
    enabled: getEnvBool(`WORKER_${upperName}_ENABLED`),
    concurrency: getEnvInt(`WORKER_${upperName}_CONCURRENCY`, defaultConcurrency),
  };
}

export interface QueueConfig {
  redis: {
    url: string;
    maxRetries: number;
    retryDelay: number;
  };
  workers: Record<WorkerName, WorkerConfig>;
  jobs: {
    retentionDays: number;
    maxRetries: number;
    backoffDelay: number;
    timeout: number; // milliseconds
  };
  replay: {
    chunkDurationSeconds: number;
    maxReplaySizeMB: number;
  };
  screenshot: {
    thumbnailWidth: number;
    thumbnailHeight: number;
    quality: number;
  };
}

/**
 * Load queue configuration from environment variables
 */
export function loadQueueConfig(): QueueConfig {
  const config: QueueConfig = {
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: getEnvInt('REDIS_MAX_RETRIES', 3),
      retryDelay: getEnvInt('REDIS_RETRY_DELAY', 1000),
    },
    workers: {
      [WORKER_NAMES.SCREENSHOT]: loadWorkerConfig(WORKER_NAMES.SCREENSHOT, 5),
      [WORKER_NAMES.REPLAY]: loadWorkerConfig(WORKER_NAMES.REPLAY, 3),
      [WORKER_NAMES.INTEGRATION]: loadWorkerConfig(WORKER_NAMES.INTEGRATION, 10),
      [WORKER_NAMES.NOTIFICATION]: loadWorkerConfig(WORKER_NAMES.NOTIFICATION, 5),
    },
    jobs: {
      retentionDays: getEnvInt('JOB_RETENTION_DAYS', 7),
      maxRetries: getEnvInt('MAX_JOB_RETRIES', 3),
      backoffDelay: getEnvInt('BACKOFF_DELAY', 5000),
      timeout: getEnvInt('JOB_TIMEOUT', 300000), // 5 minutes default
    },
    replay: {
      chunkDurationSeconds: getEnvInt('REPLAY_CHUNK_DURATION', 30),
      maxReplaySizeMB: getEnvInt('MAX_REPLAY_SIZE_MB', 100),
    },
    screenshot: {
      thumbnailWidth: getEnvInt('THUMBNAIL_WIDTH', 320),
      thumbnailHeight: getEnvInt('THUMBNAIL_HEIGHT', 240),
      quality: getEnvInt('SCREENSHOT_QUALITY', 85),
    },
  };

  logger.info('Queue configuration loaded', {
    redisUrl: config.redis.url.replace(/\/\/[^@]+@/, '//*****@'), // Mask credentials
    workersEnabled: Object.entries(config.workers)
      .filter(([_, w]) => w.enabled)
      .map(([name]) => name),
  });

  return config;
}

/**
 * Validate queue configuration
 * Uses centralized validators from config/validators.ts
 */
export function validateQueueConfig(config: QueueConfig): void {
  // Redis configuration
  if (!config.redis.url) {
    throw new Error('REDIS_URL is required');
  }
  assertNonNegative(config.redis.maxRetries, 'REDIS_MAX_RETRIES');
  assertPositive(config.redis.retryDelay, 'REDIS_RETRY_DELAY');

  // Worker configuration
  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    assertRange(workerConfig.concurrency, `WORKER_${workerName.toUpperCase()}_CONCURRENCY`, 1, 100);
  }

  // Job configuration
  assertRange(config.jobs.retentionDays, 'JOB_RETENTION_DAYS', 1, 365);
  assertNonNegative(config.jobs.maxRetries, 'MAX_JOB_RETRIES');
  assertPositive(config.jobs.backoffDelay, 'BACKOFF_DELAY');
  assertMinimum(config.jobs.timeout, 'JOB_TIMEOUT', 1000);

  // Replay configuration
  assertMinimum(config.replay.chunkDurationSeconds, 'REPLAY_CHUNK_DURATION', 5);
  assertRange(config.replay.maxReplaySizeMB, 'MAX_REPLAY_SIZE_MB', 1, 1000);

  // Screenshot configuration
  assertPositive(config.screenshot.thumbnailWidth, 'THUMBNAIL_WIDTH');
  assertPositive(config.screenshot.thumbnailHeight, 'THUMBNAIL_HEIGHT');
  assertRange(config.screenshot.quality, 'SCREENSHOT_QUALITY', 1, 100);
}

// Export singleton instance
let queueConfigInstance: QueueConfig | null = null;

export function getQueueConfig(): QueueConfig {
  if (!queueConfigInstance) {
    queueConfigInstance = loadQueueConfig();
    validateQueueConfig(queueConfigInstance);
  }
  return queueConfigInstance;
}
