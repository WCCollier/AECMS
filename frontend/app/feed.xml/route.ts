import { NextResponse } from 'next/server';

export const revalidate = 3600;

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(dateStr: string): string {
  try {
    return new Date(dateStr).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

export async function GET() {
  let siteName = 'AECMS';
  let siteDescription = '';
  let articles: any[] = [];

  try {
    const [settingsRes, articlesRes] = await Promise.all([
      fetch(`${BACKEND}/settings/general`, { next: { revalidate: 3600 } }),
      fetch(`${BACKEND}/articles?status=published&limit=50&sort=published_at&order=desc`, { next: { revalidate: 3600 } }),
    ]);

    if (settingsRes.ok) {
      const s = await settingsRes.json();
      siteName = s.site_title || siteName;
    }

    // Also try to get seo settings for description
    const seoRes = await fetch(`${BACKEND}/settings/seo`, { next: { revalidate: 3600 } });
    if (seoRes.ok) {
      const seo = await seoRes.json();
      siteDescription = seo['seo.site_description'] || '';
    }

    if (articlesRes.ok) {
      const json = await articlesRes.json();
      articles = json.data ?? [];
    }
  } catch {
    // Return empty feed on failure
  }

  const lastBuildDate = articles.length > 0
    ? toRfc822(articles[0].published_at || articles[0].updated_at || new Date().toISOString())
    : toRfc822(new Date().toISOString());

  const items = articles.map((a: any) => {
    const link = `${BASE_URL}/articles/${a.slug}`;
    const description = a.excerpt || a.meta_description || '';
    const pubDate = toRfc822(a.published_at || a.created_at);
    return `    <item>
      <title>${escapeXml(a.title || '')}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(BASE_URL)}</link>
    <description>${escapeXml(siteDescription || siteName)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(BASE_URL)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
