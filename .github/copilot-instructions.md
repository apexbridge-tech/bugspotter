# GitHub Copilot Instructions for BugSpotter

You are working on **BugSpotter**, a professional bug reporting SDK with session replay capabilities, built as a pnpm workspace monorepo.

**Status**: Pre-release (active development, not yet published to npm)

## Project Structure

- **packages/sdk** - Core TypeScript SDK with rrweb session replay (~99KB bundle)
- **packages/backend** - Fastify 5.6.1 REST API with PostgreSQL 16 + S3 storage
- **packages/types** - Shared TypeScript type definitions
- **packages/backend-mock** - Mock API server for SDK testing
- **apps/demo** - Interactive demo application

## TypeScript Configuration

**Strict Base Configuration**: All packages extend `tsconfig.json` at project root with 13 strict compiler options enabled.

### Backend (ES2023)

Target: ES2023 for Node 20+ in Docker environment.

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Modern features available**: Top-level await, array grouping, `findLast`, `Array.toSorted()`, `Object.hasOwn()`.

### SDK (ES2017)

Target: ES2017 for 95%+ browser coverage (Chrome 60+, Firefox 55+, Safari 11+, Edge 79+).

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2017", "DOM", "DOM.Iterable"],
    "sourceMap": true,
    "declaration": true
  }
}
```

**Modern features available**: `async`/`await`, `Object.entries()`, `Object.values()`, string padding. **Avoid**: ES2018+ features (spread in objects OK, async iterators NO).

### Types (ES2022, Declaration-Only)

Shared types package - generates `.d.ts` files only:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "emitDeclarationOnly": true,
    "declaration": true,
    "composite": true,
    "outDir": "./dist"
  }
}
```

### Key TypeScript Patterns

**1. Type Guards with Key Presence**

Check for key existence, not value types (handles `undefined` values):

```typescript
// ✅ GOOD: Checks for key presence
function isTransportOptions(obj: any): obj is TransportOptions {
  return 'apiKey' in obj && 'endpoint' in obj;
}

// ❌ BAD: Fails when values are undefined
function isTransportOptions(obj: any): obj is TransportOptions {
  return typeof obj.apiKey === 'string'; // undefined fails!
}
```

**2. isolatedModules Compliance**

Always use `export type` for type-only re-exports:

```typescript
// ✅ GOOD: Explicitly marks type export
export type { BugReportData, ErrorInfo } from './types';

// ❌ BAD: isolatedModules error
export { BugReportData, ErrorInfo } from './types';
```

**3. Unused Variables**

Remove unused declarations immediately:

```typescript
// ❌ BAD: Unused variable
const styleElement = document.createElement('style');
return template; // styleElement never used

// ✅ GOOD: Removed or used
return template;
```

**4. Verify Errors After File Operations**

Always check for TypeScript errors after renaming files or updating imports:

```typescript
// After renaming files or bulk import updates:
// 1. Run get_errors on affected files
// 2. Fix any compilation errors immediately
// 3. Then run build and tests
```

**Critical**: File renames can introduce type errors in test files that use type casting. Test files aren't compiled by `pnpm build` but will fail during `pnpm test` when vitest compiles them.

See: Root `tsconfig.json`, package-specific configs, `packages/sdk/src/core/transport.ts` (type guard example)

## File Naming Conventions

**Standard: kebab-case for all multi-word files**

All TypeScript source files use kebab-case (dashes) for multi-word names:

- ✅ `dom-element-cache.ts`, `form-validator.ts`, `screenshot-processor.ts`
- ✅ `image-processor.ts`, `path-utils.ts`, `base-storage-service.ts`
- ✅ `auth-schema.ts`, `common-schema.ts`, `project-schema.ts`

**Reserved dot notation** only for these patterns:

- Configuration: `vitest.config.ts`, `webpack.config.js`, `eslint.config.js`
- Testing: `*.test.ts`, `setup.integration.ts`
- Types: `types.ts`, `*.d.ts`
- Build artifacts: `tsconfig.tsbuildinfo`

**Never use**:

- ❌ camelCase: `domElementCache.ts`, `formValidator.ts`
- ❌ Mixed dots: `image.processor.ts`, `path.utils.ts`
- ❌ PascalCase: `FormValidator.ts`, `ImageProcessor.ts`

**Rationale**: Kebab-case is:

