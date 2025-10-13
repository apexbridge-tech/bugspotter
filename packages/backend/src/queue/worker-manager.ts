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

import { getLogger } from '../logger.js';
import type { Redis } from 'ioredis';
import { DatabaseClient } from '../db/client.js';
import type { BaseStorageService } from '../storage/base-storage-service.js';
import { getQueueConfig } from '../config/queue.config.js';
import { getQueueManager } from './queue-manager.js';
import { createScreenshotWorker } from './workers/screenshot-worker.js';
import { createReplayWorker } from './workers/replay-worker.js';
import { createIntegrationWorker } from './workers/integration-worker.js';
import { createNotificationWorker } from './workers/notification-worker.js';
import type { BaseWorker } from './workers/base-worker.js';

const logger = getLogger();

/**
 * Worker factory function type
 * Accepts db, storage (optional), and connection parameters
 */
type WorkerFactory = (
  db: DatabaseClient,
  storage: BaseStorageService,
  connection: Redis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BaseWorker needs generic flexibility for different job types
) => BaseWorker<any, any, any>;

/**
 * Worker configuration for registry
 */
interface WorkerConfig {
  name: string;
  factory: WorkerFactory;
  needsStorage: boolean; // Whether factory requires storage parameter
}

/**
 * Worker Registry - Single source of truth for all workers
 *
 * Adding a new worker:
 * 1. Create worker factory function (e.g., createMyWorker)
 * 2. Add entry to this registry
 * 3. Add config in queue.config.ts
 *
 * No code changes needed in start() method or elsewhere!
 */
const WORKER_REGISTRY: WorkerConfig[] = [
  { name: 'screenshot', factory: createScreenshotWorker, needsStorage: true },
  { name: 'replay', factory: createReplayWorker, needsStorage: true },
  {
    name: 'integration',
    factory: createIntegrationWorker as WorkerFactory,
    needsStorage: false,
  },
  {
    name: 'notification',
    factory: createNotificationWorker as WorkerFactory,
    needsStorage: false,
  },
];

export interface WorkerMetrics {
  workerName: string;
  isRunning: boolean;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTimeMs: number;
  totalProcessingTimeMs: number; // Cumulative processing time for accurate average
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
  private workers: Map<string, BaseWorker<any, any, any>>;
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

    // Start all enabled workers from registry
    for (const workerConfig of WORKER_REGISTRY) {
      const workerSettings = (config.workers as any)[workerConfig.name];
      if (workerSettings?.enabled) {
        await this.startWorker(workerConfig);
      }
    }

    logger.info('WorkerManager started successfully', {
      activeWorkers: this.workers.size,
    });
  }

  /**
   * Generic worker startup - handles all workers uniformly
   * Eliminates 160+ lines of duplication across 4 specific worker methods
   */
  private async startWorker(workerConfig: WorkerConfig): Promise<void> {
    const { name, factory, needsStorage } = workerConfig;

    try {
      logger.info(`Starting ${name} worker`);
      const queueManager = getQueueManager();

      // Call factory with appropriate parameters
      // If worker doesn't need storage, pass undefined (will be ignored)
      const worker = factory(
        this.db,
        needsStorage ? this.storage : (undefined as any),
        queueManager.getConnection()
      );

      this.workers.set(name, worker);
      this.initializeWorkerMetrics(name);

      // Attach standard event handlers for metrics tracking
      this.attachWorkerEventHandlers(worker, name);

      logger.info(`${name.charAt(0).toUpperCase() + name.slice(1)} worker started`);
    } catch (error) {
      logger.error(`Failed to start ${name} worker`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Attach event handlers to track worker metrics
   * Extracted from duplicated code in all worker startup methods
   */
  private attachWorkerEventHandlers(worker: BaseWorker<any, any, any>, workerName: string): void {
    // Track successful completions
    worker.on('completed', (job: any) => {
      this.updateWorkerMetrics(workerName, {
        jobsProcessed: 1,
        lastProcessedAt: new Date(),
      });
      logger.debug(`${workerName.charAt(0).toUpperCase() + workerName.slice(1)} job completed`, {
        jobId: job.id,
      });
    });

    // Track failures
    worker.on('failed', (job: any, error: Error) => {
      this.updateWorkerMetrics(workerName, {
        jobsFailed: 1,
        lastError: error.message,
        lastProcessedAt: new Date(),
      });
      logger.error(`${workerName.charAt(0).toUpperCase() + workerName.slice(1)} job failed`, {
        jobId: job?.id,
        error: error.message,
      });
    });
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
      totalProcessingTimeMs: 0,
      lastProcessedAt: null,
      lastError: null,
    });
  }

  /**
   * Helper: Calculate true average processing time
   * Uses cumulative total divided by job count for accuracy
   */
  private calculateTrueAverage(
    totalProcessingTimeMs: number,
    processingTimeMs: number,
    jobsProcessed: number
  ): { avgProcessingTimeMs: number; totalProcessingTimeMs: number } {
    const newTotal = totalProcessingTimeMs + processingTimeMs;
    const newAvg = jobsProcessed > 0 ? newTotal / jobsProcessed : 0;
    return {
      avgProcessingTimeMs: newAvg,
      totalProcessingTimeMs: newTotal,
    };
  }

  /**
   * Update worker metrics
   * Uses helper functions to reduce duplication and improve maintainability
   */
  private updateWorkerMetrics(
    workerName: string,
    updates: Partial<
      Omit<
        WorkerMetrics,
        'workerName' | 'isRunning' | 'avgProcessingTimeMs' | 'totalProcessingTimeMs'
      >
    > & {
      processingTimeMs?: number; // Single job processing time (for true average calculation)
    }
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

    // Update error (can be null to clear)
    if (updates.lastError !== undefined) {
      metrics.lastError = updates.lastError;
    }

    // Calculate true average if processing time provided
    if (updates.processingTimeMs !== undefined) {
      const { avgProcessingTimeMs, totalProcessingTimeMs } = this.calculateTrueAverage(
        metrics.totalProcessingTimeMs,
        updates.processingTimeMs,
        metrics.jobsProcessed
      );
      metrics.avgProcessingTimeMs = avgProcessingTimeMs;
      metrics.totalProcessingTimeMs = totalProcessingTimeMs;
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

    await worker.pause();

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

    await worker.resume();

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

      // All workers now implement BaseWorker interface with close() method
      shutdownPromises.push(
        workerInstance
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
