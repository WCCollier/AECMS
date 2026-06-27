'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useArticles } from '@/hooks/useArticles';
import { useProducts } from '@/hooks/useProducts';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { useInfiniteProducts } from '@/hooks/useInfiniteProducts';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { ProductCard } from '@/components/shop/ProductCard';
import { ArticlePreviewPane } from '@/components/widgets/SearchResultsEmbed/ArticlePreviewPane';
import { ArticleFullEmbed } from '@/components/widgets/SearchResultsEmbed/ArticleFullEmbed';
import { ProductPreviewPane } from '@/components/widgets/SearchResultsEmbed/ProductPreviewPane';
import { ProductFullEmbed } from '@/components/widgets/SearchResultsEmbed/ProductFullEmbed';
import { Button } from '@/components/ui';
import { ChevronRight } from 'lucide-react';

export interface SearchResultsWidgetProps {
  contentType: 'articles' | 'products';
  tags: string[];
  tagLogic: 'and' | 'or';
  excludeTags?: string[];
  excludeTagLogic?: 'any' | 'all';
  search: string;
  display: 'grid' | 'list' | 'preview' | 'full';
  pageSize: number;
  title: string;
  /** When true the widget can expand infinitely; false = always paginated */
  allowInfiniteScroll?: boolean;
  /** Recursion depth — passed down so embedded RichTextContent can skip nested embeds */
  depth?: number;
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
  excludeTags = [],
  excludeTagLogic = 'any',
  search,
  display,
  pageSize,
  title,
  allowInfiniteScroll = false,
  depth = 0,
}: SearchResultsWidgetProps) {
  // Viewer-togglable: start in infinite mode when allowed, paginated otherwise
  const [viewerMode, setViewerMode] = useState<'infinite' | 'paginated'>(
    allowInfiniteScroll ? 'infinite' : 'paginated',
  );
  const [page, setPage] = useState(1);

  const isInlineDisplay = display === 'preview' || display === 'full';

  // Sync viewer mode when prop changes (e.g. embed config update)
  useEffect(() => {
    setViewerMode(allowInfiniteScroll ? 'infinite' : 'paginated');
    setPage(1);
  }, [allowInfiniteScroll]);

  // ── Paginated queries ─────────────────────────────────────────────────────
  const articlePagedQuery = useArticles(
    contentType === 'articles' && viewerMode === 'paginated'
      ? { page, limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, excludeTags: excludeTags.length > 0 ? excludeTags : undefined, excludeTagLogic, search: search || undefined }
      : { limit: 0 },
  );
  const productPagedQuery = useProducts(
    contentType === 'products' && viewerMode === 'paginated'
      ? { page, limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, excludeTags: excludeTags.length > 0 ? excludeTags : undefined, excludeTagLogic, search: search || undefined }
      : { limit: 0 },
  );

  // ── Infinite queries ──────────────────────────────────────────────────────
  const articleInfiniteQuery = useInfiniteArticles(
    contentType === 'articles' && viewerMode === 'infinite'
      ? { limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, excludeTags: excludeTags.length > 0 ? excludeTags : undefined, excludeTagLogic, search: search || undefined }
      : { limit: 0 },
  );
  const productInfiniteQuery = useInfiniteProducts(
    contentType === 'products' && viewerMode === 'infinite'
      ? { limit: pageSize, tags: tags.length > 0 ? tags : undefined, tagLogic, excludeTags: excludeTags.length > 0 ? excludeTags : undefined, excludeTagLogic, search: search || undefined }
      : { limit: 0 },
  );

  // ── Sentinel for infinite scroll ──────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);
  const infiniteQuery = contentType === 'articles' ? articleInfiniteQuery : productInfiniteQuery;

  useEffect(() => {
    if (viewerMode !== 'infinite') return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && infiniteQuery.hasMore && !infiniteQuery.isFetchingMore) {
          infiniteQuery.loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewerMode, infiniteQuery]);

  // ── Derived display values ────────────────────────────────────────────────
  const isLoading =
    viewerMode === 'paginated'
      ? contentType === 'articles' ? articlePagedQuery.isLoading : productPagedQuery.isLoading
      : contentType === 'articles' ? articleInfiniteQuery.isLoading : productInfiniteQuery.isLoading;

  const totalPages =
    viewerMode === 'paginated'
      ? contentType === 'articles' ? articlePagedQuery.totalPages : productPagedQuery.totalPages
      : 0;

  const articles =
    viewerMode === 'paginated' ? articlePagedQuery.articles : articleInfiniteQuery.articles;
  const products =
    viewerMode === 'paginated' ? productPagedQuery.products : productInfiniteQuery.products;

  const hasResults = contentType === 'articles' ? articles.length > 0 : products.length > 0;

  const seeAllUrl = buildSeeAllUrl(contentType, tags, tagLogic, search);

  const gridClass =
    display === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
      : 'flex flex-col gap-3';

  // ── Inline (preview / full) renderers ─────────────────────────────────────
  if (!isLoading && isInlineDisplay) {
    if (!hasResults) {
      return <p className="text-sm text-foreground/50 py-6 text-center">No results found.</p>;
    }

    return (
      <div className="my-4">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        {contentType === 'articles'
          ? articles.map((a) =>
              display === 'preview'
                ? <ArticlePreviewPane key={a.id} article={a} depth={depth} />
                : <ArticleFullEmbed key={a.id} article={a} depth={depth} />
            )
          : products.map((p) =>
              display === 'preview'
                ? <ProductPreviewPane key={p.id} product={p} depth={depth} />
                : <ProductFullEmbed key={p.id} product={p} depth={depth} />
            )}

        {/* Paginated controls for inline display */}
        {viewerMode === 'paginated' && totalPages > 1 && (
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

        {viewerMode === 'infinite' && (
          <div className="mt-4 flex flex-col items-center gap-3">
            {infiniteQuery.isFetchingMore && (
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            {!infiniteQuery.hasMore && <p className="text-sm text-foreground/40">You&apos;ve seen everything</p>}
            <div ref={sentinelRef} className="h-1" />
          </div>
        )}
      </div>
    );
  }

  // ── Card (grid / list) renderer ───────────────────────────────────────────
  return (
    <div className="my-4">
      {/* Header row: title + viewer mode toggle */}
      {(title || allowInfiniteScroll) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {allowInfiniteScroll && (
            <button
              type="button"
              onClick={() => {
                setViewerMode((m) => (m === 'infinite' ? 'paginated' : 'infinite'));
                setPage(1);
              }}
              className="text-xs text-foreground/50 hover:text-foreground border border-foreground/20 rounded-full px-2.5 py-0.5 transition-colors"
            >
              {viewerMode === 'infinite' ? 'Paginated' : 'Infinite scroll'}
            </button>
          )}
        </div>
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

          {/* Paginated controls */}
          {viewerMode === 'paginated' && totalPages > 1 && (
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

          {/* Infinite scroll sentinel + status */}
          {viewerMode === 'infinite' && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {infiniteQuery.isFetchingMore && (
                <div className="flex gap-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
              {!infiniteQuery.hasMore && hasResults && (
                <p className="text-sm text-foreground/40">You&apos;ve seen everything</p>
              )}
              <div ref={sentinelRef} className="h-1" />
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
