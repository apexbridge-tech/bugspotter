# @bugspotter/sdk

> Core SDK for capturing and reporting bugs

The BugSpotter SDK provides a comprehensive solution for capturing bug reports in web applications, including screenshots, console logs, network requests, and browser metadata.

## 📦 Installation

```bash
# From local build
pnpm install
pnpm run build
```

The built SDK will be available at `dist/bugspotter.min.js` (~99 KB minified with session replay).

## 🚀 Quick Start

### Basic Usage

```html
<script src="path/to/bugspotter.min.js"></script>
<script>
  // Initialize with auto-widget
  const bugSpotter = BugSpotter.init({
    apiKey: 'your-api-key',
    endpoint: 'https://api.example.com/bugs',
    showWidget: true,
  });
</script>
```

### Manual Capture

```javascript
// Initialize without widget
const bugSpotter = BugSpotter.init({
  apiKey: 'your-api-key',
  endpoint: 'https://api.example.com/bugs',
  showWidget: false,
});

// Capture bug report manually
async function reportBug() {
  const report = await bugSpotter.capture();
  console.log('Captured:', report);
  // report contains: screenshot, console, network, metadata
}
```

## 🎨 Using the Widget

### Automatic Widget

```javascript
// Widget appears automatically with showWidget: true
const bugSpotter = BugSpotter.init({
  apiKey: 'demo-key',
  endpoint: 'http://localhost:4000/api/bugs',
  showWidget: true,
  widgetOptions: {
    position: 'bottom-right',
    icon: '⚡',
    backgroundColor: '#1a365d',
    size: 48,
  },
});
```

### Custom Widget

```javascript
// Create custom floating button
const button = new BugSpotter.FloatingButton({
  position: 'bottom-right',
  icon: '🐛',
  backgroundColor: '#ff4444',
  size: 56,
  offset: { x: 24, y: 24 },
  style: {
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    border: '2px solid white',
  },
});

// Handle click
button.onClick(async () => {
  const report = await bugSpotter.capture();

  const modal = new BugSpotter.BugReportModal({
    onSubmit: async (data) => {
      // data.title, data.description
      const response = await fetch('https://api.example.com/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...data,
          report,
        }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }
    },
  });

  modal.show(report.screenshot);
});

// Control button
button.show();
button.hide();
button.setIcon('⚠️');
button.setBackgroundColor('#00ff00');
```

## 🔒 PII Sanitization

Automatic detection and masking of sensitive data before submission.

**Built-in patterns:** Email, phone, credit card, SSN, Kazakhstan IIN, IP address

```javascript
BugSpotter.init({
  sanitize: {
    enabled: true, // Default
    patterns: ['email', 'phone', 'creditcard'],
    customPatterns: [{ name: 'api-key', regex: /API[-_]KEY:\s*[\w-]{20,}/gi }],
    excludeSelectors: ['.public-email'],
  },
});
```

**Performance:** <10ms overhead, supports Cyrillic text

## �📋 API Reference

### BugSpotter Class

#### `BugSpotter.init(config)`

Initialize the SDK.

**Parameters:**

```typescript
interface BugSpotterConfig {
  apiKey?: string; // API key for authentication
  endpoint?: string; // Backend API URL
  showWidget?: boolean; // Auto-show widget (default: true)
  widgetOptions?: FloatingButtonOptions;
  replay?: {
    // Session replay configuration
    enabled?: boolean; // Enable replay (default: true)
    duration?: number; // Buffer duration in seconds (default: 15)
    sampling?: {
      mousemove?: number; // Mousemove throttle in ms (default: 50)
      scroll?: number; // Scroll throttle in ms (default: 100)
    };
  };
  sanitize?: {
    // PII sanitization configuration
    enabled?: boolean; // Enable PII sanitization (default: true)
    patterns?: Array<
      // PII patterns to detect
      'email' | 'phone' | 'creditcard' | 'ssn' | 'iin' | 'ip' | 'custom'
    >;
    customPatterns?: Array<{
      // Custom regex patterns
      name: string; // Pattern name for [REDACTED-NAME]
      regex: RegExp; // Detection regex
    }>;
    excludeSelectors?: string[]; // CSS selectors to exclude from sanitization
  };
}
```

**Returns:** `BugSpotter` instance

#### `bugSpotter.capture()`

Capture current bug report data.

**Returns:** `Promise<BugReport>`

```typescript
interface BugReport {
  screenshot: string; // Base64 PNG data URL
  console: ConsoleLog[]; // Array of console entries
  network: NetworkRequest[]; // Array of network requests
  metadata: BrowserMetadata; // Browser/system info
  replay: eventWithTime[]; // Session replay events (rrweb format)
}

interface ConsoleLog {
  level: string; // 'log', 'warn', 'error', 'info', 'debug'
  message: string; // Formatted message
  timestamp: number; // Unix timestamp
  stack?: string; // Error stack trace (for errors)
}

interface NetworkRequest {
  url: string; // Request URL
  method: string; // HTTP method
  status: number; // HTTP status code
  duration: number; // Request duration in ms
  timestamp: number; // Unix timestamp
  error?: string; // Error message if failed
}

interface BrowserMetadata {
  userAgent: string;
  viewport: { width: number; height: number };
  browser: string; // Detected browser name
  os: string; // Detected OS
  url: string; // Current page URL
  timestamp: number; // Capture timestamp
}
```

