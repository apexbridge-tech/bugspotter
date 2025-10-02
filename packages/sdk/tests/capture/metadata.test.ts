import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataCapture } from '../../src/capture/metadata';

describe('MetadataCapture', () => {
  let metadataCapture: MetadataCapture;

  beforeEach(() => {
    metadataCapture = new MetadataCapture();
  });

  describe('capture', () => {
    it('should capture basic metadata', () => {
      const metadata = metadataCapture.capture();

      expect(metadata).toHaveProperty('userAgent');
      expect(metadata).toHaveProperty('viewport');
      expect(metadata).toHaveProperty('browser');
      expect(metadata).toHaveProperty('os');
      expect(metadata).toHaveProperty('url');
      expect(metadata).toHaveProperty('timestamp');
    });

    it('should capture viewport dimensions', () => {
      const metadata = metadataCapture.capture();

      expect(metadata.viewport).toHaveProperty('width');
      expect(metadata.viewport).toHaveProperty('height');
      expect(typeof metadata.viewport.width).toBe('number');
      expect(typeof metadata.viewport.height).toBe('number');
    });

    it('should capture current URL', () => {
      const metadata = metadataCapture.capture();

      expect(typeof metadata.url).toBe('string');
      expect(metadata.url).toBeTruthy();
    });

    it('should capture timestamp', () => {
      const before = Date.now();
      const metadata = metadataCapture.capture();
      const after = Date.now();

      expect(metadata.timestamp).toBeGreaterThanOrEqual(before);
      expect(metadata.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('detectBrowser', () => {
    it('should detect Chrome', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.browser).toBe('Chrome');
    });

    it('should detect Firefox', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.browser).toBe('Firefox');
    });

    it('should detect Safari', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.browser).toBe('Safari');
    });

    it('should detect Edge', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.browser).toBe('Edge');
    });

    it('should return Unknown for unrecognized browsers', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'SomeUnknownBrowser/1.0',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.browser).toBe('Unknown');
    });
  });

  describe('detectOS', () => {
    it('should detect Windows', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('Windows');
    });

    it('should detect macOS', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('macOS');
    });

    it('should detect Linux', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('Linux');
    });

    it('should detect Android', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('Android');
    });

    it('should detect iOS from iPhone', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('iOS');
    });

    it('should detect iOS from iPad', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('iOS');
    });

    it('should return Unknown for unrecognized OS', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'SomeUnknownOS/1.0',
      });

      const metadata = metadataCapture.capture();
      expect(metadata.os).toBe('Unknown');
    });
  });
});
