import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { NetworkCapture } from '../src/capture/network';

describe('NetworkCapture', () => {
  let networkCapture: NetworkCapture;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    // Store original and setup mock before NetworkCapture is instantiated
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
    networkCapture = new NetworkCapture();
  });

  describe('Fetch interception', () => {
    it('should capture successful fetch requests', async () => {
      const mockResponse = new Response('{"data": "test"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
      mockFetch.mockResolvedValue(mockResponse);

      await fetch('https://api.example.com/data');

      const requests = networkCapture.getRequests();
      
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe('https://api.example.com/data');
      expect(requests[0].method).toBe('GET');
      expect(requests[0].status).toBe(200);
      expect(requests[0].duration).toBeGreaterThanOrEqual(0);
      expect(requests[0].error).toBeUndefined();
    });

    it('should capture failed fetch requests', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValue(mockError);

      try {
        await fetch('https://api.example.com/error');
      } catch (error) {
        // Expected to throw
      }

      const requests = networkCapture.getRequests();
      
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe('https://api.example.com/error');
      expect(requests[0].status).toBe(0);
      expect(requests[0].error).toBe('Network error');
      expect(requests[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should capture multiple fetch requests', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('', { status: 500 }));

      await fetch('https://api.example.com/1');
      await fetch('https://api.example.com/2');
      await fetch('https://api.example.com/3');

      const requests = networkCapture.getRequests();
      
      expect(requests).toHaveLength(3);
      expect(requests[0].status).toBe(200);
      expect(requests[1].status).toBe(404);
      expect(requests[2].status).toBe(500);
    });

    it('should pass through the response correctly', async () => {
      const mockResponse = new Response('{"data": "test"}', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const response = await fetch('https://api.example.com/data');

      expect(response).toBe(mockResponse);
      expect(response.status).toBe(200);
    });

    it('should preserve error throwing behavior', async () => {
      const mockError = new Error('Network failure');
      mockFetch.mockRejectedValue(mockError);

      await expect(fetch('https://api.example.com/error')).rejects.toThrow('Network failure');
    });
  });

  describe('getRequests', () => {
    it('should return a copy of requests array', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 200 }));
      
      await fetch('https://api.example.com/test');
      
      const requests1 = networkCapture.getRequests();
      const requests2 = networkCapture.getRequests();
      
      expect(requests1).not.toBe(requests2);
      expect(requests1).toEqual(requests2);
    });

    it('should return empty array initially', () => {
      const requests = networkCapture.getRequests();
      
      expect(requests).toEqual([]);
    });
  });
});
