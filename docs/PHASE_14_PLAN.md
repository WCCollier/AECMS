# Phase 14 Plan: Digital Item Delivery

**Status:** PLANNED  
**Depends on:** Phase 7 (Digital Products backend — ✅ complete), Phase 13 (QA), order management improvements (Phase 14 prerequisites done inline with Phase 13)

---

## Overview

Phase 7 built the complete backend for digital products: file storage, personalization engine, download tokens, and Send to Kindle. Phase 14 closes the loop by wiring all of that up to the customer-facing and admin frontend.

The four areas:

| Area | Description |
|------|-------------|
| 14-A | Admin: Digital product file management in product editor |
| 14-B | Personalized copy generation (trigger on payment, cache, re-generate on demand) |
| 14-C | Customer download system — order page + secure download links |
| 14-D | Send to Kindle wizard — slideshow onboarding, device management |

---

## What Phase 7 Already Built (Backend — Do Not Rebuild)

| Capability | Location |
|---|---|
| `DigitalProductFile` Prisma model | schema.prisma |
| `DigitalDownload` Prisma model (tokens, limits, expiry, per-format counters) | schema.prisma |
| `KindleDevice` Prisma model | schema.prisma |
| `StorageProvider` abstraction (local filesystem, cloud-ready) | `backend/src/storage/` |
| `EmailProvider` abstraction (console dev, SMTP prod) | `backend/src/email/` |
| `PersonalizationService.personalize()` — EPUB + PDF stamping | `digital-products/personalization.service.ts` |
| `DigitalProductsService` — upload, download tokens, token validation, file streaming | `digital-products/digital-products.service.ts` |
| `KindleService` — device CRUD, `sendToKindle()` via email | `digital-products/kindle.service.ts` |
| API endpoints (11 total) | `digital-products/digital-products.controller.ts` + `kindle.controller.ts` |

**Existing API endpoints:**
```
POST   /digital-products/files                        Upload master file
GET    /digital-products/products/:id/files           List files for product
GET    /digital-products/files/:id                    Get file details
DELETE /digital-products/files/:id                    Delete file
POST   /digital-products/orders/:orderId/downloads    Create download tokens for order
GET    /digital-products/orders/:orderId/downloads    Get download records for order
GET    /digital-products/my-downloads                 Customer's download records
GET    /digital-products/validate/:token              Validate a token
GET    /digital-products/download/:token              Stream file (decrements count)
POST   /digital-products/downloads/:id/regenerate     Regenerate expired token
GET    /kindle/devices                                List user's Kindle devices
POST   /kindle/devices                                Add device
PATCH  /kindle/devices/:id                            Update device
DELETE /kindle/devices/:id                            Delete device
POST   /kindle/send                                   Send file to Kindle
GET    /kindle/devices/default                        Get default device
GET    /kindle/order/:orderId/send                    Send all order files to Kindle
```

---

## Area 14-A: Admin — Digital Product File Management

### Goal
Admin can upload master files (EPUB, PDF) for a digital product, test personalization per format, and see upload status — all from the product editor.

### Backend additions needed

1. **`POST /digital-products/files/test-personalization`** — generate a personalized test copy with dummy data and return a temporary download URL.
   - Input: `{ product_id, format }` (or `file_id`)
   - Output: `{ download_url: '/admin/test-downloads/:token', expires_in: '1h' }`
   - Reuse `PersonalizationService.personalize()` with dummy `{ customerName: 'Test Customer', orderNumber: 'TEST-00000', purchaseDate: now }`
   - Store result in temporary file storage with 1-hour TTL
   - Update `personalization_tested = true` on `DigitalProductFile`

2. **`GET /admin/test-downloads/:token`** — stream the temporary test file.

### Frontend additions

**In `EditProductClient.tsx` (after inventory tracker):**

```
┌──────────────────────────────────────────┐
│ Digital Files                            │
│                                          │
│ EPUB   uploaded (2.4 MB)  ✅ Tested     │
│   [Test Personalization]  [Remove]       │
│                                          │
│ PDF    uploaded (5.1 MB)  ⚠️ Not tested │
│   [Test Personalization]  [Remove]       │
│                                          │
│ [Upload File]  Format: [EPUB ▼]         │
└──────────────────────────────────────────┘
```

