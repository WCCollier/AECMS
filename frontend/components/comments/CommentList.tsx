'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Star } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { CommentForm } from './CommentForm';
import { CommentCard } from './CommentCard';
import type { Comment, PaginatedResponse } from '@/types';

interface CommentListProps {
  articleId?: string;
  productId?: string;
  verifiedPurchase?: boolean;
}

function averageOverallRating(comments: Comment[]): number | null {
  const values = comments
    .flatMap((c) => c.ratings)
    .filter((r) => r.title === 'Overall')
    .map((r) => r.value);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function CommentList({ articleId, productId, verifiedPurchase }: CommentListProps) {
  const { user } = useAuth();
  const [limit, setLimit] = useState(20);

  const endpoint = articleId
    ? `/comments/article/${articleId}?page=1&limit=${limit}`
    : `/comments/product/${productId}?page=1&limit=${limit}`;

  const { data, mutate, isLoading } = useSWR<PaginatedResponse<Comment>>(
    articleId || productId ? endpoint : null,
    fetcher,
    { keepPreviousData: true },
  );

  const comments = data?.data ?? [];
  const total = data?.total ?? data?.meta?.total ?? 0;
  const totalPages = data?.total_pages ?? data?.meta?.total_pages ?? 1;
  const hasMore = limit < (total);
  const avg = averageOverallRating(comments);
  const label = productId ? 'Reviews' : 'Comments';

  return (
    <section className="mt-12 border-t border-border pt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          {label} ({total})
        </h2>
        {avg !== null && (
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-foreground/50">avg rating</span>
          </div>
        )}
      </div>

      {/* Post / edit form */}
      <div className="mb-8 p-4 bg-surface border border-border rounded-xl">
        <p className="text-sm font-semibold mb-3 text-foreground/70">
          {user ? `Leave a ${productId ? 'review or comment' : 'comment'}` : 'Join the conversation'}
        </p>
        <CommentForm
          articleId={articleId}
          productId={productId}
          isProduct={!!productId}
          verifiedPurchase={verifiedPurchase}
          onSuccess={() => mutate()}
        />
      </div>

      {/* Comment list */}
      {isLoading && comments.length === 0 ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-2 py-4 border-b border-border">
              <div className="h-4 bg-foreground/10 rounded w-1/4" />
              <div className="h-3 bg-foreground/10 rounded w-full" />
              <div className="h-3 bg-foreground/10 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-foreground/40 text-center py-10">
          No {label.toLowerCase()} yet. Be the first!
        </p>
      ) : (
        <>
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onMutate={() => mutate()}
              productId={productId}
              verifiedPurchase={verifiedPurchase}
            />
          ))}
          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((l) => l + 20)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
