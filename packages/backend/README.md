# @bugspotter/backend

Production-ready backend for BugSpotter with PostgreSQL database, REST API, and S3-compatible storage.

## Features

- 🗄️ **PostgreSQL Database** - Schema with migrations, connection pooling, ACID transactions
- 🔐 **Dual Authentication** - API keys (SDK) + JWT tokens (users)
- 💾 **S3 Storage** - Screenshots, attachments, replay chunks (S3/MinIO/LocalStack/Local)
- 🛡️ **Security** - CORS, Helmet, rate limiting, input validation, SQL injection protection
- 🔍 **Query & Filter** - Pagination, sorting, role-based access control
- 🕐 **Data Retention** - Automated lifecycle management with compliance support (GDPR, CCPA, Kazakhstan)
- 🏥 **Health Checks** - Liveness and readiness endpoints
- 🧪 **Testing** - 869 tests with Testcontainers (no manual setup required)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Create a `.env` file in the backend package directory:

````bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/bugspotter
JWT_SECRET=your-secret-key-min-32-characters-long  # Generate: openssl rand -base64 32

# Storage Backend (choose one)
STORAGE_BACKEND=local  # Options: local, s3

# For local storage:
STORAGE_BASE_DIR=./data/uploads
STORAGE_BASE_URL=http://localhost:3000/uploads

# For S3 storage:
# S3_BUCKET=bugspotter
# S3_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret

# Optional - Server
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# Optional - Database Pool
DB_POOL_MIN=2
DB_POOL_MAX=10

# Optional - JWT
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

### 3. Set Up Database

```bash
createdb bugspotter
pnpm migrate
````

### 4. Start Server

```bash
# Development
pnpm dev

# Production
pnpm build && pnpm start
```

Server runs at `http://localhost:3000`

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Create project (returns API key)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"My App"}'
```

## API Reference

### Authentication

#### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Returns JWT tokens (access + refresh)

#### Login

```http
POST /api/v1/auth/login
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
```

### Projects

#### Create Project

```http
POST /api/v1/projects
Authorization: Bearer YOUR_JWT_TOKEN

{"name": "My App"}
```

Returns project with API key (`bgs_...`)

#### Get Project

```http
GET /api/v1/projects/:id
```

#### Regenerate API Key

```http
POST /api/v1/projects/:id/regenerate-key
```

Admin only

### Bug Reports

#### Create Report (SDK)

```http
POST /api/v1/reports
X-API-Key: bgs_your_api_key
Content-Type: application/json

