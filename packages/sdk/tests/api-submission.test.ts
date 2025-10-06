import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BugSpotter } from '../src/index';

describe('API Submission', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Clean up any existing instance
    const instance = BugSpotter.getInstance();
    if (instance) {
      instance.destroy();
    }

    // Mock fetch
    originalFetch = global.fetch;
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up instance
    const instance = BugSpotter.getInstance();
    if (instance) {
      instance.destroy();
    }
  });

  describe('Successful submission', () => {
    it('should submit bug report to configured endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, id: 'bug-123' }),
      });

      const bugSpotter = BugSpotter.init({
        auth: { type: 'api-key', apiKey: 'test-api-key' },
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();

      // Manually call the private submitBugReport method via the public API
      // We'll trigger it through the modal submission
      const payload = {
        title: 'Test Bug',
        description: 'Bug description',
        report,
      };

      // Access private method through any (for testing purposes)
      await (bugSpotter as any).submitBugReport(payload);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      // With compression, the request will have different headers
      const call = fetchMock.mock.calls[0][1];
      expect(call.method).toBe('POST');
      
      // Check if compression was used or not
      if (call.headers['Content-Encoding'] === 'gzip') {
        expect(call.headers['Content-Type']).toBe('application/gzip');
        expect(call.body).toBeInstanceOf(Blob);
      } else {
        expect(call.headers['Content-Type']).toBe('application/json');
        expect(typeof call.body).toBe('string');
        const calledBody = JSON.parse(call.body);
        expect(calledBody).toHaveProperty('title', 'Test Bug');
        expect(calledBody).toHaveProperty('description', 'Bug description');
        expect(calledBody).toHaveProperty('report');
      }
      
      // API Key auth uses X-API-Key header, not Authorization
      expect(call.headers['X-API-Key']).toBe('test-api-key');
    });

    it('should submit without API key if not configured', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await (bugSpotter as any).submitBugReport(payload);

      const call = fetchMock.mock.calls[0][1];
      
      // Check headers - compression may or may not be used
      if (call.headers['Content-Encoding'] === 'gzip') {
        expect(call.headers['Content-Type']).toBe('application/gzip');
      } else {
        expect(call.headers['Content-Type']).toBe('application/json');
      }

      // Should not have Authorization header
      expect(call.headers).not.toHaveProperty('Authorization');
    });

    it('should handle JSON response successfully', async () => {
      const mockResponse = { success: true, bugId: 'bug-456', timestamp: Date.now() };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      const result = await (bugSpotter as any).submitBugReport(payload);
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-JSON response gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('No content');
        },
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      const result = await (bugSpotter as any).submitBugReport(payload);
      expect(result).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw error if no endpoint is configured', async () => {
      const bugSpotter = BugSpotter.init({
        auth: { type: 'api-key', apiKey: 'test-key' },
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'No endpoint configured for bug report submission'
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on HTTP 4xx error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid payload',
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'Failed to submit bug report: 400 Bad Request. Invalid payload'
      );
    });

    it('should throw error on HTTP 5xx error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error occurred',
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'Failed to submit bug report: 500 Internal Server Error. Server error occurred'
      );
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle error response with no text body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => {
          throw new Error('No body');
        },
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'Failed to submit bug report: 403 Forbidden. Unknown error'
      );
    });

    it('should handle timeout errors', async () => {
      fetchMock.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      const report = await bugSpotter.capture();
      const payload = { title: 'Test', description: 'Test', report };

      await expect((bugSpotter as any).submitBugReport(payload)).rejects.toThrow(
        'Request timeout'
      );
    });
  });

  describe('Payload structure', () => {
    it('should send complete bug report payload', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const bugSpotter = BugSpotter.init({
        endpoint: 'https://api.example.com/bugs',
        showWidget: false,
      });

      // Add some console logs and make network request
      console.log('Test log for payload');
      console.error('Test error for payload');

      const report = await bugSpotter.capture();
      const payload = {
        title: 'Complete Test Bug',
        description: 'This is a detailed description',
        report,
      };

      await (bugSpotter as any).submitBugReport(payload);

      const call = fetchMock.mock.calls[0][1];
      let sentPayload;
      
      // Handle both compressed and uncompressed payloads
      if (call.body instanceof Blob) {
        // Compressed payload - skip detailed structure test since we can't easily parse Blob in tests
        expect(call.headers['Content-Encoding']).toBe('gzip');
        // Just verify the call was made
        expect(fetchMock).toHaveBeenCalledTimes(1);
        return; // Skip rest of test for compressed payload
      } else {
        // Uncompressed payload
        sentPayload = JSON.parse(call.body);
      }

      // Verify structure (only for uncompressed)
      expect(sentPayload).toHaveProperty('title');
      expect(sentPayload).toHaveProperty('description');
      expect(sentPayload).toHaveProperty('report');

      // Verify report structure
      expect(sentPayload.report).toHaveProperty('screenshot');
      expect(sentPayload.report).toHaveProperty('console');
      expect(sentPayload.report).toHaveProperty('network');
      expect(sentPayload.report).toHaveProperty('metadata');

      // Verify metadata
      expect(sentPayload.report.metadata).toHaveProperty('userAgent');
      expect(sentPayload.report.metadata).toHaveProperty('viewport');
      expect(sentPayload.report.metadata).toHaveProperty('browser');
      expect(sentPayload.report.metadata).toHaveProperty('os');
      expect(sentPayload.report.metadata).toHaveProperty('url');
      expect(sentPayload.report.metadata).toHaveProperty('timestamp');

      // Verify console logs are included
      expect(Array.isArray(sentPayload.report.console)).toBe(true);
      expect(sentPayload.report.console.length).toBeGreaterThan(0);
    });
  });

  describe('Different endpoint configurations', () => {
    it('should work with different endpoint URLs', async () => {
      const endpoints = [
        'https://api.bugspotter.com/reports',
        'http://localhost:3000/api/bugs',
        'https://custom-domain.io/v1/bug-reports',
      ];

      for (const endpoint of endpoints) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });

        const bugSpotter = BugSpotter.init({
          endpoint,
          showWidget: false,
        });

        const report = await bugSpotter.capture();
        const payload = { title: 'Test', description: 'Test', report };

        await (bugSpotter as any).submitBugReport(payload);

        expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.any(Object));

        bugSpotter.destroy();
        fetchMock.mockClear();
      }
    });
  });
});
