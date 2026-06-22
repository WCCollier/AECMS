import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Tag } from '@/types';

export function useTags() {
  const { data, error, isLoading } = useSWR<Tag[]>('/tags', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000, // 5 minutes
  });

  return {
    tags: data ?? [],
    isLoading,
    isError: !!error,
  };
}
