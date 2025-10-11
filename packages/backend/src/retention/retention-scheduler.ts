/**
 * Retention Scheduler
 * Schedules and executes retention policy jobs using node-cron
 */

import cron from 'node-cron';
import { getLogger } from '../logger.js';
import type { RetentionService } from './retention-service.js';
import {
  RETENTION_CRON_SCHEDULE,
  RETENTION_SCHEDULER_ENABLED,
  RETENTION_CRON_TIMEZONE,
} from './retention-config.js';

const logger = getLogger();

/**
 * Retention scheduler for automated cleanup
 */
export class RetentionScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(private retentionService: RetentionService) {}

  /**
   * Start the retention scheduler
   */
  start(): void {
    if (!RETENTION_SCHEDULER_ENABLED) {
      logger.info('Retention scheduler is disabled');
      return;
    }

    if (this.task) {
      logger.warn('Retention scheduler already started');
      return;
    }

    logger.info('Starting retention scheduler', {
      schedule: RETENTION_CRON_SCHEDULE,
      timezone: RETENTION_CRON_TIMEZONE,
    });

    this.task = cron.schedule(
      RETENTION_CRON_SCHEDULE,
      async () => {
        await this.runRetentionJob();
      },
      {
        scheduled: true,
        timezone: RETENTION_CRON_TIMEZONE,
      }
    );

    logger.info('Retention scheduler started successfully');
  }

  /**
   * Stop the retention scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Retention scheduler stopped');
    }
  }

  /**
   * Execute retention job
   */
  private async runRetentionJob(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Retention job already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    logger.info('Starting scheduled retention job');

    try {
      const result = await this.retentionService.applyRetentionPolicies({
        dryRun: false,
        batchSize: 100,
        maxErrorRate: 5,
        delayMs: 100, // Small delay between projects to avoid overwhelming DB
      });

      const duration = Date.now() - startTime;

      logger.info('Retention job completed successfully', {
        duration,
        ...result,
      });

      // Send summary email if configured
      await this.sendCompletionSummary(result, duration);
    } catch (error) {
      logger.error('Retention job failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Send error notification if configured
      await this.sendErrorNotification(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger retention job
   * Returns true if job was triggered, false if already running
   */
  async triggerManual(): Promise<boolean> {
    if (this.isRunning) {
      logger.warn('Cannot trigger manual retention job - already running');
      return false;
    }

    logger.info('Manually triggered retention job');
    await this.runRetentionJob();
    return true;
  }

  /**
   * Check if retention job is currently running
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    // Parse cron expression to calculate next run time
    // This is a simplified version - production would use a cron parser library
    return null;
  }

  /**
   * Send completion summary email
   * Placeholder - implement with email service
   */
  private async sendCompletionSummary(
    result: Awaited<ReturnType<RetentionService['applyRetentionPolicies']>>,
    duration: number
  ): Promise<void> {
    // TODO: Implement email notification
    // For now, just log the summary
    logger.info('Retention job summary', {
      projectsProcessed: result.projectsProcessed,
      totalDeleted: result.totalDeleted,
      totalArchived: result.totalArchived,
      storageFreed: this.formatBytes(result.storageFreed),
      errors: result.errors.length,
      duration: `${(duration / 1000).toFixed(2)}s`,
    });
  }

  /**
   * Send error notification
   * Placeholder - implement with notification service
   */
  private async sendErrorNotification(error: unknown): Promise<void> {
    // TODO: Implement error notification (email, Slack, etc.)
    logger.error('Retention job error notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {return '0 Bytes';}

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
