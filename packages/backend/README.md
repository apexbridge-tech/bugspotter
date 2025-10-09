# @bugspotter/backend

Production-ready backend for BugSpotter with PostgreSQL database and REST API.

## Features

### Database Layer

- 🗄️ **PostgreSQL Database** - Full-featured schema with migrations
- ♻️ **Connection Pooling** - Efficient connection management with retry logic
- 🔄 **Transactions** - ACID-compliant operations with automatic rollback
- 📊 **Repository Pattern** - Clean architecture with dependency injection support
- 🚀 **Migration System** - Version-controlled schema evolution

### REST API

- 🔐 **Dual Authentication** - API keys (SDK) + JWT tokens (users)
- 🛡️ **Security** - CORS, Helmet, rate limiting, input validation
- 📝 **Session Replay** - Store and retrieve user session recordings
- 🎯 **Role-Based Access** - Admin, user, and viewer permissions
- 🔗 **Ticket Integration** - Track external tickets (Jira, Linear, etc.)
- � **Filtering & Pagination** - Efficient data querying
- 🏥 **Health Checks** - Liveness and readiness endpoints

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/bugspotter
JWT_SECRET=your-secret-key-min-32-characters-long  # Generate: openssl rand -base64 32

# Optional - Server
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Optional - Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=30000
DB_IDLE_TIMEOUT_MS=30000
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY_MS=1000

# Optional - JWT
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Optional - Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000

# Optional - File Uploads
MAX_FILE_SIZE=10485760
```

### 3. Set Up Database

```bash
# Create database
createdb bugspotter

# Run migrations
pnpm migrate
```

### 4. Start the Server

```bash
# Development mode with hot reload
pnpm dev

# Production mode
pnpm build && pnpm start
```

The API will be available at `http://localhost:3000`

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register a user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Create a project (returns API key)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"My App"}'
```

## Database Setup

### Prerequisites

- PostgreSQL 12 or higher
- Database created and accessible

### Running Migrations

Apply all pending migrations:

```bash
pnpm migrate
```

This will:

1. Create the `migrations_history` table if it doesn't exist
2. Apply all pending SQL migrations in order
3. Track applied migrations to prevent re-application

### Database Schema

The schema includes the following tables:

#### Core Tables

- **projects** - Project configurations and API keys
- **users** - User accounts with password and OAuth support
- **bug_reports** - Main bug report data with metadata
- **sessions** - Session replay event data
- **tickets** - External ticket system integrations

#### Enterprise Tables (Optional)

- **audit_logs** - Audit trail for all actions
- **permissions** - Role-based access control

#### System Tables

- **migrations_history** - Tracks applied database migrations

### Indexes

Optimized indexes for common queries:

- `bug_reports(project_id, created_at)` - List reports by project
- `bug_reports(status)` - Filter by status
- `bug_reports(priority)` - Filter by priority
- `projects(api_key)` - API key authentication
- `tickets(external_id)` - External ticket lookups

## API Reference

### Authentication

#### Register User

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Returns JWT tokens (access + refresh)

#### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Projects

#### Create Project

```bash
POST /api/v1/projects
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "My App",
  "settings": {
    "allowedOrigins": ["https://myapp.com"]
  }
}
```

Returns project with generated API key (`bgs_...`)

#### Get Project

```bash
GET /api/v1/projects/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Regenerate API Key

```bash
POST /api/v1/projects/:id/regenerate-key
Authorization: Bearer YOUR_JWT_TOKEN
```

Admin only

### Bug Reports

#### Create Report (SDK)

```bash
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

```bash
GET /api/v1/reports?status=open&priority=high&page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

Query parameters:
- `status` - open, in-progress, resolved, closed
- `priority` - low, medium, high, critical
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `sort_by` - created_at, updated_at, priority
- `order` - asc, desc

#### Get Single Report

```bash
GET /api/v1/reports/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Update Report

```bash
PATCH /api/v1/reports/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "status": "in-progress",
  "priority": "critical"
}
```

### Health Checks

```bash
GET /health           # Liveness check
GET /ready            # Readiness check (includes DB)
```

## Database Usage

### Initialize Database Client

```typescript
import { createDatabaseClient, validateConfig } from '@bugspotter/backend';

// Validate configuration
validateConfig();

// Create client instance
const db = createDatabaseClient();

// Test connection
const isConnected = await db.testConnection();
console.log('Database connected:', isConnected);
```

### Custom Logger (Optional)

The backend uses a simple console-based logger by default. You can replace it with your own logger (pino, winston, etc.):

```typescript
import { setLogger } from '@bugspotter/backend';
import pino from 'pino';

// Use pino for structured logging
setLogger(pino());

