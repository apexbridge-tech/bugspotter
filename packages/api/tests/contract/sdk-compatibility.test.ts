/**
 * Contract tests to ensure SDK and API compatibility
 * These tests verify that the SDK can successfully communicate with the API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { 
  CreateBugReportRequest, 
  CreateBugReportResponse,
  ApiErrorResponse 
} from '@bugspotter/types';

const API_URL = 'http://localhost:4000';

describe('SDK-API Contract Tests', () => {
  describe('POST /api/bugs', () => {
    it('should accept valid SDK payload with all required fields', async () => {
      const sdkPayload: CreateBugReportRequest = {
        title: 'Test Bug Report',
        description: 'This is a test bug report from the SDK',
        report: {
          screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          console: [
            {
              level: 'error',
              message: 'TypeError: Cannot read property "foo" of undefined',
              timestamp: Date.now(),
              stack: 'Error: Test error\n  at Object.<anonymous> (test.js:1:1)',
            },
            {
              level: 'warn',
              message: 'Warning: Deprecated API usage',
              timestamp: Date.now() - 1000,
            },
          ],
          network: [
            {
              url: 'https://api.example.com/users',
              method: 'GET',
              status: 200,
              duration: 234,
              timestamp: Date.now() - 2000,
            },
            {
              url: 'https://api.example.com/data',
              method: 'POST',
              status: 500,
              duration: 567,
              timestamp: Date.now() - 1000,
              error: 'Internal Server Error',
            },
          ],
          metadata: {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com/dashboard',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sdkPayload),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);

      const result = await response.json() as CreateBugReportResponse;
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.title).toBe(sdkPayload.title);
      expect(result.data.description).toBe(sdkPayload.description);
      expect(result.data.status).toBe('open');
      expect(result.data.created_at).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should accept payload with optional priority', async () => {
      const sdkPayload: CreateBugReportRequest = {
        title: 'High Priority Bug',
        description: 'Critical issue',
        priority: 'high',
        report: {
          screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          console: [],
          network: [],
          metadata: {
            userAgent: 'Mozilla/5.0',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sdkPayload),
      });

      expect(response.ok).toBe(true);
      const result = await response.json() as CreateBugReportResponse;
      expect(result.success).toBe(true);
      expect(result.data.priority).toBe('high');
    });

    it('should reject payload with missing title', async () => {
      const invalidPayload = {
        description: 'Missing title',
        report: {
          screenshot: 'data:image/png;base64,test',
          console: [],
          network: [],
          metadata: {
            userAgent: 'Mozilla/5.0',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const result = await response.json() as ApiErrorResponse;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation Error');
    });

    it('should reject payload with invalid console log level', async () => {
      const invalidPayload = {
        title: 'Test',
        description: 'Test',
        report: {
          screenshot: 'data:image/png;base64,test',
          console: [
            {
              level: 'invalid-level', // Invalid
              message: 'Test',
              timestamp: Date.now(),
            },
          ],
          network: [],
          metadata: {
            userAgent: 'Mozilla/5.0',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const result = await response.json() as ApiErrorResponse;
      expect(result.success).toBe(false);
    });

    it('should reject payload with invalid network request URL', async () => {
      const invalidPayload = {
        title: 'Test',
        description: 'Test',
        report: {
          screenshot: 'data:image/png;base64,test',
          console: [],
          network: [
            {
              url: 'not-a-valid-url', // Invalid URL
              method: 'GET',
              status: 200,
              duration: 100,
              timestamp: Date.now(),
            },
          ],
          metadata: {
            userAgent: 'Mozilla/5.0',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const result = await response.json() as ApiErrorResponse;
      expect(result.success).toBe(false);
    });

    it('should reject payload with missing metadata', async () => {
      const invalidPayload = {
        title: 'Test',
        description: 'Test',
        report: {
          screenshot: 'data:image/png;base64,test',
          console: [],
          network: [],
          // Missing metadata
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const result = await response.json() as ApiErrorResponse;
      expect(result.success).toBe(false);
    });

    it('should reject payload with title exceeding max length', async () => {
      const invalidPayload: CreateBugReportRequest = {
        title: 'x'.repeat(201), // Exceeds 200 character limit
        description: 'Test',
        report: {
          screenshot: 'data:image/png;base64,test',
          console: [],
          network: [],
          metadata: {
            userAgent: 'Mozilla/5.0',
            viewport: { width: 1920, height: 1080 },
            browser: 'Chrome',
            os: 'macOS',
            url: 'https://myapp.com',
            timestamp: Date.now(),
          },
        },
      };

      const response = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.status).toBe(400);
      const result = await response.json() as ApiErrorResponse;
      expect(result.success).toBe(false);
    });
  });

  describe('Type Compatibility', () => {
    it('should handle all console log levels from SDK', async () => {
      const levels: Array<'log' | 'warn' | 'error' | 'info' | 'debug'> = 
        ['log', 'warn', 'error', 'info', 'debug'];

      for (const level of levels) {
        const payload: CreateBugReportRequest = {
          title: `Test ${level} level`,
          description: 'Testing console level',
          report: {
            screenshot: 'data:image/png;base64,test',
            console: [{ level, message: 'Test', timestamp: Date.now() }],
            network: [],
            metadata: {
              userAgent: 'Mozilla/5.0',
              viewport: { width: 1920, height: 1080 },
              browser: 'Chrome',
              os: 'macOS',
              url: 'https://myapp.com',
              timestamp: Date.now(),
            },
          },
        };

        const response = await fetch(`${API_URL}/api/bugs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        expect(response.ok).toBe(true);
      }
    });

    it('should handle all priority levels from SDK', async () => {
      const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = 
        ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        const payload: CreateBugReportRequest = {
          title: `Test ${priority} priority`,
          description: 'Testing priority level',
          priority,
          report: {
            screenshot: 'data:image/png;base64,test',
            console: [],
            network: [],
            metadata: {
              userAgent: 'Mozilla/5.0',
              viewport: { width: 1920, height: 1080 },
              browser: 'Chrome',
              os: 'macOS',
              url: 'https://myapp.com',
              timestamp: Date.now(),
            },
          },
        };

        const response = await fetch(`${API_URL}/api/bugs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        expect(response.ok).toBe(true);
        const result = await response.json() as CreateBugReportResponse;
        expect(result.data.priority).toBe(priority);
      }
    });
  });
});
