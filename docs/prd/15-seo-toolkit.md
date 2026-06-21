# PRD 15 — SEO Toolkit (Phase 26)

**Status**: 📋 Planned  
**Phase**: 26  
**Last updated**: 2026-06-21  
**Dependencies**: Phase 16 (dynamic nav, catch-all routes), Phase 20 (theme system), Phase 23 (section pages)

---

## Goal

Give every page AECMS generates a complete, accurate, per-content SEO layer: Open Graph metadata, JSON-LD structured data, a dynamic sitemap, and a robots.txt — all manageable from the backstage without touching code.

The specific driver: W. C. Collier is an author selling fiction (the *Outsiders* AI thriller series), non-fiction, and firearms instruction services, using AECMS as his brand hub. His books exist on Amazon and Goodreads. His author identity needs to be legible to both Google's traditional index and to AI answer engines (Google AI Mode, Perplexity, ChatGPT Search) that synthesize author knowledge graphs from structured signals across the web.

---

## Why this matters in 2026

Meta tags are table stakes. The more important work is **entity establishment**: Google and AI systems build knowledge graphs by finding consistent structured data (`Book`, `Person`, `Service` schema) across multiple authoritative sources and cross-referencing them via `sameAs` links. An author whose FvR product pages carry valid `Book` schema with ISBNs, linked to an Amazon listing via `sameAs`, has a meaningfully higher chance of appearing in AI-generated "books about X" answers than one who doesn't.

For a low-volume indie author, structured data is one of the few levers that doesn't require traffic to work — it's a one-time signal that compounds over time.

---

## Part A — Per-content metadata fields

### Database additions

Three new nullable fields on `Article`, `Product`, and `Page`:

```prisma
// On Article, Product, Page
meta_title       String?   // <60 chars; falls back to title
meta_description String?   // <160 chars; falls back to excerpt/description
og_image_url     String?   // override for Open Graph image; falls back to cover image
```

Migration: `20260626000000_add_seo_meta_fields`

### Site-level SEO settings (new ISM keys)

| ISM key | Description |
|---|---|
| `seo.site_name` | Site name for OG tags (e.g. "Fantasy V Reality") |
| `seo.site_description` | Default meta description for the homepage |
| `seo.og_default_image` | Fallback OG image URL for pages with no cover image |
| `seo.author_name` | Author display name (e.g. "W. C. Collier") |
| `seo.author_url` | Canonical author page URL (e.g. `https://wccollier.com`) |
| `seo.author_twitter` | Twitter/X handle for `twitter:creator` tag |
| `seo.google_verification` | Google Search Console verification meta content |
| `seo.robots_additional` | Extra lines appended to robots.txt (e.g. `Disallow: /checkout`) |

Add a **SEO** tab to Admin Settings alongside General / Email / Payments / Storage / Appearance.

### Fallback chain

For every rendered page, metadata resolves in this order:

1. Explicit `meta_title` / `meta_description` / `og_image_url` on the record
2. `title` + `excerpt` / `description` + `cover_image` from the record
3. Site-level defaults from ISM (`seo.site_name`, `seo.og_default_image`)

---

## Part B — Next.js metadata generation

### `generateMetadata()` in each route

Replace the current static `export const metadata = { title: '...' }` in article, product, and page routes with async `generateMetadata()` that fetches the record and resolves the fallback chain.

```typescript
// app/articles/[slug]/page.tsx (pattern — same for products and pages)
export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  return {
    title: article.meta_title ?? article.title,
    description: article.meta_description ?? article.excerpt,
    openGraph: {
      title: article.meta_title ?? article.title,
      description: article.meta_description ?? article.excerpt,
      images: article.og_image_url ?? article.cover_image ?? siteSettings.og_default_image,
      type: 'article',
      publishedTime: article.published_at,
      authors: [siteSettings.author_url],
    },
    twitter: {
      card: 'summary_large_image',
      creator: siteSettings.author_twitter,
    },
  };
}
```

### Canonical URLs

Inject `<link rel="canonical">` on every page pointing to the primary domain. Critical for the domain alias setup — if `wccollier.com` aliases to `fantasyvreality.com`, the canonical must declare `fantasyvreality.com` (or whichever is primary) to prevent duplicate content signals.

Add `seo.canonical_domain` ISM key so the owner can declare the primary domain explicitly.

---

## Part C — JSON-LD structured data

