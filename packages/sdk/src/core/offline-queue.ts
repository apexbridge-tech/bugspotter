/**
 * Offline queue for storing failed requests with localStorage persistence
 */

import { getLogger, type Logger } from '../utils/logger';

// ============================================================================
// STORAGE ADAPTER
// ============================================================================

/**
 * Storage interface for queue persistence
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * LocalStorage implementation of StorageAdapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OfflineConfig {
  /** Enable offline queue (default: false) */
  enabled: boolean;
  /** Maximum number of requests to queue (default: 10) */
  maxQueueSize?: number;
}

/** Queued request for offline retry */
interface QueuedRequest {
  id: string;
  endpoint: string;
  body: string; // Serialized body
  headers: Record<string, string>;
  timestamp: number;
  attempts: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QUEUE_STORAGE_KEY = 'bugspotter_offline_queue';
const QUEUE_EXPIRY_DAYS = 7;
const MAX_RETRY_ATTEMPTS = 5;
const MAX_ITEM_SIZE_BYTES = 100 * 1024; // 100KB per item

const DEFAULT_OFFLINE_CONFIG: Required<OfflineConfig> = {
  enabled: false,
  maxQueueSize: 10,
};

// ============================================================================
// OFFLINE QUEUE CLASS
// ============================================================================

export class OfflineQueue {
  private config: Required<OfflineConfig>;
  private logger: Logger;
  private storage: StorageAdapter;
  private requestCounter: number = 0;

  constructor(config: OfflineConfig, logger?: Logger, storage?: StorageAdapter) {
    this.config = { ...DEFAULT_OFFLINE_CONFIG, ...config };
    this.logger = logger || getLogger();
    this.storage = storage || new LocalStorageAdapter();
  }

  /**
   * Queue a request for offline retry
   */
  enqueue(endpoint: string, body: BodyInit, headers: Record<string, string>): void {
    try {
      const serializedBody = this.serializeBody(body);
      if (!serializedBody || !this.validateItemSize(serializedBody)) {
        return;
      }

      const queue = this.getQueue();

      // Ensure space in queue
      if (queue.length >= this.config.maxQueueSize) {
        this.logger.warn(
          `Offline queue is full (${this.config.maxQueueSize}), removing oldest request`
        );
        queue.shift();
      }

      queue.push(this.createQueuedRequest(endpoint, serializedBody, headers));
      this.saveQueue(queue);

      this.logger.log(`Request queued for offline retry (queue size: ${queue.length})`);
    } catch (error) {
      this.logger.error('Failed to queue request for offline retry:', error);
    }
  }

  /**
   * Process offline queue
   */
  async process(retryableStatusCodes: number[]): Promise<void> {
    const queue = this.getQueue();

    if (queue.length === 0) {
      return;
    }

    this.logger.log(`Processing offline queue (${queue.length} requests)`);

    const successfulIds: string[] = [];
    const failedRequests: QueuedRequest[] = [];

    for (const request of queue) {
      // Check if request has exceeded max retry attempts
      if (request.attempts >= MAX_RETRY_ATTEMPTS) {
        this.logger.warn(
          `Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for request (id: ${request.id}), removing`
        );
        continue;
      }

      // Check if request has expired
      const age = Date.now() - request.timestamp;
      const maxAge = QUEUE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        this.logger.warn(`Removing expired queued request (id: ${request.id})`);
        continue;
      }

      try {
        // Attempt to send
        const response = await fetch(request.endpoint, {
          method: 'POST',
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          this.logger.log(`Successfully sent queued request (id: ${request.id})`);
          successfulIds.push(request.id);
        } else if (retryableStatusCodes.includes(response.status)) {
          // Keep in queue for next attempt
          request.attempts++;
          failedRequests.push(request);
          this.logger.warn(
            `Queued request failed with status ${response.status}, will retry later (id: ${request.id})`
          );
        } else {
          // Non-retryable error, remove from queue
          this.logger.warn(
            `Queued request failed with non-retryable status ${response.status}, removing (id: ${request.id})`
          );
        }
      } catch (error) {
        // Network error, keep in queue
        request.attempts++;
        failedRequests.push(request);
        this.logger.warn(
          `Queued request failed with network error, will retry later (id: ${request.id}):`,
          error
        );
      }
    }

    // Update queue (remove successful and expired, keep failed)
    this.saveQueue(failedRequests);

    if (successfulIds.length > 0 || failedRequests.length < queue.length) {
      this.logger.log(
        `Offline queue processed: ${successfulIds.length} successful, ${failedRequests.length} remaining`
      );
    }
  }

