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

#### Unit Tests (621 tests)

- ✅ Database connection, pooling, query builder
- ✅ CRUD operations for all entities
- ✅ Repository pattern (6 repositories)
- ✅ Storage layer (base, S3, local, helpers)
- ✅ Path utilities and sanitization
- ✅ Stream utilities and transformations
- ✅ Image processing
- ✅ Retry logic and error handling
- ✅ API routes and middleware
- ✅ Authentication and authorization

#### Integration Tests (104 tests)

- ✅ Full API endpoints with authentication
- ✅ Database transactions and concurrency
- ✅ User registration and login flows
- ✅ JWT token generation and refresh
- ✅ API key authentication
- ✅ Role-based access control
- ✅ Storage operations (local + S3)
- ✅ Cross-project access prevention

#### Load Tests (25 tests)

- ✅ 100+ concurrent operations
- ✅ Connection pool management
- ✅ Memory usage monitoring
- ✅ Batch operation performance
- ✅ Response time measurements
- ✅ Resource cleanup verification

**Total: 750 tests across 27 test files**

## Test Commands

### All Tests

```bash
# Run all tests (unit + integration + load + storage)
pnpm test

# Run specific test suites
pnpm test:unit              # Unit tests only (database layer, storage mocks)
pnpm test:integration       # Integration tests (API + DB + storage)
pnpm test:load              # Load/performance tests

# Watch modes
pnpm test:watch             # Watch unit tests
pnpm test:integration:watch # Watch integration tests

# Coverage
pnpm test:coverage          # Generate coverage report

# Storage-specific tests
pnpm vitest run tests/storage.test.ts                              # Storage unit tests
pnpm vitest run tests/integration/storage.integration.test.ts     # Storage integration tests
TEST_MINIO=true pnpm test:integration                              # Include MinIO tests
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

## Test Coverage Summary

### Overall Test Suite (457 tests)

| Category              | Tests   | Description                                   |
| --------------------- | ------- | --------------------------------------------- |
| **Unit Tests**        | **340** | Database, API, storage, utilities             |
| - Database            | 244     | CRUD, queries, transactions, pooling          |
| - API                 | 38      | Routes, middleware, validation                |
| - Storage             | 37      | Local/S3 uploads, image processing            |
| - Utilities           | 21      | Retry logic, path utils, stream utils         |
| **Integration Tests** | **104** | End-to-end workflows                          |
| - API + DB            | 79      | Full request/response cycles                  |
| - Storage             | 25      | Real backend operations                       |
| **Load Tests**        | **13**  | Performance, concurrency, resource management |

### Test Structure

```
tests/
├── db.test.ts                     # Database CRUD operations
├── repositories.test.ts           # Repository-specific methods
├── storage.test.ts                # Storage unit tests
├── api/                           # API unit tests
├── integration/                   # Integration tests
│   ├── api.integration.test.ts
│   ├── db.integration.test.ts
│   ├── auth.integration.test.ts
│   ├── storage.integration.test.ts
│   └── load.test.ts
└── utils/                         # Test utilities
```

### Test Configurations

- `vitest.config.ts` - Unit tests
- `vitest.integration.config.ts` - Integration tests
- `vitest.load.config.ts` - Load tests

### Adding New Tests

```typescript
describe('Your Feature', () => {
  it('should do something', async () => {
    const project = await db.projects.create({ name: 'Test', api_key: 'key' });
    const result = await db.someMethod(project.id);
    expect(result).toBeDefined();
  });
});
```

## Performance

- **Container Start**: ~5 seconds
- **Migration Run**: ~1 second
- **Test Execution**: ~350ms (repository tests), ~27s (all tests)
- **Container Stop**: ~1 second

Total test run: **~34 seconds** for all 398 tests including container lifecycle

## Test Data Cleanup

Test directories are automatically cleaned up after each test run. If cleanup fails or tests are interrupted, manually run:

```bash
pnpm test:cleanup
```

This removes all `test-uploads-*` and `test-e2e-uploads-*` directories.

## Best Practices

1. **Let Testcontainers Manage Lifecycle** - Don't manually start/stop containers
2. **Use Watch Mode During Development** - Faster feedback loop
3. **Run Full Suite Before Commit** - Ensure all tests pass
4. **Keep Tests Independent** - Each test should work in isolation
5. **Clean Up Test Data** - Run `pnpm test:cleanup` if tests are interrupted

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