A server component `<JsonLd data={...} />` injects a `<script type="application/ld+json">` tag. Each route type outputs the appropriate schema type.

### `Book` schema — Product pages where the product is a book

Add book-specific fields to the `Product` model:

```prisma
isbn          String?   // ISBN-10 or ISBN-13
book_format   String?   // 'EBook' | 'Paperback' | 'Hardcover' | 'AudioBook'
page_count    Int?
publisher     String?   // e.g. 'BookLocker.com, Inc.'
```

Output:

```json
{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "OUTSIDERS: Vol. I",
  "author": { "@type": "Person", "name": "W. C. Collier", "url": "https://wccollier.com" },
  "isbn": "9781647198855",
  "bookFormat": "https://schema.org/EBook",
  "numberOfPages": 312,
  "publisher": { "@type": "Organization", "name": "BookLocker.com, Inc." },
  "description": "...",
  "image": "https://fantasyvreality.com/media/outsiders-cover.jpg",
  "url": "https://fantasyvreality.com/shop/outsiders-vol-1",
  "sameAs": "https://www.amazon.com/OUTSIDERS-Vol-W-C-Collier-ebook/dp/B09X7F21JS",
  "offers": {
    "@type": "Offer",
    "price": "9.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
```

The `sameAs` field links the AECMS product page to the Amazon listing, which is the key signal for Google's entity graph. Add `amazon_url` and `goodreads_url` fields to `Product` to populate this.

### `Article` / `BlogPosting` schema — Article pages

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "...",
  "author": { "@type": "Person", "name": "W. C. Collier", "url": "https://wccollier.com" },
  "datePublished": "2026-01-15T00:00:00Z",
  "dateModified": "2026-01-20T00:00:00Z",
  "image": "...",
  "publisher": {
    "@type": "Organization",
    "name": "Fantasy V Reality",
    "logo": { "@type": "ImageObject", "url": "https://fantasyvreality.com/favicon.png" }
  },
  "description": "...",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://fantasyvreality.com/articles/..." }
}
```

### `Person` schema — Author page

The author page (served via the domain alias or at `/about`) outputs `Person` schema with `sameAs` links to all known author profiles. This is the entity-establishment payload.

Add `seo.author_same_as` ISM key (comma-separated URLs):

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "W. C. Collier",
  "url": "https://wccollier.com",
  "description": "Author of fiction and non-fiction, former Navy pilot, firearms instructor.",
  "image": "...",
  "sameAs": [
    "https://www.amazon.com/stores/author/...",
    "https://www.goodreads.com/author/show/...",
    "https://twitter.com/...",
    "https://instagram.com/..."
  ],
  "knowsAbout": ["Firearms", "Naval Aviation", "Thriller Fiction", "Teaching"],
  "jobTitle": "Author"
}
```

### `Service` schema — Service-type products (firearms instruction)

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Firearms Instruction",
  "provider": { "@type": "Person", "name": "W. C. Collier" },
  "serviceType": "Firearms Training",
  "description": "...",
  "areaServed": { "@type": "State", "name": "Texas" },
  "url": "https://fantasyvreality.com/shop/firearms-instruction"
}
```

### `WebSite` + `Organization` schema — Homepage

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Fantasy V Reality",
  "url": "https://fantasyvreality.com",
  "author": { "@type": "Person", "name": "W. C. Collier" },
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://fantasyvreality.com/articles?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### `BreadcrumbList` — All interior pages

Every article, product, and page gets a breadcrumb trail:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://fantasyvreality.com" },
    { "@type": "ListItem", "position": 2, "name": "Shop", "item": "https://fantasyvreality.com/shop" },
    { "@type": "ListItem", "position": 3, "name": "OUTSIDERS: Vol. I" }
  ]
}
```

---

## Part D — Sitemap

### `app/sitemap.ts` (Next.js built-in)

