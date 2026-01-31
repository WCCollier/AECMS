import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Article, PaginatedResponse } from '@/types';

interface UseArticlesOptions {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { page = 1, limit = 10, category, tag, search } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Article>>(
    `/articles?${params.toString()}`,
    fetcher
  );

  return {
    articles: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useArticle(slug: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Article>(
    slug ? `/articles/by-slug/${slug}` : null,
    fetcher
  );

  return {
    article: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
