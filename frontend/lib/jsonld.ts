import type { SeoSettings } from './seoMeta';

// ── Breadcrumb ──────────────────────────────────────────────────────────────

export function buildBreadcrumbSchema(crumbs: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.url && { item: crumb.url }),
    })),
  };
}

// ── Article / BlogPosting ───────────────────────────────────────────────────

export function buildArticleSchema(
  article: {
    title: string;
    meta_description?: string | null;
    excerpt?: string | null;
    og_image_url?: string | null;
    published_at?: string | null;
    updated_at?: string;
    slug: string;
    media?: { url: string }[];
  },
  seo: SeoSettings,
) {
  const image = article.og_image_url || article.media?.[0]?.url || seo.og_default_image;
  const description = article.meta_description || article.excerpt || '';
  const url = `${seo.canonical_domain}/articles/${article.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description,
    url,
    ...(image && { image }),
    ...(article.published_at && { datePublished: article.published_at }),
    ...(article.updated_at   && { dateModified:  article.updated_at }),
    author: seo.author_name ? {
      '@type': 'Person',
      name: seo.author_name,
      ...(seo.author_url && { url: seo.author_url }),
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: seo.site_name,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

// ── Book ────────────────────────────────────────────────────────────────────

export function buildBookSchema(
  product: {
    title: string;
    meta_description?: string | null;
    short_description?: string | null;
    og_image_url?: string | null;
    media?: { url: string }[];
    price: number | string;
    stock_status?: string;
    slug: string;
    isbn?: string | null;
    book_format?: string | null;
    page_count?: number | null;
    publisher?: string | null;
    amazon_url?: string | null;
    goodreads_url?: string | null;
  },
  seo: SeoSettings,
) {
  const image = product.og_image_url || product.media?.[0]?.url || seo.og_default_image;
  const description = product.meta_description || product.short_description || '';
  const url = `${seo.canonical_domain}/shop/${product.slug}`;

  const sameAs = [product.amazon_url, product.goodreads_url].filter(Boolean);

  const bookFormatMap: Record<string, string> = {
    EBook:     'https://schema.org/EBook',
    Paperback: 'https://schema.org/Paperback',
    Hardcover: 'https://schema.org/Hardcover',
    AudioBook: 'https://schema.org/AudiobookFormat',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: product.title,
    description,
    url,
    ...(image && { image }),
    ...(product.isbn        && { isbn: product.isbn }),
    ...(product.book_format && { bookFormat: bookFormatMap[product.book_format] || product.book_format }),
    ...(product.page_count  && { numberOfPages: product.page_count }),
    ...(product.publisher   && { publisher: { '@type': 'Organization', name: product.publisher } }),
    ...(sameAs.length > 0   && { sameAs: sameAs.length === 1 ? sameAs[0] : sameAs }),
    author: seo.author_name ? {
      '@type': 'Person',
      name: seo.author_name,
      ...(seo.author_url && { url: seo.author_url }),
    } : undefined,
    offers: {
      '@type': 'Offer',
      price: String(product.price),
      priceCurrency: 'USD',
      availability: product.stock_status === 'out_of_stock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url,
    },
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

export function buildServiceSchema(
  product: {
    title: string;
    meta_description?: string | null;
    short_description?: string | null;
    slug: string;
  },
  seo: SeoSettings,
) {
  const description = product.meta_description || product.short_description || '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: product.title,
    description,
    url: `${seo.canonical_domain}/shop/${product.slug}`,
    provider: seo.author_name ? {
      '@type': 'Person',
      name: seo.author_name,
      ...(seo.author_url && { url: seo.author_url }),
    } : undefined,
  };
}

// ── Generic Product ─────────────────────────────────────────────────────────

export function buildProductSchema(
  product: {
    title: string;
    meta_description?: string | null;
    short_description?: string | null;
    og_image_url?: string | null;
    media?: { url: string }[];
    price: number | string;
    stock_status?: string;
    slug: string;
  },
  seo: SeoSettings,
) {
  const image = product.og_image_url || product.media?.[0]?.url || seo.og_default_image;
  const description = product.meta_description || product.short_description || '';
  const url = `${seo.canonical_domain}/shop/${product.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    url,
    ...(image && { image }),
    offers: {
      '@type': 'Offer',
      price: String(product.price),
      priceCurrency: 'USD',
      availability: product.stock_status === 'out_of_stock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url,
    },
  };
}

// ── Person (Author page) ────────────────────────────────────────────────────

export function buildPersonSchema(seo: SeoSettings, sameAsRaw: string) {
  const sameAs = sameAsRaw
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: seo.author_name,
    url: seo.author_url || seo.canonical_domain,
    ...(sameAs.length > 0 && { sameAs }),
  };
}

// ── WebSite ─────────────────────────────────────────────────────────────────

export function buildWebSiteSchema(seo: SeoSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: seo.site_name,
    url: seo.canonical_domain,
    ...(seo.author_name && {
      author: {
        '@type': 'Person',
        name: seo.author_name,
        ...(seo.author_url && { url: seo.author_url }),
      },
    }),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${seo.canonical_domain}/articles?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
