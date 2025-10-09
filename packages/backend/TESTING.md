# Testing Guide

Comprehensive guide for running backend tests locally and in CI/CD.

## Quick Start

```bash
# Install dependencies (if not already done)
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

**That's it!** No database setup required. Testcontainers handles everything automatically.

## How It Works

The backend uses [Testcontainers](https://testcontainers.com/) to automatically manage PostgreSQL containers:

1. 🚀 **Start**: Launches a fresh PostgreSQL 16 container
2. 🔄 **Migrate**: Runs all database migrations
3. 🧪 **Test**: Executes all test suites
4. 🧹 **Cleanup**: Stops and removes the container

### Requirements

- **Docker**: Must be installed and running
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Ensure Docker daemon is running before running tests

### What Gets Tested

#### Unit Tests (220 tests)
- ✅ Database connection and pooling
- ✅ CRUD operations for all entities
- ✅ Query filtering and pagination
- ✅ JSON serialization/deserialization
- ✅ Foreign key relationships
- ✅ Unique constraints
- ✅ Error handling and retry logic
- ✅ API routes and middleware

#### Integration Tests (71 tests)
- ✅ Full API endpoints with authentication
- ✅ Database transactions and concurrency
- ✅ User registration and login flows
- ✅ JWT token generation and refresh
- ✅ API key authentication
- ✅ Role-based access control
- ✅ Rate limiting
- ✅ Cross-project access prevention

#### Load Tests (13 tests)
- ✅ 100+ concurrent operations
- ✅ Connection pool management
- ✅ Memory usage monitoring
- ✅ Batch operation performance
- ✅ Response time measurements
- ✅ Resource cleanup verification

**Total: 304 tests**

## Test Commands

### All Tests

```bash
# Run all tests (unit + integration + load)
pnpm test

# Run specific test suites
pnpm test:unit              # Unit tests only (database layer)
pnpm test:integration       # Integration tests (API + DB)
pnpm test:load              # Load/performance tests

# Watch modes
pnpm test:watch             # Watch unit tests
pnpm test:integration:watch # Watch integration tests

# Coverage
pnpm test:coverage          # Generate coverage report
```

### Specific Tests

```bash
# Run specific test file
pnpm vitest run tests/db.test.ts

# Run tests matching pattern
pnpm vitest run -t "Bug Reports"

# Run single integration test file
pnpm vitest run --config vitest.integration.config.ts tests/integration/auth.integration.test.ts
```

## CI/CD Integration

### GitHub Actions

Testcontainers works automatically in GitHub Actions:

```yaml
test-backend:
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 10.17.1

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - run: pnpm --filter @bugspotter/backend test
```

No PostgreSQL service configuration needed!

### Other CI Providers

Testcontainers works on any CI platform with Docker support:

- ✅ GitHub Actions
- ✅ GitLab CI
- ✅ CircleCI
- ✅ Jenkins
- ✅ Bitbucket Pipelines

Just ensure Docker is available in your CI environment.

## Development Workflow

### Running Tests During Development

Use watch mode for continuous feedback:

```bash
pnpm test:watch
```

Testcontainers will:

- Start a container when watch mode begins
- Keep it running during the session
- Rerun tests on file changes
- Clean up when you exit (Ctrl+C)

### Manual Database for Development

If you want a persistent database for manual testing or development:

```bash
# Start database
docker run --name bugspotter-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bugspotter \
  -p 5432:5432 \
  -d postgres:16

# Run migrations
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bugspotter"
pnpm migrate

# Connect with your preferred tool
psql $DATABASE_URL
```

This is separate from the test database - testcontainers won't interfere.

## Troubleshooting

### Docker Not Running

```
Error: Connect ENOENT /var/run/docker.sock
```

**Solution**: Start Docker Desktop or Docker daemon

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### Port Conflicts

Testcontainers automatically assigns random ports, so port conflicts are rare. If you have issues:

```bash
# Stop any manual containers
docker ps | grep postgres
docker stop <container-id>
```

### Slow First Run

The first test run downloads the PostgreSQL image (~100MB). Subsequent runs are fast (~5 seconds to start).

### Tests Timing Out

If tests timeout (>30s), check:

1. Docker has enough resources (4GB+ RAM recommended)
2. No other heavy processes running
3. Network connection is stable (for image pull)

### Container Cleanup

Testcontainers cleans up automatically, but if you see orphaned containers:

```bash
# List testcontainers
docker ps -a | grep testcontainers

# Remove all stopped containers
docker container prune
```

## Test Structure

```
tests/
├── setup.ts                       # Unit test setup
├── setup.integration.ts           # Integration test setup (Testcontainers)
├── setup.integration-env.ts       # Environment configuration
├── setup-file-polyfill.ts         # Node compatibility polyfill
│
├── db.test.ts                     # Database unit tests
├── query-builder.test.ts          # Query builder tests
│
├── api/                           # API unit tests
│   ├── auth.test.ts
│   ├── auth-middleware.test.ts
│   ├── projects.test.ts
│   ├── reports.test.ts
│   ├── health.test.ts
│   ├── error.test.ts
│   └── server.test.ts
│
├── integration/                   # Integration tests
│   ├── api.integration.test.ts    # Full API endpoint tests
│   ├── db.integration.test.ts     # Database integration tests
│   ├── auth.integration.test.ts   # Auth flow tests
│   └── load.test.ts               # Performance tests
│
└── utils/                         # Test utilities
    └── test-utils.ts              # Helper functions
```

### Test Configurations

- `vitest.config.ts` - Unit tests
- `vitest.integration.config.ts` - Integration tests
- `vitest.load.config.ts` - Load tests

### Adding New Tests

Add tests to `tests/db.test.ts`:

```typescript
describe('Your Feature', () => {
  it('should do something', async () => {
    // Arrange
    const project = await db.projects.create({
      name: 'Test Project',
      api_key: 'test-key',
    });

    // Act
    const result = await db.someMethod(project.id);

    // Assert
    expect(result).toBeDefined();
  });
});
```

The database is automatically available and migrated.

## Performance

- **Container Start**: ~5 seconds
- **Migration Run**: ~1 second
- **Test Execution**: ~380ms (24 tests)
- **Container Stop**: ~1 second

Total test run: **~8 seconds** including container lifecycle

## Best Practices

1. **Let Testcontainers Manage Lifecycle** - Don't manually start/stop containers
2. **Use Watch Mode During Development** - Faster feedback loop
3. **Run Full Suite Before Commit** - Ensure all tests pass
4. **Keep Tests Independent** - Each test should work in isolation
5. **Use Transactions for Cleanup** - (Future enhancement)

## Resources

- [Testcontainers Documentation](https://testcontainers.com/)
- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)

## Getting Help

If you encounter issues:

1. Check Docker is running: `docker ps`
2. Check logs: `docker logs <container-id>`
3. Review test output for specific errors
4. See [Troubleshooting](#troubleshooting) section above
