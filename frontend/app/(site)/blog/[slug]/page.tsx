'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useArticle } from '@/hooks/useArticles';
import { ArrowLeft, Calendar, User, FileText } from 'lucide-react';

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { article, isLoading, isError } = useArticle(slug);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
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
        <Link href="/blog" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
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
      <Link href="/blog" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Blog
      </Link>

      {/* Featured Image */}
      {article.featured_image_url ? (
        <div className="aspect-video relative bg-foreground/5 rounded-lg overflow-hidden mb-8">
          <Image
            src={article.featured_image_url}
            alt={article.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      ) : (
        <div className="aspect-video relative bg-foreground/5 rounded-lg overflow-hidden mb-8 flex items-center justify-center">
          <FileText className="w-24 h-24 text-foreground/20" />
        </div>
      )}

      {/* Categories */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {article.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/blog?category=${cat.slug}`}
              className="text-sm px-3 py-1 bg-foreground/5 rounded-full hover:bg-foreground/10 transition-colors"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

      {/* Meta */}
      <div className="flex items-center gap-6 text-sm text-foreground/60 mb-8 pb-8 border-b border-foreground/10">
        {article.author && (
          <span className="flex items-center gap-2">
            <User className="w-4 h-4" />
            {article.author.display_name || article.author.username}
          </span>
        )}
        {article.published_at && (
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(article.published_at)}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        className="prose prose-lg max-w-none
          prose-headings:text-foreground
          prose-p:text-foreground/80
          prose-a:text-foreground prose-a:underline
          prose-strong:text-foreground
          prose-code:text-foreground prose-code:bg-foreground/10 prose-code:px-1 prose-code:rounded
          prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-foreground/10
          prose-blockquote:border-foreground/20 prose-blockquote:text-foreground/70
          prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

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
    </article>
  );
}