1. Shell-friendly (no escaping needed in terminals)
2. Git-friendly (case-insensitive filesystems)
3. Consistent with web standards (URLs, HTML attributes)
4. Visually distinct from class names (PascalCase) and variables (camelCase)

See: Entire codebase follows this convention (~40 files standardized in 2025)

## Core Architectural Patterns

### 1. **Strategy Pattern** (Error Handling)

Error handlers use matcher/processor pairs in a chain:

```typescript
const errorHandlers = [
  { matcher: isValidationError, processor: processValidationError },
  { matcher: isAppError, processor: processAppError },
  // ... more handlers
];
for (const { matcher, processor } of errorHandlers) {
  if (matcher(error)) return processor(error, request);
}
```

See: `packages/backend/src/api/middleware/error.ts`

### 2. **Repository Pattern** (Database)

Each entity has a dedicated repository extending `BaseRepository`:

```typescript
// Use DatabaseClient facade for convenience
const db = createDatabaseClient();
const project = await db.projects.create({ name: 'App', api_key: 'key' });

// Or inject repositories directly for testing/DI
const projectRepo = new ProjectRepository(pool);
const project = await projectRepo.findByApiKey('key');
```

Repositories: Project, User, BugReport, Session, Ticket, ProjectMember
See: `packages/backend/src/db/repositories.ts`, `examples/repository-usage.ts`

### 3. **Factory Pattern** (Database Client)

DatabaseClient uses private constructor + static factory method:

```typescript
export class DatabaseClient {
  private constructor() {} // Prevent direct instantiation
  static create(): DatabaseClient {
    /* initialize pool + repos */
  }
}
```

See: `packages/backend/src/db/client.ts`

### 4. **Facade Pattern** (Sanitizer, Modal)

Complex systems exposed through simple APIs:

- **Sanitizer** coordinates PatternManager, StringSanitizer, ValueSanitizer, ElementMatcher
- **BugReportModal** coordinates StyleManager, TemplateManager, FormValidator, PIIDetectionDisplay

See: `packages/sdk/src/utils/sanitize.ts`, `packages/sdk/src/widget/modal.ts`

### 5. **Template Method Pattern** (Storage Layer)

Base class defines upload algorithm, subclasses implement storage-specific logic:

```typescript
// Base class with common validation/sanitization
export abstract class BaseStorageService {
  // Template method - defines upload flow
  protected async uploadWithKey(
    resourceType: string,
    projectId: string,
    bugId: string,
    filename: string,
    buffer: Buffer
  ): Promise<UploadResult> {
    // 1. Validate inputs
    // 2. Build and sanitize storage key
    // 3. Determine content type
    // 4. Delegate to subclass implementation
    return await this.uploadBuffer(key, buffer, contentType);
  }

  // Hook method for subclasses
  protected abstract uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult>;
}

// S3 implementation
export class StorageService extends BaseStorageService {
  protected async uploadBuffer(key, buffer, contentType) {
    // S3-specific upload with retry logic
  }
}

// Local filesystem implementation
export class LocalStorageService extends BaseStorageService {
  protected async uploadBuffer(key, buffer, contentType) {
    // Filesystem-specific upload
  }
}
```

Benefits: Eliminates ~200 lines of duplicated validation/sanitization code across implementations.

See: `packages/backend/src/storage/base-storage.service.ts`, `storage.service.ts`, `local.storage.ts`

### 6. **Memory-Efficient Streaming** (Storage)

**Critical for large file uploads** - never buffer entire streams into memory:

```typescript
// ✅ GOOD: S3 true streaming with Upload class
async uploadStream(key: string, stream: Readable): Promise<UploadResult> {
  const upload = new Upload({
    client: this.client,
    params: { Bucket: this.bucket, Key: key, Body: stream },
    partSize: 5 * 1024 * 1024, // 5MB parts
    queueSize: 4, // Concurrent uploads
  });
  return await upload.done();
}

// ✅ GOOD: Local storage with Node.js pipeline
async uploadStream(key: string, stream: Readable): Promise<UploadResult> {
  const writeStream = createWriteStream(filePath);
  await pipeline(stream, writeStream); // Direct streaming
  return { key, size: (await fs.stat(filePath)).size };
}

// ❌ BAD: Buffering entire file in memory (OOM risk!)
async uploadStream(key: string, stream: Readable): Promise<UploadResult> {
  const buffer = await streamToBuffer(stream); // Loads entire file!
  return await this.uploadBuffer(key, buffer);
}
```