// Or winston
import winston from 'winston';
setLogger(
  winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  })
);

// Or your custom logger (must implement Logger interface)
setLogger({
  debug: (msg, meta) => {
    /* your implementation */
  },
  info: (msg, meta) => {
    /* your implementation */
  },
  warn: (msg, meta) => {
    /* your implementation */
  },
  error: (msg, meta) => {
    /* your implementation */
  },
});
```

The logger is used for:

- Database connection errors and retries
- Pool errors and warnings
- Migration status (if you implement it)
- Any operational events

### Create a Bug Report

```typescript
// Recommended: Direct repository access
const bugReport = await db.bugReports.create({
  project_id: 'project-uuid',
  title: 'Button click not working',
  description: 'The submit button does not respond to clicks',
  priority: 'high',
  status: 'open',
  metadata: {
    browser: 'Chrome 120',
    os: 'macOS 14',
    url: 'https://example.com/form',
  },
});

console.log('Created bug report:', bugReport.id);
```

### Query Bug Reports

```typescript
// List bug reports with filters and pagination
const result = await db.bugReports.list(
  {
    project_id: 'project-uuid',
    status: 'open',
    priority: 'high',
  },
  {
    sort_by: 'created_at',
    order: 'desc',
  },
  {
    page: 1,
    limit: 20,
  }
);

console.log(`Found ${result.pagination.total} bug reports`);
result.data.forEach((bug) => {
  console.log(`- ${bug.title} (${bug.status})`);
});
```

### Transactions

Execute multiple operations atomically with automatic rollback on error:

```typescript
// Create bug report with session in a single transaction
const result = await db.transaction(async (tx) => {
  const bug = await tx.bugReports.create({
    project_id: 'project-uuid',
    title: 'Critical issue',
    priority: 'critical',
  });

  const session = await tx.sessions.createSession(bug.id, {
    events: [...rrwebEvents],
  });

  const ticket = await tx.tickets.createTicket(bug.id, 'JIRA-123', 'jira');

  return { bug, session, ticket };
});

// All operations committed, or all rolled back on error
console.log('Bug report created:', result.bug.id);
```

### Batch Operations

Create multiple records efficiently:

```typescript
// Create up to 1000 bug reports in a single query (fastest)
const bugs = await db.bugReports.createBatch([
  {
    project_id: 'project-uuid',
    title: 'Bug 1',
    priority: 'high',
  },
  {
    project_id: 'project-uuid',
    title: 'Bug 2',
    priority: 'medium',
  },
  {
    project_id: 'project-uuid',
    title: 'Bug 3',
    priority: 'low',
  },
]);

console.log(`Created ${bugs.length} bug reports`);

// For larger arrays, use createBatchAuto (automatically splits into chunks)
const hugeArray = [...]; // 5000+ items
const allBugs = await db.bugReports.createBatchAuto(hugeArray, 500); // 500 per batch
console.log(`Created ${allBugs.length} bug reports in batches`);
```

### Update a Bug Report

```typescript
const updated = await db.bugReports.update(bugReportId, {
  status: 'in-progress',
  priority: 'critical',
});
```

### Project Management

```typescript
// Create project
const project = await db.projects.create({
  name: 'My App',
  api_key: 'bs_live_abc123',
  settings: {
    allowedOrigins: ['https://myapp.com'],
    notificationEmail: 'bugs@myapp.com',
  },
});

// Get project by API key (for authentication)
const project = await db.projects.findByApiKey('bs_live_abc123');

// Update project settings
await db.projects.update(project.id, {
  settings: {
    ...project.settings,
    maxReportsPerDay: 1000,
  },
});
```

### Session Replay

```typescript
// Store session replay data
const session = await db.sessions.createSession(
  bugReportId,
  { events: [...rrwebEvents] },
  120000 // duration in ms
);

// Retrieve sessions for a bug report
const sessions = await db.sessions.findByBugReport(bugReportId);
```

### User Management

```typescript
// Create user with password
const user = await db.users.create({
  email: 'user@example.com',
  password_hash: await bcrypt.hash('password', 10),
  role: 'user',
});

// Create OAuth user
const oauthUser = await db.users.create({
  email: 'user@gmail.com',
  oauth_provider: 'google',
  oauth_id: 'google-user-id',
  role: 'user',
});

// Get user by email
const user = await db.users.findByEmail('user@example.com');

