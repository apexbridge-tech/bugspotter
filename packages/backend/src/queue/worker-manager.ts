/**
 * Worker Manager
 * Orchestrates all job queue workers with health checks and graceful shutdown
 *
 * Features:
 * - Starts/stops workers based on configuration
 * - Health checks for each worker
 * - Metrics collection (jobs processed, failures, avg processing time)
 * - Graceful shutdown (completes current jobs)
 * - Worker-specific configuration
 *
 * Usage:
 * ```typescript
 * const workerManager = new WorkerManager(db, storage);
 * await workerManager.start();
 *
 * // Later...
 * await workerManager.shutdown();
 * ```
 */

import type { Worker } from 'bullmq';
import { getLogger } from '../logger.js';
import { DatabaseClient } from '../db/client.js';
import type { BaseStorageService } from '../storage/base-storage-service.js';
import { getQueueConfig } from '../config/queue.config.js';
import { getQueueManager } from './queue.manager.js';
import { ScreenshotWorker } from './workers/screenshot.worker.js';
import { createReplayWorker } from './workers/replay.worker.js';
import { createIntegrationWorker } from './workers/integration.worker.js';
import { createNotificationWorker } from './workers/notification.worker.js';

const logger = getLogger();

// Union type for all worker types
type AnyWorker = Worker | ScreenshotWorker;

export interface WorkerMetrics {
  workerName: string;
  isRunning: boolean;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTimeMs: number;
  lastProcessedAt: Date | null;
  lastError: string | null;
}

export interface WorkerManagerMetrics {
  totalWorkers: number;
  runningWorkers: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  workers: WorkerMetrics[];
  uptime: number; // milliseconds
}

/**
 * Worker Manager
 * Orchestrates all job queue workers
 */
export class WorkerManager {
  private workers: Map<string, AnyWorker>;
  private workerMetrics: Map<string, WorkerMetrics>;
  private db: DatabaseClient;
  private storage: BaseStorageService;
  private startTime: Date | null = null;
  private isShuttingDown = false;

  constructor(db: DatabaseClient, storage: BaseStorageService) {
    this.db = db;
    this.storage = storage;
    this.workers = new Map();
    this.workerMetrics = new Map();
  }

