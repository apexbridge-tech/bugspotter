/**
 * Worker Factory
 *
 * Provides standardized worker creation to eliminate duplication across
 * factory worker functions.
 *
 * Benefits:
 * - DRY: Single place for worker configuration
 * - Consistent worker setup across all types
 * - Easy to add global worker features (rate limiting, etc.)
 */

import { Worker, type Job, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { getLogger } from '../../logger.js';
import { getQueueConfig } from '../../config/queue.config.js';

const logger = getLogger();

/**
 * Worker creation options
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic defaults for flexible worker types
interface CreateWorkerOptions<D = any, R = any> {
  /** Queue name (must match job name) */
  name: string;

  /** Job processor function */
  processor: (job: Job<D, R>) => Promise<R>;

  /** Redis connection */
  connection: Redis;

  /** Worker type for config lookup */
  workerType: 'screenshot' | 'replay' | 'integration' | 'notification';

  /** Optional custom worker options (overrides defaults) */
  customOptions?: Partial<WorkerOptions>;
}

/**
 * Create a BullMQ Worker with standard configuration
 *
 * Eliminates repeated worker creation pattern across factory functions.
 * Automatically applies concurrency from queue config and any custom options.
 *
 * @example
 * ```typescript
 * const worker = createWorker({
 *   name: REPLAY_JOB_NAME,
 *   processor: async (job) => processReplayJob(job, db, storage),
 *   connection,
 *   workerType: 'replay',
 * });
 * ```
 */
export function createWorker<D = any, R = any, N extends string = string>(
  options: CreateWorkerOptions<D, R>
): Worker<D, R, N> {
  const config = getQueueConfig();
  const concurrency = config.workers[options.workerType].concurrency;

  const workerOptions: WorkerOptions = {
    connection: options.connection,
    concurrency,
    ...options.customOptions,
  };

  logger.debug('Creating worker', {
    name: options.name,
    type: options.workerType,
    concurrency,
  });

  return new Worker<D, R, N>(options.name, options.processor, workerOptions);
}
