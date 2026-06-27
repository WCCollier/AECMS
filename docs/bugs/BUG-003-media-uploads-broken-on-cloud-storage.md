# BUG-003: Uploaded media and thumbnails broken on live (cloud storage) deployment

**Status:** `fixed`
**Reported:** 2026-06-27
**Severity:** `high`
**Area:** media, storage

---

## Description

On the live deployment (GCS/S3 storage), uploading media through the Media Manager reports success and the file lands correctly in the cloud bucket, but the image never appears in the library and the thumbnail is a broken link. The root cause is that every URL-construction callsite in the backend and frontend hardcodes an `/uploads/` local filesystem path instead of delegating to the storage provider's `getUrl()` method. Because there is no local `uploads/` directory on the live server, every generated URL resolves to a dead path.

---

## Reproduction Steps

1. Configure the live site with `STORAGE_PROVIDER_TYPE=gcs` (or `s3`) and valid bucket credentials.
2. Go to `/admin/media` and upload any image.
3. Upload completes with a success toast.
4. **Observed:** The new entry in the media library shows a broken image icon; the thumbnail is also broken.
5. **Expected:** The uploaded image and its thumbnail are visible immediately, served from the cloud bucket URL.

---

## Root Cause

Five distinct callsites all produce `/uploads/…` URLs that only work with `LocalStorageProvider`. Both `GcsStorageProvider.getUrl()` and `S3StorageProvider.getUrl()` are fully implemented but are **never called** in the upload/list path.

### 1 — `MediaService.mediaUrl()` returns bare storage key for cloud providers
`backend/src/media/media.service.ts` ~lines 450-457: when the provider is not local, the method returns the raw `storagePath` string (e.g. `1718000000000-photo.jpg`) instead of calling `this.storageProvider.getUrl(storagePath)`. The `transformMedia()` helper calls this, so every `MediaItem` returned by the API has a useless bare filename as its `url`.

### 2 — `ArticlesService.mediaUrl()` hardcodes `/uploads/`
`backend/src/articles/articles.service.ts` ~lines 449-453: uses `path.relative(uploadsBase, filePath)` to reconstruct a filesystem path that doesn't exist in GCS/S3, then prefixes it with `/uploads/`. On cloud deployments the file path stored in the DB is just a bare filename (e.g. `1718000000000-photo.jpg`); `path.relative('/app/uploads', '1718000000000-photo.jpg')` yields `../../1718000000000-photo.jpg`, producing a broken URL.

### 3 — `ProductsService.mediaUrl()` hardcodes `/uploads/`
`backend/src/products/products.service.ts` ~lines 727-733: same pattern as ArticlesService — normalises `/uploads/` prefixes and returns a local-only URL.

### 4 — Frontend thumbnail URL reconstructed with hardcoded `/uploads/`
`frontend/app/admin/media/MediaLibraryClient.tsx` ~lines 77-78 and 270-271: constructs thumbnail URLs as `` `/uploads/thumb-${filename}` ``. On cloud deployments the thumbnail is stored in the bucket, not on the NestJS server's disk, so this path is always dead. The API response never returns a `thumbnail_url` field; the frontend synthesises it incorrectly.

### 5 — `getUrl()` exists on both cloud providers but is never invoked
`backend/src/storage/gcs-storage.provider.ts` ~lines 95-112 and `backend/src/storage/s3-storage.provider.ts` ~lines 107-123 both have correct `getUrl()` implementations (with CDN base URL support). They are wired but never called upstream.

---

## Fix Plan

```
backend/src/storage/storage.interface.ts
  — Add `getUrl(storagePath: string): Promise<string>` to the StorageProvider interface
    (LocalStorageProvider returns `/uploads/${storagePath}`; cloud providers already have this logic)

backend/src/media/media.service.ts  ~line 450-464
  — Make `mediaUrl()` async; call `await this.storageProvider.getUrl(storagePath)` for all providers
  — Add `thumbnail_url` field to `transformMedia()` output: same `getUrl()` call on `thumbnail_path`
  — Make `transformMedia()` async; update all callers to await it

backend/src/articles/articles.service.ts  ~line 449-453
  — Replace the local `mediaUrl()` with a call to `MediaService.getUrl()` (inject MediaService)
    OR inject StorageProvider directly and call `getUrl()`
  — Make the enclosing transform helper async

backend/src/products/products.service.ts  ~line 727-733
  — Same fix as articles: delegate to StorageProvider.getUrl() instead of building a local path

frontend/app/admin/media/MediaLibraryClient.tsx  ~lines 77-78, 270-271
  — Replace the reconstructed `/uploads/thumb-…` expression with `item.thumbnail_url ?? item.url`
    (once the API returns `thumbnail_url`)
```

### Key considerations

- `LocalStorageProvider.getUrl()` must continue to return `/uploads/${storagePath}` so dev still works.
- `transformMedia()` becoming async may require updating pagination helpers and any place that calls `map()` over media records — use `Promise.all(items.map(...))` there.
- Both articles and products have inline `mediaUrl()` privates that shadow the media module's version. The cleanest fix is to inject `StorageProvider` (not `MediaService`) to avoid a circular dependency.
- No migration needed — the stored `file_path` values in the DB are already the correct storage keys; only the URL-construction layer is wrong.
- After fixing, verify that the `CDN_BASE_URL` ISM key (if set) is used by `getUrl()` so any CDN fronting the bucket is respected.

---

## Completion Report

**Fixed:** 2026-06-27
**Commit(s):** pending deploy

### What changed
Implemented exactly as planned. Five changes across four files:
- `media.service.ts`: `mediaUrl()` and `transformMedia()` made async; `transformMedia()` now calls `storageProvider.getUrl()` for both `url` and new `thumbnail_url` fields. All four call sites updated (three direct awaits, one `Promise.all` wrap on the list map).
- `articles.service.ts`: Added `STORAGE_PROVIDER` injection; replaced the `path.relative()`-based `mediaUrl()` with `await storageProvider.getUrl(filePath)`; `transformArticle()` made async with `Promise.all` on its media map; all six call sites updated.
- `products.service.ts`: Same injection pattern; replaced the `/uploads/` prefix-normalisation `mediaUrl()` with `await storageProvider.getUrl(filePath)`; `buildProductBase()` made async; `transformProduct()` awaits it.
- `MediaLibraryClient.tsx`: `thumbnail_url` added to `MediaItem` type; both `thumbUrl` computations replaced with `item.thumbnail_url ?? item.url`.

No schema or data migration required — stored filenames were already the correct cloud storage keys.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Initial report — uploads succeed but all URLs point to local /uploads/ path |
| 2026-06-27 | fixed | All URL construction delegated to storageProvider.getUrl(); thumbnail_url added to API response |
