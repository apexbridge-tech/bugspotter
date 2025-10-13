/**
 * Screenshot Worker
 * Processes screenshot jobs: download, optimize, create thumbnail, upload
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import sharp from 'sharp';
import { getLogger } from '../../logger.js';
import { getQueueConfig } from '../../config/queue.config.js';
import type { DatabaseClient } from '../../db/client.js';
import type { BaseStorageService } from '../../storage/base-storage-service.js';
import type { ScreenshotJobData, ScreenshotJobResult } from '../types.js';
import { validateScreenshotJobData, createScreenshotJobResult } from '../jobs/screenshot-job.js';
import type { BaseWorker } from './base-worker.js';
import { createBaseWorkerWrapper } from './base-worker.js';
import { attachStandardEventHandlers } from './worker-events.js';
import { ProgressTracker } from './progress-tracker.js';
import { createWorker } from './worker-factory.js';

const logger = getLogger();

/**
 * Create and initialize the Screenshot worker
 */
export function createScreenshotWorker(
  db: DatabaseClient,
  storage: BaseStorageService,
  connection: Redis
): BaseWorker<ScreenshotJobData, ScreenshotJobResult, 'screenshot'> {
  /**
   * Process screenshot job
   */
  async function processScreenshot(job: Job<ScreenshotJobData>): Promise<ScreenshotJobResult> {
    const startTime = Date.now();
    const { bugReportId, projectId, screenshotUrl } = job.data;

    // Validate job data
    if (!validateScreenshotJobData(job.data)) {
      throw new Error('Invalid screenshot job data');
    }

    logger.info('Processing screenshot', {
      jobId: job.id,
      bugReportId,
      projectId,
      screenshotUrl,
    });

    try {
      const progress = new ProgressTracker(job, 4);

      // Step 1: Download
      await progress.update(1, 'Downloading original');
      const originalBuffer = await downloadScreenshot(screenshotUrl);

      // Get image metadata
      const metadata = await getImageMetadata(originalBuffer);
      const originalSize = originalBuffer.length;

      // Step 2: Optimize
      await progress.update(2, 'Optimizing image');
      const config = getQueueConfig();
      const optimizedBuffer = await optimizeScreenshot(originalBuffer, config.screenshot.quality);

      // Step 3: Create thumbnail
      await progress.update(3, 'Creating thumbnail');
      const thumbnailBuffer = await createThumbnail(
        originalBuffer,
        config.screenshot.thumbnailWidth,
        config.screenshot.thumbnailHeight
      );

      const thumbnailSize = thumbnailBuffer.length;

      // Step 4: Upload
      await progress.complete('Uploading');

      // Upload optimized original
      const originalResult = await storage.uploadScreenshot(
        projectId,
        bugReportId,
        optimizedBuffer
      );

      // Upload thumbnail (store in metadata for now, could add uploadThumbnail method)
      const thumbnailResult = await storage.uploadScreenshot(
        projectId,
        `${bugReportId}-thumb`,
        thumbnailBuffer
      );

      // Update database with thumbnail URL
      await db.bugReports.updateThumbnailUrl(bugReportId, thumbnailResult.url);

      const processingTimeMs = Date.now() - startTime;

      logger.info('Screenshot processed successfully', {
        jobId: job.id,
        bugReportId,
        originalSize,
        thumbnailSize,
        processingTimeMs,
      });

      return createScreenshotJobResult(originalResult.url, thumbnailResult.url, {
        originalSize: optimizedBuffer.length,
        thumbnailSize,
        width: metadata.width || 0,
        height: metadata.height || 0,
        processingTimeMs,
      });
    } catch (error) {
      logger.error('Screenshot processing error', {
        jobId: job.id,
        bugReportId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get image metadata (dimensions, format, etc.)
   */
  async function getImageMetadata(buffer: Buffer) {
    return await sharp(buffer).metadata();
  }

  /**
   * Optimize screenshot with specified quality
   */
  async function optimizeScreenshot(buffer: Buffer, quality: number): Promise<Buffer> {
    return await sharp(buffer).jpeg({ quality }).toBuffer();
  }

  /**
   * Create thumbnail with specified dimensions
   */
  async function createThumbnail(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  /**
   * Download screenshot from storage
   */
  async function downloadScreenshot(url: string): Promise<Buffer> {
    // Extract key from URL
    const key = url.includes('://') ? new URL(url).pathname.substring(1) : url;

    // Download from storage
    const stream = await storage.getObject(key);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  // Create worker using factory with custom rate limiting
  const worker = createWorker<ScreenshotJobData, ScreenshotJobResult, 'screenshot'>({
    name: 'screenshot' as const,
    processor: processScreenshot,
    connection,
    workerType: 'screenshot',
    customOptions: {
      limiter: {
        max: 10,
        duration: 1000, // 10 jobs per second max
      },
    },
  });

  // Attach standard event handlers with job-specific context
  attachStandardEventHandlers(worker, 'Screenshot', (data, result) => ({
    bugReportId: data.bugReportId,
    projectId: data.projectId,
    originalSize: result?.originalSize,
    thumbnailSize: result?.thumbnailSize,
    processingTimeMs: result?.processingTimeMs,
  }));

  logger.info('Screenshot worker started');

  // Return wrapped worker that implements BaseWorker interface
  return createBaseWorkerWrapper(worker, 'Screenshot');
}
