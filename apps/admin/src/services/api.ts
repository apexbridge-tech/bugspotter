import { api } from '../lib/api-client';
import type {
  AuthResponse,
  SetupStatus,
  SetupRequest,
  InstanceSettings,
  Project,
  HealthStatus,
} from '../types';

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

export const setupService = {
  getStatus: async (): Promise<SetupStatus> => {
    const response = await api.get<SetupStatus>('/setup/status');
    return response.data;
  },

  initialize: async (data: SetupRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/setup/initialize', data);
    return response.data;
  },

  testStorageConnection: async (data: {
    storage_type: string;
    storage_endpoint?: string;
    storage_access_key: string;
    storage_secret_key: string;
    storage_bucket: string;
    storage_region?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/setup/test-storage', data);
    return response.data;
  },
};

export const adminService = {
  getHealth: async (): Promise<HealthStatus> => {
    const response = await api.get<HealthStatus>('/admin/health');
    return response.data;
  },

  getSettings: async (): Promise<InstanceSettings> => {
    const response = await api.get<InstanceSettings>('/admin/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<InstanceSettings>): Promise<InstanceSettings> => {
    const response = await api.patch<InstanceSettings>('/admin/settings', data);
    return response.data;
  },
};

export const projectService = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>('/projects');
    return response.data;
  },

  create: async (name: string): Promise<Project> => {
    const response = await api.post<Project>('/projects', { name });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  regenerateApiKey: async (id: string): Promise<Project> => {
    const response = await api.post<Project>(`/projects/${id}/regenerate-key`);
    return response.data;
  },
};
