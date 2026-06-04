# Phase 10: Widget System & Media Normalization — Implementation Plan

**Project**: AECMS - Advanced Ecommerce Content Management System
**Phase**: Phase 10 — Widget System & Media Normalization
**Status**: ✅ Phase 10A COMPLETE — 🔄 Phase 10B PLANNED
**Started**: 2026-06-04

---

## Goal

Establish a normalized, extensible widget system that Articles, Products, and (eventually) Pages share. Phase 10A delivers the first widget — a hero `MediaGallery` that replaces the current single-image "featured image" pattern. Phase 10B migrates the TipTap editor to JSON content storage, enabling the same widgets to be embedded inline inside body content.

---

## Background & Motivation

During Phase 9 user testing, an audit of the admin CRUD forms revealed:

1. `ArticleForm` and `ProductForm` are parallel in purpose but diverge in implementation.
2. Articles use a direct FK (`featured_image_id`) for their single featured image.
3. Products use a junction table (`ProductMedia`, `is_primary`) designed for a gallery — but the gallery is never used; only `featured_image_url` is derived and rendered.
4. Neither detail page renders a carousel; no carousel component exists.
5. The `ArticleMedia` junction table exists in the schema but is never queried.
6. The `ImageField` admin component emits only a URL; it silently drops the media ID, making image saves non-functional in both forms.
7. Pages have no media infrastructure at all.

The core design intent — that products should display a gallery carousel while articles show a single image — is correct but has never been wired up. This phase delivers that wiring and normalizes the two models so they share a common data contract and common display components.

---

## Design Decisions

### D1 — Two-zone model

Every content type has two distinct media zones:

| Zone | Where | Mechanism |
|------|-------|-----------|
| **Hero** | Above content, full-width | `media[]` array, rendered by `MediaGallery` |
| **Body** | Inside TipTap content | Inline widget nodes (Phase 10B) |

The `MediaGallery` component is the canonical implementation for both zones. Built once, used everywhere.

### D2 — Media data contract (normalized)

All content type APIs return the same shape for their media array:

```typescript
interface MediaItem {
  id: string;
  url: string;
  order: number;
  is_primary: boolean;
  alt_text?: string | null;
}
```

The `featured_image_url` convenience field is retained in API responses for backwards compatibility with existing customer-facing components, but admin forms and detail pages migrate to `media[]`.

### D3 — Option A: Converge Article on the junction-table model

Articles currently have `featured_image_id` (direct FK) + `ArticleMedia[]` (unused gallery junction). Products have only `ProductMedia[]` with `is_primary`. After Phase 10A:

- `ArticleMedia` gains an `is_primary Boolean @default(false)` field.
- `Article.featured_image_id` is dropped. The junction table is the sole source of truth.
- Both models are topologically identical for media: `media[]` junction with `is_primary` + `order`.
- `featured_image_url` on Article API responses is computed from `ArticleMedia[is_primary]`, same as products.

### D4 — Pages deferred

Pages are architecturally distinct — they will eventually be built entirely from widgets, with no conventional content body. Their media handling will be designed as part of that larger page-builder phase. Pages are excluded from Phase 10.

### D5 — TipTap JSON deferred to Phase 10B

Phase 10A does not touch the TipTap editor or its content format. The hero `MediaGallery` sits outside TipTap entirely. Phase 10B will switch content storage from HTML strings to TipTap JSON, enabling inline widget nodes. That migration is a distinct, larger change.

### D6 — `MediaGallery` display behavior

```
media.length === 0  →  placeholder / empty state (admin: "Add images" prompt)
media.length === 1  →  static image, no carousel chrome (articles with one image look identical to current)
media.length > 1    →  carousel with dot indicators and prev/next arrows, primary image displayed first
```

Articles with a single image look exactly as they do today. The carousel only activates when multiple images are present.

### D7 — `MediaGalleryField` in admin forms

Replaces the current `ImageField` (single-image) in `ArticleForm` and `ProductForm`. Supports:
- Picking images from the media library (existing `MediaPicker`)
- Uploading new images
- Drag-to-reorder
- Setting one image as primary (used for catalogue cards and `featured_image_url`)
- Removing images

---

## Phase 10A: Hero Carousel

