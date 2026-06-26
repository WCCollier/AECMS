# Phase 26 Completion Report: SEO Toolkit

**Project**: AECMS  
**Phase**: 26  
**Status**: ✅ DEPLOYED 2026-06-26  
**Commits**: `7bd2c2c` feat: Phase 26 — SEO toolkit (2026-06-21); `377ca1d` fix: replace FvR-specific placeholder text in SEO settings tab (2026-06-22)  
**Deployed**: `86bc807` Merge branch 'main' into deploy (2026-06-26 03:06 UTC)  
**PRD**: `docs/prd/15-seo-toolkit.md`  
**Plan**: `docs/phases/PHASE_26_PLAN.md`  
**Tests**: 190 backend + 125 frontend unit tests (all passing, no regressions)

---

## Overview

Phase 26 added a complete SEO layer to AECMS. Every published page now has accurate `<title>`, `<meta name="description">`, full Open Graph tags, canonical `<link>`, and appropriate JSON-LD structured data. `/sitemap.xml` and `/robots.txt` are served dynamically by Next.js. Book products carry ISBN, publisher, and `sameAs` links (Amazon/Goodreads). The admin backstage has per-content SEO panels with live Google snippet previews and a new SEO settings tab for site-level configuration.

37 files changed, 1176 insertions.

---

## Item A — DB Migration ✅

**Migration**: `20260626000000_add_seo_og_and_book_fields`

New nullable fields added:

| Model | Field(s) |
|-------|---------|
| Article | `og_image_url String?` |
| Page | `og_image_url String?` |
| Product | `og_image_url String?`, `isbn String?`, `book_format String?`, `page_count Int?`, `publisher String?`, `amazon_url String?`, `goodreads_url String?` |

No data backfill required — all nullable.

