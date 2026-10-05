# BUG-020: Auto-generated internal links use wrong public routes

**Status:** `open`
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

## Fix Plan (proposed — pending owner decision)

1. **Shared route helpers** — `frontend/lib/routes.ts` (`productPath`, `articlePath`, `pagePath(page, pagesById)`, `linkKind(href)`) and a small backend equivalent (`productUrl/articleUrl(appUrl, slug)`); route every generator above through them.
2. **Safety-net redirects** in `next.config.mjs`: `/products/:slug` and `/product/:slug` → `/shop/:slug` (permanent). Repairs links already saved in content, emails already sent, and bookmarks, with no data migration; backward compatible. Optionally keep `/latest` as is.
3. **LinkModal**: use helpers for all three tabs; `detectInitialTab` recognises `/shop/`, legacy `/products/`, `/articles/`, `/latest/`.
4. **Regression guard**: unit tests for the helpers and LinkModal output, plus a test that fails if source files hard-code the legacy prefixes.
5. Optional: maintenance scan/rewrite of `/products/` links stored in TipTap JSON (existing `admin/maintenance/migrate-content` pattern) to canonicalise stored content.

---

## Completion Report

> _Fill in after fix is deployed._

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-10-05 | open | Reported from live testing; full link-generator audit recorded; fix pending owner decision |
