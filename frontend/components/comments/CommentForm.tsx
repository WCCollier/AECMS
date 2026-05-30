'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';
import { StarInput } from './StarInput';
import api, { getErrorMessage } from '@/lib/api';
import { Plus, Minus } from 'lucide-react';

interface RatingEntry {
  title: string;
  value: number;
}

interface CommentFormProps {
  articleId?: string;
  productId?: string;
  parentId?: string;
  isProduct?: boolean;
  verifiedPurchase?: boolean;
  // Edit mode — when set, PATCHes the existing comment instead of POSTing
  commentId?: string;
  initialContent?: string;
  initialTitle?: string;
  initialRatings?: RatingEntry[];
  onSuccess: () => void;
  onCancel?: () => void;
}

export function CommentForm({
  articleId,
  productId,
  parentId,
  isProduct,
  verifiedPurchase,
  commentId,
  initialContent = '',
  initialTitle = '',
  initialRatings = [],
  onSuccess,
  onCancel,
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [reviewTitle, setReviewTitle] = useState(initialTitle);
  const [ratings, setRatings] = useState<RatingEntry[]>(initialRatings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isReply = !!parentId;
  // Verified purchasers can rate products; all logged-in users can rate articles
  const canRate = !isReply && (!isProduct || !!verifiedPurchase);
  const isReview = ratings.length > 0;

  function addRating() {
    setRatings([{ title: 'Overall', value: 0 }]);
  }

  function removeRating(index: number) {
    setRatings(ratings.filter((_, i) => i !== index));
  }

  function updateRating(index: number, value: number) {
    setRatings(ratings.map((r, i) => (i === index ? { ...r, value } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (isReview && ratings.some((r) => r.value === 0)) {
      setError('Please select a star value for each rating.');
      return;
    }

    setLoading(true);
    try {
      if (commentId) {
        await api.patch(`/comments/${commentId}`, {
          content,
          title: reviewTitle || null,
          ratings: ratings.map(({ title, value }) => ({ title, value })),
        });
      } else {
        await api.post('/comments', {
          article_id: articleId,
          product_id: productId,
          parent_id: parentId,
          title: reviewTitle || null,
          content,
          ratings: ratings.map(({ title, value }) => ({ title, value })),
        });
      }
      onSuccess();
      if (!commentId) {
        setContent('');
        setReviewTitle('');
        setRatings([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <p className="text-sm text-foreground/50">
        <Link href="/auth/login" className="text-accent hover:underline">
          Sign in
        </Link>{' '}
        to leave a comment.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Rating section — hidden for replies */}
      {!isReply && (
        <div className="space-y-2">
          {ratings.map((rating, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-foreground/60 w-16 shrink-0">{rating.title}</span>
              <StarInput value={rating.value} onChange={(v) => updateRating(i, v)} />
              <button
                type="button"
                onClick={() => removeRating(i)}
                className="ml-auto p-1 text-foreground/40 hover:text-red-400 transition-colors rounded"
                aria-label={`Remove ${rating.title} rating`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {ratings.length === 0 && canRate && (
            <button
              type="button"
              onClick={addRating}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Plus className="w-3 h-3" />
              Add a rating
            </button>
          )}

          {isProduct && !verifiedPurchase && (
            <p className="text-xs text-foreground/40">
              Purchase this product to leave a star rating.
            </p>
          )}
        </div>
      )}

      {/* Review headline — only when ratings are present */}
      {isReview && (
        <Input
          label="Review headline (optional)"
          type="text"
          value={reviewTitle}
          onChange={(e) => setReviewTitle(e.target.value)}
          placeholder="Summarize your review"
        />
      )}

      {/* Comment body */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {isReply ? 'Reply' : isReview ? 'Your review' : 'Comment'}
        </label>
        <textarea
          className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          minLength={3}
          placeholder={isReply ? 'Write a reply…' : 'Write your comment…'}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" isLoading={loading}>
          {commentId ? 'Save Changes' : isReply ? 'Post Reply' : 'Post Comment'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