**Component: `DigitalFilesPanel`**
- Load from `GET /digital-products/products/:id/files`
- Upload via `POST /digital-products/files` (multipart/form-data: `product_id`, `format`, `file`)
- Delete via `DELETE /digital-products/files/:id`
- Test: `POST /digital-products/files/test-personalization` → open in new tab
- Show only for products with `product_type === 'digital'`

**Visibility gate:** Panel renders only when `product.product_type === 'digital'`.

---

## Area 14-B: Personalized Copy Generation

### Goal
When a digital product order is marked paid, generate a personalized copy for each format owned by each digital item in the order and create `DigitalDownload` records.

### Where to hook

The existing `PaymentsService.markOrderAsPaid()` (called by both Stripe webhook and PayPal capture) already sets order status to `processing`. We add a call there:

```typescript
// In payments.service.ts, after markAsPaid():
await this.digitalProductsService.createDownloadTokensForOrder(orderId);
```

`createDownloadTokensForOrder` already exists in `DigitalProductsService`. It needs to be verified and extended:
- Query order items where `product.product_type === 'digital'`
- For each item × each `DigitalProductFile` format → call `PersonalizationService.personalize()` → store file → create `DigitalDownload` row
- Idempotent (if tokens already exist, skip)

**Current gap:** `createDownloadTokensForOrder` exists but does not call `PersonalizationService` yet — the personalized file path on the download record is empty. This needs to be wired.

### Configuration
```env
DIGITAL_PRODUCT_DOWNLOAD_LIMIT=5       # downloads per format per purchase
DIGITAL_PRODUCT_ACCESS_DAYS=7          # token expiry window (0 = lifetime)
DIGITAL_PRODUCT_CACHE_HOURS=24         # how long personalized files are cached
```

---

## Area 14-C: Customer Download System

### Goal
On the order confirmation page and the customer account page, show download buttons for digital items with format selection, downloads remaining, and expiry date.

### Order confirmation page additions

After the order items table, if the order contains digital items:

```
┌──────────────────────────────────────────────┐
│ Your Digital Downloads                       │
│                                              │
│ How Writing Works                            │
│   EPUB  ████████░░  4 of 5 remaining        │
│   [Download EPUB]  [Send to Kindle]          │
│                                              │
│   PDF   ██████████  5 of 5 remaining        │
│   [Download PDF]   [Send to Kindle]          │
│                                              │
│ Links expire: January 15, 2027              │
└──────────────────────────────────────────────┘
```

**Component: `DigitalDownloadsPanel`**
- Props: `orderId`
- Fetch: `GET /digital-products/orders/:orderId/downloads`
- Download button: `GET /digital-products/download/:token` (link opens in new tab, triggers browser download)
- Send to Kindle button: opens Kindle delivery wizard (Area 14-D)
- Show `{download_count} of {download_limit} remaining`
- Show `expires_at` date
- Show only if order contains digital items

### Account orders list / order detail

Add "Downloads" sub-section to each order in the account page that has digital items. Same `DigitalDownloadsPanel` component, reused.

---

## Area 14-D: Send to Kindle Wizard

### Goal
Walk a first-time user through: (1) finding their Kindle email, (2) whitelisting our sending address, (3) registering the device, then send the file. Return users with a saved device skip straight to step 3/send.

### Wizard structure (modal, slideshow-style)

**For users with no saved Kindle devices — full onboarding (4 steps):**

```
Step 1 of 4 — Find Your Kindle Email
─────────────────────────────────────────
Your Kindle device has a unique email address.

1. Go to amazon.com → Account → Content & Devices
2. Click the "Devices" tab
3. Find your Kindle and click it
4. Copy the "Send-to-Kindle Email" address

[  ___________________@kindle.com  ]  ← enter it here

[Back]                          [Next →]


Step 2 of 4 — Whitelist Our Email
─────────────────────────────────────────
Amazon only accepts files from approved senders.

1. Go to amazon.com → Account → Content & Devices
2. Click "Preferences" tab → "Personal Document Settings"
3. Scroll to "Approved Personal Document E-mail List"
4. Click "Add a new approved e-mail address"
5. Enter: [books@yourstore.com]      ← copy this

                               [Next →]


Step 3 of 4 — Name This Device
─────────────────────────────────────────
Give this device a friendly name so you can
find it later:

[  My Kindle Paperwhite          ]

☑ Save this device to my account

[Back]                          [Next →]


Step 4 of 4 — Ready to Send!
─────────────────────────────────────────
Format: [EPUB ▼]  (recommended for Kindle)

We'll send "How Writing Works" to:
johndoe_123@kindle.com
(My Kindle Paperwhite)

This counts as 1 of your 5 downloads.

[Back]                 [Send to Kindle →]
```