#### `bugSpotter.getConfig()`

Get current configuration.

**Returns:** `Readonly<BugSpotterConfig>`

#### `bugSpotter.destroy()`

Clean up and destroy the SDK instance.

### FloatingButton Class

#### Constructor

```typescript
new FloatingButton(options?: FloatingButtonOptions)

interface FloatingButtonOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  icon?: string;            // Emoji or text
  backgroundColor?: string; // CSS color
  size?: number;           // Size in pixels
  offset?: { x: number; y: number };
  style?: Record<string, string>; // Additional CSS
}
```

#### Methods

- `button.onClick(handler: () => void | Promise<void>)` - Set click handler
- `button.show()` - Show the button
- `button.hide()` - Hide the button
- `button.setIcon(icon: string)` - Change icon
- `button.setBackgroundColor(color: string)` - Change color
- `button.destroy()` - Remove button from DOM

### BugReportModal Class

#### Constructor

```typescript
new BugReportModal(options: BugReportModalOptions)

interface BugReportModalOptions {
  onSubmit: (data: BugReportData) => void | Promise<void>;
  onClose?: () => void;
}

interface BugReportData {
  title: string;
  description: string;
}
```

#### Methods

- `modal.show(screenshot: string)` - Display modal with screenshot
- `modal.close()` - Close the modal
- `modal.destroy()` - Remove modal from DOM

**Features:**

- Form validation (title and description required)
- Loading state during async submission
- Error handling with user feedback
- Escape key to close
- Click X button to close
- Cannot close by clicking outside (prevents data loss)

## 📊 Capture Modules

The SDK automatically captures:

- **📸 Screenshots** - CSP-safe full page capture (~500ms)
- **🎥 Session Replay** - Last 15-30s of user interactions (rrweb)
- **📝 Console** - All log levels with stack traces
- **🌐 Network** - fetch/XHR timing and responses
- **💻 Metadata** - Browser, OS, viewport, URL

See [Session Replay Documentation](docs/SESSION_REPLAY.md) for detailed configuration.

### Screenshot Capture

```typescript
import { ScreenshotCapture } from '@bugspotter/sdk';

const screenshotCapture = new ScreenshotCapture();
const screenshot = await screenshotCapture.capture();
// Returns: Base64 PNG data URL or 'SCREENSHOT_FAILED'
```

**Features:**

- CSP-safe using `html-to-image`
- Full page capture
- Automatic error handling
- ~500ms average capture time

### Console Capture

```typescript
import { ConsoleCapture } from '@bugspotter/sdk';

const consoleCapture = new ConsoleCapture();
const logs = consoleCapture.getLogs();
```

**Features:**

- Captures: log, warn, error, info, debug
- Stack traces for errors
- Timestamps for all entries
- Object stringification
- Circular reference handling
- Configurable max logs (default: 100)

### Network Capture

```typescript
import { NetworkCapture } from '@bugspotter/sdk';

const networkCapture = new NetworkCapture();
const requests = networkCapture.getRequests();
```

**Features:**

- Captures fetch() and XMLHttpRequest
- Request/response timing
- HTTP status codes
- Error tracking
- Singleton pattern (one instance per page)

### Metadata Capture

```typescript
import { MetadataCapture } from '@bugspotter/sdk';

const metadataCapture = new MetadataCapture();
const metadata = metadataCapture.capture();
```

**Features:**

- Browser detection (Chrome, Firefox, Safari, Edge, etc.)
- OS detection (Windows, macOS, Linux, iOS, Android)
- Viewport dimensions
- User agent string
- Current URL
- Timestamp

## 🧪 Testing

```bash
pnpm test              # All tests
pnpm test --watch      # Watch mode
pnpm test --coverage   # Coverage report
```

**404 tests** passing (348 unit + 55 E2E + 13 Playwright)

## �️ Building

```bash
pnpm run dev    # Development with watch
pnpm run build  # Production build
```

Output: `dist/bugspotter.min.js` (~99 KB)

## 📈 Performance

- **Bundle**: ~99 KB minified
- **Load**: < 100ms
- **Memory**: < 15 MB (30s replay buffer)
- **Screenshot**: ~500ms
- **PII sanitization**: <10ms

## 🔒 Security

- CSP-safe (no eval, no inline scripts)
- Automatic PII detection and masking
- Input validation
- HTTPS recommended

## 🤝 Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) guide.

## 📄 License

MIT License - see [LICENSE](../../LICENSE)

---

Part of the [BugSpotter](../../README.md) project
