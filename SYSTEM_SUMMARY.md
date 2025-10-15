# BugSpotter: Comprehensive System Summary

**Version**: 0.3.0 (Pre-release)  
**Last Updated**: October 15, 2025  
**Test Coverage**: 1,547 tests passing (100%)  
**Architecture**: Production-grade pnpm workspace monorepo

---

## Executive Overview

BugSpotter is a professional bug reporting SDK with session replay capabilities, designed to capture, store, and manage bug reports with rich contextual data. The system combines a lightweight browser SDK (~99KB) with a production-ready backend API, providing developers with comprehensive debugging context including screenshots, session recordings, console logs, network requests, and user metadata.

**Core Value Proposition**: Accelerate bug reproduction and resolution by capturing the complete user context at the moment an error occurs, with built-in PII protection and enterprise-grade security.

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser Environment                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  BugSpotter SDK (99KB)                                         │ │
│  │  • Screenshot Capture (html-to-image)                          │ │
│  │  • Session Replay (rrweb)                                      │ │
│  │  • Console/Network Monitoring                                  │ │
│  │  • PII Sanitization (10+ patterns)                             │ │
│  │  • Modal Widget UI                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS/REST API
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Fastify Backend (Node 20)                       │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────┐ │
│  │ Auth Layer   │ API Routes   │ Middleware   │ Plugin System    │ │
│  │ • JWT        │ • Projects   │ • CORS       │ • Jira           │ │
│  │ • API Keys   │ • Reports    │ • Helmet     │ • GitHub (plan)  │ │
│  │ • RBAC       │ • Integr.    │ • Rate Limit │ • Linear (plan)  │ │
│  └──────────────┴──────────────┴──────────────┴──────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
    ┌──────────────┐     ┌──────────────┐    ┌──────────────┐
    │ PostgreSQL 16│     │   Redis 7    │    │  S3 Storage  │
    │ • Projects   │     │ • BullMQ     │    │ • Screenshots│
    │ • Reports    │     │ • 4 Queues   │    │ • Replays    │
    │ • Users      │     │ • Workers    │    │ • Attachments│
    │ • Sessions   │     │ • Jobs       │    │ (or Local FS)│
    └──────────────┘     └──────────────┘    └──────────────┘
