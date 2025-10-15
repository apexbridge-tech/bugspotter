#!/bin/sh
# ============================================================================
# BugSpotter Backend - Docker Entrypoint Script
# ============================================================================
# Responsibilities:
# 1. Wait for PostgreSQL and Redis to be ready
# 2. Run database migrations (API service only)
# 3. Start the appropriate service (api or worker)
# ============================================================================

set -e

SERVICE_TYPE="${1:-api}"

echo "==================================="
echo "BugSpotter Backend - $SERVICE_TYPE"
echo "==================================="

# ============================================================================
# Wait for PostgreSQL
# ============================================================================
wait_for_postgres() {
  echo "Waiting for PostgreSQL..."
  
  # Use env vars if provided, otherwise parse DATABASE_URL
  if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    echo "Using DB_HOST and DB_PORT from environment"
  else
    echo "Parsing DATABASE_URL for connection details..."
    # Extract connection details from DATABASE_URL
    # Format: postgresql://user:pass@host:port/db
    DB_URL_NO_PROTO="${DATABASE_URL#postgresql://}"
    DB_URL_NO_PROTO="${DB_URL_NO_PROTO#postgres://}"
    
    # Extract host:port/db part (after @)
    DB_HOSTPORT="${DB_URL_NO_PROTO#*@}"
    
    # Extract host (before :)
    DB_HOST="${DB_HOSTPORT%%:*}"
    
    # Extract port (after : and before /)
    DB_PORT_DB="${DB_HOSTPORT#*:}"
    DB_PORT="${DB_PORT_DB%%/*}"
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
      echo "Error: Could not parse DATABASE_URL and DB_HOST/DB_PORT not set"
      echo "Set DB_HOST and DB_PORT env vars, or use format: postgresql://user:pass@host:port/db"
      exit 1
    fi
  fi
  
  echo "Checking PostgreSQL at $DB_HOST:$DB_PORT..."
  
  MAX_RETRIES=30
  RETRY_COUNT=0
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "✓ PostgreSQL is ready"
      return 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "PostgreSQL not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 2
  done
  
  echo "Error: PostgreSQL did not become ready in time"
  exit 1
}

# ============================================================================
# Wait for Redis
# ============================================================================
wait_for_redis() {
  echo "Waiting for Redis..."
  
  # Use env vars if provided, otherwise parse REDIS_URL
  if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
    echo "Using REDIS_HOST and REDIS_PORT from environment"
  else
    echo "Parsing REDIS_URL for connection details..."
    # Extract connection details from REDIS_URL
    # Format: redis://host:port or redis://user:pass@host:port
    REDIS_URL_NO_PROTO="${REDIS_URL#redis://}"
    
    # Handle optional auth (user:pass@)
    if echo "$REDIS_URL_NO_PROTO" | grep -q '@'; then
      # Extract host:port part (after @)
      REDIS_HOSTPORT="${REDIS_URL_NO_PROTO#*@}"
    else
      # No auth, entire string is host:port
      REDIS_HOSTPORT="$REDIS_URL_NO_PROTO"
    fi
    
    # Extract host (before :)
    REDIS_HOST="${REDIS_HOSTPORT%%:*}"
    
    # Extract port (after :)
    REDIS_PORT="${REDIS_HOSTPORT#*:}"
    
    # Default values if parsing fails
    REDIS_HOST=${REDIS_HOST:-localhost}
    REDIS_PORT=${REDIS_PORT:-6379}
  fi
  
  echo "Checking Redis at $REDIS_HOST:$REDIS_PORT..."
  
  MAX_RETRIES=30
  RETRY_COUNT=0
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
      echo "✓ Redis is ready"
      return 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Redis not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 2
  done
  
  echo "Error: Redis did not become ready in time"
  exit 1
}

# ============================================================================
# Run Database Migrations
# ============================================================================
run_migrations() {
  echo "Running database migrations..."
  
  cd /app/packages/backend
  node dist/db/migrations/migrate.js
  
  if [ $? -eq 0 ]; then
    echo "✓ Migrations completed successfully"
  else
    echo "Error: Migrations failed"
    exit 1
  fi
}

# ============================================================================
# Main Logic
# ============================================================================

# Always wait for PostgreSQL
wait_for_postgres

# Wait for Redis if URL is configured
if [ -n "$REDIS_URL" ]; then
  wait_for_redis
else
  echo "REDIS_URL not set, skipping Redis check"
fi

# Run migrations for API service only
if [ "$SERVICE_TYPE" = "api" ]; then
  run_migrations
else
  echo "Worker service - skipping migrations"
fi

# Start the appropriate service
echo "Starting $SERVICE_TYPE service..."
cd /app/packages/backend

case "$SERVICE_TYPE" in
  api)
    exec node dist/api/index.js
    ;;
  worker)
    exec node dist/worker.js
    ;;
  *)
    echo "Error: Invalid service type '$SERVICE_TYPE'. Must be 'api' or 'worker'"
    exit 1
    ;;
esac
