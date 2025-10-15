#!/bin/sh
# ============================================================================
# MinIO Bucket Initialization Script
# ============================================================================
# Creates the BugSpotter storage bucket with private access (secure by default)
# Usage: Executed automatically by minio-init container on startup
# ============================================================================

set -e  # Exit on any error

# Configuration from environment variables
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}"
BUCKET_NAME="${MINIO_BUCKET:-bugspotter}"

# Validate required credentials
if [ -z "$MINIO_ROOT_USER" ] || [ -z "$MINIO_ROOT_PASSWORD" ]; then
  echo "Error: MINIO_ROOT_USER and MINIO_ROOT_PASSWORD must be set"
  echo "Please define these in your .env file"
  exit 1
fi

echo "Initializing MinIO bucket: ${BUCKET_NAME}"

# Configure MinIO client alias
echo "Configuring MinIO client..."
mc alias set minio "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

# Create bucket if it doesn't exist
echo "Creating bucket (if not exists)..."
mc mb --ignore-existing "minio/${BUCKET_NAME}"

# Verify bucket was created
if mc ls "minio/${BUCKET_NAME}" > /dev/null 2>&1; then
  echo "✓ MinIO bucket '${BUCKET_NAME}' initialized successfully (private access)"
else
  echo "✗ Failed to verify bucket creation"
  exit 1
fi

echo "MinIO initialization complete"
