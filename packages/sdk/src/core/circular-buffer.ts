/**
 * A generic circular buffer implementation for storing a fixed number of items.
 * When the buffer is full, new items overwrite the oldest items.
 * 
 * @template T The type of items stored in the buffer
 */
export class CircularBuffer<T> {
  private items: T[] = [];
  private index = 0;
  private count = 0;

  constructor(private maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('CircularBuffer maxSize must be greater than 0');
    }
  }

  /**
   * Add an item to the buffer. If the buffer is full, the oldest item is overwritten.
   */
  add(item: T): void {
    if (this.count < this.maxSize) {
      this.items.push(item);
      this.count++;
    } else {
      this.items[this.index] = item;
    }
    this.index = (this.index + 1) % this.maxSize;
  }

  /**
   * Get all items in chronological order (oldest to newest).
   * Returns a copy of the internal array.
   */
  getAll(): T[] {
    if (this.count < this.maxSize) {
      return [...this.items];
    }
    // Return items in chronological order when buffer is full
    return [
      ...this.items.slice(this.index),
      ...this.items.slice(0, this.index)
    ];
  }

  /**
   * Clear all items from the buffer.
   */
  clear(): void {
    this.items = [];
    this.index = 0;
    this.count = 0;
  }

  /**
   * Get the current number of items in the buffer.
   */
  get size(): number {
    return this.count;
  }

  /**
   * Get the maximum capacity of the buffer.
   */
  get capacity(): number {
    return this.maxSize;
  }

  /**
   * Check if the buffer is empty.
   */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Check if the buffer is full.
   */
  get isFull(): boolean {
    return this.count >= this.maxSize;
  }
}
