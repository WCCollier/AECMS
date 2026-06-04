import { SWRConfiguration } from 'swr';
import api from './api';
import adminApi from './adminApi';

// Default SWR fetcher — uses customer session
export const fetcher = async <T>(url: string): Promise<T> => {
  const response = await api.get<T>(url);
  return response.data;
};

// Fetcher for admin (backstage) pages — uses admin session token
export const adminFetcher = async <T>(url: string): Promise<T> => {
  const response = await adminApi.get<T>(url);
  return response.data;
};

// Default SWR configuration
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  dedupingInterval: 2000,
};
