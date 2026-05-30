import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/swr';
import type { Article, PaginatedResponse } from '@/types';

interface Options {
  limit?: number;
  search?: string;
  category?: string;
  tag?: string;
}

const LIMIT = 9;

export function useInfiniteArticles({ limit = LIMIT, search, category, tag }: Options = {}) {
  const getKey = (pageIndex: number, previousData: PaginatedResponse<Article> | null) => {
    if (previousData) {
      const meta = previousData.meta ?? previousData;
      const total = meta.total ?? 0;
      const loaded = pageIndex * limit;
      if (loaded >= total) return null; // reached end
    }

    const params = new URLSearchParams();
    params.set('page', (pageIndex + 1).toString());
    params.set('limit', limit.toString());
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    return `/articles?${params.toString()}`;
  };

  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite<PaginatedResponse<Article>>(
    getKey,
    fetcher,
    { revalidateFirstPage: false }
  );

  const pages = data ?? [];
  const articles: Article[] = pages.flatMap((page) => page.data ?? []);
  const total = pages[0]?.meta?.total ?? pages[0]?.total ?? 0;
  const hasMore = articles.length < total;
  const isFetchingMore = isValidating && size > (data?.length ?? 0);

  const loadMore = () => setSize((s) => s + 1);

  return { articles, total, hasMore, isLoading, isFetchingMore, loadMore };
}
