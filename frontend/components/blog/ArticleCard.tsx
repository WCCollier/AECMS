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

  return (
    <Link href={`/latest/${article.slug}`} className="group">
      <article className="bg-background border border-foreground/10 rounded-lg overflow-hidden hover:border-foreground/20 transition-colors">
        {/* Image */}
        <div className="aspect-video relative bg-foreground/5">
          {article.featured_image_url ? (
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground/30">
              <FileText className="w-12 h-12" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Categories */}
          {article.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {article.categories.slice(0, 2).map((cat) => (
                <span
                  key={cat.id}
                  className="text-xs px-2 py-1 bg-foreground/5 rounded-full"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          <h2 className="text-lg font-semibold mb-2 group-hover:text-foreground/70 transition-colors line-clamp-2">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="text-sm text-foreground/60 mb-4 line-clamp-2">
              {article.excerpt}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-foreground/50">
            {article.author && (
              <span>{article.author.display_name || article.author.username}</span>
            )}
            {article.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(article.published_at)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
