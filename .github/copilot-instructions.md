# GitHub Copilot Instructions for BugSpotter

You are working on **BugSpotter**, a professional bug reporting SDK with session replay capabilities, built as a pnpm workspace monorepo.

## Project Structure

- **packages/sdk** - Core TypeScript SDK with rrweb session replay (~99KB bundle)
- **packages/backend** - Fastify 5.6.1 REST API with PostgreSQL 16 database
- **packages/types** - Shared TypeScript type definitions
- **packages/backend-mock** - Mock API server for SDK testing
- **apps/demo** - Interactive demo application

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
3. Execute tests (621 backend + 404 SDK = 1,025+ total)
4. Cleanup container

```bash
pnpm test              # All tests (requires Docker running)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

**Test Distribution:**
- Backend: 621 tests (unit + integration + load)
- SDK: 404 tests (unit + E2E + Playwright)

See: `packages/backend/TESTING.md`, `tests/setup.ts`

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
  filename = decodeUrlSafely(filename);      // Decode URL encoding attacks
  filename = removeControlCharacters(filename); // Strip null bytes
  filename = extractBasename(filename);       // path.basename() defeats ../
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
function validateProjectId(id) { /* 35 lines */ }
function validateBugId(id) { /* 35 identical lines */ }

// ✅ GOOD: 34 lines total (51% reduction)
function validateId(id, type, options) { /* 28 lines */ }
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
function helperA() { /* ... */ }
function helperB() { /* ... */ }

// ============================================================================
// PUBLIC API
// ============================================================================
export function mainFunction() {
  // Uses helpers
}
```

## Commit & Workflow Guidelines

### Commit Messages

Keep under 60 words, use conventional commits:

```
feat: add session replay support with rrweb integration
fix: remove await on synchronous generateTokens function
refactor: implement strategy pattern for error handlers
docs: complete ticket integration section with examples
```

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

- **Error Handling**: `packages/backend/src/api/middleware/error.ts` (370 lines, strategy pattern)
- **Authentication**: `packages/backend/src/api/middleware/auth.ts` (168 lines, dual auth)
- **Database Client**: `packages/backend/src/db/client.ts` (factory pattern)
- **Repositories**: `packages/backend/src/db/repositories.ts` (repository pattern)
- **Sanitizer**: `packages/sdk/src/utils/sanitize.ts` (facade pattern, SOLID principles)
- **Session Replay**: `packages/sdk/docs/SESSION_REPLAY.md` (rrweb integration guide)

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

**Always prioritize:** Type safety, testability, single responsibility, explicit over implicit, production-grade security.
