/**
 * @bugspotter/types
 * Shared TypeScript types for BugSpotter SDK and API
 *
 * This package ensures type safety between SDK and API by providing
 * a single source of truth for all shared interfaces.
 */

// Capture types
export type { ConsoleLog, NetworkRequest, BrowserMetadata, CapturedReport } from './capture.js';

// API Contract types and constants
export {
  BugPriority,
  BugStatus,
  type CreateBugReportRequest,
  type BugReportData,
  type CreateBugReportResponse,
  type ApiErrorResponse,
  type ApiResponse,
  type PaginatedResponse,
  type ListBugReportsQuery,
} from './api-contract.js';
