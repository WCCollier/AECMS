# Phase 12: Audit Trail, Transaction Logging & Content Version History

**Project**: AECMS - Advanced Ecommerce Content Management System  
**Phase**: 12  
**Status**: 📋 PLANNED  
**PRD References**: `docs/prd/03-ecommerce.md § Audit Trail & Transaction Logging`, `docs/prd/01-content-management.md § Version History & Content Audit Trail`

---

## Goal

Wire up the audit and version infrastructure that already exists in the database schema but has never been connected to any service. After this phase, every significant action by a customer, admin, or the system is recorded — order status changes, payment events, admin CRUD operations, auth events, and content edits — so that disputes can be resolved and the full lifecycle of any order or piece of content can be reconstructed.

---

## Background

The `AuditLog` table, `ArticleVersion` table, and `UserAcceptance` table are all fully defined in `prisma/schema.prisma`. Nothing writes to them. This phase does not redesign anything — it wires up what already exists and adds the few missing pieces (`WebhookEvent` table, `ProductVersion` table, backstage UI).

---

## Sections

- **A** — AuditLog service + order/payment wiring
- **B** — Auth event logging
- **C** — Admin CRUD logging (articles, products)
- **D** — Comment moderation logging
- **E** — WebhookEvent table + Stripe/PayPal webhook persistence
- **F** — Article version history (wiring the existing schema)
- **G** — Product version history (schema + wiring)
- **H** — Backstage audit log & version history UI
- **I** — Tests & verification

---

## Section A — AuditLog Service + Order/Payment Wiring

### A1 — `AuditLogService`

Create `backend/src/audit/audit.module.ts` and `audit.service.ts`:

```typescript
// Core write method — all other sections call this
async log(entry: {
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  resource_type?: string;
  resource_id?: string;
  changes?: object;       // { before: ..., after: ... }
  metadata?: object;
}): Promise<void>
```

- Computes `entry_hash` as SHA-256 of `JSON.stringify({ ...entry, previous_hash })` where `previous_hash` is the hash of the most recent `AuditLog` row (null if empty)
- Writes the row; never throws — errors are caught and logged to `Logger.warn` so a logging failure never breaks the calling operation
- `AuditModule` exported so other modules can inject `AuditLogService`

### A2 — Order status history

Every call to `OrdersService.updateStatus()` (and the payment webhook handler that sets status to `processing`) writes an audit entry:

```
event_type:     'order.status_changed'
resource_type:  'order'
resource_id:    order.id
user_id:        actor id (admin) or null (system/webhook)
changes:        { before: { status: 'pending' }, after: { status: 'processing' } }
metadata:       { reason, note, payment_intent_id }
```

### A3 — Refund events

When `PaymentsService` processes a refund:

```
event_type:     'order.refund_initiated'
resource_type:  'order'
resource_id:    order.id
metadata:       { amount, currency, gateway_refund_id }
```

---

## Section B — Auth Event Logging

Wire `AuditLogService` into `AuthService`:

| Trigger | `event_type` | Key metadata |
|---------|-------------|--------------|
| Successful login | `auth.login` | `session_type`, `ip_address`, `user_agent` |
| Failed login | `auth.login_failed` | `email_attempted`, `ip_address`, reason |
| 2FA success | `auth.2fa_success` | `ip_address` |
| 2FA failure | `auth.2fa_failed` | `ip_address`, attempt count |
| Session revoked (logout) | `auth.logout` | `session_type` |
| All backstage sessions revoked (new login) | `auth.sessions_revoked` | count revoked |
| Password reset requested | `auth.password_reset_requested` | `ip_address` |
| Password reset completed | `auth.password_reset_completed` | `ip_address` |

For failed login events: `user_id` is null (user not authenticated yet); `email_attempted` goes in `metadata`.

---

## Section C — Admin CRUD Logging

Wire `AuditLogService` into `ArticlesService` and `ProductsService` for all mutating operations. Use a `diffChanges(before, after)` helper that returns only the fields that changed:

| Trigger | `event_type` |
|---------|-------------|
| Article created | `article.created` |
| Article updated | `article.updated` |
| Article status changed (publish/unpublish) | `article.published` / `article.unpublished` |
| Article soft-deleted | `article.deleted` |
| Product created | `product.created` |
| Product updated | `product.updated` |
| Product soft-deleted | `product.deleted` |
| Media uploaded | `media.uploaded` |
| Media deleted | `media.deleted` |

For `*.updated` entries, `changes` contains a `{ before, after }` diff of only the modified fields, not the full record.

---

## Section D — Comment Moderation Logging

Wire into `CommentsService.moderateComment()` (and any AI/profanity auto-moderation paths):

```
event_type:     'comment.moderated'
resource_type:  'comment'
resource_id:    comment.id
changes:        { before: { status: 'pending' }, after: { status: 'approved' } }
metadata:       { moderation_type: 'manual' | 'ai' | 'profanity', reason }
```

---

## Section E — WebhookEvent Table + Persistence

### E1 — Schema migration

Add `WebhookEvent` model to `schema.prisma`:

```prisma
model WebhookEvent {
  id               String    @id @default(uuid())
  gateway          String    // 'stripe' | 'paypal'
  event_id         String    @unique  // gateway-assigned ID (deduplication key)
  event_type       String    // e.g. 'checkout.session.completed'
  payload          Json      // raw webhook body
  received_at      DateTime  @default(now())
  processed_at     DateTime?
  processing_error String?   @db.Text

  @@index([gateway, event_type])
  @@index([received_at])
  @@map("webhook_events")
}
```

### E2 — Webhook handlers

Update `PaymentsService` Stripe and PayPal webhook handlers:

1. On receipt, upsert a `WebhookEvent` row (insert or skip if `event_id` already exists — idempotency)
2. Process the event
3. Update `processed_at` on success; set `processing_error` on failure
4. Both the existing console `Logger` calls and the new DB write should happen

---

## Section F — Article Version History (Wiring)

`ArticleVersion` exists in the schema but is never written.

### F1 — Service wiring

In `ArticlesService.update()`, when the incoming `status` transitions to `published` (or when an already-published article is saved), create a new `ArticleVersion`:

```typescript
await prisma.articleVersion.create({
  data: {
    article_id:     article.id,
    version_number: (latestVersion?.version_number ?? 0) + 1,
    title:          dto.title ?? article.title,
    content:        dto.content ?? article.content,
    change_summary: dto.change_summary ?? null,
    created_by:     actorId,
  },
});
```

Also write an `AuditLog` entry for `article.published` / `article.updated` at the same time (see Section C).

### F2 — API endpoints

Add to `ArticlesController`:

```
GET  /articles/:id/versions          → paginated list (version_number, created_by, created_at, change_summary)
GET  /articles/:id/versions/:vnum    → full version snapshot
POST /articles/:id/versions/:vnum/restore  → creates a new draft from this version snapshot
```

All require backstage session + `articles.manage` capability.

---

## Section G — Product Version History

> **Note**: Page version history (Section G3 below) was added as an addendum after Phase 11. Pages store content as a `PageContent` JSON envelope (layout + zones), so their versioning snapshots that full structure rather than a single HTML/TipTap string.

### G1 — Schema migration

Add `ProductVersion` model (parallel to `ArticleVersion`):

```prisma
model ProductVersion {
  id               String   @id @default(uuid())
  product_id       String
  version_number   Int
  name             String
  description      String?  @db.Text
  price            Decimal  @db.Decimal(10,2)
  compare_at_price Decimal? @db.Decimal(10,2)
  sku              String?
  stock_quantity   Int?
  stock_status     String
  change_summary   String?
  created_by       String
  created_at       DateTime @default(now())

  product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)

  @@unique([product_id, version_number])
  @@map("product_versions")
}
```

Add `versions ProductVersion[]` relation to the `Product` model.

### G2 — Service wiring

