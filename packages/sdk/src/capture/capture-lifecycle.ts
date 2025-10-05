/**
 * Interface defining the lifecycle methods for capture classes.
 * Provides a consistent API for managing capture state.
 */
export interface CaptureLifecycle {
  /**
   * Clear all captured data.
   */
  clear?(): void;

  /**
   * Destroy the capture instance and clean up resources.
   * Should restore original state (e.g., remove interceptors).
   */
  destroy?(): void;

  /**
   * Pause capturing without destroying the instance.
   * Can be resumed later.
   */
  pause?(): void;

  /**
   * Resume capturing after being paused.
   */
  resume?(): void;
}
