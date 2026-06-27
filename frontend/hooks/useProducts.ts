import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Product, PaginatedResponse } from '@/types';

interface UseProductsOptions {
  page?: number;
  limit?: number;
  tags?: string[];
  tagLogic?: 'and' | 'or';
  excludeTags?: string[];
  excludeTagLogic?: 'any' | 'all';
  search?: string;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { page = 1, limit = 12, tags, tagLogic, excludeTags, excludeTagLogic, search } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (tags && tags.length > 0) {
    params.set('tags', tags.join(','));
    if (tagLogic === 'or') params.set('tag_logic', 'or');
  }
  if (excludeTags && excludeTags.length > 0) {
    params.set('exclude_tags', excludeTags.join(','));
    if (excludeTagLogic === 'all') params.set('exclude_tag_logic', 'all');
  }
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Product>>(
    `/products?${params.toString()}`,
    fetcher
  );

  return {
    products: data?.data ?? [],
    total: data?.meta?.total ?? data?.total ?? 0,
    totalPages: data?.meta?.total_pages ?? data?.total_pages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useProduct(idOrSlug: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Product>(
    idOrSlug ? `/products/slug/${idOrSlug}` : null,
    fetcher
  );

  return {
    product: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
