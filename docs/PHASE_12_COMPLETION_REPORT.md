# Phase 12 Completion Report: Audit Trail, Transaction Logging & Content Version History

**Project**: AECMS  
**Phase**: 12  
**Status**: ✅ COMPLETE  
**Commit**: `a1a728e`  
**Date**: 2026-06-04

---

## Summary

Phase 12 wires up the audit and version infrastructure that had been fully designed in the database schema but never connected. After this phase, every significant action — login/logout, order status changes, payment webhooks, admin content edits, comment moderation — is recorded in a tamper-evident audit log. Content version history is fully operational for Articles, Products, and Pages.

---

## What Was Delivered

### Section A — AuditLogService

**`backend/src/audit/audit.service.ts`**
- `AuditLogService.log(entry)` — async, never throws (errors go to `Logger.warn`)
- SHA-256 hash chaining: each entry's `entry_hash` is computed from `JSON.stringify({ ...entry, previous_hash })`, where `previous_hash` is the hash of the most recent row
- `diffChanges(before, after)` — helper returning `{ before, after }` of only changed fields

**`backend/src/audit/audit.module.ts`**
- `@Global()` module so all other modules get `AuditLogService` without explicit imports
- Includes `AuditController` with `GET /audit-logs` (owner sees all; other backstage users see own entries only)

### Section B — Auth Event Logging

| Trigger | `event_type` |
|---------|-------------|
| Customer login | `auth.login` |
| Backstage login (no 2FA) | `auth.login` |
| Failed login (wrong password/user) | `auth.login_failed` |
| 2FA TOTP success | `auth.2fa_success` |
| Other backstage sessions revoked | `auth.sessions_revoked` |
| Logout | `auth.logout` |

### Section C — Admin CRUD Logging

| Trigger | `event_type` |
|---------|-------------|
| Article created | `article.created` |
| Article saved (not yet published) | `article.updated` |
| Article published | `article.published` |
| Article unpublished (archived) | `article.unpublished` |
| Article deleted | `article.deleted` |
| Product updated | `product.updated` |
| Product deleted | `product.deleted` |
| Page created | `page.created` |
| Page saved | `page.updated` |
| Page published | `page.published` |
| Page unpublished | `page.unpublished` |
| Page deleted | `page.deleted` |
| Media uploaded | `media.uploaded` |
| Media deleted | `media.deleted` |

### Section D — Comment Moderation Logging

`approve()`, `reject()`, `markAsSpam()` in `CommentsService` now log `comment.moderated` with before/after status and `moderation_type: 'manual'`. The actorId is passed from the controller.

### Section E — WebhookEvent Table

New `webhook_events` DB table — `gateway`, `event_id` (unique deduplication key), `event_type`, `payload` (Json), `received_at`, `processed_at`, `processing_error`.

`processWebhookEvent()` in `PaymentsService`:
1. Checks if `event_id` already exists — if so, logs and returns early (idempotent)
2. Creates the `WebhookEvent` row before processing
3. Updates `processed_at` on success; sets `processing_error` on failure

`WebhookEvent` interface gained `id?: string`; both Stripe and PayPal providers now return the gateway event ID.

### Section F — Article Version History

- Version creation trigger changed from `version_control_enabled` to **unconditional**: creates a version when transitioning to `published`, or when updating an already-published article
- `dto.change_summary` is stored as the version's change summary (defaults to `'Published'` / `'Updated'`)
- New `UpdateArticleDto` field: `change_summary?: string`

**3 new endpoints:**
- `GET /articles/:id/versions` — paginated list
- `GET /articles/:id/versions/:vnum` — full snapshot
- `POST /articles/:id/versions/:vnum/restore` — creates a new draft from this snapshot

### Section G — Product Version History

New `product_versions` DB table (parallel to `ArticleVersion`). Every admin save of a product creates a version snapshot (name, description, price, compare_at_price, sku, stock_quantity, stock_status).

New `UpdateProductDto` field: `change_summary?: string`

**3 new endpoints** (same pattern as articles):
- `GET /products/:id/versions`
- `GET /products/:id/versions/:vnum`
- `POST /products/:id/versions/:vnum/restore`

### Section G3 — Page Version History

New `page_versions` DB table. Version created when transitioning to `published` or when updating an already-published page. Stores full `PageContent` JSON string (layout + all zones).

New `UpdatePageDto` field: `change_summary?: string`

**3 new endpoints**:
- `GET /pages/:id/versions`
- `GET /pages/:id/versions/:vnum`
- `POST /pages/:id/versions/:vnum/restore`

### Section H — Backstage UI

**H1 — `/admin/audit-log`** (`AuditLogClient.tsx`)
- Table: event_type badge (colour-coded), resource, user ID, timestamp
- Filters: event type (dropdown), resource type (dropdown), resource ID (text search)
- Row expand: shows `changes` and `metadata` JSON in a pre block
- Pagination

**H2/H3/H4 — `VersionHistoryPanel`** (`components/admin/VersionHistoryPanel.tsx`)
- Collapsible panel added below the form in all three editors: articles, products, pages
- Lists versions with number, title, date, change_summary
- Restore button with confirmation modal (explains: "creates a new draft, replaces current content")
- Uses `adminApi` via SWR; loaded lazily (only fetches when panel is opened)

