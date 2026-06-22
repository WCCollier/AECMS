# Phase 14 Completion Report: Digital Item Delivery

**Project**: AECMS  
**Phase**: 14  
**Status**: ✅ COMPLETE (including two QA fix passes)  
**Primary commit**: `ff75c04`  
**Supporting commits**: `418c884`, `aebbb86`, `c7a7c76`  
**QA fix session 1**: `161e31e` (name fields), badge normalization  
**Date**: 2026-06-16 through 2026-06-17

---

## Summary

Phase 14 closed the loop on Phase 7's digital products backend by wiring every backend capability into customer-facing and admin UIs. It delivered: real EPUB/PDF personalization, auto-token creation on payment, a customer download panel with format selection and download tracking, a full Kindle onboarding wizard, and admin-side digital delivery tracking. Two post-ship QA passes also addressed UX friction and data integrity issues found during operational testing, plus a name field implementation that feeds the personalization chain.

---

## What Was Delivered

### Area 14-A: Admin — Digital Product File Management

**`DigitalFilesPanel`** (`frontend/components/digital/DigitalFilesPanel.tsx`)

- Lists all uploaded source files for a digital product (EPUB, PDF, etc.)
- Upload new file: multipart form to `POST /digital-products/files`
- Each format row shows: filename, file size, `personalization_tested` badge (✅ Tested / ⚠️ Not Tested)
- **Test Personalization** button: calls `POST /digital-products/files/test-personalization`, opens result in new tab
- **Replace** button on each row: uploads a new file for the same format, resets `personalization_tested`
- Only renders for products with `product_type === 'digital'`
- Placed in the `lg:col-span-2` main column of `ProductForm` via a `mainExtra` prop, with an orange border (`border-orange-500/50`) to visually distinguish it

**New backend endpoint: `POST /digital-products/files/test-personalization`**

- Input: `{ product_id, format }`
- Calls `PersonalizationService.personalize()` with dummy data (`customerName: 'Test Customer'`, `orderNumber: 'TEST-00000'`, `purchaseDate: now`)
- Saves result to temporary storage with 1-hour TTL
- Sets `personalization_tested = true` on the `DigitalProductFile` row
- Returns `{ download_url }` that the frontend opens in a new tab

**New backend endpoint: `POST /digital-products/downloads/:id/extend`**

- Extends `expires_at` by N days (default 30)
- Requires backstage session

**Digital product publish gate**: Backend now blocks setting `status: published` on a product with `product_type === 'digital'` and zero source files. Returns 422 Unprocessable Entity.

**New product redirect**: `ProductForm` now pushes to `/admin/products/${res.data.id}` on create, landing the admin on the edit page where the Digital Files panel is visible.

### Area 14-B: Personalized Copy Generation on Payment

**`PersonalizationService`** (`backend/src/digital-products/personalization.service.ts`) — real implementation

Phase 7 stubbed this service with placeholder methods. Phase 14 delivers the real implementations:

- **EPUB personalization**: Opens the EPUB ZIP archive with `adm-zip`, locates or creates a `personalization.xhtml` file, injects a styled colophon page with the customer's name, order number, and purchase date using `@xmldom/xmldom` for XML manipulation, and repacks the archive.
- **PDF personalization**: Uses `pdf-lib` to prepend a new page to the PDF with a formatted personalization block (name, order number, purchase date, site branding). The inserted page matches the PDF's page dimensions.

**`PaymentsService.markOrderAsPaid()`** now calls `createDownloadTokensForOrder()` immediately after every successful payment:
- Fires after Stripe webhook `checkout.session.completed`
- Fires after PayPal capture-on-return
- `createDownloadTokensForOrder()` is idempotent — skips if tokens already exist for the order

**`createDownloadTokensForOrder()`** updated:
- Queries order items where `product.product_type === 'digital'`
- For each item × each `DigitalProductFile` format → calls `PersonalizationService.personalize()` → stores output → creates `DigitalDownload` row with token, limit (from env `DIGITAL_PRODUCT_DOWNLOAD_LIMIT`, default 5), and expiry (from `DIGITAL_PRODUCT_ACCESS_DAYS`, default 7 days)

**New packages**:
- `adm-zip` — EPUB/ZIP manipulation
- `@xmldom/xmldom` — XML/HTML DOM manipulation inside EPUB
- `pdf-lib` — PDF page insertion

### Area 14-C: Customer Download System

**`DigitalDownloadsPanel`** (`frontend/components/digital/DigitalDownloadsPanel.tsx`)

- Fetches `GET /digital-products/orders/:orderId/downloads`
- Groups downloads by product, then by format within each product
- Per format: download count bar (`{used} of {limit} remaining`), expiry date, **Download** button, **Send to Kindle** button
- Download button: direct link to `GET /digital-products/download/:token` (opens in new tab, triggers browser download)
- **Send to Kindle** button: opens `KindleWizard` modal pre-loaded with the selected download
- Shows only if the order has digital items
- Reused in two locations:
  - **Order confirmation page** (`OrderConfirmationClient.tsx`) — shows immediately after a successful digital product purchase
  - **Account page** (`AccountPageClient.tsx`) — inline under each order row that has digital items

