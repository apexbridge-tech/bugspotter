# @bugspotter/backend

Self-hosted backend for BugSpotter with PostgreSQL database layer.

## Features

- 🗄️ **PostgreSQL Database Layer** - Full-featured database schema with migrations
- 🔐 **Authentication Support** - User management with OAuth and password-based auth
- 📊 **Bug Report Management** - CRUD operations for bug reports with filtering and pagination
- 🎬 **Session Replay Storage** - Store and retrieve session replay data
- 🔗 **Ticket Integration** - Track external ticket system integrations (Jira, Linear, etc.)
- 🔒 **Enterprise Features** - Audit logs and role-based permissions (optional)
- ♻️ **Connection Pooling** - Efficient database connection management with retry logic
- 🚀 **Migration System** - Database schema versioning and migrations

## Installation

```bash
pnpm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (production only)

Optional configuration:

- `DB_POOL_MIN` - Minimum connections in pool (default: 2)
- `DB_POOL_MAX` - Maximum connections in pool (default: 10)
- `DB_CONNECTION_TIMEOUT_MS` - Connection timeout (default: 30000)
- `DB_IDLE_TIMEOUT_MS` - Idle connection timeout (default: 30000)

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

## Usage

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

### Create a Bug Report

```typescript
const bugReport = await db.createBugReport({
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
const result = await db.listBugReports(
  // Filters
  {
    project_id: 'project-uuid',
    status: 'open',
    priority: 'high',
  },
  // Sorting
  {
    sort_by: 'created_at',
    order: 'desc',
  },
  // Pagination
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

### Update a Bug Report

```typescript
const updated = await db.updateBugReport(bugReportId, {
  status: 'in-progress',
  priority: 'critical',
});
```

### Project Management

```typescript
// Create project
const project = await db.createProject({
  name: 'My App',
  api_key: 'bs_live_abc123',
  settings: {
    allowedOrigins: ['https://myapp.com'],
    notificationEmail: 'bugs@myapp.com',
  },
});

// Get project by API key (for authentication)
const project = await db.getProjectByApiKey('bs_live_abc123');

// Update project settings
await db.updateProject(project.id, {
  settings: {
    ...project.settings,
    maxReportsPerDay: 1000,
  },
});
```

### Session Replay

```typescript
// Store session replay data
const session = await db.createSession(
  bugReportId,
  { events: [...rrwebEvents] },
  120000 // duration in ms
);

// Retrieve sessions for a bug report
const sessions = await db.getSessionsByBugReport(bugReportId);
```

### User Management

```typescript
// Create user with password
const user = await db.createUser({
  email: 'user@example.com',
  password_hash: await bcrypt.hash('password', 10),
  role: 'user',
});

// Create OAuth user
const oauthUser = await db.createUser({
  email: 'user@gmail.com',
  oauth_provider: 'google',
  oauth_id: 'google-user-id',
  role: 'user',
});

// Get user by email
const user = await db.getUserByEmail('user@example.com');

// Get user by OAuth
const user = await db.getUserByOAuth('google', 'google-user-id');
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

## Connection Pooling

The database client uses connection pooling for optimal performance:

- Automatic connection retry on transient failures
- Configurable pool size (min/max connections)
- Connection timeout and idle timeout settings
- Graceful connection cleanup

```typescript
// Close all connections when shutting down
await db.close();
```

## Error Handling

The client includes automatic retry logic for connection failures:

```typescript
try {
  const bugReport = await db.getBugReport(id);
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

Tests use [Testcontainers](https://testcontainers.com/) for automatic PostgreSQL container management:

```bash
pnpm test
```

That's all! No database setup required. See [TESTING.md](./TESTING.md) for details.

## Architecture

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