```

### Technology Stack

**Frontend SDK (Browser)**

- **Language**: TypeScript (ES2017 target for 95%+ browser coverage)
- **Build Tool**: Webpack 5
- **Key Libraries**:
  - rrweb 2.0.0-alpha.4 (session replay)
  - html-to-image 1.11.13 (CSP-safe screenshots)
- **Bundle Size**: ~99KB minified
- **Memory Footprint**: ~15MB with 30-second replay buffer

**Backend API (Server)**

- **Runtime**: Node.js 20+ (ES2023 features)
- **Framework**: Fastify 5.6.1 (REST API)
- **Database**: PostgreSQL 16 (connection pooling, ACID transactions)
- **Queue**: BullMQ 5.x (Redis-backed job processing)
- **Storage**: AWS S3 SDK v3 (multipart uploads, streaming)
- **Security**: Helmet (CSP), CORS, rate limiting, AES-256-GCM encryption
- **Authentication**: JWT (1h access + 7d refresh) + API keys

**Development & Testing**

- **Monorepo**: pnpm workspaces (4 packages + 1 demo app)
- **Testing**: Vitest + Testcontainers + Playwright
- **CI/CD**: GitHub Actions (lint, typecheck, test, build)
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

---

## Core Features & Capabilities

### 1. **Bug Report Capture** (SDK)

**Screenshot Capture**

- CSP-safe DOM-to-image conversion using html-to-image
- Full-page capture as Base64 PNG (~500ms average)
- Fallback error handling with descriptive messages
- Respects Shadow DOM and web components

**Session Replay** (rrweb Integration)

- Records DOM mutations, mouse movements, clicks, scrolls
- Circular buffer maintains last 15-30 seconds (configurable)
- Performance-optimized with throttled event sampling (mousemove: 50ms, scroll: 100ms)
- Compressed storage (~1MB per 60-second session)
- JSON-serializable events for easy transmission

**Console Log Capture**

- Monitors all console levels: log, warn, error, info, debug
- Captures stack traces for errors
- Handles circular references in objects
- Configurable max logs (default: 100)
- Timestamp and level metadata

**Network Request Monitoring**

- Intercepts Fetch API and XMLHttpRequest
- Records request/response timing, status codes, headers
- Captures request/response bodies (with size limits)
- Tracks errors and timeouts
- Singleton pattern prevents duplicate monitoring

**Browser Metadata**

- Auto-detects browser (Chrome, Firefox, Safari, Edge, Opera, etc.)
- OS detection (Windows, macOS, Linux, iOS, Android, ChromeOS)
- Viewport dimensions, user agent, current URL
- Timestamp and custom fields support

### 2. **PII Sanitization** (SDK)

Automatic detection and redaction of sensitive data before transmission:

**Built-in Patterns**

- Email addresses → `[REDACTED-EMAIL]`
- Phone numbers (international formats) → `[REDACTED-PHONE]`
- Credit cards (Visa, MC, Amex, Discover) → `[REDACTED-CREDITCARD]`
- Social Security Numbers → `[REDACTED-SSN]`
- Kazakhstan IIN/BIN (with date validation) → `[REDACTED-IIN]`
- IP addresses (IPv4/IPv6) → `[REDACTED-IP]`

**Coverage**

- Console logs and error messages
- Network request/response data (URLs, headers, bodies)
- Error stack traces
- DOM text content in session replays
- Metadata (URLs, user agents)

**Configuration**

- Enable/disable globally
- Select specific patterns
- Define custom regex patterns
- Exclude DOM elements from sanitization
- Cyrillic text support for Russian/Kazakh content

**Performance**: <10ms overhead per bug report

### 3. **Backend API** (REST)

**Project Management**

- Create/update/delete projects
- Generate unique API keys (`bgs_` prefix)
- Multi-project support with isolation
- API key rotation (admin only)

**Bug Report Management**

- Create reports via SDK (API key auth) or API (JWT auth)
- Soft delete with 30-day recovery window
- Full-text search and advanced filtering
- Pagination, sorting by status/priority/date
- Rich metadata storage (JSONB)
- Screenshot and replay URL attachments

**User Authentication**

- User registration and login
- JWT token generation (1h access + 7d refresh)
- Refresh token rotation
- Role-based access control (Admin, Viewer, Owner)
- Project membership with granular permissions

**Integration System** (Plugin Architecture)

- Platform support: Jira (v1.0.0), GitHub/Linear/Slack (roadmap)
- Auto-discovery plugin registry with lifecycle hooks
- Generic API: `/api/integrations/:platform/:projectId`
- AES-256-GCM credential encryption
- Per-project configuration stored in PostgreSQL

### 4. **Storage Layer** (Backend)

**Template Method Pattern Implementation**

- `BaseStorageService` defines upload algorithm
- Common validation and sanitization in base class
- Subclasses implement storage-specific logic

**S3 Storage** (Production)

- AWS SDK v3 with multipart uploads (5MB chunks)
- True streaming for memory efficiency (constant ~5MB memory)
- Retry logic with exponential backoff
- Pre-signed URL generation (1h expiry)
- Supports S3, MinIO, LocalStack, Cloudflare R2

**Local Storage** (Development)

- Filesystem operations with Node.js `fs/promises`
- Streaming with `pipeline()` for large files
- Directory auto-creation
- HTTP URL generation

**Storage Structure**

```
/screenshots/{project_id}/{bug_id}/original.png
/replays/{project_id}/{bug_id}/metadata.json
/replays/{project_id}/{bug_id}/chunks/1.json.gz
/attachments/{project_id}/{bug_id}/{sanitized-filename}
```

**Security** (Defense in Depth)

1. Whitelist validation (storage types)
2. ID validation (UUID format + path traversal check)
3. Filename sanitization (basename extraction)
4. Final key sanitization (S3 key format)

### 5. **Background Job Processing** (BullMQ)

**4 Queues**

- `screenshots`: Image optimization, thumbnail generation (concurrency: 5)
- `replays`: Session replay chunking, compression (concurrency: 3)
- `integrations`: External platform sync (Jira, GitHub) (concurrency: 10)
- `notifications`: Email, Slack, webhook notifications (concurrency: 5)

**Features**

- Concurrent job processing with configurable concurrency
- Automatic retries with exponential backoff (3 attempts)
- Job status tracking (waiting, active, completed, failed)
- Health checks and metrics: `GET /api/queues/metrics`
- Graceful shutdown (waits for jobs to complete)

**Performance**

- Throughput: ~2,500 jobs/second (queue insertion)
- 100+ concurrent operations handled in <5s
- Memory usage: ~100MB baseline, ~150MB under load

### 6. **Data Retention & Compliance** (Backend)

**Retention Strategies**

- **Time-Based**: Delete reports older than X days (e.g., 90 days)
- **Count-Based**: Keep only most recent X reports (e.g., 10,000)
- **Archive Strategy**: Archive at X days, delete at Y days (e.g., 180→365)

**Legal Hold**

- Flagged reports exempt from retention policies
- `setLegalHold()` prevents deletion
- Audit trail for all hold operations

**Compliance Support**

- GDPR (EU): 30-day deletion window
- SOX/HIPAA (US): Extended retention
- Kazakhstan law: IIN/BIN data handling
- UK-GDPR, PIPEDA (Canada)
- Configurable retention periods per region

**Scheduled Cleanup**

- Daily cron job at 2 AM UTC (configurable)
- Batch processing with error handling
- Email notifications (placeholder for implementation)
- Preview mode for dry-run testing

---

## Security Architecture

### 1. **Authentication & Authorization**

**Dual Authentication System**

- **API Keys**: `bgs_` prefix, no expiration, project-scoped (for SDK→backend)
- **JWT Tokens**: 1h access + 7d refresh, user-scoped (for user→backend)

**Public Routes Configuration**

- Mark routes as public using `config: { public: true }`
- Auth middleware checks `request.routeOptions.config?.public` first
- No hardcoded PUBLIC_ROUTES arrays

**Role-Based Access Control (RBAC)**

- **Roles**: Admin (full access), Viewer (read-only), Owner (project-specific)
- **Resource Checks**: `checkProjectAccess()` validates ownership
- **IDOR Prevention**: Project ID validation on all resource access

### 2. **SQL Injection Protection**

**Three-Layer Defense**

1. **Parameterized queries**: All values use `$1`, `$2` placeholders
2. **Identifier validation**: Column names validated with `^[a-zA-Z0-9_]+$` regex
3. **Input validation**: Pagination limits (1-1000), batch limits (max 1000)

```typescript
// ✅ SAFE: Parameterized values, validated identifiers
await client.query('SELECT * FROM users WHERE email = $1', [userInput]);
await db.list({}, { sort_by: validateSqlIdentifier(userColumn) });

