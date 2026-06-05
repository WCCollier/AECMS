'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useArticle } from '@/hooks/useArticles';
import { ArrowLeft, Calendar, User, FileText } from 'lucide-react';
import { CommentList } from '@/components/comments/CommentList';
import { MediaGallery } from '@/components/widgets';
import { RichTextContent } from '@/components/editor';

export function ArticlePageClient() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const { article, isLoading, isError } = useArticle(slug || '');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!slug || isLoading || (!article && !isError)) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="animate-pulse">
          <div className="h-8 bg-foreground/10 rounded w-24 mb-8" />
          <div className="aspect-video bg-foreground/10 rounded-lg mb-8" />
          <div className="h-10 bg-foreground/10 rounded w-3/4 mb-4" />
          <div className="h-4 bg-foreground/10 rounded w-1/2 mb-8" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-foreground/10 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/latest" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Latest
        </Link>
        <div className="text-center py-12">
          <p className="text-foreground/60">Article not found.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back Link */}
      <Link href="/latest" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Latest
      </Link>

      {/* Hero media — single image or carousel depending on how many images the article has */}
      {(article.media?.length ?? 0) > 0 && (
        <div className="mb-8">
          <MediaGallery media={article.media ?? []} aspectRatio="video" />
        </div>
      )}

      {/* Categories */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {article.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/latest?category=${cat.slug}`}
              className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-full hover:bg-accent/20 transition-colors font-medium"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{article.title}</h1>

      {/* Meta */}
      <div className="flex items-center gap-6 text-sm text-muted mb-8 pb-6 border-b border-border">
        {article.published_at && (
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(article.published_at)}
          </span>
        )}
      </div>

      {/* Content */}
      <RichTextContent content={article.content} className="prose-article" />

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="mt-8 pt-8 border-t border-foreground/10">
          <h3 className="text-sm font-medium mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-sm px-3 py-1 bg-foreground/5 rounded-full"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <CommentList articleId={article.id} />
    </article>
  );
}
