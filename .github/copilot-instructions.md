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
3. Execute tests (336 total: 244 unit + 79 integration + 13 load)
4. Cleanup container

```bash
pnpm test              # All tests (requires Docker running)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

See: `packages/backend/TESTING.md`, `tests/setup.ts`

## Security Best Practices

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

### Error Code Validation

Check both error codes AND PostgreSQL-specific codes:

```typescript
if (error.code === 'ECONNREFUSED' || error.code?.match(/^\d{5}$/)) {
  return processDatabaseError(error);
}
```

## Code Quality Principles (SOLID, DRY, KISS)

### Single Responsibility Principle

One class = one reason to change. Extract focused components:

- ❌ 580-line modal with 6 responsibilities
- ✅ 8 focused components: StyleManager, TemplateManager, DOMElementCache, FormValidator, etc.

### DRY - Don't Repeat Yourself

Extract duplicated structures into utility functions:

```typescript
// Instead of 7 duplicated response objects
function buildErrorResponse(statusCode, error, message, details?): ErrorResponse {
  return { statusCode, error, message, timestamp, path, details };
}
```

### Open/Closed Principle

Easy to extend without modification - use arrays of handlers, not if/else chains:

```typescript
// Add new error type without changing existing code
errorHandlers.push({ matcher: isNewErrorType, processor: processNewError });
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
