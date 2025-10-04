# Session Replay Feature

## Overview

The BugSpotter SDK now includes session replay functionality that captures DOM mutations, mouse movements, clicks, and scrolls using [rrweb](https://www.rrweb.io/). This feature maintains a circular buffer that keeps only the last 15-30 seconds of events (configurable), ensuring minimal memory footprint while providing valuable context for bug reports.

## Key Features

- **Circular Buffer**: Time-based buffer that automatically prunes events older than the configured duration
- **Performance Optimized**: Configurable sampling rates for mousemove and scroll events
- **Automatic Recording**: Starts recording when BugSpotter initializes
- **Minimal Overhead**: Slim DOM recording options to reduce payload size
- **Serializable Events**: All events are JSON-serializable for easy transmission

## Configuration

### Basic Setup

By default, session replay is enabled with a 15-second buffer:

```typescript
import { BugSpotter } from '@bugspotter/sdk';

BugSpotter.init({
  apiKey: 'your-api-key',
  endpoint: 'https://api.bugspotter.com',
});
```

### Custom Configuration

```typescript
BugSpotter.init({
  apiKey: 'your-api-key',
  endpoint: 'https://api.bugspotter.com',
  replay: {
    enabled: true,           // Enable/disable replay (default: true)
    duration: 30,            // Duration in seconds (default: 15, recommended max: 30)
    sampling: {
      mousemove: 50,        // Throttle mousemove events to every 50ms (default: 50)
      scroll: 100,          // Throttle scroll events to every 100ms (default: 100)
    },
  },
});
```

### Disabling Replay

```typescript
BugSpotter.init({
  apiKey: 'your-api-key',
  replay: {
    enabled: false,
  },
});
```

## How It Works

### 1. Automatic Recording

When BugSpotter initializes, the DOM collector automatically starts recording if replay is enabled:

```typescript
const bugspotter = BugSpotter.init(config);
// Recording starts automatically!
```

### 2. Circular Buffer

The circular buffer maintains only recent events:

- Events are timestamped as they're captured
- When new events are added, old events are automatically pruned
- Only events within the configured duration are kept

### 3. Bug Report Inclusion

When a bug is reported, the last N seconds of events are included:

```typescript
const report = await bugspotter.capture();
console.log(report.replay); // Array of rrweb events
```

### 4. Event Transmission

The replay events are included in the bug report payload:

```typescript
{
  title: "Bug title",
  description: "Bug description",
  report: {
    screenshot: "...",
    console: [...],
    network: [...],
    metadata: {...},
    replay: [...] // rrweb events
  }
}
```

## Event Types

The DOM collector captures the following event types:

- **DOM Mutations**: Element additions, removals, and attribute changes
- **Mouse Movements**: Throttled mousemove events
- **Mouse Interactions**: Clicks, double-clicks, context menu, etc.
- **Scroll Events**: Throttled scroll events
- **Viewport Resizes**: Window resize events
- **Input Changes**: Form input changes

## Performance Considerations

### Memory Usage

- The circular buffer automatically prunes old events
- Recommended duration: 15-30 seconds
- Longer durations = more memory usage

### Sampling Rates

Default sampling rates are optimized for performance:

- **Mousemove**: 50ms (20 events/second)
- **Scroll**: 100ms (10 events/second)

Adjust these based on your needs:

```typescript
replay: {
  sampling: {
    mousemove: 100, // Reduce to 10 events/second for better performance
    scroll: 200,    // Reduce to 5 events/second
  }
}
```

### Slim DOM Options

The collector uses slim DOM options by default:

- Doesn't record script tags
- Doesn't record comments
- Doesn't record certain meta tags
- Doesn't inline images (reduces payload size)

## Advanced Usage

### Direct Access to DOM Collector

You can access the DOM collector directly for advanced use cases:

```typescript
import { DOMCollector } from '@bugspotter/sdk';

const collector = new DOMCollector({
  duration: 20,
  sampling: {
    mousemove: 100,
    scroll: 200,
  },
});

// Start recording
collector.startRecording();

// Get events
const events = collector.getEvents();

// Clear buffer
collector.clearBuffer();

// Stop recording
collector.stopRecording();

// Clean up
collector.destroy();
```

### Direct Access to Circular Buffer

```typescript
import { CircularBuffer } from '@bugspotter/sdk';

const buffer = new CircularBuffer({
  duration: 30, // 30 seconds
});

// Add events
buffer.add(event);
buffer.addBatch([event1, event2, event3]);

// Get events
const events = buffer.getEvents();

// Change duration
buffer.setDuration(60); // Change to 60 seconds

// Clear buffer
buffer.clear();
```

## Edge Cases

### Iframes

The collector handles iframes gracefully:

- Cross-origin iframes are not recorded by default (security restriction)
- Same-origin iframes can be recorded with `recordCrossOriginIframes: true`

### Shadow DOM

Shadow DOM is handled automatically by rrweb.

### Single Page Applications

The collector works seamlessly with SPAs - it captures all DOM changes regardless of routing.

## Troubleshooting

### High Memory Usage

If you're experiencing high memory usage:

1. Reduce the buffer duration: `duration: 10`
2. Increase sampling rates: `mousemove: 200, scroll: 300`
3. Check for memory leaks in your application

### Missing Events

If events seem to be missing:

1. Verify replay is enabled: `replay.enabled: true`
2. Check the buffer duration is sufficient
3. Verify events are within the time window

### Performance Issues

If you're experiencing performance issues:

1. Increase sampling rates to reduce event frequency
2. Reduce buffer duration
3. Consider disabling replay in development mode

## Browser Compatibility

Session replay works in all modern browsers that support:

- MutationObserver API
- ES6 features
- Proxy API

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Dependencies

- `rrweb@^2.0.0-alpha.4`: Core recording library
- `rrweb-snapshot@^2.0.0-alpha.4`: DOM snapshot library
- `@rrweb/types@^2.0.0-alpha.18`: TypeScript types

## API Reference

### BugSpotterConfig.replay

```typescript
interface ReplayConfig {
  enabled?: boolean;     // Default: true
  duration?: number;     // Default: 15 seconds
  sampling?: {
    mousemove?: number; // Default: 50ms
    scroll?: number;    // Default: 100ms
  };
}
```

### DOMCollector

```typescript
class DOMCollector {
  constructor(config?: DOMCollectorConfig);
  startRecording(): void;
  stopRecording(): void;
  getEvents(): eventWithTime[];
  getCompressedEvents(): eventWithTime[];
  clearBuffer(): void;
  isCurrentlyRecording(): boolean;
  getBufferSize(): number;
  setDuration(seconds: number): void;
  getDuration(): number;
  destroy(): void;
}
```

### CircularBuffer

```typescript
class CircularBuffer {
  constructor(config: CircularBufferConfig);
  add(event: eventWithTime): void;
  addBatch(events: eventWithTime[]): void;
  getEvents(): eventWithTime[];
  getCompressedEvents(): eventWithTime[];
  clear(): void;
  size(): number;
  setDuration(seconds: number): void;
  getDuration(): number;
}
```

## Examples

### Example 1: Capturing a Bug Report

```typescript
const bugspotter = BugSpotter.init({
  apiKey: 'your-api-key',
  replay: {
    duration: 20,
  },
});

// ... user interacts with the app ...

// When user reports a bug
const report = await bugspotter.capture();
console.log(report.replay.length); // Number of events captured
```

### Example 2: Custom Sampling

```typescript
BugSpotter.init({
  apiKey: 'your-api-key',
  replay: {
    duration: 15,
    sampling: {
      mousemove: 200,  // Less frequent mousemove events
      scroll: 300,     // Less frequent scroll events
    },
  },
});
```

### Example 3: Programmatic Control

```typescript
import { BugSpotter, DOMCollector } from '@bugspotter/sdk';

// Initialize without auto-start
const bugspotter = BugSpotter.init({
  apiKey: 'your-api-key',
  replay: {
    enabled: false,
  },
});

// Manually create and control collector
const collector = new DOMCollector({ duration: 30 });

// Start recording when needed
document.getElementById('start-btn').addEventListener('click', () => {
  collector.startRecording();
});

// Stop recording when needed
document.getElementById('stop-btn').addEventListener('click', () => {
  collector.stopRecording();
});
```

## License

See main package LICENSE file.
