# Type System Guide

**Quick Reference:** Where to find and how to use types in BugSpotter.

---

## 📍 Where Types Live

### Public API Contracts (SDK + API)
**Package:** `@bugspotter/types`

```typescript
import { 
  CreateBugReportRequest, 
  CreateBugReportResponse,
  BugReportData,
  ConsoleLog,
  NetworkRequest,
  BrowserMetadata 
} from '@bugspotter/types';
```

**Use in:**
- SDK code (all external-facing types)
- API routes (request/response types)
- API middleware (validation types)

### Internal Database Types (API only)
**File:** `packages/api/src/types/database.ts`

```typescript
import { 
  DatabaseBugReport,
  CreateBugReportParams,
  BugReportFilters 
} from './types/database.js';
```

**Use in:**
- API services (database operations)
- API repositories (Supabase queries)
- API controllers (internal logic)

---

## 🔄 Type Flow

```
SDK                API Route           Service Layer       Database
───────────────    ──────────────      ─────────────       ─────────
CreateBugReport → [Validation] → Transform → DatabaseBugReport → Supabase
Request                                                             │
                                                                    ▼
CreateBugReport ← [Transform] ← Query ← DatabaseBugReport ← Supabase
Response
```

**Types used at each layer:**
- **SDK**: `@bugspotter/types` (public contracts)
- **API Routes**: `@bugspotter/types` (request/response)
- **Services**: `database.ts` (internal schemas)
- **Database**: Supabase types (generated from schema)

---

## 🎯 Quick Import Guide

### "I'm writing a route handler"
```typescript
import { CreateBugReportRequest, CreateBugReportResponse } from '@bugspotter/types';
import { Router } from 'express';

const router = Router();
router.post('/bugs', async (req, res) => {
  const payload = req.body as CreateBugReportRequest;
  const response: CreateBugReportResponse = { /* ... */ };
  res.json(response);
});
```

### "I'm writing a service function"
```typescript
import { DatabaseBugReport, CreateBugReportParams } from './types/database.js';
import { supabase } from './db/client.js';

export async function createBugReport(params: CreateBugReportParams) {
  const { data } = await supabase
    .from('bug_reports')
    .insert(params)
    .select()
    .single();
  return data as DatabaseBugReport;
}
```

### "I'm using the SDK"
```typescript
import BugSpotter from '@bugspotter/sdk';
import type { CreateBugReportRequest } from '@bugspotter/types';

const bugspotter = new BugSpotter({ apiKey: 'xxx' });

const report: CreateBugReportRequest = {
  title: 'Bug title',
  // ...
};
await bugspotter.submitReport(report);
```

---

## ✅ Best Practices

**DO:**
- ✅ Import from `@bugspotter/types` in routes and SDK
- ✅ Import from `database.ts` in services and repositories
- ✅ Use Zod schemas for runtime validation
- ✅ Transform between public/internal types in service layer

**DON'T:**
- ❌ Import `database.ts` types in SDK (it doesn't have access)
- ❌ Mix public and internal types in the same function
- ❌ Export database types from `@bugspotter/types`
- ❌ Skip validation on external inputs

---

## 🔍 Type Location Reference

| Type | Location | Used By |
|------|----------|---------|
| `CreateBugReportRequest` | `@bugspotter/types` | SDK, API routes |
| `CreateBugReportResponse` | `@bugspotter/types` | SDK, API routes |
| `BugReportData` | `@bugspotter/types` | SDK, API routes |
| `ConsoleLog` | `@bugspotter/types` | SDK, API routes |
| `NetworkRequest` | `@bugspotter/types` | SDK, API routes |
| `BrowserMetadata` | `@bugspotter/types` | SDK, API routes |
| `DatabaseBugReport` | `database.ts` | API services |
| `CreateBugReportParams` | `database.ts` | API services |
| `BugReportFilters` | `database.ts` | API services |

---

## 🛠️ Common Patterns

### Pattern 1: Route → Service → Database
```typescript
// Route (uses public types)
import { CreateBugReportRequest, CreateBugReportResponse } from '@bugspotter/types';
import { createBugReport } from './services/bug.service.js';

router.post('/bugs', async (req, res) => {
  const request = req.body as CreateBugReportRequest;
  const result = await createBugReport(request);
  const response: CreateBugReportResponse = { bugId: result.id };
  res.json(response);
});

// Service (transforms public → internal)
import { CreateBugReportRequest } from '@bugspotter/types';
import { DatabaseBugReport, CreateBugReportParams } from '../types/database.js';
import { supabase } from '../db/client.js';

export async function createBugReport(request: CreateBugReportRequest) {
  const params: CreateBugReportParams = {
    title: request.title,
    description: request.description,
    // ... transform to internal format
  };
  
  const { data } = await supabase
    .from('bug_reports')
    .insert(params)
    .select()
    .single();
    
  return data as DatabaseBugReport;
}
```

### Pattern 2: SDK Submit
```typescript
import BugSpotter from '@bugspotter/sdk';
import type { ConsoleLog, NetworkRequest } from '@bugspotter/types';

const logs: ConsoleLog[] = [
  { level: 'error', message: 'Failed', timestamp: Date.now() }
];

const requests: NetworkRequest[] = [
  { url: 'https://api.example.com', method: 'POST', status: 500 }
];

await bugspotter.submitReport({
  title: 'Error occurred',
  description: 'Details...',
  capturedData: { consoleLogs: logs, networkRequests: requests }
});
```

---

## 🚀 Type Safety

BugSpotter uses **three layers** of type safety:

1. **Compile-time**: TypeScript checks via `@bugspotter/types`
2. **Runtime**: Zod validation in API middleware
3. **Integration**: Contract tests verify SDK ↔ API communication

See `packages/api/tests/contract/sdk-compatibility.test.ts` for examples.
