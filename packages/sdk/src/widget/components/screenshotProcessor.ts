/**
 * ScreenshotProcessor
 * 
 * Responsibility: Handle screenshot image processing and manipulation
 * Follows SRP: Only handles image-related operations
 */

import type { RedactionRect } from './redactionCanvas';

export class ScreenshotProcessor {
  /**
   * Merge redaction canvas with original screenshot
   */
  async mergeRedactions(
    originalDataUrl: string,
    redactionCanvas: HTMLCanvasElement
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const mergedCanvas = document.createElement('canvas');
          mergedCanvas.width = img.naturalWidth || img.width;
          mergedCanvas.height = img.naturalHeight || img.height;
          
          const ctx = mergedCanvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Draw redaction canvas on top
          ctx.drawImage(redactionCanvas, 0, 0);
          
          resolve(mergedCanvas.toDataURL());
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load screenshot image'));
      };
      
      img.src = originalDataUrl;
    });
  }

  /**
   * Apply redaction rectangles directly to an image data URL
   */
  async applyRedactions(
    imageDataUrl: string,
    redactions: RedactionRect[],
    redactionColor: string = '#000000'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Apply redactions
          ctx.fillStyle = redactionColor;
          for (const rect of redactions) {
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
          }
          
          resolve(canvas.toDataURL());
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageDataUrl;
    });
  }

  /**
   * Resize an image to maximum dimensions while maintaining aspect ratio
   */
  async resize(
    imageDataUrl: string,
    maxWidth: number,
    maxHeight: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = maxWidth;
              height = width / aspectRatio;
            } else {
              height = maxHeight;
              width = height * aspectRatio;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL());
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageDataUrl;
    });
  }

  /**
   * Convert image to different format
   */
  async convert(
    imageDataUrl: string,
    format: 'image/png' | 'image/jpeg' | 'image/webp',
    quality: number = 0.92
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL(format, quality));
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageDataUrl;
    });
  }

  /**
   * Get image dimensions from data URL
   */
  async getDimensions(imageDataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageDataUrl;
    });
  }

  /**
   * Validate if a string is a valid data URL
   */
  isValidDataURL(dataUrl: string): boolean {
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(dataUrl);
  }

  /**
   * Get file size estimate from data URL (in bytes)
   */
  getEstimatedSize(dataUrl: string): number {
    // Base64 encoding increases size by ~33%
    // Remove the data URL prefix to get just the base64 data
    const base64Data = dataUrl.split(',')[1] || '';
    return Math.ceil((base64Data.length * 3) / 4);
  }

  /**
   * Get format from data URL
   */
  getFormat(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:image\/([a-z]+);base64,/);
    return match ? match[1] : null;
  }
}
