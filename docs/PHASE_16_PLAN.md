# Phase 16: Navigation Menus

**Project**: AECMS  
**Phase**: 16  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 11 (Pages), Phase 16A (page hierarchy — DB already schema-ready)

---

## Goal

Replace hardcoded header navigation with a dynamic, backstage-managed menu system that understands the page hierarchy. The nav should automatically surface published pages in their tree structure, with hard routes (Home, Shop, Articles) pinned by the owner and any defined pages or page trees appearing as additional items or submenus.

---

## Part A — Quick Wins (implement first, no schema changes)

### A1 — Rename "Latest" → "Articles"

The `/latest` route and label are a placeholder. The correct label is "Articles."

**Changes:**
- `frontend/components/layout/Header.tsx` lines 67–68: change `href="/latest"` and label `Latest` to `href="/articles"` and `Articles`  
- `frontend/app/(site)/latest/` route directory → rename or alias to `articles/`  
- Add a Next.js redirect in `next.config.js`: `{ source: '/latest', destination: '/articles', permanent: true }` so old links still work
- Update any internal `<Link href="/latest">` references across the codebase

### A2 — Surface page hierarchy in backend

The `Page` model already has `parent_id` and the `PageHierarchy` self-relation defined in the schema. The `PagesService.findAll()` method and the `/pages` endpoint do not currently include child pages or tree structure in their responses.

**Changes needed in `pages.service.ts`:**
- `findAll()`: include `children` in the Prisma select, return a tree structure (flat list with `children: Page[]` on each root)
- `findBySlug(slug)`: current implementation looks up a single slug. For hierarchical URLs (`/author/bio`), the slug passed will be `bio` but we need to verify its parent is `author`. Two options:
  - **Option A (recommended)**: Accept a full path array and resolve: `findByPath(['author', 'bio'])` — walks the tree
  - **Option B**: Keep single-slug lookup but add a `parent_slug` optional param for disambiguation. Less clean.
- `create()` / `update()`: validate that `parent_id` doesn't create a cycle; limit nesting depth to 3 (root → child → grandchild)

**Changes needed in frontend routing:**
- Current: `frontend/app/(site)/pages/[slug]/page.tsx` handles `/pages/[slug]`
- Hierarchical pages should live at their natural path (e.g., `/author`, `/author/bio`) not under `/pages/`
- Next.js App Router supports catch-all routes: `frontend/app/(site)/[...slug]/page.tsx` — this can catch any path, try to match it as a page slug chain, and render the page or 404

**Caution**: The catch-all route needs to be lower priority than existing routes (`/shop`, `/articles`, `/account`, etc.). Next.js resolves by specificity, so named routes always win.

---

## Part B — Navigation Menu System

### B1 — Approach: `nav_order` + `show_in_nav` on Page ✅ DECIDED

> **Decision**: Option 2 (per-page flags). Option 3 (full menu manager) held for a future phase.

Add two fields to the `Page` model: `nav_order Int @default(0)` and `show_in_nav Boolean @default(true)`. The nav reads all published, top-level pages ordered by `nav_order`, filtered by `show_in_nav`. Children with `show_in_nav = true` become submenu items under their parent.

**Schema change** (minimal, one migration):
```prisma
model Page {
  // ... existing fields ...
  nav_order    Int     @default(0)
  show_in_nav  Boolean @default(true)
}
```

### B2 — Hard routes vs page taxonomy: visual separation ✅ DECIDED

> **Decision**: Shop and Articles are always visible and always rendered. They are visually separated from the page taxonomy section of the nav.

**Desktop header layout:**

```
[Logo]   Shop  |  Articles  ||  Author  ›  Contact   [Cart] [Login]
                ↑ hard routes ↑  ↑ page taxonomy items ↑
```

The `||` separator is a subtle vertical divider (`border-l border-border/40 h-4 mx-1`). Hard routes are hardcoded in `Header.tsx` and never affected by the `SiteSettings` nav query. Page taxonomy items are fetched dynamically.

If no published pages have `show_in_nav = true`, the divider and page section are omitted entirely — the nav shows only Shop and Articles.

### B3 — Implementation sequence

