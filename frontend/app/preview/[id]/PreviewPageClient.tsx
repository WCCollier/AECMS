'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Eye } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { PageRenderer } from '@/components/pages/PageRenderer';
import type { Page } from '@/types';

interface PreviewPageClientProps {
  pageId: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft Preview',
  archived: 'Archived — not publicly visible',
  published: 'Live Preview',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-600',
  archived: 'bg-foreground/10 border-foreground/20 text-foreground/60',
  published: 'bg-green-500/15 border-green-500/30 text-green-700',
};

export function PreviewPageClient({ pageId }: PreviewPageClientProps) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get<Page>(`/pages/${pageId}`)
      .then((res) => setPage(res.data))
      .catch(() => setError('Failed to load page. You may need to log in to backstage first.'))
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) {
    return <div className="p-8 text-center text-foreground/50">Loading preview…</div>;
  }

  if (error || !page) {
    return <div className="p-8 text-center text-red-500">{error ?? 'Page not found.'}</div>;
  }

  const status = page.status ?? 'draft';
  const bannerColor = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  const bannerLabel = STATUS_LABELS[status] ?? status;

  return (
    <div>
      {/* Preview banner */}
      <div className={`border-b px-6 py-3 flex items-center justify-between text-sm font-medium ${bannerColor}`}>
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 shrink-0" />
          <span>{bannerLabel} — <span className="font-mono font-normal">/{page.slug}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pages/${pageId}/edit`}
            className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to editor
          </Link>
          {status === 'published' && (
            <a
              href={`/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              Live page
            </a>
          )}
        </div>
      </div>

      {/* Rendered page content */}
      <div className="min-h-screen bg-background">
        <PageRenderer page={page} />
      </div>
    </div>
  );
}
