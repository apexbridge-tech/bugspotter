/**
 * Notification Worker
 *
 * Processes notification delivery jobs (email, Slack, webhooks).
 * Routes notifications to appropriate delivery mechanism, tracks delivery status.
 *
 * Processing Pipeline:
 * 1. Validate job data
 * 2. Fetch bug report context if needed
 * 3. Route to notification handler (email/Slack/webhook)
 * 4. Send notifications to all recipients
 * 5. Track delivery success/failure rates
 *
 * Dependencies:
 * - DatabaseClient: For fetching bug report context
 * - Email service: For sending email notifications
 * - Slack SDK: For sending Slack messages
 * - HTTP client: For webhook delivery
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { getLogger } from '../../logger.js';
import type { DatabaseClient } from '../../db/client.js';
import type { IStorageService } from '../../storage/types.js';
import {
  NOTIFICATION_JOB_NAME,
  validateNotificationJobData,
  createNotificationJobResult,
} from '../jobs/notification-job.js';
import type { NotificationJobData, NotificationJobResult } from '../types.js';
import { QUEUE_NAMES } from '../types.js';
import type { BaseWorker } from './base-worker.js';
import { createBaseWorkerWrapper } from './base-worker.js';
import { attachStandardEventHandlers } from './worker-events.js';
import { ProgressTracker } from './progress-tracker.js';
import { createWorker } from './worker-factory.js';

const logger = getLogger();

/**
 * Notification context from bug report
 */
interface NotificationContext {
  bugReportId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  screenshotUrl?: string;
  replayUrl?: string;
  externalUrl?: string;
  metadata: Record<string, unknown>;
}

/**
 * Delivery result for single recipient
 */
interface DeliveryResult {
  recipient: string;
  success: boolean;
  error?: string;
}

/**
 * Fetch bug report context for notification
 */
async function fetchNotificationContext(
  db: DatabaseClient,
  bugReportId: string
): Promise<NotificationContext> {
  const result = await db.query<{
    id: string;
    project_id: string;
    title: string;
    description: string;
    status: string;
    priority?: string;
    metadata?: Record<string, unknown>;
  }>(
    `SELECT 
      id, 
      project_id,
      title, 
      description, 
      status, 
      priority,
      metadata
    FROM bug_reports 
    WHERE id = $1`,
    [bugReportId]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error(`Bug report not found: ${bugReportId}`);
  }

  const report = result.rows[0];
  const metadata = (report.metadata || {}) as Record<string, unknown>;

  return {
    bugReportId: report.id,
    projectId: report.project_id,
    title: report.title,
    description: report.description,
    status: report.status,
    priority: report.priority,
    screenshotUrl: metadata.screenshotUrl as string | undefined,
    replayUrl: metadata.replayManifestUrl as string | undefined,
    externalUrl: metadata.externalUrl as string | undefined,
    metadata,
  };
}

/**
 * Send email notification (placeholder - requires email service)
 */
