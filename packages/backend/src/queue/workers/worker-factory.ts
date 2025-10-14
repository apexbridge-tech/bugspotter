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
import type { QueueName } from '../types.js';
import { QUEUE_NAMES } from '../types.js';

const logger = getLogger();

/**
 * Map queue names (plural) to worker config keys (singular)
 * Queue names are used by BullMQ, config keys are internal naming
 */
const QUEUE_TO_WORKER_CONFIG: Record<
  QueueName,
  'screenshot' | 'replay' | 'integration' | 'notification'
> = {
  [QUEUE_NAMES.SCREENSHOTS]: 'screenshot',
  [QUEUE_NAMES.REPLAYS]: 'replay',
  [QUEUE_NAMES.INTEGRATIONS]: 'integration',
  [QUEUE_NAMES.NOTIFICATIONS]: 'notification',
};

/**
 * Worker creation options
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic defaults for flexible worker types
interface CreateWorkerOptions<D = any, R = any, N extends QueueName = QueueName> {
  /** Queue name (must match job name) */
  name: string;

  /** Job processor function */
  processor: (job: Job<D, R>) => Promise<R>;

  /** Redis connection */
  connection: Redis;

  /** Worker type for config lookup - uses QueueName type */
  workerType: N;

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
 *   workerType: QUEUE_NAMES.REPLAYS,
 * });
 * ```
 */
export function createWorker<D = any, R = any, N extends QueueName = QueueName>(
  options: CreateWorkerOptions<D, R, N>
): Worker<D, R, N> {
  const config = getQueueConfig();
  const workerConfigKey = QUEUE_TO_WORKER_CONFIG[options.workerType];
  const concurrency = config.workers[workerConfigKey].concurrency;

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
