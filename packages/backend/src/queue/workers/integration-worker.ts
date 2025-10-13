/**
 * Integration Worker
 *
 * Processes external platform integration jobs (Jira, GitHub, Linear, Slack).
 * Routes jobs to platform-specific handlers, manages rate limiting, stores external IDs.
 *
 * Processing Pipeline:
 * 1. Validate job data and credentials
 * 2. Fetch bug report details from database
 * 3. Route to platform-specific handler (Jira/GitHub/Linear/Slack)
 * 4. Create or update issue on external platform
 * 5. Store external ID and URL in database
 * 6. Optionally sync comments and status updates
 *
 * Dependencies:
 * - DatabaseClient: For fetching bug reports and storing external IDs
 * - Platform SDKs: Jira API, GitHub API, Linear SDK, Slack Web API
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { getLogger } from '../../logger.js';
import type { DatabaseClient } from '../../db/client.js';
import type { BaseStorageService } from '../../storage/base-storage-service.js';
import {
  INTEGRATION_JOB_NAME,
  validateIntegrationJobData,
  createIntegrationJobResult,
} from '../jobs/integration-job.js';
import type { IntegrationJobData, IntegrationJobResult } from '../types.js';
import type { BaseWorker } from './base-worker.js';
import { createBaseWorkerWrapper } from './base-worker.js';
import { attachStandardEventHandlers } from './worker-events.js';
import { ProgressTracker } from './progress-tracker.js';
import { createWorker } from './worker-factory.js';

const logger = getLogger();

/**
 * Bug report data for integration
 */
interface BugReportData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  metadata?: Record<string, unknown>;
  screenshotUrl?: string;
  replayUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform-specific integration result
 */
