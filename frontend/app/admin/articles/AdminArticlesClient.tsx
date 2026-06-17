'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { adminFetcher } from '@/lib/swr';
import adminApi from '@/lib/adminApi';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { Plus, Search, Edit, Trash2, FileText, RotateCcw, Trash } from 'lucide-react';
import type { Article, PaginatedResponse } from '@/types';

export function AdminArticlesClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [canAccessTrash, setCanAccessTrash] = useState(false);

  // Show trash toggle for anyone with delete.any OR delete.own
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('admin_user') : null;
    if (!stored) return;
    try {
      const user = JSON.parse(stored) as { id: string; role: string };
      adminApi.get(`/capabilities/users/${user.id}`).then((res) => {
        const names: string[] = (res.data as { name: string }[]).map((c) => c.name);
        setCanAccessTrash(names.includes('article.delete.any') || names.includes('article.delete.own'));
      }).catch(() => {});
    } catch { /* ignore */ }
  }, []);

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '10');
  if (search) params.set('search', search);
  if (showDeleted) params.set('include_deleted', 'true');

  const { data, isLoading, mutate } = useSWR<PaginatedResponse<Article>>(
    `/articles?${params.toString()}`,
    adminFetcher,
  );

  const articles = data?.data ?? [];
  const totalPages = data?.meta?.total_pages ?? data?.total_pages ?? 0;

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Move "${title}" to trash? You can restore it later.`)) return;
    try {
      await adminApi.delete(`/articles/${id}`);
      mutate();
    } catch {
      alert('Delete failed. Please try again.');
    }
  };

  const handleRestore = async (id: string, title: string) => {
    if (!confirm(`Restore "${title}"? It will be saved as a draft.`)) return;
    try {
      await adminApi.post(`/articles/${id}/restore`, {});
      mutate();
    } catch {
      alert('Restore failed. Please try again.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Draft';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Articles</h1>
        <div className="flex items-center gap-3">
          {canAccessTrash && (
            <button
              type="button"
              onClick={() => { setShowDeleted((v) => !v); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                showDeleted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'border-border text-foreground/60 hover:bg-surface-raised'
              }`}
            >
              <Trash className="w-4 h-4" />
              {showDeleted ? 'Showing Trash' : 'Show Trash'}
            </button>
          )}
          {!showDeleted && (
            <Link href="/admin/articles/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Article
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
          <Input
            type="text"
            placeholder={showDeleted ? 'Search deleted articles...' : 'Search articles...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Articles Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : articles.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">
                {showDeleted ? 'No deleted articles' : 'No articles found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Author</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">
                      {showDeleted ? 'Was Published' : 'Published'}
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {articles.map((article) => (
                    <tr key={article.id} className={`hover:bg-foreground/5 ${showDeleted ? 'opacity-70' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-foreground/10 rounded flex items-center justify-center">
                            <FileText className="w-5 h-5 text-foreground/50" />
                          </div>
                          <div>
                            <span className="font-medium">{article.title}</span>
                            {showDeleted && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                                Deleted
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {(article.author?.first_name ? `${article.author.first_name} ${article.author.last_name || ''}`.trim() : null) || article.author?.username || article.author?.email || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          article.status === 'published' ? 'bg-green-500/10 text-green-500' :
                          article.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-foreground/10 text-foreground/60'
                        }`}>
                          {article.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {formatDate(article.published_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {showDeleted ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(article.id, article.title)}
                              title="Restore article"
                            >
                              <RotateCcw className="w-4 h-4 text-green-500" />
                            </Button>
                          ) : (
                            <>
                              <Link href={`/admin/articles/${article.id}/edit`}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(article.id, article.title)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-foreground/60">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