// Get user by OAuth
const user = await db.users.findByOAuth('google', 'google-user-id');
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  BugReport,
  Project,
  User,
  Session,
  Ticket,
  BugReportFilters,
  BugReportSortOptions,
  PaginatedResult,
} from '@bugspotter/backend';
```

## Connection Pooling & Retry Logic

The database client uses connection pooling for optimal performance:

- Automatic connection retry on transient failures
- Configurable pool size (min/max connections)
- Connection timeout and idle timeout settings
- Graceful connection cleanup

### Automatic Retry for Read Operations

**Read operations** are automatically retried on connection failures (exponential backoff):

```typescript
// ✅ Automatically retried on connection failure
await db.bugReports.findById(id);
await db.bugReports.list(filters);
await db.projects.findByApiKey(apiKey);
```

**Write operations** are NOT automatically retried to prevent data corruption:

```typescript
// ❌ NOT automatically retried (could cause duplicates)
await db.bugReports.create(data);
await db.bugReports.update(id, data);
await db.bugReports.delete(id);
await db.bugReports.createBatch(dataArray);

// If you need retry for writes, implement with idempotency:
import { executeWithRetry } from '@bugspotter/backend';

// Manual retry with idempotency key
await executeWithRetry(async () => {
  return await db.bugReports.create({
    ...data,
    idempotency_key: uniqueKey, // Prevent duplicates
  });
});
```

```typescript
// Close all connections when shutting down
await db.close();
```

## Error Handling

The client includes automatic retry logic for connection failures:

```typescript
try {
  const bugReport = await db.bugReports.findById(id);
  if (!bugReport) {
    console.log('Bug report not found');
  }
} catch (error) {
  console.error('Database error:', error);
}
```

## Development

```bash
# Run in development mode with auto-reload
pnpm dev

# Build TypeScript
pnpm build

# Run tests (uses Testcontainers - Docker required)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Testing

Tests use [Testcontainers](https://testcontainers.com/) for automatic PostgreSQL container management. Docker must be installed and running.

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
```

See [TESTING.md](./TESTING.md) for comprehensive testing documentation, troubleshooting, and CI/CD integration.

## Architecture

### Repository Pattern

The backend uses the **Repository Pattern** for clean separation of concerns and improved testability:

#### Architecture Overview

```
DatabaseClient (Facade)
    ├── ProjectRepository
    ├── BugReportRepository
    ├── UserRepository
    ├── SessionRepository
    └── TicketRepository
         └── BaseRepository (abstract)
```

#### Using DatabaseClient

The `DatabaseClient` provides convenient access to all repositories:

```typescript
import { createDatabaseClient } from '@bugspotter/backend';

const db = createDatabaseClient();

// Access repositories through the client
const project = await db.projects.create({ name: 'My App', api_key: 'key' });
const bug = await db.bugReports.create({ project_id: project.id, title: 'Bug' });
```

#### Using Repositories Directly

For dependency injection or testing, use repositories directly:

```typescript
import { ProjectRepository, BugReportRepository } from '@bugspotter/backend';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const projectRepo = new ProjectRepository(pool);
const bugReportRepo = new BugReportRepository(pool);

// Direct repository access
const project = await projectRepo.create({ name: 'My App', api_key: 'key' });
const project = await projectRepo.findByApiKey('key');

// Advanced repository methods
const results = await bugReportRepo.list(
  { status: 'open', priority: 'high' },
  { sort_by: 'created_at', order: 'desc' },
  { page: 1, limit: 20 }
);
```

#### Available Repositories

- **ProjectRepository** - `create`, `findById`, `findByApiKey`, `update`, `delete`
- **BugReportRepository** - `create`, `findById`, `update`, `delete`, `list`, `createBatch`
- **UserRepository** - `create`, `findById`, `findByEmail`, `findByOAuth`, `update`, `delete`
- **SessionRepository** - `createSession`, `findById`, `findByBugReport`, `delete`
- **TicketRepository** - `createTicket`, `findById`, `findByBugReport`, `delete`

#### Benefits

- ✅ **Single Responsibility** - Each repository handles one entity type
- ✅ **Testability** - Easy to mock repositories in unit tests
- ✅ **Dependency Injection** - Inject repositories into services
- ✅ **Reusability** - Share common CRUD logic in `BaseRepository`
- ✅ **Clean API** - Direct repository access with automatic retry logic

See [examples/repository-usage.ts](./examples/repository-usage.ts) for a complete example.

### Connection Management

- Uses `pg` package with connection pooling
- Automatic retry on connection failures (3 attempts with exponential backoff)
- Pool error handling to prevent crashes

### JSON Serialization

- Automatic serialization/deserialization of JSONB fields
- Type-safe metadata and settings objects
- Preserves nested object structures

### Query Building

- Dynamic query building for flexible filtering
- Parameterized queries to prevent SQL injection
- Efficient pagination with total count

## License

MIT
