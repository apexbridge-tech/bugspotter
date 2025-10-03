# BugSpotter

> Professional bug reporting SDK for web applications

BugSpotter is a lightweight, professional SDK that enables users to capture and submit detailed bug reports directly from your web application. It automatically captures screenshots, console logs, network requests, and browser metadata to help developers reproduce and fix issues faster.

## ✨ Features

- 📸 **Automatic Screenshot Capture** - CSP-safe visual capture of the current page
- 📝 **Console Log Tracking** - Captures all console.log, warn, error, and info messages
- 🌐 **Network Request Monitoring** - Tracks fetch and XHR requests with timing data
- 🖥️ **Browser Metadata** - Collects browser, OS, viewport, and URL information
- 🎨 **Professional UI Widget** - Customizable floating button and modal
- 🔒 **Privacy-Focused** - All data stays in your control
- ⚡ **Zero Dependencies** - Minimal bundle size (29 KB minified)
- 🧪 **Fully Tested** - 129 passing tests with 100% type safety

## 📦 Project Structure

```
bugspotter/
├── packages/
│   ├── sdk/          # Core SDK (TypeScript + Webpack)
│   ├── backend-mock/ # Mock API server (testing/development)
│   ├── api/          # Production API server (Supabase + TypeScript)
│   └── widget/       # UI components (future package)
├── apps/
│   └── demo/         # Live demo application
├── docs/
│   ├── API_TESTING.md          # API testing guide
│   ├── ENHANCED_LOGGING.md     # Logging documentation
│   └── TECH_STACK.md          # Technology overview
└── scripts/          # Build and deployment scripts
```

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
    // Initialize BugSpotter
    const bugSpotter = BugSpotter.BugSpotter.init({
      apiKey: 'your-api-key',
      endpoint: 'https://your-api.com/api/bugs',
      showWidget: true  // Shows floating button automatically
    });
    
    console.log('✅ BugSpotter initialized');
  </script>
</body>
</html>
```

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

Visit: http://localhost:3000

### Running Tests

```bash
cd packages/sdk
pnpm test           # Run all 129 tests
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

Capture current bug report data.

**Returns:** `Promise<BugReport>`
```typescript
interface BugReport {
  screenshot: string;          // Base64 PNG image
  console: ConsoleLog[];       // Console entries
  network: NetworkRequest[];   // Network requests
  metadata: BrowserMetadata;   // Browser info
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

- **129 total tests** - All passing ✅
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
- API submission: 12 tests
- Core SDK: 27 tests

## 🏗️ Tech Stack

### Frontend SDK
- **TypeScript** - Type safety
- **Webpack** - Module bundling
- **html-to-image** - CSP-safe screenshots
- **Vitest** - Testing framework

### Backend (Mock)
- **Node.js** - Runtime
- **Express** - Web framework
- **CORS** - Cross-origin support

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

- **Bundle size**: 29.2 KB (minified)
- **Load time**: < 100ms
- **Screenshot capture**: ~500ms average
- **Memory usage**: < 10 MB
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
- Comprehensive tests
- Enhanced logging

### 🚧 In Progress
- Documentation improvements
- Performance optimizations
- Additional browser support

### ⏳ Planned
- NPM package publication
- React/Vue/Angular integrations
- Backend deployment templates
- Cloud storage integration
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
