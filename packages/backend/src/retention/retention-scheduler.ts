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
import type { BaseNotificationService } from './notification-service.js';
import { createNotificationService } from './notification-service.js';

const logger = getLogger();

/**
 * Retention scheduler for automated cleanup
 */
export class RetentionScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;
  private notificationService: BaseNotificationService;

  constructor(
    private retentionService: RetentionService,
    notificationService?: BaseNotificationService
  ) {
    this.notificationService = notificationService ?? createNotificationService('logger');
  }

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

      await this.notificationService.sendCompletionNotification(result, duration);
    } catch (error) {
      logger.error('Retention job failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.notificationService.sendErrorNotification(error);
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
   * Calculates the next occurrence based on the configured cron schedule
   */
  getNextRunTime(): Date | null {
    if (!this.task) {
      return null;
    }

    // Parse the cron expression (format: "minute hour day month weekday")
    // Current schedule: "0 2 * * *" = daily at 2:00 AM
    const parts = RETENTION_CRON_SCHEDULE.split(' ');
    if (parts.length !== 5) {
      return null;
    }

    const [minute, hour, day, month, weekday] = parts;

    const now = new Date();
    const next = new Date(now);

    // Handle simple daily schedule (e.g., "0 2 * * *")
    if (day === '*' && month === '*' && weekday === '*') {
      const targetHour = parseInt(hour, 10);
      const targetMinute = parseInt(minute, 10);

      next.setHours(targetHour, targetMinute, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    }

    // For more complex schedules, return null
    // This could be extended to handle more patterns as needed
    logger.warn('Complex cron schedule detected - cannot calculate next run time', {
      schedule: RETENTION_CRON_SCHEDULE,
    });
    return null;
  }
}