  /**
   * Start all enabled workers
   */
  async start(): Promise<void> {
    if (this.startTime) {
      throw new Error('WorkerManager already started');
    }

    const config = getQueueConfig();
    const queueManager = getQueueManager();

    // Initialize queue manager first
    await queueManager.initialize();

    this.startTime = new Date();

    logger.info('Starting WorkerManager', {
      enabledWorkers: Object.entries(config.workers)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name]) => name),
    });

    // Start screenshot worker
    if (config.workers.screenshot.enabled) {
      await this.startScreenshotWorker();
    }

    // Start replay worker
    if (config.workers.replay.enabled) {
      await this.startReplayWorker();
    }

    // Start integration worker
    if (config.workers.integration.enabled) {
      await this.startIntegrationWorker();
    }

    // Start notification worker
    if (config.workers.notification.enabled) {
      await this.startNotificationWorker();
    }

    logger.info('WorkerManager started successfully', {
      activeWorkers: this.workers.size,
    });
  }

  /**
   * Start screenshot worker
   */
  private async startScreenshotWorker(): Promise<void> {
    try {
      const queueManager = getQueueManager();
      const screenshotWorker = new ScreenshotWorker(
        this.db,
        this.storage,
        queueManager.getConnection()
      );

      this.workers.set('screenshot', screenshotWorker);
      this.initializeWorkerMetrics('screenshot');

      // Get the internal BullMQ worker for event tracking
      const worker = screenshotWorker.getWorker();

      // Track metrics
      worker.on('completed', (job: any) => {
        this.updateWorkerMetrics('screenshot', {
          jobsProcessed: 1,
          lastProcessedAt: new Date(),
        });
        logger.debug('Screenshot job completed', { jobId: job.id });
      });

      worker.on('failed', (job: any, error: Error) => {
        this.updateWorkerMetrics('screenshot', {
          jobsFailed: 1,
          lastError: error.message,
          lastProcessedAt: new Date(),
        });
        logger.error('Screenshot job failed', {
          jobId: job?.id,
          error: error.message,
        });
      });

      logger.info('Screenshot worker started');
    } catch (error) {
      logger.error('Failed to start screenshot worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start replay worker
   */
  private async startReplayWorker(): Promise<void> {
    try {
      const queueManager = getQueueManager();
      const worker = createReplayWorker(this.db, this.storage, queueManager.getConnection());

      this.workers.set('replay', worker);
      this.initializeWorkerMetrics('replay');

      // Track metrics
      worker.on('completed', (job: any) => {
        this.updateWorkerMetrics('replay', {
          jobsProcessed: 1,
          lastProcessedAt: new Date(),
        });
        logger.debug('Replay job completed', { jobId: job.id });
      });

      worker.on('failed', (job: any, error: Error) => {
        this.updateWorkerMetrics('replay', {
          jobsFailed: 1,
          lastError: error.message,
          lastProcessedAt: new Date(),
        });
        logger.error('Replay job failed', {
          jobId: job?.id,
          error: error.message,
        });
      });

      logger.info('Replay worker started');
    } catch (error) {
      logger.error('Failed to start replay worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start integration worker
   */
  private async startIntegrationWorker(): Promise<void> {
    try {
      const queueManager = getQueueManager();
      const worker = createIntegrationWorker(this.db, queueManager.getConnection());

      this.workers.set('integration', worker);
      this.initializeWorkerMetrics('integration');

      // Track metrics
      worker.on('completed', (job: any) => {
        this.updateWorkerMetrics('integration', {
          jobsProcessed: 1,
          lastProcessedAt: new Date(),
        });
        logger.debug('Integration job completed', { jobId: job.id });
      });

      worker.on('failed', (job: any, error: Error) => {
        this.updateWorkerMetrics('integration', {
          jobsFailed: 1,
          lastError: error.message,
          lastProcessedAt: new Date(),
        });
        logger.error('Integration job failed', {
          jobId: job?.id,
          error: error.message,
        });
      });

      logger.info('Integration worker started');
    } catch (error) {
      logger.error('Failed to start integration worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start notification worker
   */
  private async startNotificationWorker(): Promise<void> {
    try {
      const queueManager = getQueueManager();
      const worker = createNotificationWorker(this.db, queueManager.getConnection());

      this.workers.set('notification', worker);
      this.initializeWorkerMetrics('notification');

      // Track metrics
      worker.on('completed', (job: any) => {
        this.updateWorkerMetrics('notification', {
          jobsProcessed: 1,
          lastProcessedAt: new Date(),
        });
        logger.debug('Notification job completed', { jobId: job.id });
      });

      worker.on('failed', (job: any, error: Error) => {
        this.updateWorkerMetrics('notification', {
          jobsFailed: 1,
          lastError: error.message,
          lastProcessedAt: new Date(),
        });
        logger.error('Notification job failed', {
          jobId: job?.id,
          error: error.message,
        });
      });

      logger.info('Notification worker started');
    } catch (error) {
      logger.error('Failed to start notification worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize metrics for a worker
   */
  private initializeWorkerMetrics(workerName: string): void {
    this.workerMetrics.set(workerName, {
      workerName,
      isRunning: true,
      jobsProcessed: 0,
      jobsFailed: 0,
      avgProcessingTimeMs: 0,
      lastProcessedAt: null,
      lastError: null,
    });
  }

  /**
   * Update worker metrics
   */
  private updateWorkerMetrics(
    workerName: string,
    updates: Partial<Omit<WorkerMetrics, 'workerName' | 'isRunning'>>
  ): void {
    const metrics = this.workerMetrics.get(workerName);
    if (!metrics) {
      return;
    }

    if (updates.jobsProcessed) {
      metrics.jobsProcessed += updates.jobsProcessed;
    }
    if (updates.jobsFailed) {
      metrics.jobsFailed += updates.jobsFailed;
    }
    if (updates.lastProcessedAt) {
      metrics.lastProcessedAt = updates.lastProcessedAt;
    }
    if (updates.lastError !== undefined) {
      metrics.lastError = updates.lastError;
    }
    if (updates.avgProcessingTimeMs !== undefined) {
      // Simple moving average
      metrics.avgProcessingTimeMs = (metrics.avgProcessingTimeMs + updates.avgProcessingTimeMs) / 2;
    }
  }

  /**
   * Get metrics for all workers
   */
  getMetrics(): WorkerManagerMetrics {
    const workers = Array.from(this.workerMetrics.values());
    const totalJobsProcessed = workers.reduce((sum, w) => sum + w.jobsProcessed, 0);
    const totalJobsFailed = workers.reduce((sum, w) => sum + w.jobsFailed, 0);
    const runningWorkers = workers.filter((w) => w.isRunning).length;

    return {
      totalWorkers: this.workers.size,
      runningWorkers,
      totalJobsProcessed,
      totalJobsFailed,
      workers,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
    };
  }

  /**
   * Get metrics for a specific worker
   */
  getWorkerMetrics(workerName: string): WorkerMetrics | null {
    return this.workerMetrics.get(workerName) || null;
  }

  /**
   * Health check for all workers
   */
  async healthCheck(): Promise<{ healthy: boolean; workers: Record<string, boolean> }> {
    const workerHealth: Record<string, boolean> = {};

    for (const [name] of this.workers.entries()) {
      try {
        // Check if worker is running (has not closed)
        const metrics = this.workerMetrics.get(name);
        workerHealth[name] = metrics?.isRunning ?? false;
      } catch (error) {
        workerHealth[name] = false;
        logger.error(`Health check failed for ${name} worker`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const healthy = Object.values(workerHealth).every((h) => h);

    return { healthy, workers: workerHealth };
  }

  /**
   * Pause a specific worker
   */
  async pauseWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not found`);
    }

    // Handle ScreenshotWorker wrapper
    if (worker instanceof ScreenshotWorker) {
      await worker.getWorker().pause();
    } else {
      await worker.pause();
    }

    const metrics = this.workerMetrics.get(workerName);
    if (metrics) {
      metrics.isRunning = false;
    }

    logger.info(`Worker ${workerName} paused`);
  }

  /**
   * Resume a specific worker
   */
  async resumeWorker(workerName: string): Promise<void> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not found`);
    }

    // Handle ScreenshotWorker wrapper
    if (worker instanceof ScreenshotWorker) {
      await worker.getWorker().resume();
    } else {
      await worker.resume();
    }

    const metrics = this.workerMetrics.get(workerName);
    if (metrics) {
      metrics.isRunning = true;
    }

    logger.info(`Worker ${workerName} resumed`);
  }

  /**
   * Graceful shutdown - completes current jobs before stopping
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('WorkerManager shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    logger.info('Starting WorkerManager graceful shutdown', {
      activeWorkers: this.workers.size,
    });

    // Close all workers (they will complete current jobs)
    const shutdownPromises: Promise<void>[] = [];

    for (const [name, workerInstance] of this.workers.entries()) {
      logger.info(`Shutting down ${name} worker`);

      // Get the actual BullMQ worker (handle ScreenshotWorker wrapper)
      const worker =
        workerInstance instanceof ScreenshotWorker ? workerInstance.getWorker() : workerInstance;

      shutdownPromises.push(
        worker
          .close()
          .then(() => {
            logger.info(`${name} worker closed successfully`);
            const metrics = this.workerMetrics.get(name);
            if (metrics) {
              metrics.isRunning = false;
            }
          })
          .catch((error: unknown) => {
            logger.error(`Failed to close ${name} worker`, {
              error: error instanceof Error ? error.message : String(error),
            });
          })
      );
    }

    await Promise.allSettled(shutdownPromises);

    // Clear workers
    this.workers.clear();

    // Shutdown queue manager
    const queueManager = getQueueManager();
    await queueManager.shutdown();

    logger.info('WorkerManager shutdown complete');
  }
}

/**
 * Singleton instance
 */
let workerManagerInstance: WorkerManager | null = null;

/**
 * Create and return singleton WorkerManager instance
 */
export function createWorkerManager(
  db: DatabaseClient,
  storage: BaseStorageService
): WorkerManager {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager(db, storage);
  }
  return workerManagerInstance;
}

/**
 * Get existing WorkerManager instance
 */
export function getWorkerManager(): WorkerManager {
  if (!workerManagerInstance) {
    throw new Error('WorkerManager not initialized. Call createWorkerManager() first.');
  }
  return workerManagerInstance;
}
