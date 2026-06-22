'use client';

import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';
import { stripWidgetNodes, extractFirstParagraphText, extractAllText, stripHtml } from '@/lib/stripWidgetNodes';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { TitleAttrs, TitleLevel } from '@/components/editor/extensions/title-settings';
import type { Article } from '@/types';

interface ArticleEmbedProps {
  articleId:   string;
  titleAttrs?: TitleAttrs;
}

const LEVEL_CLASSES: Record<TitleLevel, string> = {
  h1:   'text-3xl font-bold',
  h2:   'text-2xl font-bold',
  h3:   'text-lg font-semibold',
  body: 'text-sm font-medium',
};

function TitleEl({
  text,
  level,
  titleCase,
  titleAlign,
  className = '',
}: {
  text:       string;
  level:      TitleLevel;
  titleCase:  TitleAttrs['titleCase'];
  titleAlign: TitleAttrs['titleAlign'];
  className?: string;
}) {
  const Tag = (level === 'body' ? 'p' : level) as keyof React.JSX.IntrinsicElements;
  const sizeClass  = LEVEL_CLASSES[level];
  const caseClass  = titleCase === 'uppercase' ? 'uppercase' : '';
  const alignClass = titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : '';
  return <Tag className={`${sizeClass} ${caseClass} ${alignClass} ${className}`.trim()}>{text}</Tag>;
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
    return extractFirstParagraphText(clean) || extractAllText(clean);
  } catch {
    return stripHtml(article.content);
  }
}

function getBodyContent(article: Article): string | null {
  if (!article.content) return null;
  try {
    return JSON.stringify(stripWidgetNodes(JSON.parse(article.content)));
  } catch {
    return article.content;
  }
}

const DEFAULT_TITLE_ATTRS: TitleAttrs = {
  titleOverride: '',
  titleCase:     'default',
  titleAlign:    'left',
  titleLevel:    'h3',
  titleHidden:   false,
};

export function ArticleEmbed({ articleId, titleAttrs = DEFAULT_TITLE_ATTRS }: ArticleEmbedProps) {
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

  const { titleOverride, titleCase, titleAlign, titleLevel, titleHidden } = titleAttrs;
  const displayTitle = titleOverride || article.title;
  const href = `/latest/${article.slug}`;
  const excerpt = getExcerpt(article);
  const bodyContent = getBodyContent(article);
  const primaryImage = article.media?.find((m) => m.is_primary) ?? article.media?.[0];
  const imageUrl = primaryImage?.url ?? article.featured_image_url ?? null;

  if (size === 'small') {
    const alignClass = titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : '';
    const caseClass  = titleCase === 'uppercase' ? 'uppercase' : '';
    return (
      <Link
        href={href}
        style={{ textDecoration: 'none', color: 'inherit' }}
        className="flex gap-3 p-3 border border-border rounded-lg my-2 hover:bg-surface-raised transition-colors group"
      >
        {imageUrl && (
          <div className="relative w-20 h-16 flex-shrink-0 rounded overflow-hidden bg-foreground/10">
            <Image src={imageUrl} alt={article.title} fill className="object-cover" sizes="80px" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {!titleHidden && (
            <p className={`font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors ${caseClass} ${alignClass}`.trim()}>
              {displayTitle}
            </p>
          )}
          {excerpt && (
            <p className="text-xs text-foreground/60 line-clamp-8 mt-0.5">{excerpt}</p>
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
        {article.tags && article.tags.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {article.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
            {article.tags.length > 3 && (
              <span className="text-xs bg-foreground/5 text-foreground/40 px-2 py-0.5 rounded-full">
                +{article.tags.length - 3}
              </span>
            )}
          </div>
        )}
        {!titleHidden && (
          <Link href={href} className="group">
            <TitleEl
              text={displayTitle}
              level={titleLevel}
              titleCase={titleCase}
              titleAlign={titleAlign}
              className="group-hover:text-accent transition-colors"
            />
          </Link>
        )}
        {article.published_at && (
          <p className={`text-xs text-foreground/50 mt-1 ${titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : ''}`.trim()}>{formatDate(article.published_at)}</p>
        )}
        {bodyContent && (
          <div className="relative overflow-hidden max-h-[1200px] mt-2">
            <RichTextContent content={bodyContent} className="prose-article prose-page" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        )}
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-3"
        >
          Continue reading <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
