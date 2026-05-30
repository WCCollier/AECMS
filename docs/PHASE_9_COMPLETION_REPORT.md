# Phase 9 Progress Report: User Testing

**Project**: AECMS - Advanced Ecommerce Content Management System
**Phase**: Phase 9 - User Testing
**Status**: 🔄 IN PROGRESS
**Started**: 2026-05-30

---

## Executive Summary

Phase 9 exercises the full end-to-end user journey through a structured manual testing sequence, uncovering and fixing bugs before any production deployment. Testing proceeds from the lowest-privilege path (anonymous browsing) upward to admin functions.

Between test steps, significant feature work was also completed: 15 lesson products recovered from WordPress, a service product type added, and a full infinite scroll / paginated toggle system built.

---

## Testing Sequence

See `TESTING_GUIDE.md → Phase 9: User Testing` for the full step-by-step sequence and checklists.

| Step | Area | Status | Notes |
|------|------|--------|-------|
| 1 | Anonymous article browsing | ✅ Done | Category/tag filtering fixed |
| 2 | Anonymous shop browsing | ✅ Done | Products recovered; images, badges, service UI working; all 4 checklist items verified by user |
| 3 | Anonymous cart mechanics | ✅ Done | NaN price fixed, cart images fixed, stock validation added |
| 4 | Member login + browsing | ⏸ Pending | |
| 5 | Member cart mechanics | ⏸ Pending | |
| 6 | Checkout as member (Stripe sandbox) | ✅ Done | Shipping DTO fixed, order confirmation page built, flow complete |
| 7 | Guest checkout | ⏸ Pending | |
| 8 | Admin back door — 2FA enrollment | ⏸ Pending | Blocking for all admin steps |
| 9 | Admin CRUD — articles | ⏸ Pending | |
| 10 | Admin CRUD — products | ⏸ Pending | |
| 11 | Admin orders | ⏸ Pending | |

---

## Anticipated Risk Areas

| Area | Likely Problem |
|------|---------------|
| Checkout | Stripe webhook not reachable from Codespaces (payment intent works; webhook for status update does not) |
| Admin article edit | Form doesn't pre-populate existing categories/tags |
| Admin 2FA | Works, but must complete enrollment before any admin CRUD is testable |
| Cart merge | Anonymous → logged-in cart merge not yet implemented |
| Member comments/reviews | Backend complete; no frontend UI built yet for commenting or reviewing |

---

## Bugs Found and Fixed

### Phase 9.1 — Anonymous Article Browsing (2026-05-30)

**Bug 1: Category/tag URL param not read** (`frontend/app/(site)/latest/LatestPageClient.tsx`)
- Root cause: Component never called `useSearchParams()`, so `?category=` was silently dropped.
- Fix: Added `useSearchParams()`, reads `category` param, passes to `useArticles`, resets page on change.

**Bug 2: Backend DTO rejected slugs** (`backend/src/articles/dto/query-articles.dto.ts`)
- Root cause: `category_id` field decorated with `@IsUUID()` — a slug like `short-thoughts` failed validation.
- Fix: Added `category` and `tag` slug string fields alongside existing UUID variants.

**Bug 3: Service had no slug-based Prisma filter** (`backend/src/articles/articles.service.ts`)
- Root cause: Only `category_id` path existed in the `where` builder.
- Fix: Added slug-based `categories.some.category.slug` branches for category and tag.

**Bug 4: Pagination meta shape mismatch** (`frontend/hooks/useArticles.ts`)
- Root cause: Hook read `data.total_pages` but API returns `data.meta.total_pages`.
- Fix: Primary read from `data.meta.*` with flat fallback.

### Phase 9.2 — Anonymous Shop Browsing (2026-05-30)

**Bug 5: Pagination meta shape mismatch in shop** (`frontend/hooks/useProducts.ts`)
- Root cause: Hook read `data.total_pages` but API returns `data.meta.total_pages`.
- Fix: Same meta-first read pattern.

**Bug 6: `featured_image_url` null for seeded products** (`backend/src/products/products.service.ts`)
- Root cause: `transformProduct()` regex assumed `file_path` contained `/uploads/` but seeded paths were relative (e.g. `wp-import/foo.jpg`).
- Fix: Conditional path prefix — prepend `/uploads/` when path doesn't already contain it.

**Bug 7: Anonymous cart session ID never sent** (`frontend/lib/api.ts`)
- Root cause: Frontend had no session ID generation; backend requires `x-session-id` header for guest carts.
- Fix: `getSessionId()` generates and persists a UUID in `localStorage`; request interceptor injects it as `x-session-id` on all unauthenticated requests.

### Phase 9.3 — Anonymous Cart & Checkout (2026-05-30)

**Bug 8: Cart item price displayed as NaN** (`frontend/app/(site)/cart/CartPageClient.tsx`)
- Root cause: `transformCart` never included `unit_price` on cart items; frontend multiplied `undefined × quantity`.
- Fix: `unit_price` explicitly set in `transformCart`; `featured_image_url` correctly derived from `media[0].media.file_path`.

**Bug 9: Service products showed quantity stepper in cart**
- Root cause: Cart page had no awareness of `product_type`.
- Fix: Quantity controls and "each" label hidden for `product_type === 'service'` items.

**Bug 10: Checkout shipping DTO field name mismatches** (`backend/src/orders/dto/create-order.dto.ts`)
- Root cause: Backend DTO used `address`/`zip`/`name` (required) and required top-level `email`+`payment_method`; frontend sent `street`/`postal_code` with no `name`/`payment_method`.
- Fix: DTO updated to match frontend field names; `email` derived from JWT user or `guest_email`; `payment_method` optional, defaults to `'stripe'`.

