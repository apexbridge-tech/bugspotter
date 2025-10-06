/**
 * @bugspotter/types
 * Shared TypeScript types for BugSpotter SDK and API
 *
 * This package ensures type safety between SDK and API by providing
 * a single source of truth for all shared interfaces.
 */

// Capture types
export type { ConsoleLog, NetworkRequest, BrowserMetadata, CapturedReport } from './capture.js';

// API Contract types
export type {
  BugPriority,
  BugStatus,
  CreateBugReportRequest,
  BugReportData,
  CreateBugReportResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginatedResponse,
  ListBugReportsQuery,
} from './api-contract.js';
