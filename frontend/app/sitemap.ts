import type { MetadataRoute } from 'next';

export const revalidate = 3600;

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function fetchList(path: string) {
  try {
    const res = await fetch(`${BACKEND}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? json ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, products, pages] = await Promise.all([
    fetchList('/articles?status=published&limit=1000'),
    fetchList('/products?status=published&limit=1000'),
    fetchList('/pages?status=published&limit=1000'),
  ]);

  const articleEntries: MetadataRoute.Sitemap = articles.map((a: any) => ({
    url: `${BASE_URL}/articles/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p: any) => ({
    url: `${BASE_URL}/shop/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const pageEntries: MetadataRoute.Sitemap = pages
    .filter((p: any) => p.visibility !== 'admin_only' && p.slug !== '_home_')
    .map((p: any) => ({
      url: `${BASE_URL}/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  return [
    { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/articles`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/shop`, changeFrequency: 'weekly', priority: 0.9 },
    ...articleEntries,
    ...productEntries,
    ...pageEntries,
  ];
}
