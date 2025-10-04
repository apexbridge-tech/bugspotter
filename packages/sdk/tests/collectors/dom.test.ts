import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DOMCollector } from '../../src/collectors/dom';

describe('DOMCollector', () => {
  let collector: DOMCollector;

  beforeEach(() => {
    collector = new DOMCollector({ duration: 15 });
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultCollector = new DOMCollector();
      expect(defaultCollector).toBeDefined();
      expect(defaultCollector.getDuration()).toBe(15);
    });

    it('should initialize with custom duration', () => {
      const customCollector = new DOMCollector({ duration: 30 });
      expect(customCollector.getDuration()).toBe(30);
    });

    it('should initialize with custom sampling', () => {
      const customCollector = new DOMCollector({
        duration: 20,
        sampling: {
          mousemove: 100,
          scroll: 200,
        },
      });
      expect(customCollector.getDuration()).toBe(20);
    });
  });

  describe('Recording', () => {
    it('should start recording', () => {
      collector.startRecording();
      expect(collector.isCurrentlyRecording()).toBe(true);
    });

    it('should stop recording', () => {
      collector.startRecording();
      expect(collector.isCurrentlyRecording()).toBe(true);
      
      collector.stopRecording();
      expect(collector.isCurrentlyRecording()).toBe(false);
    });

    it('should not start recording twice', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      collector.startRecording();
      collector.startRecording();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('DOMCollector: Recording already in progress');
      
      consoleWarnSpy.mockRestore();
    });

    it('should warn when stopping without active recording', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      collector.stopRecording();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('DOMCollector: No recording in progress');
      
      consoleWarnSpy.mockRestore();
    });

    it('should capture events when recording', async () => {
      collector.startRecording();
      
      // Wait for initial events to be captured
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const events = collector.getEvents();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Buffer Management', () => {
    it('should return empty array initially', () => {
      const events = collector.getEvents();
      expect(events).toEqual([]);
    });

    it('should clear buffer', async () => {
      collector.startRecording();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(collector.getBufferSize()).toBeGreaterThan(0);
      
      collector.clearBuffer();
      expect(collector.getBufferSize()).toBe(0);
    });

    it('should update duration', () => {
      expect(collector.getDuration()).toBe(15);
      
      collector.setDuration(30);
      expect(collector.getDuration()).toBe(30);
    });

    it('should get buffer size', async () => {
      collector.startRecording();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const size = collector.getBufferSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup', () => {
    it('should destroy collector and clean up', async () => {
      collector.startRecording();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(collector.isCurrentlyRecording()).toBe(true);
      expect(collector.getBufferSize()).toBeGreaterThan(0);
      
      collector.destroy();
      
      expect(collector.isCurrentlyRecording()).toBe(false);
      expect(collector.getBufferSize()).toBe(0);
    });
  });
});
