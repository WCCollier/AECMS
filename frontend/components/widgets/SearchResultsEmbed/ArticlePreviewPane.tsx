'use client';

import Link from 'next/link';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { Article } from '@/types';

interface ArticlePreviewPaneProps {
  article: Article;
  depth: number;
}

export function ArticlePreviewPane({ article, depth }: ArticlePreviewPaneProps) {
  const authorName = [article.author?.first_name, article.author?.last_name].filter(Boolean).join(' ') || article.author?.email || '';
  const publishedDate = article.published_at ? new Date(article.published_at).toLocaleDateString() : '';

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <div className="p-6 md:p-10 h-full overflow-hidden">
        <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
        {(authorName || publishedDate) && (
          <p className="text-sm text-foreground/50 mb-4">
            {authorName && <span>{authorName}</span>}
            {authorName && publishedDate && <span className="mx-2">·</span>}
            {publishedDate && <span>{publishedDate}</span>}
          </p>
        )}
        <RichTextContent
          content={article.content ?? ''}
          depth={depth + 1}
        />
      </div>

      {/* Fade overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: '35%',
          background: 'linear-gradient(to bottom, transparent, var(--background))',
        }}
      />

      {/* Continue reading link */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <Link
          href={`/articles/${article.slug}`}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Continue reading →
        </Link>
      </div>
    </div>
  );
}
