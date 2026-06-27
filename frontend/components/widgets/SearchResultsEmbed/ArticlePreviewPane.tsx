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
    <div className="relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Centered flex column — content + button share the same horizontal axis */}
      <div className="flex flex-col h-full overflow-hidden max-w-3xl mx-auto px-6 md:px-10">
        <div className="flex-1 overflow-hidden pt-8">
          <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
          {(authorName || publishedDate) && (
            <p className="text-sm text-foreground/50 mb-4">
              {authorName && <span>{authorName}</span>}
              {authorName && publishedDate && <span className="mx-2">·</span>}
              {publishedDate && <span>{publishedDate}</span>}
            </p>
          )}
          {/* max-w-none overrides the 68ch cap — outer column provides the width constraint */}
          <RichTextContent
            content={article.content ?? ''}
            className="prose-article max-w-none"
            depth={depth + 1}
          />
        </div>

        {/* Button lives in the same column so it aligns with the text */}
        <div className="py-6 flex justify-center relative z-10">
          <Link
            href={`/articles/${article.slug}`}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-sm font-medium hover:bg-accent/80 transition-colors"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            Continue reading →
          </Link>
        </div>
      </div>

      {/* Fade overlay — spans the full pane width; --color-background is the correct variable */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0"
        style={{
          height: '40%',
          background: 'linear-gradient(to bottom, transparent, var(--color-background))',
        }}
      />
    </div>
  );
}
