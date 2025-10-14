/**
 * Queue Manager
 * Centralized management for BullMQ job queues
 */

import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { getLogger } from '../logger.js';
import { getQueueConfig } from '../config/queue.config.js';
import type {
  QueueName,
  JobOptions,
  JobStatus,
  JobState,
  QueueMetrics,
  QueueStats,
} from './types.js';

const logger = getLogger();

/**
 * Queue Names Registry - Single source of truth for all queues
 *
 * Adding a new queue:
 * 1. Add queue name to this array
 * 2. Define corresponding types in types.ts
 * 3. Update worker-manager if needed
 */
export const QUEUE_NAMES: readonly QueueName[] = [
  'screenshots',
  'replays',
  'integrations',
  'notifications',
] as const;

export class QueueManager {
  private connection: Redis;
  private queues: Map<QueueName, Queue>;
  private queueEvents: Map<QueueName, QueueEvents>;
  private isShuttingDown = false;
  private isInitialized = false;

  constructor() {
    const config = getQueueConfig();

    // Create Redis connection
    // Note: maxRetriesPerRequest must be null for BullMQ blocking commands
    this.connection = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > config.redis.maxRetries) {
          logger.error('Redis connection failed after max retries', { times });
          return null;
        }
        const delay = Math.min(times * config.redis.retryDelay, 5000);
        logger.warn('Retrying Redis connection', { attempt: times, delay });
        return delay;
      },
    });

    this.queues = new Map();
    this.queueEvents = new Map();

    // Handle connection events
    this.connection.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.connection.on('error', (error: Error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    this.connection.on('close', () => {
      if (!this.isShuttingDown) {
        logger.warn('Redis connection closed unexpectedly');
      }
    });
  }

  /**
   * Initialize all queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    for (const queueName of QUEUE_NAMES) {
      await this.createQueue(queueName);
    }

    this.isInitialized = true;

    logger.info('Queue manager initialized', {
      queues: Array.from(this.queues.keys()),
    });
  }

  /**
   * Create a queue and its event listeners
   */
  private async createQueue(queueName: QueueName): Promise<void> {
    const config = getQueueConfig();

    // Create queue
    const queue = new Queue(queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: config.jobs.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.jobs.backoffDelay,
        },
        removeOnComplete: {
          age: config.jobs.retentionDays * 24 * 60 * 60, // Convert days to seconds
          count: 1000,
        },
        removeOnFail: {
          age: config.jobs.retentionDays * 24 * 60 * 60,
          count: 5000,
        },
      },
    });

    // Create queue events listener
    const queueEvents = new QueueEvents(queueName, {
      connection: this.connection.duplicate(),
    });

    // Set up event listeners
    this.attachQueueEventHandlers(queueEvents, queueName);

    this.queues.set(queueName, queue);
    this.queueEvents.set(queueName, queueEvents);
  }

  /**
   * Attach standard event handlers to queue events
   * Extracted to eliminate duplication and improve maintainability
   */
  private attachQueueEventHandlers(queueEvents: QueueEvents, queueName: QueueName): void {
    queueEvents.on('completed', ({ jobId }) => {
      logger.debug('Job completed', { queue: queueName, jobId });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { queue: queueName, jobId, reason: failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { queue: queueName, jobId, progress: data });
    });
  }

  /**
   * Get queue or throw error if not found
   * Eliminates duplication across 6+ methods
   */
  private getQueueOrThrow(queueName: QueueName): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<TData>(
    queueName: QueueName,
    jobName: string,
    data: TData,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueueOrThrow(queueName);

    const job = await queue.add(jobName, data, options);

    logger.info('Job added to queue', {
      queue: queueName,
      jobId: job.id,
      jobName,
    });

    return job.id!;
  }

  /**
   * Get a job by ID
   */
  async getJob<TData = unknown, TResult = unknown>(
    queueName: QueueName,
    jobId: string
  ): Promise<JobStatus<TData, TResult> | null> {
    const queue = this.getQueueOrThrow(queueName);

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    // BullMQ's getState() already returns JobState | 'unknown', so no validation needed
    const state = (await job.getState()) as JobState;

    return {
      id: job.id!,
      name: job.name,
      data: job.data as TData,
      progress: job.progress as any,
      returnValue: job.returnvalue as TResult,
      failedReason: job.failedReason ?? null,
      stacktrace: job.stacktrace ?? null,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      state,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string): Promise<string | null> {
    const queue = this.getQueueOrThrow(queueName);

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return await job.getState();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const stats: QueueStats = {};

    for (const [queueName, queue] of this.queues.entries()) {
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();

      stats[queueName] = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: isPaused,
      };
    }

    return stats;
  }

  /**
   * Get metrics for a specific queue
   */
  async getQueueMetrics(queueName: QueueName): Promise<QueueMetrics> {
    const queue = this.getQueueOrThrow(queueName);

    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: isPaused,
    };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueOrThrow(queueName);

    await queue.pause();
    logger.info('Queue paused', { queue: queueName });
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueOrThrow(queueName);

    await queue.resume();
    logger.info('Queue resumed', { queue: queueName });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Queue manager shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting queue manager shutdown');

    try {
      // Close all queue event listeners
      for (const [queueName, queueEvents] of this.queueEvents.entries()) {
        await queueEvents.close();
        logger.debug('Queue events closed', { queue: queueName });
      }

      // Close all queues
      for (const [queueName, queue] of this.queues.entries()) {
        await queue.close();
        logger.debug('Queue closed', { queue: queueName });
      }

      // Close Redis connection (may already be closed during cleanup)
      if (this.connection.status === 'ready' || this.connection.status === 'connecting') {
        await this.connection.quit();
        logger.debug('Redis connection closed');
      } else {
        logger.debug('Redis connection already closed', { status: this.connection.status });
      }
    } catch (error) {
      logger.warn('Error during queue manager shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isInitialized = false;
      logger.info('Queue manager shutdown complete');
    }
  }

  /**
   * Health check - ping Redis
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.connection.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get Redis connection for workers
   */
  getConnection(): Redis {
    return this.connection;
  }
}

// Export singleton instance
let queueManagerInstance: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager();
  }
  return queueManagerInstance;
}