{
  "title": "Button not working",
  "description": "Submit button doesn't respond",
  "report": {
    "consoleLogs": [...],
    "networkRequests": [...],
    "browserMetadata": {...},
    "sessionReplay": {...}
  }
}
```

#### List Reports

```http
GET /api/v1/reports?status=open&priority=high&page=1&limit=20
```

Query params: `status`, `priority`, `page`, `limit`, `sort_by`, `order`

#### Get/Update Report

```http
GET /api/v1/reports/:id
PATCH /api/v1/reports/:id
```

### Data Retention

#### Get Project Retention Settings

```http
GET /api/v1/projects/:id/retention
Authorization: Bearer YOUR_JWT_TOKEN
```

Returns retention policy for a project (requires project access)

#### Update Project Retention Settings

```http
PUT /api/v1/projects/:id/retention
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "bugReportRetentionDays": 90,
  "screenshotRetentionDays": 60,
  "replayRetentionDays": 30,
  "dataClassification": "general",
  "complianceRegion": "none"
}
```

Requires project owner or admin role. Admins can bypass tier limits.

**Tier Limits:**

- Free: 90 days max
- Professional: 365 days max
- Enterprise: 3650 days max

**Compliance Regions:**

- `none` - No regulatory requirements
- `eu` - GDPR (Europe)
- `us` - CCPA (California)
- `kz` - Kazakhstan data laws (5 years for financial)
- `uk` - UK GDPR
- `ca` - PIPEDA (Canada)

#### Admin - Get Global Retention Config

```http
GET /api/v1/admin/retention
Authorization: Bearer ADMIN_JWT_TOKEN
```

Returns global default retention configuration (admin only)

#### Admin - Update Global Retention Config

```http
PUT /api/v1/admin/retention
Authorization: Bearer ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "bugReportRetentionDays": 90
}
```

**Status**: ⚠️ NOT IMPLEMENTED - Returns HTTP 501  
Global retention policies are managed via environment variables. Use project-specific retention settings instead. Requires database persistence layer (system_config table) for full implementation.

#### Admin - Preview Retention Policy

```http
POST /api/v1/admin/retention/preview?projectId=PROJECT_UUID
Authorization: Bearer ADMIN_JWT_TOKEN
```

Dry-run to see what would be deleted. Returns report counts and storage estimates.

#### Admin - Apply Retention Policies

```http
POST /api/v1/admin/retention/apply
Authorization: Bearer ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "dryRun": false,
  "confirm": true,
  "batchSize": 100,
  "maxErrorRate": 5
}
```

Executes retention policy deletion. Requires `confirm: true` for production deletions.

#### Admin - Get Scheduler Status

```http
GET /api/v1/admin/retention/status
Authorization: Bearer ADMIN_JWT_TOKEN
```

Returns retention scheduler status (enabled, next run time)

#### Admin - Legal Hold (Apply/Remove)

```http
POST /api/v1/admin/retention/legal-hold
Authorization: Bearer ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "reportIds": ["uuid-1", "uuid-2"],
  "hold": true  // true to apply, false to remove
}
```

Apply or remove legal hold protection on bug reports. Reports with legal hold cannot be deleted by retention policies (admin only).

#### Admin - Restore Soft-Deleted Reports

```http
POST /api/v1/admin/retention/restore
Authorization: Bearer ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "reportIds": ["uuid-1", "uuid-2"]
}
```

Restore soft-deleted reports (admin only).  
**Note**: Only restores reports still in `bug_reports` table. Archived reports (moved to `archived_bug_reports`) cannot be restored.

### Health Checks

```http
GET /health   # Liveness
GET /ready    # Readiness (includes DB)
```

## Database Usage

### Basic Operations

```typescript
import { createDatabaseClient } from '@bugspotter/backend';

const db = createDatabaseClient();

// Create bug report
const bug = await db.bugReports.create({
  project_id: 'project-uuid',
  title: 'Critical issue',
  priority: 'high',
});

// Query with filters
const result = await db.bugReports.list(
  { status: 'open', priority: 'high' },
  { sort_by: 'created_at', order: 'desc' },
  { page: 1, limit: 20 }
);

// Transactions
await db.transaction(async (tx) => {
  const bug = await tx.bugReports.create({...});
  const session = await tx.sessions.createSession(bug.id, {...});
  return { bug, session };
});
```

### Repository Pattern

```typescript
import { ProjectRepository } from '@bugspotter/backend';

const projectRepo = new ProjectRepository(pool);
const project = await projectRepo.findByApiKey('bgs_...');
```

Available repositories: `ProjectRepository`, `BugReportRepository`, `UserRepository`, `SessionRepository`, `TicketRepository`, `ProjectMemberRepository`, `RetentionRepository`

## Storage Layer

### Configuration

```typescript
import { createStorage } from '@bugspotter/backend';

// Local filesystem
const storage = createStorage({
  backend: 'local',
  local: {
    baseDirectory: './data/uploads',
    baseUrl: 'http://localhost:3000/uploads',
  },
});

// S3-compatible
const storage = createStorage({
  backend: 's3',
  s3: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: 'bugspotter',
  },
});

// Or use environment variables
const storage = createStorageFromEnv();
```

### Operations

```typescript
// Upload screenshot
const result = await storage.uploadScreenshot(projectId, bugId, buffer, 'image/png');

