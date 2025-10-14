# BugSpotter System Overview

**Last Updated**: October 14, 2025  
**Version**: 0.1.0 (Pre-release)  
**Status**: Active Development

## Executive Summary

BugSpotter is a professional bug reporting SDK with session replay capabilities, built as a production-grade pnpm workspace monorepo. The system enables developers to capture, store, and manage bug reports with rich context including screenshots, session recordings, and user metadata.

**Architecture**: Plugin-based backend API + lightweight browser SDK + S3/local storage + PostgreSQL + Redis queues  
**Test Coverage**: 1,261 automated tests (100% passing)  
**Development Phase**: Feature-complete, pre-npm publication

---

## System Architecture

### High-Level Components

```
┌─────────────────┐
│   Browser SDK   │ (99KB, rrweb session replay)
│   TypeScript    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Fastify API    │ (Node 20, TypeScript)
│  (Backend)      │
└────────┬────────┘
         │
    ┌────┴────────┬─────────────┬──────────┐
    ▼             ▼             ▼          ▼
┌───────────┐ ┌───────┐ ┌──────────┐ ┌────────┐
│ PostgreSQL│ │ Redis │ │    S3    │ │ Plugins│
│   16      │ │   7   │ │ Storage  │ │ (Jira) │
└───────────┘ └───────┘ └──────────┘ └────────┘
```

### Technology Stack

**Backend**:

- **Runtime**: Node.js 20+ (ES2023), Docker containers
- **Framework**: Fastify 5.6.1 (REST API)
- **Database**: PostgreSQL 16 with connection pooling
- **Queue**: BullMQ 5.x (Redis-backed job queue)
- **Storage**: AWS S3 SDK v3 + local filesystem fallback
- **Auth**: JWT (1h access + 7d refresh) + API keys (`bgs_` prefix)
- **Security**: Helmet CSP, CORS, rate limiting, encryption (AES-256-GCM)

**SDK**:

- **Bundle**: ~99KB (rrweb session replay)
- **Target**: ES2017 (95%+ browser coverage)
- **Features**: Screenshot capture, session recording, PII detection, modal widget

**Infrastructure**:

- **Testing**: Vitest + Testcontainers (ephemeral PostgreSQL + Redis)
- **Monorepo**: pnpm workspaces with 4 packages + 1 demo app
- **CI/CD**: GitHub Actions (lint, typecheck, test, build)

---

## Core Features

### 1. Bug Report Management

- Create bug reports via SDK or API
- Rich metadata (browser, OS, viewport, custom fields)
- Screenshot and session replay attachments
- Soft delete with configurable retention policies
- Full-text search and advanced filtering

### 2. Session Replay

- rrweb-based DOM recording
- 10-second buffer capture on error
- Compressed storage (~1MB per 60s session)
- Privacy-safe (PII detection and sanitization)

### 3. Project & User Management

- Multi-project support with unique API keys
- Role-based access control (Admin, Viewer, Owner)
- JWT authentication with refresh tokens
- Project membership with granular permissions

### 4. Integration System (Plugin Architecture)

- **Platform Support**: Jira (v1.0.0), GitHub/Linear/Slack (roadmap)
- **Auto-discovery**: Plugin registry with lifecycle hooks
- **Generic API**: `/api/integrations/:platform/:projectId`
- **Encryption**: Credentials encrypted with AES-256-GCM
- **Configuration**: Per-project integration settings stored in PostgreSQL

### 5. Background Job Processing

- **Queues**: Screenshots, replays, integrations, notifications
- **Workers**: Concurrent processing with BullMQ
- **Retries**: Exponential backoff for failed jobs
- **Monitoring**: Queue health metrics and job status tracking

### 6. Data Retention & Compliance

- **Configurable policies**: Time-based, count-based, archive strategies
- **Legal hold**: Prevent deletion of flagged reports
- **Soft delete**: 30-day recovery window
- **Scheduled cleanup**: Cron-based retention enforcement

