/**
 * Bug Report Routes
 * Handles all endpoints related to bug reports
 */

import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import type { 
  CreateBugReportRequest,
  CreateBugReportResponse,
  ApiErrorResponse,
  BugReportData
} from '@bugspotter/types';
import { CreateBugReportSchema } from '../schemas/bug-report.schema.js';
import { validateBody } from '../middleware/validate.js';

const router: ExpressRouter = Router();

/**
 * POST /api/bugs
 * Create a new bug report
 */
router.post(
  '/',
  validateBody(CreateBugReportSchema),
  async (
    req: Request<{}, CreateBugReportResponse | ApiErrorResponse, CreateBugReportRequest>,
    res: Response<CreateBugReportResponse | ApiErrorResponse>
  ) => {
    try {
      const { title, description, report, priority, project_id } = req.body;

      // TODO: Save to Supabase database
      // For now, return mock response
      const bugReport: BugReportData = {
        id: crypto.randomUUID(),
        title,
        description,
        status: 'open',
        priority: priority || 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(project_id && { project_id }),
      };

      const response: CreateBugReportResponse = {
        success: true,
        data: bugReport,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  }
);

/**
 * GET /api/bugs/:id
 * Get a bug report by ID
 */
router.get(
  '/:id',
  async (
    req: Request<{ id: string }>,
    res: Response<CreateBugReportResponse | ApiErrorResponse>
  ) => {
    try {
      const { id } = req.params;

      // TODO: Fetch from Supabase
      const bugReport: BugReportData = {
        id,
        title: 'Sample Bug',
        description: 'Sample Description',
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: CreateBugReportResponse = {
        success: true,
        data: bugReport,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(errorResponse);
    }
  }
);

export default router;
