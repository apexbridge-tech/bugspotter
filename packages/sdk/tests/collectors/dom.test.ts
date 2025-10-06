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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BugSpotter] DOMCollector: Recording already in progress'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn when stopping without active recording', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      collector.stopRecording();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BugSpotter] DOMCollector: No recording in progress'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should capture events when recording', async () => {
      collector.startRecording();

      // Wait for initial events to be captured
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

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
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

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
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const size = collector.getBufferSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup', () => {
    it('should destroy collector and clean up', async () => {
      collector.startRecording();
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      expect(collector.isCurrentlyRecording()).toBe(true);
      expect(collector.getBufferSize()).toBeGreaterThan(0);

      collector.destroy();

      expect(collector.isCurrentlyRecording()).toBe(false);
      expect(collector.getBufferSize()).toBe(0);
    });
  });

  describe('Event Serialization', () => {
    it('should produce JSON-serializable events', async () => {
      collector.startRecording();
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // Should be able to stringify without errors
      const serialized = JSON.stringify(events);
      expect(typeof serialized).toBe('string');

      // Should be able to parse back
      const parsed = JSON.parse(serialized);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(events.length);
    });

    it('should handle events with complex data structures', async () => {
      collector.startRecording();

      // Trigger some DOM mutations
      const div = document.createElement('div');
      div.setAttribute('data-test', 'complex');
      div.innerHTML = '<span>Test</span>';
      document.body.appendChild(div);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();

      // Verify serialization works
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(div);
    });

    it('should not include circular references', async () => {
      collector.startRecording();
      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();

      // JSON.stringify will throw if there are circular references
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();
    });
  });

  describe('Shadow DOM', () => {
    it('should record changes in Shadow DOM', async () => {
      collector.startRecording();

      // Create element with Shadow DOM
      const host = document.createElement('div');
      host.setAttribute('id', 'shadow-host');
      const shadowRoot = host.attachShadow({ mode: 'open' });

      const shadowContent = document.createElement('p');
      shadowContent.textContent = 'Shadow DOM content';
      shadowRoot.appendChild(shadowContent);

      document.body.appendChild(host);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // Should be serializable even with Shadow DOM
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(host);
    });

    it('should handle multiple Shadow DOM elements', async () => {
      collector.startRecording();

      // Create multiple Shadow DOM elements
      const host1 = document.createElement('div');
      const shadow1 = host1.attachShadow({ mode: 'open' });
      shadow1.innerHTML = '<span>Shadow 1</span>';

      const host2 = document.createElement('div');
      const shadow2 = host2.attachShadow({ mode: 'open' });
      shadow2.innerHTML = '<span>Shadow 2</span>';

      document.body.appendChild(host1);
      document.body.appendChild(host2);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(host1);
      document.body.removeChild(host2);
    });
  });

  describe('iframes', () => {
    it('should handle same-origin iframes gracefully', async () => {
      collector.startRecording();

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('id', 'test-iframe');
      document.body.appendChild(iframe);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // Should be serializable
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(iframe);
    });

    it('should not crash with iframes present', async () => {
      collector.startRecording();

      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);

      // Try to add content to iframe
      if (iframe.contentDocument) {
        const iframeDiv = iframe.contentDocument.createElement('div');
        iframeDiv.textContent = 'Iframe content';
        iframe.contentDocument.body?.appendChild(iframeDiv);
      }

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      // Should not throw
      expect(() => {
        return collector.getEvents();
      }).not.toThrow();
      expect(() => {
        return JSON.stringify(collector.getEvents());
      }).not.toThrow();

      // Clean up
      document.body.removeChild(iframe);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large DOM trees', async () => {
      collector.startRecording();

      // Create a large DOM tree
      const container = document.createElement('div');
      container.setAttribute('id', 'large-container');

      for (let i = 0; i < 100; i++) {
        const child = document.createElement('div');
        child.textContent = `Item ${i}`;
        container.appendChild(child);
      }

      document.body.appendChild(container);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // Should handle serialization of large structures
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(container);
    });

    it('should handle rapid DOM mutations', async () => {
      collector.startRecording();

      const container = document.createElement('div');
      document.body.appendChild(container);

      // Perform rapid mutations
      for (let i = 0; i < 20; i++) {
        const el = document.createElement('span');
        el.textContent = `Rapid ${i}`;
        container.appendChild(el);
      }

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(container);
    });

    it('should handle empty document', () => {
      const emptyCollector = new DOMCollector({ duration: 15 });
      emptyCollector.startRecording();

      const events = emptyCollector.getEvents();
      expect(Array.isArray(events)).toBe(true);
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      emptyCollector.destroy();
    });

    it('should handle special characters in DOM content', async () => {
      collector.startRecording();

      const div = document.createElement('div');
      div.setAttribute('data-special', '<>&"\'');
      div.textContent = 'Special chars: <>&"\' 中文 🎉';
      document.body.appendChild(div);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(div);
    });

    it('should handle very long text content', async () => {
      collector.startRecording();

      const div = document.createElement('div');
      div.textContent = 'A'.repeat(10000); // 10k characters
      document.body.appendChild(div);

      await new Promise((resolve) => {
        return setTimeout(resolve, 100);
      });

      const events = collector.getEvents();
      expect(() => {
        return JSON.stringify(events);
      }).not.toThrow();

      // Clean up
      document.body.removeChild(div);
    });
  });
});
