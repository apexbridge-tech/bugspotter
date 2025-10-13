/**
 * Queue Manager
 * Centralized management for BullMQ job queues
 */

import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { getLogger } from '../logger.js';
import { getQueueConfig } from '../config/queue.config.js';
import type { QueueName, JobOptions, JobStatus, QueueMetrics, QueueStats } from './types.js';

const logger = getLogger();

export class QueueManager {
  private connection: Redis;
  private queues: Map<QueueName, Queue>;
  private queueEvents: Map<QueueName, QueueEvents>;
  private isShuttingDown = false;

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
    const queueNames: QueueName[] = ['screenshots', 'replays', 'integrations', 'notifications'];

    for (const queueName of queueNames) {
      await this.createQueue(queueName);
    }

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
    queueEvents.on('completed', ({ jobId }) => {
      logger.debug('Job completed', { queue: queueName, jobId });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { queue: queueName, jobId, reason: failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { queue: queueName, jobId, progress: data });
    });

    this.queues.set(queueName, queue);
    this.queueEvents.set(queueName, queueEvents);
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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const validStates = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;
    const jobState = validStates.includes(state as any)
      ? (state as (typeof validStates)[number])
      : 'waiting';

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
      state: jobState,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string): Promise<string | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info('Queue paused', { queue: queueName });
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info('Queue resumed', { queue: queueName });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('Starting queue manager shutdown');

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

    // Close Redis connection
    await this.connection.quit();
    logger.info('Queue manager shutdown complete');
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
