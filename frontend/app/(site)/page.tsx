export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { PageRenderer } from '@/components/pages/PageRenderer';
import type { Page } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

export default async function HomePage() {
  const settings = await getGeneralSettings();
  const mode = settings.homepage_mode ?? 'latest_articles';

  if (mode === 'latest_articles') {
    redirect('/articles');
  }

  // static_page mode — try the designated page first, fall back to _home_
  if (settings.homepage_page_id) {
    const page = await getPageById(settings.homepage_page_id);
    if (page) {
      return <div><PageRenderer page={page} /></div>;
    }
  }

  // Fallback: use the built-in _home_ page if it exists and is published
  const homePage = await getHomeSlugPage();
  if (homePage) {
    return <div><PageRenderer page={homePage} /></div>;
  }

  // Ultimate fallback: no published homepage configured at all
  redirect('/articles');
}
