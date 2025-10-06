/**
 * Database Types (Internal - API Only)
 * These types represent the database schema in Supabase
 * They should NOT be imported by the SDK
 */

import type { BugStatus, BugPriority } from '@bugspotter/types';

// ============================================================================
// Database Tables (Supabase Schema)
// ============================================================================

/**
 * Bug Report table schema
 */
export interface DatabaseBugReport {
  id: string;
  title: string;
  description: string;
  status: BugStatus;
  priority: BugPriority;
  screenshot_url?: string; // Cloud storage URL (e.g., Supabase Storage)
  screenshot_data?: string; // Base64 data (for small images or temporary storage)
  user_id?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Console Logs table schema (normalized from SDK capture)
 */
export interface DatabaseConsoleLog {
  id: string;
  bug_report_id: string; // Foreign key to bug_reports
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  stack?: string;
  created_at: string;
}

/**
 * Network Requests table schema (normalized from SDK capture)
 */
export interface DatabaseNetworkRequest {
  id: string;
  bug_report_id: string; // Foreign key to bug_reports
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
  created_at: string;
}

/**
 * Browser Metadata table schema (normalized from SDK capture)
 */
export interface DatabaseMetadata {
  id: string;
  bug_report_id: string; // Foreign key to bug_reports
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  browser: string;
  os: string;
  url: string;
  timestamp: number;
  created_at: string;
}

/**
 * Projects table schema
 */
export interface DatabaseProject {
  id: string;
  name: string;
  description?: string;
  api_key: string;
  owner_id: string;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
}

/**
 * Users table schema
 */
export interface DatabaseUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Project Settings
// ============================================================================

export interface ProjectSettings {
  auto_screenshot: boolean;
  max_screenshot_size: number; // in MB
  capture_console: boolean;
  capture_network: boolean;
  allowed_origins: string[];
  rate_limit: number; // requests per minute
  notification_email?: string;
}

export type UserRole = 'user' | 'admin' | 'developer' | 'qa';

// ============================================================================
// Service Layer Types (Internal)
// ============================================================================

/**
 * Parameters for creating a bug report in the database
 * Used internally by the bug service
 */
export interface CreateBugReportParams {
  title: string;
  description: string;
  screenshot: string;
  console_logs: Array<{
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: number;
    stack?: string;
  }>;
  network_requests: Array<{
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: number;
    error?: string;
  }>;
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    browser: string;
    os: string;
    url: string;
    timestamp: number;
  };
  priority?: BugPriority;
  project_id?: string;
  user_id?: string;
}

/**
 * Filters for querying bug reports
 */
export interface BugReportFilters {
  status?: BugStatus[];
  priority?: BugPriority[];
  project_id?: string;
  user_id?: string;
  search?: string;
  date_from?: Date;
  date_to?: Date;
}

// ============================================================================
// Webhook & Notification Types
// ============================================================================

export interface WebhookPayload {
  event: WebhookEvent;
  bug_report: {
    id: string;
    title: string;
    status: BugStatus;
    priority: BugPriority;
  };
  project_id: string;
  timestamp: string;
}

export type WebhookEvent =
  | 'bug.created'
  | 'bug.updated'
  | 'bug.status_changed'
  | 'bug.resolved'
  | 'bug.deleted';

export interface NotificationSettings {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  webhook_url?: string;
  email_recipients?: string[];
  slack_webhook_url?: string;
}

// ============================================================================
// Authentication & Authorization
// ============================================================================

export interface AuthTokenPayload {
  user_id: string;
  email: string;
  role: UserRole;
  project_id?: string;
  exp: number;
  iat: number;
}

export interface ApiKeyValidation {
  valid: boolean;
  project_id?: string;
  project_name?: string;
  rate_limit?: number;
}

// ============================================================================
// Analytics Types (Internal)
// ============================================================================

export interface BugReportStats {
  total: number;
  by_status: Record<BugStatus, number>;
  by_priority: Record<BugPriority, number>;
  by_browser: Record<string, number>;
  by_os: Record<string, number>;
  trend: {
    date: string;
    count: number;
  }[];
}

export interface ProjectAnalytics {
  bug_reports: BugReportStats;
  resolution_time: {
    average: number; // in hours
    median: number;
    min: number;
    max: number;
  };
  most_common_errors: {
    message: string;
    count: number;
  }[];
  active_users: number;
  period: {
    from: string;
    to: string;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Express Request Extensions
// ============================================================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: DatabaseUser;
      project?: DatabaseProject;
      apiKey?: string;
    }
  }
}
