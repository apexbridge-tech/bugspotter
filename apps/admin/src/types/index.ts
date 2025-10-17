export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'viewer';
  oauth_provider?: string | null;
  oauth_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string; // Optional: Only present in backward compatibility mode
  user: User;
  expires_in: number;
  token_type: string;
}

export interface SetupStatus {
  initialized: boolean;
  requiresSetup: boolean;
}

export interface SetupRequest {
  admin_email: string;
  admin_password: string;
  admin_name: string;
  instance_name: string;
  instance_url: string;
  storage_type: 'minio' | 's3';
  storage_endpoint?: string;
  storage_access_key: string;
  storage_secret_key: string;
  storage_bucket: string;
  storage_region?: string;
}

export interface InstanceSettings {
  instance_name: string;
  instance_url: string;
  support_email: string;
  storage_type: 'minio' | 's3';
  storage_endpoint?: string;
  storage_bucket: string;
  storage_region?: string;
  jwt_access_expiry: number;
  jwt_refresh_expiry: number;
  rate_limit_max: number;
  rate_limit_window: number;
  cors_origins: string[];
  retention_days: number;
  max_reports_per_project: number;
  session_replay_enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
  report_count: number;
  owner_id: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  system: {
    disk_space_available: number;
    disk_space_total: number;
    worker_queue_depth: number;
    uptime: number;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down';
  response_time: number;
  last_check: string;
  error?: string;
}

export type BugStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type BugPriority = 'low' | 'medium' | 'high' | 'critical';

export interface BugReport {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  screenshot_url: string | null;
  replay_url: string | null;
  metadata: {
    consoleLogs?: Array<{ level: string; message: string; timestamp: number }>;
    networkRequests?: Array<{ url: string; method: string; status: number }>;
    browserMetadata?: {
      userAgent?: string;
      viewport?: { width: number; height: number };
      url?: string;
    };
    [key: string]: unknown;
  };
  status: BugStatus;
  priority: BugPriority;
  deleted_at: string | null;
  deleted_by: string | null;
  legal_hold: boolean;
  created_at: string;
  updated_at: string;
}

export interface BugReportFilters {
  project_id?: string;
  status?: BugStatus;
  priority?: BugPriority;
  created_after?: string;
  created_before?: string;
}

export interface BugReportListResponse {
  data: BugReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Session {
  id: string;
  bug_report_id: string;
  events: {
    type: string;
    recordedEvents: Array<{
      type: number | string;
      data?: unknown;
      timestamp: number;
      [key: string]: unknown;
    }>;
  };
  duration: number | null;
  created_at: string;
}

// User Management Types
export type UserRole = 'admin' | 'user' | 'viewer';

export interface CreateUserRequest {
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  oauth_provider?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UserManagementResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Analytics Types
export interface AnalyticsDashboard {
  bug_reports: {
    by_status: {
      open: number;
      in_progress: number;
      resolved: number;
      closed: number;
      total: number;
    };
    by_priority: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  projects: {
    total: number;
    total_reports: number;
    avg_reports_per_project: number;
  };
  users: {
    total: number;
  };
  time_series: Array<{
    date: string;
    count: number;
  }>;
  top_projects: Array<{
    id: string;
    name: string;
    report_count: number;
  }>;
}

export interface ReportTrend {
  days: number;
  trend: Array<{
    date: string;
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  }>;
}

export interface ProjectStats {
  id: string;
  name: string;
  created_at: string;
  total_reports: number;
  open_reports: number;
  in_progress_reports: number;
  resolved_reports: number;
  closed_reports: number;
  critical_reports: number;
  last_report_at: string | null;
}
