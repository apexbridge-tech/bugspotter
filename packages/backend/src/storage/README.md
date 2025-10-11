# Storage Layer

Unified storage interface for BugSpotter supporting multiple backends: local filesystem (development), S3 (production), MinIO (testing), and Cloudflare R2.

## Quick Start

### Local Storage (Development)

```typescript
import { createStorage } from './storage';

const storage = createStorage({
  backend: 'local',
  local: {
    baseDirectory: './data/uploads',
    baseUrl: 'http://localhost:3000/uploads',
  },
});

await storage.initialize();
```

### S3 Storage (Production)

```typescript
const storage = createStorage({
  backend: 's3',
  s3: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: 'bugspotter-prod',
  },
});
```

### From Environment Variables

```bash
# .env file
STORAGE_BACKEND=local
STORAGE_BASE_DIR=./data/uploads
STORAGE_BASE_URL=http://localhost:3000/uploads

# Or for S3:
STORAGE_BACKEND=s3
S3_REGION=us-east-1
S3_BUCKET=bugspotter
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

```typescript
import { createStorageFromEnv } from './storage';

const storage = createStorageFromEnv();
await storage.initialize();
```

## Storage Structure

```
/screenshots/{project_id}/{bug_id}/
  - original.png       # Original screenshot
  - thumbnail.jpg      # Auto-generated thumbnail (200x200)

/replays/{project_id}/{bug_id}/
  - metadata.json      # Session replay metadata
  - chunks/
    - 1.json.gz        # Compressed replay chunks
    - 2.json.gz

/attachments/{project_id}/{bug_id}/
  - {sanitized-filename}  # User uploads (path traversal protected)
```

## Core Operations

```typescript
// Upload screenshot
await storage.uploadScreenshot(projectId, bugId, imageBuffer);

// Upload thumbnail
await storage.uploadThumbnail(projectId, bugId, thumbnailBuffer);

// Upload replay data
await storage.uploadReplayMetadata(projectId, bugId, metadata);
await storage.uploadReplayChunk(projectId, bugId, chunkIndex, compressedData);

// Upload attachment
await storage.uploadAttachment(projectId, bugId, filename, fileBuffer);

// Retrieve
const stream = await storage.getObject(key);
const metadata = await storage.headObject(key);

// Generate signed URL (S3 only, 1 hour default)
const url = await storage.getSignedUrl(key, { expiresIn: 3600 });

// Delete
await storage.deleteObject(key);
await storage.deleteFolder(prefix);

// List
const result = await storage.listObjects({ prefix, maxKeys: 100 });
```

## Architecture

### Template Method Pattern

`BaseStorageService` handles common validation/sanitization logic:

```typescript
abstract class BaseStorageService {
  // Template method with validation
  protected async uploadWithKey(type, projectId, bugId, filename, buffer) {
    // 1. Validate project ID and bug ID (UUID format)
    // 2. Build and sanitize storage key (path traversal prevention)
    // 3. Determine content type
    // 4. Delegate to implementation
    return await this.uploadBuffer(key, buffer, contentType);
  }

  // Hook for subclasses
  protected abstract uploadBuffer(key, buffer, contentType): Promise<UploadResult>;
}
```

### Implementations

- **StorageService** (S3) - True streaming with multipart uploads, retry logic
- **LocalStorageService** - Filesystem operations with directory creation
- Both extend `BaseStorageService` to eliminate code duplication (~200 lines saved)

## Security

- **Path Traversal**: Automatic sanitization of filenames and keys
- **Validation**: Project/bug IDs validated as UUIDs
- **Size Limits**: 5GB max for S3, configurable for local
- **Content Type Detection**: Automatic based on file extension
- **Metadata Stripping**: Images stripped of EXIF/GPS data

## Testing

```bash
# Unit tests (mocked storage)
pnpm vitest run tests/storage.test.ts
pnpm vitest run tests/base-storage.test.ts

# Integration tests (real storage)
pnpm vitest run tests/integration/storage.integration.test.ts

# With MinIO (requires Docker)
TEST_MINIO=true pnpm test:integration
```

**Test Coverage**: 30+ dedicated storage tests across unit and integration suites.

## Performance

- **Upload Size Limits**: 5GB for S3 PutObject, unlimited with multipart
- **Multipart Threshold**: Automatic for files >5MB
- **Retry Logic**: Exponential backoff (1s, 2s, 4s...)
- **Memory**: Constant ~5MB usage with streaming (no buffering)

## See Also

- [Backend README](../../README.md) - Main backend documentation
- [TESTING.md](../../TESTING.md) - Comprehensive testing guide
- [SECURITY.md](../../SECURITY.md) - Security practices
