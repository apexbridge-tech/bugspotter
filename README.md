# BugSpotter

> Professional bug reporting SDK with session replay for web applications

BugSpotter is a lightweight, professional SDK that enables users to capture and submit detailed bug reports directly from your web application. It automatically captures screenshots, console logs, network requests, **session replays**, and browser metadata to help developers reproduce and fix issues faster.

## ✨ Features

- 🎥 **Session Replay** - Record and replay user interactions with rrweb
- 🔒 **PII Sanitization** - Automatic detection and masking of sensitive data (NEW!)
- 📸 **Automatic Screenshot Capture** - CSP-safe visual capture of the current page
- 📝 **Console Log Tracking** - Captures all console.log, warn, error, and info messages
- 🌐 **Network Request Monitoring** - Tracks fetch and XHR requests with timing data
- 🖥️ **Browser Metadata** - Collects browser, OS, viewport, and URL information
- 🎨 **Professional UI Widget** - Customizable floating button and modal
- 🔒 **Privacy-Focused** - All data stays in your control with built-in PII protection
- ⚡ **Lightweight** - ~99 KB minified (includes rrweb)
- 🧪 **Fully Tested** - 226 passing tests with 100% type safety

## 🎬 Session Replay

BugSpotter now includes powerful session replay functionality powered by [rrweb](https://www.rrweb.io/):

- **Records user interactions** - Clicks, scrolls, mouse movements, and form inputs
- **Circular buffer** - Keeps last 15-30 seconds of activity (configurable)
- **Minimal overhead** - Optimized sampling and performance
- **Playback in demo** - Built-in replay player for testing

```javascript
BugSpotter.init({
  apiKey: 'your-api-key',
  replay: {
    enabled: true,
    duration: 30,  // Keep last 30 seconds
    sampling: {
      mousemove: 50,  // Throttle to 50ms
      scroll: 100     // Throttle to 100ms
    }
  }
});
```

See [Session Replay Documentation](./packages/sdk/docs/SESSION_REPLAY.md) for details.

## 🔒 PII Sanitization

Protect sensitive user data with automatic PII detection before sending bug reports:

- **Email addresses** - `user@example.com` → `[REDACTED-EMAIL]`
- **Phone numbers** - International formats including Kazakhstan
- **Credit cards** - All major card formats
- **Social Security Numbers** - US SSN patterns
- **Kazakhstan IIN/BIN** - With birth date validation
- **IP addresses** - IPv4 and IPv6
- **Custom patterns** - Define your own regex patterns

```javascript
BugSpotter.init({
  apiKey: 'your-api-key',
  sanitize: {
    enabled: true,
    patterns: ['email', 'phone', 'creditcard', 'ssn', 'iin', 'ip'],
    customPatterns: [
      { name: 'api-key', regex: /API[-_]KEY:\s*[\w-]{20,}/gi }
    ],
    excludeSelectors: ['.public-email']
  }
});
```

**Sanitization applies to:**
- Console logs and error messages
- Network request/response data
- DOM text content in session replays
- Browser metadata (URLs, user agents)

**Performance:** <10ms overhead per bug report with full Unicode/Cyrillic support.

## 📦 Project Structure

```
bugspotter/
├── packages/
│   ├── sdk/          # Core SDK (TypeScript + Webpack) + Session Replay
│   ├── types/        # Shared TypeScript types
│   ├── backend-mock/ # Mock API server (testing/development)
│   └── api/          # Production API server (Supabase + TypeScript)
├── apps/
│   └── demo/         # Live demo with replay player
├── docs/
│   ├── QUICK_START.md         # Getting started guide
│   ├── API_TESTING.md         # API testing guide
│   ├── ENHANCED_LOGGING.md    # Backend logging features
│   └── TECH_STACK.md         # Technology overview
└── scripts/          # Build and deployment scripts
```

## 📚 Documentation

### Quick Links
- 🚀 [Quick Start Guide](./docs/QUICK_START.md) - Get up and running in 5 minutes
- 🎥 [Session Replay Guide](./packages/sdk/docs/SESSION_REPLAY.md) - Learn about replay features
- 🎮 [Demo Guide](./apps/demo/REPLAY_DEMO.md) - Try the interactive demo
- 📖 [SDK API Reference](./packages/sdk/README.md) - Complete API documentation
- 🧪 [API Testing](./docs/API_TESTING.md) - Test backend integration
- 🛠️ [Tech Stack](./docs/TECH_STACK.md) - Technologies used

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/apexbridge-tech/bugspotter.git
cd bugspotter

# Install dependencies
pnpm install

# Build the SDK
cd packages/sdk
pnpm run build
```

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <h1>My Application</h1>
  
  <!-- Include BugSpotter SDK -->
  <script src="path/to/bugspotter.min.js"></script>
  <script>
    // Initialize BugSpotter with session replay
    const bugSpotter = BugSpotter.BugSpotter.init({
      apiKey: 'your-api-key',
      endpoint: 'https://your-api.com/api/bugs',
      showWidget: true,  // Shows floating button automatically
      replay: {
        enabled: true,
        duration: 30  // Record last 30 seconds
      }
    });
    
    console.log('✅ BugSpotter initialized with session replay');
  </script>
</body>
</html>
```

### Try the Demo

```bash
# Terminal 1: Start backend
cd packages/backend-mock
node server.js

# Terminal 2: Start demo
cd apps/demo
npx browser-sync start --config bs-config.json
```

Visit **http://localhost:3000/apps/demo/index.html** and click **"▶️ Play Session Replay"** to see it in action!

## 📖 Documentation

- [API Testing Guide](./docs/API_TESTING.md) - Test the API integration
- [Enhanced Logging](./docs/ENHANCED_LOGGING.md) - Backend logging features
- [Tech Stack](./docs/TECH_STACK.md) - Technologies used

### Advanced Usage with Custom Widget

```javascript
// Initialize SDK without auto-widget
const bugSpotter = BugSpotter.BugSpotter.init({
  apiKey: 'your-api-key',
  endpoint: 'https://your-api.com/api/bugs',
  showWidget: false  // We'll create our own widget
});

// Create custom floating button
const floatingButton = new BugSpotter.FloatingButton({
  position: 'bottom-right',
  icon: '⚡',
  backgroundColor: '#1a365d',
  size: 48,
  offset: { x: 24, y: 24 }
});

// Handle bug report submissions
floatingButton.onClick(async () => {
  const report = await bugSpotter.capture();
  
  const modal = new BugSpotter.BugReportModal({
    onSubmit: async (data) => {
      // Submit to your API
      const response = await fetch(bugSpotter.getConfig().endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bugSpotter.getConfig().apiKey}`
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          report: report
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit bug report');
      }
      
      const result = await response.json();
      console.log('✅ Bug submitted:', result.bugId);
    }
  });
  
  modal.show(report.screenshot);
});
```

## 🧪 Development

### Running the Demo

```bash
# Terminal 1: Start the mock backend server
cd packages/backend-mock
node server.js

