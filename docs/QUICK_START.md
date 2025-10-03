# Quick Start Guide

Get BugSpotter up and running in 5 minutes! ⚡

## 🚀 Installation

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/apexbridge-tech/bugspotter.git
cd bugspotter

# Install dependencies (requires Node.js 18+)
pnpm install

# If you don't have pnpm:
npm install -g pnpm
```

### Step 2: Build the SDK

```bash
cd packages/sdk
pnpm run build
```

You should see:
```
✓ Build complete: dist/bugspotter.min.js (29.2 KB)
```

## 🧪 Run the Demo

### Terminal 1: Start Backend Server

```bash
cd packages/backend-mock
node server.js
```

Expected output:
```
┌─────────────────────────────────────────┐
│   BugSpotter Mock API Server Started   │
└─────────────────────────────────────────┘

🚀 Server running on http://localhost:4000
📡 Health check: http://localhost:4000/health
📝 Submit bugs: POST http://localhost:4000/api/bugs
📋 View bugs: GET http://localhost:4000/api/bugs

⏳ Waiting for bug reports...
```

### Terminal 2: Start Demo

```bash
cd apps/demo
npx browser-sync start --config bs-config.json
```

Expected output:
```
[Browsersync] Access URLs:
 -------------------------------------
       Local: http://localhost:3000/apps/demo/index.html
    External: http://172.24.95.186:3000/apps/demo/index.html
 -------------------------------------
```

### Step 3: Test It Out

1. **Open** http://localhost:3000 in your browser
2. **Click** some test buttons to generate logs
3. **Click** the ⚡ floating button (bottom-right corner)
4. **Fill out** the bug report form:
   - Title: "Test bug report"
   - Description: "Testing the demo"
5. **Click** "Submit Bug Report"
6. **Watch** Terminal 1 - you should see:

```
📝 Bug Report Received!
─────────────────────────────────────
✓ API Key: demo-api-key-12345
✓ Title: Test bug report
✓ Description: Testing the demo
✓ Console Logs: 5 entries
✓ Network Requests: 2 requests
✓ Screenshot: Captured
💾 Saved to: bug-bug-1-1759487456065.json

📋 Console Logs:
  1. [3:30:56 PM] LOG   🔵 This is a LOG message with data:
  2. [3:30:58 PM] WARN  ⚠️ This is a WARNING message:
  ...

🌐 Network Requests:
  1. GET    200  245ms  https://jsonplaceholder.typicode.com/posts/1
  2. GET    200  189ms  https://jsonplaceholder.typicode.com/posts/2
  ...

✓ Bug Report ID: bug-1
✓ Total Reports: 1
```

🎉 **Congratulations!** BugSpotter is working!

## 📚 Run Tests

```bash
cd packages/sdk
pnpm test
```

Expected output:
```
✓ tests/api-submission.test.ts (12 tests)
✓ tests/index.test.ts (27 tests)
✓ tests/widget/button.test.ts (19 tests)
✓ tests/widget/modal.test.ts (25 tests)
✓ tests/capture/console.test.ts (13 tests)
✓ tests/capture/network.test.ts (12 tests)
✓ tests/capture/screenshot.test.ts (5 tests)
✓ tests/capture/metadata.test.ts (16 tests)

Test Files  8 passed (8)
     Tests  129 passed (129)
  Start at  15:30:53
  Duration  4.51s
```

All 129 tests should pass! ✅

## 🔧 Integrate Into Your App

### Option 1: Copy the Built File

```bash
# Copy the built SDK to your project
cp packages/sdk/dist/bugspotter.min.js /path/to/your/project/js/
```

```html
<!-- Add to your HTML -->
<script src="js/bugspotter.min.js"></script>
<script>
  // Initialize BugSpotter
  const bugSpotter = BugSpotter.BugSpotter.init({
    apiKey: 'your-api-key',
    endpoint: 'https://your-backend.com/api/bugs',
    showWidget: true  // Floating button appears automatically
  });
  
  console.log('✅ BugSpotter ready!');
</script>
```

### Option 2: Custom Widget

```html
<script src="js/bugspotter.min.js"></script>
<script>
  // Initialize without auto-widget
  const bugSpotter = BugSpotter.BugSpotter.init({
    apiKey: 'your-api-key',
    endpoint: 'https://your-backend.com/api/bugs',
    showWidget: false
  });
  
  // Create custom button
  const button = new BugSpotter.FloatingButton({
    position: 'bottom-right',
    icon: '⚡',
    backgroundColor: '#1a365d',
    size: 48
  });
  
  // Handle clicks
  button.onClick(async () => {
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
          throw new Error('Failed to submit');
        }
        
        const result = await response.json();
        console.log('✅ Submitted:', result.bugId);
      }
    });
    
    modal.show(report.screenshot);
  });
</script>
```

## 🎯 What You Get

When a user submits a bug report, you receive:

```json
{
  "title": "Button not working",
  "description": "Clicking submit does nothing",
  "report": {
    "screenshot": "data:image/png;base64,...",
    "console": [
      {
        "level": "error",
        "message": "TypeError: Cannot read property 'value' of null",
        "timestamp": 1759487456065,
        "stack": "Error: ...\n  at handleClick (app.js:123)"
      }
    ],
    "network": [
      {
        "url": "https://api.example.com/submit",
        "method": "POST",
        "status": 500,
        "duration": 234,
        "timestamp": 1759487456000
      }
    ],
    "metadata": {
      "browser": "Chrome",
      "os": "macOS",
      "url": "https://myapp.com/checkout",
      "viewport": { "width": 1920, "height": 1080 },
      "userAgent": "Mozilla/5.0...",
      "timestamp": 1759487456065
    }
  }
}
```

## 📖 Next Steps

- **Read the [main README](../README.md)** for complete documentation
- **Check out [API Testing Guide](./API_TESTING.md)** for testing tips
- **Review [SDK API docs](../packages/sdk/README.md)** for advanced usage
- **See [Enhanced Logging](./ENHANCED_LOGGING.md)** for backend features

## ❓ Troubleshooting

### Port Already in Use

```bash
# Kill processes on ports
lsof -ti:4000 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Or change the port
PORT=5000 node server.js
```

### Build Fails

```bash
# Clean and rebuild
cd packages/sdk
rm -rf dist node_modules
pnpm install
pnpm run build
```

### Tests Fail

```bash
# Check Node version (need 18+)
node --version

# Reinstall dependencies
pnpm install

# Run tests with verbose output
pnpm test --reporter=verbose
```

### Browser Can't Connect

- Check the server is running
- Verify the URL matches (localhost:3000)
- Clear browser cache
- Check browser console for errors

## 🆘 Need Help?

- 📧 **Email:** support@apexbridge.tech
- 🐛 **Issues:** [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)
- 📚 **Docs:** [Full Documentation](../README.md)

---

**Happy Bug Spotting! 🐛⚡**