// Upload attachment
const result = await storage.uploadAttachment(projectId, bugId, buffer, 'report.pdf');

// Upload replay chunks
await storage.uploadReplayMetadata(projectId, bugId, metadata);
await storage.uploadReplayChunks(projectId, bugId, chunks);
```

## Architecture

### Authentication Flow

- **API Keys** (`X-API-Key`) - SDK requests, project-scoped, never expire
- **JWT Tokens** (`Authorization: Bearer`) - User requests, 1h access + 7d refresh

Mark routes as public:

```typescript
fastify.get('/public', { config: { public: true } }, handler);
```

### Error Handling

Uses **Strategy Pattern** for error types:

```typescript
const errorHandlers = [
  { matcher: isValidationError, processor: processValidationError },
  { matcher: isDatabaseError, processor: processDatabaseError },
  // Add new handlers without modifying existing code
];
```

### Repository Pattern

```
DatabaseClient (Facade)
    ├── ProjectRepository
    ├── BugReportRepository
    ├── RetentionRepository
    └── ... (7 repositories total)
         └── BaseRepository (shared logic)
```

Benefits: Testability, dependency injection, single responsibility

### Retry Logic

Automatic retry for read operations only:

```typescript
// ✅ Auto-retried on connection failure
await db.bugReports.findById(id);

// ❌ Not retried (prevents duplicates)
await db.bugReports.create(data);
```

### Data Retention Services

Automated data lifecycle management with compliance support:

```typescript
import { RetentionService, RetentionScheduler } from '@bugspotter/backend';

// Initialize services
const retentionService = new RetentionService(db, storage);
const scheduler = new RetentionScheduler(retentionService, notificationService);

// Preview what would be deleted
const preview = await retentionService.previewRetentionPolicy();
// { totalReports: 150, affectedProjects: [...], totalStorageBytes: 52428800 }

// Apply retention policies
const result = await retentionService.applyRetentionPolicies({
  dryRun: false,
  batchSize: 100,
  maxErrorRate: 5,
});
// { totalDeleted: 150, storageFreed: 52428800, projectsProcessed: 5 }

// Start automated daily cleanup (runs at 2 AM)
await scheduler.start();
```

**Features:**

- Tier-based retention limits (Free: 90d, Pro: 365d, Enterprise: 3650d)
- Compliance region support (GDPR, CCPA, Kazakhstan, UK, Canada)
- Data classification (general, financial, healthcare, PII, sensitive, government)
- Archive-before-delete option
- Legal hold protection
- Batch processing with error handling
- Notification on completion (logger/email/Slack)

## Testing

```bash
# Run all tests (Docker required)
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Specific test suites
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests
pnpm test:queue             # Queue integration tests
pnpm test:load              # Load/performance tests
```

**150+ tests** across 6 comprehensive test suites:

- Unit tests (database, API, storage, queue, retention, utilities)
- Integration tests (API + DB + storage)
- Queue integration tests (22 tests - BullMQ with real Redis)
- Load tests (performance, concurrency, memory)
- E2E scenarios (complete workflows)

Uses [Testcontainers](https://testcontainers.com/) - **no manual database setup required!**

**Documentation:**

- [TESTING.md](./TESTING.md) - Testing guide and best practices
- [E2E_TEST_SCENARIOS.md](./E2E_TEST_SCENARIOS.md) - Complete test scenario documentation

## Security

### SQL Injection Protection

- ✅ Parameterized queries (`$1`, `$2` placeholders)
- ✅ Identifier validation (`^[a-zA-Z0-9_]+$`)
- ✅ Pagination limits (1-1000)
- ✅ Batch size limits (max 1000)

### Content Security Policy

Helmet with strict CSP:

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'"],  // NO 'unsafe-inline'
    imgSrc: ["'self'", 'data:'],  // NO 'https:'
  }
}
```

See [SECURITY.md](./SECURITY.md) for details.

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

## License

MIT
