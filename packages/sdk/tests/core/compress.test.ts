import { describe, it, expect, beforeEach } from 'vitest';
import {
  compressData,
  decompressData,
  compressImage,
  getCompressionRatio,
  estimateSize,
} from '../../src/core/compress';

describe('Compression', () => {
  describe('compressData', () => {
    it('should compress and decompress simple object', async () => {
      const original = { name: 'test', value: 123 };
      
      const compressed = await compressData(original);
      expect(compressed).toBeInstanceOf(Uint8Array);
      expect(compressed.length).toBeGreaterThan(0);
      
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(original);
    });

    it('should compress and decompress string data', async () => {
      const original = 'This is a test string that should be compressed';
      
      const compressed = await compressData(original);
      expect(compressed).toBeInstanceOf(Uint8Array);
      
      const decompressed = decompressData(compressed);
      expect(decompressed).toBe(original);
    });

    it('should compress large JSON data efficiently', async () => {
      // Create a large object with repetitive data
      const original = {
        logs: Array.from({ length: 100 }, (_, i) => ({
          level: 'info',
          message: `Log message ${i}`,
          timestamp: Date.now(),
        })),
        metadata: {
          userAgent: 'Mozilla/5.0...',
          viewport: { width: 1920, height: 1080 },
        },
      };

      const originalSize = estimateSize(original);
      const compressed = await compressData(original);
      const compressedSize = compressed.byteLength;

      // Compression should reduce size significantly
      expect(compressedSize).toBeLessThan(originalSize);
      
      // Should achieve at least 50% compression on repetitive data
      const ratio = getCompressionRatio(originalSize, compressedSize);
      expect(ratio).toBeGreaterThan(50);

      // Verify data integrity
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(original);
    });

    it('should handle empty object', async () => {
      const original = {};
      const compressed = await compressData(original);
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(original);
    });

    it('should handle nested objects', async () => {
      const original = {
        level1: {
          level2: {
            level3: {
              data: 'nested value',
            },
          },
        },
      };

      const compressed = await compressData(original);
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(original);
    });

    it('should handle arrays', async () => {
      const original = [1, 2, 3, 'test', { key: 'value' }];
      const compressed = await compressData(original);
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(original);
    });

    it('should compress console logs with PII data', async () => {
      const consoleLogs = Array.from({ length: 50 }, (_, i) => ({
        level: 'log',
        message: `User email: user${i}@example.com, Phone: 555-${1000 + i}`,
        timestamp: Date.now() + i,
      }));

      const originalSize = estimateSize(consoleLogs);
      const compressed = await compressData(consoleLogs);
      const compressedSize = compressed.byteLength;

      // Should compress well due to repetitive structure
      expect(compressedSize).toBeLessThan(originalSize * 0.5);

      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(consoleLogs);
    });
  });

  describe('compressImage', () => {
    it('should return original if not in browser environment', async () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANS';
      const result = await compressImage(base64);
      expect(result).toBe(base64);
    });

    // Note: Actual image compression tests would require jsdom with canvas support
    // or a browser environment. These are placeholder tests.
  });

  describe('getCompressionRatio', () => {
    it('should calculate compression ratio correctly', () => {
      expect(getCompressionRatio(1000, 500)).toBe(50);
      expect(getCompressionRatio(1000, 250)).toBe(75);
      expect(getCompressionRatio(1000, 900)).toBe(10);
      expect(getCompressionRatio(1000, 1000)).toBe(0);
    });

    it('should handle zero original size', () => {
      expect(getCompressionRatio(0, 0)).toBe(0);
    });

    it('should handle larger compressed size (negative compression)', () => {
      // This shouldn't happen in practice but handle gracefully
      expect(getCompressionRatio(100, 150)).toBe(-50);
    });
  });

  describe('estimateSize', () => {
    it('should estimate size of object correctly', () => {
      const obj = { test: 'value' };
      const size = estimateSize(obj);
      const expectedSize = new TextEncoder().encode(JSON.stringify(obj)).length;
      expect(size).toBe(expectedSize);
    });

    it('should estimate size of string correctly', () => {
      const str = 'test string';
      const size = estimateSize(str);
      const expectedSize = new TextEncoder().encode(str).length;
      expect(size).toBe(expectedSize);
    });

    it('should handle empty object', () => {
      const size = estimateSize({});
      expect(size).toBeGreaterThan(0); // "{}" has non-zero size
    });

    it('should estimate larger objects', () => {
      const largeObj = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` })),
      };
      const size = estimateSize(largeObj);
      expect(size).toBeGreaterThan(1000); // Should be reasonably large
    });
  });

  describe('Real-world compression scenarios', () => {
    it('should compress bug report payload efficiently', async () => {
      const bugReport = {
        title: 'Test Bug Report',
        description: 'This is a detailed description of the bug',
        report: {
          screenshot: 'data:image/png;base64,'.padEnd(1000, 'A'), // Simulated small screenshot
          console: Array.from({ length: 20 }, (_, i) => ({
            level: 'log',
            message: `Console message ${i}`,
            timestamp: Date.now() + i,
          })),
          network: Array.from({ length: 10 }, (_, i) => ({
            url: `https://api.example.com/endpoint/${i}`,
            method: 'GET',
            status: 200,
            duration: 100 + i,
            timestamp: Date.now() + i,
          })),
          metadata: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'Windows',
            url: 'https://example.com/page',
            timestamp: Date.now(),
          },
          replay: Array.from({ length: 50 }, (_, i) => ({
            type: 'click',
            target: `button-${i}`,
            timestamp: Date.now() + i,
          })),
        },
      };

      const originalSize = estimateSize(bugReport);
      const compressed = await compressData(bugReport);
      const compressedSize = compressed.byteLength;
      const ratio = getCompressionRatio(originalSize, compressedSize);

      console.log(`Bug report: ${originalSize} bytes → ${compressedSize} bytes (${ratio}% reduction)`);

      // Should achieve significant compression
      expect(ratio).toBeGreaterThan(40);
      expect(compressedSize).toBeLessThan(originalSize);

      // Verify integrity
      const decompressed = decompressData(compressed);
      expect(decompressed).toEqual(bugReport);
    });

    it('should handle payloads with repetitive data well', async () => {
      // Simulate many similar console logs (common in real apps)
      const repetitiveData = {
        logs: Array.from({ length: 200 }, () => ({
          level: 'debug',
          message: 'Rendering component',
          timestamp: Date.now(),
        })),
      };

      const originalSize = estimateSize(repetitiveData);
      const compressed = await compressData(repetitiveData);
      const compressedSize = compressed.byteLength;
      const ratio = getCompressionRatio(originalSize, compressedSize);

      // Repetitive data should compress very well
      expect(ratio).toBeGreaterThan(70);
    });

    it('should handle small payloads without expanding them significantly', async () => {
      const smallPayload = {
        title: 'Quick test',
        description: 'Short',
      };

      const originalSize = estimateSize(smallPayload);
      const compressed = await compressData(smallPayload);
      const compressedSize = compressed.byteLength;

      // Small payloads might not compress well, but shouldn't expand too much
      // Gzip has ~20 bytes overhead
      expect(compressedSize).toBeLessThan(originalSize + 100);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid compressed data gracefully', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5]);
      expect(() => decompressData(invalidData)).toThrow();
    });

    it('should handle circular references by throwing', async () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      // JSON.stringify will throw on circular references
      await expect(compressData(circular)).rejects.toThrow();
    });
  });
});
