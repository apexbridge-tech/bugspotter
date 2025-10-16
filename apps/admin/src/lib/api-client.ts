import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Store access token getter function that will be set by auth context
let getAccessToken: (() => string | null) | null = null;
let updateAccessToken: ((token: string) => void) | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: Send cookies with requests (for httpOnly refresh token)
});

/**
 * Set token accessor functions from auth context
 * This allows the API client to access tokens without importing React context
 */
export const setAuthTokenAccessors = (
  getter: () => string | null,
  updater: (token: string) => void
) => {
  getAccessToken = getter;
  updateAccessToken = updater;
};

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Get token from memory via accessor function (more secure than localStorage)
  const token = getAccessToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token is in httpOnly cookie, backend reads it automatically
        const response = await axios.post(
          `${API_BASE_URL}/v1/auth/refresh`,
          {}, // Empty body - refresh token comes from cookie
          { withCredentials: true } // Critical: Send httpOnly cookie
        );

        const { access_token } = response.data;

        // Update access token in memory via accessor function
        if (updateAccessToken) {
          updateAccessToken(access_token);
        }

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed (invalid/expired cookie or network error)
        sessionStorage.removeItem('user');

        // Clear legacy localStorage items
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
};
