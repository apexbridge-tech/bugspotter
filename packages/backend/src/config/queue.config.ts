/**
 * Queue Configuration
 * Centralized configuration for BullMQ job queues
 */

import { getLogger } from '../logger.js';

const logger = getLogger();

export interface QueueConfig {
  redis: {
    url: string;
    maxRetries: number;
    retryDelay: number;
  };
  workers: {
    screenshot: {
      enabled: boolean;
      concurrency: number;
    };
    replay: {
      enabled: boolean;
      concurrency: number;
    };
    integration: {
      enabled: boolean;
      concurrency: number;
    };
    notification: {
      enabled: boolean;
      concurrency: number;
    };
  };
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
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
    },
    workers: {
      screenshot: {
        enabled: process.env.WORKER_SCREENSHOT_ENABLED !== 'false',
        concurrency: parseInt(process.env.SCREENSHOT_CONCURRENCY || '5', 10),
      },
      replay: {
        enabled: process.env.WORKER_REPLAY_ENABLED !== 'false',
        concurrency: parseInt(process.env.REPLAY_CONCURRENCY || '3', 10),
      },
      integration: {
        enabled: process.env.WORKER_INTEGRATION_ENABLED !== 'false',
        concurrency: parseInt(process.env.INTEGRATION_CONCURRENCY || '10', 10),
      },
      notification: {
        enabled: process.env.WORKER_NOTIFICATION_ENABLED !== 'false',
        concurrency: parseInt(process.env.NOTIFICATION_CONCURRENCY || '5', 10),
      },
    },
    jobs: {
      retentionDays: parseInt(process.env.JOB_RETENTION_DAYS || '7', 10),
      maxRetries: parseInt(process.env.MAX_JOB_RETRIES || '3', 10),
      backoffDelay: parseInt(process.env.BACKOFF_DELAY || '5000', 10),
      timeout: parseInt(process.env.JOB_TIMEOUT || '300000', 10), // 5 minutes default
    },
    replay: {
      chunkDurationSeconds: parseInt(process.env.REPLAY_CHUNK_DURATION || '30', 10),
      maxReplaySizeMB: parseInt(process.env.MAX_REPLAY_SIZE_MB || '100', 10),
    },
    screenshot: {
      thumbnailWidth: parseInt(process.env.THUMBNAIL_WIDTH || '320', 10),
      thumbnailHeight: parseInt(process.env.THUMBNAIL_HEIGHT || '240', 10),
      quality: parseInt(process.env.SCREENSHOT_QUALITY || '85', 10),
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
 */
export function validateQueueConfig(config: QueueConfig): void {
  if (!config.redis.url) {
    throw new Error('REDIS_URL is required');
  }

  if (config.redis.maxRetries < 0) {
    throw new Error('REDIS_MAX_RETRIES must be >= 0');
  }

  if (config.jobs.maxRetries < 0) {
    throw new Error('MAX_JOB_RETRIES must be >= 0');
  }

  if (config.jobs.timeout < 1000) {
    throw new Error('JOB_TIMEOUT must be >= 1000ms');
  }

  if (config.replay.chunkDurationSeconds < 5) {
    throw new Error('REPLAY_CHUNK_DURATION must be >= 5 seconds');
  }

  if (config.screenshot.quality < 1 || config.screenshot.quality > 100) {
    throw new Error('SCREENSHOT_QUALITY must be between 1 and 100');
  }
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
