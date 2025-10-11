/**
 * Notification Service
 * Strategy pattern for sending retention job notifications
 */

import { getLogger } from '../logger.js';
import type { RetentionResult } from './types.js';

const logger = getLogger();

/**
 * Notification payload for retention job completion
 */
export interface RetentionNotification extends Record<string, unknown> {
  projectsProcessed: number;
  totalDeleted: number;
  totalArchived: number;
  storageFreed: string;
  errors: number;
  duration: string;
}

/**
 * Base notification service (Strategy pattern)
 * Defines the interface for sending notifications about retention jobs
 */
export abstract class BaseNotificationService {
  /**
   * Send notification when retention job completes successfully
   */
  abstract sendCompletionNotification(result: RetentionResult, duration: number): Promise<void>;

  /**
   * Send notification when retention job fails
   */
  abstract sendErrorNotification(error: unknown): Promise<void>;

  /**
   * Format bytes to human-readable string
   */
  protected formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format duration to human-readable string
   */
  protected formatDuration(milliseconds: number): string {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  /**
   * Build notification payload from retention result
   */
  protected buildNotificationPayload(
    result: RetentionResult,
    duration: number
  ): RetentionNotification {
    return {
      projectsProcessed: result.projectsProcessed,
      totalDeleted: result.totalDeleted,
      totalArchived: result.totalArchived,
      storageFreed: this.formatBytes(result.storageFreed),
      errors: result.errors.length,
      duration: this.formatDuration(duration),
    };
  }
}

/**
 * Logger-based notification service (default implementation)
 * Logs notifications to application logger
 */
export class LoggerNotificationService extends BaseNotificationService {
  async sendCompletionNotification(result: RetentionResult, duration: number): Promise<void> {
    const payload = this.buildNotificationPayload(result, duration);

    logger.info('Retention job summary', payload as Record<string, unknown>);
  }

  async sendErrorNotification(error: unknown): Promise<void> {
    logger.error('Retention job error notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Email notification service (stub for future implementation)
 * Sends retention job notifications via email
 */
export class EmailNotificationService extends BaseNotificationService {
  constructor(
    private recipientEmails: string[],
    private fromEmail: string
  ) {
    super();
  }

  async sendCompletionNotification(result: RetentionResult, duration: number): Promise<void> {
    const payload = this.buildNotificationPayload(result, duration);

    // TODO: Implement email sending via SMTP/SendGrid/AWS SES
    // For now, fall back to logging
    logger.info('Would send completion email', {
      recipients: this.recipientEmails,
      from: this.fromEmail,
      ...payload,
    });
  }

  async sendErrorNotification(error: unknown): Promise<void> {
    // TODO: Implement error alert email
    logger.error('Would send error email', {
      recipients: this.recipientEmails,
      from: this.fromEmail,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Slack notification service (stub for future implementation)
 * Sends retention job notifications to Slack channel
 */
export class SlackNotificationService extends BaseNotificationService {
  constructor(
    private webhookUrl: string,
    private channel: string
  ) {
    super();
  }

  async sendCompletionNotification(result: RetentionResult, duration: number): Promise<void> {
    const payload = this.buildNotificationPayload(result, duration);

    // TODO: Implement Slack webhook posting
    // For now, fall back to logging
    logger.info('Would send Slack notification', {
      channel: this.channel,
      webhookUrl: this.webhookUrl.substring(0, 30) + '...',
      ...payload,
    });
  }

  async sendErrorNotification(error: unknown): Promise<void> {
    // TODO: Implement Slack error alert
    logger.error('Would send Slack error alert', {
      channel: this.channel,
      webhookUrl: this.webhookUrl.substring(0, 30) + '...',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Factory function to create notification service based on configuration
 */
export function createNotificationService(
  type: 'logger' | 'email' | 'slack' = 'logger'
): BaseNotificationService {
  switch (type) {
    case 'email':
      // TODO: Load from environment variables
      return new EmailNotificationService(['admin@example.com'], 'noreply@bugspotter.com');
    case 'slack':
      // TODO: Load from environment variables
      return new SlackNotificationService(
        'https://hooks.slack.com/services/...',
        '#retention-alerts'
      );
    case 'logger':
    default:
      return new LoggerNotificationService();
  }
}
