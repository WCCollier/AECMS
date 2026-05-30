# API Shape Audit — Backend vs Frontend

Generated: 2026-05-30  
Source: Automated static analysis cross-referencing backend `transform*` methods against `frontend/types/index.ts` and component field accesses.

---

## How to use this document

Each item lists:
- **Location**: exact files and methods to touch
- **What to do**: the concrete change needed
- **Status**: open / fixed

---

## Item 1 — Order shipping address structure ✅ FIXED

**Severity**: Critical (breaks any page rendering shipping details)

**Problem**: Backend stores shipping as flat DB columns (`shipping_address` STRING = street, `shipping_city`, `shipping_state`, `shipping_zip`, `shipping_country`) and `transformOrder` spreads them raw. Frontend type expects a nested object:
```typescript
shipping_address: { street, city, state, postal_code, country }
```
The spread sets `order.shipping_address` to the raw street string, not the nested object.

**Fix location**:
- `backend/src/orders/orders.service.ts` → `transformOrder()`: after the `...order` spread, explicitly override `shipping_address` with the nested object mapping `shipping_address→street`, `shipping_zip→postal_code`.

**Fix applied**: `transformOrder` now outputs `shipping_address: { street, city, state, postal_code, country } | null`.

---

## Item 2 — Order status enum mismatch ✅ FIXED

**Severity**: High (status badges display wrong/missing values)

**Problem**: Frontend `Order.status` type declared as:
```typescript
'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
```
Backend only ever emits: `'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'`

Values `'paid'`, `'shipped'`, `'delivered'` do not exist. `'completed'` is missing from frontend type.

**Fix location**:
- `frontend/types/index.ts` → `Order.status` union.

**Fix applied**: Type corrected to `'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'`.

---

## Item 3 — Order payment field naming ✅ FIXED

**Severity**: High (payment info inaccessible to frontend)

**Problem**:
| Backend returns | Frontend type declared | Notes |
|---|---|---|
| `payment_method: string` | `payment_provider: 'stripe' \| 'paypal' \| null` | Different name |
| `payment_intent_id: string \| null` | `payment_id: string \| null` | Different name |
| *(derived from status)* | `payment_status: 'pending' \| 'paid' \| 'failed' \| 'refunded'` | Does not exist in backend |

**Fix location**:
- `frontend/types/index.ts` → `Order` interface: rename `payment_provider` → `payment_method`, rename `payment_id` → `payment_intent_id`, remove `payment_status`.

**Fix applied**: Frontend type now matches backend field names.

---

## Item 4 — Comment type missing from frontend ✅ FIXED

**Severity**: High (any comment display component has no type safety)

**Problem**: Backend returns structured Comment objects (with `id`, `content`, `status`, `moderation_status`, `user`, `article_id`, `product_id`, `parent_id`, `replies`, `created_at`). Frontend `types/index.ts` has no `Comment` interface at all.

**Fix location**:
- `frontend/types/index.ts`: add `Comment` interface matching backend `comments.service` response shape.

**Key backend fields returned**:
```
id, content, status ('approved'|'pending'|'rejected'|'spam'),
moderation_status ('pending'|'flagged'|'approved'|'rejected'),
user_id, article_id?, product_id?, parent_id?,
author_name?, author_email?,
user: { id, email, first_name, last_name },
replies: Comment[],
created_at, updated_at
```

**Fix applied**: `Comment` interface added to `frontend/types/index.ts`.

---

## Item 5 — Product type declares non-existent fields ✅ FIXED

**Severity**: High (TypeScript type lies; runtime safe today but a trap)

**Problem**: `frontend/types/index.ts` Product interface declared four phantom fields that the backend never returns. Each was evaluated and resolved as follows:

### `is_digital: boolean`
**Decision: Remove. Do not restore.**

The backend uses `product_type: 'physical' | 'service'` (a string enum) rather than a boolean flag. Digital delivery is planned (Phase 7 backend module already exists) but the correct path forward is to add `'digital'` to the `product_type` enum — not a separate boolean. The existing stock-bypass pattern in `cart.service.ts` and `orders.service.ts` reads `product_type !== 'service'`. When digital products are wired to the frontend, every such check must become `product_type === 'physical'` to correctly exclude both service and digital products from stock enforcement. Code comments have been added at those call sites.

