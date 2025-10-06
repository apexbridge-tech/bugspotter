# Retry & Offline Queue Features

## Overview

BugSpotter SDK includes built-in exponential backoff retry and offline queue support to ensure reliable bug report delivery even in unreliable network conditions.

## Features

### ✅ Exponential Backoff Retry

- Automatically retries failed requests with exponential backoff
- Configurable retry attempts, delays, and retryable status codes
- Respects `Retry-After` headers from servers
- Adds jitter (±10%) to prevent thundering herd problems

### 💾 Offline Queue

- Queues failed requests in localStorage when network is unavailable
- Automatically retries queued requests on next SDK initialization
- Configurable queue size limit
- Auto-expires requests after 7 days
- Works seamlessly across browser sessions

## Configuration

### Retry Configuration

```typescript
interface RetryConfig {
  maxRetries?: number; // Default: 3
  baseDelay?: number; // Default: 1000ms
  maxDelay?: number; // Default: 30000ms (30s)
  retryOn?: number[]; // Default: [502, 503, 504, 429]
}
```

### Offline Configuration

```typescript
interface OfflineConfig {
  enabled: boolean; // Enable offline queue
  maxQueueSize?: number; // Default: 10
}
```

## Usage Examples

### Basic Retry Configuration

```typescript
import { BugSpotter } from '@bugspotter/sdk';

BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'bearer', token: 'your-token' },

  // Configure retry behavior
  retry: {
    maxRetries: 3,
    baseDelay: 1000, // Start with 1s delay
    maxDelay: 30000, // Max 30s delay
    retryOn: [502, 503, 504, 429], // Retry on these status codes
  },
});
```

### Enable Offline Queue

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'api-key', apiKey: 'your-key' },

  // Enable offline support
  offline: {
    enabled: true,
    maxQueueSize: 20, // Queue up to 20 failed requests
  },
});
```

### Combined Configuration

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'bearer', token: 'your-token' },

  // Retry configuration
  retry: {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 60000,
    retryOn: [429, 500, 502, 503, 504],
  },

  // Offline queue
  offline: {
    enabled: true,
    maxQueueSize: 15,
  },
});
```

## How It Works

### Exponential Backoff Algorithm

1. **Initial Attempt**: Request is sent immediately
2. **First Retry**: Wait `baseDelay * 2^0` = 1000ms (with jitter)
3. **Second Retry**: Wait `baseDelay * 2^1` = 2000ms (with jitter)
4. **Third Retry**: Wait `baseDelay * 2^2` = 4000ms (with jitter)
5. **Max Delay**: Capped at `maxDelay` (30000ms)

**Jitter**: ±10% randomization prevents all clients from retrying simultaneously

### Retry-After Header Support

If the server returns a `Retry-After` header (e.g., for rate limiting), the SDK respects it:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

The SDK will wait 60 seconds before retrying, regardless of the calculated exponential delay.

### Offline Queue Flow

```
┌─────────────────────┐
│  Submit Bug Report  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Network Request   │
└──────────┬──────────┘
           │
           ├─── Success ──────┐
           │                  │
           ├─── Retryable ────┤ Exponential Backoff
           │      Error       │ Retry Logic
           │                  │
           └─── Network  ─────┼──► Queue in localStorage
                Failed        │
                              │
                              ▼
                    ┌──────────────────┐
                    │ On Next Request  │
                    │ Process Queue    │
                    └──────────────────┘
```

## Retryable Status Codes

By default, the SDK retries on these HTTP status codes:

| Code    | Status              | Description                    |
| ------- | ------------------- | ------------------------------ |
| **429** | Too Many Requests   | Rate limiting                  |
| **502** | Bad Gateway         | Upstream server error          |
| **503** | Service Unavailable | Server temporarily unavailable |
| **504** | Gateway Timeout     | Upstream timeout               |

You can customize this list:

```typescript
retry: {
  retryOn: [408, 429, 500, 502, 503, 504], // Add 408 Timeout and 500
}
```

## Offline Queue Behavior

### Queue Storage

Requests are stored in `localStorage` with key `bugspotter_offline_queue`.

Each queued request includes:

- `id`: Unique request identifier
- `endpoint`: Target API endpoint
- `body`: Serialized request body
- `headers`: Request headers (including auth)
- `timestamp`: Time when queued
- `attempts`: Number of retry attempts

### Queue Processing

The queue is automatically processed when:

1. SDK is initialized (on page load)
2. Any new bug report is submitted

### Queue Limits

- **Size Limit**: Oldest requests are removed when queue exceeds `maxQueueSize`
- **Time Limit**: Requests older than 7 days are automatically expired
- **Blob Limitation**: Cannot queue `Blob` bodies (e.g., compressed payloads)

### Manual Queue Management

```typescript
import { clearOfflineQueue } from '@bugspotter/sdk';

// Clear all queued requests
clearOfflineQueue();
```

## Best Practices

### 1. Configure Appropriate Retry Limits

```typescript
// ✅ Good - Reasonable limits
retry: {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
}

// ❌ Bad - Too aggressive
retry: {
  maxRetries: 10,      // Too many retries
  baseDelay: 100,      // Too short delay
  maxDelay: 300000,    // 5 minutes is too long
}
```

