# Enhanced Mock API Server - Logging Features

The mock API server now provides detailed logging of all received bug reports with the following enhancements:

## Features

### 📋 Detailed Console Log Display
When a bug report is received, the server displays each console entry with:
- Timestamp (formatted as local time)
- Log level (LOG, WARN, ERROR, INFO)
- Message content (truncated to 80 characters for readability)
- Shows first 10 entries, with count of remaining entries

Example output:
```
📋 Console Logs:
  1. [9:00:00 PM] LOG   Button clicked
  2. [9:00:01 PM] WARN  Slow API response
  3. [9:00:02 PM] ERROR Failed to load data
```

### 🌐 Network Request Summary
Displays network activity with:
- Request method (GET, POST, etc.)
- HTTP status code
- Request duration in milliseconds
- Full URL (truncated to 60 characters)
- Shows first 5 requests, with count of remaining

Example output:
```
🌐 Network Requests:
  1. GET    200  145ms  https://api.example.com/users/123
  2. POST   201  234ms  https://api.example.com/posts
  3. GET    500  1234ms https://api.example.com/settings
```

### 💾 Automatic File Saving
Each bug report is automatically saved to:
- **Directory**: `packages/backend/bug-reports/`
- **Filename**: `bug-{id}-{timestamp}.json`
- **Format**: Pretty-printed JSON (2-space indentation)
- **Contents**: Complete bug report including all captured data

Example filename: `bug-bug-1-1759486038333.json`

### ✓ Enhanced Summary Output
The terminal displays a comprehensive summary:
```
📝 Bug Report Received!
─────────────────────────────────────
✓ API Key: demo-api-key-12345
💾 Saved to: bug-bug-1-1759486038333.json
✓ Title: Enhanced Logging Test
✓ Description: Testing detailed console and network logging
✓ Console Logs: 3 entries
✓ Network Requests: 2 requests
✓ Screenshot: Captured
✓ Browser: Chrome
✓ OS: macOS
✓ URL: http://localhost:3000
✓ Viewport: 1920x1080

📋 Console Logs:
  [detailed list]

🌐 Network Requests:
  [detailed list]
  
─────────────────────────────────────
✓ Bug Report ID: bug-1
✓ Total Reports: 1
```

## Benefits

1. **Immediate Visibility**: See exactly what data was captured without manual inspection
2. **Debugging Aid**: Quickly identify issues in console logs and network requests
3. **Audit Trail**: All reports saved to disk for later review
4. **Performance Insights**: See request durations and identify slow endpoints
5. **Error Detection**: Quickly spot failed network requests or error logs

## File Structure

```
packages/backend/
├── server.js
├── bug-reports/           # Auto-created directory
│   ├── bug-bug-1-*.json
│   ├── bug-bug-2-*.json
│   └── ...
└── .gitignore            # Excludes bug-reports/ from git
```

## Viewing Saved Reports

### View latest report:
```bash
cat packages/backend/bug-reports/$(ls -t packages/backend/bug-reports/ | head -1)
```

### List all reports:
```bash
ls -lh packages/backend/bug-reports/
```

### Count reports:
```bash
ls packages/backend/bug-reports/*.json | wc -l
```

### Search reports by title:
```bash
grep -l "title.*Login" packages/backend/bug-reports/*.json
```

### View console logs from a report:
```bash
cat packages/backend/bug-reports/bug-bug-1-*.json | jq '.report.console'
```

### View network requests:
```bash
cat packages/backend/bug-reports/bug-bug-1-*.json | jq '.report.network'
```

## Configuration

No configuration needed - logging is enabled by default.

To disable file saving (console logging only), comment out the file write section in `server.js`.

## Cleanup

To remove all saved reports:
```bash
rm -rf packages/backend/bug-reports/*.json
```

Or use the API endpoint:
```bash
curl -X DELETE http://localhost:4000/api/bugs
```

Note: The DELETE endpoint only clears in-memory reports, not saved files.
