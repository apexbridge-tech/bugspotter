# Data Compression

BugSpotter includes a powerful gzip-based compression layer that reduces payload sizes by 70-90%, significantly improving network efficiency and reducing bandwidth costs.

## Overview

The compression layer automatically compresses bug report payloads before transmission, using industry-standard gzip compression via the **pako** library. This feature is transparent to users and requires no configuration.

## Key Features

- ✅ **Automatic compression** - No manual intervention required
- ✅ **70-90% size reduction** - Typical compression ratios
- ✅ **Intelligent fallback** - Automatically uses uncompressed data if compression fails
- ✅ **Image optimization** - Screenshots converted to WebP with quality tuning
- ✅ **Binary upload** - Efficient Blob-based transfer
- ✅ **Configurable settings** - Fine-tune compression parameters

## Compression Utilities

### `compressData(data, config?)`

Compress JSON or string data using gzip.

```typescript
import { compressData } from '@bugspotter/sdk';

const payload = { title: 'Bug', description: 'Issue found' };
const compressed = await compressData(payload);
// Returns: Uint8Array (gzipped binary data)
```

**Parameters:**
- `data` - Data to compress (will be JSON stringified if object)
- `config?` - Optional compression configuration

**Returns:** `Promise<Uint8Array>`

---

### `decompressData(data, config?)`

Decompress gzipped data back to original form.

```typescript
import { decompressData } from '@bugspotter/sdk';

const compressed = await compressData({ hello: 'world' });
const original = await decompressData(compressed);
// Returns: { hello: 'world' }
```

**Parameters:**
- `data` - Compressed Uint8Array data
- `config?` - Optional compression configuration

**Returns:** `Promise<unknown>` (parsed JSON if valid, otherwise string)

---

### `compressImage(dataUrl, config?)`

Optimize and compress screenshot images.

```typescript
import { compressImage } from '@bugspotter/sdk';

const screenshot = 'data:image/png;base64,...';
const optimized = await compressImage(screenshot);
// Returns: WebP format at 80% quality, max 1920x1080
```

**Parameters:**
- `dataUrl` - Base64 data URL of the image
- `config?` - Optional image compression settings

**Returns:** `Promise<string>` (optimized data URL)

**Features:**
- Converts to WebP format (80% quality by default)
- Falls back to JPEG (85% quality) if WebP unsupported
- Resizes to max 1920x1080 preserving aspect ratio
- 3-second timeout for safety

---

### `estimateSize(data)`

Estimate the size of data in bytes.

```typescript
import { estimateSize } from '@bugspotter/sdk';

const size = estimateSize({ large: 'object' });
console.log(`Payload size: ${size} bytes`);
```

**Returns:** `number` (estimated bytes)

---

### `getCompressionRatio(originalSize, compressedSize)`

Calculate compression ratio percentage.

```typescript
import { getCompressionRatio } from '@bugspotter/sdk';

const ratio = getCompressionRatio(10000, 2000);
console.log(`Reduced by ${ratio}%`); // "Reduced by 80%"
```

**Returns:** `number` (percentage reduction)

## Configuration

### CompressionConfig Interface

```typescript
interface CompressionConfig {
  /** Gzip compression level: 0-9 or -1 for default (6) */
  gzipLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | -1;
  
  /** Image compression settings */
  image?: {
    /** Max width in pixels (default: 1920) */
    maxWidth?: number;
    /** Max height in pixels (default: 1080) */
    maxHeight?: number;
    /** WebP quality 0-1 (default: 0.8) */
    webpQuality?: number;
    /** JPEG quality 0-1 (default: 0.85) */
    jpegQuality?: number;
    /** Compression timeout in ms (default: 3000) */
    timeout?: number;
  };
  
  /** Enable verbose logging (default: true) */
  verbose?: boolean;
}
```

### Example Configuration

```typescript
import { compressData, compressImage } from '@bugspotter/sdk';

// Maximum compression (slower, smaller)
const maxCompressed = await compressData(data, {
  gzipLevel: 9
});

// Fast compression (faster, larger)
const fastCompressed = await compressData(data, {
  gzipLevel: 1
});

// Custom image settings
const customImage = await compressImage(dataUrl, {
  image: {
    maxWidth: 1280,
    maxHeight: 720,
    webpQuality: 0.7
  }
});
```

## Automatic Integration

The SDK automatically compresses bug report payloads when submitted:

```typescript
BugSpotter.init({
  endpoint: 'https://api.example.com/bugs',
  apiKey: 'your-api-key'
});

// Submission automatically compresses the payload
// No additional code required!
```

### Compression Flow

1. **Capture** - Collect bug report data (screenshot, console, network, etc.)
2. **Estimate** - Calculate original payload size
3. **Compress** - Gzip the JSON payload
4. **Compare** - Check if compression reduced size
5. **Upload** - Send as `Blob` with `Content-Encoding: gzip` header
6. **Fallback** - Use uncompressed JSON if compression fails or increases size

## Performance Metrics

Real-world compression results from test suite:

| Data Type | Original Size | Compressed Size | Reduction |
|-----------|--------------|-----------------|-----------|
| Bug Report | 7.1 KB | 867 bytes | **88%** |
| Console Logs | 4.4 KB | 1.1 KB | **76%** |
| Network Data | 5.6 KB | 1.1 KB | **79%** |
| Repetitive Data | Large | Small | **70-90%** |

