import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/swr';
import type { Product, PaginatedResponse } from '@/types';

interface Options {
  limit?: number;
  search?: string;
  tags?: string[];
  tagLogic?: 'and' | 'or';
  excludeTags?: string[];
  excludeTagLogic?: 'any' | 'all';
}

const LIMIT = 12;

export function useInfiniteProducts({ limit = LIMIT, search, tags, tagLogic, excludeTags, excludeTagLogic }: Options = {}) {
  const getKey = (pageIndex: number, previousData: PaginatedResponse<Product> | null) => {
    if (previousData) {
      const meta = previousData.meta ?? previousData;
      const total = meta.total ?? 0;
      const loaded = (pageIndex) * limit;
      if (loaded >= total) return null; // reached end
    }

    const params = new URLSearchParams();
    params.set('page', (pageIndex + 1).toString());
    params.set('limit', limit.toString());
    if (search) params.set('search', search);
    if (tags && tags.length > 0) {
      params.set('tags', tags.join(','));
      if (tagLogic === 'or') params.set('tag_logic', 'or');
    }
    if (excludeTags && excludeTags.length > 0) {
      params.set('exclude_tags', excludeTags.join(','));
      if (excludeTagLogic === 'all') params.set('exclude_tag_logic', 'all');
    }
    return `/products?${params.toString()}`;
  };

  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite<PaginatedResponse<Product>>(
    getKey,
    fetcher,
    { revalidateFirstPage: false }
  );

  const pages = data ?? [];
  const products: Product[] = pages.flatMap((page) => page.data ?? []);
  const total = pages[0]?.meta?.total ?? pages[0]?.total ?? 0;
  const hasMore = products.length < total;
  const isFetchingMore = isValidating && size > (data?.length ?? 0);

  const loadMore = () => setSize((s) => s + 1);

  return { products, total, hasMore, isLoading, isFetchingMore, loadMore };
}
