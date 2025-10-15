export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
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
