# @bugspotter/backend

Production-ready backend for BugSpotter with PostgreSQL database, REST API, and S3-compatible storage.

## Features

- 🗄️ **PostgreSQL Database** - Schema with migrations, connection pooling, ACID transactions
- 🔐 **Dual Authentication** - API keys (SDK) + JWT tokens (users)
- 💾 **S3 Storage** - Screenshots, attachments, replay chunks (S3/MinIO/LocalStack/Local)
- 🛡️ **Security** - CORS, Helmet, rate limiting, input validation, SQL injection protection
- 🔍 **Query & Filter** - Pagination, sorting, role-based access control
- 🏥 **Health Checks** - Liveness and readiness endpoints
- 🧪 **Testing** - 750 tests with Testcontainers (no manual setup required)

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

Available repositories: `ProjectRepository`, `BugReportRepository`, `UserRepository`, `SessionRepository`, `TicketRepository`, `ProjectMemberRepository`

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
    └── ... (6 repositories)
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
pnpm test:load              # Load/performance tests
```

**750 tests** total (27 test files):

- 621 unit tests (database, API, storage, utilities)
- 104 integration tests (API + DB + storage)
- 25 storage integration tests (local + S3)

Uses [Testcontainers](https://testcontainers.com/) - **no manual database setup required!**

See [TESTING.md](./TESTING.md) for comprehensive guide.

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
