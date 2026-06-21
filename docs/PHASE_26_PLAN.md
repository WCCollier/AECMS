# Phase 26: SEO Toolkit

**Project**: AECMS  
**Phase**: 26  
**Status**: 📋 PLANNED  
**PRD**: `docs/prd/15-seo-toolkit.md`  
**Dependencies**: Phase 16 (catch-all routes), Phase 20 (theme/ISM), Phase 22 (Next.js 15 / Node 22)  
**Branch**: `feature/phase-26`

---

## Overview

Add a complete SEO layer to AECMS: per-content Open Graph metadata, JSON-LD structured data (Book, Article, Person, Service, BreadcrumbList, WebSite), dynamic sitemap, robots.txt, and the admin UI to manage it all. The implementation is driven by the indie author use case — specifically getting W. C. Collier's books, services, and author identity legible to both Google's traditional index and AI answer engines (AI Mode, Perplexity, ChatGPT Search).

**Current state**: `meta_title` and `meta_description` already exist on Article, Product, and Page models but are not surfaced in the API, admin UI, or rendered `<head>`. Route files use `force-dynamic` + client components with no `generateMetadata()`. No sitemap, no robots.txt, no JSON-LD anywhere.

**After this phase**: Every published page has accurate `<title>`, `<meta name="description">`, full Open Graph tags, and appropriate JSON-LD. `/sitemap.xml` and `/robots.txt` are served dynamically. Book products carry ISBN, publisher, and Amazon `sameAs` links. The author page emits `Person` schema linking out to Amazon Author Central and Goodreads.

---

## Deployment strategy

Single branch `feature/phase-26`, single deploy. All items are coherent and there is no useful partial deployment — the metadata layer, JSON-LD, and sitemap work together as a unit.

---

## Item A — DB migration

**What's already there**: `meta_title` and `meta_description` on Article, Product, and Page.

**What's missing**:

```prisma
// Add to Article
og_image_url   String?

// Add to Page
og_image_url   String?

// Add to Product
og_image_url   String?
isbn           String?
book_format    String?   // 'EBook' | 'Paperback' | 'Hardcover' | 'AudioBook'
page_count     Int?
publisher      String?
amazon_url     String?
goodreads_url  String?
```

Migration name: `20260626000000_add_seo_og_and_book_fields`

No data backfill needed — all nullable.

**Files**: `backend/prisma/schema.prisma`, new migration file

---

## Item B — Backend API pass-through

The new fields need to flow through DTOs, service methods, and API responses.

### DTOs

Add the new fields (all optional) to:

- `backend/src/articles/dto/create-article.dto.ts` and `update-article.dto.ts` — add `og_image_url`
- `backend/src/products/dto/create-product.dto.ts` and `update-product.dto.ts` — add `og_image_url`, `isbn`, `book_format`, `page_count`, `publisher`, `amazon_url`, `goodreads_url`
- `backend/src/pages/dto/create-page.dto.ts` and `update-page.dto.ts` — add `og_image_url`

Use `@IsOptional() @IsString()` for all string fields; `@IsOptional() @IsInt() @Min(1)` for `page_count`.

### Service select clauses

Wherever `findMany` / `findFirst` / `findUnique` selects article/product/page fields, ensure the new fields are included in the returned object. Most services already use Prisma's default (return all scalar fields), so this may need no change — verify.

### Serializer / response shape

No separate serializer layer exists (Prisma objects are returned directly). The fields will appear in API responses automatically once the migration runs and DTOs accept them.

**Files**: DTOs in `backend/src/articles/dto/`, `backend/src/products/dto/`, `backend/src/pages/dto/`

---

## Item C — Site-level SEO settings

### New ISM keys

Add to `backend/src/settings/settings.service.ts` ENV_KEY_MAP (or equivalent defaults):

| ISM key | Env fallback | Description |
|---|---|---|
| `seo.site_name` | `SITE_NAME` | Site name for OG `og:site_name` |
| `seo.site_description` | — | Default homepage meta description |
| `seo.og_default_image` | — | Fallback OG image URL |
| `seo.author_name` | — | Author display name (e.g. "W. C. Collier") |
| `seo.author_url` | — | Canonical author page URL |
| `seo.author_twitter` | — | Twitter/X handle for `twitter:creator` |
| `seo.author_same_as` | — | Newline-separated author profile URLs (Amazon, Goodreads, socials) |
| `seo.canonical_domain` | `APP_URL` | Primary domain for canonical tags |
| `seo.google_verification` | — | Google Search Console meta content value |
| `seo.robots_additional` | — | Extra lines appended to robots.txt |

No new DB table needed — all stored in the existing `SiteSettings` key/value table.