### Bundle Impact

- **Pako library**: ~45 KB (minified)
- **Compression utilities**: ~3 KB
- **Total overhead**: ~48 KB
- **ROI**: Savings on first large payload

## Server-Side Decompression

Your backend must handle gzipped payloads:

### Node.js / Express

```javascript
import express from 'express';
import { gunzipSync } from 'zlib';

const app = express();

app.post('/bugs', (req, res) => {
  if (req.headers['content-encoding'] === 'gzip') {
    // Decompress the binary payload
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const decompressed = gunzipSync(buffer);
      const data = JSON.parse(decompressed.toString('utf-8'));
      
      // Process the bug report
      console.log('Received bug:', data);
      res.json({ success: true });
    });
  } else {
    // Handle uncompressed JSON
    express.json()(req, res, () => {
      console.log('Received bug:', req.body);
      res.json({ success: true });
    });
  }
});
```

### Python / Flask

```python
from flask import Flask, request
import gzip
import json

app = Flask(__name__)

@app.route('/bugs', methods=['POST'])
def receive_bug():
    if request.headers.get('Content-Encoding') == 'gzip':
        # Decompress the payload
        compressed = request.get_data()
        decompressed = gzip.decompress(compressed)
        data = json.loads(decompressed.decode('utf-8'))
    else:
        # Handle uncompressed JSON
        data = request.get_json()
    
    print('Received bug:', data)
    return {'success': True}
```

## Advanced Usage

### Manual Compression

```typescript
import { 
  compressData, 
  decompressData, 
  estimateSize, 
  getCompressionRatio 
} from '@bugspotter/sdk';

// Measure compression effectiveness
const data = { large: 'object', with: 'many', fields: true };
const originalSize = estimateSize(data);

const compressed = await compressData(data, { gzipLevel: 9 });
const compressedSize = compressed.byteLength;

const ratio = getCompressionRatio(originalSize, compressedSize);
console.log(`Compression: ${originalSize} → ${compressedSize} bytes (${ratio}% reduction)`);

// Verify round-trip
const decompressed = await decompressData(compressed);
console.log('Matches original:', JSON.stringify(data) === JSON.stringify(decompressed));
```

### Testing Compression

```typescript
import { describe, it, expect } from 'vitest';
import { compressData, decompressData } from '@bugspotter/sdk';

describe('Compression', () => {
  it('should compress and decompress data', async () => {
    const original = { test: 'data', nested: { value: 123 } };
    const compressed = await compressData(original);
    const decompressed = await decompressData(compressed);
    
    expect(decompressed).toEqual(original);
    expect(compressed.byteLength).toBeLessThan(JSON.stringify(original).length);
  });
});
```

## Error Handling

The compression layer handles errors gracefully:

```typescript
try {
  const compressed = await compressData(veryLargeObject);
} catch (error) {
  console.error('Compression failed:', error);
  // SDK automatically falls back to uncompressed upload
}
```

**Built-in safeguards:**
- ✅ Automatic fallback to uncompressed data
- ✅ Descriptive error messages with context
- ✅ Optional verbose logging for debugging
- ✅ Timeout protection for image compression

## Best Practices

1. **Let the SDK handle it** - Compression is automatic in `submitBugReport()`
2. **Don't compress twice** - Avoid manually compressing already-compressed data
3. **Monitor ratios** - Check console logs for compression effectiveness
4. **Configure for your use case** - Tune gzip level based on speed vs. size needs
5. **Handle both formats** - Backend should support compressed and uncompressed payloads

## Troubleshooting

### "Compression failed" warnings

The SDK automatically falls back to uncompressed upload. Check:
- Data is JSON-serializable
- No circular references (should be handled automatically)
- Sufficient memory available

### Large payloads still slow

Even with 80% compression, a 50 MB payload is still 10 MB. Consider:
- Reducing screenshot resolution further
- Limiting console log count
- Truncating long network responses
- Implementing pagination for large datasets

### Backend not decompressing

Verify:
- `Content-Encoding: gzip` header is sent
- Backend has gzip decompression middleware
- Binary payload handling is enabled (not just JSON parsing)

## Implementation Details

### Architecture

```
┌─────────────────┐
│  Bug Report     │
│  Payload        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  estimateSize() │ ──► Original: 7.1 KB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  compressData() │ ──► Uses pako.gzip() with level 6
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Uint8Array     │ ──► Compressed: 867 bytes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  new Blob()     │ ──► Binary upload with gzip headers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  fetch() POST   │ ──► Content-Encoding: gzip
└─────────────────┘
```

### Performance Optimizations

- **Singleton TextEncoder/Decoder** - Reused across compressions
- **Cached WebP support detection** - Checked once per session
- **Direct Uint8Array handling** - No unnecessary array copies
- **Lazy loading** - Pako only loaded when compression is used

## Related Documentation

- [Tech Stack](../TECH_STACK.md) - Pako library details
- [Architecture](../ARCHITECTURE.md) - Overall system design
- [API Testing](../guides/API_TESTING.md) - Testing compressed payloads

---

**Last Updated:** October 6, 2025
**Library:** pako@2.1.0
**Status:** ✅ Production Ready
