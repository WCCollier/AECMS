'use client';

import { useState } from 'react';
import { Star, BadgeCheck, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api, { getErrorMessage } from '@/lib/api';
import { CommentForm } from './CommentForm';
import type { Comment } from '@/types';

interface CommentCardProps {
  comment: Comment;
  onMutate: () => void;
  productId?: string;
  verifiedPurchase?: boolean;
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-foreground/20'}`}
        />
      ))}
    </div>
  );
}

function authorName(user: Comment['user']): string {
  if (!user) return 'Anonymous';
  if (user.first_name || user.last_name)
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  return user.email.split('@')[0];
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CommentCard({ comment, onMutate, productId, verifiedPurchase }: CommentCardProps) {
  const { user } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const overallRating = comment.ratings.find((r) => r.title === 'Overall');
  const isOwn = !!user && user.id === comment.user_id;
  const name = authorName(comment.user);

  async function handleDelete() {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${comment.id}`);
      onMutate();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  }

  if (editing) {
    return (
      <div className="py-4 border-b border-border last:border-0">
        <CommentForm
          commentId={comment.id}
          articleId={comment.article_id ?? undefined}
          productId={comment.product_id ?? undefined}
          isProduct={!!comment.product_id}
          verifiedPurchase={verifiedPurchase}
          initialContent={comment.content}
          initialTitle={comment.title ?? ''}
          initialRatings={comment.ratings.map(({ title, value }) => ({ title, value }))}
          onSuccess={() => {
            setEditing(false);
            onMutate();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="py-4 border-b border-border last:border-0">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{name}</span>
              {comment.verified_purchase && (
                <span className="inline-flex items-center gap-1 text-xs text-green-500 font-medium shrink-0">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verified Purchase
                </span>
              )}
            </div>
            <span className="text-xs text-foreground/40">{formatDate(comment.created_at)}</span>
          </div>
        </div>

        {isOwn && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-foreground/40 hover:text-accent transition-colors rounded"
              aria-label="Edit comment"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 text-foreground/40 hover:text-red-400 transition-colors rounded"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Rating + headline */}
      {overallRating && (
        <div className="mb-1">
          <StarDisplay value={overallRating.value} />
        </div>
      )}
      {comment.title && (
        <p className="text-sm font-semibold mb-1">{comment.title}</p>
      )}

      {/* Body */}
      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.content}</p>

      {deleteError && <p className="text-xs text-red-500 mt-1">{deleteError}</p>}

      {/* Reply link — only on top-level comments */}
      {!comment.parent_id && user && (
        <button
          onClick={() => setShowReply(!showReply)}
          className="mt-2 text-xs text-accent hover:underline"
        >
          {showReply ? 'Cancel' : 'Reply'}
        </button>
      )}

      {/* Inline reply form */}
      {showReply && (
        <div className="mt-3 ml-10">
          <CommentForm
            articleId={comment.article_id ?? undefined}
            productId={comment.product_id ?? undefined}
            parentId={comment.id}
            onSuccess={() => {
              setShowReply(false);
              onMutate();
            }}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}

      {/* Nested replies */}
      {(comment.replies?.length ?? 0) > 0 && (
        <div className="mt-3 ml-10 pl-4 border-l-2 border-border">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} onMutate={onMutate} />
          ))}
        </div>
      )}
    </div>
  );
}
