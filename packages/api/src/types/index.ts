/**
 * API Internal Types
 * 
 * IMPORTANT: This file contains API-internal types that should NOT be used by the SDK.
 * For shared types between SDK and API, use @bugspotter/types package.
 * For database schema types, use ./database.ts
 * 
 * This file is kept for backward compatibility and will be deprecated.
 * Please import from the appropriate locations:
 * - Public API contracts: @bugspotter/types
 * - Database types: ./database.ts
 */

// Re-export shared types for convenience (will be deprecated)
export type {
  // Capture types
  ConsoleLog,
  NetworkRequest,
  BrowserMetadata,
  CapturedReport,
  
  // API Contract types
  BugPriority,
  BugStatus,
  CreateBugReportRequest,
  BugReportData,
  CreateBugReportResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginatedResponse,
  ListBugReportsQuery,
} from '@bugspotter/types';

// Re-export database types for convenience
export type {
  DatabaseBugReport,
  DatabaseConsoleLog,
  DatabaseNetworkRequest,
  DatabaseMetadata,
  DatabaseProject,
  DatabaseUser,
  ProjectSettings,
  UserRole,
  CreateBugReportParams,
  BugReportFilters,
  WebhookPayload,
  WebhookEvent,
  NotificationSettings,
  AuthTokenPayload,
  ApiKeyValidation,
  BugReportStats,
  ProjectAnalytics,
  Nullable,
  Optional,
  TimeRange,
  Pagination,
} from './database.js';

/**
 * @deprecated Import from @bugspotter/types instead
 */
export interface UpdateBugReportInput {
  title?: string;
  description?: string;
  status?: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
}
