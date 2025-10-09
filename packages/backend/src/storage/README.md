# Storage Layer

S3-compatible object storage layer for BugSpotter backend. Supports AWS S3, MinIO, Cloudflare R2, and local filesystem storage.

## Features

- **Multiple Backends**: S3, MinIO, R2, and local filesystem
- **Unified Interface**: Same API regardless of backend
- **Image Processing**: Thumbnail generation, optimization, validation
- **Stream Support**: Efficient handling of large files
- **Retry Logic**: Automatic retry with exponential backoff
- **Type Safety**: Full TypeScript support
- **Path-Style URLs**: Support for MinIO and custom endpoints

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

### MinIO Storage

```typescript
const storage = createStorage({
  backend: 'minio',
  s3: {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    bucket: 'bugspotter',
    forcePathStyle: true, // Required for MinIO
  },
});

await storage.initialize();
```

### AWS S3 Storage

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

await storage.initialize();
```

### Cloudflare R2 Storage

```typescript
const storage = createStorage({
  backend: 'r2',
  s3: {
    endpoint: 'https://account-id.r2.cloudflarestorage.com',
    region: 'auto',
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
    bucket: 'bugspotter',
  },
});

await storage.initialize();
```

## Environment Variables

```bash
# Storage backend selection
STORAGE_BACKEND=local          # Options: local, s3, minio, r2

# Local storage configuration
STORAGE_BASE_DIR=./data/uploads
STORAGE_BASE_URL=http://localhost:3000/uploads

# S3-compatible storage configuration
S3_ENDPOINT=                   # Optional (for MinIO/R2)
S3_REGION=us-east-1           # Required
S3_ACCESS_KEY=                 # Required
S3_SECRET_KEY=                 # Required
S3_BUCKET=bugspotter          # Required
S3_FORCE_PATH_STYLE=true      # Required for MinIO
S3_MAX_RETRIES=3              # Optional
S3_TIMEOUT_MS=30000           # Optional
```

## Storage Structure

Files are organized in a standardized structure:

```
/screenshots/{project_id}/{bug_id}/
  - original.png       # Original screenshot
  - thumbnail.jpg      # Auto-generated thumbnail (200x200)

/replays/{project_id}/{bug_id}/
  - metadata.json      # Session replay metadata
  - chunks/
    - 1.json.gz        # Compressed replay chunks
    - 2.json.gz
    - n.json.gz

/attachments/{project_id}/{bug_id}/
  - {filename}         # User-uploaded attachments
```

## Core Methods

### Upload Methods

```typescript
// Upload screenshot (original image)
const result = await storage.uploadScreenshot('proj-123', 'bug-456', imageBuffer);
console.log(result.url); // Public URL

// Upload thumbnail
const thumb = await storage.uploadThumbnail('proj-123', 'bug-456', thumbnailBuffer);

// Upload replay metadata
const metadata = await storage.uploadReplayMetadata('proj-123', 'bug-456', {
  duration: 5000,
  events: 100,
});

// Upload replay chunk
const chunk = await storage.uploadReplayChunk(
  'proj-123',
  'bug-456',
  1, // chunk index
  compressedData
);

// Upload attachment
const attachment = await storage.uploadAttachment(
  'proj-123',
  'bug-456',
  'screenshot.png',
  fileBuffer
);
```

### Retrieval Methods

```typescript
// Get object as stream
const stream = await storage.getObject('screenshots/proj-123/bug-456/original.png');

// Check if object exists
const metadata = await storage.headObject('screenshots/proj-123/bug-456/original.png');
if (metadata) {
  console.log(`Size: ${metadata.size} bytes`);
  console.log(`Last modified: ${metadata.lastModified}`);
}

// Generate temporary signed URL (expires in 1 hour by default)
const signedUrl = await storage.getSignedUrl('screenshots/proj-123/bug-456/original.png', {
  expiresIn: 3600,
});
```

### Delete Methods

```typescript
// Delete single object
await storage.deleteObject('screenshots/proj-123/bug-456/original.png');

