/**
 * Image processing utilities using Sharp
 * Handles thumbnail generation, optimization, and validation
 */

import sharp from 'sharp';
import type { ImageMetadata } from './types.js';
import { StorageValidationError } from './types.js';

// Configuration constants
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_DIMENSION = 4096; // Max width or height
const THUMBNAIL_MAX_WIDTH = 200;
const THUMBNAIL_MAX_HEIGHT = 200;
const THUMBNAIL_QUALITY = 80;
const WEBP_QUALITY = 85;
const JPEG_QUALITY = 90;

// Supported image formats
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

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
 * - Converts to WebP if beneficial (smaller size)
 * - Compresses JPEG/PNG with quality settings
 * - Strips metadata for privacy
 * - Limits dimensions to reasonable size
 *
 * @param buffer - Original image buffer
 * @returns Optimized image buffer
 */
export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Validate dimensions
    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION)
    ) {
      // Resize if too large
      image.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Strip all metadata for privacy (EXIF, GPS, etc.)
    image.withMetadata({
      exif: {},
      icc: undefined,
    });

    // Try WebP conversion for potential size savings
    const webpBuffer = await image
      .clone()
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    // Use WebP if it's smaller than original
    if (webpBuffer.length < buffer.length * 0.9) {
      return webpBuffer;
    }

    // Otherwise optimize in original format
    const format = metadata.format as SupportedFormat;
    switch (format) {
      case 'jpeg':
      case 'jpg':
        return await image.jpeg({ quality: JPEG_QUALITY, progressive: true }).toBuffer();
      case 'png':
        return await image.png({ compressionLevel: 9, progressive: true }).toBuffer();
      case 'webp':
        return await image.webp({ quality: WEBP_QUALITY }).toBuffer();
      default:
        // For other formats, just strip metadata
        return await image.toBuffer();
    }
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

/**
 * Validate an image buffer
 * - Checks if it's a valid image
 * - Verifies format is supported
 * - Ensures size is within limits
 * - Validates dimensions
 *
 * @param buffer - Image buffer to validate
 * @throws StorageValidationError if validation fails
 */
export async function validateImage(buffer: Buffer): Promise<void> {
  // Check buffer size
  if (buffer.length === 0) {
    throw new StorageValidationError('Image buffer is empty');
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new StorageValidationError(
      `Image size exceeds ${MAX_IMAGE_SIZE_MB}MB limit (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  try {
    const metadata = await extractMetadata(buffer);

    // Validate format
    if (!SUPPORTED_FORMATS.includes(metadata.format as SupportedFormat)) {
      throw new StorageValidationError(
        `Unsupported image format: ${metadata.format}. Supported: ${SUPPORTED_FORMATS.join(', ')}`
      );
    }

    // Validate dimensions
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new StorageValidationError(
        `Image dimensions exceed ${MAX_DIMENSION}px limit (${metadata.width}x${metadata.height})`
      );
    }

    // Validate minimum size (at least 1x1)
    if (metadata.width < 1 || metadata.height < 1) {
      throw new StorageValidationError('Image dimensions must be at least 1x1');
    }
  } catch (error) {
    if (error instanceof StorageValidationError) {
      throw error;
    }
    throw new StorageValidationError(
      `Invalid image format: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate image format from buffer (quick check without full parsing)
 * @param buffer - Image buffer
 * @returns Format name or null if not recognized
 */
export function detectImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG magic number: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP magic number: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  // GIF magic number: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'gif';
  }

  // SVG (text-based, check for '<svg' or '<?xml')
  const text = buffer.slice(0, 100).toString('utf8');
  if (text.includes('<svg') || (text.includes('<?xml') && text.includes('svg'))) {
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
