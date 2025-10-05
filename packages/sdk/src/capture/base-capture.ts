import type { Sanitizer } from '../utils/sanitize';
import type { CaptureLifecycle } from './capture-lifecycle';

/**
 * Base options for all capture implementations
 */
export interface CaptureOptions {
  sanitizer?: Sanitizer;
}

/**
 * Base class for all capture implementations
 * Provides common functionality like error handling and sanitization
 */
export abstract class BaseCapture<TResult, TOptions extends CaptureOptions = CaptureOptions>
  implements CaptureLifecycle
{
  protected readonly sanitizer?: Sanitizer;
  protected readonly options: TOptions;

  constructor(options: TOptions) {
    this.options = options;
    this.sanitizer = options.sanitizer;
  }

  /**
   * Log an error that occurred during capture
   */
  protected handleError(context: string, error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`${this.constructor.name} ${context}:`, err);
  }

  /**
   * Perform the capture operation
   * Subclasses must implement this method
   */
  abstract capture(...args: unknown[]): TResult;

  /**
   * Clear captured data (optional, implement if needed)
   */
  clear?(): void;

  /**
   * Clean up resources (optional, implement if needed)
   */
  destroy?(): void;
}
