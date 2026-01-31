'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useArticles } from '@/hooks/useArticles';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { Plus, Search, Edit, Trash2, FileText } from 'lucide-react';

export default function AdminArticlesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { articles, totalPages, isLoading } = useArticles({ page, limit: 10, search: search || undefined });

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
        <Link href="/admin/articles/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Article
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
          <Input
            type="text"
            placeholder="Search articles..."
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
              <p className="text-foreground/60">No articles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Title</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Author</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Published</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {articles.map((article) => (
                    <tr key={article.id} className="hover:bg-foreground/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-foreground/10 rounded flex items-center justify-center">
                            <FileText className="w-5 h-5 text-foreground/50" />
                          </div>
                          <span className="font-medium">{article.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {article.author?.display_name || article.author?.username || 'Unknown'}
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
                          <Link href={`/admin/articles/${article.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm">
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