---

## Package Structure

### `packages/backend` (Core API)

**869 unit tests + 104 integration tests + 25 storage tests**

**Key Modules**:

- **`/api`**: Fastify routes, middleware (auth, error handling, rate limiting)
- **`/db`**: Repository pattern (6 repositories), query builder, migrations
- **`/integrations`**: Plugin system, Jira integration, registry
- **`/storage`**: S3/local storage with streaming uploads (template method pattern)
- **`/queue`**: BullMQ job definitions, workers, queue manager
- **`/retention`**: Retention policies, scheduler, archival strategies
- **`/utils`**: Encryption, sanitization, retry logic

**Architectural Patterns**:

- **Strategy Pattern**: Error handlers (matcher/processor chains)
- **Repository Pattern**: Data access layer with `BaseRepository`
- **Factory Pattern**: Database client creation
- **Facade Pattern**: Sanitizer, Modal UI
- **Template Method**: Storage upload with subclass-specific implementations
- **Plugin Registry**: Dynamic integration loading

### `packages/sdk` (Browser SDK)

**345 tests (unit + E2E + Playwright)**

**Features**:

- Bug report creation with screenshots
- Session replay recording (rrweb)
- PII detection and sanitization
- Modal widget for user feedback
- Screenshot processor with DOM caching
- Configurable transport layer

**Build**: Webpack → ES2017 bundle (~99KB)

### `packages/types` (Shared Types)

Shared TypeScript definitions for API contracts, database entities, and shared interfaces.

### `packages/backend-mock` (Development Mock)

JSON Server for SDK development without full backend.

### `apps/demo` (Interactive Demo)

Browser-based demo showcasing SDK features with bug simulation.

---

## Database Schema

### Core Tables

**`projects`**

- `id` (UUID PK)
- `name` (text)
- `api_key` (text, unique, indexed)
- `created_at`, `updated_at`

**`bug_reports`**

- `id` (UUID PK)
- `project_id` (FK → projects)
- `title`, `description`
- `metadata` (JSONB) - browser, OS, viewport
- `screenshot_url`, `session_replay_url`
- `status` (open, in_progress, resolved, closed)
- `priority` (low, medium, high, critical)
- `deleted_at` (soft delete), `legal_hold` (boolean)

**`sessions`**

- `id` (UUID PK)
- `bug_report_id` (FK → bug_reports)
- `events` (JSONB) - rrweb event array
- `duration_ms`, `created_at`

**`users`**

- `id` (UUID PK)
- `email` (unique), `password_hash`
- `role` (admin, viewer, owner)
- `created_at`, `updated_at`

**`tickets`** (External platform links)

- `id` (UUID PK)
- `bug_report_id` (FK → bug_reports)
- `external_platform` (jira, github, linear)
- `external_id`, `external_url`
- `status` (open, closed)

**`project_integrations`** (Plugin configurations)

- `id` (UUID PK)
- `project_id` (FK → projects)
- `platform` (jira, github, linear)
- `enabled` (boolean)
- `config` (JSONB) - host, project key, etc.
- `encrypted_credentials` (text) - AES-256-GCM encrypted
- Unique constraint: `(project_id, platform)`

**`project_members`**

- `project_id` (FK → projects)
- `user_id` (FK → users)
- `role` (admin, developer, viewer)
- Composite PK: `(project_id, user_id)`

### Indexes

- `bug_reports.project_id` (B-tree)
- `bug_reports.status` (B-tree)
- `bug_reports.created_at` (B-tree DESC)
- `projects.api_key` (Unique B-tree)
- `users.email` (Unique B-tree)
- `project_integrations.(project_id, platform)` (Unique)

---

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Login (returns JWT + refresh token)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate refresh token

### Projects

