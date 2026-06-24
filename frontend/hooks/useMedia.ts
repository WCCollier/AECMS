import useSWR from 'swr';
import { adminFetcher } from '@/lib/swr';
import type { Media, PaginatedResponse } from '@/types';

interface UseMediaOptions {
  page?: number;
  limit?: number;
  search?: string;
  mimeFilter?: string;
}

export function useMedia(options: UseMediaOptions = {}) {
  const { page = 1, limit = 20, search, mimeFilter } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (search) params.set('search', search);
  if (mimeFilter) params.set('mime_type', mimeFilter);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Media>>(
    `/media?${params.toString()}`,
    adminFetcher,
  );

  return {
    media: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    totalPages: data?.meta?.total_pages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