// ❌ NEVER: String interpolation or unvalidated identifiers
await query(`WHERE email = '${input}'`); // SQL injection risk
await query(`ORDER BY ${userColumn}`); // Identifier injection risk
```

### 3. **Path Traversal Prevention**

**Defense in Depth for Storage Keys**

1. Whitelist validation (valid storage types)
2. UUID format validation for project/bug IDs
3. `path.basename()` extraction (defeats `../` attacks)
4. Remove control characters (null bytes, etc.)
5. Decode URL encoding safely
6. Final key sanitization

```typescript
// ✅ GOOD: Multiple defenses
function sanitizeFilename(filename: string): string {
  filename = decodeUrlSafely(filename); // Decode URL encoding
  filename = removeControlCharacters(filename); // Strip null bytes
  filename = extractBasename(filename); // path.basename() defeats ../
  // ... additional validation
}

// ❌ BAD: Single defense (can be bypassed)
filename = filename.replace(/\.\./g, ''); // Fails on ....//
```

### 4. **Encryption**

**Credential Encryption** (AES-256-GCM)

- Master key: scrypt key derivation (N=16384)
- Per-encryption random IV (12 bytes) and salt (16 bytes)
- Authenticated encryption with auth tag verification
- Used for: Jira API tokens, OAuth secrets, integration credentials

**Password Hashing** (bcrypt)

- Cost factor: 10 (2^10 iterations)
- Salted and hashed user passwords
- Constant-time comparison to prevent timing attacks

### 5. **HTTP Security Headers** (Helmet)

**Content Security Policy (CSP)**

- No `unsafe-inline` or broad `https:` directives
- Explicit source lists for script-src, style-src, img-src
- 10+ specific directives for fine-grained control

**Additional Headers**

- Cross-Origin Embedder Policy: `require-corp`
- X-Frame-Options: `DENY` (prevent clickjacking)
- Strict-Transport-Security: HTTPS enforcement
- X-Content-Type-Options: `nosniff`

### 6. **Rate Limiting**

- 100 requests per 15 minutes per IP (default)
- Per-route customization available
- Prevents DoS attacks and brute-force attempts

### 7. **Memory-Efficient Streaming**

**Critical for Large File Uploads**

- Never buffer entire streams into memory (OOM risk)
- Use `Upload` class (@aws-sdk/lib-storage) for S3 (5MB parts, 4 concurrent)
- Use `pipeline` for local filesystem (direct streaming)
- Constant ~5MB memory usage vs linear growth with file size

---

## Code Quality & Design Principles

### SOLID Principles

**Single Responsibility Principle**

- Functions: 3-30 lines (median ~10)
- Classes: One clear purpose (e.g., `StyleManager`, `FormValidator`)
- Example: Refactored 580-line modal → 8 focused components

**Don't Repeat Yourself (DRY)**

- Extract duplicated structures into utility functions
- Example: 70-line ID validation duplication → 34 lines with shared helper (51% reduction)
- Named constants for magic numbers

**Open/Closed Principle**

- Easy to extend without modification
- Error handlers: Array of matcher/processor pairs (add new without changing existing)
- Plugin system: Add integrations without modifying routes
- Storage types: Whitelist array (easy to extend)

**Separation of Concerns** (Layered Architecture)

- **Repository Layer**: Pure data access (SQL queries, CRUD)
- **Service Layer**: Business logic (orchestration, transactions, audit logs)
- **API Route Layer**: HTTP concerns (validation, auth, response formatting)

**Dependency Inversion**

- Interfaces for storage (`IStorageService`)
- Injected dependencies (repository pattern)
- Factory functions for plugin creation

### Design Patterns

**Strategy Pattern** (Error Handling)

- Error handlers use matcher/processor pairs in a chain
- Add new error types without modifying existing code

**Repository Pattern** (Database)

- Each entity has a dedicated repository extending `BaseRepository`
- DatabaseClient facade for convenience
- 6 repositories: Project, User, BugReport, Session, Ticket, ProjectMember

**Factory Pattern** (Database Client)

- Private constructor + static factory method
- Prevents direct instantiation, ensures proper initialization

**Facade Pattern** (Sanitizer, Modal)

- Sanitizer coordinates PatternManager, StringSanitizer, ValueSanitizer, ElementMatcher
- BugReportModal coordinates StyleManager, TemplateManager, FormValidator, PIIDetectionDisplay

**Template Method Pattern** (Storage Layer)

- Base class defines upload algorithm
- Subclasses implement storage-specific logic (S3, local filesystem)
- Eliminates ~200 lines of duplicated validation/sanitization code

**Plugin Registry Pattern** (Integrations)

- Dynamic integration loading from `/integrations/*/plugin.ts`
- Manages plugin lifecycle (onLoad, onUnload, validate)
- Provides service lookup by platform

### TypeScript Configuration

**Strict Mode** (13 strict compiler options enabled)

- `strict: true` umbrella setting
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `noUnusedLocals`, `noUnusedParameters`
- `isolatedModules` for fast transpilation

**Target Runtimes**

- **Backend**: ES2023 (Node 20+ features: top-level await, Array.toSorted())
- **SDK**: ES2017 (95%+ browser coverage: async/await, Object.entries())
- **Types**: ES2022 (declaration-only, composite project)

**Key Patterns**

1. **Type Guards**: Check key presence, not value types (handles undefined)
2. **isolatedModules Compliance**: Always use `export type` for type-only re-exports
3. **Unused Variables**: Remove unused declarations immediately
4. **Verify Errors**: Always check TypeScript errors after file operations

### File Naming Convention

**Standard**: `kebab-case` for all multi-word files

- ✅ `dom-element-cache.ts`, `form-validator.ts`, `base-storage-service.ts`
- ❌ `camelCase.ts`, `PascalCase.ts`, `dot.separated.ts`

**Reserved Dot Notation**

- Configuration: `vitest.config.ts`, `eslint.config.js`
- Testing: `*.test.ts`, `setup.integration.ts`
- Types: `types.ts`, `*.d.ts`

**Rationale**: Shell-friendly, Git-friendly (case-insensitive filesystems), web standards compliance

---

## Testing Strategy

### Test Distribution

**Total: 1,547 tests (100% passing)**

- **Backend Core**: 869 unit tests
- **Backend Integration**: 104 tests (Testcontainers with PostgreSQL 16)
- **Backend Storage**: 25 tests (S3 + local)
- **Backend Queue**: 59 tests (BullMQ with Redis 7)
- **Backend Integrations**: 59 tests (plugin system + Jira)
- **SDK**: 345 tests (unit + E2E + Playwright)

### Test Infrastructure

**Testcontainers** (Zero Manual Setup)

- Automatically launches PostgreSQL 16 and Redis 7 containers
- Runs migrations and seeds test data
- Executes all test suites
- Cleanup after test completion
- **Requirement**: Docker must be running

**Test Types**

1. **Unit Tests**: Pure logic, mocked dependencies
2. **Integration Tests**: Real database + Redis + storage
3. **E2E Tests**: Full API server + all services
4. **Load Tests**: 100+ concurrent operations, memory leak detection
5. **Browser Tests**: Playwright (Chrome, Firefox, Safari)

### Test Commands

```bash
pnpm test              # All tests (requires Docker)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:integration  # Integration tests only
pnpm test:queue        # Queue tests only
pnpm test:load         # Load tests only
```

### CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`)

- **Triggers**: Push to `main`/`develop`, PRs to protected branches
- **Jobs**: Lint, typecheck, unit tests, integration tests, build
- **Feature Branches**: Only run on PR (prevent duplicate runs)

---

## Plugin System Architecture

### Overview

The integration system uses a **plugin architecture** to support multiple external platforms (Jira, GitHub, Linear, Slack) without modifying core code. Plugins are auto-discovered from `/integrations/*/plugin.ts` and registered with the PluginRegistry.

### Key Components

**1. Plugin Registry** (`PluginRegistry`)

- Discovers and loads plugins
- Manages plugin lifecycle (onLoad, onUnload, validate)
- Provides service lookup by platform

**2. Base Interface** (`IntegrationService`)

```typescript
interface IntegrationService {
  readonly platform: string;
  createFromBugReport(report: BugReport, projectId: string): Promise<IntegrationResult>;
  testConnection(projectId: string): Promise<boolean>;
}
```

**3. Plugin Definition** (`IntegrationPlugin`)

```typescript
interface IntegrationPlugin {
  metadata: PluginMetadata; // name, platform, version, description, author, requiredEnvVars
  factory: PluginFactory; // (context: PluginContext) => IntegrationService
}

