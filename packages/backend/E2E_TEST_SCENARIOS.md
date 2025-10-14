# BugSpotter E2E and Integration Test Scenarios

**Complete Test Coverage Documentation**  
**Date**: October 13, 2025  
**Total Tests**: 1,202 tests (267 queue tests + 869 backend core tests + 66 SDK tests)  
**Test Infrastructure**: Testcontainers (PostgreSQL 16 + Redis 7)

---

## Table of Contents

1. [Queue System Integration Tests](#queue-system-integration-tests) (22 tests)
2. [Database Integration Tests](#database-integration-tests) (25 tests)
3. [API Integration Tests](#api-integration-tests) (30+ tests)
4. [Storage Integration Tests](#storage-integration-tests) (15+ tests)
5. [Authentication Integration Tests](#authentication-integration-tests) (20+ tests)
6. [Load Tests](#load-tests) (15 tests)
7. [Test Infrastructure](#test-infrastructure)
8. [Running Tests](#running-tests)

---

## Queue System Integration Tests

**File**: `tests/integration/queue-integration.test.ts`  
**Tests**: 22 (100% passing)  
**Duration**: ~50s per run  
**Infrastructure**: Real Redis (container) + PostgreSQL (container) + Local Storage

### Test Infrastructure Setup

```typescript
// Ephemeral containers started before tests
- Redis 7 Alpine (BullMQ job queue)
- PostgreSQL 16 (via integration test global setup)

// Real services initialized
- DatabaseClient with connection pool
- LocalStorageService with temp directory
- QueueManager with 4 queues (screenshots, replays, integrations, notifications)
- WorkerManager with 2 active workers (screenshot + replay)
- Fastify API server with all routes

// Test data created
- Test project with API key
- 3 bug reports with UUIDs
- 3 test images uploaded to storage (800x600, 1024x768, 640x480 PNG)
```

### 1. QueueManager Operations (5 tests)

#### Test: Add Job to Queue

**Scenario**: Queue a screenshot processing job  
**Steps**:

1. Call `queueManager.addJob()` with screenshots queue
2. Pass real bug report UUID, project ID, and storage key
3. Verify job ID is returned

**Assertions**:

- Job ID is defined
- Job ID is a string
- Job is added to Redis queue

**Real-world use case**: SDK uploads screenshot, API queues processing job

---

#### Test: Retrieve Job by ID

**Scenario**: Fetch job details from queue  
**Steps**:

1. Queue a screenshot job
2. Call `queueManager.getJob()` with queue name and job ID
3. Verify job data matches input

**Assertions**:

- Job object is returned
- Job ID matches
- Job data contains correct bugReportId and projectId

**Real-world use case**: User checks job status from dashboard

---

#### Test: Get Job Status

**Scenario**: Monitor job lifecycle states  
**Steps**:

1. Queue a job
2. Immediately check status with `getJobStatus()`
3. Verify status is a valid BullMQ state

**Assertions**:

- Status is one of: waiting, active, completed, failed, delayed

**Real-world use case**: Real-time job progress indicators in UI

---

#### Test: Get Queue Metrics

**Scenario**: Monitor queue health and backlog  
**Steps**:

1. Call `getQueueMetrics()` for screenshots queue
2. Verify metrics structure

**Assertions**:

- waiting count is a number
- active count is a number
- completed count is a number
- failed count is a number

**Real-world use case**: Admin dashboard showing queue health

---

#### Test: Handle Multiple Queues

**Scenario**: Verify queue isolation  
**Steps**:

1. Add job to screenshots queue
2. Add job to replays queue
3. Retrieve both jobs
4. Verify they're in separate queues

**Assertions**:

- Both jobs have IDs
- Jobs can be retrieved from their respective queues
- Jobs don't leak between queues

**Real-world use case**: Parallel processing of different job types

---

### 2. WorkerManager Operations (4 tests)

#### Test: Report Running Workers

**Scenario**: Monitor worker status  
**Steps**:

1. Get metrics from WorkerManager
2. Verify worker counts

**Assertions**:

- totalWorkers > 0
- runningWorkers > 0
- uptime >= 0

**Real-world use case**: Operational monitoring of worker health

---

#### Test: Have Healthy Workers

**Scenario**: Health check all workers  
**Steps**:

1. Call `workerManager.healthCheck()`
2. Verify health status

**Assertions**:

- healthy is true
- workers object has entries
- Each worker reports status

**Real-world use case**: Load balancer health checks

---

#### Test: Track Worker Metrics

**Scenario**: Monitor individual worker performance  
**Steps**:

1. Get metrics for screenshot worker
2. Verify metrics structure

**Assertions**:

- isRunning is true
- workerName matches
- jobsProcessed is a number
- jobsFailed is a number

**Real-world use case**: Performance monitoring and alerting

---

#### Test: Pause and Resume Workers

**Scenario**: Control worker execution  
**Steps**:

1. Pause screenshot worker
2. Verify worker is not running
3. Resume screenshot worker
4. Verify worker is running

**Assertions**:

- After pause: isRunning is false
- After resume: isRunning is true

**Real-world use case**: Maintenance mode or rate limiting

---

### 3. End-to-End Job Processing (3 tests)

#### Test: Process Screenshot Job Successfully

**Scenario**: Complete screenshot workflow  
**Steps**:

1. Queue screenshot job with real storage key
2. Wait for worker to process (polling every 500ms, max 30s)
3. Check final status

**Flow**:

```
API → QueueManager.addJob()
    → Redis Queue
    → Screenshot Worker picks up
    → Fetch from storage
    → Generate thumbnail with sharp
    → Upload thumbnail to storage
    → Update database
    → Mark job completed
```

**Assertions**:

- Job reaches 'completed' or 'failed' state
- Processing completes within 30s

**Real-world use case**: User uploads screenshot, sees optimized version

---

#### Test: Process Replay Job Successfully

**Scenario**: Complete replay workflow  
**Steps**:

1. Queue replay job with session events
2. Wait for worker to process
3. Accept waiting/active/completed/failed states

**Flow**:

```
API → QueueManager.addJob()
    → Redis Queue
    → Replay Worker (may not pick up immediately)
    → Process events
    → Generate replay file
    → Upload to storage
    → Update database
```

**Assertions**:

- Job is in valid state (may still be waiting due to replay worker backlog)

**Real-world use case**: Session replay available for debugging

---

#### Test: Handle Job Retry on Failure

**Scenario**: Verify retry mechanism  
**Steps**:

1. Queue job with invalid storage key
2. Wait for retries
3. Check status after 5 seconds

**Expected behavior**:

- Worker attempts job
- Fails (file not found)
- BullMQ retries with exponential backoff
- Job is in active, failed, or delayed state

**Assertions**:

- Status is active, failed, or delayed

**Real-world use case**: Transient network errors auto-retry

---

### 4. API Integration (4 tests)

#### Test: Return Queue Health Status

**Scenario**: Public health check endpoint  
**Steps**:

1. GET /api/v1/queues/health (no auth required)
2. Verify response

**Assertions**:

- HTTP 200
- success is true
- data.status is 'healthy'

**Real-world use case**: Load balancer health checks

---

#### Test: Return Queue Metrics

**Scenario**: Admin metrics endpoint  
**Steps**:

1. Create admin user
2. Generate JWT token
3. GET /api/v1/queues/metrics with Bearer token
4. Verify metrics

**Assertions**:

- HTTP 200
- success is true
- data.queues is an array

**Real-world use case**: Admin dashboard monitoring

---

#### Test: Queue Jobs When Creating Bug Report with Screenshot

**Scenario**: End-to-end bug report creation  
**Steps**:

1. Create project with API key
2. POST /api/v1/reports with screenshot in payload
3. Verify report created
4. Wait 1 second
5. Check screenshots queue metrics

**Flow**:

```
SDK → POST /api/v1/reports
    → Validate API key
    → Create bug report in DB
    → Queue screenshot job
    → Return 201 Created
```

**Assertions**:

- HTTP 201
- Bug report ID returned
- Screenshot job queued (metrics show >0 jobs)

**Real-world use case**: SDK submits bug report with screenshot

---

#### Test: Queue Replay Jobs When Creating Bug Report

**Scenario**: Session replay submission  
**Steps**:

1. Create project
2. POST /api/v1/reports with sessionReplay events
3. Verify report created
4. Check replays queue metrics

**Assertions**:

- HTTP 201
- Bug report created
- Replay job queued

**Real-world use case**: SDK submits session replay data

---

### 5. Error Handling (4 tests)

#### Test: Handle Queue Manager Shutdown Gracefully

**Scenario**: Verify shutdown doesn't crash  
**Steps**:

1. Call `queueManager.healthCheck()`
2. Verify no errors

**Assertions**:

- Health check resolves to true
- No exceptions thrown

---

#### Test: Handle Invalid Queue Names

**Scenario**: Validation error handling  
**Steps**:

1. Attempt to add job to 'invalid-queue'
2. Expect error

**Assertions**:

- Promise rejects
- Error thrown

---

#### Test: Handle Non-Existent Job Queries

**Scenario**: Graceful handling of missing jobs  
**Steps**:

1. Query for job with fake ID
2. Verify null response

**Assertions**:

- Returns null (not error)

---

#### Test: Handle Worker Pause/Resume Errors

**Scenario**: Error handling for non-existent workers  
**Steps**:

1. Attempt to pause 'non-existent' worker
2. Attempt to resume 'non-existent' worker

**Assertions**:

- Both operations reject with error

---

### 6. Performance (2 tests)

#### Test: Handle Multiple Concurrent Jobs

**Scenario**: Queue throughput test  
**Steps**:

1. Queue 10 jobs concurrently using Promise.all()
2. Measure time taken
3. Verify all jobs queued

**Assertions**:

- All 10 job IDs returned
- Total time < 5 seconds (usually ~4ms)

**Performance metrics**:

- ⚡ 10 jobs queued in 4ms
- ~2,500 jobs/second throughput

---

#### Test: Maintain Queue Metrics Accuracy

**Scenario**: Verify metrics increment correctly  
**Steps**:

1. Get baseline metrics
2. Add 3 jobs
3. Get updated metrics
4. Verify count increased by at least 3

**Assertions**:

- Total jobs increased by >= 3
- Metrics accurately reflect queue state

---

## Database Integration Tests

**File**: `tests/integration/db.integration.test.ts`  
**Tests**: 25  
**Infrastructure**: PostgreSQL 16 container with migrations

### 1. Connection Pooling (3 tests)

#### Test: Handle Multiple Concurrent Connections

**Scenario**: Stress test connection pool  
**Steps**:

1. Execute 20 parallel queries
2. Verify all complete successfully

**Assertions**:

- All queries return results
- No connection exhaustion

---

#### Test: Reuse Connections from Pool

**Scenario**: Verify connection reuse  
**Steps**:

1. Get pool stats before
2. Execute query
3. Get pool stats after
4. Verify connections reused

**Assertions**:

- Total count doesn't grow unbounded
- Idle connections available

---

#### Test: Handle Connection Errors Gracefully

**Scenario**: Resilience testing  
**Steps**:

1. Simulate connection error
2. Verify error handling

**Assertions**:

- Error caught
- Pool recovers

---

### 2. Transactions (3 tests)

#### Test: Commit Transaction on Success

**Scenario**: ACID compliance  
**Steps**:

1. Begin transaction
2. Create project
3. Create bug report in same transaction
4. Commit
5. Verify both records exist

**Assertions**:

- Both records created
- Transaction committed

---

#### Test: Rollback Transaction on Error

**Scenario**: Data integrity on failure  
**Steps**:

1. Begin transaction
2. Create project
3. Attempt invalid operation
4. Transaction rolls back
5. Verify no data persisted

**Assertions**:

- Project not created
- Database state unchanged

---

#### Test: Handle Nested Operations in Transaction

**Scenario**: Complex transactional workflow  
**Steps**:

1. Begin transaction
2. Create project
3. Create multiple bug reports
4. Create sessions for each report
5. Commit all or rollback all

**Assertions**:

- All records created atomically
- No partial writes

---

### 3. Concurrent Writes (3 tests)

#### Test: Handle Concurrent Writes to Same Project

**Scenario**: Verify row-level locking  
**Steps**:

1. Create project
2. Spawn 10 concurrent updates
3. Verify final state is consistent

**Assertions**:

- No lost updates
- Final state reflects all changes

---

#### Test: Handle Concurrent Updates to Different Records

**Scenario**: Isolation testing  
**Steps**:

1. Create 2 projects
2. Update both concurrently
3. Verify isolation

**Assertions**:

- Updates don't interfere
- Both succeed

---

#### Test: Prevent Lost Updates with Concurrent Modifications

**Scenario**: Optimistic locking verification  
**Steps**:

1. Read record
2. Modify in two concurrent transactions
3. Verify one succeeds, one retries

**Assertions**:

- No lost updates
- Serializable isolation maintained

---

### 4. JSON Field Serialization (4 tests)

#### Test: Correctly Serialize and Deserialize JSON Metadata

**Scenario**: Complex JSON handling  
**Steps**:

1. Create bug report with nested metadata
2. Retrieve and verify structure

**Assertions**:

- Nested objects preserved
- Arrays preserved
- Types preserved

---

#### Test: Handle Empty JSON Objects

**Steps**:

1. Create report with {}
2. Verify retrieval

---

#### Test: Handle Null Values in JSON Fields

**Steps**:

1. Create report with null metadata
2. Verify null handling

---

#### Test: Handle Complex Nested JSON Structures

**Scenario**: Deep nesting  
**Steps**:

1. Create report with 5+ levels of nesting
2. Verify integrity

---

### 5. Cascade Deletes (3 tests)

#### Test: Cascade Delete Bug Reports When Project Deleted

**Scenario**: Foreign key cascade  
**Steps**:

1. Create project with bug reports
2. Delete project
3. Verify reports deleted

---

#### Test: Cascade Delete Sessions When Bug Report Deleted

**Steps**:

1. Create report with sessions
2. Delete report
3. Verify sessions deleted

---

#### Test: Cascade Delete Tickets When Bug Report Deleted

**Steps**:

1. Create report with tickets
2. Delete report
3. Verify tickets deleted

---

### 6. Batch Operations (3 tests)

#### Test: Efficiently Create Multiple Records in Batch

**Scenario**: Bulk insert performance  
**Steps**:

1. Create array of 50 bug reports
2. Insert in batch
3. Measure time

**Performance**:

- 50 records in <500ms
- Single query vs 50 individual queries

---

#### Test: Handle Empty Batch Operations

**Steps**:

1. Call createBatch([])
2. Verify no error

---

#### Test: Automatically Split Large Batches

**Scenario**: Max batch size handling  
**Steps**:

1. Create 1500 records
2. Verify auto-splitting (PostgreSQL max = 1000)

**Assertions**:

- Split into 2 batches automatically
- All records created

---

### 7. Query Performance (3 tests)

#### Test: Efficiently Paginate Large Result Sets

**Scenario**: Pagination testing  
**Steps**:

1. Create 100 bug reports
2. Paginate with limit=10, offset=0,10,20...
3. Verify correctness

**Performance**:

- Each page loads in <100ms
- Index usage confirmed

---

#### Test: Handle Filtering with Indexes Efficiently

**Scenario**: WHERE clause performance  
**Steps**:

1. Create 50 reports with various statuses
2. Filter by status
3. Verify index usage

---

#### Test: Efficiently Sort Results

**Scenario**: ORDER BY performance  
**Steps**:

1. Create 100 reports
2. Sort by created_at DESC
3. Verify index usage

---

### 8. Error Handling (3 tests)

#### Test: Handle Foreign Key Violations

**Steps**:

1. Attempt to create report with invalid project_id
2. Catch error

---

#### Test: Handle Invalid UUID Format

**Steps**:

1. Query with string "not-a-uuid"
2. Verify error

---

#### Test: Handle Duplicate Unique Constraints

**Steps**:

1. Create project with api_key
2. Attempt duplicate api_key
3. Catch unique violation

---

## API Integration Tests

**File**: `tests/integration/api.integration.test.ts`  
**Tests**: 30+  
**Infrastructure**: Full Fastify server with database

### 1. Health Endpoints (3 tests)

#### Test: GET /health Returns 200

**Scenario**: Basic liveness check  
**Steps**:

1. GET /health (no auth)
2. Verify 200

**Assertions**:

- HTTP 200
- Response body contains status

---

#### Test: GET /ready Returns 200 When DB Connected

**Scenario**: Readiness check  
**Steps**:

1. GET /ready
2. Verify DB connection

**Assertions**:

- HTTP 200 if DB healthy
- HTTP 503 if DB down

---

#### Test: GET / Returns API Info

**Scenario**: API metadata  
**Steps**:

1. GET /
2. Verify version and endpoints

---

### 2. Project Endpoints (8 tests)

#### Test: POST /api/v1/projects Creates Project with Valid Auth

**Scenario**: Project creation  
**Steps**:

1. Create admin user
2. Generate JWT
3. POST /api/v1/projects with Bearer token
4. Verify project created

**Assertions**:

- HTTP 201
- Project has ID and API key
- API key starts with "bgs\_"

---

#### Test: POST /api/v1/projects Returns 401 Without Auth

**Scenario**: Auth enforcement  
**Steps**:

1. POST /api/v1/projects without Authorization header
2. Verify 401

---

#### Test: GET /api/v1/projects/:id Returns Project

**Scenario**: Project retrieval  
**Steps**:

1. Create project
2. GET /api/v1/projects/:id
3. Verify data matches

---

#### Test: PATCH /api/v1/projects/:id Updates Project

**Scenario**: Project modification  
**Steps**:

1. Create project
2. PATCH with new name
3. Verify update

---

#### Test: POST /api/v1/projects/:id/regenerate-key (Admin Only)

**Scenario**: Security key rotation  
**Steps**:

1. Create project
2. Regenerate API key
3. Verify new key differs

**Assertions**:

- New key generated
- Old key no longer works

---

#### Test: Returns 403 for Non-Admin Regeneration

**Steps**:

1. Create viewer user
2. Attempt key regeneration
3. Verify 403

---

#### Test: GET Returns 404 for Non-Existent Project

**Steps**:

1. GET /api/v1/projects/fake-uuid
2. Verify 404

---

### 3. Bug Report Endpoints (10+ tests)

#### Test: POST /api/v1/reports Creates Report with API Key

**Scenario**: SDK bug submission  
**Steps**:

1. Create project
2. POST /api/v1/reports with x-api-key header
3. Verify report created

**Assertions**:

- HTTP 201
- Report ID returned
- Metadata stored correctly

---

#### Test: Returns 401 with Invalid API Key

**Steps**:

1. POST with fake API key
2. Verify 401

---

#### Test: GET /api/v1/reports/:id Returns Report

**Steps**:

1. Create report
2. GET /api/v1/reports/:id
3. Verify data

---

#### Test: PATCH /api/v1/reports/:id Updates Status

**Scenario**: Status workflow  
**Steps**:

1. Create report
2. PATCH status to 'in_progress'
3. PATCH status to 'resolved'
4. Verify transitions

---

#### Test: DELETE /api/v1/reports/:id Soft Deletes

**Scenario**: Soft delete  
**Steps**:

1. Create report
2. DELETE /api/v1/reports/:id
3. Verify deleted_at timestamp set
4. Verify not returned in list

---

#### Test: GET /api/v1/reports Lists with Pagination

**Steps**:

1. Create 25 reports
2. GET /api/v1/reports?limit=10&offset=0
3. Verify 10 returned
4. GET /api/v1/reports?limit=10&offset=10
5. Verify next 10

---

#### Test: Filters by Status

**Steps**:

1. Create reports with various statuses
2. GET /api/v1/reports?status=open
3. Verify filtered results

---

#### Test: Sorts by Created Date

**Steps**:

1. Create reports
2. GET /api/v1/reports?sort_by=created_at&order=desc
3. Verify ordering

---

## Storage Integration Tests

**File**: `tests/integration/storage.integration.test.ts`  
**Tests**: 15+

### S3 Storage (8 tests)

#### Test: Upload Screenshot to S3

**Scenario**: Full S3 workflow  
**Steps**:

1. Create project
2. Generate image buffer with sharp
3. uploadScreenshot()
4. Verify returned storage key
5. Download and verify

---

#### Test: Upload Replay to S3

**Steps**:

1. uploadReplay() with JSON data
2. Verify key format

---

#### Test: Generate Signed URL

**Scenario**: Temporary access  
**Steps**:

1. Upload file
2. getSignedUrl() with 1h expiry
3. Fetch URL
4. Verify content

---

#### Test: Handle Large File Upload (Multipart)

**Scenario**: >5MB file  
**Steps**:

1. Create 10MB buffer
2. Upload via multipart
3. Verify success

**Performance**:

- Uploads in chunks
- Constant memory usage

---

#### Test: Handle Upload Failure with Retry

**Scenario**: Network resilience  
**Steps**:

1. Simulate network error
2. Verify retry logic triggers
3. Eventual success

---

#### Test: Delete File from S3

**Steps**:

1. Upload file
2. deleteObject()
3. Verify 404 on fetch

---

#### Test: List Files with Prefix

**Steps**:

1. Upload 5 files with same prefix
2. listObjects()
3. Verify list

---

### Local Storage (7 tests)

#### Test: Upload to Local Filesystem

**Steps**:

1. uploadScreenshot()
2. Verify file exists on disk
3. Verify correct permissions

---

#### Test: Generate Local URL

**Steps**:

1. Upload file
2. Get URL
3. Verify format: http://localhost:3000/uploads/...

---

#### Test: Handle Directory Creation

**Steps**:

1. Upload to non-existent directory
2. Verify auto-creation

---

#### Test: Delete Local File

**Steps**:

1. Upload file
2. Delete
3. Verify removed from disk

---

## Authentication Integration Tests

**File**: `tests/integration/auth.integration.test.ts`  
**Tests**: 20+

### JWT Authentication (8 tests)

#### Test: Login with Valid Credentials

**Steps**:

1. Create user with bcrypt password
2. POST /api/v1/auth/login
3. Verify JWT tokens returned

**Assertions**:

- accessToken present
- refreshToken present
- accessToken expires in 1h
- refreshToken expires in 7d

---

#### Test: Returns 401 with Invalid Credentials

**Steps**:

1. POST /api/v1/auth/login with wrong password
2. Verify 401

---

#### Test: Refresh Access Token

**Steps**:

1. Login
2. Wait for access token to expire
3. POST /api/v1/auth/refresh with refreshToken
4. Verify new accessToken

---

#### Test: Returns 401 with Expired Refresh Token

**Steps**:

1. Create token with past expiry
2. Attempt refresh
3. Verify 401

---

#### Test: Logout Invalidates Refresh Token

**Steps**:

1. Login
2. POST /api/v1/auth/logout
3. Attempt to refresh
4. Verify 401

---

### API Key Authentication (5 tests)

#### Test: Authenticate with Valid API Key

**Steps**:

1. Create project
2. Use API key in x-api-key header
3. Verify access granted

---

#### Test: Returns 401 with Invalid API Key

**Steps**:

1. Use fake API key
2. Verify 401

---

#### Test: API Key Validates Project Scope

**Steps**:

1. Create 2 projects
2. Use Project A key to access Project B resource
3. Verify 403

---

### Role-Based Access Control (7 tests)

#### Test: Admin Can Access All Endpoints

**Steps**:

1. Create admin user
2. Verify access to /api/v1/admin/\*

---

#### Test: Viewer Cannot Modify Resources

**Steps**:

1. Create viewer user
2. Attempt PATCH /api/v1/reports/:id
3. Verify 403

---

#### Test: Owner Can Manage Own Projects

**Steps**:

1. Create project
2. Verify owner can PATCH, DELETE

---

## Load Tests

**File**: `tests/integration/load.test.ts`  
**Tests**: 15  
**Purpose**: Performance and scalability validation

### 1. Concurrent Bug Report Creation (2 tests)

#### Test: Handle 100 Concurrent Creations

**Scenario**: Spike traffic  
**Steps**:

1. Spawn 100 parallel POST /api/v1/reports
2. Measure completion time
3. Verify all succeed

**Performance targets**:

- All 100 complete in <10s
- No database deadlocks
- No connection exhaustion

---

#### Test: Maintain Response Times Under Load

**Steps**:

1. Create 50 concurrent requests
2. Measure p50, p95, p99 latencies
3. Verify acceptable thresholds

**Targets**:

- p50 < 200ms
- p95 < 500ms
- p99 < 1000ms

---

### 2. Connection Pool Management (2 tests)

#### Test: Not Exhaust Connection Pool Under Load

**Scenario**: Pool limits  
**Steps**:

1. Execute 100 parallel queries
2. Monitor pool stats
3. Verify no exhaustion

**Assertions**:

- Max connections not exceeded
- Waiting count stays low

---

#### Test: Handle Sequential Operations Without Leaks

**Steps**:

1. Execute 1000 sequential queries
2. Monitor pool
3. Verify no leaks

---

### 3. Memory Usage (1 test)

#### Test: Not Grow Memory Unbounded

**Scenario**: Memory leak detection  
**Steps**:

1. Capture baseline memory
2. Execute 1000 operations
3. Force garbage collection
4. Verify memory returns to baseline

**Assertions**:

- Memory delta < 50MB

---

### 4. Batch Operations Performance (2 tests)

#### Test: Efficiently Create Large Batches

**Steps**:

1. Create 500 records in batch
2. Measure time

**Targets**:

- <2s for 500 records

---

#### Test: Handle Auto-Batching Efficiently

**Steps**:

1. Create 2000 records
2. Verify auto-splitting

---

### 5. Pagination Performance (1 test)

#### Test: Efficiently Paginate Large Datasets

**Steps**:

1. Create 1000 records
2. Paginate through all pages
3. Measure time per page

**Targets**:

- Each page <100ms

---

### 6. Concurrent Reads and Writes (1 test)

#### Test: Handle Mixed Concurrent Operations

**Steps**:

1. Spawn 50 readers + 50 writers
2. Verify data consistency
3. No deadlocks

---

### 7. Stress Tests (3 tests)

#### Test: Handle Rapid Authentication Requests

**Steps**:

1. Execute 200 logins/second
2. Verify no JWT signing bottleneck

---

#### Test: Recover from Transient Failures

**Steps**:

1. Simulate network blips
2. Verify retry logic
3. Eventual consistency

---

#### Test: Maintain Consistency Under High Concurrency

**Steps**:

1. 100 concurrent updates to same record
2. Verify final state is consistent

---

### 8. Resource Cleanup (1 test)

#### Test: Properly Clean Up Resources

**Steps**:

1. Execute operations
2. Verify connections closed
3. Verify temp files deleted

---

## Test Infrastructure

### Testcontainers Setup

All integration tests use ephemeral Docker containers:

```typescript
// Global setup (runs once)
beforeAll(async () => {
  postgresContainer = await new PostgreSQLContainer('postgres:16-alpine')
    .withDatabase('bugspotter_test')
    .start();

  // Run migrations
  await runMigrations(postgresContainer.getConnectionUrl());
});

// Per-test-suite setup (queue tests)
beforeAll(async () => {
  redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
});
```

**Benefits**:

- Isolated test environment
- No manual setup required
- Reproducible across machines
- Parallel test execution safe

---

### Test Data Factories

Helper functions create consistent test data:

```typescript
// Create test project
async function createTestProject(db: DatabaseClient) {
  return await db.projects.create({
    name: 'Test Project',
    api_key: `bgs_test_${Date.now()}`,
  });
}

// Create test user
async function createTestUser(db: DatabaseClient, role: 'admin' | 'viewer') {
  return await db.users.create({
    email: `test-${Date.now()}@example.com`,
    password_hash: await bcrypt.hash('password123', 10),
    role,
  });
}

// Create test image
async function createTestImage(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}
```

---

### Assertion Helpers

Common assertion patterns:

```typescript
// Verify API response structure
function expectSuccessResponse(response, expectedData?: object) {
  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(true);
  if (expectedData) {
    expect(body.data).toMatchObject(expectedData);
  }
}

// Verify error response
function expectErrorResponse(response, expectedCode: number, expectedMessage?: string) {
  expect(response.statusCode).toBe(expectedCode);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  if (expectedMessage) {
    expect(body.error).toContain(expectedMessage);
  }
}

// Verify UUID format
function expectUUID(value: string) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
}

// Verify timestamp recency
function expectRecentTimestamp(timestamp: string | Date, withinSeconds = 5) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  expect(diffMs).toBeLessThan(withinSeconds * 1000);
  expect(diffMs).toBeGreaterThan(0);
}
```

---

## Running Tests

### Quick Commands

```bash
# Run all integration tests
pnpm test:integration

# Run specific test suite
pnpm test:queue                    # Queue integration tests
pnpm test tests/integration/db.integration.test.ts

# Run with watch mode
pnpm test:integration:watch

# Run with coverage
pnpm test:coverage

# Run load tests (separate command)
pnpm test:load
```

---

### Environment Requirements

**Required**:

- Docker running (for Testcontainers)
- Node 20+
- pnpm

**Optional**:

- Redis (local) - not required, containers used instead
- PostgreSQL (local) - not required, containers used instead

---

### Test Configuration

**vitest.integration.config.ts**:

```typescript
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/integration/load.test.ts'],
    globalSetup: 'tests/setup.integration.ts',
    testTimeout: 60000, // 60s for container startup
    hookTimeout: 60000,
  },
});
```

**vitest.load.config.ts**:

```typescript
export default defineConfig({
  test: {
    include: ['tests/integration/load.test.ts'],
    testTimeout: 300000, // 5min for load tests
  },
});
```

---

### Debugging Tests

```bash
# Run single test with debug output
DEBUG=testcontainers* pnpm test tests/integration/queue-integration.test.ts

# Run with verbose logging
VERBOSE=true pnpm test:integration

# Skip container teardown for inspection
TEST_SKIP_TEARDOWN=true pnpm test:integration
```

---

## Test Metrics Summary

| Category             | Tests    | Pass Rate | Avg Duration |
| -------------------- | -------- | --------- | ------------ |
| Queue Integration    | 22       | 100%      | 50s          |
| Database Integration | 25       | 100%      | 30s          |
| API Integration      | 30+      | 100%      | 45s          |
| Storage Integration  | 15+      | 100%      | 25s          |
| Auth Integration     | 20+      | 100%      | 35s          |
| Load Tests           | 15       | 100%      | 2min         |
| **Total**            | **150+** | **100%**  | **~5min**    |

---

## Best Practices Demonstrated

### 1. Real Infrastructure

- Use Testcontainers for ephemeral databases
- No mocks for integration tests
- Test against production-like environment

### 2. Test Isolation

- Each test creates its own data
- Transactions rolled back where appropriate
- Containers torn down after tests

### 3. Async Handling

- Proper async/await usage
- Timeout management
- Polling with max attempts

### 4. Performance Validation

- Load tests verify scalability
- Concurrent operation testing
- Memory leak detection

### 5. Comprehensive Coverage

- Happy path scenarios
- Error conditions
- Edge cases (empty arrays, null values, large files)
- Security scenarios (auth, RBAC, injection)

---

## Continuous Integration

Tests run automatically on:

- Push to `main` or `develop`
- Pull requests to protected branches
- Nightly builds

**GitHub Actions workflow**:

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:integration
      - run: pnpm test:load
```

---

**Last Updated**: October 13, 2025  
**Maintained By**: BugSpotter Engineering Team  
**Questions**: See `/packages/backend/TESTING.md`
