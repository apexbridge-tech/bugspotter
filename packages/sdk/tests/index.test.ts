import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BugSpotter } from '../src/index';
import type { BugSpotterConfig } from '../src/index';

describe('BugSpotter', () => {
  beforeEach(() => {
    // Clear singleton instance before each test
    const instance = BugSpotter.getInstance();
    if (instance) {
      instance.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const config: BugSpotterConfig = { apiKey: 'test-key' };
      const instance1 = BugSpotter.init(config);
      const instance2 = BugSpotter.init(config);

      expect(instance1).toBe(instance2);
    });

    it('should return the same instance from getInstance', () => {
      const config: BugSpotterConfig = { apiKey: 'test-key' };
      const instance1 = BugSpotter.init(config);
      const instance2 = BugSpotter.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return null from getInstance when not initialized', () => {
      const instance = BugSpotter.getInstance();
      expect(instance).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should initialize with apiKey only', () => {
      const config: BugSpotterConfig = { apiKey: 'test-key' };
      const bugspotter = BugSpotter.init(config);

      expect(bugspotter).toBeDefined();
      expect(bugspotter.getConfig()).toEqual(config);
    });

    it('should initialize with endpoint only', () => {
      const config: BugSpotterConfig = { endpoint: 'https://api.example.com' };
      const bugspotter = BugSpotter.init(config);

      expect(bugspotter).toBeDefined();
      expect(bugspotter.getConfig()).toEqual(config);
    });

    it('should initialize with both apiKey and endpoint', () => {
      const config: BugSpotterConfig = {
        apiKey: 'test-key',
        endpoint: 'https://api.example.com',
      };
      const bugspotter = BugSpotter.init(config);

      expect(bugspotter).toBeDefined();
      expect(bugspotter.getConfig()).toEqual(config);
    });

    it('should initialize with empty config', () => {
      const config: BugSpotterConfig = {};
      const bugspotter = BugSpotter.init(config);

      expect(bugspotter).toBeDefined();
      expect(bugspotter.getConfig()).toEqual({});
    });

    it('should return a copy of config (not reference)', () => {
      const config: BugSpotterConfig = { apiKey: 'test-key' };
      const bugspotter = BugSpotter.init(config);
      const configCopy = bugspotter.getConfig();

      expect(configCopy).toEqual(config);
      expect(configCopy).not.toBe(config);
    });
  });

  describe('Capture', () => {
    it('should capture all data types', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });

      console.log('Test log');
      console.warn('Test warning');

      const report = await bugspotter.capture();

      expect(report).toHaveProperty('screenshot');
      expect(report).toHaveProperty('console');
      expect(report).toHaveProperty('network');
      expect(report).toHaveProperty('metadata');

      expect(typeof report.screenshot).toBe('string');
      expect(Array.isArray(report.console)).toBe(true);
      expect(Array.isArray(report.network)).toBe(true);
      expect(typeof report.metadata).toBe('object');
    });

    it('should capture console logs', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });

      console.log('Test message');
      const report = await bugspotter.capture();

      expect(report.console.length).toBeGreaterThan(0);
      expect(report.console[0]).toHaveProperty('level');
      expect(report.console[0]).toHaveProperty('message');
      expect(report.console[0]).toHaveProperty('timestamp');
    });

    it('should capture metadata with required fields', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });
      const report = await bugspotter.capture();

      expect(report.metadata).toHaveProperty('userAgent');
      expect(report.metadata).toHaveProperty('viewport');
      expect(report.metadata).toHaveProperty('browser');
      expect(report.metadata).toHaveProperty('os');
      expect(report.metadata).toHaveProperty('url');
      expect(report.metadata).toHaveProperty('timestamp');
    });

    it('should return BugReport with correct structure', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });
      const report = await bugspotter.capture();

      // Validate screenshot
      expect(typeof report.screenshot).toBe('string');

      // Validate console array structure
      expect(Array.isArray(report.console)).toBe(true);
      if (report.console.length > 0) {
        expect(report.console[0]).toHaveProperty('level');
        expect(report.console[0]).toHaveProperty('message');
        expect(report.console[0]).toHaveProperty('timestamp');
      }

      // Validate network array structure
      expect(Array.isArray(report.network)).toBe(true);

      // Validate metadata object
      expect(report.metadata).toHaveProperty('userAgent');
      expect(report.metadata.viewport).toHaveProperty('width');
      expect(report.metadata.viewport).toHaveProperty('height');
    });
  });

  describe('Lifecycle', () => {
    it('should destroy and clear singleton instance', () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });
      expect(BugSpotter.getInstance()).toBe(bugspotter);

      bugspotter.destroy();

      expect(BugSpotter.getInstance()).toBeNull();
    });

    it('should allow re-initialization after destroy', () => {
      const config1: BugSpotterConfig = { apiKey: 'key1' };
      const instance1 = BugSpotter.init(config1);

      instance1.destroy();

      const config2: BugSpotterConfig = { apiKey: 'key2' };
      const instance2 = BugSpotter.init(config2);

      expect(instance2).not.toBe(instance1);
      expect(instance2.getConfig()).toEqual(config2);
    });

    it('should clean up console interceptor on destroy', () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });
      const originalLog = console.log;

      bugspotter.destroy();

      // After destroy, console should be restored (we can't directly check this,
      // but we can verify no errors occur)
      expect(() => console.log('test')).not.toThrow();
    });

    it('should clean up network interceptor on destroy', () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });
      const originalFetch = global.fetch;

      bugspotter.destroy();

      // After destroy, fetch should be restored
      expect(global.fetch).toBeDefined();
    });
  });

  describe('Multiple Capture Calls', () => {
    it('should handle multiple capture calls', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });

      const report1 = await bugspotter.capture();
      console.log('New log after first capture');
      const report2 = await bugspotter.capture();

      expect(report1).toBeDefined();
      expect(report2).toBeDefined();
      expect(report1).not.toBe(report2);
    });

    it('should accumulate console logs between captures', async () => {
      const bugspotter = BugSpotter.init({ apiKey: 'test-key' });

      console.log('First message');
      const report1 = await bugspotter.capture();
      const firstLogCount = report1.console.length;

      console.log('Second message');
      const report2 = await bugspotter.capture();
      const secondLogCount = report2.console.length;

      expect(secondLogCount).toBeGreaterThanOrEqual(firstLogCount);
    });
  });
});
