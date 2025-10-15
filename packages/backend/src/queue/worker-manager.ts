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
import type { BugReportRepository } from '../db/repositories.js';
import type { IStorageService } from '../storage/types.js';
import { getQueueConfig, WORKER_NAMES, type WorkerName } from '../config/queue.config.js';
import { getQueueManager } from './queue-manager.js';
import { createScreenshotWorker } from './workers/screenshot-worker.js';
import { createReplayWorker } from './workers/replay-worker.js';
import { createIntegrationWorker } from './workers/integration-worker.js';
import { createNotificationWorker } from './workers/notification-worker.js';
import type { BaseWorker } from './workers/base-worker.js';
import type { PluginRegistry } from '../integrations/plugin-registry.js';

const logger = getLogger();

/** Base worker type with erased generics for heterogeneous storage */
type AnyWorker = BaseWorker<unknown, unknown, string>;

/** Factory function for creating workers (uses unknown for generic parameter types) */
type WorkerFactory = (bugReportRepo: unknown, storage: unknown, connection: Redis) => AnyWorker;

/** Worker configuration (factory is null for integration workers with special instantiation) */
interface WorkerConfig {
  name: WorkerName;
  factory: WorkerFactory | null;
  needsStorage: boolean;
}

/**
 * Worker Registry - single source of truth
 * Type casts required: BaseWorker processFn has contravariant Job<D,R,N> parameter
 * Safe because WorkerManager only calls start/stop/pause/resume, never processFn
 */
const WORKER_REGISTRY: WorkerConfig[] = [
  {
    name: WORKER_NAMES.SCREENSHOT,
    factory: createScreenshotWorker as WorkerFactory,
    needsStorage: true,
  },
  { name: WORKER_NAMES.REPLAY, factory: createReplayWorker as WorkerFactory, needsStorage: true },
  {
    name: WORKER_NAMES.NOTIFICATION,
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
  totalProcessingTimeMs: number;
  lastProcessedAt: Date | null;
  lastError: string | null;
}

export interface WorkerManagerMetrics {
  totalWorkers: number;
  runningWorkers: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  workers: WorkerMetrics[];
  uptime: number;
}

export class WorkerManager {
  private workers: Map<string, AnyWorker>;
  private workerMetrics: Map<string, WorkerMetrics>;
  private bugReportRepo: BugReportRepository;
  private storage: IStorageService;
  private pluginRegistry: PluginRegistry | null;
  private startTime: Date | null = null;
  private isShuttingDown = false;

  constructor(
    bugReportRepo: BugReportRepository,
    storage: IStorageService,
    pluginRegistry?: PluginRegistry
  ) {
    this.bugReportRepo = bugReportRepo;
    this.storage = storage;
    this.pluginRegistry = pluginRegistry || null;
    this.workers = new Map();
    this.workerMetrics = new Map();
  }

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

    for (const workerConfig of WORKER_REGISTRY) {
      const workerSettings = (config.workers as Record<string, { enabled: boolean }>)[
        workerConfig.name
      ];
      if (workerSettings?.enabled) {
        await this.startWorker(workerConfig);
      }
    }

    if (config.workers.integration?.enabled) {
      await this.startWorker({
        name: WORKER_NAMES.INTEGRATION,
        factory: null,
        needsStorage: false,
      });
    }

    logger.info('WorkerManager started successfully', {
      activeWorkers: this.workers.size,
    });
  }

  private async createWorkerInstance(
    name: WorkerName,
    factory: WorkerFactory | null,
    needsStorage: boolean,
    connection: Redis
  ): Promise<AnyWorker> {
    if (name === WORKER_NAMES.INTEGRATION) {
      if (!this.pluginRegistry) {
        throw new Error('PluginRegistry required for integration worker but not provided');
      }
      return createIntegrationWorker(
        this.pluginRegistry,
        this.bugReportRepo,
        connection
      ) as AnyWorker;
    }

    if (!factory) {
      throw new Error(`No factory provided for ${name} worker`);
    }

    return await factory(
      this.bugReportRepo as unknown,
      needsStorage ? (this.storage as unknown) : undefined,
      connection
    );
  }

  private async startWorker(workerConfig: WorkerConfig): Promise<void> {
    const { name, factory, needsStorage } = workerConfig;

    try {
      logger.info(`Starting ${name} worker`);
      const queueManager = getQueueManager();
      const connection = queueManager.getConnection();

      const worker = await this.createWorkerInstance(name, factory, needsStorage, connection);

      this.workers.set(name, worker);
      this.initializeWorkerMetrics(name);
      this.attachWorkerEventHandlers(worker, name);

      logger.info(`${this.capitalize(name)} worker started`);
    } catch (error) {
      logger.error(`Failed to start ${name} worker`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private attachWorkerEventHandlers(worker: AnyWorker, workerName: string): void {
    const capitalizedName = this.capitalize(workerName);

    worker.on('completed', (job: unknown) => {
      this.updateWorkerMetrics(workerName, {
        jobsProcessed: 1,
        lastProcessedAt: new Date(),
      });
      const jobId = (job as { id?: string }).id;
      logger.debug(`${capitalizedName} job completed`, { jobId });
    });

    worker.on('failed', (job: unknown, error: Error) => {
      this.updateWorkerMetrics(workerName, {
        jobsFailed: 1,
        lastError: error.message,
        lastProcessedAt: new Date(),
      });
      const jobId = (job as { id?: string } | undefined)?.id;
      logger.error(`${capitalizedName} job failed`, {
        jobId,
        error: error.message,
      });
    });
  }

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

    if (updates.lastError !== undefined) {
      metrics.lastError = updates.lastError;
    }

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

  getWorkerMetrics(workerName: string): WorkerMetrics | null {
    return this.workerMetrics.get(workerName) || null;
  }

  async healthCheck(): Promise<{ healthy: boolean; workers: Record<string, boolean> }> {
    const workerHealth: Record<string, boolean> = {};

    for (const [name] of this.workers.entries()) {
      try {
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

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('WorkerManager shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    logger.info('Starting WorkerManager graceful shutdown', {
      activeWorkers: this.workers.size,
    });

    const shutdownPromises: Promise<void>[] = [];

    for (const [name, workerInstance] of this.workers.entries()) {
      logger.info(`Shutting down ${name} worker`);

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

    this.workers.clear();

    const queueManager = getQueueManager();
    await queueManager.shutdown();

    logger.info('WorkerManager shutdown complete');
  }
}

let workerManagerInstance: WorkerManager | null = null;

export function createWorkerManager(
  bugReportRepo: BugReportRepository,
  storage: IStorageService,
  pluginRegistry?: PluginRegistry
): WorkerManager {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager(bugReportRepo, storage, pluginRegistry);
  }
  return workerManagerInstance;
}

export function getWorkerManager(): WorkerManager {
  if (!workerManagerInstance) {
    throw new Error('WorkerManager not initialized. Call createWorkerManager() first.');
  }
  return workerManagerInstance;
}