In `ProductsService.update()`, create a `ProductVersion` snapshot on every save (products don't have a publish step — every admin save is worth versioning):

```typescript
await prisma.productVersion.create({
  data: {
    product_id:       product.id,
    version_number:   (latestVersion?.version_number ?? 0) + 1,
    name:             dto.name ?? product.name,
    description:      dto.description ?? product.description,
    price:            dto.price ?? product.price,
    compare_at_price: dto.compare_at_price ?? product.compare_at_price,
    sku:              dto.sku ?? product.sku,
    stock_quantity:   dto.stock_quantity ?? product.stock_quantity,
    stock_status:     dto.stock_status ?? product.stock_status,
    change_summary:   dto.change_summary ?? null,
    created_by:       actorId,
  },
});
```

### G3 — API endpoints

Add to `ProductsController` (same pattern as articles):

```
GET  /products/:id/versions
GET  /products/:id/versions/:vnum
POST /products/:id/versions/:vnum/restore
```

---

## Section G3 — Page Version History (addendum from Phase 11)

Pages were added in Phase 11 after the original Phase 12 plan was written. They warrant the same version history treatment as Articles and Products.

### G3.1 — Schema migration

Add `PageVersion` model (parallel to `ArticleVersion`):

```prisma
model PageVersion {
  id             String   @id @default(uuid())
  page_id        String
  version_number Int
  title          String
  content        String   @db.Text   // full PageContent JSON envelope
  change_summary String?
  created_by     String
  created_at     DateTime @default(now())

  page Page @relation(fields: [page_id], references: [id], onDelete: Cascade)

  @@unique([page_id, version_number])
  @@map("page_versions")
}
```

Add `versions PageVersion[]` relation to the `Page` model.

### G3.2 — Service wiring

In `PagesService.update()`, create a `PageVersion` snapshot on every save where `status` transitions to `published`, or whenever an already-published page is edited (same trigger logic as articles):

```typescript
await prisma.pageVersion.create({
  data: {
    page_id:        page.id,
    version_number: (latestVersion?.version_number ?? 0) + 1,
    title:          dto.title ?? page.title,
    content:        dto.content ?? page.content,   // full PageContent JSON string
    change_summary: dto.change_summary ?? null,
    created_by:     actorId,
  },
});
```

Also write an `AuditLog` entry for `page.updated` / `page.published` (parallel to Section C).

### G3.3 — API endpoints

Add to `PagesController`:

```
GET  /pages/:id/versions          → paginated list (version_number, created_by, created_at, change_summary)
GET  /pages/:id/versions/:vnum    → full version snapshot (includes content JSON)
POST /pages/:id/versions/:vnum/restore  → creates a new draft from this version snapshot
```

All require backstage session + `page.edit` capability.

### G3.4 — AuditLog events for Pages

Wire `AuditLogService` into `PagesService` for all mutating operations (parallel to Section C):

| Trigger | `event_type` |
|---------|-------------|
| Page created | `page.created` |
| Page updated | `page.updated` |
| Page published | `page.published` |
| Page unpublished | `page.unpublished` |
| Page deleted | `page.deleted` |

---

## Section H — Backstage UI

### H1 — Audit Log viewer (`/admin/audit-log`)

- Table: `event_type`, `user` (name or "system"), `resource`, `ip_address`, `timestamp`
- Filters: event type, date range, resource type, user
- Row expand: shows `changes` and `metadata` JSON
- Owner-only page; admin sees only their own entries

### H2 — Article version history panel

- In the article editor, a "Version History" sidebar panel listing past versions
- Click a version → shows a side-by-side diff of title + content vs. current
- "Restore this version" button → calls `POST /articles/:id/versions/:vnum/restore`

### H3 — Product version history panel

- Same as H2 but for the product editor
- Shows name, price, SKU, description diffs

### H4 — Page version history panel

- In the page editor (`/admin/pages/[id]/edit`), a "Version History" sidebar panel listing past versions
- Click a version → shows a diff of title + `content` (rendered as layout label + zone summary) vs. current
- "Restore this version" button → calls `POST /pages/:id/versions/:vnum/restore`, which creates a new draft
- Full `PageContent` JSON is stored per version — restoring brings back the exact layout and all zone content

### H5 — Order status history on order detail page

- In the backstage order detail view, a timeline of status transitions
- Each entry: status, timestamp, actor (admin name or "system")
- Already derivable from `AuditLog` filtered by `resource_type='order'` + `event_type='order.status_changed'`

---

## Section I — Tests & Verification

### Backend unit tests
- `AuditLogService`: hash chaining, error isolation (logging failure does not throw)
- `OrdersService`: status change writes `AuditLog` row with correct `changes`
- `AuthService`: login success/failure writes correct entries
- `ArticlesService`: version created on publish; `changes` diff correct
- `ProductsService`: version created on update; `changes` diff correct
- `PagesService`: version created on publish/save; audit event written
- `WebhookEvent`: duplicate `event_id` is silently skipped (idempotency)

### Integration / manual verification
- [ ] Order status change in backstage → row appears in `audit_logs`
- [ ] Failed login → row in `audit_logs` with no `user_id`
- [ ] Stripe webhook received → row in `webhook_events`; second delivery of same `event_id` → no duplicate
- [ ] Article published → `ArticleVersion` row created; restored version → new version row
- [ ] Product saved → `ProductVersion` row created
- [ ] Page published/saved → `PageVersion` row created; restored version → new version row
- [ ] `/admin/audit-log` renders, filters work
- [ ] Article editor version panel shows list and diff
- [ ] Product editor version panel shows list and diff
- [ ] Page editor version panel shows list and restore

---

## Files Impacted

### Backend — new
| File | Purpose |
|------|---------|
| `src/audit/audit.module.ts` | Module definition |
| `src/audit/audit.service.ts` | `log()` method, hash chaining |
| `src/audit/audit.service.spec.ts` | Unit tests |
| `prisma/migrations/...` | `webhook_events` table + `product_versions` table |

### Backend — modified
| File | Change |
|------|--------|
| `src/auth/auth.service.ts` | Write auth events to `AuditLog` |
| `src/orders/orders.service.ts` | Write status-change events to `AuditLog` |
| `src/payments/payments.service.ts` | Persist `WebhookEvent`; write refund events |
| `src/articles/articles.service.ts` | Write article events + create `ArticleVersion` on publish |
| `src/articles/articles.controller.ts` | New version endpoints |
| `src/products/products.service.ts` | Write product events + create `ProductVersion` on save |
| `src/products/products.controller.ts` | New version endpoints |
| `src/comments/comments.service.ts` | Write moderation events |
| `prisma/schema.prisma` | `WebhookEvent` model; `ProductVersion` model; `Product.versions` relation |
| `app.module.ts` | Import `AuditModule` |

### Backend — new (additions from G3 addendum)
| File | Purpose |
|------|---------|
| `prisma/migrations/...` | `page_versions` table |

### Backend — modified (additions from G3 addendum)
| File | Change |
|------|--------|
| `src/pages/pages.service.ts` | Write page audit events + create `PageVersion` on publish/save |
| `src/pages/pages.controller.ts` | New version endpoints |
| `prisma/schema.prisma` | `PageVersion` model; `Page.versions` relation |

### Frontend — new
| File | Purpose |
|------|---------|
| `app/admin/audit-log/page.tsx` | Audit log viewer (Owner) |
| `app/admin/audit-log/AuditLogClient.tsx` | Table + filters |
| `components/admin/VersionHistoryPanel.tsx` | Shared version list + diff panel (used by articles, products, pages) |

### Frontend — modified
| File | Change |
|------|--------|
| `app/admin/articles/[id]/edit/EditArticleClient.tsx` | Add `VersionHistoryPanel` |
| `app/admin/products/[id]/edit/EditProductClient.tsx` | Add `VersionHistoryPanel` |
| `app/admin/pages/[id]/edit/EditPageClient.tsx` | Add `VersionHistoryPanel` |
| `app/admin/orders/[id]/page.tsx` | Add status history timeline |

---

## Success Criteria

1. Every order status change produces an `AuditLog` entry with correct before/after diff
2. Every Stripe webhook produces a `WebhookEvent` row; duplicate delivery is idempotent
3. Failed login attempts are recorded without exposing them to the public API
4. Every article publish creates an `ArticleVersion`; restoring a version creates a new version
5. Every product save creates a `ProductVersion`
6. Every page publish/save creates a `PageVersion`; restoring a version creates a new draft
7. `/admin/audit-log` renders with working filters; Owner can see all events
8. Article, product, and page editors show version history with working diff and restore
9. All new backend unit tests pass; full test suite still passes