interface PlatformIntegrationResult {
  externalId: string;
  externalUrl: string;
  status: 'created' | 'updated' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
 * Fetch bug report from database
 */
async function fetchBugReport(db: DatabaseClient, bugReportId: string): Promise<BugReportData> {
  const result = await db.query<BugReportData>(
    `SELECT 
      id, 
      title, 
      description, 
      status, 
      priority,
      metadata,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM bug_reports 
    WHERE id = $1`,
    [bugReportId]
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error(`Bug report not found: ${bugReportId}`);
  }

  const report = result.rows[0];

  // Extract URLs from metadata
  const metadata = (report.metadata || {}) as Record<string, unknown>;
  const screenshotUrl = metadata.screenshotUrl as string | undefined;
  const replayUrl = metadata.replayManifestUrl as string | undefined;

  return {
    ...report,
    screenshotUrl,
    replayUrl,
  };
}

/**
 * Process Jira integration (placeholder - requires Jira SDK)
 */
async function processJiraIntegration(
  report: BugReportData,
  _credentials: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<PlatformIntegrationResult> {
  logger.info('Processing Jira integration', { reportId: report.id });

  // TODO: Implement Jira API integration
  // - Authenticate with Jira using credentials (apiToken, domain, email)
  // - Create issue using Jira REST API v3
  // - Upload attachments (screenshot, replay link)
  // - Set priority, labels, assignee from config
  // - Handle rate limiting (10 requests/second for Jira Cloud)

  // Placeholder implementation
  const externalId = `JIRA-${Math.floor(Math.random() * 10000)}`;
  const externalUrl = `https://example.atlassian.net/browse/${externalId}`;

  return {
    externalId,
    externalUrl,
    status: 'created',
    metadata: {
      platform: 'jira',
      projectKey: config.projectKey || 'BUG',
      issueType: config.issueType || 'Bug',
    },
  };
}

/**
 * Process GitHub integration (placeholder - requires GitHub SDK)
 */
async function processGitHubIntegration(
  report: BugReportData,
  _credentials: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<PlatformIntegrationResult> {
  logger.info('Processing GitHub integration', { reportId: report.id });

  // TODO: Implement GitHub API integration
  // - Authenticate with GitHub using credentials (token, owner, repo)
  // - Create issue using GitHub REST API v3
  // - Add labels from config (bug, priority-high, etc.)
  // - Upload attachments as issue comments
  // - Handle rate limiting (5000 requests/hour for authenticated users)

  // Placeholder implementation
  const issueNumber = Math.floor(Math.random() * 10000);
  const externalId = `#${issueNumber}`;
  const externalUrl = `https://github.com/${config.owner}/${config.repo}/issues/${issueNumber}`;

  return {
    externalId,
    externalUrl,
    status: 'created',
    metadata: {
      platform: 'github',
      repository: `${config.owner}/${config.repo}`,
      issueNumber,
    },
  };
}

/**
 * Process Linear integration (placeholder - requires Linear SDK)
 */
async function processLinearIntegration(
  report: BugReportData,
  _credentials: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<PlatformIntegrationResult> {
  logger.info('Processing Linear integration', { reportId: report.id });

  // TODO: Implement Linear SDK integration
  // - Authenticate with Linear using credentials (apiKey)
  // - Create issue using Linear GraphQL API
  // - Set team, priority, labels from config
  // - Upload attachments (screenshot, replay link in description)
  // - Handle rate limiting (1000 requests/hour)

  // Placeholder implementation
  const externalId = `BUG-${Math.floor(Math.random() * 10000)}`;
  const externalUrl = `https://linear.app/team/issue/${externalId}`;

  return {
    externalId,
    externalUrl,
    status: 'created',
    metadata: {
      platform: 'linear',
      teamId: config.teamId || 'default',
    },
  };
}

/**
 * Process Slack integration (placeholder - requires Slack SDK)
 */
async function processSlackIntegration(
  report: BugReportData,
  _credentials: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<PlatformIntegrationResult> {
  logger.info('Processing Slack integration', { reportId: report.id });

  // TODO: Implement Slack Web API integration
  // - Authenticate with Slack using credentials (token, channel)
  // - Post message to channel with bug report details
  // - Include screenshot and replay links
  // - Add action buttons (view, assign, close)
  // - Handle rate limiting (Tier 3: 50+ requests/minute)

  // Placeholder implementation
  const timestamp = Date.now().toString();
  const externalId = `slack-${timestamp}`;
  const externalUrl = `https://slack.com/app_redirect?channel=${config.channel}&message=${timestamp}`;

  return {
    externalId,
    externalUrl,
    status: 'created',
    metadata: {
      platform: 'slack',
      channel: config.channel || 'bugs',
      threadTs: timestamp,
    },
  };
}

/**
 * Route integration to platform-specific handler
 */
async function routeToPlatform(
  platform: string,
  report: BugReportData,
  credentials: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<PlatformIntegrationResult> {
  switch (platform.toLowerCase()) {
    case 'jira':
      return processJiraIntegration(report, credentials, config);
    case 'github':
      return processGitHubIntegration(report, credentials, config);
    case 'linear':
      return processLinearIntegration(report, credentials, config);
    case 'slack':
      return processSlackIntegration(report, credentials, config);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Process integration job
 */
async function processIntegrationJob(
  job: Job<IntegrationJobData, IntegrationJobResult>,
  db: DatabaseClient
): Promise<IntegrationJobResult> {
  const startTime = Date.now();

  // Validate job data
  validateIntegrationJobData(job.data);
  const { bugReportId, projectId, platform, credentials, config } = job.data;

  logger.info('Processing integration job', {
    jobId: job.id,
    bugReportId,
    projectId,
    platform,
  });

  const progress = new ProgressTracker(job, 3);

  // Step 1: Fetch bug report
  await progress.update(1, 'Fetching bug report');
  const report = await fetchBugReport(db, bugReportId);

  // Step 2: Route to platform handler
  await progress.update(2, `Creating ${platform} issue`);
  const result = await routeToPlatform(platform, report, credentials, config);

  // Step 3: Store external ID in database
  await progress.update(3, 'Updating database');
  await db.bugReports.updateExternalIntegration(bugReportId, result.externalId, result.externalUrl);

  await progress.complete('Done');

  const processingTime = Date.now() - startTime;

  logger.info('Integration job completed', {
    jobId: job.id,
    bugReportId,
    platform,
    externalId: result.externalId,
    status: result.status,
    processingTime,
  });

  return createIntegrationJobResult(
    platform,
    result.externalId,
    result.externalUrl,
    result.status,
    result.metadata
  );
}

/**
 * Create integration worker with concurrency and event handlers
 * Returns a BaseWorker wrapper for consistent interface with other workers
 */
export function createIntegrationWorker(
  db: DatabaseClient,
  _storage: BaseStorageService,
  connection: Redis
): BaseWorker<IntegrationJobData, IntegrationJobResult> {
  const worker = createWorker<IntegrationJobData, IntegrationJobResult>({
    name: INTEGRATION_JOB_NAME,
    processor: async (job) => processIntegrationJob(job, db),
    connection,
    workerType: 'integration',
  });

  // Attach standard event handlers with job-specific context
  attachStandardEventHandlers(worker, 'Integration', (data, result) => ({
    bugReportId: data.bugReportId,
    platform: data.platform || result?.platform,
    externalId: result?.externalId,
    status: result?.status,
  }));

  logger.info('Integration worker started');

  // Return wrapped worker that implements BaseWorker interface
  return createBaseWorkerWrapper(worker, 'Integration');
}