- `POST /api/projects` - Create project (returns API key)
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/regenerate-key` - Rotate API key (admin)

### Bug Reports

- `POST /api/reports` - Create report (API key auth)
- `GET /api/reports` - List reports (pagination, filters)
- `GET /api/reports/:id` - Get report details
- `PATCH /api/reports/:id` - Update status/priority
- `DELETE /api/reports/:id` - Soft delete

### Integrations (Generic Plugin API)

- `GET /api/integrations/platforms` - List available integrations
- `POST /api/integrations/:platform/test` - Test connection with config
- `POST /api/integrations/:platform/:projectId` - Save configuration
- `GET /api/integrations/:platform/:projectId` - Get configuration
- `PATCH /api/integrations/:platform/:projectId` - Enable/disable
- `DELETE /api/integrations/:platform/:projectId` - Delete configuration

### Job Queue

- `GET /api/queues/health` - Queue health check (public)
- `GET /api/queues/metrics` - Queue metrics (admin)

### Retention

- `POST /api/retention/execute` - Manually trigger retention cleanup (admin)

---

## Security Architecture

### Defense in Depth (Multiple Layers)

**1. Input Validation**

- SQL Injection: Parameterized queries (`$1`, `$2` placeholders)
- Path Traversal: `path.basename()` + component validation
- Identifier Validation: `^[a-zA-Z0-9_]+$` regex for column names
- Pagination Limits: 1-1000 records, batch max 1000

**2. Sanitization**

- S3 Key Sanitization: Whitelist + regex + encoding removal
- Filename Sanitization: Control character removal, extension validation
- PII Detection: Email, phone, SSN pattern matching

**3. Encryption**

- Credentials: AES-256-GCM with per-encryption random IV and salt
- Master Key: scrypt key derivation (N=16384)
- Passwords: bcrypt with cost factor 10

**4. Authentication**

- **Dual Auth System**:
  - API Keys: `bgs_` prefix, no expiration, project-scoped
  - JWT Tokens: 1h access + 7d refresh, user-scoped
- **Public Routes**: Explicit `config: { public: true }` marker
- **Middleware**: Auth check on every request (pre-route)

**5. Authorization (RBAC)**

- **Roles**: Admin (full access), Viewer (read-only), Owner (project-specific)
- **Resource Checks**: `checkProjectAccess()` validates ownership
- **IDOR Prevention**: Project ID validation on all resource access

**6. HTTP Security Headers (Helmet)**

- Content Security Policy (CSP): No `unsafe-inline`, explicit sources
- Cross-Origin Embedder Policy: `require-corp`
- X-Frame-Options: `DENY`
- Strict-Transport-Security: HTTPS enforcement

**7. Rate Limiting**

- 100 requests per 15 minutes per IP
- Per-route customization available

---

## Code Quality Standards

### TypeScript Configuration

**Strict Mode** (13 strict compiler options enabled):

- `strict: true` (umbrella for all strict checks)
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `noUnusedLocals`, `noUnusedParameters`
- `isolatedModules` (for fast transpilation)

**Target Runtimes**:

- **Backend**: ES2023 (Node 20+ features: top-level await, Array.toSorted())
- **SDK**: ES2017 (95%+ browser coverage: async/await, Object.entries())
- **Types**: ES2022 (declaration-only, composite project)

### Design Principles (SOLID)

**Single Responsibility**:

- Functions: 3-30 lines (median ~10)
- Classes: One clear purpose (e.g., `StyleManager`, `FormValidator`)
- Refactored 580-line modal → 8 focused components

**DRY (Don't Repeat Yourself)**:

- Extract duplicated logic (e.g., 70-line ID validation → 34 lines with shared helper)
- Named constants for magic numbers
- Utility functions for common patterns

**Open/Closed**:

- Error handlers: Array of matcher/processor pairs (add new without modifying existing)
- Plugin system: Add integrations without changing routes
- Storage types: Whitelist array (easy to extend)

**Separation of Concerns** (3 layers):

- **Repository**: Pure data access (SQL queries, CRUD)
- **Service**: Business logic (orchestration, transactions, audit logs)
- **API Route**: HTTP concerns (validation, auth, response formatting)

**Dependency Inversion**:

- Interfaces for storage (`IStorageService`)
- Injected dependencies (repository pattern)
- Factory functions for plugin creation

### File Naming Convention

**Standard**: `kebab-case` for all multi-word files

- ✅ `dom-element-cache.ts`, `form-validator.ts`, `base-storage-service.ts`
- ❌ `camelCase.ts`, `PascalCase.ts`, `dot.separated.ts`

**Reserved Dot Notation**:

- Configuration: `vitest.config.ts`, `eslint.config.js`
- Testing: `*.test.ts`, `setup.integration.ts`
- Types: `types.ts`, `*.d.ts`

**Rationale**: Shell-friendly, Git-friendly (case-insensitive filesystems), web standards compliance

### Helper Function Patterns

**Naming**: Verb-noun structure (e.g., `removeControlCharacters`, `extractBasename`)

**Types**:

1. **Validators**: Return boolean or throw
2. **Transformers**: Return transformed value
3. **Extractors**: Parse and return structured data
4. **Handlers**: Encapsulate specific logic

**Organization**:

1. Constants at top
2. Private helpers grouped by purpose
3. Public API at bottom (uses helpers)

---

## Testing Strategy

### Test Distribution

**Total**: 1,261 tests (100% passing)

- **Backend Core**: 869 unit tests
- **Backend Integration**: 104 tests (Testcontainers)
- **Backend Storage**: 25 tests (S3 + local)
- **Backend Integrations**: 59 tests (plugin system + Jira)
- **SDK**: 345 tests (unit + E2E + Playwright)

### Test Infrastructure

**Testcontainers** (No manual setup required):

- PostgreSQL 16 container with migrations
- Redis 7 container for queue tests
- Automatic cleanup after test runs

**Test Types**:

1. **Unit Tests**: Pure logic, mocked dependencies
2. **Integration Tests**: Real database + Redis + storage
3. **E2E Tests**: Full API server + all services
4. **Load Tests**: 100+ concurrent operations, memory leak detection

### Test Commands

```bash
pnpm test              # All tests (requires Docker)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm --filter @bugspotter/backend test  # Backend only
pnpm --filter @bugspotter/sdk test      # SDK only
```

### CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`):

