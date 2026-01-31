import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Product, PaginatedResponse } from '@/types';

interface UseProductsOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { page = 1, limit = 12, category, search } = options;

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (category) params.set('category', category);
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Product>>(
    `/products?${params.toString()}`,
    fetcher
  );

  return {
    products: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 0,
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
