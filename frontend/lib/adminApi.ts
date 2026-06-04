import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  getAdminAccessToken,
  setAdminAccessToken,
  getAdminRefreshToken,
  setAdminRefreshToken,
  clearAdminSession,
} from './api';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api-proxy'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

// Separate Axios instance for backstage API calls.
// Uses admin_access_token / admin_refresh_token — never touches the customer session.
export const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

adminApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAdminAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

adminApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getAdminRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          setAdminAccessToken(accessToken);
          setAdminRefreshToken(newRefreshToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return adminApi(originalRequest);
        }
      } catch {
        // Refresh failed — clear backstage session and redirect to admin login
        clearAdminSession();
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default adminApi;