// Delete entire folder (all files with prefix)
const deletedCount = await storage.deleteFolder('screenshots/proj-123/bug-456/');
console.log(`Deleted ${deletedCount} files`);
```

### List Methods

```typescript
// List objects with prefix
const result = await storage.listObjects({
  prefix: 'screenshots/proj-123/',
  maxKeys: 100,
});

for (const obj of result.objects) {
  console.log(`${obj.key} - ${obj.size} bytes`);
}

if (result.isTruncated) {
  // More results available
  const nextPage = await storage.listObjects({
    prefix: 'screenshots/proj-123/',
    continuationToken: result.nextContinuationToken,
  });
}
```

## Image Processing

### Thumbnail Generation

```typescript
import { generateThumbnail } from './storage';

const originalImage = await fs.readFile('screenshot.png');
const thumbnail = await generateThumbnail(originalImage, 200, 200);

// Upload both
await storage.uploadScreenshot('proj-1', 'bug-1', originalImage);
await storage.uploadThumbnail('proj-1', 'bug-1', thumbnail);
```

### Image Optimization

```typescript
import { optimizeImage } from './storage';

const originalImage = await fs.readFile('large-screenshot.png');
const optimized = await optimizeImage(originalImage);

console.log(`Original: ${originalImage.length} bytes`);
console.log(`Optimized: ${optimized.length} bytes`);
console.log(`Savings: ${((1 - optimized.length / originalImage.length) * 100).toFixed(2)}%`);
```

### Image Validation

```typescript
import { validateImage, extractMetadata } from './storage';

