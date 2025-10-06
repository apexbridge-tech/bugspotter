# API Testing Guide

This guide explains how to test the BugSpotter API integration.

## Setup

### 1. Start the Mock API Server

```bash
cd packages/backend-mock
PORT=4000 pnpm dev
```

The server will start on `http://localhost:4000` and display:

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

### 2. Start the Demo

```bash
cd apps/demo
npx browser-sync start --config bs-config.json
```

Visit: `http://localhost:3000/apps/demo/index.html`

## Testing Methods

### Method 1: Use the Demo UI

1. Open the demo in your browser
2. Click some test buttons to generate console logs and network requests
3. Click the floating button (⚡ bottom-right) or the "Show Bug Report Modal" button
4. Fill out the bug report form:
   - **Title**: "Test bug from demo"
   - **Description**: "Testing API integration"
5. Click "Submit Bug Report"
6. Check the mock API server terminal - you should see:

```
📝 Bug Report Received!
─────────────────────────────────────
✓ API Key: demo-api-key-12345
✓ Title: Test bug from demo
✓ Description: Testing API integration
✓ Console Logs: 5 entries
✓ Network Requests: 2 requests
✓ Screenshot: Captured
✓ Browser: Chrome
✓ OS: macOS
✓ URL: http://localhost:3000/apps/demo/index.html
✓ Viewport: 1920x1080
─────────────────────────────────────
✓ Bug Report ID: bug-1
✓ Total Reports: 1
```

7. Check the browser console - you should see:

```
Bug report submitted successfully
```

### Method 2: Run Automated Tests

```bash
# Run all tests including API submission tests
pnpm test

# Run only API submission tests
pnpm test -- api-submission.test.ts
```

All 162 tests should pass, including:

- ✅ Successful submission with API key
- ✅ Submission without API key
- ✅ JSON response handling
- ✅ Non-JSON response handling
- ✅ Error handling (4xx, 5xx)
- ✅ Network errors
- ✅ Timeout errors
- ✅ Payload structure validation
- ✅ Session replay event validation
- ✅ Circular buffer functionality
- ✅ DOM collector integration

### Method 3: Manual cURL Testing

```bash
# Submit a test bug report
curl -X POST http://localhost:4000/api/bugs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-api-key-12345" \
  -d '{
    "title": "Manual cURL Test",
    "description": "Testing API with cURL",
    "report": {
      "screenshot": "data:image/png;base64,test",
      "console": [
        {"level": "log", "message": "Test log", "timestamp": 1234567890}
      ],
      "network": [],
      "metadata": {
        "browser": "Chrome",
        "os": "Linux",
        "url": "http://localhost:3000",
        "viewport": {"width": 1920, "height": 1080}
      }
    }
  }'
```

Expected response:

```json
{
  "success": true,
  "bugId": "bug-1",
  "message": "Bug report received successfully",
  "timestamp": "2025-10-03T14:47:00.000Z"
}
```

### Method 4: Test Error Scenarios

```bash
# Test 400 Bad Request
curl -X POST http://localhost:4000/api/bugs/error/400

# Test 401 Unauthorized
curl -X POST http://localhost:4000/api/bugs/error/401

# Test 500 Internal Server Error
curl -X POST http://localhost:4000/api/bugs/error/500

# Test invalid API key
curl -X POST http://localhost:4000/api/bugs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-key" \
  -d '{"title":"test","description":"test","report":{}}'
```

### Method 5: View Submitted Reports

```bash
# Get all bug reports
curl http://localhost:4000/api/bugs

# Get specific bug report
curl http://localhost:4000/api/bugs/bug-1

# Clear all reports (reset for new tests)
curl -X DELETE http://localhost:4000/api/bugs
```

## What to Look For

### ✅ Successful Submission

- Server logs show formatted bug report details
- HTTP 201 status returned
- Bug ID assigned
- Data stored and retrievable via GET

### ✅ Error Handling

- Invalid API key → 401 Unauthorized
- Missing fields → 400 Bad Request
- Network errors caught and logged
- User-friendly error messages

### ✅ Data Integrity

- Screenshot captured (or SCREENSHOT_FAILED)
- Console logs preserved
- Network requests recorded
- Metadata complete (browser, OS, URL, viewport, timestamp)

## Troubleshooting

### Port Already in Use

If port 4000 is busy, change it:

```bash
PORT=5000 pnpm dev
```

Then update `apps/demo/index.html`:

```javascript
endpoint: 'http://localhost:5000/api/bugs';
```

### CORS Errors

The mock server has CORS enabled. If you see CORS errors:

1. Check the server is running
2. Verify the endpoint URL matches
3. Clear browser cache

### API Not Receiving Data

1. Check server terminal for errors
2. Open browser DevTools → Network tab
3. Look for the POST request to `/api/bugs`
4. Check request payload and response

## Production Considerations

This is a **mock server** for testing only. For production:

1. **Use a real database** (PostgreSQL, MongoDB, etc.)
2. **Implement proper authentication** (JWT, OAuth, etc.)
3. **Add rate limiting** to prevent abuse
4. **Validate and sanitize** all inputs
5. **Store screenshots** in cloud storage (S3, CloudFlare R2)
6. **Add monitoring** (error tracking, analytics)
7. **Use HTTPS** for all endpoints
8. **Implement backup** and disaster recovery
9. **Add logging** (structured logging, log aggregation)
10. **Deploy to production** infrastructure (Vercel, Railway, AWS)