- Trigger: Push to `main`/`develop`, PRs to protected branches
- Jobs: Lint, typecheck, unit tests, integration tests, build
- **Feature branches**: Only run on PR (prevent duplicate runs)

---

## Plugin System Architecture

### Overview

The integration system uses a **plugin architecture** to support multiple external platforms (Jira, GitHub, Linear, Slack) without modifying core code.

### Key Components

**1. Plugin Registry** (`PluginRegistry`)

- Discovers and loads plugins
- Manages plugin lifecycle (onLoad, onUnload, validate)
- Provides service lookup by platform

**2. Plugin Loader** (`loadIntegrationPlugins`)

- Auto-discovers plugins from `/integrations/*/plugin.ts`
- Registers with registry
- Logs loading results

**3. Base Interface** (`IntegrationService`)

```typescript
interface IntegrationService {
  readonly platform: string;
  createFromBugReport(report: BugReport, projectId: string): Promise<IntegrationResult>;
  testConnection(projectId: string): Promise<boolean>;
}
```

**4. Plugin Definition** (`IntegrationPlugin`)

```typescript
interface IntegrationPlugin {
  metadata: { name; platform; version; description; author; requiredEnvVars };
  factory: (context: PluginContext) => IntegrationService;
  lifecycle?: { onLoad?; onUnload?; validate? };
}
```

### Current Plugins

**Jira Integration v1.0.0**:

- Full CRUD on Jira issues
- ADF (Atlassian Document Format) conversion
- Priority mapping (critical→Highest, high→High, etc.)
- Screenshot attachment upload
- Configuration encryption
- Connection testing