# Terminal 2: Start the demo
cd apps/demo
npx browser-sync start --config bs-config.json
```

Visit: **http://localhost:3000/apps/demo/index.html**

**Demo Features:**
- ✅ Test all capture features (console, network, metadata, screenshot)
- ✅ **Play session replay** with interactive player
- ✅ Submit bug reports to mock backend
- ✅ View captured data in real-time
- ✅ Customize widget appearance

### Running Tests

```bash
cd packages/sdk
pnpm test           # Run all 162 tests
pnpm test --watch   # Watch mode
pnpm test --ui      # Visual UI mode
```

### Building

```bash
cd packages/sdk
pnpm run build      # Production build
pnpm run dev        # Development build with watch mode
```

## 📚 API Documentation

### BugSpotter.init(config)

Initialize the SDK with configuration options.

**Parameters:**
- `config.apiKey` (optional) - API key for authentication
- `config.endpoint` (optional) - Backend API endpoint URL
- `config.showWidget` (optional) - Auto-show floating button (default: true)
- `config.widgetOptions` (optional) - Customize widget appearance

**Returns:** `BugSpotter` instance

### bugSpotter.capture()

Capture current bug report data including session replay.

**Returns:** `Promise<BugReport>`
```typescript
interface BugReport {
  screenshot: string;          // Base64 PNG image
  console: ConsoleLog[];       // Console entries
  network: NetworkRequest[];   // Network requests
  metadata: BrowserMetadata;   // Browser info
  replay: eventWithTime[];     // Session replay events (NEW!)
}
```

### BugReportModal

Display modal for bug report submission.

**Constructor:**
```typescript
new BugReportModal({
  onSubmit: async (data: BugReportData) => {
    // Handle submission (supports async)
    // data.title: string
    // data.description: string
  },
  onClose: () => {
    // Optional: handle modal close
  }
})
```

**Methods:**
- `modal.show(screenshot)` - Display modal with screenshot
- `modal.close()` - Close modal
- `modal.destroy()` - Clean up modal

## 🎨 Widget Customization

```javascript
const button = new BugSpotter.FloatingButton({
  position: 'bottom-right',  // or 'bottom-left', 'top-right', 'top-left'
  icon: '🐛',                // Any emoji or text
  backgroundColor: '#ff0000', // CSS color
  size: 56,                   // Button size in pixels
  offset: { x: 20, y: 20 },  // Position offset
  style: {                    // Additional CSS
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    border: '2px solid white'
  }
});

