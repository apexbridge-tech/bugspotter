/**
 * Database types for PostgreSQL schema
 */

import { BugStatus, BugPriority } from '@bugspotter/types';

export interface Project {
  id: string;
  name: string;
  api_key: string;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: Date;
}

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: 'admin' | 'user' | 'viewer';
  oauth_provider: string | null;
  oauth_id: string | null;
  created_at: Date;
}

export interface BugReport {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  screenshot_url: string | null;
  replay_url: string | null;
  metadata: Record<string, unknown>;
  status: BugStatus;
  priority: BugPriority;
  deleted_at: Date | null;
  deleted_by: string | null;
  legal_hold: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  bug_report_id: string;
  events: Record<string, unknown>;
  duration: number | null;
  created_at: Date;
}

/**
 * Ticket status values
 */
export const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export interface Ticket {
  id: string;
  bug_report_id: string;
  external_id: string;
  platform: string;
  status: TicketStatus | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: Date;
}

export interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  created_at: Date;
}

export interface ArchivedBugReport {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  screenshot_url: string | null;
  replay_url: string | null;
  metadata: Record<string, unknown>;
  status: BugStatus;
  priority: BugPriority;
  original_created_at: Date;
  original_updated_at: Date;
  deleted_at: Date;
  deleted_by: string | null;
  archived_at: Date;
  archived_reason: string | null;
}

export interface MigrationHistory {
  id: number;
  migration_name: string;
  applied_at: Date;
}

// Insert/Update types (without auto-generated fields)
export type ProjectInsert = {
  id?: string;
  name: string;
  api_key: string;
  settings?: Record<string, unknown>;
  created_by?: string | null;
};

export type ProjectUpdate = Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>;

export type ProjectMemberInsert = {
  id?: string;
  project_id: string;
  user_id: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
};

export type BugReportInsert = {
  project_id: string;
  title: string;
  id?: string;
  description?: string | null;
  screenshot_url?: string | null;
  replay_url?: string | null;
  metadata?: Record<string, unknown>;
  status?: BugStatus;
  priority?: BugPriority;
  deleted_at?: Date | null;
  deleted_by?: string | null;
  legal_hold?: boolean;
};

export type BugReportUpdate = Partial<
  Omit<BugReport, 'id' | 'project_id' | 'created_at' | 'updated_at'>
>;

export type UserInsert = {
  id?: string;
  email: string;
  password_hash?: string | null;
  role?: 'admin' | 'user' | 'viewer';
  oauth_provider?: string | null;
  oauth_id?: string | null;
};

// Query result types with relationships
export interface BugReportWithProject extends BugReport {
  project: Project;
}

export interface BugReportWithSessions extends BugReport {
  sessions: Session[];
}

export interface BugReportWithTickets extends BugReport {
  tickets: Ticket[];
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter types
export interface BugReportFilters {
  project_id?: string;
  status?: BugStatus;
  priority?: BugPriority;
  created_after?: Date;
  created_before?: Date;
}

export interface BugReportSortOptions {
  sort_by?: 'created_at' | 'updated_at' | 'priority';
  order?: 'asc' | 'desc';
}
