import { api } from '../lib/api-client';
import type {
  AuthResponse,
  SetupStatus,
  SetupRequest,
  InstanceSettings,
  Project,
  HealthStatus,
  BugReport,
  BugReportFilters,
  BugReportListResponse,
  BugStatus,
  BugPriority,
  Session,
} from '../types';

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/v1/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/v1/auth/logout');
  },
};

export const setupService = {
  getStatus: async (): Promise<SetupStatus> => {
    const response = await api.get<{ success: boolean; data: SetupStatus }>('/v1/setup/status');
    return response.data.data;
  },

  initialize: async (data: SetupRequest): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>(
      '/v1/setup/initialize',
      data
    );
    return response.data.data;
  },

  testStorageConnection: async (data: {
    storage_type: string;
    storage_endpoint?: string;
    storage_access_key: string;
    storage_secret_key: string;
    storage_bucket: string;
    storage_region?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/v1/setup/test-storage', data);
    return response.data;
  },
};

export const adminService = {
  getHealth: async (): Promise<HealthStatus> => {
    const response = await api.get<{ success: boolean; data: HealthStatus }>('/v1/admin/health');
    return response.data.data;
  },

  getSettings: async (): Promise<InstanceSettings> => {
    const response = await api.get<{ success: boolean; data: InstanceSettings }>(
      '/v1/admin/settings'
    );
    return response.data.data;
  },

  updateSettings: async (data: Partial<InstanceSettings>): Promise<InstanceSettings> => {
    const response = await api.patch<{ success: boolean; data: InstanceSettings }>(
      '/v1/admin/settings',
      data
    );
    return response.data.data;
  },
};

export const projectService = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get<{ success: boolean; data: Project[] }>('/v1/projects');
    return response.data.data;
  },

  create: async (name: string): Promise<Project> => {
    const response = await api.post<{ success: boolean; data: Project }>('/v1/projects', { name });
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/projects/${id}`);
  },

  regenerateApiKey: async (id: string): Promise<Project> => {
    const response = await api.post<{ success: boolean; data: Project }>(
      `/v1/projects/${id}/regenerate-key`
    );
    return response.data.data;
  },
};

export const bugReportService = {
  getAll: async (
    filters?: BugReportFilters,
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    order: 'asc' | 'desc' = 'desc'
  ): Promise<BugReportListResponse> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    params.append('sort_by', sortBy);
    params.append('order', order);

    if (filters?.project_id) {
      params.append('project_id', filters.project_id);
    }
    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.priority) {
      params.append('priority', filters.priority);
    }
    if (filters?.created_after) {
      params.append('created_after', filters.created_after);
    }
    if (filters?.created_before) {
      params.append('created_before', filters.created_before);
    }

    const response = await api.get<{
      success: boolean;
      data: BugReport[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/v1/reports?${params.toString()}`);
    // Paginated responses have data and pagination at the root level after unwrapping
    return { data: response.data.data, pagination: response.data.pagination };
  },

  getById: async (id: string): Promise<BugReport> => {
    const response = await api.get<{ success: boolean; data: BugReport }>(`/v1/reports/${id}`);
    return response.data.data;
  },

  update: async (
    id: string,
    data: { status?: BugStatus; priority?: BugPriority; description?: string }
  ): Promise<BugReport> => {
    const response = await api.patch<{ success: boolean; data: BugReport }>(
      `/v1/reports/${id}`,
      data
    );
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/v1/reports/${id}`);
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await api.post('/v1/reports/bulk-delete', { ids });
  },

  getSessions: async (bugReportId: string): Promise<Session[]> => {
    const response = await api.get<{ success: boolean; data: Session[] }>(
      `/v1/reports/${bugReportId}/sessions`
    );
    return response.data.data;
  },
};