### SEO tab in Admin Settings

Add a **SEO** tab to `frontend/app/admin/settings/` alongside General / Email / Payments / Storage / Appearance.

Fields:
- Site name, site description
- Default OG image (media picker)
- Author name, author page URL, Twitter handle
- Author `sameAs` URLs (textarea, one URL per line — include Amazon Author Central and Goodreads)
- Canonical domain override
- Google Search Console verification code
- Additional robots.txt rules (textarea)

Wire to `PATCH /settings/seo` (or reuse the general settings patch — the existing settings tab system filters by key namespace server-side, so add a `seo.*` namespace filter).

**Files**:
- `backend/src/settings/settings.service.ts` (add ISM keys)
- `frontend/app/admin/settings/SeoTab.tsx` (new)
- `frontend/app/admin/settings/AppearanceClient.tsx` or equivalent settings root — add SEO tab to the tab list

---

## Item D — `generateMetadata()` in all site routes

Currently every site route file is a thin wrapper:
```typescript
export const dynamic = 'force-dynamic';
export default function ArticlePage() { return <ArticlePageClient />; }
```

Add `generateMetadata()` as a server-side export alongside the existing default export. This runs on the server at request time and injects `<head>` tags without changing the client-rendered component.

### Helper: `lib/seoMeta.ts`

Create `frontend/lib/seoMeta.ts` with:

```typescript
// Resolves the fallback chain: explicit meta → content fields → site defaults
export function buildMetadata(record: {
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  title?: string;
  excerpt?: string | null;
  short_description?: string | null;
  cover_image?: string | null;
}, siteSettings: SeoSettings, type: 'article' | 'product' | 'website'): Metadata
```

### Routes to update

| File | Schema `generateMetadata` fetches |
|---|---|
| `app/(site)/articles/[slug]/page.tsx` | `GET /articles?slug=:slug` → article record |
| `app/(site)/shop/[slug]/page.tsx` | `GET /products?slug=:slug` → product record |
| `app/(site)/[...slug]/page.tsx` | `GET /pages/:slug` → page record |
| `app/(site)/articles/page.tsx` | Static + site name |
| `app/(site)/shop/page.tsx` | Static + site name |
| `app/layout.tsx` | Already has metadata — update to pull `seo.site_name` and `seo.og_default_image` from settings |

The fetch in `generateMetadata` calls the backend directly via `BACKEND_URL` (server-to-server, no token needed for published content). Use `{ next: { revalidate: 60 } }` so the metadata is cached for 60 seconds rather than fetched on every request.

### Open Graph fields

Every route emits:
```typescript
openGraph: {
  siteName: siteSettings.site_name,
  title: resolved_title,
  description: resolved_description,
  images: [resolved_og_image],
  type: 'article' | 'book' | 'website',
  ...(article-specific: publishedTime, authors)
}
twitter: {
  card: 'summary_large_image',
  creator: siteSettings.author_twitter,
}
```

### Canonical URLs

```typescript
alternates: {
  canonical: `${siteSettings.canonical_domain}/${path}`,
}
```

**Files**: `frontend/lib/seoMeta.ts` (new), `frontend/app/(site)/articles/[slug]/page.tsx`, `frontend/app/(site)/shop/[slug]/page.tsx`, `frontend/app/(site)/[...slug]/page.tsx`, `frontend/app/(site)/articles/page.tsx`, `frontend/app/(site)/shop/page.tsx`, `frontend/app/layout.tsx`

---

## Item E — Sitemap and robots.txt

### `frontend/app/sitemap.ts`

