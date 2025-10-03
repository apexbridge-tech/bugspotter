# BugSpotter Mock API Server

⚠️ **For Testing & Development Only**

A lightweight mock API server for testing BugSpotter SDK integration during development. This is **not** intended for production use.

For production deployment, use the production-ready API server at `/packages/api` with Supabase integration.

## Features

- ✅ Accepts bug report submissions
- ✅ Validates API keys
- ✅ Stores reports in memory
- ✅ **Detailed console logging** with formatted output
- ✅ **Network request summary** display
- ✅ **Automatic file saving** to `bug-reports/` directory
- ✅ Provides detailed console logging
- ✅ Supports error simulation
- ✅ CORS enabled for local development

## Quick Start

### Install Dependencies
```bash
pnpm install
```

### Start Server
```bash
pnpm dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Health Check
```bash
GET /health
```

Returns server status.

### Submit Bug Report
```bash
POST /api/bugs
```

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <api-key>` (optional)

**Body:**
```json
{
  "title": "Bug title",
  "description": "Bug description",
  "report": {
    "screenshot": "data:image/png;base64,...",
    "console": [...],
    "network": [...],
    "metadata": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "bugId": "bug-1",
  "message": "Bug report received successfully",
  "timestamp": "2025-10-03T14:47:00.000Z"
}
```

### Get All Bug Reports
```bash
GET /api/bugs
```

Returns all submitted bug reports.

### Get Single Bug Report
```bash
GET /api/bugs/:id
```

Returns a specific bug report by ID.

### Delete All Bug Reports
```bash
DELETE /api/bugs
```

Clears all bug reports (for testing).

### Simulate Errors
```bash
POST /api/bugs/error/:code
```

Simulates HTTP error responses for testing. Supported codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## Testing with cURL

### Submit a bug report:
```bash
curl -X POST http://localhost:3001/api/bugs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-api-key-12345" \
  -d '{
    "title": "Test Bug",
    "description": "This is a test bug report",
    "report": {
      "screenshot": "data:image/png;base64,test",
      "console": [],
      "network": [],
      "metadata": {
        "browser": "Chrome",
        "os": "macOS",
        "url": "http://localhost:3000"
      }
    }
  }'
```

### View all bugs:
```bash
curl http://localhost:3001/api/bugs
```

### Test error response:
```bash
curl -X POST http://localhost:3001/api/bugs/error/500
```

## Environment Variables

- `PORT` - Server port (default: 3001)

## Notes

- This is a **mock server** for development and testing only
- Data is stored **in memory** and will be lost when server restarts
- For production, implement proper database storage and authentication
