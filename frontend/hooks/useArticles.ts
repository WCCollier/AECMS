import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Article, PaginatedResponse } from '@/types';

interface UseArticlesOptions {
  page?: number;
  limit?: number;
  tag?: string;
  tags?: string[];
  tagLogic?: 'and' | 'or';
  excludeTags?: string[];
  excludeTagLogic?: 'any' | 'all';
  search?: string;
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { page = 1, limit = 10, tag, tags, tagLogic, excludeTags, excludeTagLogic, search } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (tags && tags.length > 0) {
    params.set('tags', tags.join(','));
    if (tagLogic === 'or') params.set('tag_logic', 'or');
  } else if (tag) {
    params.set('tag', tag);
  }
  if (excludeTags && excludeTags.length > 0) {
    params.set('exclude_tags', excludeTags.join(','));
    if (excludeTagLogic === 'all') params.set('exclude_tag_logic', 'all');
  }
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Article>>(
    `/articles?${params.toString()}`,
    fetcher
  );

  return {
    articles: data?.data ?? [],
    total: data?.meta?.total ?? data?.total ?? 0,
    totalPages: data?.meta?.total_pages ?? data?.total_pages ?? 0,
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
