# Phase 11 Completion Report: Pages — Widget-Composed Page Builder

**Project**: AECMS  
**Phase**: 11  
**Status**: ✅ COMPLETE  
**Commit**: `eeec2ad`  
**Date**: 2026-06-04

---

## Summary

Phase 11 delivers the Pages content type as a fully functional, widget-composed page builder. Pages use the same TipTap JSON format as Articles and Products, but store multiple independent "zone" documents inside a `PageContent` envelope — allowing multi-column and sidebar layouts. All existing widgets gained dual-size rendering (large/small) and conditional display (`show_when`) support. Three new widgets were added: RichTextBox, ArticleEmbed, and ProductEmbed.

---

## What Was Delivered

### Backend (Sections A, I)

- **Reserved slug protection**: `PagesService.create()` and `.update()` reject slugs that match application routes (`shop`, `admin`, `cart`, `checkout`, `account`, `order-confirmation`, `auth`, `api`) with a 409 ConflictException.
- **`layout` field on DTO**: `CreatePageDto` now accepts `layout: 'no_sidebar' | 'sidebar_left' | 'sidebar_right' | 'split_comparison'` with `@IsIn` validation. `UpdatePageDto` inherits it via `PartialType`.
- `GET /pages/slug/:slug` and `findBySlug()` were already present — no changes needed.

### Frontend Foundation (Section B)

| Item | File |
|------|------|
| `PageLayout` / `PageContent` types | `frontend/types/index.ts` |
| `parsePageContent`, `getZonesForLayout`, `isPageContent`, `layoutContainerClass`, `LAYOUT_LABELS` | `frontend/lib/pageContent.ts` |
| `stripWidgetNodes`, `extractFirstParagraphText` | `frontend/lib/stripWidgetNodes.ts` |
| `WidgetSizeContext`, `WidgetSizeProvider`, `useWidgetSize` | `frontend/contexts/WidgetSizeContext.tsx` |
| `useIsDesktop` (matchMedia, 1024px breakpoint, SSR-safe) | `frontend/hooks/useIsDesktop.ts` |
| `ConditionalWidget` (`show_when: 'always' | 'logged_in' | 'logged_out'`) | `frontend/components/widgets/ConditionalWidget.tsx` |
| `conditionalDisplayAttribute`, `showWhenBadge`, `SHOW_WHEN_OPTIONS/LABELS` | `frontend/components/editor/extensions/conditionalDisplay.ts` |

### Widget Small Variants + show_when (Section C)

All four existing widget display components now read `useWidgetSize()` and render a compact variant when `size === 'small'`:

| Widget | Small behavior |
|--------|---------------|
| `MediaGallery` | Auto-rotates every 3s; no controls, no arrows, no dots |
| `Callout` | Single-line left-border pill with icon and truncated text |
| `VideoEmbed` | Static thumbnail (YouTube `hqdefault.jpg`) with play button overlay; links to original URL in new tab |
| `XEmbed` | oEmbed card: `@handle`, display name, truncated post text, "View on X" link; no `widgets.js` loaded |

All four TipTap nodes gained the `show_when` attribute. In the editor, widgets always render (regardless of `show_when`) but display a "Members only" / "Guests only" badge and radio buttons in the hover overlay. In read-only mode, nodes wrap in `ConditionalWidget`. The Callout node gained a `summary` attribute that is auto-populated on blur (used by the small variant for preview text).

### New Widgets (Sections D, E, G)

**ArticleEmbed**
- Large: featured image + category badges + title link + date + first-paragraph excerpt + "Read more" CTA
- Small: thumbnail (80×80) + title (2-line) + excerpt (1-line) + link
- Fetches via SWR from `GET /articles/{id}`; excerpt strips widget nodes via `stripWidgetNodes()`
- TipTap node: atom, article picker (searchable list of published articles via admin API)

**ProductEmbed**
- Large: square image + name + star rating + price/compare-at price + stock status + "Add to Cart" + "View Details"
- Small: 64×64 thumbnail + name + price + mini cart button + view link
- Add-to-cart works from both variants via `useCart().addItem()`
- TipTap node: atom, product picker (searchable list of published products via admin API)

**RichTextBox**
- A styled block container with `NodeViewContent` (identical architecture to Callout — outer editor owns the content)
- Small: same rendering + warning banner if content > 300 chars
- TipTap node: non-atom (`content: 'block+'`), `defining: true`, delete button in editor overlay

### Nested Embed Protection (Section F)

`stripWidgetNodes()` recursively removes all widget-type nodes (`mediaCarousel`, `callout`, `videoEmbed`, `xEmbed`, `articleEmbed`, `productEmbed`, `image`) from a TipTap JSON document before extracting preview text. `ArticleEmbed` and `ProductEmbed` always call this before rendering excerpt text — a widget-heavy article's embed card shows only the first paragraph of actual prose, not a nested carousel or tweet.

