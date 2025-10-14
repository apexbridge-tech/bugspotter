/**
 * API Contract Types
 * These types define the HTTP API contract between SDK and API
 */

import { CapturedReport } from './capture.js';

/**
 * Priority levels for bug reports
 */
export type BugPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Bug priority constants for convenient access
 */
export const BugPriority = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const,
};

/**
 * Status of a bug report
 */
export type BugStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

/**
 * Bug status constants for convenient access
 */
export const BugStatus = {
  OPEN: 'open' as const,
  IN_PROGRESS: 'in-progress' as const,
  RESOLVED: 'resolved' as const,
  CLOSED: 'closed' as const,
};

/**
 * Request payload for creating a bug report
 * Sent by SDK to API via POST /api/bugs
 */
export interface CreateBugReportRequest {
  title: string;
  description: string;
  report: CapturedReport;
  priority?: BugPriority;
  project_id?: string;
}

/**
 * Response data for a created bug report
 */
export interface BugReportData {
  id: string;
  title: string;
  description: string;
  status: BugStatus;
  priority: BugPriority;
  created_at: string;
  updated_at: string;
  project_id?: string;
  user_id?: string;
}

/**
 * Success response for creating a bug report
 */
export interface CreateBugReportResponse {
  success: true;
  data: BugReportData;
  timestamp: string;
}

/**
 * Error response from API
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  details?: unknown;
}

/**
 * Generic API response wrapper
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      timestamp: string;
    }
  | ApiErrorResponse;

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

/**
 * Query parameters for listing bug reports
 */
export interface ListBugReportsQuery {
  page?: number;
  limit?: number;
  status?: BugStatus;
  priority?: BugPriority;
  project_id?: string;
  sort_by?: 'created_at' | 'updated_at' | 'priority';
  order?: 'asc' | 'desc';
}
