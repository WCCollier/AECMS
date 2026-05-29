import Image from 'next/image';
import Link from 'next/link';
import { Article } from '@/types';
import { FileText, Calendar } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const hasImage = !!article.featured_image_url;

  return (
    <Link href={`/latest/${article.slug}`} className="group">
      <article className="h-full bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-colors">
        {/* Only render image block when there's an actual image */}
        {hasImage && (
          <div className="aspect-video relative bg-surface-raised">
            <Image
              src={article.featured_image_url!}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <div className="p-5 flex flex-col h-full">
          {/* Category */}
          {article.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {article.categories.slice(0, 2).map((cat) => (
                <span
                  key={cat.id}
                  className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          <h2 className="text-base font-semibold mb-2 group-hover:text-accent transition-colors line-clamp-2 leading-snug">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="text-sm text-foreground/50 mb-3 line-clamp-2 flex-1">
              {article.excerpt}
            </p>
          )}

          {article.published_at && (
            <span className="flex items-center gap-1 text-xs text-muted mt-auto">
              <Calendar className="w-3 h-3" />
              {formatDate(article.published_at)}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