### `track_inventory: boolean`
**Decision: Remove. Do not restore.**

This was intended to flag products that don't need inventory tracking (services, digital goods). It is fully derivable from `product_type`: physical products track inventory; service and (future) digital products do not. A separate boolean would be a redundant toggle that could get out of sync with `product_type`. The cart and orders services already use `product_type` for exactly this purpose.

### `allow_backorder: boolean`
**Decision: Remove. Do not restore as a simple boolean.**

Backorder/preorder support is planned (especially for physical books). The backend already has `stock_status: 'backorder'` as a valid enum value, and the cart/orders services already bypass stock limits when `stock_status === 'backorder'`. The full backorder feature requires two separate concerns: a **policy flag** on the product (can this product accept backorders?) and the **current status** (is it currently on backorder?). The policy flag does not yet exist in the Prisma schema. When backorder is properly implemented, a `can_backorder: boolean` field should be added to the Product DB model and surfaced in `transformProduct`. Until then, `stock_status` alone is sufficient.

### `gallery_urls: string[]`
**Decision: Remove. Replace with `media: Media[]` when gallery is built.**

This was a placeholder for a product image gallery (carousel / multiple images on the product detail page). The infrastructure already exists: the `product.media` relationship supports multiple ordered images. It simply hasn't been surfaced yet. When galleries are built, `transformProduct` should expose `media: Media[]` — not a pre-flattened string array — so components have access to alt text, ordering, and other media metadata. The `gallery_urls` name and shape were wrong regardless.

### Fix applied
All four phantom fields removed from `Product` in `frontend/types/index.ts`. The following fields that the backend *does* return were added in their place: `product_type`, `stock_status`, `stock_quantity` (nullable), `guest_purchaseable`. Code comments added in cart and orders services at `product_type` check sites. See also `docs/Shape_Audit.md` Item 5 notes in those files.

### Future action required
- When **digital products** are wired to frontend: add `'digital'` to `product_type` enum in `types/index.ts`; update all `product_type !== 'service'` guards in `cart.service.ts` and `orders.service.ts` to `product_type === 'physical'`
- When **backorder/preorder** is implemented: add `can_backorder: boolean` to Prisma Product model and surface in `transformProduct`; add to `Product` type in `types/index.ts`
- When **product galleries** are built: expose `media: Media[]` from `transformProduct`; add to `Product` type in `types/index.ts`

---

## Item 6 — Cart type declares fields backend strips ✅ FIXED

**Severity**: Low (no component reads these; pure type inaccuracy)

**Problem**: `frontend/types/index.ts` Cart interface declared `user_id`, `session_id`, `created_at`, `updated_at`, but `transformCart()` was only returning `id`, `items`, `item_count`, `subtotal` — stripping the rest.

### Decision: Restore all four fields in `transformCart`. Do not remove them from the type.

These fields are audit-trail data that will be required when abandoned cart detection and recovery is built — a natural next step given the anonymous session infrastructure already in place. The specific future uses:

- **`updated_at`**: The primary key for abandoned cart detection. "Has this cart gone untouched for N days?" cannot be answered without it. Drives both cleanup jobs (purging stale anonymous carts) and recovery emails (prompting users to complete their purchase).
- **`created_at`**: Enables cart-age analysis and is the fallback when `updated_at` is unavailable. Also useful for admin audit dashboards.
- **`user_id`**: Required to join a cart to a user record for recovery emails and admin reporting. Without it the recovery system cannot address the customer.
- **`session_id`**: Tracks anonymous carts before login. Enables anonymous-to-authenticated cart merge (already partially implemented in `mergeCart()`) and anonymous abandonment analytics.

Stripping these fields now and restoring them later would require coordinated changes across the backend transform, frontend type, and any consumers that have been written in the interim. The cost of keeping them is zero — they are already present on the Prisma `Cart` model and require only a line each in `transformCart`.

