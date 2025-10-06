# Type Mapping: SDK ↔ API ↔ Database

This document shows how data flows through BugSpotter's type system.


## � Where Types Live

**Public Contracts** (`@bugspotter/types`):
- Used by both SDK and API
- Request/response types
- Shared data structures

**Database Schemas** (`packages/api/src/types/database.ts`):
- API internal only
- Database table structures
- Service layer types

---

## 🔄 Data Flow

```
SDK                     API Route               Service                 Database
──────────────────────  ──────────────────────  ─────────────────────  ─────────────────
CreateBugReportRequest  CreateBugReportRequest  CreateBugReportParams  Supabase Insert
  ↓                       ↓                       ↓                      ↓
  title                   title                   title                  title
  description             description             description            description
  capturedData            capturedData            screenshot_url         screenshot_url
                                                  priority               priority
                                                  status                 status
                                                                         created_at
                                                                         updated_at
  ↑                       ↑                       ↑                      ↑
CreateBugReportResponse CreateBugReportResponse DatabaseBugReport      Supabase Select
```

---

## 📦 Type Compatibility

### ConsoleLog
- **SDK**: `{ level: string, message: string, timestamp: number }`
- **API Contract**: `{ level: 'log'|'warn'|'error'|'info'|'debug', message: string, timestamp: number }`
- **Database**: Same as API Contract + `id`, `bug_report_id`, `created_at`

### NetworkRequest
- **SDK/API Contract**: Identical
- **Database**: Same + `id`, `bug_report_id`, `created_at`

### BrowserMetadata
- **SDK/API Contract**: Identical
- **Database**: Same + `id`, `bug_report_id`, `created_at`

---

## 🗄️ Database Normalization

SDK sends one payload, API splits into tables:

```
SDK Input:
{
  title: "Bug",
  description: "Details",
  capturedData: {
    consoleLogs: [{...}, {...}],
    networkRequests: [{...}],
    metadata: {...},
    screenshot: "data:..."
  }
}

↓ API Normalizes ↓

Database Tables:
- bug_reports (1 row)
- console_logs (N rows)
- network_requests (N rows)
- metadata (1 row)
```

---

## ✅ Compatibility

SDK types are **100% forward compatible** with API types.

API adds:
- Type safety (string literals instead of strings)
- Optional fields (priority, project_id)
- Server-side fields (id, created_at, status)

**See:** `/TYPE_GUIDE.md` for usage examples.
````

## 🗄️ Database Normalization

The API normalizes SDK data into separate tables:

### From SDK `BugReportPayload` → Database Tables

```
SDK Input:
{
  title: "Button not working",
  description: "Click does nothing",
  report: {
    screenshot: "data:image/png;base64,...",
    console: [{level: "error", message: "TypeError", ...}, ...],
    network: [{url: "https://api.com", method: "POST", ...}, ...],
    metadata: {browser: "Chrome", os: "macOS", ...}
  }
}

↓ API Processes & Normalizes ↓

Database Tables:
┌─────────────────────────────────┐
│ bug_reports                     │
├─────────────────────────────────┤
│ id: uuid                        │ ← Generated
│ title: "Button not working"     │ ← From SDK
│ description: "Click does..."    │ ← From SDK
│ status: "open"                  │ ← Default
│ priority: "medium"              │ ← Default or from SDK
│ screenshot_url: "s3://..."      │ ← Uploaded to cloud
│ user_id: uuid                   │ ← From auth
│ project_id: uuid                │ ← From API key
│ created_at: timestamp           │ ← Generated
│ updated_at: timestamp           │ ← Generated
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ console_logs                    │
├─────────────────────────────────┤
│ id: uuid                        │ ← Generated
│ bug_report_id: uuid             │ ← Foreign key
│ level: "error"                  │ ← From SDK console[0]
│ message: "TypeError"            │ ← From SDK console[0]
│ timestamp: 1234567890           │ ← From SDK console[0]
│ stack: "Error at..."            │ ← From SDK console[0]
│ created_at: timestamp           │ ← Generated
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ network_requests                │
├─────────────────────────────────┤
│ id: uuid                        │ ← Generated
│ bug_report_id: uuid             │ ← Foreign key
│ url: "https://api.com"          │ ← From SDK network[0]
│ method: "POST"                  │ ← From SDK network[0]
│ status: 500                     │ ← From SDK network[0]
│ duration: 234                   │ ← From SDK network[0]
│ timestamp: 1234567890           │ ← From SDK network[0]
│ created_at: timestamp           │ ← Generated
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ metadata                        │
├─────────────────────────────────┤
│ id: uuid                        │ ← Generated
│ bug_report_id: uuid             │ ← Foreign key
│ user_agent: "Mozilla/5.0..."    │ ← From SDK metadata
│ viewport_width: 1920            │ ← From SDK metadata.viewport
│ viewport_height: 1080           │ ← From SDK metadata.viewport
│ browser: "Chrome"               │ ← From SDK metadata
│ os: "macOS"                     │ ← From SDK metadata
│ url: "https://myapp.com"        │ ← From SDK metadata
│ timestamp: 1234567890           │ ← From SDK metadata
│ created_at: timestamp           │ ← Generated
└─────────────────────────────────┘
```