// Advanced plugins can extend with lifecycle hooks
interface AdvancedIntegrationPlugin extends IntegrationPlugin {
  lifecycle?: { onLoad?; onUnload?; validate? };
}
```

### Current Plugins

**Jira Integration v1.0.0**

- Full CRUD on Jira issues
- ADF (Atlassian Document Format) conversion
- Priority mapping (critical→Highest, high→High, etc.)
- Screenshot attachment upload
- Configuration encryption with AES-256-GCM
- Connection testing
- Pure HTTP client using Node.js `https` module (no dependencies)

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

---

## Database Schema

### Core Tables

**`projects`**

- `id` UUID PK
- `name` text
- `api_key` text (unique, indexed, `bgs_` prefix)
- `created_at`, `updated_at` timestamps

**`bug_reports`**

- `id` UUID PK
- `project_id` UUID FK → projects
- `title`, `description` text
- `metadata` JSONB (browser, OS, viewport, custom fields)
- `screenshot_url`, `session_replay_url` text
- `status` enum (open, in_progress, resolved, closed)
- `priority` enum (low, medium, high, critical)
- `deleted_at` timestamp (soft delete)
- `legal_hold` boolean (retention protection)

**`sessions`**

- `id` UUID PK
- `bug_report_id` UUID FK → bug_reports
- `events` JSONB (rrweb event array)
- `duration_ms` integer
- `created_at` timestamp

**`users`**

- `id` UUID PK
- `email` text (unique)
- `password_hash` text (bcrypt)
- `role` enum (admin, viewer, owner)
- `created_at`, `updated_at` timestamps

**`tickets`** (External Platform Links)

- `id` UUID PK
- `bug_report_id` UUID FK → bug_reports
- `external_platform` text (jira, github, linear)
- `external_id`, `external_url` text
- `status` enum (open, closed)

**`project_integrations`** (Plugin Configurations)

- `id` UUID PK
- `project_id` UUID FK → projects
- `platform` text (jira, github, linear)
- `enabled` boolean
- `config` JSONB (host, project key, etc.)
- `encrypted_credentials` text (AES-256-GCM)
- Unique constraint: `(project_id, platform)`

**`project_members`**

- `project_id` UUID FK → projects
- `user_id` UUID FK → users
- `role` enum (admin, developer, viewer)
- Composite PK: `(project_id, user_id)`

### Indexes

- `bug_reports.project_id` (B-tree, foreign key)
- `bug_reports.status` (B-tree, filtering)
- `bug_reports.created_at` (B-tree DESC, sorting)
- `projects.api_key` (Unique B-tree, authentication)
- `users.email` (Unique B-tree, login)
- `project_integrations.(project_id, platform)` (Unique, configuration lookup)

---

## Performance Characteristics

### API Response Times (p95)

- Bug report creation: <200ms
- List reports (paginated): <100ms
- Screenshot upload (1MB): <500ms
- Session replay upload (500KB): <300ms

### Database Operations

- Single query: <10ms
- Batch insert (50 records): <500ms
- Pagination (100 records): <100ms

### Queue Processing

- Screenshot optimization: 1-3s per job
- Replay processing: 2-5s per job
- Queue insertion: <5ms
- Concurrent throughput: 2,500 jobs/s

### Memory Usage

- Backend: ~100MB baseline, ~150MB under load
- SDK: ~5MB runtime memory
- Streaming uploads: Constant 5MB (not linear with file size)

### Bundle Size & Load Time

- SDK bundle: ~99KB minified (rrweb included)
- SDK load time: <100ms
- Initial capture: <500ms

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
pnpm format:check     # Check formatting
```

