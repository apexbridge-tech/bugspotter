import { describe, it, expect, beforeEach } from 'vitest';
import { CircularBuffer } from '../../src/core/buffer';
import type { eventWithTime } from '@rrweb/types';

// Mock event with time
const createMockEvent = (timestamp: number): eventWithTime => ({
  type: 3,
  data: {
    source: 0,
    texts: [],
    attributes: [],
    removes: [],
    adds: [],
  },
  timestamp,
} as eventWithTime);

describe('CircularBuffer', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer({ duration: 5 }); // 5 seconds for testing
  });

  describe('Initialization', () => {
    it('should initialize with given duration', () => {
      expect(buffer.getDuration()).toBe(5);
    });

    it('should start with empty events', () => {
      expect(buffer.getEvents()).toEqual([]);
      expect(buffer.size()).toBe(0);
    });
  });

  describe('Adding Events', () => {
    it('should add single event', () => {
      const event = createMockEvent(Date.now());
      buffer.add(event);
      
      expect(buffer.size()).toBe(1);
      expect(buffer.getEvents()).toEqual([event]);
    });

    it('should add multiple events', () => {
      const now = Date.now();
      const events = [
        createMockEvent(now),
        createMockEvent(now + 100),
        createMockEvent(now + 200),
      ];
      
      buffer.addBatch(events);
      
      expect(buffer.size()).toBe(3);
    });

    it('should maintain event order', () => {
      const now = Date.now();
      const event1 = createMockEvent(now);
      const event2 = createMockEvent(now + 100);
      const event3 = createMockEvent(now + 200);
      
      buffer.add(event1);
      buffer.add(event2);
      buffer.add(event3);
      
      const events = buffer.getEvents();
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
      expect(events[2]).toBe(event3);
    });
  });

  describe('Pruning Old Events', () => {
    it('should remove events older than duration', () => {
      const now = Date.now();
      const oldEvent = createMockEvent(now - 6000); // 6 seconds ago
      const recentEvent = createMockEvent(now);
      
      buffer.add(oldEvent);
      buffer.add(recentEvent);
      
      const events = buffer.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBe(recentEvent);
    });

    it('should keep all events within duration', () => {
      const now = Date.now();
      const events = [
        createMockEvent(now - 1000), // 1 second ago
        createMockEvent(now - 2000), // 2 seconds ago
        createMockEvent(now - 3000), // 3 seconds ago
        createMockEvent(now - 4000), // 4 seconds ago
      ];
      
      buffer.addBatch(events);
      
      expect(buffer.size()).toBe(4);
    });

    it('should prune on get', () => {
      const now = Date.now();
      buffer.add(createMockEvent(now - 10000)); // Very old
      buffer.add(createMockEvent(now));
      
      // First call returns only recent event
      const events1 = buffer.getEvents();
      expect(events1.length).toBe(1);
      
      // Second call should return same
      const events2 = buffer.getEvents();
      expect(events2.length).toBe(1);
    });
  });

  describe('Buffer Operations', () => {
    it('should clear all events', () => {
      buffer.add(createMockEvent(Date.now()));
      buffer.add(createMockEvent(Date.now()));
      
      expect(buffer.size()).toBe(2);
      
      buffer.clear();
      
      expect(buffer.size()).toBe(0);
      expect(buffer.getEvents()).toEqual([]);
    });

    it('should return copy of events', () => {
      const event = createMockEvent(Date.now());
      buffer.add(event);
      
      const events1 = buffer.getEvents();
      const events2 = buffer.getEvents();
      
      expect(events1).toEqual(events2);
      expect(events1).not.toBe(events2); // Different array instances
    });

    it('should get compressed events', () => {
      const event = createMockEvent(Date.now());
      buffer.add(event);
      
      const compressed = buffer.getCompressedEvents();
      expect(compressed).toEqual([event]);
    });
  });

  describe('Duration Management', () => {
    it('should update duration', () => {
      expect(buffer.getDuration()).toBe(5);
      
      buffer.setDuration(10);
      
      expect(buffer.getDuration()).toBe(10);
    });

    it('should prune when duration is reduced', () => {
      const now = Date.now();
      // Start with 5 second duration
      buffer.add(createMockEvent(now - 8000)); // 8 seconds ago - will be pruned
      buffer.add(createMockEvent(now));
      
      // With 5 second duration, old event should already be pruned
      expect(buffer.size()).toBe(1);
      
      // Create new buffer with longer duration
      const longerBuffer = new CircularBuffer({ duration: 10 });
      longerBuffer.add(createMockEvent(now - 8000)); // 8 seconds ago
      longerBuffer.add(createMockEvent(now));
      
      // With 10 second duration, both events should be kept
      expect(longerBuffer.size()).toBe(2);
      
      // Reduce duration to 5 seconds
      longerBuffer.setDuration(5);
      
      // Old event should now be pruned
      expect(longerBuffer.size()).toBe(1);
    });

    it('should keep more events when duration is increased', () => {
      const now = Date.now();
      buffer.add(createMockEvent(now - 8000)); // 8 seconds ago
      buffer.add(createMockEvent(now));
      
      // With 5 second duration, only 1 event
      expect(buffer.getEvents().length).toBe(1);
      
      // Increase duration to 10 seconds
      buffer.setDuration(10);
      
      // Now the 8-second-old event should be kept
      // Note: This test adds events after the old one is already pruned,
      // so we need to re-add them
      buffer.clear();
      buffer.add(createMockEvent(now - 8000));
      buffer.add(createMockEvent(now));
      
      expect(buffer.getEvents().length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffer operations', () => {
      expect(buffer.size()).toBe(0);
      expect(buffer.getEvents()).toEqual([]);
      
      buffer.clear();
      expect(buffer.size()).toBe(0);
    });

    it('should handle very short duration', () => {
      const shortBuffer = new CircularBuffer({ duration: 0.1 }); // 100ms
      const now = Date.now();
      
      shortBuffer.add(createMockEvent(now - 200)); // 200ms ago
      shortBuffer.add(createMockEvent(now));
      
      const events = shortBuffer.getEvents();
      expect(events.length).toBe(1);
    });

    it('should handle very long duration', () => {
      const longBuffer = new CircularBuffer({ duration: 3600 }); // 1 hour
      const now = Date.now();
      
      const events = [
        createMockEvent(now - 1800000), // 30 minutes ago
        createMockEvent(now),
      ];
      
      longBuffer.addBatch(events);
      
      expect(longBuffer.getEvents().length).toBe(2);
    });
  });
});