**Bug 11: Order confirmation page 404** (new file)
- Root cause: `/order-confirmation` route never created.
- Fix: Built `OrderConfirmationClient` — displays order number, itemised line items, totals, status badge, and continue-shopping CTAs.

**Bug 12: Order item fields misnamed** (`backend/src/orders/orders.service.ts`)
- Root cause: `transformOrder` returned `price`/`line_total` on items; frontend expected `unit_price`/`total_price`/`product_name`.
- Fix: `transformOrder` now maps `product.name → product_name`, computes `unit_price` and `total_price`.

**Bug 13: Shipping address shape mismatch** (`backend/src/orders/orders.service.ts`)
- Root cause: Backend stored flat columns (`shipping_address` string, `shipping_city`, etc.); frontend type expected nested object `{ street, city, state, postal_code, country }`.
- Fix: `transformOrder` remaps flat columns to nested object.

---

## Schema & API Work During Phase 9

### API Shape Audit (`docs/Shape_Audit.md`)
- Full static analysis cross-referencing all backend `transform*` methods against frontend types and component field accesses
- 9 items identified, all addressed:
  - Items 1–4: Critical fixes (shipping address, order status enum, payment field names, Comment type)
  - Items 5–9: Deliberate decisions documented with rationale (product phantom fields, cart audit fields, CartProduct partial type, Amazon Pay, extra backend fields)

### Stock Reservation System
- Virtual stock: `available = stock_quantity − SUM(cart items in other carts)`
- `getVirtualAvailableStock()` helper in `CartService`; used in `addItem` and `updateItem`
- `POST /cart/validate` pre-flight endpoint corrects over-limit quantities before checkout
- Checkout pre-flight: redirects back to cart with amber adjustment banner listing exact changes
- Three UI touch points surface stock errors inline: product detail page, product card (auto-clears 5s), cart stepper
- Seeded American Shooter Hat (physical, $24.99, 5 in stock) for testing quantifiable items

### Unified Comment/Review System (`docs/Shape_Audit.md Item 9`)
- `ProductReview` table dropped; replaced by `CommentRating` (many-to-one on Comment)
- `Comment` gains: `title` (review headline), `verified_purchase` (system-set), `ratings CommentRating[]`; `user_id` non-nullable; guest fields removed
- A comment becomes a review when `ratings.length > 0`; first rating must be `title: "Overall", value: 1–5`
- Access rules: login required for all comments; verified purchase required for product reviews; one review per user per item
- Products service: `review_count` and `average_rating` computed from `CommentRating` aggregate
- PRD 01 Comments & Reviews section rewritten
- 8 new backend unit tests (152 total passing)

### Amazon Pay Re-instated
- Corrected CLAUDE.md: `AmazonPayProvider` is not deprecated; it is a planned MVP provider with a complete backend implementation
- Frontend checkout now shows Amazon Pay as a third payment option with a placeholder stub matching Stripe/PayPal pattern

## Features Added During Phase 9

### WordPress Product Recovery
- Parsed `seed_data/ancient_wp759.sql` (MySQL format) via Python regex
- Recovered 15 lesson products: prices, descriptions, slugs, featured images
- Extracted 5 images from `seed_data/wp_uploads.tar` → `backend/uploads/wp-import/`
- Created `backend/prisma/seed_lessons.ts`

### Service Product Type
- New `ProductType.service` enum value
- New `StockStatus.available` / `StockStatus.unavailable` enum values
- `stock_quantity` made nullable (`Int?`) for service products
- Cart and order services bypass stock checks for service products
- Frontend adapts: "Reserve" button, "Available — contact us to schedule" text, no quantity selector, "Lesson" badge on cards

### Product Feature Parity with Articles (Option 1)
- `author_id` FK added to `products` table
- `compare_at_price` field added to `products` table
- `product_id` FK added to `comments` table — products now support comments
- Comments service extended: `findByProduct()`, `product_id` in `create()` and `findAll()`
- `GET /comments/product/:productId` endpoint added
- Product `transformProduct()` returns `author`, `comment_count`, `compare_at_price`
- Product detail page renders `description` via `dangerouslySetInnerHTML` (TipTap HTML)
- Admin `ProductForm` gains Compare-at Price field

### Infinite Scroll / Paginated Toggle
- `ViewModeContext` — stores preference in `localStorage`, global across catalogue pages
- `ViewModeToggle` — bordered pill toggle (Pages / Scroll), rendered in header of each catalogue page
- `useInfiniteProducts` / `useInfiniteArticles` — `useSWRInfinite` hooks with end detection
- `ShopPageClient` and `LatestPageClient` both support both modes:
  - Infinite: IntersectionObserver sentinel, bounce-dot loading indicator, "You've seen everything" end state
  - Paginated: Previous/Next buttons, `?page=N` written to URL via `router.replace`
  - `?page=N` in URL forces paginated mode for that visit without changing stored preference
  - Search/filter resets scroll to top in infinite mode
  - Search button becomes styled X (clear) after search executed; reverts to Search if input is edited

---

## Deferred Polish Items

- [ ] Loading skeletons on article/product listings
- [ ] Toast notifications for user actions
- [ ] Admin CRUD forms (create/edit article, product)
- [ ] Image upload in admin
- [ ] Domain alias management UI
- [ ] Responsive design improvements
- [ ] SEO and performance optimization
- [ ] WordPress migration scripts

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@aecms.local | Admin123!@# |
| Admin | admin@aecms.local | Admin123!@# |
| Member | member@aecms.local | Member123!@# |

**Stripe test card**: `4242 4242 4242 4242`, any future expiry, any 3-digit CVC.
