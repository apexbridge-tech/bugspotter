/**
 * Screenshot Worker
 * Processes screenshot jobs: download, optimize, create thumbnail, upload
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import sharp from 'sharp';
import { getLogger } from '../../logger.js';
import { getQueueConfig } from '../../config/queue.config.js';
import type { BugReportRepository } from '../../db/repositories.js';
import type { IStorageService } from '../../storage/types.js';
import type { ScreenshotJobData, ScreenshotJobResult } from '../types.js';
import { QUEUE_NAMES } from '../types.js';
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
  bugReportRepo: BugReportRepository,
  storage: IStorageService,
  connection: Redis
): BaseWorker<ScreenshotJobData, ScreenshotJobResult, 'screenshots'> {
  /**
   * Handle idempotent retry: reuse existing files and fetch actual metrics from storage
   */
  async function handleRetry(
    projectId: string,
    bugReportId: string,
    screenshotData: string,
    existingScreenshotUrl: string,
    existingThumbnailUrl: string
  ) {
    // Decode original data to get dimensions
    const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
    const originalBuffer = Buffer.from(base64Data, 'base64');
    const imageMetadata = await getImageMetadata(originalBuffer);

    // Fetch actual file sizes from storage metadata
    const originalKey = `screenshots/${projectId}/${bugReportId}/original.png`;
    const thumbnailKey = `screenshots/${projectId}/${bugReportId}-thumb/original.png`;

    const [originalMetadata, thumbnailMetadata] = await Promise.all([
      storage.headObject(originalKey),
      storage.headObject(thumbnailKey),
    ]);

    // Use actual storage sizes, fallback to estimates only if metadata unavailable
    const originalSize = originalMetadata?.size ?? originalBuffer.length;
    const thumbnailSize = thumbnailMetadata?.size ?? Math.round(originalSize * 0.15);

    return {
      originalUrl: existingScreenshotUrl,
      thumbnailUrl: existingThumbnailUrl,
      originalSize,
      thumbnailSize,
      imageMetadata,
    };
  }

  /**
   * Process and upload screenshots on first attempt
   */
  async function processAndUploadScreenshots(
    job: Job<ScreenshotJobData>,
    projectId: string,
    bugReportId: string,
    screenshotData: string
  ) {
    const progress = new ProgressTracker(job, 4);

    // Step 1: Decode base64 data URL
    await progress.update(1, 'Decoding screenshot');
    const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
    const originalBuffer = Buffer.from(base64Data, 'base64');

    // Get image metadata
    const imageMetadata = await getImageMetadata(originalBuffer);

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

    // Step 4: Upload
    await progress.complete('Uploading');

    // Upload optimized original
    const originalResult = await storage.uploadScreenshot(projectId, bugReportId, optimizedBuffer);

    // Upload thumbnail
    const thumbnailResult = await storage.uploadScreenshot(
      projectId,
      `${bugReportId}-thumb`,
      thumbnailBuffer
    );

    // Update database with both URLs atomically
    // This is the critical operation that might fail - if it does, the next retry
    // will skip upload and reuse the existing files (idempotent behavior)
    await bugReportRepo.updateScreenshotUrls(bugReportId, originalResult.url, thumbnailResult.url);

    return {
      originalUrl: originalResult.url,
      thumbnailUrl: thumbnailResult.url,
      originalSize: optimizedBuffer.length,
      thumbnailSize: thumbnailBuffer.length,
      imageMetadata,
    };
  }

  /**
   * Process screenshot job
   */
  async function processScreenshot(job: Job<ScreenshotJobData>): Promise<ScreenshotJobResult> {
    const startTime = Date.now();
    const { bugReportId, projectId, screenshotData } = job.data;

    // Validate job data
    if (!validateScreenshotJobData(job.data)) {
      throw new Error('Invalid screenshot job data');
    }

    logger.info('Processing screenshot', {
      jobId: job.id,
      bugReportId,
      projectId,
    });

    try {
      // Check if files already uploaded from previous retry attempt
      const existingReport = await bugReportRepo.findById(bugReportId);
      const existingThumbnailUrl = existingReport?.metadata?.thumbnailUrl as string | undefined;

      let result;

      if (existingReport?.screenshot_url && existingThumbnailUrl) {
        // Idempotent retry: Files already uploaded, reuse existing URLs
        logger.info('Reusing uploaded screenshots from previous retry', {
          jobId: job.id,
          bugReportId,
          attemptNumber: job.attemptsMade,
        });

        result = await handleRetry(
          projectId,
          bugReportId,
          screenshotData,
          existingReport.screenshot_url,
          existingThumbnailUrl
        );
      } else {
        // First attempt: Process and upload screenshots
        result = await processAndUploadScreenshots(job, projectId, bugReportId, screenshotData);
      }

      const processingTimeMs = Date.now() - startTime;

      logger.info('Screenshot processed successfully', {
        jobId: job.id,
        bugReportId,
        originalSize: result.originalSize,
        thumbnailSize: result.thumbnailSize,
        processingTimeMs,
      });

      return createScreenshotJobResult(result.originalUrl, result.thumbnailUrl, {
        originalSize: result.originalSize,
        thumbnailSize: result.thumbnailSize,
        width: result.imageMetadata.width ?? 0,
        height: result.imageMetadata.height ?? 0,
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

  // Create worker using factory with custom rate limiting
  const worker = createWorker<
    ScreenshotJobData,
    ScreenshotJobResult,
    typeof QUEUE_NAMES.SCREENSHOTS
  >({
    name: QUEUE_NAMES.SCREENSHOTS,
    processor: processScreenshot,
    connection,
    workerType: QUEUE_NAMES.SCREENSHOTS,
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
