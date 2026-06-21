import type { Metadata } from 'next';

export interface SeoSettings {
  site_name: string;
  site_description: string;
  og_default_image: string;
  author_name: string;
  author_url: string;
  author_twitter: string;
  canonical_domain: string;
  google_verification: string;
}

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';

export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const res = await fetch(`${BACKEND}/settings-public/seo`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      site_name:         data['seo.site_name']          || 'AECMS',
      site_description:  data['seo.site_description']   || '',
      og_default_image:  data['seo.og_default_image']   || '',
      author_name:       data['seo.author_name']        || '',
      author_url:        data['seo.author_url']         || '',
      author_twitter:    data['seo.author_twitter']     || '',
      canonical_domain:  data['seo.canonical_domain']   || process.env.NEXT_PUBLIC_API_URL || '',
      google_verification: data['seo.google_verification'] || '',
    };
  } catch {
    return {
      site_name: 'AECMS', site_description: '', og_default_image: '',
      author_name: '', author_url: '', author_twitter: '', canonical_domain: '',
      google_verification: '',
    };
  }
}

export function buildArticleMetadata(
  article: { title: string; excerpt?: string | null; meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null; published_at?: string | null; updated_at?: string },
  seo: SeoSettings,
  slug: string,
): Metadata {
  const title       = article.meta_title       || article.title;
  const description = article.meta_description || article.excerpt || seo.site_description;
  const image       = article.og_image_url     || seo.og_default_image;
  const url         = `${seo.canonical_domain}/articles/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url,
      siteName: seo.site_name,
      type: 'article',
      ...(article.published_at && { publishedTime: article.published_at }),
      ...(article.updated_at   && { modifiedTime:  article.updated_at }),
      ...(seo.author_url       && { authors: [seo.author_url] }),
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title, description,
      ...(seo.author_twitter && { creator: seo.author_twitter }),
      ...(image && { images: [image] }),
    },
  };
}

export function buildProductMetadata(
  product: { title: string; short_description?: string | null; meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null; media?: { url: string }[] },
  seo: SeoSettings,
  slug: string,
): Metadata {
  const title       = product.meta_title       || product.title;
  const description = product.meta_description || product.short_description || seo.site_description;
  const image       = product.og_image_url     || product.media?.[0]?.url   || seo.og_default_image;
  const url         = `${seo.canonical_domain}/shop/${slug}`;

  return {
    title, description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url,
      siteName: seo.site_name,
      type: 'website',
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title, description,
      ...(seo.author_twitter && { creator: seo.author_twitter }),
      ...(image && { images: [image] }),
    },
  };
}

export function buildPageMetadata(
  page: { title: string; meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null },
  seo: SeoSettings,
  slugPath: string,
): Metadata {
  const title       = page.meta_title       || page.title;
  const description = page.meta_description || seo.site_description;
  const image       = page.og_image_url     || seo.og_default_image;
  const url         = `${seo.canonical_domain}/${slugPath}`;

  return {
    title, description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url,
      siteName: seo.site_name,
      type: 'website',
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title, description,
      ...(seo.author_twitter && { creator: seo.author_twitter }),
      ...(image && { images: [image] }),
    },
  };
}