**Files**: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260626000000_add_seo_og_and_book_fields/migration.sql`

---

## Item B — Backend API Pass-Through ✅

New fields exposed in DTOs with `@IsOptional()` validators:

- `backend/src/articles/dto/create-article.dto.ts` — added `og_image_url`
- `backend/src/pages/dto/create-page.dto.ts` — added `og_image_url`
- `backend/src/products/dto/create-product.dto.ts` — added all 7 product SEO/book fields; `page_count` uses `@IsInt() @Min(1)`

Prisma returns all scalar fields by default — no changes to service `select` clauses required.

---

## Item C — Site-Level SEO Settings ✅

**New ISM keys** (stored in `SiteSettings` table, no new table):

| Key | Description |
|-----|-------------|
| `seo.site_name` | Site name for `og:site_name` |
| `seo.site_description` | Default homepage meta description |
| `seo.og_default_image` | Fallback OG image URL |
| `seo.author_name` | Author display name |
| `seo.author_url` | Canonical author page URL |
| `seo.author_twitter` | Twitter/X handle for `twitter:creator` |
| `seo.author_same_as` | Newline-separated author profile URLs |
| `seo.canonical_domain` | Primary domain for canonical tags |
| `seo.google_verification` | Google Search Console meta content value |
| `seo.robots_additional` | Extra lines appended to robots.txt |

**New endpoints**:
- `PATCH /settings/seo` — requires `system.configure.general` capability; filters to `seo.*` namespace
- `GET /settings-public/seo` — public read for frontend metadata generation

**SEO tab** added to Admin Settings alongside General / Email / Payments / Storage / Appearance.

**Files**: `backend/src/settings/settings.controller.ts`, `backend/src/settings/settings.service.ts`, `frontend/app/admin/settings/SettingsClient.tsx`

---

## Item D — `generateMetadata()` in All Site Routes ✅

**Helper**: `frontend/lib/seoMeta.ts` — `buildMetadata()` resolves the fallback chain: explicit `meta_title`/`meta_description` → content title/excerpt/short_description → site defaults. Returns Next.js `Metadata` object with `title`, `description`, `openGraph`, `twitter`, `alternates.canonical`.

All site routes updated to export `generateMetadata()` alongside the default export:

| Route file | Metadata fetches |
|-----------|-----------------|
| `app/(site)/articles/[slug]/page.tsx` | Article by slug |
| `app/(site)/shop/[slug]/page.tsx` | Product by slug |
| `app/(site)/[...slug]/page.tsx` | Page by slug |
| `app/(site)/articles/page.tsx` | Site settings (static + site name) |
| `app/(site)/shop/page.tsx` | Site settings |
| `app/layout.tsx` | Site settings (root layout) |

Data fetched server-to-server via `BACKEND_URL` with `{ next: { revalidate: 60 } }` — cached 60 seconds, not per-request. All routes emit OG and Twitter tags.

---

## Item E — Sitemap and robots.txt ✅

**`frontend/app/sitemap.ts`**: Next.js App Router serves this as `/sitemap.xml`. Fetches all published articles, products, and non-admin pages in `Promise.all`. Returns static entries (homepage, /articles, /shop) plus dynamic per-content entries with `lastmod` from `updated_at`. Revalidates hourly (`export const revalidate = 3600`).

**`frontend/app/robots.ts`**: Serves `/robots.txt`. Disallows `/admin`, `/api`, `/checkout`, `/order-confirmation`. References `/sitemap.xml`. Appends `seo.robots_additional` lines from ISM if configured.

---

## Item F — JSON-LD Component + Schema Builders ✅

**`frontend/components/JsonLd.tsx`**: Server component that injects a `<script type="application/ld+json">` tag.

**`frontend/lib/jsonld.ts`**: Schema builder functions for all content types. Uses the `schema-dts` npm package for TypeScript-typed `WithContext<T>` schema objects:

| Builder | Output schema |
|---------|--------------|
| `buildArticleSchema()` | `BlogPosting` — title, description, datePublished, dateModified, author |
| `buildBookSchema()` | `Book` — name, isbn (if set), bookFormat, numberOfPages, publisher, sameAs (Amazon+Goodreads URLs) |
| `buildServiceSchema()` | `Service` — name, description, offers with price |
| `buildProductSchema()` | `Product` — name, description, offers (fallback for physical/other types) |
| `buildPersonSchema()` | `Person` — name, url, sameAs array from `seo.author_same_as` ISM key |
| `buildWebSiteSchema()` | `WebSite` — name, url, description |
| `buildBreadcrumbSchema()` | `BreadcrumbList` — ordered crumb items |

---

## Item G — JSON-LD Wired Into Routes ✅

JSON-LD injected in server page wrapper components (alongside `generateMetadata`). Data fetched once, shared between metadata generation and schema building. Route → schema mapping:

| Route | JSON-LD blocks |
|-------|---------------|
| Homepage (`/`) | `WebSite`, `Person` |
| Article list (`/articles`) | `BreadcrumbList` |
| Article detail | `BlogPosting`, `BreadcrumbList` |
| Shop list (`/shop`) | `BreadcrumbList` |
| Product — book | `Book`, `BreadcrumbList` |
| Product — service | `Service`, `BreadcrumbList` |
| Product — other | `Product`, `BreadcrumbList` |
| Page (`/[...slug]`) | `WebPage`, `BreadcrumbList` |

Product type distinguished via `product_type` field (digital = book path; service = service path; physical = generic product).

---

## Item H — Admin SEO Panel on Content Edit Forms ✅

**`frontend/components/admin/ArticleForm.tsx`**: Added collapsible SEO section with `meta_title` (60 char counter), `meta_description` (160 char counter), `og_image_url` field, and live Google snippet preview (updates in real-time as the user types).

**`frontend/components/admin/ProductForm.tsx`**: Same SEO section as articles. Snippet preview shows the resolved URL path.

**`frontend/app/admin/pages/[id]/edit/EditPageClient.tsx`**: SEO fields (`meta_title`, `meta_description`, `og_image_url`) added with character counters and snippet preview.

The snippet preview renders a styled block that mirrors a Google search result card (URL, title, description in muted grey text) so owners can see exactly what search engines will display.

---

## Item I — Book Fields Panel on Product Edit Form ✅

Added a **Book Details** collapsible card to the product edit form. Visible for all products; the owner decides whether to populate it.

Fields implemented:
- **ISBN** — text input (10 or 13 digit format)
- **Book format** — dropdown: eBook / Paperback / Hardcover / Audiobook
- **Page count** — number input
- **Publisher** — text input
- **Amazon URL** — URL input (populates `sameAs` in `Book` JSON-LD)
- **Goodreads URL** — URL input (populates `sameAs` in `Book` JSON-LD)

These fields also double as visible merchandising data on the product page if the owner chooses to display them.

**Files**: `frontend/components/admin/ProductForm.tsx`

---

## Item J — Dynamic OG Image Endpoint ⏭️ DEFERRED

This was marked optional in the plan ("build last, if time permits"). Not implemented. The `seo.og_default_image` ISM key provides a static fallback OG image for all routes that don't have a per-content OG image override. Dynamic image generation via Next.js `ImageResponse` can be added in a future phase.

---

## Item K — Owner's Manual: SEO Chapter ✅

**`docs/owners-manual/ch08-seo.html`** (new, 191 lines):

1. How to verify ownership with Google Search Console using `seo.google_verification`
2. How to submit `/sitemap.xml` to Search Console
3. How to submit to Bing Webmaster Tools
4. How to claim Amazon Author Central and add the site URL
5. How to set up a Goodreads author profile and link it
6. How to fill in the Author `sameAs` field with profile URLs
7. How to test structured data with Google's Rich Results Test

Ch 8 link added to sidebar nav in all other Owner's Manual pages (index + ch01–ch07).

---

## Bug Fixed Alongside

`frontend/app/admin/users/page.tsx` was missing `export const dynamic = 'force-dynamic'`, which caused the Next.js build to fail (the page uses the admin API client which is client-side only). Added the export as part of this phase.

---

## Follow-Up Fix (2026-06-22)

`377ca1d fix: replace FvR-specific placeholder text in SEO settings tab with generic examples`

Placeholder text in the SEO settings tab referenced the owner's specific site, name, and handles. Seven fields updated to use generic examples (e.g. "My Book Site", "https://yoursite.com", "@yourhandle") to maintain AECMS as a distributable generic CMS.

---

## Acceptance Criteria

- [x] `/sitemap.xml` returns all published articles, products, and non-admin pages with correct URLs and `lastmod` dates
- [x] `/robots.txt` disallows `/admin`, `/api`, `/checkout`
- [x] Article detail page `<head>` contains `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:image`, `og:type: article`, `twitter:card`
- [x] Product detail page for a book emits valid `Book` JSON-LD with `isbn` and `sameAs` (when fields are set)
- [x] Article detail page emits valid `BlogPosting` JSON-LD with `datePublished`, `dateModified`, `author`
- [x] Homepage emits `WebSite` + `Person` JSON-LD
- [x] All interior pages emit `BreadcrumbList` JSON-LD
- [x] Admin SEO panel saves and restores `meta_title`, `meta_description`, `og_image_url` on articles, products, and pages
- [x] Book Details panel saves and restores `isbn`, `book_format`, `page_count`, `publisher`, `amazon_url`, `goodreads_url`
- [x] Admin Settings → SEO tab saves and restores all `seo.*` ISM keys
- [x] Canonical `<link>` tag is present on all pages pointing to the correct primary domain
- [ ] ~~Dynamic OG image endpoint~~ — deferred (static fallback via `seo.og_default_image` ISM key instead)

---

## Files Delivered

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | `og_image_url` on Article/Page/Product; book fields on Product |
| `backend/prisma/migrations/20260626000000_add_seo_og_and_book_fields/migration.sql` | New |
| `backend/src/articles/dto/create-article.dto.ts` | `og_image_url` field |
| `backend/src/pages/dto/create-page.dto.ts` | `og_image_url` field |
| `backend/src/products/dto/create-product.dto.ts` | All 7 SEO/book fields |
| `backend/src/settings/settings.controller.ts` | `PATCH /settings/seo`, `GET /settings-public/seo` |
| `backend/src/settings/settings.service.ts` | `seo.*` namespace handler |
| `frontend/lib/seoMeta.ts` | New — `buildMetadata()` fallback chain |
| `frontend/lib/jsonld.ts` | New — 7 schema builder functions |
| `frontend/components/JsonLd.tsx` | New — `<script type="application/ld+json">` injector |
| `frontend/app/sitemap.ts` | New — dynamic `/sitemap.xml` |
| `frontend/app/robots.ts` | New — dynamic `/robots.txt` |
| `frontend/app/(site)/page.tsx` | `generateMetadata()` + WebSite + Person JSON-LD |
| `frontend/app/(site)/articles/page.tsx` | `generateMetadata()` + BreadcrumbList |
| `frontend/app/(site)/articles/[slug]/page.tsx` | `generateMetadata()` + BlogPosting + BreadcrumbList |
| `frontend/app/(site)/shop/page.tsx` | `generateMetadata()` + BreadcrumbList |
| `frontend/app/(site)/shop/[slug]/page.tsx` | `generateMetadata()` + Book/Service/Product + BreadcrumbList |
| `frontend/app/(site)/[...slug]/page.tsx` | `generateMetadata()` + WebPage + BreadcrumbList |
| `frontend/app/layout.tsx` | Root layout metadata updated (site name, OG default image) |
| `frontend/app/admin/settings/SettingsClient.tsx` | SEO tab (10 fields) |
| `frontend/app/admin/pages/[id]/edit/EditPageClient.tsx` | SEO fields + snippet preview |
| `frontend/app/admin/users/page.tsx` | Added missing `force-dynamic` |
| `frontend/components/admin/ArticleForm.tsx` | SEO section + snippet preview |
| `frontend/components/admin/ProductForm.tsx` | SEO section + snippet preview + Book Details panel |
| `docs/owners-manual/ch08-seo.html` | New — Search Console, entity graph, book details, Rich Results Test |
| `docs/owners-manual/index.html` + ch01–ch07 | Ch 8 link added to all sidebars |

---

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| Backend unit tests | 190/190 | 190/190 ✅ |
| Frontend unit tests | 125/125 | 125/125 ✅ |

---

## Next Steps

- **Phase 27**: Design Library — manual palette creation, page templates, export/import, Mul Converter integration
- **Dynamic OG images** (deferred Item J): can be added whenever social sharing becomes a priority; the static `seo.og_default_image` fallback is sufficient for now
- **Rich Results Test**: validate article and book product pages against Google's Rich Results Test after deploy to confirm JSON-LD renders correctly in production
