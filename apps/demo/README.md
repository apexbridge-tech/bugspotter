# BugSpotter SDK - Interactive Demo

> Comprehensive demonstration of all BugSpotter SDK features with a modern, interactive UI

## 🚀 Quick Start

```bash
# From project root
npx browser-sync start --config apps/demo/bs-config.json
```

Visit: http://localhost:3002/apps/demo/index.html

## ✨ Features Demonstrated

### 1. **Console Capture** 📝
- Automatically captures all console messages (log, warn, error, info)
- Includes timestamps and stack traces
- Test buttons for each console level

### 2. **Network Monitoring** 🌐
- Tracks all HTTP requests (fetch & XHR)
- Captures URL, method, status, duration, and errors
- Demonstrates successful, failed, and batch requests

### 3. **Session Replay** 🎥
- Records DOM changes, clicks, scrolls, mouse movements
- 30-second circular buffer
- Interactive replay player with playback controls
- Speed controls (1x, 2x, 4x, 8x)

### 4. **PII Sanitization** 🔒
- Automatic detection of sensitive data:
  - Email addresses
  - Phone numbers
  - Credit card numbers
  - Social Security Numbers (SSN)
  - IP addresses
  - Individual Identification Numbers (IIN - Kazakhstan)
- Customizable pattern matching
- Live detection and sanitization demos

### 5. **Screenshot Capture** 📸
- Automatic page state capture
- Manual redaction tools
- Visual context for bug reports

### 6. **Bug Report Modal** 🪟
- Beautiful, accessible modal UI
- PII detection preview
- Manual redaction canvas
- Form validation
- Confirmation checkbox for PII

### 7. **Floating Widget** 🐛
- Customizable position and styling
- Configurable icon and colors
- One-click bug reporting

## 🎯 Interactive Features

### Console Testing
Click the console buttons to generate different log levels and see them captured in real-time.

### Network Testing
- **Success Button**: Makes a successful API call to JSONPlaceholder
- **Fail Button**: Triggers a 404 error
- **Batch Button**: Makes multiple simultaneous requests

### PII Testing
- **Test PII**: Detects sensitive data in sample text
- **Patterns**: Shows all supported PII patterns
- **Sanitize**: Demonstrates before/after sanitization

### Session Replay
- **Play**: Opens the replay player with recorded events
- **Info**: Displays buffer statistics
- **Test**: Changes DOM to record an interaction

## 🎨 Design Features

- **Modern Card-Based Layout**: Clean, organized sections
- **Color-Coded Badges**: Visual status indicators
- **Responsive Design**: Works on all screen sizes
- **Smooth Animations**: Enhanced user experience
- **Dark Output Console**: Easy-to-read JSON output
- **Scroll-to-Top Button**: Quick navigation

## 📊 SDK Configuration

The demo initializes BugSpotter with all features enabled:

```javascript
const bugSpotter = BugSpotter.BugSpotter.init({
  apiKey: 'demo-api-key-12345',
  endpoint: 'http://localhost:4000/api/bugs',
  showWidget: true,
  replay: {
    enabled: true,
    duration: 30,
    sampling: {
      mousemove: 50,
      scroll: 100,
    }
  },
  sanitize: {
    enabled: true,
    patterns: 'all',
  },
  widgetOptions: {
    position: 'bottom-right',
    icon: '🐛',
    backgroundColor: '#667eea',
    size: 56,
    offset: { x: 24, y: 24 },
  }
});
```

## 🧪 Testing Workflows

### 1. Basic Bug Report
1. Interact with the page (click buttons, scroll, etc.)
2. Click the floating widget or "Generate Full Bug Report"
3. View captured data in output console

### 2. Modal Submission
1. Click "Open Modal" button
2. Fill in title and description
3. Review PII detections (if any)
4. Use redaction tools on screenshot
5. Submit to see API response

### 3. Session Replay
1. Perform various interactions on the page
2. Click "Play" to watch your session replay
3. Use player controls to pause, change speed
4. Check "Info" to see buffer statistics

### 4. PII Sanitization
1. Click "Test PII" to see detection
2. Click "Sanitize" to see masking in action
3. Open modal with PII in description to see live detection

## 🔧 Customization

The demo can be customized by modifying:
- Widget icon, color, position
- PII patterns and presets
- Replay buffer duration
- API endpoint for submissions

## 📝 Notes

- The demo uses JSONPlaceholder for network testing (no real submissions)
- Backend mock server runs on `http://localhost:4000`
- All captured data is displayed in the output console
- Session replay uses rrweb for time-travel debugging

## 🎓 Learning Path

1. **Start Simple**: Test console and network capture
2. **Explore PII**: Understand detection and sanitization
3. **Try Replay**: See DOM recording in action
4. **Full Workflow**: Use modal to submit complete bug report
5. **Customize**: Modify SDK configuration to fit your needs

## 🐛 Known Features

- Canvas redaction works in browser but not in test environment (jsdom limitation)
- Session replay requires initial page load snapshot
- Network capture only tracks fetch/XHR (not image loads)

## 📚 Additional Resources

- [SDK Documentation](../../packages/sdk/README.md)
- [API Documentation](../../packages/api/README.md)
- [Pattern Configuration Guide](../../packages/sdk/docs/PATTERN_CONFIGURATION.md)
- [PII Features Guide](../../packages/sdk/docs/MODAL_PII_FEATURES.md)

---

**Happy Testing! 🚀**
