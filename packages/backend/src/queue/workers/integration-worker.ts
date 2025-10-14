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
import type { IStorageService } from '../../storage/types.js';
import {
  INTEGRATION_JOB_NAME,
  validateIntegrationJobData,
  createIntegrationJobResult,
} from '../jobs/integration-job.js';
import type { IntegrationJobData, IntegrationJobResult } from '../types.js';
import { QUEUE_NAMES } from '../types.js';
import type { BaseWorker } from './base-worker.js';
import { createBaseWorkerWrapper } from './base-worker.js';
import { attachStandardEventHandlers } from './worker-events.js';
import { ProgressTracker } from './progress-tracker.js';
import { createWorker } from './worker-factory.js';
import { IntegrationServiceRegistry } from '../../integrations/integration-registry.js';

const logger = getLogger();

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
 * Route integration to platform-specific handler using registry
 */
async function routeToPlatform(
  platform: string,
  bugReportId: string,
  projectId: string,
  db: DatabaseClient,
  storage: IStorageService
): Promise<PlatformIntegrationResult> {
  // Create integration service registry
  const registry = new IntegrationServiceRegistry(db, storage);

  // Get service for platform
  const service = registry.get(platform);
  if (!service) {
    // List supported platforms for better error message
    const supported = registry.getSupportedPlatforms().join(', ');
    throw new Error(`Integration platform '${platform}' not supported. Supported: ${supported}`);
  }

  // Fetch bug report
  const bugReport = await db.bugReports.findById(bugReportId);
  if (!bugReport) {
    throw new Error(`Bug report not found: ${bugReportId}`);
  }

  // Create issue on external platform
  const result = await service.createFromBugReport(bugReport, projectId);

  return {
    externalId: result.externalId,
    externalUrl: result.externalUrl,
    status: 'created',
    metadata: result.metadata,
  };
}

/**
 * Process integration job
 */
async function processIntegrationJob(
  job: Job<IntegrationJobData, IntegrationJobResult>,
  db: DatabaseClient,
  storage: IStorageService
): Promise<IntegrationJobResult> {
  const startTime = Date.now();

  // Validate job data
  validateIntegrationJobData(job.data);
  const { bugReportId, projectId, platform } = job.data;

  logger.info('Processing integration job', {
    jobId: job.id,
    bugReportId,
    projectId,
    platform,
  });

  const progress = new ProgressTracker(job, 2);

  // Step 1: Route to platform handler
  await progress.update(1, `Creating ${platform} issue`);
  const result = await routeToPlatform(platform, bugReportId, projectId, db, storage);

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
  storage: IStorageService,
  connection: Redis
): BaseWorker<IntegrationJobData, IntegrationJobResult, 'integrations'> {
  const worker = createWorker<
    IntegrationJobData,
    IntegrationJobResult,
    typeof QUEUE_NAMES.INTEGRATIONS
  >({
    name: INTEGRATION_JOB_NAME,
    processor: async (job) => processIntegrationJob(job, db, storage),
    connection,
    workerType: QUEUE_NAMES.INTEGRATIONS,
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
