'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProducts } from '@/hooks/useProducts';
import { useInfiniteProducts } from '@/hooks/useInfiniteProducts';
import { useViewMode } from '@/contexts/ViewModeContext';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button, ViewModeToggle, UnifiedSearchInput } from '@/components/ui';

const LIMIT = 12;

export function ShopPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useViewMode();

  const urlPage = parseInt(searchParams?.get('page') ?? '', 10);
  const forcePaginated = !isNaN(urlPage) && urlPage > 0;
  const effectiveMode = forcePaginated ? 'paginated' : mode;

  const [page, setPage] = useState(forcePaginated ? urlPage : 1);
  const [search, setSearch] = useState(() => searchParams?.get('search') ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const raw = searchParams?.get('tags') ?? searchParams?.get('tag') ?? '';
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  });
  const [tagLogic, setTagLogic] = useState<'and' | 'or'>(() =>
    searchParams?.get('tag_logic') === 'or' ? 'or' : 'and',
  );

  // Track what was last committed to the URL so the search button can show ×
  const [committedTags, setCommittedTags] = useState<string[]>(selectedTags);
  const [committedSearch, setCommittedSearch] = useState(search);

  // Sync all filter state from URL — handles external navigation (e.g. tag chip clicks on tiles)
  useEffect(() => {
    const raw = searchParams?.get('tags') ?? searchParams?.get('tag') ?? '';
    const tags = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const logic = searchParams?.get('tag_logic') === 'or' ? 'or' : 'and';
    const srch = searchParams?.get('search') ?? '';

    setSelectedTags(tags);
    setTagLogic(logic);
    setSearch(srch);
    setCommittedTags(tags);
    setCommittedSearch(srch);
    setPage(1);
  }, [searchParams]);

  const buildParams = (p: number, tags: string[], logic: 'and' | 'or', srch: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (p === 1) params.delete('page'); else params.set('page', p.toString());
    if (tags.length > 0) {
      params.set('tags', tags.join(','));
      params.delete('tag');
    } else {
      params.delete('tags');
      params.delete('tag');
    }
    if (logic === 'or' && tags.length >= 2) params.set('tag_logic', 'or');
    else params.delete('tag_logic');
    if (srch) params.set('search', srch); else params.delete('search');
    return params.toString();
  };

  const updateUrl = useCallback((p: number, tags: string[], logic: 'and' | 'or', srch: string) => {
    const qs = buildParams(p, tags, logic, srch);
    router.replace(`/shop${qs ? `?${qs}` : ''}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  const handlePageChange = (next: number) => {
    setPage(next);
    updateUrl(next, selectedTags, tagLogic, search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (effectiveMode === 'infinite' && searchParams?.get('page')) {
      router.replace('/shop', { scroll: false });
    }
  }, [effectiveMode, router, searchParams]);

  const handleSearch = (tags: string[], logic: 'and' | 'or', srch: string) => {
    setSelectedTags(tags);
    setTagLogic(logic);
    setSearch(srch);
    setCommittedTags(tags);
    setCommittedSearch(srch);
    setPage(1);
    updateUrl(1, tags, logic, srch);
    if (effectiveMode === 'infinite') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClear = () => {
    setSelectedTags([]);
    setTagLogic('and');
    setSearch('');
    setCommittedTags([]);
    setCommittedSearch('');
    setPage(1);
    updateUrl(1, [], 'and', '');
    if (effectiveMode === 'infinite') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Paginated mode ────────────────────────────────────────────────────────
  const paginated = useProducts({
    page,
    limit: LIMIT,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    tagLogic,
    search: search || undefined,
  });

  // ── Infinite scroll mode ──────────────────────────────────────────────────
  const infinite = useInfiniteProducts({
    limit: LIMIT,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    tagLogic,
    search: search || undefined,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (effectiveMode !== 'infinite') return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && infinite.hasMore && !infinite.isFetchingMore) {
          infinite.loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [effectiveMode, infinite]);

  // ── Shared ────────────────────────────────────────────────────────────────
  const isLoading = effectiveMode === 'paginated' ? paginated.isLoading : infinite.isLoading;
  const isError = effectiveMode === 'paginated' ? paginated.isError : false;
  const products = effectiveMode === 'paginated' ? paginated.products : infinite.products;
  const totalPages = effectiveMode === 'paginated' ? paginated.totalPages : 0;
  const total = effectiveMode === 'paginated' ? (paginated.total ?? 0) : infinite.total;

  const hasActiveFilters = selectedTags.length > 0 || !!search;
  const isSearchActive =
    committedTags.join(',') === selectedTags.join(',') && committedSearch === search &&
    (committedTags.length > 0 || !!committedSearch);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Shop</h1>
            <p className="text-foreground/60 mt-1">Browse our products</p>
          </div>

          <UnifiedSearchInput
            initialTags={selectedTags}
            initialTagLogic={tagLogic}
            initialSearch={search}
            placeholder="Search products or filter by tag…"
            onSearch={handleSearch}
            onClear={handleClear}
            isSearchActive={isSearchActive}
          />
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(LIMIT)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-foreground/10 rounded-lg" />
              <div className="mt-4 h-4 bg-foreground/10 rounded w-3/4" />
              <div className="mt-2 h-4 bg-foreground/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">Failed to load products. Please try again.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">
            {hasActiveFilters
              ? 'No products match your current filters.'
              : 'No products available yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Result count + ViewModeToggle above grid */}
          <div className="flex items-center justify-between mb-4 text-sm text-foreground/50">
            <span>
              {total} {total === 1 ? 'product' : 'products'}
              {hasActiveFilters ? ' matching your filters' : ''}
            </span>
            <ViewModeToggle />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 8} />
            ))}
          </div>

          {/* Paginated controls */}
          {effectiveMode === 'paginated' && totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-foreground/60">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}

          {/* Infinite scroll sentinel + status */}
          {effectiveMode === 'infinite' && (
            <div className="mt-8 flex flex-col items-center gap-4">
              {infinite.isFetchingMore && (
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
              {!infinite.hasMore && products.length > 0 && (
                <p className="text-sm text-foreground/40">You&apos;ve seen everything</p>
              )}
              <div ref={sentinelRef} className="h-1" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