1. Add `nav_order` and `show_in_nav` to `Page` schema + migration
2. `GET /pages/nav` endpoint — returns published, `show_in_nav = true` pages in a tree, sorted by `nav_order`; depth limited to 3
3. Update `Header.tsx` to fetch `/pages/nav` and render dynamic items after the separator
4. Submenu dropdown: desktop nav gets a dropdown for any top-level page that has published children
5. Mobile menu: flat list with indented children
6. Backstage page editor: add "Show in navigation" (checkbox) and "Navigation order" (number) fields

If the site later needs fine-grained menu management (multiple menus, custom labels, external links), the Option 3 schema is documented in the git history and can be implemented without conflicting with these fields.

---

## Part C — Hierarchical URL Routing

### C1 — URL structure ✅ DECIDED

> **Decision**: Top-level pages at the root (e.g., `fantasyvreality.com/author`). Max depth: 3 levels (root → child → grandchild).

Pages are addressable by their natural path, not under `/pages/`:

| Page | Parent | URL |
|------|--------|-----|
| Author | (none) | `/author` |
| Bio | Author | `/author/bio` |
| Bibliography | Author | `/author/bibliography` |
| Contact | (none) | `/contact` |

This means the frontend needs a catch-all route and the backend needs a path-resolution endpoint.

### C2 — Backend endpoint

New endpoint: `GET /pages/by-path?path=/author/bio`

Receives a URL path, splits into slug segments `['author', 'bio']`, walks the page tree:
1. Find root page where `slug = 'author'` and `parent_id IS NULL`
2. Find child of that page where `slug = 'bio'`
3. If found and published (or requestor has backstage access): return page
4. Else: 404

This is much simpler than recursive SQL — at most 3 DB calls (max depth 3).

### C3 — Frontend catch-all route

`frontend/app/(site)/[...slug]/page.tsx`:
```typescript
export default async function DynamicPage({ params }: { params: { slug: string[] } }) {
  const path = '/' + params.slug.join('/');
  // Fetch from /pages/by-path?path={path}
  // Render with existing PageRenderer
  // If 404 from API, return Next.js notFound()
}
```

**Conflict avoidance**: Next.js resolves in this order: static files → named routes → dynamic routes → catch-all. So `/shop`, `/articles`, `/cart`, `/account`, etc. are never caught by the catch-all.

### C4 — Slug generation for child pages

When creating a page with a parent, the slug field in the admin form should show the full computed path (`/author/bio`) as a preview, but the stored `slug` value remains just `bio` (the leaf segment). The uniqueness constraint in the schema is on `slug` alone — this means two pages at different levels could technically share a slug (e.g., `/author/contact` and `/contact`). Options:
- **Recommended**: Enforce uniqueness within siblings only (unique on `{parent_id, slug}`). Change the `@@unique` constraint.
- **Alternative**: Store full path as slug (e.g., `author/bio`). Simpler to look up but harder to restructure the tree.

---

## Part D — Backstage Admin Changes

### D1 — Page list

Add a "Parent" column to the admin pages table. Show indented hierarchy in the list view (tree view option).

### D2 — Page edit form

Add fields:
- **Parent page** — select dropdown of existing pages (excluding self and descendants to prevent cycles); "None (top-level)" as default
- **Show in navigation** — checkbox (default true)
- **Navigation order** — number input (default 0, lower = earlier)
- **Full URL preview** — read-only computed field showing the resolved path (e.g., `fantasyvreality.com/author/bio`)

### D3 — Navigation preview

A read-only "Navigation Preview" panel in the backstage (perhaps in the site settings or on the pages list) that renders the current header menu as it will appear to visitors.

---

## Implementation Order

1. A1 — Rename Latest → Articles (30 min, no schema change)
2. Add `nav_order` and `show_in_nav` to Page schema + migration
3. B2 — `GET /pages/nav` endpoint + update Header.tsx to use it
4. C2 + C3 — Path resolution endpoint + catch-all route
5. Change page slug uniqueness to `{parent_id, slug}`
6. D1 + D2 — Admin page editor additions
7. Submenu dropdown in desktop nav (CSS + JS)

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Nav approach | Option 2: `nav_order` + `show_in_nav` on Page |
| Page URL style | Root (e.g., `/author`, `/author/bio`) |
| Max depth | 3 levels (root → child → grandchild) |
| Hard routes (Shop, Articles) | Always visible; visually separated from page taxonomy items |
| Advanced menu manager | Deferred to a future phase |
