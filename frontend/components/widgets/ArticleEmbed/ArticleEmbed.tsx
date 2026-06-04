'use client';

import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { FileText, ArrowRight } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';
import { stripWidgetNodes, extractFirstParagraphText } from '@/lib/stripWidgetNodes';
import type { Article } from '@/types';

interface ArticleEmbedProps {
  articleId: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getExcerpt(article: Article): string {
  if (article.excerpt) return article.excerpt;
  if (!article.content) return '';
  try {
    const doc = JSON.parse(article.content);
    const clean = stripWidgetNodes(doc);
    return extractFirstParagraphText(clean);
  } catch {
    return '';
  }
}

export function ArticleEmbed({ articleId }: ArticleEmbedProps) {
  const size = useWidgetSize();
  const { data: article, isLoading } = useSWR<Article>(
    articleId ? `/articles/${articleId}` : null,
    fetcher,
  );

  if (isLoading || !article) {
    return (
      <div className={`animate-pulse border border-border rounded-lg overflow-hidden my-4 ${
        size === 'small' ? 'flex gap-3 p-3' : ''
      }`}>
        {size === 'small' ? (
          <>
            <div className="w-20 h-16 bg-foreground/10 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-foreground/10 rounded w-3/4" />
              <div className="h-3 bg-foreground/10 rounded w-1/2" />
            </div>
          </>
        ) : (
          <>
            <div className="aspect-video bg-foreground/10" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-foreground/10 rounded w-3/4" />
              <div className="h-3 bg-foreground/10 rounded" />
              <div className="h-3 bg-foreground/10 rounded w-2/3" />
            </div>
          </>
        )}
      </div>
    );
  }

  const href = `/latest/${article.slug}`;
  const excerpt = getExcerpt(article);
  const primaryImage = article.media?.find((m) => m.is_primary) ?? article.media?.[0];
  const imageUrl = primaryImage?.url ?? article.featured_image_url ?? null;

  if (size === 'small') {
    return (
      <Link
        href={href}
        className="flex gap-3 p-3 border border-border rounded-lg my-2 hover:bg-surface-raised transition-colors no-underline group"
      >
        {imageUrl ? (
          <div className="relative w-20 h-16 flex-shrink-0 rounded overflow-hidden bg-foreground/10">
            <Image src={imageUrl} alt={article.title} fill className="object-cover" sizes="80px" />
          </div>
        ) : (
          <div className="w-20 h-16 flex-shrink-0 rounded bg-foreground/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-foreground/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors">{article.title}</p>
          {excerpt && (
            <p className="text-xs text-foreground/60 line-clamp-1 mt-0.5">{excerpt}</p>
          )}
          <span className="text-xs text-accent mt-1 inline-block">Read more →</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden my-4">
      {imageUrl && (
        <div className="relative aspect-video bg-foreground/10">
          <Image src={imageUrl} alt={article.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" />
        </div>
      )}
      <div className="p-4">
        {article.categories && article.categories.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {article.categories.map((cat) => (
              <span key={cat.id} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                {cat.name}
              </span>
            ))}
          </div>
        )}
        <Link href={href} className="group">
          <h3 className="text-lg font-semibold group-hover:text-accent transition-colors">{article.title}</h3>
        </Link>
        {article.published_at && (
          <p className="text-xs text-foreground/50 mt-1">{formatDate(article.published_at)}</p>
        )}
        {excerpt && (
          <p className="text-sm text-foreground/70 mt-2 line-clamp-3">{excerpt}</p>
        )}
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-3"
        >
          Read more <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