### 2. Enable Offline Queue for Mobile/Unreliable Networks

```typescript
// ✅ Good - Enable for mobile apps
offline: {
  enabled: true,
  maxQueueSize: 20,
}

// ⚠️ Consider - Disable for server-side rendering
offline: {
  enabled: false,  // No localStorage in SSR
}
```

### 3. Monitor Queue Size

```typescript
// Check queue status (for debugging)
const queue = localStorage.getItem('bugspotter_offline_queue');
if (queue) {
  const requests = JSON.parse(queue);
  console.log(`Queued requests: ${requests.length}`);
}
```

### 4. Handle Rate Limiting Gracefully

```typescript
retry: {
  maxRetries: 5,
  baseDelay: 2000,      // Longer delay for rate limits
  retryOn: [429],       // Only retry rate limits
}
```

## Error Handling

### Network Errors

Network errors (connection refused, DNS failure, etc.) are automatically retried:

```typescript
TypeError: Failed to fetch
NetworkError: Network request failed
```

### Non-Retryable Errors

These errors are NOT retried by default:

- `400 Bad Request` - Client error, won't succeed on retry
- `401 Unauthorized` - Auth issue (unless token refresh is configured)
- `403 Forbidden` - Permission denied
- `404 Not Found` - Endpoint doesn't exist

### Token Refresh

The SDK automatically handles token expiration for JWT/Bearer auth:

```typescript
auth: {
  type: 'bearer',
  token: 'expired-token',
  onTokenExpired: async () => {
    // Fetch new token
    const response = await fetch('/api/refresh-token');
    const { token } = await response.json();
    return token;
  }
}
```

## Performance Considerations

### Network Overhead

- **Default**: 3 retries max = 4 total attempts
- **Total Time**: ~7-8 seconds (1s + 2s + 4s delays)
- **Recommendation**: Use conservative retry limits for user-initiated actions

### LocalStorage Limits

- **Typical Limit**: 5-10 MB per origin
- **Queue Item Size**: ~1-5 KB per bug report
- **Recommendation**: Set `maxQueueSize` based on expected payload size

### Memory Impact

- Retry logic runs in-memory (no additional storage)
- Offline queue persists across sessions
- Queue processing is non-blocking (async)

## Troubleshooting

### Queue Not Processing

**Problem**: Queued requests aren't being sent

**Solutions**:

1. Check if `offline.enabled` is `true`
2. Verify network is available
3. Check browser console for errors
4. Inspect localStorage: `bugspotter_offline_queue`

### Retries Not Working

**Problem**: Requests aren't being retried

**Solutions**:

1. Check if status code is in `retryOn` list
2. Verify `maxRetries` > 0
3. Check network tab for retry attempts
4. Look for error logs

### Queue Size Issues

**Problem**: Queue fills up quickly

**Solutions**:

1. Increase `maxQueueSize`
2. Clear old requests: `clearOfflineQueue()`
3. Reduce bug report payload size
4. Check for network connectivity issues

## API Reference

### RetryConfig

| Property     | Type       | Default                | Description                   |
| ------------ | ---------- | ---------------------- | ----------------------------- |
| `maxRetries` | `number`   | `3`                    | Maximum retry attempts        |
| `baseDelay`  | `number`   | `1000`                 | Base delay in milliseconds    |
| `maxDelay`   | `number`   | `30000`                | Maximum delay in milliseconds |
| `retryOn`    | `number[]` | `[502, 503, 504, 429]` | HTTP status codes to retry    |

### OfflineConfig

| Property       | Type      | Default | Description             |
| -------------- | --------- | ------- | ----------------------- |
| `enabled`      | `boolean` | `false` | Enable offline queue    |
| `maxQueueSize` | `number`  | `10`    | Maximum queued requests |

### Functions

#### `clearOfflineQueue()`

Clears all queued requests from localStorage.

```typescript
import { clearOfflineQueue } from '@bugspotter/sdk';

clearOfflineQueue();
```

## Examples

### Example 1: Mobile App with Aggressive Retry

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'api-key', apiKey: process.env.API_KEY },

  retry: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    retryOn: [408, 429, 500, 502, 503, 504],
  },

  offline: {
    enabled: true,
    maxQueueSize: 30,
  },
});
```

### Example 2: Server-Side with Minimal Retry

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'bearer', token: serverToken },

  retry: {
    maxRetries: 1,
    baseDelay: 500,
    maxDelay: 5000,
    retryOn: [502, 503, 504],
  },

  offline: {
    enabled: false, // No localStorage in Node.js
  },
});
```

### Example 3: Rate-Limited API

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  auth: { type: 'api-key', apiKey: 'limited-key' },

  retry: {
    maxRetries: 3,
    baseDelay: 5000, // 5s base delay
    maxDelay: 120000, // Max 2 minutes
    retryOn: [429], // Only retry rate limits
  },
});
```

## Related Documentation

- [Transport Layer API](../packages/sdk/src/core/transport.ts)
- [Authentication Guide](./AUTH_INTEGRATION.md)
- [Error Handling](./ERROR_HANDLING.md)

---

**Version**: 0.2.0  
**Last Updated**: October 6, 2025