---

## 🔐 API Enhancements

These types exist only in API (not in SDK):

### Additional Fields
- `id` - UUID primary key
- `status` - Bug lifecycle tracking
- `priority` - Severity level
- `user_id` - Who reported it
- `project_id` - Which project
- `created_at` / `updated_at` - Timestamps

### Additional Types
- `User` - User management
- `Project` - Multi-project support
- `ProjectSettings` - Feature flags
- `BugReportStats` - Analytics
- `WebhookPayload` - Integrations
- `ApiResponse<T>` - Standard responses
- `PaginatedResponse<T>` - List endpoints

---

## 📊 Type Conversion Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│          SDK Captures               │
│  ┌─────────────────────────────┐   │
│  │ screenshot: string          │   │
│  │ console: ConsoleLog[]       │   │
│  │ network: NetworkRequest[]   │   │
│  │ metadata: BrowserMetadata   │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ User fills    │
       │ modal form    │
       └───────┬───────┘
               │
               ▼
┌─────────────────────────────────────┐
│   SDK sends BugReportPayload        │
│  ┌─────────────────────────────┐   │
│  │ title: string               │   │
│  │ description: string         │   │
│  │ report: CapturedReport      │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ HTTP POST
               │ Bearer token: API_KEY
               ▼
┌─────────────────────────────────────┐
│   API receives CreateBugReportInput │
│  ┌─────────────────────────────┐   │
│  │ Validates API key            │   │
│  │ Extracts project_id          │   │
│  │ Optionally gets user_id      │   │
│  │ Sets default status/priority │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Service Layer Processes           │
│  ┌─────────────────────────────┐   │
│  │ Upload screenshot to S3      │   │
│  │ Generate UUIDs               │   │
│  │ Add timestamps               │   │
│  │ Normalize data               │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Supabase Database                 │
│  ┌─────────────────────────────┐   │
│  │ INSERT bug_reports           │   │
│  │ INSERT console_logs (batch)  │   │
│  │ INSERT network_requests      │   │
│  │ INSERT metadata              │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Return to SDK │
       │ ApiResponse   │
       └───────────────┘
```

---

## ✅ Compatibility Summary

| SDK Type | API Type | Status | Notes |
|----------|----------|--------|-------|
| `BugReportPayload` | `CreateBugReportInput` | ✅ Compatible | API adds optional fields |
| `BugReport` (SDK) | `CapturedReport` (API) | ✅ Identical | Exact match |
| `ConsoleLog` | `ConsoleLog` | ✅ Compatible | API adds type safety |
| `NetworkRequest` | `NetworkRequest` | ✅ Identical | Exact match |
| `BrowserMetadata` | `BrowserMetadata` | ✅ Identical | Exact match |

**Result**: SDK types are **100% forward compatible** with API types. The API extends SDK types with additional fields for server-side features while maintaining full compatibility with incoming SDK data.
