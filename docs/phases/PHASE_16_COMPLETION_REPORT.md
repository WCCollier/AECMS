# Phase 16 Completion Report: Navigation Menus

**Project**: AECMS  
**Phase**: 16  
**Status**: ✅ COMPLETE  
**Primary commit**: `ed6c979`  
**Date**: 2026-06-17

---

## Summary

Phase 16 replaced the static header navigation with a database-driven system: published pages that are marked `show_in_nav` are fetched from the API and rendered in the header with hover-dropdown submenus for nested page hierarchies. The phase also permanently renamed the `/latest` route to `/articles`, added per-page navigation metadata (order, parent, visibility), and introduced a catch-all URL resolver so arbitrarily nested pages like `/about/team/london` work without any manual route registration.

---

## What Was Delivered

### Area 16-A: `/latest` → `/articles` Rename

- New route directory `frontend/app/(site)/articles/` created by copying `latest/`
  - `LatestPageClient.tsx` → `articles/LatestPageClient.tsx` (identical, path-renamed)
  - `[slug]/ArticlePageClient.tsx` and `[slug]/page.tsx` copied to `articles/[slug]/`
  - `articles/page.tsx` server shell created
- Permanent redirects added in `next.config.mjs`:
  ```js
  { source: '/latest', destination: '/articles', permanent: true },
  { source: '/latest/:path*', destination: '/articles/:path*', permanent: true },
  ```
- All internal `href="/latest"` references updated: `Header.tsx`, `Footer.tsx`, article detail pages, `OrderConfirmationClient.tsx`, and the home page hero

### Area 16-B: Page Schema — Navigation Fields

**`backend/prisma/schema.prisma`** — two new fields on `Page`:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `show_in_nav` | Boolean | `true` | Include in dynamic header nav |
| `nav_order` | Int | `0` | Sort position within a parent; lower = earlier |

**Slug uniqueness changed** from a global `@unique` to a composite constraint:

```prisma
@@unique([parent_id, slug])
```

with `NULLS NOT DISTINCT` in the raw SQL so two top-level pages cannot share a slug, but `/about/team` and `/blog/team` are allowed.

Migration: `20260617150000_add_page_nav_fields` (manually created, applied via `prisma migrate deploy`)

### Area 16-C: PagesService — New Methods

**`findBySlug(slug, userId?, isAdmin?)`**
- Changed from `findUnique({ where: { slug } })` to `findFirst({ where: { slug, parent_id: null, deleted_at: null } })`
- Slug is no longer globally unique; the query scopes to top-level pages

**`findByPath(segments[], userId?, isAdmin?)`**
- Resolves a URL path array (e.g. `['about', 'team']`) to a page by walking the tree up to 3 levels
- Level 1: top-level page matching `segments[0]` (`parent_id: null`)
- Level 2: child of level-1 matching `segments[1]`
- Level 3: child of level-2 matching `segments[2]`
- Returns the page at the deepest resolved level; returns 404 if any segment not found
- Respects visibility: logged-in check and admin-only check per level

**`getNavItems(userId?)`**
- Returns all published `show_in_nav: true` pages as a 3-deep tree
- Ordered by `nav_order ASC, title ASC` at each level
- Guest users see only `visibility: 'public'` pages; logged-in users see `visibility: 'logged_in_only'` too; admin-only pages never appear in the public nav tree

**`show_in_nav` / `nav_order`** passed through on `create()` and `update()`.

**`RESERVED_SLUGS`** updated: `'latest'` replaced with `'articles'`.

### Area 16-D: PagesController — New Endpoints

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| `GET` | `/pages/nav` | `OptionalJwtAuthGuard` | Nav tree for the header |
| `GET` | `/pages/by-path?path=/about/team` | `OptionalJwtAuthGuard` | Resolves a URL to a page |

`GET /pages/by-path` splits the `path` query param on `/`, strips empty segments, then calls `findByPath`.

### Area 16-E: Dynamic Header Navigation

