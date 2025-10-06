# Type Safety Strategy

BugSpotter implements a **three-layer type safety system** to prevent SDK-API communication issues.

---

## 🎯 The Problem

When SDK and API evolve independently, types can drift:
- SDK sends `priority: "urgent"` but API expects `"high"`
- API adds required field but SDK doesn't include it
- Field names change (`description` → `details`)

This causes **runtime failures** that TypeScript can't catch.

---

## ✅ The Solution: Three Layers

### Layer 1: Compile-Time (Shared Types)

**Package:** `@bugspotter/types`

Single source of truth for SDK-API contracts.

```typescript
// Both SDK and API import the same types
import { CreateBugReportRequest } from '@bugspotter/types';

// ✅ TypeScript prevents drift at compile time
// If API changes the type, SDK won't compile until updated
```

**Benefits:**
- Catches type mismatches before code runs
- IDE autocomplete works perfectly
- Refactoring is safe

**Setup:**
```bash
cd packages/types
pnpm install
pnpm build  # Generates .d.ts files
```

---

### Layer 2: Runtime (Zod Validation)

**File:** `packages/api/src/schemas/bug-report.schema.ts`

Validates incoming data at runtime.

```typescript
import { z } from 'zod';

const CreateBugReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  // ...
});

// In middleware
export function validateBody(schema: z.ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors
      });
    }
    next();
  };
}
```

**Benefits:**
- Catches malformed data from any source
- Provides detailed error messages
- Prevents invalid data from reaching database

**Usage:**
```typescript
import { validateBody } from './middleware/validate.js';
import { CreateBugReportSchema } from './schemas/bug-report.schema.js';

router.post('/bugs', 
  validateBody(CreateBugReportSchema),
  async (req, res) => {
    // req.body is guaranteed to be valid here
  }
);
```

---

### Layer 3: Integration (Contract Tests)

**File:** `packages/api/tests/contract/sdk-compatibility.test.ts`

Verifies SDK and API work together correctly.

```typescript
import { describe, it, expect } from 'vitest';
import type { CreateBugReportRequest } from '@bugspotter/types';

describe('SDK-API Contract', () => {
  it('accepts valid SDK payload', async () => {
    const payload: CreateBugReportRequest = {
      title: 'Test Bug',
      description: 'Description',
      capturedData: {
        consoleLogs: [{ level: 'error', message: 'Error', timestamp: Date.now() }],
        // ...
      }
    };

    const response = await fetch('http://localhost:4000/api/bugs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
  });

  it('rejects invalid enum values', async () => {
    const payload = {
      title: 'Test',
      capturedData: {
        consoleLogs: [{ level: 'INVALID', message: 'test' }]
      }
    };

    const response = await fetch('http://localhost:4000/api/bugs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
  });
});
```

**Benefits:**
- Tests real HTTP communication
- Validates all enum values work
- Catches edge cases

**Run tests:**
```bash
# Terminal 1: Start API server
cd packages/api
pnpm run dev

# Terminal 2: Run contract tests
cd packages/api
pnpm test:contract
```

---

## 🔄 How They Work Together

```
Developer changes API type
    ↓
TypeScript compilation fails in SDK (Layer 1) ✅
    ↓
Developer updates SDK to match
    ↓
TypeScript compilation succeeds
    ↓
Runtime validation catches malformed data (Layer 2) ✅
    ↓
Contract tests verify integration (Layer 3) ✅
    ↓
Deploy with confidence 🚀
```

---

## 📋 Checklist: Adding a New Field

When adding a field to the API:

1. **Update shared types** (`@bugspotter/types`)
   ```typescript
   export interface CreateBugReportRequest {
     // ... existing fields
     newField?: string;  // Add here
   }
   ```

2. **Update Zod schema** (`schemas/bug-report.schema.ts`)
   ```typescript
   const CreateBugReportSchema = z.object({
     // ... existing fields
     newField: z.string().optional(),  // Add here
   });
   ```

3. **Update database type** (`types/database.ts`)
   ```typescript
   export interface DatabaseBugReport {
     // ... existing fields
     new_field?: string;  // Add here (snake_case)
   }
   ```

4. **Add contract test** (`tests/contract/sdk-compatibility.test.ts`)
   ```typescript
   it('accepts new field', async () => {
     const payload: CreateBugReportRequest = {
       title: 'Test',
       newField: 'value',  // Test here
       // ...
     };
     // ... assertions
   });
   ```

5. **Build and test**
   ```bash
   cd packages/types && pnpm build
   cd ../api && pnpm build
   pnpm test:contract
   ```

---

## 🛡️ Protection Provided

| Scenario | Layer 1 | Layer 2 | Layer 3 |
|----------|---------|---------|---------|
| Wrong type (string vs number) | ✅ | ✅ | ✅ |
| Invalid enum value | ✅ | ✅ | ✅ |
| Missing required field | ✅ | ✅ | ✅ |
| Field name typo | ✅ | ❌ | ✅ |
| Malformed JSON | ❌ | ✅ | ✅ |
| Client sends extra fields | ❌ | ⚠️ | ✅ |
| Valid but semantically wrong | ❌ | ❌ | ✅ |

**Legend:** ✅ Caught | ❌ Not caught | ⚠️ Depends on config

---

## 🚀 Benefits

- **No runtime surprises**: Catch issues before production
- **Refactor safely**: Change types with confidence
- **Better DX**: IDE autocomplete and inline docs
- **Clear contracts**: Everyone knows what data looks like
- **Self-documenting**: Types serve as documentation