**Benefits**: Constant ~5MB memory usage vs linear growth, prevents OOM on large files, better performance.

**Rule**: Use `Upload` (@aws-sdk/lib-storage) for S3, `pipeline` for local filesystem - never `streamToBuffer`.

See: `packages/backend/src/storage/storage.service.ts` (uploadStream), `local.storage.ts` (uploadStream)

## Authentication & Authorization

### Dual Authentication System

- **API Keys**: `bgs_` prefix for SDK → backend communication (no expiration)
- **JWT Tokens**: Bearer tokens for user authentication (1h access + 7d refresh)

### Public Routes Configuration

Mark routes as public using `config.public`:

```typescript
fastify.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));
```

Auth middleware checks `request.routeOptions.config?.public` first - **never hardcode PUBLIC_ROUTES arrays**.

See: `packages/backend/src/api/middleware/auth.ts`, `src/api/routes/health.ts`

## Testing with Testcontainers

**No manual database setup required.** Tests automatically:

1. Launch PostgreSQL 16 container
2. Run migrations
3. Execute tests (869 backend + 345 SDK = 1,214 total)
4. Cleanup container

```bash
pnpm test              # All tests (requires Docker running)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

**Test Distribution:**

- Backend: 869 tests (746 unit + 104 integration + 25 storage)
- SDK: 345 tests (unit + E2E + Playwright)

### Unit Test Mocking

**Keep mocks in sync with implementation** - when refactoring to use repository methods:

```typescript
// ❌ BAD: Mock misses new repository method after refactoring
beforeEach(() => {
  mockDb = {
    bugReports: {
      softDelete: vi.fn(),
      // Missing setLegalHold after refactoring service to use it
    },
    query: vi.fn(),
  } as any;
});

// ✅ GOOD: Mock includes all methods used by service
beforeEach(() => {
  mockDb = {
    bugReports: {
      softDelete: vi.fn(),
      setLegalHold: vi.fn(), // Added when service refactored
    },
    query: vi.fn(),
  } as any;
});
```

**Rule**: After refactoring to eliminate duplication, update test mocks to include the new dependency methods.

See: `packages/backend/TESTING.md`, `packages/backend/tests/setup.ts`, `tests/retention-service.test.ts`

## Security Best Practices

### Defense in Depth

**Layer multiple security mechanisms** - never rely on a single validation:

```typescript
// ✅ GOOD: Multiple layers
function buildStorageKey(type, projectId, bugId, filename) {
  // Layer 1: Whitelist validation
  if (!VALID_STORAGE_TYPES.includes(type)) throw new Error('Invalid type');

  // Layer 2: ID validation (UUID format + path traversal check)
  validateProjectId(projectId);
  validateBugId(bugId);

  // Layer 3: Filename sanitization
  const sanitized = sanitizeFilename(filename);

  // Layer 4: Final key sanitization
  return sanitizeS3Key(`${type}/${projectId}/${bugId}/${sanitized}`);
}

// ❌ BAD: Single layer or blind concatenation
function buildStorageKey(type, id, filename) {
  return `${type}/${id}/${filename}`; // No validation!
}
```

**Key Principle**: Validate at boundaries, sanitize after validation, verify final output.

See: `packages/backend/src/storage/path.utils.ts` (defense-in-depth implementation)

### SQL Injection Prevention

**Three-layer protection**:

1. **Parameterized queries** - All values use `$1`, `$2` placeholders
2. **Identifier validation** - Column names: `^[a-zA-Z0-9_]+$` regex
3. **Input validation** - Pagination limits (1-1000), batch limits (max 1000)

```typescript
// ✅ SAFE
await client.query('SELECT * FROM users WHERE email = $1', [userInput]);
await db.list({}, { sort_by: validateSqlIdentifier(userColumn) });

// ❌ NEVER
await client.query(`SELECT * FROM users WHERE email = '${input}'`);
await client.query(`ORDER BY ${userColumn}`);
```

See: `packages/backend/SECURITY.md`, `src/db/query-builder.ts`

### Helmet CSP Configuration

**Never use `unsafe-inline` or broad `https:` directives.** Always specify explicit sources:

```typescript
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"], // NO 'unsafe-inline'
      imgSrc: ["'self'", 'data:'], // NO 'https:'
      // ... add 10+ specific directives
    },
  },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
});
```

See: `packages/backend/src/api/server.ts`

### Path Traversal Prevention

**Always extract basename and validate components**:

```typescript
// ✅ GOOD: Multiple defenses
function sanitizeFilename(filename: string): string {
  filename = decodeUrlSafely(filename); // Decode URL encoding attacks
  filename = removeControlCharacters(filename); // Strip null bytes
  filename = extractBasename(filename); // path.basename() defeats ../
  // ... additional validation
}

