'use client';

import Link from 'next/link';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { Article } from '@/types';

interface ArticleFullEmbedProps {
  article: Article;
  depth: number;
}

export function ArticleFullEmbed({ article, depth }: ArticleFullEmbedProps) {
  const authorName = [article.author?.first_name, article.author?.last_name].filter(Boolean).join(' ') || article.author?.email || '';
  const publishedDate = article.published_at ? new Date(article.published_at).toLocaleDateString() : '';

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-2">
        <Link href={`/articles/${article.slug}`} className="hover:text-accent transition-colors">
          {article.title}
        </Link>
      </h2>

      {(authorName || publishedDate) && (
        <p className="text-sm text-foreground/50 mb-2">
          {authorName && <span>{authorName}</span>}
          {authorName && publishedDate && <span className="mx-2">·</span>}
          {publishedDate && <span>{publishedDate}</span>}
        </p>
      )}

      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {article.tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface border border-border text-foreground/60">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <RichTextContent
        content={article.content ?? ''}
        depth={depth + 1}
      />

      <hr className="mt-8 border-border" />
    </div>
  );
}