### A1 — Database migration ✅

- [x] Add `is_primary Boolean @default(false)` to `ArticleMedia` model
- [x] Drop `featured_image_id` from `Article` model (all values were NULL — no backfill needed)
- [x] Update `Media` model relations (`article_featured` relation removed)
- [x] Run and verify migration against seeded data

### A2 — Backend: Article API ✅

- [x] Update `articles.service.ts`: replace `featured_image_id` logic with `ArticleMedia` junction writes via `setArticleMedia()`
- [x] `getArticleInclude()`: fetches `ArticleMedia` with nested `Media`, ordered by `order asc`
- [x] `transformArticle()`: computes `featured_image_url` from `media[is_primary]`, returns `media: MediaItem[]`
- [x] `CreateArticleDto` / `UpdateArticleDto`: `featured_image_id` → `media_ids?: string[]`
- [x] `create()` / `update()`: writes junction rows via `setArticleMedia()`
- [x] 154 backend unit tests still pass

### A3 — Backend: Product API ✅

- [x] `media_ids?: string[]` added to `CreateProductDto` (propagates to `UpdateProductDto` via `PartialType`)
- [x] `setProductMedia()` helper writes `ProductMedia` rows (first = `is_primary: true`)
- [x] `buildProductBase()` rewritten: returns normalized `MediaItem[]` with `is_primary`, `order`, `alt_text`
- [x] Both create and update call `setProductMedia()` when `media_ids` provided

### A4 — Frontend: `MediaItem` type ✅

- [x] `MediaItem` interface added to `frontend/types/index.ts`
- [x] `media: MediaItem[]` added to `Article` interface
- [x] `media: MediaItem[]` added to `Product` interface
- [x] `product_type` union updated to include `'digital'`

### A5 — Frontend: `MediaGallery` display component ✅

- [x] `frontend/components/widgets/MediaGallery/MediaGallery.tsx` created
  - 0 images: null (or `fallback` prop)
  - 1 image: static `<Image>`, no carousel chrome
  - N images: carousel with dot indicators, prev/next arrows, keyboard navigation, image counter
  - Primary image shown first
- [x] `frontend/components/widgets/index.ts` barrel export

### A6 — Frontend: `MediaGalleryField` admin component ✅

- [x] `frontend/components/widgets/MediaGallery/MediaGalleryField.tsx` created
  - Wraps `MediaPicker`; prevents duplicate adds
  - Up/down reorder buttons
  - Set-primary (star) action
  - Remove action
  - Emits `GalleryEntry[]` with `{ mediaId, url, isPrimary }`
- [x] `ArticleForm.tsx`: `ImageField` → `MediaGalleryField`; submits `media_ids`
- [x] `ProductForm.tsx`: `ImageField` → `MediaGalleryField`; submits `media_ids`
- [x] `EditArticleClient.tsx` / `EditProductClient.tsx`: interfaces updated to include `media: MediaItem[]`

### A7 — Frontend: detail pages ✅

- [x] `ArticlePageClient.tsx`: static image block → `<MediaGallery media={article.media} aspectRatio="video" />`
- [x] `ProductPageClient.tsx`: static image block → `<MediaGallery media={product.media} aspectRatio="square" fallback={...} />`
- [x] `ArticleCard.tsx` / `ProductCard.tsx`: unchanged — continue using `featured_image_url` (catalogue cards stay simple)

### A8 — Tests & verification ✅

- [x] 154/154 backend unit tests pass
- [x] Frontend TypeScript build clean
- [x] API: article with 1 image → `media[0].is_primary=true`, `featured_image_url` set
- [x] API: article with 2 images → `media[1].is_primary=false`, correct order
- [x] API: PATCH article reorder → new primary correctly reflects in `featured_image_url`
- [x] API: product with 2 images → normalized `MediaItem[]` shape with `is_primary`/`order`
- [x] API: existing seeded product media → `is_primary=true` on single image, `featured_image_url` intact
- [x] Manual UI: create article with images via admin form → gallery renders on detail page
- [x] Manual UI: create product with images via admin form → carousel renders on product page
- [x] Manual UI: reorder in admin form → persisted correctly

---

## Phase 10B: TipTap JSON Migration + Inline Widgets

