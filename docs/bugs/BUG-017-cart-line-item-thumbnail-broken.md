# BUG-017: Cart page line-item thumbnail image broken

**Status:** `open`
**Reported:** 2026-10-04
**Severity:** `medium`
**Area:** frontend, cart, media

---

## Description

On the shopping cart page, the thumbnail image for a line item does not display (broken image). Observed on the first live deployment while testing a Stripe checkout. The console also showed a `400` on an `image` request (likely the Next.js `/_next/image` optimizer), which may be related — unconfirmed.

---

## Reproduction Steps

1. Add a product to the cart on the live site.
2. Open the cart page.
3. Observed: line-item thumbnail is broken.
4. Expected: product image renders.

---

## Root Cause

`CartService.transformCart()` (`backend/src/cart/cart.service.ts:~441`) builds `featured_image_url` by hand: it takes `media.file_path` and prefixes `/uploads/`, a leftover from local-only storage. It never calls `StorageProvider.getUrl()`, which is what products/media use and which returns the real GCS/S3/CDN URL. On cloud storage the cart therefore emits `/uploads/<file>`, and `/_next/image?url=%2Fuploads%2F...` returns 400 (reproduced on a freshly created product and newly uploaded image, 2026-10-04). Not a data problem.

---

## Fix Plan

```
backend/src/cart/cart.service.ts  — inject STORAGE_PROVIDER; make transformCart async and use storageProvider.getUrl(file_path) (strip any absolute/legacy prefix as MediaService.storagePath does); await it at all callers
backend/src/cart/*.spec.ts        — update mocks; add test that a cloud URL is passed through unchanged
```

### Key considerations
- Check other places that hand-build `/uploads/` URLs (grep) — orders/order-confirmation likely share the pattern.
- Backward compatible; no schema change.

---

## Completion Report

> _Fill in after fix is deployed._

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-10-04 | open | Initial report during live Stripe checkout testing |