// ❌ BAD: String replacement only
filename = filename.replace(/\.\./g, ''); // Can be bypassed: ....//
```

### Error Code Validation

Check both error codes AND PostgreSQL-specific codes:

```typescript
if (error.code === 'ECONNREFUSED' || error.code?.match(/^\d{5}$/)) {
  return processDatabaseError(error);
}
```

## Code Quality Principles (SOLID, DRY, KISS)

### Single Responsibility Principle

One class/function = one reason to change. Extract focused components:

- ❌ 580-line modal with 6 responsibilities
- ✅ 8 focused components: StyleManager, TemplateManager, DOMElementCache, FormValidator, etc.
- ❌ 170-line `sanitizeFilename` doing 7 different things
- ✅ 10 focused helpers: `removeControlCharacters`, `extractBasename`, `truncateWithExtension`, etc.

**Rule of thumb**: Functions should be 3-30 lines (median ~10), classes should have one clear purpose.

### DRY - Don't Repeat Yourself

Extract duplicated structures into utility functions:

```typescript
// ❌ BAD: 70 lines of duplication
function validateProjectId(id) {
  /* 35 lines */
}
function validateBugId(id) {
  /* 35 identical lines */
}

// ✅ GOOD: 34 lines total (51% reduction)
function validateId(id, type, options) {
  /* 28 lines */
}
const validateProjectId = (id, opts) => validateId(id, 'project', opts);
const validateBugId = (id, opts) => validateId(id, 'bug', opts);
```

**Duplication threshold**: If code appears 2+ times AND is >5 lines, extract it.

### KISS - Keep It Simple, Stupid

**Complexity indicators**:

- 3+ levels of nesting → Extract to early returns or separate functions
- Magic numbers (10, 255, 7) → Use named constants
- Inline regex patterns → Extract to named constants with comments
- Functions >50 lines → Break into smaller functions

```typescript
// ❌ BAD: Magic numbers
if (maxNameLength > 10) { ... }

// ✅ GOOD: Named constant
const MIN_FILENAME_LENGTH = 10;
if (maxNameLength > MIN_FILENAME_LENGTH) { ... }
```

### Open/Closed Principle

Easy to extend without modification - use arrays of handlers, not if/else chains:

```typescript
// Add new error type without changing existing code
errorHandlers.push({ matcher: isNewErrorType, processor: processNewError });

// Add new storage type without modifying validation
const VALID_STORAGE_TYPES = ['screenshots', 'replays', 'attachments', 'videos'];
```

### Separation of Concerns (Layered Architecture)

**Avoid duplicating data access logic** - follow the repository pattern strictly:

```typescript
// ❌ BAD: Service duplicates repository query
class RetentionService {
  async setLegalHold(reportIds: string[], hold: boolean): Promise<number> {
    const query = `UPDATE bug_reports SET legal_hold = $1 WHERE id = ANY($2)`;
    return await this.db.query(query, [hold, reportIds]);
  }
}

