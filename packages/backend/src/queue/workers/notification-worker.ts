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
 * - BugReportRepository: For fetching bug report context
 * - Email service: For sending email notifications
 * - Slack SDK: For sending Slack messages
 * - HTTP client: For webhook delivery
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { getLogger } from '../../logger.js';
import type { BugReportRepository } from '../../db/repositories.js';
import type { IStorageService } from '../../storage/types.js';
import {
  createNotifierRegistryFromEnv,
  type NotifierRegistry,
} from './notifications/notifier-registry.js';

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
  bugReportRepo: BugReportRepository,
  bugReportId: string
): Promise<NotificationContext> {
  const report = await bugReportRepo.findById(bugReportId);

  if (!report) {
    throw new Error(`Bug report not found: ${bugReportId}`);
  }

  const metadata = (report.metadata || {}) as Record<string, unknown>;

  return {
    bugReportId: report.id,
    projectId: report.project_id,
    title: report.title,
    description: report.description || '',
    status: report.status,
    priority: report.priority || undefined,
    screenshotUrl: metadata.screenshotUrl as string | undefined,
    replayUrl: metadata.replayManifestUrl as string | undefined,
    externalUrl: metadata.externalUrl as string | undefined,
    metadata,
  };
}

/**
 * Route notification using notifier registry
 */
async function routeNotification(
  notifierRegistry: NotifierRegistry,
  type: string,
  recipient: string,
  context: NotificationContext,
  event: string
): Promise<DeliveryResult> {
  const notifier = notifierRegistry.get(type.toLowerCase());

  if (!notifier) {
    throw new Error(`No notifier registered for type: ${type}`);
  }

  const result = await notifier.send(recipient, context, event);

  return {
    recipient,
    success: result.success,
    error: result.error,
  };
}

/**
 * Process notification job
 */
async function processNotificationJob(
  job: Job<NotificationJobData, NotificationJobResult>,
  bugReportRepo: BugReportRepository,
  notifierRegistry: NotifierRegistry
): Promise<NotificationJobResult> {
  const startTime = Date.now();

  // Validate job data
  validateNotificationJobData(job.data);
  const { bugReportId, projectId, type, recipients, event } = job.data;

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
  const context = await fetchNotificationContext(bugReportRepo, bugReportId);

  // Step 2: Send notifications to all recipients
  await progress.update(2, 'Sending notifications');
  const results: DeliveryResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    try {
      const result = await routeNotification(notifierRegistry, type, recipient, context, event);
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
  bugReportRepo: BugReportRepository,
  _storage: IStorageService,
  connection: Redis
): BaseWorker<NotificationJobData, NotificationJobResult, 'notifications'> {
  // Create notifier registry with auto-loaded configurations from environment
  const notifierRegistry = createNotifierRegistryFromEnv();

  const worker = createWorker<
    NotificationJobData,
    NotificationJobResult,
    typeof QUEUE_NAMES.NOTIFICATIONS
  >({
    name: NOTIFICATION_JOB_NAME,
    processor: async (job) => processNotificationJob(job, bugReportRepo, notifierRegistry),
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
