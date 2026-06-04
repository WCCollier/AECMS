# Phase 10A Completion Report

**Phase**: 10A — Widget System: MediaGallery Hero Carousel & Media Schema Normalization  
**Completed**: 2026-06-04  
**Status**: ✅ COMPLETE

---

## Summary

Phase 10A delivered a normalized, shared media system for Articles and Products. Both content types now support a multi-image hero gallery, rendered by a common `MediaGallery` widget. Single-image content is unchanged; multi-image content shows a live carousel with navigation controls.

---

## What Was Built

### Database (A1)
- Added `is_primary Boolean @default(false)` to `ArticleMedia` model
- Dropped `Article.featured_image_id` (all values were NULL — no backfill needed)
- Both `ArticleMedia` and `ProductMedia` now share identical structure: composite PK on `(content_id, media_id)`, `order`, `is_primary`

### Backend: Articles API (A2)
- `setArticleMedia()` helper: replaces the full media set atomically; first ID in array is primary
- `getArticleInclude()`: fetches `ArticleMedia` with nested `Media`, ordered by `order asc`
- `transformArticle()`: computes `featured_image_url` from `media[is_primary]`, returns normalized `media: MediaItem[]`
- `CreateArticleDto` / `UpdateArticleDto`: accept `media_ids?: string[]`

### Backend: Products API (A3)
- `setProductMedia()` helper (parallel to articles)
- `buildProductBase()` rewritten to return normalized `MediaItem[]` with `is_primary`, `order`, `alt_text`

### Frontend: Types (A4)
- `MediaItem` interface added to `types/index.ts`
- `media: MediaItem[]` added to both `Article` and `Product` interfaces

### Frontend: `MediaGallery` display component (A5)
- `frontend/components/widgets/MediaGallery/MediaGallery.tsx`
- 0 images → null / `fallback` prop
- 1 image → static `<Image>`, no carousel chrome
- N images → carousel: prev/next arrows (always visible at 60% opacity, full on hover), dot indicators with drop-shadow, image counter badge
- Primary image always shown first; keyboard arrow navigation

### Frontend: `MediaGalleryField` admin component (A6)
- `frontend/components/widgets/MediaGallery/MediaGalleryField.tsx`
- Wraps `MediaPicker`; prevents duplicate adds
- Up/down reorder buttons
- Set-primary (star) action
- Remove action
- Emits `GalleryEntry[]` → form submits `media_ids`

### Frontend: Admin forms (A6)
- `ArticleForm.tsx`: replaced `ImageField` with `MediaGalleryField`
- `ProductForm.tsx`: replaced `ImageField` with `MediaGalleryField`

### Frontend: Detail pages (A7)
- `ArticlePageClient.tsx`: `<MediaGallery media={article.media ?? []} aspectRatio="video" />`
- `ProductPageClient.tsx`: `<MediaGallery media={product.media ?? []} aspectRatio="square" fallback={...} />`
- Catalogue cards (`ArticleCard`, `ProductCard`) unchanged — continue using `featured_image_url`

---

## Bugs Fixed During Phase 10A Testing

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| New Article page crashed on load | TipTap editor chunk was 3.6MB — Codespaces HTTP/2 proxy dropped connection mid-stream | Added `splitChunks` webpack config with 512KB `maxSize` + `tiptap` cacheGroup; chunk reduced to 87KB |
| TipTap SSR hydration error | TipTap v3 `useEditor` requires `immediatelyRender: false` explicitly | Added `immediatelyRender: false` to `useEditor()` call |
| Duplicate `link` extension warning | TipTap 3.x `StarterKit` now bundles `Link` by default; we were also adding it explicitly | Added `link: false` to `StarterKit.configure()` |
| Servers OOM-killed during dev | Each `start-dev.sh` run left stale `nest start --watch` processes; 6 zombies consumed ~3GB RAM | Added `pkill -f "nest start"` to `start-dev.sh` before backend restart |
| Carousel looked like static image | Prev/next arrows had `opacity-0 group-hover:opacity-100` — invisible without hover | Changed to `opacity-60 hover:opacity-100` so arrows are always visible |

---

## Test Results (A8)

- ✅ 154/154 backend unit tests pass
- ✅ 90/90 frontend unit tests pass
- ✅ Frontend TypeScript build clean
- ✅ API: article with 2 images → `media[0].is_primary=true`, `featured_image_url` set correctly
- ✅ API: product with 2 images → normalized `MediaItem[]` with correct `is_primary`/`order`
- ✅ Manual UI: create article with multiple images → gallery renders on detail page
- ✅ Manual UI: create product with multiple images → carousel renders on product page
- ✅ Manual UI: reorder in admin form → persisted correctly (order reflected in detail page)
- ✅ Manual UI: set primary image → primary image displayed first in carousel and on catalogue card

---

## Infrastructure Changes (not in original plan)

### `next.config.mjs` — webpack chunk splitting
```js
webpack(config, { isServer }) {
  if (!isServer) {
    config.optimization.splitChunks = {
      ...existing,
      maxSize: 512 * 1024,
      cacheGroups: {
        tiptap: {
          test: /node_modules\/(@tiptap|@prosemirror|prosemirror-[-\w]+)/,
          name: false, chunks: 'all', priority: 30, reuseExistingChunk: true,
        },
      },
    };
  }
}
```
Required for Codespaces compatibility — the TipTap bundle exceeds the HTTP/2 proxy's streaming limit without splitting.

### `start-dev.sh` — stale process cleanup
Added `pkill -f "nest start"` before backend startup to prevent zombie watcher processes from exhausting RAM.

---

## Data Contract (D2) — Final Shape

```typescript
interface MediaItem {
  id: string;
  url: string;           // /uploads/... (proxied through Next.js)
  order: number;
  is_primary: boolean;
  alt_text?: string | null;
}
```

All article and product API responses include `media: MediaItem[]` and `featured_image_url: string | null` (computed from `media[is_primary]`).

---

## What's Next: Phase 10B

- Switch TipTap to JSON content storage (`editor.getJSON()` / `generateHTML()`)
- One-time migration: convert existing HTML content to TipTap JSON
- Inline widget nodes: `MediaCarousel`, `Callout`, `VideoEmbed`
