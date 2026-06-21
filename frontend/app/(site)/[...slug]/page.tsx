import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageRenderer } from '@/components/pages/PageRenderer';
import { JsonLd } from '@/components/JsonLd';
import { getSeoSettings, buildPageMetadata } from '@/lib/seoMeta';
import { buildBreadcrumbSchema } from '@/lib/jsonld';
import type { Page } from '@/types';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getPageByPath(segments: string[]): Promise<Page | null> {
  try {
    const path = encodeURIComponent('/' + segments.join('/'));
    const res = await fetch(`${BACKEND}/pages/by-path?path=${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const [page, seo] = await Promise.all([getPageByPath(slug ?? []), getSeoSettings()]);
  if (!page) return { title: 'Page Not Found' };
  return buildPageMetadata(page as any, seo, (slug ?? []).join('/'));
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const [page, seo] = await Promise.all([getPageByPath(slug ?? []), getSeoSettings()]);

  if (!page || page.status !== 'published' || page.visibility === 'admin_only') {
    notFound();
  }

  const slugPath = (slug ?? []).join('/');

  return (
    <>
      <JsonLd data={buildBreadcrumbSchema([
        { name: seo.site_name || 'Home', url: BASE_URL },
        { name: (page as any).title },
      ])} />
      <PageRenderer page={page} />
    </>
  );
}