**Roadmap**: GitHub, Linear, Slack

### Generic Integration API

All plugins work through the same HTTP endpoints:

```
GET    /api/integrations/platforms                    # List available
POST   /api/integrations/:platform/test               # Test connection
POST   /api/integrations/:platform/:projectId         # Save config
GET    /api/integrations/:platform/:projectId         # Get config
PATCH  /api/integrations/:platform/:projectId         # Enable/disable
DELETE /api/integrations/:platform/:projectId         # Delete
```

**Benefits**:

- Add new integrations without changing routes
- Platform-specific validation delegated to plugins
- Generic configuration storage in `project_integrations` table

---

## Storage Layer

### Strategy Pattern Implementation

**Base Class**: `BaseStorageService` (template method pattern)

- Defines upload algorithm
- Common validation and sanitization
- Subclasses implement storage-specific logic

**Implementations**:

1. **S3 Storage** (`StorageService`):
   - AWS SDK v3 with multipart uploads
   - Streaming for memory efficiency (5MB chunks)
   - Retry logic with exponential backoff
   - Pre-signed URL generation (1h expiry)

2. **Local Storage** (`LocalStorageService`):
   - Filesystem operations with Node.js `fs/promises`
   - Directory auto-creation
   - Streaming with `pipeline()` for large files
   - HTTP URL generation for local access

### Memory-Efficient Streaming

**Critical**: Never buffer entire streams into memory

```typescript
// ✅ GOOD: S3 streaming with Upload class
async uploadStream(key: string, stream: Readable) {
  const upload = new Upload({
    client: this.client,
    params: { Bucket, Key, Body: stream },
    partSize: 5 * 1024 * 1024,  // 5MB parts
    queueSize: 4,                // 4 concurrent uploads
  });
  return await upload.done();
}

// ✅ GOOD: Local streaming with pipeline
async uploadStream(key: string, stream: Readable) {
  const writeStream = createWriteStream(filePath);
  await pipeline(stream, writeStream);  // Direct streaming
}

// ❌ BAD: Buffering (OOM risk on large files)
const buffer = await streamToBuffer(stream);  // Loads entire file!
```

**Benefits**: Constant ~5MB memory usage vs linear growth, prevents OOM on large files

### Path Security

**Defense in Depth**:

1. Whitelist validation (storage types)
2. ID validation (UUID format + path traversal check)
3. Filename sanitization (basename extraction)
4. Final key sanitization

**Storage Key Format**: `{type}/{projectId}/{bugId}/{filename}`

- Example: `screenshots/proj-123/bug-456/screenshot-1234567890.png`

---

## Background Job System

### Queue Architecture

**4 Queues** (BullMQ on Redis):

1. **Screenshots**: Image optimization, thumbnail generation
2. **Replays**: Session replay processing and compression
3. **Integrations**: External platform sync (Jira, GitHub)
4. **Notifications**: Email/webhook notifications

### Worker Management

**2 Active Workers**:

- Screenshot worker (sharp image processing)
- Replay worker (rrweb event processing)

**Features**:

- Concurrent job processing
- Automatic retries with exponential backoff
- Job status tracking (waiting, active, completed, failed)
- Health checks and metrics

### Queue Monitoring

**Metrics Endpoint**: `GET /api/queues/metrics`

```json
{
  "queues": [
    {
      "name": "screenshots",
      "waiting": 5,
      "active": 2,
      "completed": 1243,
      "failed": 3
    }
  ]
}
```

### Performance

**Throughput**: ~2,500 jobs/second (queue insertion)
**Concurrency**: 10 concurrent jobs handled in <5s

---

## Data Retention System

### Retention Strategies

**1. Time-Based Retention**

```typescript
{ type: 'time', daysToKeep: 90 }
```

Delete reports older than 90 days

**2. Count-Based Retention**

```typescript
{ type: 'count', maxReports: 10000 }
```

Keep only the most recent 10,000 reports

**3. Archive Strategy**

