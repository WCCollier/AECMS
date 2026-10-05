# BUG-020: Auto-generated internal links use wrong public routes

**Status:** `in-dev`
**Reported:** 2026-10-05
**Severity:** `high`
**Area:** editor, widgets, email, routing

---

## Description

The public product route is `/shop/[slug]`, but several generators build links to routes that do not exist or are legacy. Most visibly, choosing a product in the editor's link dialog (Products tab) inserts `/products/[slug]`, which 404s. The same wrong path is used in product-announcement emails sent to subscribers. Links already saved in content and already-sent emails are broken.

---

## Audit findings (2026-10-05)

Canonical public routes (from `app/(site)`, sitemap, JSON-LD, cards): products `/shop/[slug]`, articles `/articles/[slug]`, pages `/` + hierarchical slug path (`/parent/child`, resolved by the `[...slug]` catch-all). Only `/latest` → `/articles` is redirected today.

| # | Location | Generates | Problem |
|---|----------|-----------|---------|
| 1 | `frontend/components/editor/LinkModal.tsx:86` | `/products/${slug}` | **Wrong** — no such route; 404 |
| 2 | `frontend/components/editor/LinkModal.tsx:28` (`detectInitialTab`) | matches `/products/` | Wrong prefix: real `/shop/` links reopen on the wrong tab |
| 3 | `frontend/components/editor/LinkModal.tsx:78-79` (Pages tab) | `/${p.slug}` | Wrong for **nested pages** — ignores parent path (header nav uses `buildPagePath` correctly) |
| 4 | `backend/src/subscriptions/subscriptions.service.ts:239, 280` | `${appUrl}/products/${slug}` | **Wrong** — product emails (Resend broadcast + SMTP) link to a 404 |
| 5 | `frontend/components/widgets/ArticleEmbed/ArticleEmbed.tsx:116` | `/latest/${slug}` | Legacy route; works only via the `/latest` redirect |

Correct today (verified): ProductCard, ProductEmbed, SearchResultsWidget, SearchResultsEmbed (product/article panes), CartPageClient, AccountPageClient, Header/Footer, `lib/jsonld.ts`, `lib/seoMeta.ts`, `app/sitemap.ts`, `feed.xml`, subscription article emails (`/articles/`).

Root cause: no single source of truth for public URL paths; each generator hard-codes its own prefix.

---

## Fix Plan

Owner decision 2026-10-05: implement items 1-4 below (not the optional content rewrite). Requirement: the content categories (products / articles / pages) are canonical, but the customer-facing URL word ("shop") must be changeable in ONE place.

1. **Single source of truth** — `frontend/lib/routes.config.mjs` (`ROUTE_SEGMENTS`, `LEGACY_ROUTE_SEGMENTS`; plain .mjs so `next.config.mjs`, app code and a backend test can all read it) with typed helpers in `frontend/lib/routes.ts` (`PRODUCTS_PATH`, `ARTICLES_PATH`, `productPath`, `articlePath`, `pagePath`, `linkKind`). Backend mirror: `backend/src/common/public-routes.ts` (`publicProductUrl`, `publicArticleUrl`, `RESERVED_ROUTE_SLUGS`), kept honest by `public-routes.spec.ts`, which fails if the two files disagree.
2. **Safety-net redirects** generated from the config in `next.config.mjs`: `/products`, `/product`, `/latest` (index and `/:path*`) → current segment, permanent. Repairs already-saved content links, sent emails, bookmarks. Legacy segments are also reserved page slugs so a CMS page cannot be shadowed.
3. **LinkModal**: all three tabs use the helpers; Pages tab builds the full nested path; `detectInitialTab` uses `linkKind` (recognises current + legacy segments).
4. **Regression guard**: tests for helpers, redirects and LinkModal output, plus a test that fails if source hard-codes `/shop` or an `href` to `/products|/articles|/latest`.

Renaming a segment later: change `routes.config.mjs` (+ backend mirror), rename the matching `app/(site)/<segment>` folder (Next.js routes are folder-based), move the old name into `LEGACY_ROUTE_SEGMENTS`. The guard tests catch any missed reference.

---

## Completion Report

> _Implemented 2026-10-05; awaiting deploy. Replaced hand-written links in ~25 frontend files (cards, embeds, cart, account, header/footer, SEO/JSON-LD/sitemap/RSS, link dialog) and the 4 subscriber-email URLs. API-call paths (`/products/...` backend endpoints) are a separate namespace and unchanged. The dead legacy `app/(site)/latest/` pages (unreachable behind the redirect) were left untouched._

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-10-05 | open | Reported from live testing; full link-generator audit recorded; fix pending owner decision |
| 2026-10-05 | in-dev | Owner approved items 1-4; implemented, awaiting deploy |
