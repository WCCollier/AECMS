import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// In the browser, use the proxy path so all requests stay on the same origin.
// In Node.js (SSR/server actions), fall back to direct backend URL.
const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api-proxy'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Token storage (client-side only)
let accessToken: string | null = null;

// Anonymous session ID for guest cart
const SESSION_ID_KEY = 'aecms_session_id';

export const getSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem('access_token', token);
  } else if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('access_token');
  }
  return accessToken;
};

// Request interceptor - add auth token and anonymous session ID
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (config.headers) {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Inject guest session ID for anonymous cart support
        const sessionId = getSessionId();
        if (sessionId) {
          config.headers['x-session-id'] = sessionId;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refresh_token')
          : null;

        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          setAccessToken(accessToken);

          if (typeof window !== 'undefined') {
            localStorage.setItem('refresh_token', newRefreshToken);
          }

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        }
      } catch (_refreshError) {
        // Refresh failed - clear tokens and redirect to login
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refresh_token');
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// API response types
export interface ApiError {
  message: string;
  error?: string;
  statusCode: number;
}

// Helper to extract error message
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;
    return apiError?.message || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};

export default api;
