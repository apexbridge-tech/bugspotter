# BugSpotter Docker Setup

Complete Docker setup for running BugSpotter backend with PostgreSQL, Redis, and MinIO.

## Quick Start

### 1. Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM
- 10GB+ available disk space

### 2. Initial Setup

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets (REQUIRED for production!)
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# Update other configuration as needed
nano .env
```

### 3. Start Services

```bash
# Build images
pnpm docker:build

# Start all services
pnpm docker:up

# View logs
pnpm docker:logs
```

### 4. Verify Deployment

Services will be available at:

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001 (admin/minioadmin)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

Test the API:

```bash
# Health check
curl http://localhost:3000/health

# Create a test project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Testing Docker setup"
  }'
```

## Services

### API Server (`api`)

- **Image**: Built from `packages/backend/Dockerfile`
- **Port**: 3000 (configurable via `API_PORT`)
- **Responsibilities**:
  - REST API endpoints
  - Database migrations (runs automatically on startup)
  - Authentication & authorization
  - File uploads to MinIO

### Background Worker (`worker`)

- **Image**: Same as API server
- **Responsibilities**:
  - Screenshot processing
  - Session replay processing
  - Integration jobs (Jira, etc.)
  - Notification delivery
  - Scheduled retention cleanup

### PostgreSQL 16 (`postgres`)

- **Image**: `postgres:16-alpine`
- **Port**: 5432
- **Volume**: `postgres_data` (persistent)
- **Default Credentials**: bugspotter/bugspotter_dev_password
- **Database**: bugspotter

### Redis 7 (`redis`)

- **Image**: `redis:7-alpine`
- **Port**: 6379
- **Volume**: `redis_data` (persistent)
- **Configuration**:
  - Appendonly persistence enabled
  - 256MB max memory with LRU eviction

### MinIO (`minio`)

- **Image**: `minio/minio:latest`
- **Ports**:
  - 9000: S3 API
  - 9001: Web Console
- **Volume**: `minio_data` (persistent)
- **Default Credentials**: minioadmin/minioadmin
- **Bucket**: `bugspotter` (auto-created)

## Available Commands

```bash
# Build and Start
pnpm docker:build          # Build Docker images
pnpm docker:up             # Start all services
pnpm docker:down           # Stop all services

# Logs and Monitoring
pnpm docker:logs           # Tail logs for all services
pnpm docker:logs:api       # Tail API server logs only
pnpm docker:logs:worker    # Tail worker logs only
pnpm docker:ps             # List running containers

# Maintenance
pnpm docker:restart        # Restart all services
pnpm docker:clean          # Stop and remove volumes (⚠️ deletes data!)
pnpm docker:test           # Run tests inside container
```

## Configuration

### Environment Variables

All configuration is done via `.env` file. Key variables:

#### Database

```bash
POSTGRES_DB=bugspotter
POSTGRES_USER=bugspotter
POSTGRES_PASSWORD=your_secure_password
```

#### Security (REQUIRED!)

```bash
# Generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
```

#### Storage

```bash
STORAGE_BACKEND=minio
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=bugspotter
```

#### Workers

```bash
WORKER_SCREENSHOT_ENABLED=true
WORKER_REPLAY_ENABLED=true
WORKER_INTEGRATION_ENABLED=true
WORKER_NOTIFICATION_ENABLED=true

# Concurrency
WORKER_SCREENSHOT_CONCURRENCY=5
WORKER_REPLAY_CONCURRENCY=3
```

See `.env.example` for complete list of available options.

## Development Mode

For development with hot reload:

```bash
# Update .env
NODE_ENV=development
LOG_LEVEL=debug

# Mount source code as volume (add to docker-compose.yml)
volumes:
  - ./packages/backend/src:/app/packages/backend/src:ro