// ✅ GOOD: Service delegates to repository, adds orchestration
class RetentionService {
  async setLegalHold(reportIds: string[], hold: boolean, userId: string): Promise<number> {
    // Fetch metadata for audit trail
    const projectIds = await this.getProjectIds(reportIds);

    // Use repository for data access
    const count = await this.db.bugReports.setLegalHold(reportIds, hold);

    // Add service-layer concerns (audit logging, notifications)
    await this.createAuditLog({ action: 'legal_hold', projectIds, userId });
    logger.info(`Legal hold ${hold ? 'applied' : 'released'}`, { count });

    return count;
  }
}
```

**Layers**:

- **Repository**: Pure data access (CRUD, queries)
- **Service**: Orchestration (transactions, audit logs, business logic)
- **API Route**: HTTP concerns (validation, auth, response formatting)

**Rule**: If you see SQL queries in service layer that mirror repository methods, refactor to call the repository instead.

See: `packages/backend/src/retention/retention-service.ts` (setLegalHold refactoring)

## Helper Function Patterns

### Naming Conventions

Private helpers use verb-noun structure describing single action:

- `removeControlCharacters()` - removes something
- `extractBasename()` - extracts something
- `validatePathComponent()` - validates something
- `sanitizeExtensions()` - sanitizes something
- `handleWindowsReservedName()` - handles a specific case

### Common Helper Types

**1. Validators** (return boolean or throw):

```typescript
function validatePathComponent(value: string, name: string, pattern: RegExp): void {
  if (pattern.test(value)) throw new Error(`Invalid ${name}`);
}
```

**2. Transformers** (return transformed value):

```typescript
function removeControlCharacters(str: string): string {
  return str.replace(CONTROL_CHARS, '');
}
```

**3. Extractors** (parse and return structured data):

```typescript
function separateNameAndExtensions(input: string): { name: string; extensions: string[] } {
  const parts = input.split('.');
  return { name: parts[0], extensions: parts.slice(1) };
}
```

**4. Handlers** (encapsulate specific logic):

```typescript
function handleWindowsReservedName(name: string, original: string): string {
  if (WINDOWS_RESERVED_NAMES.test(name)) {
    logger.warn('Reserved name', { original, detected: name });
    return '_' + name;
  }
  return name;
}
```

### Helper Organization

Place helpers in this order:

1. **Constants** - At top of file
2. **Private Helpers** - Below constants, grouped by purpose
3. **Public API** - At bottom, using helpers

```typescript
// ============================================================================
// CONSTANTS
// ============================================================================
const MAX_LENGTH = 255;
const PATTERN = /[^a-z0-9]/g;

// ============================================================================
// PRIVATE HELPERS (Single Responsibility)
// ============================================================================
function helperA() {
  /* ... */
}
function helperB() {
  /* ... */
}

// ============================================================================
// PUBLIC API
// ============================================================================
export function mainFunction() {
  // Uses helpers
}
```

## Commit & Workflow Guidelines

### Commit Messages

**Keep under 60 words**, use conventional commits format:

```
feat: add session replay support with rrweb integration
fix: remove await on synchronous generateTokens function
refactor: implement strategy pattern for error handlers
docs: complete ticket integration section with examples
chore: clean debug console logs from production code
```

**Conventional Commit Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without behavior change
- `docs:` - Documentation updates
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (dependencies, configs)
- `perf:` - Performance improvements
- `style:` - Code style/formatting changes

### CI/CD

GitHub Actions runs on `push` to `main`/`develop` and `pull_request` to these branches. **Feature branches only run on PR**, preventing duplicate CI runs.

See: `.github/workflows/ci.yml`

## Common Tasks

### Adding New Repository Method

1. Add method to specific repository class (extends BaseRepository)
2. Update DatabaseClient facade if needed
3. Add integration test in `tests/db.test.ts`
4. Document in `packages/backend/README.md`

### Adding New Error Type

1. Create matcher function (e.g., `isMyError`)
2. Create processor function (e.g., `processMyError`)
3. Add to `errorHandlers` array in `src/api/middleware/error.ts`

### Adding New API Route

1. Create route file in `src/api/routes/`
2. Register in `src/api/server.ts`
3. Add `config: { public: true }` if no auth required
4. Add integration test in `tests/api/`

### Adding New Storage Backend

1. Extend `BaseStorageService` abstract class
2. Implement `uploadBuffer()` method with backend-specific logic
3. Update `createStorage()` factory in `src/storage/index.ts`
4. Add integration tests in `tests/integration/storage.test.ts`

### Refactoring Existing Code

1. **Identify opportunities**: Duplication, complex functions (>50 lines), 3+ nesting levels
2. **Extract constants**: Replace magic numbers and inline patterns
3. **Extract helpers**: Pull out focused functions with single responsibilities
4. **Run tests continuously**: After each extraction, verify `pnpm test`
5. **Document changes**: For significant refactorings, create summary in `.archive/docs/`

## Key Files Reference

### Backend Core

- **Error Handling**: `packages/backend/src/api/middleware/error.ts` (strategy pattern)
- **Authentication**: `packages/backend/src/api/middleware/auth.ts` (dual auth: API keys + JWT)
- **Audit Middleware**: `packages/backend/src/api/middleware/audit.ts` (automatic activity logging)
- **Database Client**: `packages/backend/src/db/client.ts` (factory pattern)
- **Repositories**: `packages/backend/src/db/repositories.ts` (7 repositories: Project, User, BugReport, Session, Ticket, ProjectMember, AuditLog)

### API Layer

- **Audit Log Routes**: `packages/backend/src/api/routes/audit-logs.ts` (read-only admin access)
- **Audit Log Schema**: `packages/backend/src/api/schemas/audit-log-schema.ts` (Fastify validation schemas)
- **Common Schemas**: `packages/backend/src/api/schemas/common-schema.ts` (reusable pagination, sorting)

### Storage Layer

- **Base Storage**: `packages/backend/src/storage/base-storage-service.ts` (template method)
- **S3 Storage**: `packages/backend/src/storage/storage-service.ts` (multipart uploads, retry)
- **Local Storage**: `packages/backend/src/storage/local-storage.ts` (filesystem operations)
- **Path Utils**: `packages/backend/src/storage/path-utils.ts` (defense-in-depth validation)

### SDK

- **Sanitizer**: `packages/sdk/src/utils/sanitize.ts` (PII detection, facade pattern)
- **Session Replay**: `packages/sdk/docs/SESSION_REPLAY.md` (rrweb integration)

### Admin Panel

- **Audit Logs Page**: `apps/admin/src/pages/audit-logs.tsx` (WCAG 2.1 AA compliant, complete accessibility implementation)
- **Auth Context**: `apps/admin/src/contexts/auth-context.tsx` (memory-only token storage, httpOnly refresh cookies)
- **API Client**: `apps/admin/src/lib/api-client.tsx` (axios interceptor for token refresh)
- **Session Replay**: `packages/sdk/docs/SESSION_REPLAY.md` (rrweb integration)

## Quick Commands

```bash
# Development
pnpm dev              # Start all packages in dev mode
pnpm --filter @bugspotter/backend dev  # Start backend only