### Fix applied
- `transformCart()` now explicitly returns `user_id`, `session_id`, `created_at`, `updated_at` alongside the existing fields
- `Cart` interface in `frontend/types/index.ts` updated to also declare `item_count` and `subtotal` (which the backend was already returning but the type omitted)
- A block comment added to `transformCart()` in `cart.service.ts` documenting why these fields are retained, with a reference to this document

### Future action required
When abandoned cart recovery is implemented:
- Add a background job that queries carts where `updated_at < NOW() - INTERVAL '7 days'` and `user_id IS NOT NULL`
- Trigger recovery email via the existing email provider abstraction
- For anonymous carts (`user_id IS NULL`), purge after a longer interval (e.g. 30 days) rather than emailing

---

## Item 7 — CartItem.product typed as full Product ✅ FIXED

**Severity**: Low (TypeScript lies; no runtime impact)

**Problem**: `CartItem.product` was typed as `Product` (the full catalogue type) but `transformCart` only embeds a minimal snapshot: `{ id, name, slug, price, product_type, stock_status, stock_quantity, featured_image_url }`. The full Product fields — `description`, `short_description`, `sku`, `categories`, `tags`, etc. — are not present on a cart item's product object.

### Why a pure pointer (`product_id` only) was considered and rejected

A reference-only approach would be tidier in isolation but requires the cart page to make N additional fetches (one per line item) to retrieve the product data needed to render itself: name for the line item label, slug for the product link, `featured_image_url` for the thumbnail, `product_type` to determine whether to show quantity controls. That is an N+1 query pattern with no compensating benefit on a site of this scale.

Most e-commerce APIs (Shopify, WooCommerce, Stripe) take the same approach: embed a minimal product snapshot directly in each cart item so the cart UI can render in a single request.

### Why a named partial type rather than `Pick<Product, ...>`

A `Pick` would tie `CartProduct` structurally to `Product`, making it appear that any `Product` field could be added to the cart snapshot at will. Instead, `CartProduct` is a deliberately narrow interface that documents exactly what `transformCart` embeds and no more. This prevents a future developer from accessing `cartItem.product.description` in a cart component and getting `undefined` at runtime with no TypeScript warning.

### Fields in the cart snapshot (intentional boundary)

| Field | Purpose in cart UI |
|---|---|
| `id` | Key / reference for cart operations |
| `name` | Line item label |
| `slug` | Link to product detail page |
| `price` | Unit price display |
| `product_type` | Controls quantity stepper visibility; 'service' hides it |
| `stock_status` | Overlay badge on cart thumbnail |
| `stock_quantity` | Available stock context |
| `featured_image_url` | Cart line item thumbnail |

### Fix applied
- `CartProduct` interface declared in `frontend/types/index.ts` with exactly the eight fields above
- `CartItem.product` type changed from `Product` to `CartProduct`
- No backend changes required — `transformCart` already returns this exact shape

---

## Item 8 — PaymentIntent provider enum incomplete ✅ FIXED