### Area 14-D: Send to Kindle Wizard

**`KindleWizard`** (`frontend/components/digital/KindleWizard.tsx`)

A modal slideshow component with a state machine (`'device-select' | 'step-find-email' | 'step-whitelist' | 'step-name-device' | 'step-confirm' | 'sending' | 'done' | 'error'`).

**New user — 4-step onboarding flow:**

- **Step 1 (Find Your Kindle Email)**: Image carousel of annotated Amazon screenshots (bright green highlights). User enters their `@kindle.com` address in an input field. Images: `to-kindle_1–3_marked.jpg` in `frontend/public/kindle-guide/`.
- **Step 2 (Whitelist Our Email)**: Image carousel (magenta highlights). Instructions to add `your-email@gmail.com` (from `NEXT_PUBLIC_KINDLE_SENDER_EMAIL` env var) to Amazon's approved sender list. Images: `to-kindle_3–4_marked.jpg`.
- **Step 3 (Name This Device)**: Text input for a friendly device name. "Save this device" checkbox (default checked).
- **Step 4 (Ready to Send!)**: Format selector dropdown, summary of device email and name, download count warning. **Send to Kindle** button calls `POST /kindle/send` and transitions to `sending` → `done`.

**Returning user — 2-step flow:**
- **Step 1**: Radio list of saved devices, "Add new device" option, format selector.
- **Step 2**: Confirmation summary → Send.

**Image carousel**: Uses the existing `MediaCarousel` rendering pattern, with click-to-enlarge lightbox for full-screen view of annotated screenshots.

**Color-highlighted instruction text**: Bright green (`text-green-400`) in Step 1, magenta (`text-pink-400`) in Step 2. Matching highlight markers in the guide images show exactly what to click.

### Admin: Digital Delivery Tracking

**`AdminDigitalPanel`** (`frontend/components/digital/AdminDigitalPanel.tsx`)

Replaces the Phase 14 placeholder text in the admin order detail page:
- Per-product, per-format: download count bar, Kindle send count, last downloaded timestamp
- **Regenerate** button: calls `POST /digital-products/downloads/:id/regenerate`
- **Extend Expiry** button: calls `POST /digital-products/downloads/:id/extend`

### Schema Changes

```prisma
// DigitalDownload — added:
kindle_send_count   Int      @default(0)
last_downloaded_at  DateTime?

// DigitalProductFile — added:
personalization_tested Boolean @default(false)
```

---

## Phase 13 Prerequisites (Inline with Phase 14)

Before Phase 14's digital work, a prerequisite batch addressed admin order management and checkout (commit `418c884`):

**Schema additions**:
- `User.saved_shipping_address JSONB?` — persisted shipping address for checkout pre-fill
- `Order.tracking_number String?`, `Order.scheduled_at DateTime?`, `Order.scheduled_note String?`
- `OrderStatus` enum: added `shipped`, `scheduled`

**New backend endpoints**:
- `GET /auth/shipping-address` — fetch saved address
- `PATCH /auth/shipping-address` — save/update address
- `PATCH /orders/:id/fulfillment` — set tracking number + mark shipped, or set schedule datetime + note
- `GET /products/:id/inventory-stats` — live counts: in carts, purchased-not-shipped, available stock, total shipped

**Admin order detail** — full rebuild: `FulfillmentPanel` with physical shipping (tracking number input, mark-shipped button), service scheduling (datetime + note), digital placeholder, cancel/refund buttons, item type badges.

**InventoryTracker panel** — added to product edit page (physical products only): shows current snapshot of inventory flow.

**Checkout improvements**:
- Saved shipping address pre-populates checkout form; user offered to save/update on submit
- Digital/service-only carts skip the shipping address step entirely
- "Save address" checkbox on the Shipping step

**Account page** — Shipping Address section with editable form.

---

## QA Fix Session 1 (2026-06-17)

Bugs found during operational testing of Phase 14:

| Bug | Fix |
|-----|-----|
| `personalizationEnabled` validation failed (FormData sends strings, `@IsBoolean()` rejects) | Added `@Transform(({ value }) => value === 'true' \|\| value === true)` in both DTOs |
| Digital file format dropdown out of sync after upload (stuck showing previous format) | `useEffect` syncs `uploadFormat` state to first available format after upload |
| Uploading second file of same format throws conflict | `create()` now does upsert by `(product_id, format)` pair; resets `personalization_tested` |
| Order status badges missing coverage for `shipped`, `scheduled`, `refunded` | `frontend/lib/orderStatus.ts` — single source of truth for all 7 status colors; used in AdminOrdersClient, admin order detail, AdminDashboardClient, OrderConfirmationClient, AccountPageClient |
| Admin dashboard showing stale `'paid'` check for order count | Removed; uses `orderStatus.ts` helper |