### Git Workflow

**Branches**

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches (PR to `develop`)

**Commit Convention** (Conventional Commits)

```
feat: add session replay support
fix: remove await on synchronous function
refactor: implement strategy pattern for error handlers
docs: complete ticket integration section
```

---

## Project Structure

```
bugspotter/
├── .github/
│   ├── copilot-instructions.md  # AI assistant coding standards
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI/CD
├── packages/
│   ├── backend/                 # Fastify API (869 tests)
│   │   ├── src/
│   │   │   ├── api/             # Routes, middleware
│   │   │   ├── db/              # Repositories, migrations
│   │   │   ├── integrations/    # Plugin system, Jira
│   │   │   ├── queue/           # BullMQ jobs, workers
│   │   │   ├── retention/       # Data retention policies
│   │   │   ├── storage/         # S3/local storage
│   │   │   └── utils/           # Encryption, sanitization
│   │   └── tests/               # Unit + integration tests
│   ├── sdk/                     # Browser SDK (345 tests)
│   │   ├── src/
│   │   │   ├── capture/         # Screenshot, console, network
│   │   │   ├── core/            # BugSpotter class, transport
│   │   │   ├── session-replay/  # rrweb integration
│   │   │   ├── utils/           # Sanitizer, helpers
│   │   │   └── widget/          # Modal, button UI
│   │   └── tests/               # Unit + E2E + Playwright
│   ├── types/                   # Shared TypeScript types
│   └── backend-mock/            # Development mock server
├── apps/
│   └── demo/                    # Interactive demo application
├── README.md                    # Project overview
├── SYSTEM_SUMMARY.md           # This comprehensive document
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guidelines
└── pnpm-workspace.yaml         # Monorepo configuration
```

