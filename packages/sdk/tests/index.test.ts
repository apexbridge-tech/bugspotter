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
      const config: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'test-key' } };
      const instance1 = BugSpotter.init(config);
      const instance2 = BugSpotter.init(config);

      expect(instance1).toBe(instance2);
    });

    it('should return the same instance from getInstance', () => {
      const config: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'test-key' } };
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
      const config: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'test-key' } };
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
        auth: { type: 'api-key', apiKey: 'test-key' },
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
      const config: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'test-key' } };
      const bugspotter = BugSpotter.init(config);
      const configCopy = bugspotter.getConfig();

      expect(configCopy).toEqual(config);
      expect(configCopy).not.toBe(config);
    });
  });

  describe('Capture', () => {
    it('should capture all data types', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      console.log('Test log');
      console.warn('Test warning');

      const report = await bugspotter.capture();

      expect(report).toHaveProperty('screenshot');
      expect(report).toHaveProperty('console');
      expect(report).toHaveProperty('network');
      expect(report).toHaveProperty('metadata');
      expect(report).toHaveProperty('replay');

      expect(typeof report.screenshot).toBe('string');
      expect(Array.isArray(report.console)).toBe(true);
      expect(Array.isArray(report.network)).toBe(true);
      expect(typeof report.metadata).toBe('object');
      expect(Array.isArray(report.replay)).toBe(true);
    });

    it('should capture replay events when enabled', async () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        replay: {
          enabled: true,
          duration: 15
        }
      });

      // Wait a bit for some events to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = await bugspotter.capture();

      expect(report.replay).toBeDefined();
      expect(Array.isArray(report.replay)).toBe(true);
      // Should have at least initial snapshot events
      expect(report.replay.length).toBeGreaterThan(0);
    });

    it('should not capture replay events when disabled', async () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        replay: {
          enabled: false
        }
      });

      const report = await bugspotter.capture();

      expect(report.replay).toBeDefined();
      expect(Array.isArray(report.replay)).toBe(true);
      expect(report.replay.length).toBe(0);
    });

    it('should respect replay duration configuration', async () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        replay: {
          enabled: true,
          duration: 20
        }
      });

      const config = bugspotter.getConfig();
      expect(config.replay?.duration).toBe(20);
    });

    it('should capture console logs', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      console.log('Test message');
      const report = await bugspotter.capture();

      expect(report.console.length).toBeGreaterThan(0);
      expect(report.console[0]).toHaveProperty('level');
      expect(report.console[0]).toHaveProperty('message');
      expect(report.console[0]).toHaveProperty('timestamp');
    });

    it('should capture metadata with required fields', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      const report = await bugspotter.capture();

      expect(report.metadata).toHaveProperty('userAgent');
      expect(report.metadata).toHaveProperty('viewport');
      expect(report.metadata).toHaveProperty('browser');
      expect(report.metadata).toHaveProperty('os');
      expect(report.metadata).toHaveProperty('url');
      expect(report.metadata).toHaveProperty('timestamp');
    });

    it('should return BugReport with correct structure', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
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
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      expect(BugSpotter.getInstance()).toBe(bugspotter);

      bugspotter.destroy();

      expect(BugSpotter.getInstance()).toBeNull();
    });

    it('should allow re-initialization after destroy', () => {
      const config1: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'key1' } };
      const instance1 = BugSpotter.init(config1);

      instance1.destroy();

      const config2: BugSpotterConfig = { auth: { type: 'api-key', apiKey: 'key2' } };
      const instance2 = BugSpotter.init(config2);

      expect(instance2).not.toBe(instance1);
      expect(instance2.getConfig()).toEqual(config2);
    });

    it('should clean up console interceptor on destroy', () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      bugspotter.destroy();

      // After destroy, console should be restored (we can't directly check this,
      // but we can verify no errors occur)
      expect(() => {
        return console.log('test');
      }).not.toThrow();
    });

    it('should clean up network interceptor on destroy', () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      bugspotter.destroy();

      // After destroy, fetch should be restored
      expect(global.fetch).toBeDefined();
    });
  });

  describe('Multiple Capture Calls', () => {
    it('should handle multiple capture calls', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      const report1 = await bugspotter.capture();
      console.log('New log after first capture');
      const report2 = await bugspotter.capture();

      expect(report1).toBeDefined();
      expect(report2).toBeDefined();
      expect(report1).not.toBe(report2);
    });

    it('should accumulate console logs between captures', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });

      console.log('First message');
      const report1 = await bugspotter.capture();
      const firstLogCount = report1.console.length;

      console.log('Second message');
      const report2 = await bugspotter.capture();
      const secondLogCount = report2.console.length;

      expect(secondLogCount).toBeGreaterThanOrEqual(firstLogCount);
    });
  });

  describe('Widget Integration', () => {
    it('should create widget by default', () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      
      // Check if button element was added to the body
      const button = document.querySelector('button[style*="position: fixed"]');
      expect(button).toBeTruthy();
      
      bugspotter.destroy();
    });

    it('should not create widget when showWidget is false', () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        showWidget: false 
      });
      
      // Check if button element was NOT added
      const button = document.querySelector('button[style*="position: fixed"]');
      expect(button).toBeNull();
      
      bugspotter.destroy();
    });

    it('should pass widget options correctly', () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        widgetOptions: {
          position: 'top-left',
          icon: '🚨',
          backgroundColor: '#8b5cf6',
          size: 70
        }
      });
      
      const button = document.querySelector('button[style*="position: fixed"]') as HTMLButtonElement;
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('🚨');
      expect(button.style.backgroundColor).toBe('rgb(139, 92, 246)'); // #8b5cf6 in rgb
      
      bugspotter.destroy();
    });

    it('should destroy widget when BugSpotter is destroyed', () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      
      const buttonBefore = document.querySelector('button[style*="position: fixed"]');
      expect(buttonBefore).toBeTruthy();
      
      bugspotter.destroy();
      
      const buttonAfter = document.querySelector('button[style*="position: fixed"]');
      expect(buttonAfter).toBeNull();
    });

    it('should call capture when widget button is clicked', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      const captureSpy = vi.spyOn(bugspotter, 'capture');
      
      const button = document.querySelector('button[style*="position: fixed"]') as HTMLButtonElement;
      expect(button).toBeTruthy();
      
      // Click the button
      button.click();
      
      // Wait for async capture to be called
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(captureSpy).toHaveBeenCalled();
      
      bugspotter.destroy();
    });

    it('should handle widget configuration with showWidget true explicitly', () => {
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        showWidget: true
      });
      
      const button = document.querySelector('button[style*="position: fixed"]');
      expect(button).toBeTruthy();
      
      bugspotter.destroy();
    });
  });

  describe('Bug Report Modal Integration', () => {
    it('should show modal with screenshot when widget button is clicked', async () => {
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      
      const widgetButton = document.querySelector('button[style*="position: fixed"]') as HTMLButtonElement;
      expect(widgetButton).toBeTruthy();
      
      // Click the widget button
      widgetButton.click();
      
      // Wait for async capture and modal display
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if modal is displayed
      const modalContainer = Array.from(document.body.children).find(
        el => el.shadowRoot?.querySelector('.overlay')
      );
      expect(modalContainer).toBeTruthy();
      
      // Check if screenshot is displayed in modal
      const shadow = (modalContainer as HTMLElement).shadowRoot;
      const screenshot = shadow?.querySelector('#screenshot') as HTMLImageElement;
      expect(screenshot).toBeTruthy();
      expect(screenshot.src).toBeTruthy();
      
      bugspotter.destroy();
    });

    it('should log bug report data when modal is submitted', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      const bugspotter = BugSpotter.init({ auth: { type: 'api-key', apiKey: 'test-key' } });
      
      const widgetButton = document.querySelector('button[style*="position: fixed"]') as HTMLButtonElement;
      widgetButton.click();
      
      // Wait for modal to appear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const modalContainer = Array.from(document.body.children).find(
        el => el.shadowRoot?.querySelector('.overlay')
      ) as HTMLElement;
      
      const shadow = modalContainer.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector('#description') as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;
      
      // Fill in the form
      titleInput.value = 'Test Bug Title';
      descriptionInput.value = 'Test Bug Description';
      
      // Submit the form
      submitButton.click();
      
      // Check if console.log was called with bug report data
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BugSpotter] Submitting bug:',
        expect.objectContaining({
          title: 'Test Bug Title',
          description: 'Test Bug Description',
          report: expect.objectContaining({
            screenshot: expect.any(String),
            console: expect.any(Array),
            network: expect.any(Array),
            metadata: expect.any(Object),
          }),
        })
      );
      
      consoleLogSpy.mockRestore();
      bugspotter.destroy();
    });

    it('should not show modal when showWidget is false', async () => {
      // Count existing modals before test
      const initialModalCount = Array.from(document.body.children).filter(
        el => el.shadowRoot?.querySelector('.overlay')
      ).length;
      
      const bugspotter = BugSpotter.init({ 
        auth: { type: 'api-key', apiKey: 'test-key' },
        showWidget: false 
      });
      
      // Manually call capture (no widget to click)
      await bugspotter.capture();
      
      // Wait a bit to ensure no modal appears
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that no new modal was created
      const finalModalCount = Array.from(document.body.children).filter(
        el => el.shadowRoot?.querySelector('.overlay')
      ).length;
      expect(finalModalCount).toBe(initialModalCount);
      
      bugspotter.destroy();
    });
  });
});
