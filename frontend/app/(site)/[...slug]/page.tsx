import { notFound } from 'next/navigation';
import { PageRenderer } from '@/components/pages/PageRenderer';
import type { Page } from '@/types';

export const dynamic = 'force-dynamic';

async function getPageByPath(segments: string[]): Promise<Page | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const path = encodeURIComponent('/' + segments.join('/'));
    const res = await fetch(`${baseUrl}/pages/by-path?path=${path}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = await getPageByPath(slug ?? []);

  if (!page || page.status !== 'published' || page.visibility === 'admin_only') {
    notFound();
  }

  return (
    <div>
      <PageRenderer page={page} />
    </div>
  );
}