Next.js App Router has a built-in `sitemap.ts` convention that returns a `MetadataRoute.Sitemap` array and serves it as `/sitemap.xml`.

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, products, pages] = await Promise.all([
    getPublishedArticles(),
    getPublishedProducts(),
    getPublishedPages(),
  ]);
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...articles.map(a => ({ url: `${baseUrl}/articles/${a.slug}`, lastModified: a.updated_at, priority: 0.8 })),
    ...products.map(p => ({ url: `${baseUrl}/shop/${p.slug}`, lastModified: p.updated_at, priority: 0.9 })),
    ...pages.map(p => ({ url: `${baseUrl}/${p.slug}`, lastModified: p.updated_at, priority: 0.7 })),
  ];
}
```

Only published, non-deleted content is included. `admin_only` pages are excluded.

### `app/robots.ts`

```typescript
export default async function robots(): Promise<MetadataRoute.Robots> {
  const additional = await getSetting('seo.robots_additional'); // e.g. 'Disallow: /checkout'
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/checkout'] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

---

## Part E — Dynamic OG Images

Next.js `ImageResponse` generates a social preview image at request time. Useful for articles and products that don't have a manually set `og_image_url`.

```
GET /og?title=OUTSIDERS%3A+Vol.+I&type=book&cover=/media/outsiders.jpg
```

Returns a 1200×630 image with the site's active palette applied (background, accent color, font). Falls back to the plain `seo.og_default_image` if the route is not hit.

This is a nice-to-have for Phase 26 — not essential for launch but meaningful for social sharing.

---

## Part F — Admin UI additions

### SEO panel on Article / Product / Page edit forms

A collapsible **SEO** section at the bottom of each edit form:

- **Meta title** — text input, character counter (60 chars), placeholder shows resolved fallback
- **Meta description** — textarea, character counter (160 chars), placeholder shows resolved fallback
- **OG image override** — media picker (from Media Library) or URL input
- **Preview** — live preview of how the Google snippet will appear (title + URL + description)

For products that are books:
- **ISBN**, **Book format** (dropdown: eBook / Paperback / Hardcover / Audiobook), **Page count**, **Publisher**
- **Amazon URL**, **Goodreads URL** (populate `sameAs`)

### SEO tab in Admin Settings

New tab alongside General / Email / Payments / Storage / Appearance:

- Site name, site description, default OG image
- Author name, author page URL, Twitter handle
- Google Search Console verification code
- Author `sameAs` URLs (multi-line text, one URL per line)
- Robots.txt additional rules
- Canonical domain override

---

## Part G — Search Console setup (owner's manual)

Non-code. Add a section to the Owner's Manual covering:

1. How to submit `fantasyvreality.com` to Google Search Console
2. How to verify via the meta tag (use `seo.google_verification` ISM key)
3. How to submit the sitemap (`/sitemap.xml`)
4. How to set up Bing Webmaster Tools (same sitemap, different verification)
5. How to claim and link the Amazon author page + Goodreads profile to establish the `sameAs` entity graph
6. How to check rich result eligibility via Google's Rich Results Test

---

## Schema type → route mapping summary

| Route | Schema types |
|---|---|
| Homepage | `WebSite`, `Person` |
| Article list | `BreadcrumbList` |
| Article detail | `BlogPosting`, `BreadcrumbList` |
| Product list | `BreadcrumbList` |
| Product detail (book) | `Book`, `BreadcrumbList` |
| Product detail (service) | `Service`, `BreadcrumbList` |
| Author page | `Person` |
| Static page | `WebPage`, `BreadcrumbList` |

---

## DB migration summary

| Model | New fields |
|---|---|
| `Article` | `meta_title`, `meta_description`, `og_image_url` |
| `Product` | `meta_title`, `meta_description`, `og_image_url`, `isbn`, `book_format`, `page_count`, `publisher`, `amazon_url`, `goodreads_url` |
| `Page` | `meta_title`, `meta_description`, `og_image_url` |
| `SiteSettings` | 8 new `seo.*` ISM keys (no schema change — uses existing key/value table) |

One migration: `20260626000000_add_seo_fields`

---

## Implementation order

1. DB migration + API field pass-through (backend)
2. Site-level SEO settings tab (Admin Settings)
3. `generateMetadata()` in all routes (Next.js)
4. Sitemap + robots (Next.js built-in files)
5. JSON-LD components — one per schema type
6. Wire JSON-LD into routes
7. SEO panel on Article / Product / Page edit forms
8. Book-specific fields (ISBN, format, Amazon URL etc.)
9. Dynamic OG image endpoint (optional, last)
10. Owner's manual Search Console section

---

## Out of scope for Phase 26

- Subscription / paywall schema (no subscriptions yet)
- Video schema (no video hosting yet)
- FAQ schema (March 2026 Google update reduced its value; defer)
- Automatic Goodreads sync (too complex; owner sets URLs manually)
- Analytics integration (separate phase if needed)
