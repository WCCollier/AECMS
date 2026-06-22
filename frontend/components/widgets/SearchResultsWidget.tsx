'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useArticles } from '@/hooks/useArticles';
import { useProducts } from '@/hooks/useProducts';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui';
import { ChevronRight } from 'lucide-react';

export interface SearchResultsWidgetProps {
  contentType: 'articles' | 'products';
  tags: string[];
  tagLogic: 'and' | 'or';
  search: string;
  display: 'grid' | 'list';
  pageSize: number;
  title: string;
}

function buildSeeAllUrl(contentType: 'articles' | 'products', tags: string[], tagLogic: 'and' | 'or', search: string) {
  const base = contentType === 'articles' ? '/articles' : '/shop';
  const params = new URLSearchParams();
  if (tags.length > 0) {
    params.set('tags', tags.join(','));
    if (tagLogic === 'or' && tags.length >= 2) params.set('tag_logic', 'or');
  }
  if (search) params.set('search', search);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function SearchResultsWidget({
  contentType,
  tags,
  tagLogic,
  search,
  display,
  pageSize,
  title,
}: SearchResultsWidgetProps) {
  const [page, setPage] = useState(1);

  const articleQuery = useArticles(
    contentType === 'articles'
      ? { page, limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, search: search || undefined }
      : { limit: 0 },
  );

  const productQuery = useProducts(
    contentType === 'products'
      ? { page, limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, search: search || undefined }
      : { limit: 0 },
  );

  const isLoading = contentType === 'articles' ? articleQuery.isLoading : productQuery.isLoading;
  const totalPages = contentType === 'articles' ? articleQuery.totalPages : productQuery.totalPages;
  const articles = articleQuery.articles;
  const products = productQuery.products;
  const hasResults = contentType === 'articles' ? articles.length > 0 : products.length > 0;

  const seeAllUrl = buildSeeAllUrl(contentType, tags, tagLogic, search);

  const gridClass =
    display === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
      : 'flex flex-col gap-3';

  return (
    <div className="my-4">
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}

      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} className="animate-pulse bg-surface rounded-xl h-32" />
          ))}
        </div>
      ) : !hasResults ? (
        <p className="text-sm text-foreground/50 py-6 text-center">No results found.</p>
      ) : (
        <>
          <div className={gridClass}>
            {contentType === 'articles'
              ? articles.map((a) => <ArticleCard key={a.id} article={a} />)
              : products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-foreground/60">
                {page} / {totalPages}
              </span>
              <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          )}

          {/* See all link */}
          <div className="mt-4 flex justify-end">
            <Link
              href={seeAllUrl}
              className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
