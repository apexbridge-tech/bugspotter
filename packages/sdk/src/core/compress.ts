import pako from 'pako';

/**
 * Compression utilities for reducing payload sizes
 * Uses gzip compression with balanced speed/size ratio
 */

/**
 * Compress JSON or string data using gzip
 * @param data - Data to compress (will be JSON stringified if object)
 * @returns Compressed data as Uint8Array
 */
export async function compressData(data: unknown): Promise<Uint8Array> {
  try {
    // Convert data to string if it's an object
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const uint8Data = encoder.encode(jsonString);
    
    // Compress with gzip (level 6 = balanced speed/size)
    const compressed = pako.gzip(uint8Data, { level: 6 });
    
    // Return as standard Uint8Array (not tied to any specific buffer)
    return new Uint8Array(compressed);
  } catch (error) {
    console.error('Compression failed:', error);
    throw error;
  }
}

/**
 * Decompress gzipped data back to original format
 * Useful for testing and verification
 * @param compressed - Compressed Uint8Array data
 * @returns Decompressed and parsed data (or string if input was string)
 */
export function decompressData(compressed: Uint8Array): unknown {
  try {
    // Decompress
    const decompressed = pako.ungzip(compressed);
    
    // Convert Uint8Array back to string
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decompressed);
    
    // Try to parse as JSON, but if it fails, return the string
    try {
      return JSON.parse(jsonString);
    } catch {
      // If not valid JSON, return as string (for plain text compression)
      return jsonString;
    }
  } catch (error) {
    console.error('Decompression failed:', error);
    throw error;
  }
}

/**
 * Optimize and compress screenshot image
 * Converts to WebP if supported, resizes if too large, then compresses
 * @param base64 - Base64 encoded image (PNG or other format)
 * @returns Optimized base64 image string
 */
export async function compressImage(base64: string): Promise<string> {
  try {
    // If not in browser environment, return as-is
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return base64;
    }

    // If Canvas is not available (e.g., test environment), return as-is
    if (typeof HTMLCanvasElement === 'undefined') {
      return base64;
    }

    // Create image element to get dimensions
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 3000); // 3 second timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load image'));
      };
      img.src = base64;
    });

    // Create canvas for optimization
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Resize if image is too large (max width 1920px)
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;
    let { width, height } = img;

    if (width > MAX_WIDTH) {
      height = (height * MAX_WIDTH) / width;
      width = MAX_WIDTH;
    }

    if (height > MAX_HEIGHT) {
      width = (width * MAX_HEIGHT) / height;
      height = MAX_HEIGHT;
    }

    canvas.width = width;
    canvas.height = height;

    // Draw resized image
    ctx.drawImage(img, 0, 0, width, height);

    // Try to convert to WebP (better compression)
    // Check if browser supports WebP
    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;

    if (supportsWebP) {
      // Use WebP with 80% quality for good balance
      return canvas.toDataURL('image/webp', 0.8);
    } else {
      // Fall back to JPEG with 85% quality
      return canvas.toDataURL('image/jpeg', 0.85);
    }
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original if compression fails
    return base64;
  }
}

/**
 * Calculate compression ratio for analytics
 * @param original - Original data size in bytes
 * @param compressed - Compressed data size in bytes
 * @returns Compression ratio as percentage
 */
export function getCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.round((1 - compressed / original) * 100);
}

/**
 * Estimate payload size before compression
 * @param data - Data to estimate
 * @returns Estimated size in bytes
 */
export function estimateSize(data: unknown): number {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  return new TextEncoder().encode(jsonString).length;
}