```typescript
{ type: 'archive', archiveAfterDays: 180, deleteAfterDays: 365 }
```

Archive at 180 days, delete at 365 days

### Legal Hold

Flagged reports exempt from retention:

```typescript
await db.bugReports.setLegalHold([reportId1, reportId2], true);
```

### Scheduled Cleanup

**Cron**: Daily at 2 AM UTC

```typescript
const scheduler = new RetentionScheduler(retentionService);
scheduler.start('0 2 * * *'); // Every day at 2 AM
```

**Audit Trail**: All retention actions logged with project IDs and user IDs

---

## Development Workflow

### Quick Start

```bash
# Clone and install
git clone git@github.com:apexbridge-tech/bugspotter.git
cd bugspotter
pnpm install

# Start backend (requires Docker for PostgreSQL + Redis)
pnpm --filter @bugspotter/backend dev

# Start SDK dev server
pnpm --filter @bugspotter/sdk dev

# Run demo app
cd apps/demo && python -m http.server 8080
```

### Project Commands

```bash
# Development
pnpm dev              # Start all packages in dev mode
pnpm --filter @bugspotter/backend dev  # Backend only

# Building
pnpm build            # Build all packages
pnpm --filter @bugspotter/sdk build    # SDK only

# Testing
pnpm test             # Run all tests (requires Docker)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting without changes
```

### Git Workflow

**Branches**:

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches (PR to `develop`)

**Commit Convention**:

```
feat: add session replay support
fix: remove await on synchronous function
refactor: implement strategy pattern for error handlers
docs: complete ticket integration section
```

**CI Triggers**:

- Push to `main`/`develop`: Full CI (lint, typecheck, test, build)
- Pull request: Same as push
- Feature branches: Only run on PR (prevent duplicates)

---

## Configuration

### Environment Variables

**Backend** (`.env`):

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bugspotter

# Redis
REDIS_URL=redis://localhost:6379

# Storage (S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=bugspotter-uploads

# Storage (Local fallback)
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads

# Authentication
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key

# Server
PORT=3000
LOG_LEVEL=info
NODE_ENV=production

