import type { eventWithTime } from '@rrweb/types';

export interface CircularBufferConfig {
  /** Duration in seconds to keep events */
  duration: number;
}

/**
 * Time-based circular buffer for storing replay events.
 * Automatically prunes events older than the configured duration.
 */
export class CircularBuffer<T extends eventWithTime = eventWithTime> {
  private events: T[] = [];
  private duration: number; // in milliseconds

  constructor(config: CircularBufferConfig) {
    this.duration = config.duration * 1000; // convert to milliseconds
  }

  /**
   * Add an event to the buffer
   */
  add(event: T): void {
    this.events.push(event);
    this.prune();
  }

  /**
   * Add multiple events to the buffer
   */
  addBatch(events: T[]): void {
    this.events.push(...events);
    this.prune();
  }

  /**
   * Remove events older than the configured duration
   */
  private prune(): void {
    if (this.events.length === 0) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.duration;

    // Find the first event that should be kept
    let firstValidIndex = 0;
    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].timestamp >= cutoffTime) {
        firstValidIndex = i;
        break;
      }
    }

    // Remove old events
    if (firstValidIndex > 0) {
      this.events = this.events.slice(firstValidIndex);
    }
  }

  /**
   * Get all events in the buffer
   */
  getEvents(): T[] {
    this.prune(); // Ensure we don't return stale events
    return [...this.events]; // Return a copy
  }

  /**
   * Get compressed event data
   */
  getCompressedEvents(): T[] {
    return this.getEvents();
  }

  /**
   * Clear all events from the buffer
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get the current size of the buffer
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Update the buffer duration
   */
  setDuration(seconds: number): void {
    this.duration = seconds * 1000;
    this.prune();
  }

  /**
   * Get the buffer duration in seconds
   */
  getDuration(): number {
    return this.duration / 1000;
  }
}
