# @bugspotter/types

Shared TypeScript types for BugSpotter SDK and API.

## Purpose

This package provides a **single source of truth** for all type definitions shared between the SDK and API. By importing these types in both packages, we ensure:

- ✅ **Compile-time type safety** - Changes break both SDK and API until synchronized
- ✅ **No drift** - SDK and API always speak the same language
- ✅ **Easy versioning** - Types can be versioned independently
- ✅ **Clear contracts** - API contracts are explicit and documented

## Installation

```bash
# In SDK
cd packages/sdk
pnpm add @bugspotter/types@workspace:*

# In API
cd packages/api
pnpm add @bugspotter/types@workspace:*
```

## Usage

### In SDK

```typescript
import type {
  CapturedReport,
  CreateBugReportRequest,
  CreateBugReportResponse,
} from '@bugspotter/types';

export class BugSpotter {
  async capture(): Promise<CapturedReport> {
    return {
      screenshot: await this.screenshot.capture(),
      console: this.console.getLogs(),
      network: this.network.getRequests(),
      metadata: this.metadata.capture(),
    };
  }

  async submit(data: CreateBugReportRequest): Promise<CreateBugReportResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
```

### In API

```typescript
import type {
  CreateBugReportRequest,
  CreateBugReportResponse,
  ApiErrorResponse,
} from '@bugspotter/types';
import { Router, Request, Response } from 'express';

const router = Router();

router.post(
  '/bugs',
  async (
    req: Request<{}, CreateBugReportResponse | ApiErrorResponse, CreateBugReportRequest>,
    res: Response<CreateBugReportResponse | ApiErrorResponse>
  ) => {
    const { title, description, report } = req.body;

    const response: CreateBugReportResponse = {
      success: true,
      data: {
        id: generateId(),
        title,
        description,
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  }
);
```

## Type Categories

### Capture Types (`capture.ts`)

- `ConsoleLog` - Browser console logs
- `NetworkRequest` - Network requests
- `BrowserMetadata` - Browser environment info
- `CapturedReport` - Complete captured data

### API Contract Types (`api-contract.ts`)

- `CreateBugReportRequest` - Request payload
- `CreateBugReportResponse` - Success response
- `ApiErrorResponse` - Error response
- `BugReportData` - Bug report entity
- `ApiResponse<T>` - Generic response wrapper
- `PaginatedResponse<T>` - Paginated lists

## Development

```bash
# Build types
pnpm run build

# Watch mode
pnpm run dev

# Clean build artifacts
pnpm run clean
```

## Versioning

This package follows semantic versioning:

- **Major** - Breaking changes to existing types
- **Minor** - New types added
- **Patch** - Documentation or non-code changes

When you update this package, both SDK and API should update their dependencies.
