import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthHeaders, submitWithAuth, type AuthConfig } from '../../src/core/transport';

describe('Transport - Authentication', () => {
  describe('getAuthHeaders', () => {
    it('should handle backward compatible string API key', () => {
      const headers = getAuthHeaders('my-api-key-123');
      expect(headers).toEqual({
        Authorization: 'Bearer my-api-key-123',
      });
    });

    it('should return empty headers when no auth provided', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({});
    });

    it('should handle api-key type', () => {
      const auth: AuthConfig = {
        type: 'api-key',
        apiKey: 'test-api-key',
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({
        'X-API-Key': 'test-api-key',
      });
    });

    it('should handle jwt type', () => {
      const auth: AuthConfig = {
        type: 'jwt',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      });
    });

    it('should handle bearer type', () => {
      const auth: AuthConfig = {
        type: 'bearer',
        token: 'bearer-token-abc123',
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({
        Authorization: 'Bearer bearer-token-abc123',
      });
    });

    it('should handle custom header type', () => {
      const auth: AuthConfig = {
        type: 'custom',
        customHeader: {
          name: 'X-Custom-Auth',
          value: 'custom-value-123',
        },
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({
        'X-Custom-Auth': 'custom-value-123',
      });
    });

    it('should return empty headers if auth type has no credentials', () => {
      const auth: AuthConfig = {
        type: 'jwt',
        // Missing token: should return empty headers when token is not provided for 'jwt' auth type
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({});
    });

    it('should handle custom header without credentials gracefully', () => {
      const auth: AuthConfig = {
        type: 'custom',
        // Missing customHeader: should return empty headers when customHeader is not provided
      };
      const headers = getAuthHeaders(auth);
      expect(headers).toEqual({});
    });
  });

  describe('submitWithAuth', () => {
    beforeEach(() => {
      // Reset fetch mock before each test
      global.fetch = vi.fn();
    });

    it('should submit with API key authentication', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const auth: AuthConfig = {
        type: 'api-key',
        apiKey: 'test-key',
      };

      const response = await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(200);
    });

    it('should submit with JWT authentication', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'jwt-token-123',
      };

      await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bugs',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-123',
          }),
        })
      );
    });

    it('should submit with custom header authentication', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const auth: AuthConfig = {
        type: 'custom',
        customHeader: {
          name: 'X-Tenant-ID',
          value: 'tenant-123',
        },
      };

      await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bugs',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Tenant-ID': 'tenant-123',
          }),
        })
      );
    });

    it('should handle backward compatible string auth', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        'old-api-key'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bugs',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer old-api-key',
          }),
        })
      );
    });

    it('should retry with refreshed token on 401', async () => {
      const mockExpiredResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });

      const mockSuccessResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any)
        .mockResolvedValueOnce(mockExpiredResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      const onTokenExpired = vi.fn().mockResolvedValue('new-token-456');

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'old-token-123',
        onTokenExpired,
      };

      const response = await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      // Should have called fetch twice
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // First call with old token
      expect((global.fetch as any).mock.calls[0][1].headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer old-token-123',
        })
      );

      // Second call with new token
      expect((global.fetch as any).mock.calls[1][1].headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer new-token-456',
        })
      );

      // Should have called token refresh callback
      expect(onTokenExpired).toHaveBeenCalledTimes(1);

      // Final response should be successful
      expect(response.status).toBe(200);
    });

    it('should not retry if no onTokenExpired callback provided', async () => {
      const mockExpiredResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });

      (global.fetch as any).mockResolvedValueOnce(mockExpiredResponse);

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'old-token-123',
        // No onTokenExpired callback
      };

      const response = await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      // Should have called fetch only once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Should return original 401 response
      expect(response.status).toBe(401);
    });

    it('should not retry on non-401 errors', async () => {
      const mockErrorResponse = new Response(JSON.stringify({ error: 'Server Error' }), {
        status: 500,
      });

      (global.fetch as any).mockResolvedValueOnce(mockErrorResponse);

      const onTokenExpired = vi.fn().mockResolvedValue('new-token');

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'token-123',
        onTokenExpired,
      };

      const response = await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      // Should have called fetch only once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Should not call token refresh
      expect(onTokenExpired).not.toHaveBeenCalled();

      // Should return original error response
      expect(response.status).toBe(500);
    });

    it('should handle token refresh failure gracefully', async () => {
      const mockExpiredResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });

      (global.fetch as any).mockResolvedValueOnce(mockExpiredResponse);

      const onTokenExpired = vi.fn().mockRejectedValue(new Error('Refresh failed'));

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'old-token-123',
        onTokenExpired,
      };

      const response = await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' },
        auth
      );

      // Should have called fetch only once (retry didn't happen due to refresh failure)
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Should have attempted token refresh
      expect(onTokenExpired).toHaveBeenCalledTimes(1);

      // Should return original 401 response
      expect(response.status).toBe(401);
    });

    it('should merge content and auth headers correctly', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const auth: AuthConfig = {
        type: 'jwt',
        token: 'token-123',
      };

      await submitWithAuth(
        'https://api.example.com/bugs',
        new Blob(['data']),
        {
          'Content-Type': 'application/gzip',
          'Content-Encoding': 'gzip',
        },
        auth
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bugs',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Encoding': 'gzip',
            Authorization: 'Bearer token-123',
          },
        })
      );
    });

    it('should work without authentication', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await submitWithAuth(
        'https://api.example.com/bugs',
        JSON.stringify({ test: 'data' }),
        { 'Content-Type': 'application/json' }
        // No auth parameter
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bugs',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            // No auth headers
          },
        })
      );
    });
  });
});
