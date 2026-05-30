'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useArticles } from '@/hooks/useArticles';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { Button, Input } from '@/components/ui';
import { Search, X } from 'lucide-react';

export function LatestPageClient() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get('category') ?? undefined;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Reset to page 1 when category filter changes
  useEffect(() => { setPage(1); }, [categoryParam]);

  const { articles, totalPages, isLoading, isError } = useArticles({
    page,
    limit: 9,
    category: categoryParam,
    search: search || undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Latest</h1>
          <p className="text-foreground/60 mt-1">
            {categoryParam
              ? <>Filtered by: <span className="text-accent font-medium capitalize">{categoryParam.replace(/-/g, ' ')}</span></>
              : 'Articles and updates'}
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          {search ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit" variant="secondary">Search</Button>
          )}
        </form>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-surface rounded-xl p-5 h-32" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">Failed to load articles. Please try again.</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">
            {search
              ? `No articles found for "${search}"`
              : categoryParam
              ? `No articles found in "${categoryParam.replace(/-/g, ' ')}"`
              : 'No articles published yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-foreground/60">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
