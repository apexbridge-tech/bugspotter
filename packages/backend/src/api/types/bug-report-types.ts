/**
 * Bug Report API Types
 * Request/response type definitions for bug report routes
 */

import type { BugStatus, BugPriority } from '@bugspotter/types';

/**
 * Request body for creating a new bug report
 */
export interface CreateReportBody {
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

/**
 * Request body for updating an existing bug report
 */
export interface UpdateReportBody {
  status?: BugStatus;
  priority?: BugPriority;
  description?: string;
}

/**
 * Query parameters for listing bug reports
 */
export interface ListReportsQuery {
  page?: number;
  limit?: number;
  status?: BugStatus;
  priority?: BugPriority;
  project_id?: string;
  sort_by?: 'created_at' | 'updated_at' | 'priority';
  order?: 'asc' | 'desc';
}
