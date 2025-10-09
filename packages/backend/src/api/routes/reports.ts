/**
 * Bug Report routes
 * CRUD operations for bug reports
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { BugStatus, BugPriority } from '@bugspotter/types';
import {
  createBugReportSchema,
  listBugReportsSchema,
  getBugReportSchema,
  updateBugReportSchema,
} from '../schemas/bug-report.schema.js';
import { requireProject } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { findOrThrow, checkProjectAccess } from '../utils/resource.js';
import { resolveAccessibleProjectId } from '../utils/access-control.js';
import { buildPagination, buildSort } from '../utils/query-builder.js';

interface CreateReportBody {
  title: string;
  description?: string;
  priority?: BugPriority;
  report: {
    consoleLogs: unknown[];
    networkRequests: unknown[];
    browserMetadata: Record<string, unknown>;
    screenshot?: string | null;
    sessionReplay?: {
      events: unknown[];
      duration: number;
    } | null;
  };
}

interface UpdateReportBody {
  status?: BugStatus;
  priority?: BugPriority;
  description?: string;
}

interface ListReportsQuery {
  page?: number;
  limit?: number;
  status?: BugStatus;
  priority?: BugPriority;
  project_id?: string;
  sort_by?: 'created_at' | 'updated_at' | 'priority';
  order?: 'asc' | 'desc';
}

export function bugReportRoutes(fastify: FastifyInstance, db: DatabaseClient) {
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
        priority: priority || 'medium',
        status: 'open',
        metadata: {
          consoleLogs: report.consoleLogs,
          networkRequests: report.networkRequests,
          browserMetadata: report.browserMetadata,
        },
        screenshot_url: report.screenshot || null,
        replay_url: null, // Will be populated if session replay is enabled
      });

      // Store session replay data if provided
      if (report.sessionReplay && report.sessionReplay.events.length > 0) {
        await db.sessions.createSession(
          bugReport.id,
          { events: report.sessionReplay.events },
          report.sessionReplay.duration
        );
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

      const bugReport = await findOrThrow(() => db.bugReports.findById(id), 'Bug report');

      // Check if user has access to this report's project
      await checkProjectAccess(
        bugReport.project_id,
        request.authUser,
        request.authProject,
        db,
        'Bug report'
      );

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

      // Check if report exists
      const existing = await findOrThrow(() => db.bugReports.findById(id), 'Bug report');

      // Check access rights
      await checkProjectAccess(
        existing.project_id,
        request.authUser,
        request.authProject,
        db,
        'Bug report'
      );

      // Update the report
      const updated = await db.bugReports.update(id, updates);

      return sendSuccess(reply, updated);
    }
  );
}
