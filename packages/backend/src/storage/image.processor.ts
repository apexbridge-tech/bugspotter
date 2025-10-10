/**
 * Image processing utilities using Sharp
 * Handles thumbnail generation, optimization, and validation
 */

import sharp from 'sharp';
import type { ImageMetadata } from './types.js';
import { StorageValidationError } from './types.js';
import {
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGE_SIZE_BYTES,
  MAX_DIMENSION,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_QUALITY,
  WEBP_QUALITY,
  JPEG_QUALITY,
  SUPPORTED_FORMATS,
  type SupportedFormat,
} from './constants.js';

// ============================================================================
// OPTIMIZATION CONSTANTS
// ============================================================================

/**
 * Minimum size reduction percentage to prefer WebP over original format
 * 0.9 = 10% savings required (WebP must be at least 10% smaller)
 */
const WEBP_SIZE_THRESHOLD = 0.9;

// ============================================================================
// OPTIMIZATION HELPERS (Single Responsibility Principle)
// ============================================================================

/**
 * Resize image if dimensions exceed maximum allowed size
 * @param image - Sharp instance
 * @param width - Current width
 * @param height - Current height
 * @returns Same Sharp instance (for chaining)
 */
function resizeIfNeeded(
  image: sharp.Sharp,
  width: number | undefined,
  height: number | undefined
): sharp.Sharp {
  if (width && height && (width > MAX_DIMENSION || height > MAX_DIMENSION)) {
    image.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return image;
}

/**
 * Attempt WebP conversion for potential size savings
 * @param image - Sharp instance
 * @returns WebP buffer or null if conversion fails
 */
async function tryWebPConversion(image: sharp.Sharp): Promise<Buffer | null> {
  try {
    return await image.clone().webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  } catch {
    return null;
  }
}

/**
 * Check if WebP buffer provides sufficient size savings
 * @param webpSize - Size of WebP buffer
 * @param originalSize - Size of original buffer
 * @returns true if WebP is at least 10% smaller
 */
function isWebPBeneficial(webpSize: number, originalSize: number): boolean {
  return webpSize < originalSize * WEBP_SIZE_THRESHOLD;
}

/**
 * Optimize image in its original format with best compression settings
 * @param image - Sharp instance
 * @param format - Image format
 * @returns Optimized buffer in original format
 */
async function optimizeInOriginalFormat(
  image: sharp.Sharp,
  format: SupportedFormat
): Promise<Buffer> {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return await image.jpeg({ quality: JPEG_QUALITY, progressive: true }).toBuffer();
    case 'png':
      return await image.png({ compressionLevel: 9, progressive: true }).toBuffer();
    case 'webp':
      return await image.webp({ quality: WEBP_QUALITY }).toBuffer();
    default:
      // For other formats (GIF, SVG), convert to preserve stripped metadata
      return await image.toBuffer();
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a thumbnail from an image buffer
 * @param buffer - Original image buffer
 * @param maxWidth - Maximum thumbnail width (default: 200)
 * @param maxHeight - Maximum thumbnail height (default: 200)
 * @returns Optimized thumbnail buffer
 */
export async function generateThumbnail(
  buffer: Buffer,
  maxWidth: number = THUMBNAIL_MAX_WIDTH,
  maxHeight: number = THUMBNAIL_MAX_HEIGHT
): Promise<Buffer> {
  try {
    const thumbnail = await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY, progressive: true })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    throw new StorageValidationError(
      `Failed to generate thumbnail: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Optimize an image for storage
 * - Converts to WebP if beneficial (>10% size reduction)
 * - Compresses JPEG/PNG with quality settings
 * - Strips metadata for privacy (automatic in Sharp)
 * - Limits dimensions to reasonable size
 *
 * Uses helper functions for each optimization step (SRP)
 *
 * @param buffer - Original image buffer
 * @returns Optimized image buffer
 */
export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize if dimensions exceed limits (delegates to helper)
    resizeIfNeeded(image, metadata.width, metadata.height);

    // Attempt WebP conversion for size savings (metadata stripped automatically)
    const webpBuffer = await tryWebPConversion(image);
    if (webpBuffer && isWebPBeneficial(webpBuffer.length, buffer.length)) {
      return webpBuffer;
    }

    // Otherwise optimize in original format (delegates to helper)
    const format = metadata.format as SupportedFormat;
    return await optimizeInOriginalFormat(image, format);
  } catch (error) {
    throw new StorageValidationError(
      `Failed to optimize image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract metadata from an image buffer
 * @param buffer - Image buffer
 * @returns Image metadata
 */
export async function extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new StorageValidationError('Invalid image: missing required metadata');
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size ?? buffer.length,
      hasAlpha: metadata.hasAlpha ?? false,
      space: metadata.space,
    };
  } catch (error) {
    if (error instanceof StorageValidationError) {
      throw error;
    }
    throw new StorageValidationError(
      `Failed to extract image metadata: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// VALIDATION HELPERS (Single Responsibility Principle)
// ============================================================================

/**
 * Convert bytes to megabytes for display
 */
function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Validate buffer is not empty and within size limits
 * @throws StorageValidationError if buffer is invalid
 */
function validateBufferSize(buffer: Buffer): void {
  if (buffer.length === 0) {
    throw new StorageValidationError('Image buffer is empty');
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new StorageValidationError(
      `Image size exceeds ${MAX_IMAGE_SIZE_MB}MB limit (${bytesToMB(buffer.length).toFixed(2)}MB)`
    );
  }
}

/**
 * Validate image format is supported
 * @throws StorageValidationError if format is unsupported
 */
function validateImageFormat(format: string): void {
  if (!SUPPORTED_FORMATS.includes(format as SupportedFormat)) {
    throw new StorageValidationError(
      `Invalid image format: ${format}. Supported: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }
}

/**
 * Validate image dimensions are within acceptable range
 * @throws StorageValidationError if dimensions are invalid
 */
function validateImageDimensions(width: number, height: number): void {
  // Check minimum dimensions
  if (width < 1 || height < 1) {
    throw new StorageValidationError('Image dimensions must be at least 1x1');
  }

  // Check maximum dimensions
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new StorageValidationError(
      `Image dimensions exceed ${MAX_DIMENSION}px limit (${width}x${height})`
    );
  }
}