**For users with saved devices — short flow (2 steps):**

```
Step 1 — Choose Your Device
─────────────────────────────────────────
● My Kindle Paperwhite  (johndoe_123@kindle.com)
○ iPad Kindle App       (johndoe_456@kindle.com)
○ Add new device

[Choose a format: EPUB ▼]

[Cancel]                      [Send →]
```

### Implementation

**Frontend component: `KindleWizard`**
- State machine: `'device-select' | 'step-find-email' | 'step-whitelist' | 'step-name-device' | 'step-confirm' | 'sending' | 'done' | 'error'`
- On `Send`: `POST /kindle/send` with `{ download_id, device_id, format }` (or new device info)
- Kindle device CRUD: use existing `/kindle/devices` endpoints

**Backend call:**
```typescript
POST /kindle/send
{
  order_id: string,
  product_id: string,
  format: 'epub' | 'pdf',
  kindle_email: string,         // if new device
  device_name?: string,
  save_device?: boolean,
  device_id?: string            // if existing device
}
```
The existing `KindleService.sendToKindle()` handles file retrieval and email delivery. The endpoint just needs to resolve device/email and call it, then decrement the download count.

---

## Admin: Digital Order Tracking (replacement for "placeholder" in order detail)

The admin order detail currently shows:
> "Digital delivery tracking will be available in Phase 14."

Replace with:

```
Digital Items
─────────────────────────────────────────────────
How Writing Works

  EPUB  ████████░░  4 of 5 downloads used
  Kindle sends: 2
  Last downloaded: Jan 10, 2027

  PDF   ██░░░░░░░░  1 of 5 downloads used
  Last downloaded: Jan 8, 2027

  [Regenerate tokens]  [Extend expiry]
```

**New backend endpoints needed:**
- `GET /digital-products/orders/:orderId/downloads` — already exists, add per-download audit entries
- `POST /digital-products/downloads/:id/regenerate` — already exists
- `POST /digital-products/downloads/:id/extend` — new: extend `expires_at` by N days

---

## Schema Changes

No new tables needed — Phase 7 schema is complete. Minor additions:

```prisma
// Already exists in DigitalDownload:
// download_count, download_limit, expires_at, format, token, etc.

// May add to DigitalDownload:
kindle_send_count   Int   @default(0)  // track Kindle sends separately from browser downloads
last_downloaded_at  DateTime?
```

---

## Dependency Packages (new)

| Package | Purpose |
|---|---|
| `adm-zip` | EPUB (ZIP) manipulation for personalization |
| `jsdom` | HTML DOM manipulation inside EPUB |
| `pdf-lib` | PDF page insertion for personalization stamp |

Phase 7's `PersonalizationService` stubs these out — they need to be filled in with real implementations using these libraries.

---

## Execution Order

1. Install packages (`adm-zip`, `jsdom`, `pdf-lib`) in backend
2. **14-B first:** Implement real personalization in `PersonalizationService` (fill in EPUB and PDF methods); wire `createDownloadTokensForOrder` call into `markOrderAsPaid`
3. **14-A:** Admin `DigitalFilesPanel` + test personalization endpoint
4. **14-C:** `DigitalDownloadsPanel` on order confirmation and account pages
5. **14-D:** `KindleWizard` modal component
6. **Admin digital tracking:** Replace placeholder in order detail

---

## Verification Checklist

- [ ] Upload EPUB + PDF to a digital product in admin
- [ ] Test personalization for each format → downloads correctly personalized test file
- [ ] Purchase digital product (Stripe sandbox) → download tokens auto-created on payment confirmation
- [ ] Order confirmation shows download buttons with correct counts
- [ ] Download EPUB → personalized page at front of file, count decrements
- [ ] Download PDF → personalized page at front of file, count decrements
- [ ] Hit download limit → friendly error
- [ ] Expired token → friendly error + [Regenerate] button visible
- [ ] Kindle wizard: new user completes all 4 steps → file delivered (test via console email provider)
- [ ] Kindle wizard: returning user with saved device → 2-step flow
- [ ] Admin order detail shows per-format download counts and last-downloaded timestamp
- [ ] Admin can regenerate token and extend expiry
