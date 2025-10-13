/**
 * Base Worker Interface
 *
 * Defines the common contract that all worker wrappers must implement.
 * This ensures consistent API across different worker types and simplifies
 * the WorkerManager implementation.
 *
 * Workers can be:
 * - Factory-generated wrappers around BullMQ Worker instances (createScreenshotWorker, etc.)
 * - Custom implementations of the BaseWorker interface
 *
 * All workers must expose the underlying BullMQ Worker through getWorker()
 * for event handling and lifecycle management.
 */

import type { Worker } from 'bullmq';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Base interface that all worker wrappers must implement
 *
 * Encapsulates BullMQ Worker functionality (Facade pattern) so callers
 * don't need to know about the underlying implementation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic defaults for flexible worker types
export interface BaseWorker<DataType = any, ResultType = any, NameType extends string = string> {
  /**
   * Get the underlying BullMQ Worker instance
   * Used internally - prefer using the encapsulated methods instead
   */
  getWorker(): Worker<DataType, ResultType, NameType>;

  /**
   * Close the worker gracefully
   * Allows current jobs to complete before shutting down
   */
  close(): Promise<void>;

  /**
   * Pause the worker (stops processing new jobs)
   */
  pause(): Promise<void>;

  /**
   * Resume the worker (starts processing jobs again)
   */
  resume(): Promise<void>;

  /**
   * Register event handlers for job lifecycle events
   */
  on(event: 'completed', handler: (job: any) => void): void;
  on(event: 'failed', handler: (job: any, error: Error) => void): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Create a BaseWorker wrapper around a BullMQ Worker instance
 *
 * Eliminates duplication across factory workers by providing a standard wrapper
 * implementation. All factory-based workers should use this instead of
 * manually implementing the BaseWorker interface.
 *
 * @param worker - The underlying BullMQ Worker instance
 * @param workerName - Display name for logging (e.g., 'Replay', 'Integration')
 * @returns BaseWorker wrapper with all required methods
 */
export function createBaseWorkerWrapper<D = any, R = any, N extends string = string>(
  worker: Worker<D, R, N>,
  workerName: string
): BaseWorker<D, R, N> {
  return {
    getWorker: () => worker,
    close: async () => {
      await worker.close();
      logger.info(`${workerName} worker closed`);
    },
    pause: async () => await worker.pause(),
    resume: async () => await worker.resume(),
    on: (event: string, handler: (...args: any[]) => void) => {
      worker.on(event as any, handler as any);
    },
  };
}