---

## QA Fix Session 2 (2026-06-17) — Name Field Implementation

### Design

Two distinct identity fields with different lifecycles:

- **`username`** — public-facing social handle for comments and reviews. Required at registration. Unique. Stored as `users.username` (nullable for pre-existing accounts). Shown with `@` prefix on Account page.
- **`first_name` + `last_name`** — legal/commercial identity for receipts, personalized files, and shipping. Optional at registration; **required at point of purchase** (prompted at checkout if missing). Back-filled to user record on first purchase.

### Database Migration

`20260617200000_add_username_and_order_customer_name`:
```sql
ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
ALTER TABLE "orders" ADD COLUMN "customer_name" TEXT;
```

### Backend Changes

**`register.dto.ts`**: `username` field added — required, 3–30 chars, `[a-zA-Z0-9_]+`.

**`auth.service.ts` `register()`**: Checks username uniqueness before creating user (`ConflictException` if taken), persists `username` in DB.

**`auth.controller.ts` `/me`**: Now returns `username` and `createdAt`.

**`create-order.dto.ts`**: Added `customer_first_name?: string` and `customer_last_name?: string`.

**`orders.service.ts` `createFromCart()`**:
- Composes `customer_name` from DTO fields and stores on order
- Back-fills user record `first_name`/`last_name` if they had no name on file (first purchase)
- `shipping_name` falls back to `customer_name` if no explicit shipping address name

**`digital-products.service.ts` `downloadFile()` personalization chain**:
1. Explicit `?customerName=` query param (admin/test)
2. `order.customer_name` (resolved full name stored at checkout time)
3. User record `first_name + last_name` (fallback for pre-Phase-14 orders)
4. `order.email` (last resort)

### Frontend Changes

**`frontend/types/index.ts`**: `User` interface corrected to match actual `/auth/me` API response — removed non-existent fields (`display_name`, `avatar_url`, `is_active`, `created_at` snake_case); added `username`, `firstName`, `lastName`, `createdAt`.

**`RegisterPageClient.tsx`**: Registration form now collects `username` (required) and optional `firstName` / `lastName`. `display_name` field removed.

**`CheckoutPageClient.tsx`**:
- `needsName = !isAuthenticated || !user?.firstName` — derived state controlling whether name fields are shown
- Physical product or guest checkout: name fields appear on the Shipping step
- Digital/service checkout for authenticated user without name: name fields appear on the Payment step with explanatory note
- `handlePayment()` guards on `needsName && !formData.firstName`
- Both `createOrder()` calls pass `customer_first_name` and `customer_last_name`

**`AccountPageClient.tsx`**: Shows Name (`firstName + lastName`), `@username`, email, role, and member-since date from `user.createdAt`.

---

## Verification Status

| Checklist Item | Status |
|----------------|--------|
| Upload EPUB + PDF to digital product in admin | ✅ |
| Test personalization for each format | ✅ |
| Purchase digital product (Stripe sandbox) → tokens auto-created | ✅ |
| Order confirmation shows download buttons | ✅ |
| Download EPUB → personalized page, count decrements | ✅ |
| Download PDF → personalized page, count decrements | ✅ |
| Download limit exceeded → friendly error | ✅ |
| Kindle wizard: new user completes 4-step flow | ✅ |
| Kindle wizard: returning user sees 2-step flow | ✅ |
| Admin order detail shows per-format download counts | ✅ |
| Admin can regenerate token and extend expiry | ✅ |
| Name collected at checkout, stored on order, back-filled to user | ✅ |
| Personalized file uses customer's real name | ✅ |

---

## Test Status at Phase Completion

- **Backend unit tests**: 176 passing (0 failing)
- **Frontend unit tests**: 125 passing (0 failing)
- **API endpoint count**: 129 total (+2 new: `POST /files/test-personalization`, `POST /downloads/:id/extend`)

---

## Key Files

| File | Role |
|------|------|
| `backend/src/digital-products/personalization.service.ts` | Real EPUB + PDF personalization |
| `backend/src/digital-products/digital-products.service.ts` | Token creation, test personalization, extend expiry |
| `backend/src/digital-products/digital-products.controller.ts` | New endpoints |
| `backend/src/payments/payments.service.ts` | Wires `createDownloadTokensForOrder` into payment paths |
| `frontend/components/digital/DigitalDownloadsPanel.tsx` | Customer download UI |
| `frontend/components/digital/KindleWizard.tsx` | Kindle onboarding wizard |
| `frontend/components/digital/DigitalFilesPanel.tsx` | Admin file management |
| `frontend/components/digital/AdminDigitalPanel.tsx` | Admin download tracking |
| `frontend/lib/orderStatus.ts` | Single source of truth for order status badge colors |
| `frontend/app/(site)/checkout/CheckoutPageClient.tsx` | Name collection at checkout |
| `backend/src/auth/dto/register.dto.ts` | Username field |
| `backend/src/orders/orders.service.ts` | customer_name on order, user back-fill |
