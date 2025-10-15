/**
 * Bug Report routes
 * CRUD operations for bug reports
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import {
  createBugReportSchema,
  listBugReportsSchema,
  getBugReportSchema,
  updateBugReportSchema,
  BugStatus,
  BugPriority,
} from '../schemas/bug-report-schema.js';
import { requireProject } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { findOrThrow, checkProjectAccess } from '../utils/resource.js';
import { resolveAccessibleProjectId } from '../utils/access-control.js';
import { buildPagination, buildSort } from '../utils/query-builder.js';
import type { QueueManager } from '../../queue/queue-manager.js';
import { QUEUE_NAMES, JOB_ID_PREFIXES } from '../../queue/types.js';
import type { QueueName } from '../../queue/types.js';
import type { User, Project } from '../../db/types.js';
import type {
  CreateReportBody,
  UpdateReportBody,
  ListReportsQuery,
} from '../types/bug-report-types.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Queue a job with standardized error handling
 * Logs success/failure but never throws - jobs are optional
 * @param queueManager - Queue manager instance
 * @param queueName - Name of the queue
 * @param jobId - Unique job identifier
 * @param jobData - Job data (must contain bugReportId and projectId for logging)
 */
async function queueJobSafely(
  queueManager: QueueManager,
  queueName: QueueName,
  jobId: string,
  jobData: { bugReportId: string; projectId: string; [key: string]: unknown }
): Promise<void> {
  const { bugReportId, projectId } = jobData;
  try {
    await queueManager.addJob(queueName, jobId, jobData);
    logger.info(`${queueName} job queued`, { bugReportId, projectId, jobId });
  } catch (error) {
    logger.error(`Failed to queue ${queueName} job`, {
      error: error instanceof Error ? error.message : String(error),
      bugReportId,
      projectId,
      jobId,
    });
  }
}

/**
 * Queue a screenshot processing job
 * Helper that handles job ID construction and type safety
 */
async function queueScreenshotJob(
  queueManager: QueueManager,
  bugReportId: string,
  projectId: string,
  screenshotData: string
): Promise<void> {
  return queueJobSafely(
    queueManager,
    QUEUE_NAMES.SCREENSHOTS,
    `${JOB_ID_PREFIXES.SCREENSHOT}${bugReportId}`,
    { bugReportId, projectId, screenshotData }
  );
}

/**
 * Queue a session replay processing job
 * Helper that handles job ID construction and type safety
 */
async function queueReplayJob(
  queueManager: QueueManager,
  bugReportId: string,
  projectId: string,
  sessionId: string,
  events: unknown[]
): Promise<void> {
  return queueJobSafely(
    queueManager,
    QUEUE_NAMES.REPLAYS,
    `${JOB_ID_PREFIXES.REPLAY}${bugReportId}`,
    { bugReportId, projectId, sessionId, events }
  );
}

/**
 * Find a bug report and verify user has access to its project
 * Throws 404 if not found, 403 if no access
 */
async function findReportWithAccess(
  id: string,
  authUser: User | undefined,
  authProject: Project | undefined,
  db: DatabaseClient
) {
  const report = await findOrThrow(() => db.bugReports.findById(id), 'Bug report');
  await checkProjectAccess(report.project_id, authUser, authProject, db, 'Bug report');
  return report;
}

export function bugReportRoutes(
  fastify: FastifyInstance,
  db: DatabaseClient,
  queueManager?: QueueManager
) {
  /**
   * POST /api/v1/reports
   * Create a new bug report
   */
  fastify.post<{ Body: CreateReportBody }>(
    '/api/v1/reports',
    {
      schema: createBugReportSchema,
      preHandler: requireProject,
    },
    async (request, reply) => {
      const { title, description, priority, report } = request.body;

      // Project ID comes from authenticated API key (guaranteed by requireProject middleware)
      const projectId = request.authProject!.id;

      // Create bug report
      const bugReport = await db.bugReports.create({
        project_id: projectId,
        title,
        description: description || null,
        priority: priority || BugPriority.MEDIUM,
        status: BugStatus.OPEN,
        metadata: {
          consoleLogs: report.consoleLogs,
          networkRequests: report.networkRequests,
          browserMetadata: report.browserMetadata,
        },
        screenshot_url: null, // Will be populated by worker after upload to storage
        replay_url: null, // Will be populated if session replay is enabled
      });

      // Queue screenshot processing job if provided
      // Note: Screenshot data (base64) is passed to worker which will:
      // 1. Decode and upload original to storage
      // 2. Generate and upload thumbnail
      // 3. Optimize images
      // 4. Update database with URLs
      if (report.screenshot && queueManager) {
        await queueScreenshotJob(queueManager, bugReport.id, projectId, report.screenshot);
      }

      // Store session replay data if provided
      if (report.sessionReplay && report.sessionReplay.events.length > 0) {
        const session = await db.sessions.createSession(
          bugReport.id,
          { events: report.sessionReplay.events },
          report.sessionReplay.duration
        );

        // Queue replay processing if queue system is available
        if (queueManager) {
          await queueReplayJob(
            queueManager,
            bugReport.id,
            projectId,
            session.id,
            report.sessionReplay.events
          );
        }
      }

      return sendCreated(reply, bugReport);
    }
  );

  /**
   * GET /api/v1/reports
   * List bug reports with filtering, sorting, and pagination
   */
  fastify.get<{ Querystring: ListReportsQuery }>(
    '/api/v1/reports',
    {
      schema: listBugReportsSchema,
    },
    async (request, reply) => {
      const { page, limit, status, priority, project_id, sort_by, order } = request.query;

      // Resolve project access (handles both API key and JWT auth)
      const filterProjectId = await resolveAccessibleProjectId(
        project_id,
        request.authUser,
        request.authProject,
        db
      );

      // Build query parameters
      const filters = {
        project_id: filterProjectId,
        status,
        priority,
      };
      const sort = buildSort(sort_by, order, 'created_at' as const);
      const pagination = buildPagination(page, limit);

      // Execute query
      const result = await db.bugReports.list(filters, sort, pagination);

      return sendPaginated(reply, result.data, result.pagination);
    }
  );

  /**
   * GET /api/v1/reports/:id
   * Get a single bug report by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/reports/:id',
    {
      schema: getBugReportSchema,
    },
    async (request, reply) => {
      const { id } = request.params;

      const bugReport = await findReportWithAccess(id, request.authUser, request.authProject, db);

      return sendSuccess(reply, bugReport);
    }
  );

  /**
   * PATCH /api/v1/reports/:id
   * Update a bug report (status, priority, description)
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateReportBody }>(
    '/api/v1/reports/:id',
    {
      schema: updateBugReportSchema,
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      // Verify report exists and user has access
      await findReportWithAccess(id, request.authUser, request.authProject, db);

      // Update the report
      const updated = await db.bugReports.update(id, updates);

      return sendSuccess(reply, updated);
    }
  );
}