**Severity**: Low (enum gap; no runtime crash since the missing value simply wouldn't match any branch)

**Problem**: Frontend `PaymentIntent.provider` was typed as `'stripe' | 'paypal'`, omitting `'amazon_pay'`. Additionally, `test_mode: boolean` is returned by the backend in test/dev mode but was not declared in the type.

### Amazon Pay is not deprecated — it is a planned MVP provider

The CLAUDE.md incorrectly labelled `AmazonPayProvider` as deprecated. This has been corrected. The backend implementation is complete and on par with Stripe and PayPal:

- `amazon-pay.provider.ts`: full Checkout v2 API implementation (session creation, capture, refund, webhook/IPN verification, status mapping, button config endpoint)
- `payments.service.ts`: Amazon Pay registered in the provider map alongside Stripe and PayPal; test mode returns a mock session ID; capture and webhook flows fully handled
- **What remains**: credentials not yet configured (requires Amazon Pay Seller Central account); frontend widget integration (the Amazon Pay JS SDK renders a button that opens an Amazon-hosted authentication modal — analogous to opening Stripe Elements)

### What was done

- `PaymentIntent.provider` in `frontend/types/index.ts` updated to `'stripe' | 'paypal' | 'amazon_pay'`
- `test_mode?: boolean` added to `PaymentIntent` type
- Amazon Pay button added to the checkout payment step UI alongside Stripe and PayPal, with a placeholder stub (alert + order confirmation redirect) that mirrors Stripe's current stub behaviour
- Inline comment in `handlePayment` documents what the production widget integration requires
- CLAUDE.md corrected: AmazonPayProvider status changed from "deprecated" to "backend complete, frontend stub in place, credentials pending, planned for MVP"

### What the production Amazon Pay integration requires (when credentials are configured)

1. Add `AMAZON_PAY_MERCHANT_ID`, `AMAZON_PAY_PUBLIC_KEY_ID`, `AMAZON_PAY_PRIVATE_KEY`, `AMAZON_PAY_REGION`, `AMAZON_PAY_SANDBOX` to environment / Codespaces Secrets
2. Replace the placeholder stub in `CheckoutPageClient.handlePayment('amazon_pay')` with initialisation of the Amazon Pay JS SDK widget, passing the checkout session ID (`response.data.client_secret`) as the session token
3. Add return URL routes: `/checkout/amazon-pay/review` and `/checkout/amazon-pay/result` (already referenced in `amazon-pay.provider.ts` `createPayment`)
4. The backend capture flow (`POST /payments/capture-amazon`) is already wired and ready

---

## Item 9 — Backend returns extra fields not in frontend types ✅ PARTIALLY FIXED

**Severity**: Low (additive; TypeScript ignores extras at runtime)

**Original problem**: Backend responses included fields frontend types didn't declare.

### Comments / Reviews — ✅ Fully redesigned and implemented

The original `ProductReview` model (separate table, product-only, single `Int` rating) has been replaced with a unified design:

- `ProductReview` model **dropped**
- `Comment` model gained: `title String?` (review headline), `verified_purchase Boolean`, `ratings CommentRating[]`; `user_id` made non-nullable; guest fields (`author_name`, `author_email`) removed
- New `CommentRating` model: `id`, `comment_id`, `title` (dimension name), `value` (1–5 Int)
- A Comment is a Review when `ratings.length > 0`; the first rating always has `title: "Overall"`
- Service enforces: verified purchase for product reviews; one review per user per item; "Overall" must be first rating; replies cannot have ratings
- `average_rating` and `review_count` computed from `CommentRating` aggregate in `products.service.ts`
- `CommentRating` and updated `Comment` interfaces added to `frontend/types/index.ts`
- `Product` type gains `review_count: number` and `average_rating: number | null`
- PRD 01 Comments & Reviews section rewritten to reflect this design

**Future**: Additional aspect ratings (beyond "Overall") are supported by the schema; UI for adding them is deferred.

### Product extra fields — ✅ Partially resolved

Fields now declared in `Product` type: `product_type`, `stock_status`, `stock_quantity`, `guest_purchaseable`, `comment_count`, `review_count`, `average_rating`.

Fields still returned by backend but not declared in frontend type (no component currently reads them — declare when needed):
- `author`: `{ id, first_name, last_name, email }` — needed when product pages show authorship
- `author_can_edit`, `author_can_delete`, `admin_can_edit`, `admin_can_delete`: permission flags for admin UI
- `meta_title`, `meta_description`: needed when SEO head tags are implemented

### Article extra fields — open

Fields returned by backend but not declared in frontend type:
- `comment_count`: add when article pages display comment counts
- `version_count`: editorial feature, low priority
- `meta_title`, `meta_description`: needed for SEO head tags
- `featured_image` (raw Media object): harmless; `featured_image_url` is already derived from it

### CartItem `line_total` — ✅ Fixed

Added to `CartItem` type in Item 7 fix.

### Order flat shipping columns — ✅ Fixed

Remapped to nested `shipping_address` object in Item 1 fix.

**Status**: Comments/reviews complete. Remaining open items are additive (backend returns them; frontend just needs to declare them when a component needs them).