try {
  await validateImage(imageBuffer);
  console.log('Image is valid');

  const metadata = await extractMetadata(imageBuffer);
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`);
  console.log(`Format: ${metadata.format}`);
  console.log(`Size: ${metadata.size} bytes`);
} catch (error) {
  console.error('Invalid image:', error.message);
}
```

## Stream Utilities

### Buffer to Stream Conversion

```typescript
import { bufferToStream, streamToBuffer } from './storage';

// Convert buffer to stream for upload
const stream = bufferToStream(myBuffer);
await storage.uploadStream('custom/path.dat', stream);

// Convert stream to buffer for processing
const retrievedStream = await storage.getObject('custom/path.dat');
const buffer = await streamToBuffer(retrievedStream);
```

### Progress Tracking

```typescript
import { createProgressStream } from './storage';

const progressStream = createProgressStream((bytesTransferred) => {
  console.log(`Uploaded: ${bytesTransferred} bytes`);
});

sourceStream.pipe(progressStream).pipe(destinationStream);
```

### Multipart Upload

```typescript
await storage.uploadStream('large-file.bin', largeFileStream, {
  partSize: 5 * 1024 * 1024, // 5MB parts
  onProgress: (uploaded, total) => {
    console.log(`Progress: ${((uploaded / total) * 100).toFixed(2)}%`);
  },
});
```

## Error Handling

All storage operations can throw specific error types:

```typescript
import {
  StorageError,
  StorageConnectionError,
  StorageUploadError,
  StorageNotFoundError,
  StorageValidationError,
} from './storage';

try {
  await storage.uploadScreenshot('proj-1', 'bug-1', imageBuffer);
} catch (error) {
  if (error instanceof StorageConnectionError) {
    console.error('Cannot connect to storage backend');
  } else if (error instanceof StorageUploadError) {
    console.error('Upload failed:', error.message);
  } else if (error instanceof StorageNotFoundError) {
    console.error('Object not found');
  } else if (error instanceof StorageValidationError) {
    console.error('Invalid image:', error.message);
  } else if (error instanceof StorageError) {
    console.error('Storage error:', error.code, error.message);
  }
}
```

## Health Check

Check storage backend availability:

```typescript
const isHealthy = await storage.healthCheck();
if (!isHealthy) {
  console.error('Storage backend is not accessible');
}
```

## Testing

### Unit Tests

```bash
pnpm test tests/storage.test.ts
```

### Integration Tests

For S3/MinIO testing, ensure the backend is running:

```bash
# Start MinIO in Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Run integration tests
STORAGE_BACKEND=minio \
S3_ENDPOINT=http://localhost:9000 \
S3_REGION=us-east-1 \
S3_ACCESS_KEY=minioadmin \
S3_SECRET_KEY=minioadmin \
S3_BUCKET=test-bucket \
S3_FORCE_PATH_STYLE=true \
pnpm test:integration
```

## Performance Considerations

### Upload Size Limits

- **Max image size**: 10MB (configurable)
- **Max dimensions**: 4096x4096 pixels
- **Multipart threshold**: 5MB (automatic)

### Retry Configuration

Uploads automatically retry with exponential backoff:

```typescript
const storage = createStorage({
  backend: 's3',
  s3: {
    // ... other config
    maxRetries: 3, // Retry up to 3 times
    timeout: 30000, // 30 second timeout
  },
});
```

Retry delays: 1s, 2s, 4s, 8s...

### Optimization Tips

1. **Use thumbnails** for list views instead of full images
2. **Enable compression** for replay chunks (gzip)
3. **Use signed URLs** for private content
4. **Batch delete operations** when cleaning up
5. **Stream large files** instead of loading into memory

## Architecture

### Factory Pattern

```typescript
// Auto-detect from environment
const storage = createStorageFromEnv();

// Explicit configuration
const storage = createStorage(config);
```

### Interface-Based Design

Both S3 and local storage implement `IStorageService`:

```typescript
interface IStorageService {
  initialize(): Promise<void>;
  uploadScreenshot(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult>;
  uploadThumbnail(projectId: string, bugId: string, buffer: Buffer): Promise<UploadResult>;
  // ... more methods
  healthCheck(): Promise<boolean>;
}
```

### Dependency Injection

```typescript
// Easy to mock for testing
class BugReportService {
  constructor(private storage: IStorageService) {}

  async createReport(report: BugReport, screenshot: Buffer) {
    const uploadResult = await this.storage.uploadScreenshot(
      report.projectId,
      report.id,
      screenshot
    );
    // ... save to database
  }
}
```

## Security

### Path Sanitization

Filenames are automatically sanitized to prevent path traversal:

```typescript
// Input: "../../../etc/passwd"
// Output: "___etc_passwd"
await storage.uploadAttachment('proj-1', 'bug-1', '../../../etc/passwd', buffer);
```

### Signed URLs

Generate temporary access URLs that expire:

```typescript
// URL expires in 1 hour (default)
const url = await storage.getSignedUrl('private/file.png');

// Custom expiration
const url = await storage.getSignedUrl('private/file.png', {
  expiresIn: 7200, // 2 hours
  responseContentDisposition: 'attachment; filename="download.png"',
});
```

### Metadata Stripping

Images are automatically stripped of EXIF/GPS data for privacy:

```typescript
import { optimizeImage } from './storage';

// Removes all metadata (EXIF, GPS, etc.)
const sanitized = await optimizeImage(imageBuffer);
```

## Troubleshooting

### MinIO Connection Issues

If you see "getaddrinfo ENOTFOUND" errors:

```typescript
// Use 127.0.0.1 instead of localhost
S3_ENDPOINT=http://127.0.0.1:9000
```

### Bucket Creation Fails

Ensure IAM permissions include:

- `s3:CreateBucket`
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:ListBucket`

### Path Style vs Virtual Hosted

- **MinIO/R2**: Use `forcePathStyle: true`
- **AWS S3**: Use `forcePathStyle: false` (default)

```typescript
// MinIO: http://localhost:9000/bucket/key (path-style)
forcePathStyle: true;

// AWS S3: https://bucket.s3.region.amazonaws.com/key (virtual-hosted)
forcePathStyle: false;
```

## Migration Guide

### From Local to S3

1. Create S3 bucket and get credentials
2. Update environment variables
3. Run migration script to copy existing files
4. Update application to use S3 backend
5. Verify all files accessible
6. Remove local files

### From S3 to MinIO

1. Deploy MinIO instance
2. Create bucket in MinIO
3. Use `aws s3 sync` to copy objects
4. Update environment variables
5. Test application with MinIO
6. Switch production traffic

## License

Part of BugSpotter backend package.
