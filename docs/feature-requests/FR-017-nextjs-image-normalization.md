# FR-017: Next.js Image normalization — eliminate pre-generated thumbnails

**Status:** `deployed`
**Requested:** 2026-07-03
**Deployed:** 2026-07-03
**Size:** `small`

---

## Synopsis

Replace the pre-generated Sharp thumbnail system with consistent use of Next.js `<Image>` across the entire codebase. Currently every image-rendering site in the app uses Next.js `<Image sizes="...">` for on-demand resizing and CDN-friendly caching, except the media library admin UI which still uses raw `<img>` tags backed by pre-generated 300×300 thumbnails. This FR closes that gap: stop generating thumbnail derivatives at upload time, port the media library to `<Image>`, and drop the orphaned backend infrastructure.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-03 | accepted | Requested after discovering pre-generated thumbnails are only consumed in the media library admin UI |
| 2026-07-03 | deployed | All changes shipped in one deploy; schema column left in place for Deploy 2 |

---

## Discussion

### Request context

The system already uses Next.js `<Image sizes="...">` for every image consumer: article/product page widgets (ArticleEmbed, ProductEmbed small and full sizes), collection embeds, and all customer-facing pages. The only exception was the media library admin grid and detail panel, which used raw `<img src={thumbnail_url ?? url}>` with ESLint-disable comments. This made the pre-generated thumbnail the only reason the Sharp thumbnail pipeline existed. With Next.js handling resizing on-demand and caching the result in `.next/cache`, the pre-generated thumbnail adds upload latency and storage overhead without benefit.

The question of on-demand vs. pre-generated was examined: Sharp/libvips resizes a single image in ~20–70ms on modern hardware, and Next.js's built-in optimizer handles the first-request cost and caches results. For a low-traffic site on Cloud Run (which already has cold-start latency), this is the right tradeoff. The pre-generated thumbnail approach remains valid for high-concurrency sites at scale, but is unnecessary here.

### Options considered

| Option | Trade-off |
|--------|-----------|
| Keep thumbnails, port `<img>` to `<Image>` using `thumbnail_url` | Thumbnails stay useful but add perpetual upload cost and storage overhead |
| Drop thumbnails, port media library to `<Image src={url}>` | Zero thumbnail overhead; consistent with everything else in the codebase |

### Decisions

- **Drop thumbnail generation entirely.** New uploads no longer generate or write `thumbnail_path`. Existing records keep their `thumbnail_path` value in the DB; delete cleanup retains the logic to remove those files when items are deleted.
- **Port media library to `<Image>`.** Both the grid card and detail panel preview use Next.js `<Image fill sizes="...">` pointing at the full-res `url`.
- **Leave `thumbnail_path` column in DB for Deploy 1.** A follow-up migration (Deploy 2) drops it cleanly without any risk of breaking the live instance during the transition window.
- **Keep `sharp` in the backend.** It's still used by `getImageDimensions()` to record width/height metadata on upload.

### Out of scope

- Drop of `thumbnail_path` DB column — scheduled as a follow-up migration (Deploy 2).
- Multiple pre-generated sizes (WordPress-style medium/large) — not warranted for this deployment model.

---

## Design & Implementation Guide

### Backend changes

```
backend/src/media/media.service.ts
  — remove generateThumbnail() call from upload()
  — remove thumbnail_path write from prisma.media.create()
  — remove generateThumbnailToPath() call from updateFile()
  — remove thumbnail_url from transformMedia() return value
  — remove private generateThumbnail() and generateThumbnailToPath() methods
  — keep sharp import (used by getImageDimensions())
  — keep remove() cleanup block for existing thumbnail_path values
```

### Frontend changes

```
frontend/app/admin/media/MediaLibraryClient.tsx
  — add Image import from next/image
  — remove thumbnail_url / thumbnail_path from local MediaItem interface
  — MediaThumb: replace <img src={thumbUrl}> with <Image fill sizes="...">
  — Detail panel: replace <img src={thumbUrl}> with <Image fill sizes="400px">
  — parent divs: add relative class; remove flex-centering that was for <img>
  — remove two eslint-disable-next-line @next/next/no-img-element comments
```

### Deploy 2 (follow-up migration)

```
backend/prisma/schema.prisma  — remove thumbnail_path field from Media model
Migration: drop_media_thumbnail_path
npx prisma generate
media.service.ts              — remove remove() cleanup block for thumbnail_path
```

---

## Completion Report

**Implemented:** 2026-07-03
**Commit(s):** see status history

### What was built

All Deploy 1 changes shipped as described. `thumbnail_url` removed from backend response. Media library grid and detail panel both use Next.js `<Image>` pointing at the full-res original. Pre-generated thumbnail generation removed from upload and replace-file flows. `thumbnail_path` DB column left in place.

### Deviations from design

None.

### Known limitations

- Existing thumbnails in storage are orphaned until their parent media item is deleted (cleaned up by the existing `remove()` logic). For the owner's current deployment this is a small number of files.
- `thumbnail_path` column remains in DB until Deploy 2.

---

## Testing Guide

### Prerequisites

- Running instance with at least one uploaded image.

### Test scenarios

**A. Media library grid**
1. Navigate to `/admin/media`.
2. Uploaded images should render as thumbnails in the grid — correctly sized, no broken images.
3. In browser devtools Network tab, image requests should go to `/_next/image?url=...` (Next.js optimizer), not directly to the storage URL.

**B. Detail panel preview**
1. Click any image in the media library grid.
2. The detail panel on the right should show the image preview at aspect-video size.
3. Image should be sharp and correctly contained/cropped.

**C. Upload new image**
1. Upload a new image via the media library.
2. It appears in the grid and renders correctly.
3. In the DB, `thumbnail_path` is NULL for the new record (no thumbnail generated).

**D. Delete image**
1. Select an image that has an existing `thumbnail_path` in DB.
2. Delete it.
3. No errors; both the original and the old thumbnail file are cleaned up from storage.

### Acceptance criteria

- [ ] Media library grid renders images using Next.js `<Image>` (no raw `<img>` tags for images).
- [ ] No thumbnail files generated on new upload.
- [ ] `thumbnail_url` no longer present in `GET /media` API response.
- [ ] Existing images with thumbnails still display correctly (using `url`, not `thumbnail_url`).
- [ ] Delete flow still cleans up any existing `thumbnail_path` file from storage.