---

## Documentation Index

### Essential Documentation (Keep)

- **`/README.md`** - Project overview and quick start
- **`/SYSTEM_SUMMARY.md`** (this file) - Comprehensive system documentation
- **`/CONTRIBUTING.md`** - Contribution guidelines
- **`/CHANGELOG.md`** - Version history
- **`/.github/copilot-instructions.md`** - AI assistant coding standards

### Package Documentation

- **`/packages/backend/README.md`** - Backend API documentation
- **`/packages/backend/SECURITY.md`** - Security architecture
- **`/packages/backend/TESTING.md`** - Testing infrastructure
- **`/packages/sdk/README.md`** - SDK usage guide
- **`/packages/sdk/docs/SESSION_REPLAY.md`** - Session replay documentation

### Module Documentation

- **`/packages/backend/src/queue/README.md`** - Queue system
- **`/packages/backend/src/storage/README.md`** - Storage layer
- **`/packages/backend/src/retention/README.md`** - Retention policies
- **`/packages/backend/src/integrations/PLUGIN_SYSTEM.md`** - Plugin architecture
- **`/packages/backend/src/integrations/jira/README.md`** - Jira integration

---

## Roadmap

### Current Phase: Pre-Release (v0.3.0)

- ✅ Core features complete
- ✅ Jira integration
- ✅ Plugin architecture
- ✅ Comprehensive test coverage (1,547 tests)
- ✅ PII sanitization (10+ patterns)
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
- [ ] Framework integrations (React, Vue, Angular)