### oEmbed Route Handler (Section C4)

`frontend/app/api/oembed/twitter/route.ts` — proxies `https://publish.twitter.com/oembed` server-side to avoid CORS. Uses Next.js `{ next: { revalidate: 3600 } }` fetch caching (1hr per URL). Returns `{ author_name, author_url, html }`. No API key required.

### Page Layout Renderer (Section H)

| Layout | Component | Zone sizes |
|--------|-----------|------------|
| `no_sidebar` | `NoSidebarLayout` | main → large |
| `sidebar_left` | `SidebarLeftLayout` | sidebar → small, main → large |
| `sidebar_right` | `SidebarRightLayout` | main → large, sidebar → small |
| `split_comparison` | `SplitComparisonLayout` | both → large @ ≥1024px, small @ <1024px |

`PageRenderer` dispatches to the correct layout based on `parsePageContent(page.content).layout`.

**Public slug routing**: `app/(site)/[slug]/page.tsx` — server component, `force-dynamic`, fetches `GET /pages/slug/{slug}`, returns 404 for draft/admin-only/not-found pages.

### Admin Page Builder (Section J)

- **`/admin/pages`** — table with title, slug, layout, status, updated date; search; pagination; delete with confirm
- **`/admin/pages/new`** — two-step: (1) layout card selector + title/slug input, (2) multi-zone `PageZoneEditor`; status dropdown; save
- **`/admin/pages/[id]/edit`** — loads existing `PageContent`, shows zone editors pre-populated; layout change with confirmation dialog (preserves main content, discards sidebar); "Preview small widgets" toggle wraps editors in `WidgetSizeProvider size="small"`
- **`PageZoneEditor`** — renders one `TipTapEditor` per zone for the chosen layout; sidebar zone shows "Small widgets" badge and hint text
- **Admin nav**: Pages link added (LayoutTemplate icon) between Articles and Orders

---

## Architecture Decisions Confirmed

- **Zone architecture**: Each zone is an independent TipTap JSON document stored inside `Page.content` as `JSON.stringify(PageContent)`. Zones reuse the exact same TipTap extensions as article/product bodies.
- **Widget sizing via context**: `WidgetSizeContext` wraps each zone at render time. Widgets read `useWidgetSize()` — no per-widget breakpoint logic needed.
- **ConditionalWidget**: Client-side display convenience, not a security boundary. The full page JSON is delivered to the browser; `show_when` controls rendering only.
- **Cross-zone drag**: Deferred. Zones are independent documents; cut/paste works natively via TipTap. Future enhancement.
- **Landing Page / Article List / Product Showcase widgets**: Deferred per user instruction — isolated extensions for a future phase.

---

## Test Counts

| Suite | Before | After |
|-------|--------|-------|
| Frontend unit tests | 90 | 116 (+26) |
| Backend unit tests | 154 | 169 (+15) |

**New frontend tests** (3 suites):
- `stripWidgetNodes` — 10 cases
- `pageContent` — 12 cases  
- `WidgetSizeContext` — 4 cases

**New backend tests** (1 suite):
- `PagesService` — 15 cases (reserved slugs, slug uniqueness, findBySlug)

---

## Files Changed

**45 files changed**, 2,557 insertions, 84 deletions.

Key new files:
- `backend/src/pages/pages.service.spec.ts`
- `frontend/lib/pageContent.ts`, `stripWidgetNodes.ts`
- `frontend/contexts/WidgetSizeContext.tsx`
- `frontend/hooks/useIsDesktop.ts`
- `frontend/components/widgets/ConditionalWidget.tsx`
- `frontend/components/editor/extensions/conditionalDisplay.ts`
- `frontend/components/editor/extensions/article-embed.tsx`
- `frontend/components/editor/extensions/product-embed.tsx`
- `frontend/components/editor/extensions/rich-text-box.tsx`
- `frontend/components/widgets/ArticleEmbed/ArticleEmbed.tsx`
- `frontend/components/widgets/ProductEmbed/ProductEmbed.tsx`
- `frontend/components/widgets/RichTextBox/RichTextBox.tsx`
- `frontend/components/pages/PageRenderer.tsx`
- `frontend/components/pages/layouts/` (4 layout components)
- `frontend/app/(site)/[slug]/page.tsx`
- `frontend/app/admin/pages/` (AdminPagesClient, NewPageClient, EditPageClient)
- `frontend/app/api/oembed/twitter/route.ts`
- `frontend/components/admin/PageZoneEditor.tsx`

---

## Phase 12 Notes

Phase 12 (Audit Trail) is unchanged from the plan documented in `docs/PHASE_12_PLAN.md`. Phase 11 introduced no new backend models or service patterns that require Phase 12 plan revisions. The `Page` content type could logically gain version history (like Articles/Products) — this is a natural extension of Phase 12 Section G/F but was not explicitly planned. Worth adding as a Section G addendum when Phase 12 begins.