// Dynamic updates
button.setIcon('⚠️');
button.setBackgroundColor('#00ff00');
button.show();
button.hide();
```

## 📖 Documentation

- [API Testing Guide](./docs/API_TESTING.md) - Test the API integration
- [Enhanced Logging](./docs/ENHANCED_LOGGING.md) - Backend logging features
- [Tech Stack](./docs/TECH_STACK.md) - Technologies used

## 🧪 Testing

The SDK includes comprehensive test coverage:

- **162 total tests** - All passing ✅
- **Unit tests** - Individual components
- **Integration tests** - Widget + SDK + Modal
- **API tests** - Submission and error handling
- **E2E tests** - Full user workflows

Test breakdown:
- Console capture: 13 tests
- Network capture: 12 tests
- Screenshot capture: 5 tests
- Metadata capture: 16 tests
- Button widget: 19 tests
- Modal widget: 25 tests
- **Session replay**: 30 tests (circular buffer + DOM collector)
- API submission: 12 tests
- Core SDK: 30 tests

## 🏗️ Tech Stack

### Frontend SDK
- **TypeScript** - Type safety
- **Webpack** - Module bundling
- **html-to-image** - CSP-safe screenshots
- **rrweb** - Session replay recording
- **rrweb-player** - Replay playback (demo only)
- **Vitest** - Testing framework

### Backend (Mock)
- **Node.js** - Runtime
- **Express** - Web framework
- **CORS** - Cross-origin support
- **Persistent storage** - JSON database

### Development
- **pnpm** - Package management
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🔒 Security & Privacy

- **CSP-safe** - Compatible with Content Security Policy
- **No external dependencies** - All data processing happens locally
- **Optional API submission** - You control where data goes
- **Bearer token auth** - Secure API key transmission
- **Input validation** - Sanitized user inputs

## 📊 Performance

- **Bundle size**: ~99 KB (minified, with rrweb)
- **Load time**: < 100ms
- **Screenshot capture**: ~500ms average
- **Session replay**: Minimal overhead (throttled events)
- **PII sanitization**: <10ms per bug report
- **Memory usage**: < 15 MB (with 30s replay buffer)
- **Zero runtime impact** - Only active when capturing

## 🛣️ Roadmap

### ✅ Completed
- Core SDK architecture
- Console log capture
- Network request monitoring
- Browser metadata collection
- Screenshot capture (CSP-safe)
- Professional widget UI
- Bug report modal
- API integration
- Comprehensive tests (226 passing)
- Enhanced backend logging
- **Session replay with rrweb**
- **Circular buffer for replay events**
- **Interactive replay player in demo**
- **Persistent JSON database**
- **PII detection and sanitization**
- **Kazakhstan IIN/BIN support**
- **Cyrillic text handling**
- **Custom regex patterns**

### 🚧 In Progress
- Documentation consolidation
- Performance optimizations
- Additional browser testing

### ⏳ Planned
- NPM package publication
- Replay event compression
- React/Vue/Angular integrations
- Backend deployment templates
- Cloud storage integration (S3, Azure Blob)
- Analytics dashboard
- Team collaboration features
- Custom themes
- Mobile SDK (React Native)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

```bash
# Fork the repo
# Create a feature branch
git checkout -b feature/amazing-feature

# Make changes and test
pnpm test

# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with ❤️ by the ApexBridge team
- Inspired by modern bug tracking tools
- Thanks to all contributors

## 📞 Support

- 📧 Email: support@apexbridge.tech
- 🐛 Issues: [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)

---

Made with ⚡ by [ApexBridge](https://apexbridge.tech)