---

## Common Tasks

### Adding New Repository Method

1. Add method to specific repository class (extends `BaseRepository`)
2. Update `DatabaseClient` facade if needed
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

### Adding New Integration Plugin

1. Create plugin file in `src/integrations/{platform}/plugin.ts`
2. Implement `IntegrationService` interface
3. Define plugin metadata and factory function
4. Add lifecycle hooks if needed (onLoad, validate)
5. Register in plugin registry (auto-discovery)
6. Add integration tests

---

## Key Success Factors

### Why BugSpotter Works

**1. Comprehensive Context**

- Captures everything developers need: screenshot, replay, logs, network, metadata
- Eliminates "works on my machine" problems

**2. Security-First Design**

- PII sanitization by default (10+ patterns)
- Defense-in-depth for SQL injection, path traversal
- Enterprise-grade encryption (AES-256-GCM)
- OWASP best practices throughout

**3. Production-Ready Architecture**

- SOLID principles, design patterns, clean code
- Horizontal scalability (stateless API, connection pooling, queue distribution)
- Memory-efficient streaming (constant memory usage)
- Comprehensive error handling and retry logic

**4. Developer Experience**

- Zero manual test setup (Testcontainers)
- 1,547 automated tests (100% passing)
- Clear documentation and examples
- Conventional commits, semantic versioning
- AI assistant coding standards

**5. Extensibility**

- Plugin architecture for integrations
- Open/Closed Principle throughout
- Easy to add new storage backends, error types, retention strategies
- Generic integration API

---

## Support & Contact

- **Issues**: https://github.com/apexbridge-tech/bugspotter/issues
- **Discussions**: https://github.com/apexbridge-tech/bugspotter/discussions
- **Email**: support@apexbridge.tech
- **Documentation**: See Documentation Index above

---

**Copyright © 2025 ApexBridge Technologies**  
**License**: MIT

**End of System Summary** (1,998 words)