# Jira Integration (optional)
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ
```

**SDK** (`bugspotter.config.js`):

```javascript
window.BugSpotter.init({
  apiKey: 'bgs_your_api_key_here',
  endpoint: 'https://api.bugspotter.io',
  sessionReplay: {
    enabled: true,
    maskTextSelector: '.sensitive',
    blockSelector: '.private',
  },
  screenshot: {
    enabled: true,
    quality: 0.8,
  },
});
```

---

## Performance Characteristics

### Benchmarks

**API Response Times** (p95):

- Bug report creation: <200ms
- List reports (paginated): <100ms
- Screenshot upload (1MB): <500ms
- Session replay upload (500KB): <300ms

**Database Operations**:

- Single query: <10ms
- Batch insert (50 records): <500ms
- Pagination (100 records): <100ms

**Queue Processing**:

- Screenshot optimization: 1-3s per job
- Replay processing: 2-5s per job
- Queue insertion: <5ms
- Concurrent throughput: 2,500 jobs/s

**Memory Usage**:

- Backend: ~100MB baseline, ~150MB under load
- SDK: ~5MB runtime memory
- Streaming uploads: Constant 5MB (not linear with file size)

### Scalability

**Horizontal Scaling**:

- Stateless API servers (scale with load balancer)
- PostgreSQL read replicas for read-heavy workloads
- Redis Cluster for queue distribution
- S3 for unlimited storage scaling

**Resource Limits**:

- Max file upload: 10MB (configurable)
- Max batch size: 1000 records
- Connection pool: 20 connections
- Rate limit: 100 req/15min per IP

---

## Roadmap

### Current Phase: Pre-Release

- ✅ Core features complete
- ✅ Jira integration
- ✅ Plugin architecture
- ✅ Comprehensive test coverage
- ⏳ Documentation finalization
- ⏳ npm publication preparation

### Post-Release (v1.0)

- [ ] GitHub integration plugin
- [ ] Linear integration plugin
- [ ] Slack notifications plugin
- [ ] Email notifications
- [ ] Webhook system for custom integrations
- [ ] Advanced search (Elasticsearch)
- [ ] Real-time dashboard (WebSocket)
- [ ] Multi-tenancy support

### Future Enhancements

- [ ] Machine learning for duplicate detection
- [ ] Automatic bug categorization
- [ ] Performance monitoring integration
- [ ] Mobile SDK (React Native)
- [ ] Chrome/Firefox browser extension

---

## Key Files Reference

### Backend Core

- **Error Handling**: `src/api/middleware/error.ts` (strategy pattern)
- **Authentication**: `src/api/middleware/auth.ts` (dual auth: API keys + JWT)
- **Database Client**: `src/db/client.ts` (factory pattern)
- **Repositories**: `src/db/repositories.ts` (6 repositories extending BaseRepository)

### Storage Layer

- **Base Storage**: `src/storage/base-storage-service.ts` (template method)
- **S3 Storage**: `src/storage/storage-service.ts` (multipart uploads, retry)
- **Local Storage**: `src/storage/local-storage.ts` (filesystem operations)
- **Path Utils**: `src/storage/path-utils.ts` (defense-in-depth validation)

### Integration System

- **Plugin Registry**: `src/integrations/plugin-registry.ts`
- **Plugin Loader**: `src/integrations/plugin-loader.ts`
- **Jira Plugin**: `src/integrations/jira/plugin.ts`
- **Jira Service**: `src/integrations/jira/service.ts`
- **Jira Config**: `src/integrations/jira/config.ts` (encryption)

### SDK

- **Core**: `src/core/bugspotter.ts` (main SDK class)
- **Transport**: `src/core/transport.ts` (HTTP client)
- **Session Replay**: `src/session-replay/recorder.ts` (rrweb wrapper)
- **Sanitizer**: `src/utils/sanitize.ts` (PII detection, facade pattern)
- **Modal**: `src/widget/modal.ts` (user feedback widget)

---

## Documentation Index

### Primary Docs

- **`/README.md`** - Project overview and quick start
- **`/SYSTEM_OVERVIEW.md`** (this file) - Comprehensive system documentation
- **`/CONTRIBUTING.md`** - Contribution guidelines
- **`/CHANGELOG.md`** - Version history
- **`/.github/copilot-instructions.md`** - Copilot coding standards

### Package Docs

- **`/packages/backend/README.md`** - Backend API documentation
- **`/packages/backend/SECURITY.md`** - Security architecture
- **`/packages/backend/TESTING.md`** - Testing infrastructure
- **`/packages/sdk/README.md`** - SDK usage guide
- **`/packages/sdk/docs/SESSION_REPLAY.md`** - Session replay documentation

### Module Docs

- **`/packages/backend/src/queue/README.md`** - Queue system
- **`/packages/backend/src/storage/README.md`** - Storage layer
- **`/packages/backend/src/retention/README.md`** - Retention policies
- **`/packages/backend/src/integrations/PLUGIN_SYSTEM.md`** - Plugin architecture
- **`/packages/backend/src/integrations/jira/README.md`** - Jira integration

---

## Contributing

We welcome contributions! See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for:

- Code style guidelines
- Pull request process
- Development setup
- Testing requirements

**Key Principles**:

- All code must pass `pnpm lint` and `pnpm test`
- Follow SOLID principles and existing patterns
- Add tests for new features
- Update documentation for API changes
- Keep commits under 60 words

---

## License

Copyright © 2025 ApexBridge Technologies  
See LICENSE file for details.

---

## Support

- **Issues**: https://github.com/apexbridge-tech/bugspotter/issues
- **Email**: support@bugspotter.io
- **Docs**: https://docs.bugspotter.io

---

**End of System Overview**
