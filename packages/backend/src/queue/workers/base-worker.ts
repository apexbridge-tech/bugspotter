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

import type { Worker, Job } from 'bullmq';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Base interface that all worker wrappers must implement
 *
 * Encapsulates BullMQ Worker functionality (Facade pattern) so callers
 * don't need to know about the underlying implementation.
 */
export interface BaseWorker<
  DataType = unknown,
  ResultType = unknown,
  NameType extends string = string,
> {
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
  on(event: 'completed', handler: (job: Job<DataType, ResultType, NameType>) => void): void;
  on(
    event: 'failed',
    handler: (job: Job<DataType, ResultType, NameType>, error: Error) => void
  ): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
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
export function createBaseWorkerWrapper<D = unknown, R = unknown, N extends string = string>(
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
    on: ((event: string, handler: (...args: unknown[]) => void) => {
      // BullMQ Worker events are not strictly typed, so we need to cast
      // The overload signatures in BaseWorker provide type safety at call sites
      worker.on(event as keyof typeof worker.eventNames, handler as never);
    }) as BaseWorker<D, R, N>['on'],
  };
}