```

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production:

1. ✅ **Generate secure secrets**:

   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

2. ✅ **Update credentials**:
   - Strong PostgreSQL password
   - Secure MinIO credentials
   - Review CORS origins

3. ✅ **Configure storage**:
   - Use AWS S3, Cloudflare R2, or managed MinIO
   - Set up bucket lifecycle policies
   - Configure CDN if needed

4. ✅ **Set up monitoring**:
   - Configure log aggregation
   - Set up health check alerts
   - Monitor worker queue metrics

5. ✅ **Plan backups**:
   - Database backups (pg_dump)
   - S3/MinIO bucket versioning
   - Redis AOF persistence

### Using External Services

Replace container services with managed alternatives:

```bash
# External PostgreSQL (AWS RDS, etc.)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/bugspotter

# External Redis (AWS ElastiCache, etc.)
REDIS_URL=redis://redis.example.com:6379

# AWS S3
STORAGE_BACKEND=s3
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET=bugspotter-prod
S3_FORCE_PATH_STYLE=false

# Cloudflare R2
STORAGE_BACKEND=r2
S3_ENDPOINT=https://account-id.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=your-r2-access-key
S3_SECRET_KEY=your-r2-secret-key
S3_BUCKET=bugspotter
```

Then update `docker-compose.yml` to remove unused services.

## Troubleshooting

### Services Not Starting

```bash
# Check service health
pnpm docker:ps

# View logs for specific service
docker-compose logs postgres
docker-compose logs redis
docker-compose logs minio

# Restart specific service
docker-compose restart api
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection inside container
docker-compose exec api node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT NOW()')"

# Run migrations manually
docker-compose exec api node dist/db/migrations/migrate.js
```

### Worker Not Processing Jobs

```bash
# Check worker logs
pnpm docker:logs:worker

# Verify Redis connection
docker-compose exec redis redis-cli ping

# Check queue status (from API container)
docker-compose exec api node -e "require('bullmq').Queue('screenshots').getJobCounts().then(console.log)"
```

### MinIO Issues

```bash
# Check MinIO logs
docker-compose logs minio

# Verify bucket exists
docker-compose exec minio mc ls minio/

# Recreate bucket
docker-compose exec minio mc mb --ignore-existing minio/bugspotter
```

### Disk Space Issues

```bash
# Check volume sizes
docker system df -v

# Clean up unused resources
docker system prune -a --volumes

# Remove specific volumes (⚠️ deletes data!)
docker volume rm bugspotter_minio_data
```

## Scaling

### Horizontal Scaling

Scale worker instances:

```bash
docker-compose up -d --scale worker=3
```

Update `docker-compose.yml`:

```yaml
worker:
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
```

### Resource Limits

Set memory and CPU limits:

```yaml
api:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Backups

### Database Backup

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U bugspotter bugspotter > backup.sql

# Restore
docker-compose exec -T postgres psql -U bugspotter bugspotter < backup.sql
```

### MinIO Backup

```bash
# Backup bucket
docker-compose exec minio mc mirror minio/bugspotter /backup/bugspotter

# Or use MinIO's built-in replication
```

## Monitoring

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Worker health (via API metrics endpoint)
curl http://localhost:3000/api/admin/metrics

# PostgreSQL
docker-compose exec postgres pg_isready

# Redis
docker-compose exec redis redis-cli ping
```

### Logs

```bash
# Follow all logs
pnpm docker:logs

# Filter logs
docker-compose logs --tail=100 api | grep ERROR

# Export logs
docker-compose logs --no-color > bugspotter.log
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   Load Balancer │
              └────────┬────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    ┌──────────┐           ┌──────────┐
    │   API    │           │   API    │
    │ (Port 3000)│         │ (Replica)│
    └────┬─────┘           └────┬─────┘
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Worker 1│ │Worker 2│ │Worker 3│
    └────┬───┘ └────┬───┘ └────┬───┘
         │          │          │
         └──────────┼──────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Postgres│ │ Redis  │ │ MinIO  │
    │:5432   │ │:6379   │ │:9000   │
    └────────┘ └────────┘ └────────┘
```

## Performance Tuning

### PostgreSQL

```yaml
postgres:
  command: >
    postgres
    -c max_connections=200
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=64MB
    -c checkpoint_completion_target=0.9
    -c wal_buffers=16MB
    -c default_statistics_target=100
```

### Redis

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --save 60 1000
```

## License

MIT