async function sendEmailNotification(
  recipient: string,
  context: NotificationContext,
  _metadata?: Record<string, unknown>
): Promise<DeliveryResult> {
  logger.info('Sending email notification', {
    recipient,
    bugReportId: context.bugReportId,
  });

  try {
    // TODO: Implement email delivery
    // - Use email service (SendGrid, AWS SES, Mailgun, etc.)
    // - Build HTML email template with bug report details
    // - Include links to screenshot, replay, external issue
    // - Handle bounce/delivery failures
    // - Support batch sending for multiple recipients

    // Placeholder implementation
    logger.debug('Email sent', { recipient, subject: context.title });

    return {
      recipient,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Email send failed', { recipient, error: errorMessage });

    return {
      recipient,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send Slack notification (placeholder - requires Slack SDK)
 */
async function sendSlackNotification(
  recipient: string,
  context: NotificationContext,
  _metadata?: Record<string, unknown>
): Promise<DeliveryResult> {
  logger.info('Sending Slack notification', {
    recipient,
    bugReportId: context.bugReportId,
  });

  try {
    // TODO: Implement Slack delivery
    // - Use Slack Web API (@slack/web-api)
    // - Format message with blocks (header, context, actions)
    // - Include screenshot preview (image block)
    // - Add action buttons (view, assign, close)
    // - Support thread replies for updates
    // - Handle rate limiting (Tier 3: 50+ requests/minute)

    // Placeholder implementation
    logger.debug('Slack message sent', { channel: recipient, title: context.title });

    return {
      recipient,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Slack send failed', { recipient, error: errorMessage });

    return {
      recipient,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send webhook notification (placeholder - requires HTTP client)
 */
async function sendWebhookNotification(
  recipient: string,
  context: NotificationContext,
  metadata?: Record<string, unknown>
): Promise<DeliveryResult> {
  logger.info('Sending webhook notification', {
    recipient,
    bugReportId: context.bugReportId,
  });

  try {
    // TODO: Implement webhook delivery
    // - Use HTTP client (fetch, axios, got, etc.)
    // - POST JSON payload to webhook URL
    // - Include event type, bug report data, timestamps
    // - Support custom headers from metadata
    // - Implement retry logic for failed webhooks (3 attempts)
    // - Verify webhook signatures if configured
    // - Handle timeouts (10 second default)

    // Placeholder implementation
    const payload = {
      event: metadata?.event || 'bug_report_created',
      bugReport: {
        id: context.bugReportId,
        projectId: context.projectId,
        title: context.title,
        description: context.description,
        status: context.status,
        priority: context.priority,
        screenshotUrl: context.screenshotUrl,
        replayUrl: context.replayUrl,
        externalUrl: context.externalUrl,
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug('Webhook sent', { url: recipient, payload });

    return {
      recipient,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Webhook send failed', { url: recipient, error: errorMessage });

    return {
      recipient,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Route notification to appropriate handler
 */
async function routeNotification(
  type: string,
  recipient: string,
  context: NotificationContext,
  metadata?: Record<string, unknown>
): Promise<DeliveryResult> {
  switch (type.toLowerCase()) {
    case 'email':
      return sendEmailNotification(recipient, context, metadata);
    case 'slack':
      return sendSlackNotification(recipient, context, metadata);
    case 'webhook':
      return sendWebhookNotification(recipient, context, metadata);
    default:
      throw new Error(`Unsupported notification type: ${type}`);
  }
}

/**
 * Process notification job
 */
async function processNotificationJob(
  job: Job<NotificationJobData, NotificationJobResult>,
  db: DatabaseClient
): Promise<NotificationJobResult> {
  const startTime = Date.now();

  // Validate job data
  validateNotificationJobData(job.data);
  const { bugReportId, projectId, type, recipients, event, metadata } = job.data;

  logger.info('Processing notification job', {
    jobId: job.id,
    bugReportId,
    projectId,
    type,
    recipientCount: recipients.length,
    event,
  });

  const progress = new ProgressTracker(job, 2);

  // Step 1: Fetch bug report context
  await progress.update(1, 'Fetching context');
  const context = await fetchNotificationContext(db, bugReportId);

  // Step 2: Send notifications to all recipients
  await progress.update(2, 'Sending notifications');
  const results: DeliveryResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    try {
      const result = await routeNotification(type, recipient, context, metadata);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Notification routing failed', {
        recipient,
        error: errorMessage,
      });
      results.push({
        recipient,
        success: false,
        error: errorMessage,
      });
    }
  }

  await progress.complete('Done');

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const errors = results.filter((r) => !r.success).map((r) => r.error || 'Unknown error');

  const processingTime = Date.now() - startTime;

  logger.info('Notification job completed', {
    jobId: job.id,
    bugReportId,
    type,
    recipientCount: recipients.length,
    successCount,
    failureCount,
    processingTime,
  });

  return createNotificationJobResult(
    type,
    recipients.length,
    successCount,
    failureCount,
    errors.length > 0 ? errors : undefined
  );
}

/**
 * Create notification worker with concurrency and event handlers
 */
export function createNotificationWorker(
  db: DatabaseClient,
  _storage: IStorageService,
  connection: Redis
): BaseWorker<NotificationJobData, NotificationJobResult, 'notifications'> {
  const worker = createWorker<
    NotificationJobData,
    NotificationJobResult,
    typeof QUEUE_NAMES.NOTIFICATIONS
  >({
    name: NOTIFICATION_JOB_NAME,
    processor: async (job) => processNotificationJob(job, db),
    connection,
    workerType: QUEUE_NAMES.NOTIFICATIONS,
  });

  // Attach standard event handlers with job-specific context
  attachStandardEventHandlers(worker, 'Notification', (data, result) => ({
    bugReportId: data.bugReportId,
    type: data.type || result?.type,
    recipientCount: data.recipients?.length,
    successCount: result?.successCount,
    failureCount: result?.failureCount,
  }));

  logger.info('Notification worker started');

  // Return wrapped worker that implements BaseWorker interface
  return createBaseWorkerWrapper(worker, 'Notification');
}