**H5 — Order detail page** (`/admin/orders/[id]/page.tsx`)
- New backstage page (orders list already linked to it)
- Shows order summary (customer, total, payment method, dates)
- Status history timeline from `AuditLog` filtered by `resource_id + event_type='order.status_changed'`
- Timeline shows from/to status, actor, and timestamp

---

## Architecture Decisions

- **`@Global()` AuditModule**: Avoids needing to import `AuditModule` in every feature module. `AuditLogService` is available everywhere by default.
- **Never-throw design**: `AuditLogService.log()` catches all errors internally. A DB failure during logging never breaks the calling operation.
- **Hash chaining**: SHA-256 of `{ ...entry, previous_hash }` per row. Not a true blockchain but provides tamper-evidence — any deletion or modification breaks the chain. The integrity check itself is not automated in this phase.
- **Idempotent webhooks**: `event_id` has a `@unique` constraint. A second delivery of the same Stripe or PayPal event is silently skipped rather than re-processed.
- **Version triggers**: Articles and Pages version on publish OR on update-of-published (not on every draft save — too noisy). Products version on every admin save (no publish step).

---

## Test Counts

| Suite | Before | After |
|-------|--------|-------|
| Backend unit tests | 169 | 176 (+7) |
| Frontend unit tests | 116 | 116 (unchanged) |

**New backend tests** (1 suite, 7 cases):
- `AuditLogService`: hash creation, hash chaining, error isolation (2 cases), resource fields, null previous_hash, hash uniqueness

---

## Files Changed

**38 files changed**, 1,535 insertions, 50 deletions.

### Backend — new
- `src/audit/audit.service.ts`
- `src/audit/audit.module.ts`
- `src/audit/audit.controller.ts`
- `src/audit/audit.service.spec.ts`
- `prisma/migrations/20260604204943_phase12_audit_versions/migration.sql`

### Backend — modified
- `prisma/schema.prisma` — added `WebhookEvent`, `ProductVersion`, `PageVersion` models; added `versions` relation to `Product` and `Page`
- `src/app.module.ts` — added `AuditModule`
- `src/auth/auth.service.ts` — auth event logging
- `src/orders/orders.service.ts` — order status/payment audit logging; `updateStatus` gains optional `actorId`
- `src/orders/orders.controller.ts` — passes `user.id` to `updateStatus`
- `src/articles/articles.service.ts` — article CRUD audit logging + unconditional version creation + version history methods
- `src/articles/articles.controller.ts` — 3 version endpoints
- `src/articles/dto/update-article.dto.ts` — `change_summary` field
- `src/products/products.service.ts` — product CRUD audit logging + version creation + version history methods; `update()` gains `userId` param
- `src/products/products.controller.ts` — passes `user.id` to `update`; 3 version endpoints
- `src/products/dto/update-product.dto.ts` — `change_summary` field
- `src/pages/pages.service.ts` — page CRUD audit logging + version creation + version history methods
- `src/pages/pages.controller.ts` — 3 version endpoints
- `src/pages/dto/update-page.dto.ts` — `change_summary` field
- `src/comments/comments.service.ts` — moderation audit logging; `approve/reject/markAsSpam` gain `actorId` param
- `src/comments/comments.controller.ts` — passes `req.user.id` to moderation methods
- `src/media/media.service.ts` — upload/delete audit logging
- `src/payments/payments.service.ts` — webhook persistence + refund audit logging
- `src/payments/providers/payment-provider.interface.ts` — `WebhookEvent.id?` field
- `src/payments/providers/stripe.provider.ts` — returns `event.id`
- `src/payments/providers/paypal.provider.ts` — returns `event.id`
- `src/auth/auth.service.spec.ts` — added `AuditLogService` mock
- `src/comments/comments.service.spec.ts` — added `AuditLogService` mock
- `src/pages/pages.service.spec.ts` — added `AuditLogService` mock

### Frontend — new
- `app/admin/audit-log/page.tsx`
- `app/admin/audit-log/AuditLogClient.tsx`
- `app/admin/orders/[id]/page.tsx`
- `components/admin/VersionHistoryPanel.tsx`

### Frontend — modified
- `app/admin/layout.tsx` — Audit Log nav item (ownerOnly)
- `app/admin/articles/[id]/edit/EditArticleClient.tsx` — VersionHistoryPanel
- `app/admin/products/[id]/EditProductClient.tsx` — VersionHistoryPanel
- `app/admin/pages/[id]/edit/EditPageClient.tsx` — VersionHistoryPanel

---

## Success Criteria — Status

1. ✅ Every order status change produces an `AuditLog` entry with correct before/after diff
2. ✅ Every Stripe/PayPal webhook produces a `WebhookEvent` row; duplicate delivery is idempotent
3. ✅ Failed login attempts are recorded without exposing them to the public API
4. ✅ Every article publish creates an `ArticleVersion`; restoring a version creates a new draft
5. ✅ Every product save creates a `ProductVersion`
6. ✅ Every page publish/save creates a `PageVersion`; restoring creates a new draft
7. ✅ `/admin/audit-log` renders with working filters; Owner can see all events
8. ✅ Article, product, and page editors show version history with working restore
9. ✅ All new backend unit tests pass; full test suite still passes (176 backend, 116 frontend)
