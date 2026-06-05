'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { adminFetcher } from '@/lib/swr';
import adminApi from '@/lib/adminApi';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { Plus, Search, Edit, Trash2, LayoutTemplate, Eye, ExternalLink } from 'lucide-react';
import { LAYOUT_LABELS } from '@/lib/pageContent';
import type { Page, PaginatedResponse } from '@/types';

export function AdminPagesClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '10');
  if (search) params.set('search', search);

  const { data, isLoading, mutate } = useSWR<PaginatedResponse<Page>>(
    `/pages?${params.toString()}`,
    adminFetcher,
  );

  const pages = data?.data ?? [];
  const totalPages = data?.meta?.total_pages ?? 0;

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await adminApi.delete(`/pages/${id}`);
      mutate();
    } catch {
      alert('Delete failed. Please try again.');
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  function getLayout(p: Page): string {
    try {
      const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
      if (c?.layout) return LAYOUT_LABELS[c.layout as keyof typeof LAYOUT_LABELS] ?? c.layout;
    } catch { /* ignore */ }
    return '—';
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Pages</h1>
        <Link href="/admin/pages/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Page
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
          <Input
            type="text"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : pages.length === 0 ? (
            <div className="p-8 text-center">
              <LayoutTemplate className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">No pages found</p>
              <p className="text-sm text-foreground/40 mt-1">Create your first page to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Slug</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Layout</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Updated</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {pages.map((p) => (
                    <tr key={p.id} className="hover:bg-foreground/5">
                      <td className="px-6 py-4 font-medium">{p.title}</td>
                      <td className="px-6 py-4 text-foreground/60 font-mono text-sm">/{p.slug}</td>
                      <td className="px-6 py-4 text-foreground/60 text-sm">{getLayout(p)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          p.status === 'published' ? 'bg-green-500/10 text-green-500' :
                          p.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-foreground/10 text-foreground/60'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground/60 text-sm">{formatDate(p.updated_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.status === 'published' ? (
                            <a
                              href={`/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open live page"
                            >
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4 text-green-500" />
                              </Button>
                            </a>
                          ) : (
                            <a
                              href={`/admin/pages/${p.id}/preview`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Preview draft"
                            >
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4 text-foreground/50" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/admin/pages/${p.id}/edit`}>
                            <Button variant="ghost" size="sm"><Edit className="w-4 h-4" /></Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p.id, p.title)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
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
    </div>
  );
}