  /**
   * Clear offline queue
   */
  clear(): void {
    try {
      this.storage.removeItem(QUEUE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.getQueue().length;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Serialize body to string format
   */
  private serializeBody(body: BodyInit): string | null {
    if (typeof body === 'string') {
      return body;
    }

    if (body instanceof Blob) {
      this.logger.warn('Cannot queue Blob for offline retry, skipping');
      return null;
    }

    return JSON.stringify(body);
  }

  /**
   * Create a queued request object
   */
  private createQueuedRequest(
    endpoint: string,
    body: string,
    headers: Record<string, string>
  ): QueuedRequest {
    return {
      id: this.generateRequestId(),
      endpoint,
      body,
      headers,
      timestamp: Date.now(),
      attempts: 0,
    };
  }

  /**
   * Validate that item size doesn't exceed localStorage limits
   */
  private validateItemSize(body: string): boolean {
    const sizeInBytes = new Blob([body]).size;
    if (sizeInBytes > MAX_ITEM_SIZE_BYTES) {
      this.logger.warn(`Request body too large (${sizeInBytes} bytes), skipping queue`);
      return false;
    }
    return true;
  }

  private getQueue(): QueuedRequest[] {
    try {
      const stored = this.storage.getItem(QUEUE_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      return JSON.parse(stored) as QueuedRequest[];
    } catch (error) {
      // Log corrupted data and clear it to prevent repeated errors
      this.logger.warn('Failed to parse offline queue data, clearing corrupted queue:', error);
      this.clear();
      return [];
    }
  }

  private saveQueue(queue: QueuedRequest[]): void {
    try {
      this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      // Handle quota exceeded error (check multiple properties for cross-browser compatibility)
      if (this.isQuotaExceededError(error)) {
        this.logger.error('localStorage quota exceeded, clearing oldest items');
        this.clearOldestItems(queue);
      } else {
        this.logger.error('Failed to save offline queue:', error);
      }
    }
  }

  /**
   * Check if error is a quota exceeded error (cross-browser compatible)
   */
  private isQuotaExceededError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    // Check error name (standard)
    if (error.name === 'QuotaExceededError') {
      return true;
    }

    // Check DOMException code (Safari, older browsers)
    if ('code' in error && error.code === 22) {
      return true;
    }

    // Check error message as fallback (Firefox, Chrome variants)
    const message = error.message.toLowerCase();
    return message.includes('quota') || message.includes('storage') || message.includes('exceeded');
  }

  /**
   * Clear oldest 50% of items and retry save
   */
  private clearOldestItems(queue: QueuedRequest[]): void {
    try {
      const trimmedQueue = queue.slice(Math.floor(queue.length / 2));
      this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmedQueue));
      this.logger.log(`Trimmed offline queue to ${trimmedQueue.length} items due to quota`);
    } catch {
      // If still failing, clear everything
      this.logger.error('Failed to save even after trimming, clearing queue');
      this.clear();
    }
  }

  private generateRequestId(): string {
    // Increment counter for additional entropy
    this.requestCounter = (this.requestCounter + 1) % 10000;

    // Use crypto.getRandomValues for better randomness (browser-safe fallback)
    let randomPart: string;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(2);
      crypto.getRandomValues(array);
      randomPart = Array.from(array, (num) => {
        return num.toString(36);
      }).join('');
    } else {
      // Fallback to Math.random for environments without crypto
      randomPart =
        Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
    }

    return `req_${Date.now()}_${this.requestCounter}_${randomPart}`;
  }
}

/**
 * Global function to clear offline queue (for backwards compatibility)
 */
export function clearOfflineQueue(): void {
  try {
    const storage = new LocalStorageAdapter();
    storage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    // Log error for debugging purposes
    const logger = getLogger();
    logger.warn('Failed to clear offline queue:', error);
  }
}