### B1 — Content format migration

- [ ] Switch TipTap to emit `editor.getJSON()` instead of `editor.getHTML()`
- [ ] One-time migration: convert all existing `content` column values from HTML to TipTap JSON using `generateJSON(html, extensions)`
- [ ] Update all content storage (articles, products description, pages) to store JSON strings
- [ ] Update all content display to render via `generateHTML(json, extensions)` or TipTap's read-only `<EditorContent>`

### B2 — `MediaCarousel` inline TipTap node

- [ ] Create TipTap extension `MediaCarouselNode` in `frontend/components/editor/extensions/media-carousel.ts`
  - Node attributes: `mediaIds: string[]`
  - NodeView: renders `<MediaGallery>` in the editor
  - Serializes to JSON naturally
- [ ] Add to TipTap editor extension list
- [ ] Add toolbar button to insert a `MediaCarousel` node

### B3 — `Callout` inline widget

- [ ] Create `frontend/components/widgets/Callout/Callout.tsx` (display)
- [ ] Create `frontend/components/editor/extensions/callout.ts` (TipTap node)
- [ ] Types: info, warning, success, danger

### B4 — `VideoEmbed` inline widget

- [ ] Create `frontend/components/widgets/VideoEmbed/VideoEmbed.tsx` (display)
- [ ] Create `frontend/components/editor/extensions/video-embed.ts` (TipTap node)
- [ ] Supports YouTube, Vimeo by URL

### B5 — `XEmbed` inline widget

- [ ] Create `frontend/components/widgets/XEmbed/XEmbed.tsx` (display)
- [ ] Create `frontend/components/editor/extensions/x-embed.ts` (TipTap node)
- [ ] Accepts a tweet/post URL; renders via Twitter embed script (`widgets.js`)
- [ ] Graceful fallback if embed script fails to load (linked blockquote)

### B6 — Tests & verification

- [ ] All existing content displays correctly after JSON migration
- [ ] Inline widgets render in editor and on detail pages (MediaCarousel, Callout, VideoEmbed, XEmbed)
- [ ] No data loss from HTML → JSON conversion

---

## Files Impacted (Phase 10A)

### Backend
| File | Change |
|------|--------|
| `prisma/schema.prisma` | `ArticleMedia.is_primary` added; `Article.featured_image_id` dropped |
| `prisma/migrations/...` | New migration for schema changes |
| `src/articles/articles.service.ts` | Media junction writes; `buildArticleBase()` updated |
| `src/articles/dto/create-article.dto.ts` | `featured_image_id` → `featured_media_ids[]` |
| `src/articles/dto/update-article.dto.ts` | Same |
| `src/articles/articles.service.spec.ts` | Updated tests |
| `src/products/products.service.ts` | `featured_media_id` handling in create/update |
| `src/products/dto/create-product.dto.ts` | Add `featured_media_id` |
| `src/products/dto/update-product.dto.ts` | Same (via PartialType) |

### Frontend
| File | Change |
|------|--------|
| `types/index.ts` | `MediaItem` interface; `media[]` on Article and Product |
| `components/widgets/MediaGallery/MediaGallery.tsx` | **NEW** display component |
| `components/widgets/MediaGallery/MediaGalleryField.tsx` | **NEW** admin form component |
| `components/widgets/index.ts` | **NEW** barrel export |
| `components/admin/ArticleForm.tsx` | `ImageField` → `MediaGalleryField` |
| `components/admin/ProductForm.tsx` | `ImageField` → `MediaGalleryField` |
| `app/(site)/latest/[slug]/ArticlePageClient.tsx` | Static image → `MediaGallery` |
| `app/(site)/shop/[slug]/ProductPageClient.tsx` | Static image → `MediaGallery` |

---

## Success Criteria (Phase 10A)

1. Articles and Products share identical media data contract (`media: MediaItem[]`)
2. Admin forms for both use the same `MediaGalleryField` component
3. Both detail pages render the same `MediaGallery` component
4. Single-image content looks identical to before (no carousel chrome)
5. Multi-image content renders a working carousel
6. `featured_image_url` still computed correctly for catalogue cards
7. All backend unit tests pass; frontend TypeScript build clean
8. No existing seeded content is broken by the schema migration