/**
 * Handle metadata extraction errors
 * @throws StorageValidationError with appropriate message
 */
function handleMetadataError(error: unknown): never {
  if (error instanceof StorageValidationError) {
    throw error;
  }

  const errorMsg = error instanceof Error ? error.message : String(error);
  if (errorMsg.includes('unsupported image format')) {
    throw new StorageValidationError('Invalid image format');
  }

  throw new StorageValidationError(`Invalid image format: ${errorMsg}`);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate an image buffer
 * - Checks if it's a valid image
 * - Verifies format is supported
 * - Ensures size is within limits
 * - Validates dimensions
 *
 * Uses helper functions for each validation step (SRP)
 *
 * @param buffer - Image buffer to validate
 * @throws StorageValidationError if validation fails
 */
export async function validateImage(buffer: Buffer): Promise<void> {
  // Validate buffer size first (fast check)
  validateBufferSize(buffer);

  // Extract metadata and validate (delegates to helper functions)
  try {
    const metadata = await extractMetadata(buffer);

    validateImageFormat(metadata.format);
    validateImageDimensions(metadata.width, metadata.height);
  } catch (error) {
    handleMetadataError(error);
  }
}

// ============================================================================
// FORMAT DETECTION HELPERS (DRY + Named Constants)
// ============================================================================

/**
 * Magic number signatures for image format detection
 * Each format has: required bytes, signature pattern, format name
 */
const FORMAT_SIGNATURES = {
  JPEG: {
    minBytes: 3,
    signature: [0xff, 0xd8, 0xff], // FF D8 FF
    format: 'jpeg' as const,
  },
  PNG: {
    minBytes: 8,
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // 89 50 4E 47 0D 0A 1A 0A
    format: 'png' as const,
  },
  WEBP: {
    minBytes: 12,
    // RIFF....WEBP - check positions 0-3 and 8-11
    signature: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    format: 'webp' as const,
  },
  GIF: {
    minBytes: 6,
    // GIF87a or GIF89a - position 4 can be 0x37 or 0x39
    signature: [0x47, 0x49, 0x46, 0x38, [0x37, 0x39], 0x61],
    format: 'gif' as const,
  },
} as const;

/**
 * Check if buffer matches a signature pattern
 * Supports null (skip position) and array (multiple valid values)
 */
function matchesSignature(
  buffer: Buffer,
  signature: ReadonlyArray<number | null | readonly number[]>
): boolean {
  for (let i = 0; i < signature.length; i++) {
    const expected = signature[i];

    // null means skip this position (WebP has variable bytes 4-7)
    if (expected === null) {
      continue;
    }

    // Array means any of these values is valid (GIF can be 87a or 89a)
    if (Array.isArray(expected)) {
      if (!expected.includes(buffer[i])) {
        return false;
      }
      continue;
    }

    // Single value must match exactly
    if (buffer[i] !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Detect SVG format from text content
 * SVG is XML-based, so we check for '<svg' or '<?xml' + 'svg'
 */
function detectSVG(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }

  const text = buffer.slice(0, 100).toString('utf8');
  return text.includes('<svg') || (text.includes('<?xml') && text.includes('svg'));
}

/**
 * Validate image format from buffer (quick check without full parsing)
 * Uses magic number detection for binary formats and text detection for SVG
 *
 * @param buffer - Image buffer
 * @returns Format name or null if not recognized
 */
export function detectImageFormat(buffer: Buffer): string | null {
  // Check binary formats using magic numbers (JPEG, PNG, WebP, GIF)
  for (const { minBytes, signature, format } of Object.values(FORMAT_SIGNATURES)) {
    if (buffer.length >= minBytes && matchesSignature(buffer, signature)) {
      return format;
    }
  }

  // Check text-based format (SVG)
  if (detectSVG(buffer)) {
    return 'svg';
  }

  return null;
}

/**
 * Check if buffer is a valid image by detecting format
 * @param buffer - Buffer to check
 * @returns true if buffer appears to be an image
 */
export function isImage(buffer: Buffer): boolean {
  return detectImageFormat(buffer) !== null;
}