Next.js App Router serves this as `/sitemap.xml` automatically.

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, products, pages] = await Promise.all([
    fetch(`${BACKEND_URL}/articles?status=published&limit=1000`).then(r => r.json()),
    fetch(`${BACKEND_URL}/products?status=published&limit=1000`).then(r => r.json()),
    fetch(`${BACKEND_URL}/pages?status=published&limit=1000`).then(r => r.json()),
  ]);

  return [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/articles`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/shop`, changeFrequency: 'weekly', priority: 0.9 },
    ...articles.data.map(a => ({
      url: `${baseUrl}/articles/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: 'monthly',
      priority: 0.7,
    })),
    ...products.data.map(p => ({
      url: `${baseUrl}/shop/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
    ...pages.data
      .filter(p => p.visibility !== 'admin_only')
      .map(p => ({
        url: `${baseUrl}/${p.slug}`,
        lastModified: p.updated_at,
        changeFrequency: 'monthly',
        priority: 0.6,
      })),
  ];
}
```

Add `export const revalidate = 3600;` so the sitemap is regenerated hourly rather than on every request.

### `frontend/app/robots.ts`

```typescript
export default async function robots(): Promise<MetadataRoute.Robots> {
  const additional = await getSeoSetting('seo.robots_additional');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/checkout', '/order-confirmation'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
  // append `additional` lines if set
}
```

**Files**: `frontend/app/sitemap.ts` (new), `frontend/app/robots.ts` (new)

---

## Item F — JSON-LD component + schema builders

### `frontend/components/JsonLd.tsx`

Simple server component:

```typescript
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### `frontend/lib/jsonld.ts`

Schema builder functions — one per type:

```typescript
export function buildArticleSchema(article, siteSettings): WithContext<BlogPosting>
export function buildBookSchema(product, siteSettings): WithContext<Book>
export function buildServiceSchema(product, siteSettings): WithContext<Service>
export function buildProductSchema(product, siteSettings): WithContext<Product>  // fallback
export function buildPersonSchema(siteSettings): WithContext<Person>
export function buildWebSiteSchema(siteSettings): WithContext<WebSite>
export function buildBreadcrumbSchema(crumbs: {name: string, url?: string}[]): WithContext<BreadcrumbList>
```

Use the `schema-dts` npm package for TypeScript types (`npm install schema-dts` in frontend). It provides typed `WithContext<Book>`, `WithContext<Person>`, etc.

The `buildBookSchema` function checks whether the product has `isbn` set before including it; includes `sameAs` if `amazon_url` or `goodreads_url` is set; includes `offers` block with price and availability.

**Files**: `frontend/components/JsonLd.tsx` (new), `frontend/lib/jsonld.ts` (new)

---

## Item G — Wire JSON-LD into routes

`generateMetadata` only controls `<head>` tags, not `<script>` tags. JSON-LD must be injected via the page component itself (server-rendered, so it's in the HTML).

Since the page components are currently client components, JSON-LD is injected in the server-side page wrapper — the thin `page.tsx` file — before delegating to the client component:

```typescript
// app/(site)/articles/[slug]/page.tsx
import { JsonLd } from '@/components/JsonLd';
import { buildArticleSchema, buildBreadcrumbSchema } from '@/lib/jsonld';

export const dynamic = 'force-dynamic';
export async function generateMetadata(...) { ... }  // Item D

export default async function ArticlePage({ params }) {
  const article = await fetchArticle(params.slug);
  const siteSettings = await getSeoSettings();
  return (
    <>
      <JsonLd data={buildArticleSchema(article, siteSettings)} />
      <JsonLd data={buildBreadcrumbSchema([
        { name: 'Home', url: baseUrl },
        { name: 'Articles', url: `${baseUrl}/articles` },
        { name: article.title },
      ])} />
      <ArticlePageClient />
    </>
  );
}
```

The same pattern applies to shop and page routes. The article/product/page data is fetched once in the server page wrapper and used for both `generateMetadata` and JSON-LD. Cache with `{ next: { revalidate: 60 } }` so it's one fetch per minute, not per request.

### Route → schema mapping

| Route | JSON-LD blocks emitted |
|---|---|
| Homepage (`/`) | `WebSite`, `Person` |
| Article list (`/articles`) | `BreadcrumbList` |
| Article detail (`/articles/:slug`) | `BlogPosting`, `BreadcrumbList` |
| Shop list (`/shop`) | `BreadcrumbList` |
| Product detail — book (`/shop/:slug`) | `Book`, `BreadcrumbList` |
| Product detail — service (`/shop/:slug`) | `Service`, `BreadcrumbList` |
| Product detail — physical/other | `Product` (schema.org), `BreadcrumbList` |
| Page (`/[...slug]`) | `WebPage`, `BreadcrumbList` |

Distinguish book vs. service products via the existing `product_type` field.

**Files**: `frontend/app/(site)/articles/[slug]/page.tsx`, `frontend/app/(site)/shop/[slug]/page.tsx`, `frontend/app/(site)/[...slug]/page.tsx`, `frontend/app/(site)/articles/page.tsx`, `frontend/app/(site)/shop/page.tsx`, `frontend/app/page.tsx` (homepage)

---

## Item H — Admin UI: SEO panel on content edit forms

Add a collapsible **SEO** section to the bottom of the Article, Product, and Page edit forms.

### Fields (all content types)

- **Meta title** — `<input>`, max 60 chars, live character counter, placeholder shows the resolved fallback title in muted text
- **Meta description** — `<textarea>`, max 160 chars, live character counter, placeholder shows resolved fallback
- **OG image override** — media picker (opens Media Library modal) or direct URL input; shows thumbnail preview when set

### Google snippet preview

Below the meta fields, render a live preview styled as a Google search result:
```
fantasyvreality.com/articles/my-article-slug
Title Goes Here (60 chars max)
Description goes here — this is what shows under the title in...
```
Updates in real-time as the user types. Uses muted styling to make clear it's a preview.

**Files**:
- `frontend/app/admin/articles/[id]/edit/ArticleForm.tsx` — add SEO section
- `frontend/app/admin/products/[id]/edit/ProductForm.tsx` — add SEO section
- `frontend/app/admin/pages/[id]/PageEditor.tsx` — add SEO section
- `frontend/components/admin/SeoPanel.tsx` (new, shared component)

---

## Item I — Admin UI: book fields panel on product edit form

Add a **Book Details** card to the product edit form, visible only when `product_type === 'digital'` or when the owner has added an ISBN (since physical books are also possible). Could use an explicit "Is this a book?" checkbox to keep it clean.

Fields:
- **ISBN** — text input, validates format loosely (10 or 13 digits)
- **Book format** — dropdown: eBook / Paperback / Hardcover / Audiobook
- **Page count** — number input
- **Publisher** — text input
- **Amazon URL** — URL input (used for `sameAs` in Book schema)
- **Goodreads URL** — URL input (used for `sameAs` in Book schema)

These fields double as merchandising data (an owner might display ISBN or publisher on the product page) and as structured data signals.

**Files**:
- `frontend/app/admin/products/[id]/edit/ProductForm.tsx` — add Book Details panel
- `frontend/components/admin/BookDetailsPanel.tsx` (new)

---

## Item J — Dynamic OG image endpoint (optional, build last)

If time permits: generate a social card image at request time for articles and products that don't have a manually set OG image.

```
GET /og?title=OUTSIDERS%3A+Vol.+I&type=book&cover=/media/outsiders.jpg
```

Uses Next.js `ImageResponse` from `next/og`. Applies the site's active palette (background + accent) as the card background, overlays the cover image, and renders the title.

Fallback for routes that don't hit this: the `seo.og_default_image` from ISM.

**Files**: `frontend/app/og/route.tsx` (new)

---

## Item K — Owner's manual: Search Console section

Add a new page to the Owner's Manual at `docs/owners-manual/ch03-aecms-config.html` or as a new `ch05-seo.html`:

1. How to verify ownership of your site with Google Search Console (use the `seo.google_verification` ISM key in Admin Settings → SEO)
2. How to submit `/sitemap.xml` to Search Console
3. How to submit to Bing Webmaster Tools (same sitemap)
4. How to claim your Amazon Author Central page and add your FvR URL as an author website
5. How to set up a Goodreads author profile and link it
6. How to fill in the Author `sameAs` field in Admin Settings → SEO with both profile URLs
7. How to test your structured data with Google's Rich Results Test tool

**Files**: `docs/owners-manual/ch05-seo.html` (new), update sidebar nav in all other manual pages

---

## Acceptance criteria

- [ ] `/sitemap.xml` returns all published articles, products, and non-admin pages with correct URLs and `lastmod` dates
- [ ] `/robots.txt` disallows `/admin`, `/api`, `/checkout`
- [ ] Article detail page `<head>` contains `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:image`, `og:type: article`, `twitter:card`
- [ ] Product detail page for a book emits valid `Book` JSON-LD with `isbn` and `sameAs` (when fields are set)
- [ ] Article detail page emits valid `BlogPosting` JSON-LD with `datePublished`, `dateModified`, `author`
- [ ] Homepage emits `WebSite` + `Person` JSON-LD
- [ ] All interior pages emit `BreadcrumbList` JSON-LD
- [ ] Google's Rich Results Test passes on article and book product pages
- [ ] Admin SEO panel saves and restores `meta_title`, `meta_description`, `og_image_url` on articles, products, and pages
- [ ] Book Details panel saves and restores `isbn`, `book_format`, `page_count`, `publisher`, `amazon_url`, `goodreads_url`
- [ ] Admin Settings → SEO tab saves and restores all `seo.*` ISM keys
- [ ] Canonical `<link>` tag is present on all pages pointing to the correct primary domain

---

## Implementation order

1. **A** — DB migration (unblocks everything else)
2. **B** — Backend DTO pass-through (unblocks admin UI)
3. **C** — ISM keys + SEO settings tab (parallel with D–F)
4. **E** — Sitemap + robots (quick wins, standalone)
5. **F** — JSON-LD component + schema builders (pure logic, testable in isolation)
6. **D** — `generateMetadata()` in all routes
7. **G** — Wire JSON-LD into routes
8. **H** — Admin SEO panel on edit forms
9. **I** — Book fields panel
10. **J** — Dynamic OG image (optional)
11. **K** — Owner's manual section
