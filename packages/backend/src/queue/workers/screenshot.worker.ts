/**
 * Screenshot Worker
 * Processes screenshot jobs: download, optimize, create thumbnail, upload
 */

import { Worker, Job } from 'bullmq';
import sharp from 'sharp';
import { getLogger } from '../../logger.js';
import { getQueueConfig } from '../../config/queue.config.js';
import type { DatabaseClient } from '../../db/client.js';
import type { BaseStorageService } from '../../storage/base-storage-service.js';
import type { ScreenshotJobData, ScreenshotJobResult } from '../types.js';
import { validateScreenshotJobData, createScreenshotJobResult } from '../jobs/screenshot.job.js';

const logger = getLogger();

export class ScreenshotWorker {
  private worker: Worker<ScreenshotJobData, ScreenshotJobResult, 'screenshot'>;

  constructor(
    private db: DatabaseClient,
    private storage: BaseStorageService,
    connection: any
  ) {
    const config = getQueueConfig();

    this.worker = new Worker<ScreenshotJobData, ScreenshotJobResult, 'screenshot'>(
      'screenshots',
      async (job: Job<ScreenshotJobData>) => {
        return await this.processScreenshot(job);
      },
      {
        connection,
        concurrency: config.workers.screenshot.concurrency,
        limiter: {
          max: 10,
          duration: 1000, // 10 jobs per second max
        },
      }
    );

    // Set up event listeners
    this.worker.on('completed', (job) => {
      logger.info('Screenshot job completed', {
        jobId: job.id,
        bugReportId: job.data.bugReportId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Screenshot job failed', {
        jobId: job?.id,
        bugReportId: job?.data?.bugReportId,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    logger.info('Screenshot worker initialized', {
      concurrency: config.workers.screenshot.concurrency,
    });
  }

  /**
   * Process screenshot job
   */
  private async processScreenshot(job: Job<ScreenshotJobData>): Promise<ScreenshotJobResult> {
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
      // Update progress: downloading
      await job.updateProgress({
        current: 1,
        total: 4,
        percentage: 25,
        message: 'Downloading original',
      });

      // Download original screenshot
      const originalBuffer = await this.downloadScreenshot(screenshotUrl);

      // Get image metadata
      const metadata = await sharp(originalBuffer).metadata();
      const originalSize = originalBuffer.length;

      // Update progress: optimizing
      await job.updateProgress({
        current: 2,
        total: 4,
        percentage: 50,
        message: 'Optimizing image',
      });

      // Optimize original (if needed)
      const config = getQueueConfig();
      const optimizedBuffer = await sharp(originalBuffer)
        .jpeg({ quality: config.screenshot.quality })
        .toBuffer();

      // Update progress: creating thumbnail
      await job.updateProgress({
        current: 3,
        total: 4,
        percentage: 75,
        message: 'Creating thumbnail',
      });

      // Create thumbnail
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(config.screenshot.thumbnailWidth, config.screenshot.thumbnailHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailSize = thumbnailBuffer.length;

      // Update progress: uploading
      await job.updateProgress({ current: 4, total: 4, percentage: 100, message: 'Uploading' });

      // Upload optimized original
      const originalResult = await this.storage.uploadScreenshot(
        projectId,
        bugReportId,
        optimizedBuffer
      );

      // Upload thumbnail (store in metadata for now, could add uploadThumbnail method)
      const thumbnailResult = await this.storage.uploadScreenshot(
        projectId,
        `${bugReportId}-thumb`,
        thumbnailBuffer
      );

      // Update database with thumbnail URL
      await this.updateBugReportThumbnail(bugReportId, thumbnailResult.url);

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
   * Download screenshot from storage
   */
  private async downloadScreenshot(url: string): Promise<Buffer> {
    // Extract key from URL
    const key = url.includes('://') ? new URL(url).pathname.substring(1) : url;

    // Download from storage
    const stream = await this.storage.getObject(key);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Update bug report with thumbnail URL
   */
  private async updateBugReportThumbnail(bugReportId: string, thumbnailUrl: string): Promise<void> {
    const query = `
      UPDATE bug_reports
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{thumbnailUrl}',
        $1::jsonb,
        true
      )
      WHERE id = $2
    `;

    await this.db.query(query, [JSON.stringify(thumbnailUrl), bugReportId]);
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    logger.info('Screenshot worker closed');
  }

  /**
   * Get the internal BullMQ worker (for event handling and pause/resume)
   */
  getWorker(): Worker<ScreenshotJobData, ScreenshotJobResult, 'screenshot'> {
    return this.worker;
  }
}