**`frontend/components/layout/Header.tsx`** — complete rewrite:

- Fetches `GET /pages/nav` via SWR (60-second deduplication interval, does not block render)
- Hard-coded routes (Shop, Articles) are separated from the page taxonomy section by a subtle vertical border divider
- Page taxonomy items render as nav links with hover-triggered dropdown submenus for pages that have children
- Dropdown appears on `onMouseEnter` / hides on `onMouseLeave` with a 150 ms delay to prevent accidental dismissal
- Mobile menu expands to a flat list; child pages are indented with `pl-6`
- When the nav fetch fails or returns empty, only the hard-coded routes are shown — the header never breaks

**`PageNavItem`** component (inline in Header.tsx):
- Renders a nav link, optionally wrapped in a dropdown parent
- Handles active-route highlighting via `usePathname()`

### Area 16-F: Catch-All Page Route

**`frontend/app/(site)/[...slug]/page.tsx`** (replaces the former `[slug]/page.tsx`)

- Accepts an array of path segments from Next.js catch-all routing
- Joins them and calls `GET /pages/by-path?path=/segment1/segment2/...`
- Named routes (`/shop`, `/articles`, `/account`, etc.) take priority over the catch-all in App Router; no conflicts
- Handles 404 from the API by rendering a "Page not found" state

### Area 16-G: Admin Page Editor — Navigation Controls

**`frontend/app/admin/pages/[id]/edit/EditPageClient.tsx`** additions:

- **Parent Page** — dropdown populated from `GET /pages?limit=100&status=published`, filtered to exclude the current page (prevents self-parenting); shows URL hierarchy preview
- **Nav Order** — number input, default 0; lower values appear first
- **Show in Nav** — checkbox; default checked
- **URL Preview** — computed live: `/{parent.slug}/{this.slug}` or `/{this.slug}` for top-level pages

---

## Files Created / Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | `show_in_nav`, `nav_order`, composite slug unique |
| `backend/prisma/migrations/20260617150000_add_page_nav_fields/migration.sql` | New |
| `backend/src/pages/pages.service.ts` | `findBySlug`, `findByPath`, `getNavItems`, nav fields in create/update |
| `backend/src/pages/pages.service.spec.ts` | Updated mocks for `findFirst`, updated reserved slugs |
| `backend/src/pages/pages.controller.ts` | `/pages/nav`, `/pages/by-path` endpoints |
| `backend/prisma/import-wp-migration.ts` | `findUnique` → `findFirst` for slug lookup |
| `frontend/next.config.mjs` | Permanent `/latest` redirects |
| `frontend/app/(site)/articles/` | New route (copied from `/latest/`) |
| `frontend/app/(site)/latest/` | Kept for backward-compat; routes redirect to `/articles/` |
| `frontend/app/(site)/[...slug]/page.tsx` | New catch-all (replaces `[slug]/page.tsx`) |
| `frontend/components/layout/Header.tsx` | Dynamic nav with SWR, dropdown submenus |
| `frontend/app/admin/pages/[id]/edit/EditPageClient.tsx` | Nav controls: parent, order, show_in_nav, URL preview |

---

## Test Results

- **Unit tests updated**: `pages.service.spec.ts` — added `findFirst` mocks, updated reserved slugs list
- **Total backend tests**: 190 (all passing)
- **Frontend tests**: 125 (all passing)

---

## API Endpoint Count Change

Phase 16 added 2 endpoints (`GET /pages/nav`, `GET /pages/by-path`), bringing the total to **135**.

---

## Remaining / Deferred

- **Max nav depth is 3** — the service and catch-all route support up to 3 levels (`/a/b/c`). Deeper hierarchies would require a recursive query or a materialised path column; deferred as not needed for the planned site structure.
- **Nav drag-and-drop ordering** — `nav_order` is set manually via the number input. A drag-and-drop reorder UI would be a UX improvement but is out of scope for Phase 16.
- **Mega-menu or icon support** — the nav currently shows text-only links. Icon or image-based nav blocks are deferred.
