export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageRenderer } from '@/components/pages/PageRenderer';
import { JsonLd } from '@/components/JsonLd';
import { getSeoSettings } from '@/lib/seoMeta';
import { buildWebSiteSchema, buildPersonSchema } from '@/lib/jsonld';
import type { Page } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';

async function getGeneralSettings(): Promise<{ homepage_mode?: string; homepage_page_id?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/settings-public/general`, { cache: 'no-store' });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

async function getPageById(id: string): Promise<Page | null> {
  try {
    const res = await fetch(`${BASE_URL}/pages/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const page: Page = await res.json();
    if (page.status !== 'published' || page.visibility === 'admin_only') return null;
    return page;
  } catch {
    return null;
  }
}

async function getHomeSlugPage(): Promise<Page | null> {
  try {
    const res = await fetch(`${BASE_URL}/pages/slug/_home_`, { cache: 'no-store' });
    if (!res.ok) return null;
    const page: Page = await res.json();
    if (page.status !== 'published' || page.visibility === 'admin_only') return null;
    return page;
  } catch {
    return null;
  }
}

async function getSameAs(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND}/settings-public/seo`, { next: { revalidate: 300 } });
    if (!res.ok) return '';
    const data = await res.json();
    return data['seo.author_same_as'] ?? '';
  } catch {
    return '';
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  return {
    title: { absolute: seo.site_name || 'AECMS' },
    description: seo.site_description,
    openGraph: {
      title: seo.site_name,
      description: seo.site_description,
      siteName: seo.site_name,
      type: 'website',
      ...(seo.og_default_image && { images: [{ url: seo.og_default_image }] }),
    },
    ...(seo.google_verification && {
      verification: { google: seo.google_verification },
    }),
  };
}

export default async function HomePage() {
  const [settings, seo, sameAs] = await Promise.all([
    getGeneralSettings(),
    getSeoSettings(),
    getSameAs(),
  ]);
  const mode = settings.homepage_mode ?? 'latest_articles';

  const jsonLd = (
    <>
      <JsonLd data={buildWebSiteSchema(seo)} />
      {seo.author_name && <JsonLd data={buildPersonSchema(seo, sameAs)} />}
    </>
  );

  if (mode === 'latest_articles') {
    redirect('/articles');
  }

  // static_page mode — try the designated page first, fall back to _home_
  if (settings.homepage_page_id) {
    const page = await getPageById(settings.homepage_page_id);
    if (page) {
      return <div>{jsonLd}<PageRenderer page={page} /></div>;
    }
  }

  // Fallback: use the built-in _home_ page if it exists and is published
  const homePage = await getHomeSlugPage();
  if (homePage) {
    return <div>{jsonLd}<PageRenderer page={homePage} /></div>;
  }

  // Ultimate fallback: no published homepage configured at all
  redirect('/articles');
}
