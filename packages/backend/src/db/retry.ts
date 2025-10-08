/**
 * Retry utilities with configurable backoff strategies
 */

import { getLogger } from '../logger.js';

export interface RetryStrategy {
  calculateDelay(attempt: number, baseDelay: number): number;
}

/**
 * Exponential backoff: delay = baseDelay * 2^(attempt-1) + jitter
 */
export class ExponentialBackoffStrategy implements RetryStrategy {
  constructor(
    private maxDelay: number = 30000,
    private jitterFactor: number = 0.5
  ) {}

  calculateDelay(attempt: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * exponentialDelay * this.jitterFactor;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }
}

/**
 * Linear backoff: delay = baseDelay * attempt
 */
export class LinearBackoffStrategy implements RetryStrategy {
  constructor(private maxDelay: number = 30000) {}

  calculateDelay(attempt: number, baseDelay: number): number {
    return Math.min(baseDelay * attempt, this.maxDelay);
  }
}

/**
 * Fixed delay strategy - constant delay between retries
 */
export class FixedDelayStrategy implements RetryStrategy {
  calculateDelay(_attempt: number, baseDelay: number): number {
    return baseDelay;
  }
}

export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  strategy?: RetryStrategy;
}

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  strategy: new ExponentialBackoffStrategy(),
};

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const pgError = error as Error & { code?: string };

  // Node.js network error codes
  const nodeErrorCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
  ];

  if (pgError.code && nodeErrorCodes.includes(pgError.code)) {
    return true;
  }

  // PostgreSQL connection-related error codes
  const pgConnectionErrors = [
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
  ];

  if (pgError.code && pgConnectionErrors.includes(pgError.code)) {
    return true;
  }

  // Fallback to message checking (less reliable but covers edge cases)
  const errorMessage = error.message.toLowerCase();
  return (
    errorMessage.includes('connection terminated') ||
    errorMessage.includes('server closed the connection') ||
    errorMessage.includes('connection reset') ||
    errorMessage.includes('socket hang up')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
}

/**
 * Execute function with automatic retry on connection errors
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  attempt: number = 1
): Promise<T> {
  const { maxAttempts, baseDelay, strategy } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  try {
    return await fn();
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }

    if (isRetryableError(error)) {
      const delayMs = strategy.calculateDelay(attempt, baseDelay);

      getLogger().warn('Retryable error encountered, retrying', {
        attempt,
        maxAttempts,
        delayMs: Math.round(delayMs),
        error: error instanceof Error ? error.message : String(error),
      });

      await delay(delayMs);
      return executeWithRetry(fn, config, attempt + 1);
    }

    throw error;
  }
}

/**
 * Wrap a function with retry logic
 */
export function withRetry<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: RetryConfig = {}
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => {
    return executeWithRetry(() => {
      return fn(...args);
    }, config);
  };
}
