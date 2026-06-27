# BUG-006: Next.js `<Image>` blocks cloud storage URLs site-wide; TipTap image insert lacks library browser

**Status:** `open`
**Reported:** 2026-06-27
**Severity:** `critical` (Part A) · `medium` (Part B)
**Area:** media, storage, frontend, editor

---

## Part A — Broken images everywhere on live cloud deployment

### Description

On the live deployment (GCS/S3 storage), images are broken in every location where Next.js's `<Image>` component is used with a URL from the API: article listing cards, product listing cards, article detail featured carousel, product detail featured carousel, article and product embed widgets in TipTap content, and the Images sidebar card in the backstage editor. The media library itself (`/admin/media`) is unaffected and shows images correctly.

This is a broader re-emergence of BUG-003's class of problem, but at a different layer: BUG-003 fixed the backend URLs (they are now correct cloud storage URLs), but introduced a new failure point because the frontend's Next.js `<Image>` component refuses to display any external hostname unless it is whitelisted in `next.config.mjs`.

### Root Cause

Next.js's `<Image>` component (`import Image from 'next/image'`) enforces a strict hostname allowlist. Any `src` pointing to an external domain is silently blocked unless that domain appears in the `images.remotePatterns` config in `next.config.mjs`. **`next.config.mjs` has no `images` key at all.**

On local dev this is invisible: `storageProvider.getUrl()` returns a relative path (`/uploads/filename.jpg`), which Next.js serves via its own rewrite proxy — no external hostname involved. On the live cloud deployment, after BUG-003's fix, `getUrl()` returns an absolute cloud storage URL (`https://storage.googleapis.com/...` or `https://mybucket.s3.amazonaws.com/...`). Next.js refuses to render these, producing broken image icons silently (no console error in production mode).

The standalone media library (`MediaLibraryClient`, `MediaPicker` grid) is unaffected because those components use plain lowercase `<img>` tags, which have no domain restriction.

### Affected Locations (all `<Image>` with API-sourced `src`)

| File | Usage | Impact |
|------|-------|--------|
| `frontend/components/blog/ArticleCard.tsx` ~line 30 | `src={article.featured_image_url}` | All article listing cards broken |
| `frontend/components/shop/ProductCard.tsx` ~line 66 | `src={product.featured_image_url}` | All product listing cards broken |
| `frontend/components/widgets/MediaGallery/MediaGallery.tsx` ~lines 45, 92, 106 | `src={current.url}` | Featured carousel on all article + product detail pages |
| `frontend/components/widgets/MediaGallery/MediaGalleryField.tsx` ~line 76 | `src={entry.url}` | Gallery thumbnail in backstage Images sidebar |
| `frontend/components/widgets/ArticleEmbed/ArticleEmbed.tsx` ~lines 133, 155 | `src={imageUrl}` | Article embed widget in TipTap content |
| `frontend/components/widgets/ProductEmbed/ProductEmbed.tsx` ~lines 142, 187 | `src={imageUrl}` | Product embed widget in TipTap content |
| `frontend/components/editor/extensions/media-carousel.tsx` ~line 103 | `src={e.url}` | Carousel editor preview thumbnails (admin only) |

### Fix Plan

The correct fix is a single addition to `next.config.mjs` rather than replacing `<Image>` with `<img>` throughout. `<Image>` provides meaningful benefits (lazy loading, automatic WebP conversion, responsive `srcset`) on article cards, product cards, and the featured carousel — replacing it with `<img>` would regress performance on those pages. The allowlist approach covers all affected locations in one change.

```
frontend/next.config.mjs
  — Add an `images` block with remotePatterns:

  images: {
    remotePatterns: [
      // Local dev: Next.js rewrite proxies /uploads/ to the backend; relative
      // URLs are handled automatically and do not need a remotePattern entry.
      // Cloud storage (GCS / S3 / any CDN):
      { protocol: 'https', hostname: '**' },
    ],
  },
```

`hostname: '**'` (double-star wildcard) is explicitly supported by Next.js 14+ and means "any HTTPS hostname." For a single-owner CMS where the admin controls all content, there is no meaningful security exposure from this; the alternative (enumerating specific bucket hostnames) would break every time the storage provider or CDN changes.

**Additionally**, for `MediaGalleryField`'s 56px admin thumbnail specifically, switch from `<Image>` to `<img>` regardless — the thumbnail is pre-resized by the backend and far too small to benefit from Next.js image optimisation:

```
frontend/components/widgets/MediaGallery/MediaGalleryField.tsx  line 76
  — Remove `import Image from 'next/image'`
  — Change: <Image src={entry.url} alt="" fill className="object-cover" sizes="56px" />
  — To:     <img src={entry.url} alt="" className="w-full h-full object-cover" />
  — The outer wrapper div does not need `relative` positioning without Next/Image fill
```

Similarly for the carousel editor preview thumbnail (40px, admin-only):

```
frontend/components/editor/extensions/media-carousel.tsx  ~line 103
  — Replace <Image src={e.url} ...> with <img src={e.url} ...>
```

---

## Part B — TipTap image insert: no media library browser

### Description

The inline image insert in the TipTap editor toolbar (the `ImagePlus` icon) opens a bespoke panel that offers only two options: paste an external URL or upload directly from the device. There is no way to browse or reuse images already in the media library. This is inconsistent with every other image-selection surface in the backstage (`ImageField` for logo/favicon, `MediaGalleryField` for article/product images, `MediaCarouselNode` for the carousel widget) which all use the `MediaPicker` component.

As a practical side effect, images inserted via this panel create media records that the editor cannot discover or reuse from the same surface.

### Root Cause

The image insert panel is implemented inline in `TipTapEditor.tsx` (lines 474–528) as a simple two-input form rather than using `MediaPicker`. The panel predates the unified `MediaPicker` component and was never updated when it was introduced.

TipTap renders images as `<img>` tags (not Next.js `<Image>`), so Part A's domain restriction does not affect display of images inserted via this panel. The issue is purely UX/consistency.

### Fix Plan

Replace the bespoke panel content with `MediaPicker` as the primary selection mechanism, keeping a URL text input as a secondary option for external/hotlinked images.

```
frontend/components/editor/TipTapEditor.tsx  lines 474-529
  — Import MediaPicker from '@/components/admin/MediaPicker'
  — Replace the file-upload button + URL input block with a MediaPicker (compact=true)
  — Wire MediaPicker.onChange: call editor.chain().focus().setImage({ src: url, alt: imageAlt }) on selection
  — Keep the "Paste image URL" text input below a divider as fallback for external images
  — The existing handleFileUpload function (lines 134-158) can be removed;
    MediaPicker handles its own upload to /media/upload
```

---

## Combined Fix Summary

| Part | File | Change | Scope |
|------|------|--------|-------|
| A — primary fix | `next.config.mjs` | Add `images.remotePatterns: [{ protocol: 'https', hostname: '**' }]` | Fixes all consumer pages + embed widgets in one line |
| A — admin small thumbs | `MediaGalleryField.tsx`, `media-carousel.tsx` | `<Image>` → `<img>` for 40–56px slots | Cleans up admin; size too small for optimisation anyway |
| B — library browser | `TipTapEditor.tsx` | Embed `MediaPicker` in image insert panel | Consistency; not a display breakage |

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Initial report — gallery field + TipTap image panel |
| 2026-06-27 | open | Scope expanded: same `<Image>` / remotePatterns issue affects all consumer pages (article cards, product cards, detail carousels, embed widgets) |