# Building
pnpm build            # Build all packages
pnpm --filter @bugspotter/sdk build    # Build SDK only

# Testing
pnpm test             # Run all tests (requires Docker)
pnpm --filter @bugspotter/backend test # Backend tests only

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
```

---

## Admin Panel (React + TypeScript)

**Location**: `apps/admin/` - Self-hosted admin control panel for BugSpotter

**Stack**: React 18.3.1, TypeScript, Vite 5, Tailwind CSS 3, TanStack Query 5, React Router 6

### Accessibility Standards (WCAG 2.1 AA)

All admin UI components must meet WCAG 2.1 AA compliance:

**Required Patterns**:

```tsx
// ✅ GOOD: Modal with proper ARIA and focus management
const modalRef = useRef<HTMLDivElement>(null);
const previousFocusRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
    previousFocusRef.current?.focus();
  }
}, [isOpen]);

<div
  ref={modalRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabIndex={-1}
>
  <h2 id="modal-title">Modal Title</h2>
</div>

// ✅ GOOD: Icon buttons with accessible labels
<Button
  onClick={handleAction}
  aria-label="Close dialog"
>
  <X className="w-4 h-4" aria-hidden="true" />
</Button>

// ✅ GOOD: Form labels with htmlFor
<label htmlFor="email-input" className="text-sm font-medium">
  Email Address
</label>
<Input id="email-input" type="email" />

// ✅ GOOD: Status icons with screen reader text
{success ? (
  <>
    <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
    <span className="sr-only">Success</span>
  </>
) : (
  <>
    <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
    <span className="sr-only">Failed</span>
  </>
)}

// ✅ GOOD: Loading states with live regions
<div role="status" aria-live="polite">
  Loading data...
</div>

// ✅ GOOD: Tables with captions
<table>
  <caption className="sr-only">
    Audit log entries with timestamp, action, and status
  </caption>
  <thead>...</thead>
</table>
```

**Keyboard Navigation**:
- ESC key closes modals
- Tab navigation works through all interactive elements
- Focus traps within modals prevent background interaction
- Focus returns to trigger element after modal closes

See: `apps/admin/src/pages/audit-logs.tsx` (complete accessibility implementation)

### Security Best Practices

**1. Token Storage - NEVER use localStorage for JWTs**

```tsx
// ❌ BAD: localStorage is vulnerable to XSS attacks
localStorage.setItem('access_token', token);

// ✅ GOOD: Memory-only storage for access tokens
const [accessToken, setAccessToken] = useState<string | null>(null);

// ✅ GOOD: sessionStorage only for non-sensitive data (cleared on tab close)
sessionStorage.setItem('user', JSON.stringify(userData));
```

**Why**: Any malicious script can steal tokens from `localStorage` via XSS. Store access tokens in memory (React state) and refresh tokens should be in httpOnly cookies (backend).

**2. API Client Pattern - Token Accessor Functions**

```tsx
// ✅ GOOD: Use accessor pattern to decouple auth from HTTP client
export const setAuthTokenAccessors = (
  getter: () => string | null,
  updater: (token: string) => void
) => {
  getAccessToken = getter;
  updateAccessToken = updater;
};

// In auth context
useEffect(() => {
  setAuthTokenAccessors(
    () => accessToken,
    (token) => setAccessToken(token)
  );
}, [accessToken]);
```

**3. Error Handling - Never Silently Ignore Errors**

```tsx
// ❌ BAD: Silent error swallowing
try {
  await api.checkStatus();
} catch {
  // Setup not complete, continue
}

// ✅ GOOD: Distinguish expected vs unexpected errors
try {
  await api.checkStatus();
} catch (error) {
  if (import.meta.env.DEV) {
    console.warn('Status check failed:', error);
  }

  const errorMessage = handleApiError(error);
  if (errorMessage.includes('Network')) {
    toast.error('Unable to connect to server');
  }
  // Otherwise, expected "not initialized" error
}
```

### React Anti-Patterns to Avoid

**1. Never setState During Render**

```tsx
// ❌ BAD: Causes infinite loops
if (data && !formData.name) {
  setFormData(data); // setState in render!
}

// ✅ GOOD: Use useEffect for side effects
useEffect(() => {
  if (data) {
    setFormData(data);
  }
}, [data]);
```

**2. Memoize Callbacks to Prevent Re-renders**

```tsx
// ❌ BAD: Creates new function every render
const updateField = (field, value) => {
  setFormData((prev) => ({ ...prev, [field]: value }));
};

// ✅ GOOD: Memoized callback
const updateField = useCallback((field, value) => {
  setFormData((prev) => ({ ...prev, [field]: value }));
}, []);
```

**3. Reset Form After Successful Mutations**

```tsx
// ❌ BAD: Form keeps old values
const mutation = useMutation({
  onSuccess: () => {
    toast.success('Saved');
  },
});

// ✅ GOOD: Sync form with server values
const mutation = useMutation({
  onSuccess: (updatedData) => {
    setFormData(updatedData);
    toast.success('Saved');
  },
});
```

**4. Component Extraction for Large Forms**

When a component exceeds 150 lines or has repetitive Card/CardContent structures:

- Extract reusable wrapper components (e.g., `SettingsSection`)
- Split into feature-based components (e.g., `SecuritySettings`, `StorageSettings`)
- Pass memoized callbacks as props to prevent re-renders

**5. Input Validation**

```tsx
// ✅ GOOD: Add validation to number inputs
const handleNumberChange = (field, value, min = 0) => {
  const parsed = parseInt(value, 10);
  if (!isNaN(parsed) && parsed >= min) {
    updateField(field, parsed);
  }
};

<Input
  type="number"
  min="60"
  max="86400"
  onChange={(e) => handleNumberChange('expiry', e.target.value, 60)}
/>;
```

**6. Clean Console Logging**

Remove all debug console.log statements from production code:

```tsx
// ❌ BAD: Debug logging clutters production
console.log('🔍 Fetching data...', filters);
console.log('✅ Data received:', data);

// ✅ GOOD: Remove debug logs, keep only critical errors
// (No console.log at all in production code)

// ⚠️ ACCEPTABLE: Keep console.error for unexpected failures
console.error('Failed to load critical resource:', error);
```

**Rule**: Before committing, search for `console.log|console.warn` and remove debugging statements. Only `console.error` is acceptable for genuine error conditions that need developer attention.

### Error Handling Patterns

**Consistent error handling across admin pages**:

### Nginx Security Headers

**Modern Security Headers** for `apps/admin/nginx.conf`:

```nginx
# ❌ REMOVE: X-XSS-Protection is deprecated (can introduce vulnerabilities)
# add_header X-XSS-Protection "1; mode=block" always;

# ✅ ADD: Content Security Policy (modern XSS protection)
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* http://api:*; frame-ancestors 'self';" always;

# ✅ KEEP: These are still valid
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

**Note**: CSP `'unsafe-inline'` is needed for Vite dev builds. For production, configure Vite to use nonces or hashes.

### File Structure Conventions

```
apps/admin/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components (Button, Input, Card)
│   │   └── settings/     # Feature-specific components (SecuritySettings)
│   ├── contexts/         # React contexts (AuthContext)
│   ├── lib/              # Utilities (api-client)
│   ├── pages/            # Route pages (Login, Setup, Settings)
│   ├── services/         # API service layer
│   └── types/            # TypeScript type definitions
├── nginx.conf            # Production nginx config
├── Dockerfile            # Multi-stage build
├── SECURITY.md           # Security documentation
└── REACT_PATTERNS.md     # React best practices
```

### Admin Panel Testing Checklist

Before committing admin panel changes:

1. **Security**:
   - [ ] No tokens in localStorage
   - [ ] Errors are logged, not silently ignored
   - [ ] Network errors show user feedback

2. **React Patterns**:
   - [ ] No setState during render
   - [ ] useEffect for side effects
   - [ ] Callbacks memoized with useCallback
   - [ ] Forms reset after successful mutations

3. **Code Quality**:
   - [ ] Components under 150 lines
   - [ ] No duplicated Card/CardContent boilerplate
   - [ ] Input validation (min/max, type checking)
   - [ ] TypeScript errors resolved
   - [ ] All debug console.log statements removed

4. **Build**:
   - [ ] `pnpm build` succeeds
   - [ ] No console errors in production build
   - [ ] CSP headers don't block functionality

5. **Accessibility** (WCAG 2.1 AA):
   - [ ] Form labels with `htmlFor` attributes
   - [ ] Icon-only buttons have `aria-label`
   - [ ] Modals have proper ARIA attributes (`role="dialog"`, `aria-modal`, `aria-labelledby`)
   - [ ] Focus management (trap focus in modals, restore on close)
   - [ ] Keyboard navigation works (Tab, ESC key)
   - [ ] Screen reader text for status icons (`<span className="sr-only">`)
   - [ ] Tables have `<caption>` elements
   - [ ] Loading states use `role="status"` and `aria-live`

6. **Consistency**:
   - [ ] Import `handleApiError` from `'../lib/api-client'`
   - [ ] Error handling with try/catch and user-friendly messages
   - [ ] Section comments like `{/* Header */}`, `{/* Filters */}`
   - [ ] Destructure `error` from useQuery hooks

---

## Notification System Architecture

**Location**: `packages/backend/src/queue/workers/notifications/`

**Pattern**: Strategy Pattern + Registry Pattern + Factory Pattern

### Notifier Structure (Each notifier is self-contained)

```typescript
// Each notifier file contains:
// 1. Config interface
export interface EmailNotifierConfig extends BaseNotifierConfig {
  type: 'email';
  smtp?: { host: string; port: number /* ... */ };
  from: string;
}

// 2. Notifier implementation
export class EmailNotifier implements INotifier {
  readonly type = 'email';

  // 3. Static config loader (reads from env vars)
  static loadConfig(): EmailNotifierConfig | null {
    if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
      return null;
    }
    // Load from environment variables
  }

  async send(recipient, context, event): Promise<NotificationResult> {
    // Implementation
  }
}

// 4. Factory function
export function createEmailNotifier(config: EmailNotifierConfig): EmailNotifier {
  return new EmailNotifier(config);
}
```

**Key Principles**:

1. **Single Responsibility** - Each notifier manages its own config type, loading logic, and delivery
2. **No Centralized Config Files** - Config types live with their notifiers, not in shared files
3. **Static loadConfig()** - Each notifier knows how to load its own configuration from environment
4. **Registry Pattern** - `NotifierRegistry` manages all notifiers, creates NotifierConfig union type

### Adding New Notifier (e.g., Telegram)

1. Create `telegram-notifier.ts` with:
   - `TelegramNotifierConfig` interface
   - `TelegramNotifier` class implementing `INotifier`
   - `static loadConfig()` method reading from env vars
   - `createTelegramNotifier()` factory function

2. Update `notifier-registry.ts`:
   - Import new notifier and config type
   - Add to `NotifierConfig` union type
   - Add case to `createNotifier()` switch statement

3. Update `notification-worker.ts`:
   - Import notifier class
   - Call `TelegramNotifier.loadConfig()` in worker initialization

**No centralized config loader needed** - each notifier is autonomous!

---

**Always prioritize:** Type safety, testability, single responsibility, explicit over implicit, production-grade security.
