# Phase 22 Completion Report: Dependency Upgrades & Live-Testing Fixes

**Project**: AECMS  
**Phase**: 22  
**Status**: ✅ COMPLETE (all items A–M, including H.2-A/B and H.4)  
**Started**: 2026-06-20  
**Last updated**: 2026-06-21  
**Commits**: `013f777`, `3ecea7c`, `b86727b`, `b7545c8`, `527f346`, `c56a7de`, `eb8d731`, `85ca5e8`, `fbfc0d3`, `f662187` + Item M (uncommitted)

---

## Overview

Phase 22 addressed a backlog of technical debt and UX improvements discovered during the Phase 21 live deployment. Items were organised alphabetically (A–I) in `docs/PHASE_22_PLAN.md` and implemented in priority order. All 315 tests (190 backend + 125 frontend) pass at completion.

---

## Item A — TipTap Version Alignment ✅

**Problem**: `@tiptap/extension-text-align` was at `3.25.0` while `@tiptap/starter-kit`, `@tiptap/react`, `@tiptap/extension-link`, and `@tiptap/extension-image` were at `3.18.0` or `3.23.6`. This cross-generation mismatch was suppressed by `legacy-peer-deps=true` in `frontend/.npmrc`.

**Fix**:
- Upgraded all five `@tiptap/*` packages to `3.27.1` (latest stable)
- Removed `legacy-peer-deps=true` from `frontend/.npmrc`; clean install verified without it
- All 125 frontend tests continue to pass

**Files changed**: `frontend/package.json`, `frontend/package-lock.json`, `frontend/.npmrc`

---

## Item B — GitHub Actions / Node.js Version Upgrade ✅

**Problem**: Every CI run logged Node.js 20 deprecation warnings for `actions/checkout@v4`, `actions/setup-node@v4`, `google-github-actions/auth@v2`, and `google-github-actions/setup-gcloud@v2`.

**Fix**: Updated `.github/workflows/deploy.yml` to:
- `actions/checkout@v4.2.2`
- `actions/setup-node@v4.4.0` (Node 22)
- `google-github-actions/auth@v2.1.8`
- `google-github-actions/setup-gcloud@v2.1.4`

Also updated backend `Dockerfile` base image from `node:20-alpine` → `node:22-alpine` to match.

**Files changed**: `.github/workflows/deploy.yml`, `backend/Dockerfile`

---

## Item C — Setup Wizard Placeholder Text ✅

**Problem**: The wizard's first step (Site Identity) showed real personal information in placeholder text: "My Site" as site name, "Ideas worth fighting for" as tagline, "First" / "Last" as first/last name.

**Fix**: Replaced all four with generic fictional examples:
- Site name: `My Awesome Site`
- Tagline: `Welcome to my corner of the internet`
- First name: `Jane`
- Last name: `Smith`

**Files changed**: `frontend/app/setup/page.tsx`

---

## Item D — Password Show/Hide Toggle Site-Wide ✅

**Problem**: No password field anywhere on the site had a visibility toggle. The confirm-password fields also had no live match feedback.

**Implementation**:

1. **New component** `frontend/components/ui/PasswordInput.tsx`: wraps the existing `Input` component with a toggle `visible` state and an inline SVG eye/eye-off button (`tabIndex={-1}`, `aria-label`). Exported from `components/ui/index.ts`.

2. **11 password fields across 6 files updated**:

| File | Fields | Approach |
|------|--------|----------|
| `app/setup/page.tsx` | password, confirm password | Inline wrapper (wizard uses raw `<input>`) |
| `app/admin/login/AdminLoginClient.tsx` | password | Inline wrapper (uses `react-hook-form` register spread) |
| `app/auth/login/LoginPageClient.tsx` | password | `PasswordInput` component |
| `app/auth/register/RegisterPageClient.tsx` | password, confirm password | `PasswordInput` component |
| `components/layout/Header.tsx` | password (inline login flyout) | `PasswordInput` component |
| `app/(site)/account/AccountPageClient.tsx` | current password, new password, confirm new password, delete-account password | `PasswordInput` component |

3. **Live confirm-password mismatch feedback** added to 3 fields:
   - Setup wizard: red border + "Passwords do not match" after first blur
   - Registration (`RegisterPageClient`): `error` prop passed to `PasswordInput` after blur
   - Account → Change Password (`AccountPageClient`): `pwConfirmTouched` state + error prop

**Files changed**: `frontend/components/ui/PasswordInput.tsx` (new), `frontend/components/ui/index.ts`, + 5 pages/components above

---

## Item E — Production Capability Seed on Boot ✅

**Problem**: `prisma migrate deploy` runs on every container start but does not run seeds. The first live deployment had an empty `capabilities` table, hiding all backstage sidebar items even for the Owner. Fixed manually at the time; needed a permanent automated solution.

**Implementation**:

1. **`backend/scripts/seed-minimal.js`** (new): Plain CommonJS equivalent of `prisma/seed.ts` — upserts all 47 capabilities, role_capabilities for admin/member/guest, and 5 default site settings. Uses `@prisma/client`, `@prisma/adapter-pg`, `pg` (all production dependencies — no `ts-node`). Idempotent.

2. **`backend/scripts/docker-start.sh`** (new): Replaces the bare `sh -c` CMD in `Dockerfile`. Sequence:
   - `prisma migrate deploy` (always)
   - Node.js inline query counts `capability` rows
   - If count is 0: runs `seed-minimal.js` then `seed-sample-content.js`
   - `exec node dist/src/main`

3. **`backend/Dockerfile`**: 
   - Added `COPY --from=builder /app/scripts ./scripts` + `chmod +x`
   - Changed CMD from inline `sh -c` to `sh /app/scripts/docker-start.sh`

**Files changed**: `backend/scripts/seed-minimal.js` (new), `backend/scripts/docker-start.sh` (new), `backend/Dockerfile`

---

## Item F — Email Test Button Uses Live Form Values ✅

**Problem**: The "Send Test Email" button in Admin Settings → Email tab always tested whatever was saved in the backend ISM, not what was currently typed in the form. Users tried testing immediately after filling in fields and were confused when results reflected stale/empty config.

**Implementation**:

**Backend**: Added `POST /settings/test-email-preview` endpoint (same `system.configure.email` capability guard). Added `sendWithConfig(recipientEmail, config)` method to `TestEmailService` that builds a temporary `nodemailer` transporter from the request body values — does not touch the ISM.

**Frontend** (`SettingsClient.tsx`):
- Computed `emailFieldsFilled` boolean (Host + Port + User + From Address all non-empty)
- `handleTestEmail` now POSTs `current form values` to `/settings/test-email-preview` instead of the bare `/settings/test-email`
- Test button disabled when `emailFieldsFilled` is false
- Helper text below button: *"Test uses the values currently entered above. Save after a successful test."* / *"Fill in Host, Port, Username, and From Address to enable the test."*

**Files changed**: `backend/src/settings/settings.controller.ts`, `backend/src/settings/test-email.service.ts`, `frontend/app/admin/settings/SettingsClient.tsx`

---

## Item G — Sample Draft Content Seed + `_home_` Deletion Guard + Homepage Warning ✅

### G.1 — Backend Deletion Guard for `_home_`

The frontend hides the Delete button for `_home_` but the API had no equivalent guard. Added a check in `PagesService.remove()` — before permission checks — that throws `ForbiddenException('The system homepage page (_home_) cannot be deleted.')` when the target page's slug is `_home_`.

**File changed**: `backend/src/pages/pages.service.ts`

### G.2 — Backstage Warning When Homepage Mode is Ineffective

Added an inline amber warning in Admin Settings → General tab when `homepage_mode === 'static_page'` but no effective published homepage is found:

- **If a page is designated** but not in the published pages list: *"The selected page is not currently published. Your site will fall back to the _home_ page [—which is also not published]. Visitors will be redirected to /articles."*
- **If no page is designated** and `_home_` is also not published: *"No published homepage found. Visitors will be redirected to /articles until you publish a page here or publish the built-in _home_ page."*

**File changed**: `frontend/app/admin/settings/SettingsClient.tsx`

### Sample Draft Content Seed

Created two parallel implementations (TypeScript for dev, plain CJS for production Docker):

- `backend/prisma/seed-sample-content.ts` — called by `seed-all.sh` (dev workflow)
- `backend/scripts/seed-sample-content.js` — called by `docker-start.sh` (production)

**Four draft items seeded on fresh installs** (each guarded by slug existence check):

| Type | Slug/Title | Content |
|------|------------|---------|
| Page | `_home_` | Placeholder homepage + instructions to publish and set Homepage Mode |
| Page | `about-pages` | Explains pages, hierarchy, navigation, and the full homepage waterfall |
| Article | `welcome` | Explains articles: fields, publishing, comments/reviews, version history |
| Product | `about-products` | Explains product types, pricing, digital delivery, and payment providers |

`_home_` is seeded with `author_can_delete: false, admin_can_delete: false` (belt-and-suspenders alongside the backend guard).

**Files changed/added**: `backend/prisma/seed-sample-content.ts` (new), `backend/scripts/seed-sample-content.js` (new), `backend/prisma/seed-all.sh`, `backend/scripts/docker-start.sh`

---

## Item I — Transaction CSV Export ✅

### Schema Additions

**Migration**: `20260620152349_add_order_export_fields`

Added to `OrderItem`:
- `product_title String @default("")` — snapshot of the product title at order time. Prevents UUID-only exports if a product is later renamed or deleted.

Added to `Order`:
- `refunded_at DateTime?` — timestamp of successful refund
- `refund_amount Decimal?` — refund amount in dollars (null = full order total)
- `refund_id String?` — gateway refund reference ID

### Service/Provider Updates

- `OrdersService.createFromCart()`: now populates `product_title` from `item.product.title` at order creation
- `PaymentsService.refund()`: now populates `refunded_at`, `refund_id`, and `refund_amount` (converted from cents) when refund succeeds

### Export Endpoint

**`GET /orders/export`** (`BackstageGuard` + `CapabilityGuard` → `order.view.all`):
- Query params: `from` and `to` (ISO date strings; defaults: first of current month → today)
- Returns `text/csv` with `Content-Disposition: attachment` header
- **Produces two rows per refunded order**: sale row (positive) + refund row (negative amounts), so accounting software can match them
- Columns: `date`, `type`, `order_number`, `customer_email`, `customer_name`, `payment_method`, `payment_reference`, `items`, `subtotal`, `tax`, `shipping`, `total`, `status`, `notes`
- `items` column: semicolon-delimited `"Product Title × qty"` using snapshot title (falls back to current product title then product ID)
- **Route declared before `/:id`** to avoid wildcard shadowing
- Implemented in `OrdersService.exportCsv(from, to)`

**Files changed**: `backend/prisma/schema.prisma`, `backend/src/orders/orders.service.ts`, `backend/src/orders/orders.controller.ts`, `backend/src/payments/payments.service.ts`

### Frontend

Admin Orders panel (`AdminOrdersClient.tsx`) header bar now shows:
- **From** date input (default: first day of current month)
- **To** date input (default: today)
- **Export CSV** button (outline variant, Download icon)

Clicking Export calls `adminApi.get('/orders/export', { params, responseType: 'text' })`, creates a Blob, and triggers a browser download via a temporary `<a>` element. No new route or page needed.

**File changed**: `frontend/app/admin/orders/AdminOrdersClient.tsx`

---

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| Backend unit tests | 190/190 | 190/190 ✅ |
| Frontend unit tests | 125/125 | 125/125 ✅ |

---

## Item J — New Owner Experience ✅

### J.1 — deploy.yml Parameterized
Replaced 7 hardcoded deployer-specific values with GitHub Variables (`vars.GCP_PROJECT_NUMBER`, `vars.GCP_PROJECT_ID`, `vars.APP_DOMAIN`, `vars.GCS_MEDIA_BUCKET`, `vars.GCS_DIGITAL_BUCKET`, `vars.SETTINGS_KMS_SECRET_ID`, `vars.KINDLE_FROM_EMAIL`). New owners set these 7 values in GitHub repo Settings → Variables; no file editing required. Also added `GCS_BUCKET_MEDIA` and `GCS_BUCKET_DIGITAL` to backend `set-env-vars` so the `getAll()` env fallback populates File Storage tab correctly on Cloud Run.

### H.2-A — GCS Bucket Automation
Added idempotent bucket creation step to `deploy.yml`, after GCP auth and before backend deploy. Creates media bucket (with `allUsers objectViewer` IAM binding) and digital bucket. Existing buckets are silently skipped. No manual `gcloud` commands needed on new GCP deployments.

### J.4 / H.1 — Deployment Profile Endpoint + getAll() Env Merge
- `SettingsService.getAll()` now merges `ENV_KEY_MAP` env var fallbacks for keys not present in the DB. File Storage (and all other settings tabs) now show actively configured values even when set exclusively via environment variables.
- `SettingsService.getEnvSourcedKeys()` returns which keys are env-sourced.
- `GET /setup/profile` (public, no auth) returns `storageProvider`, `emailProvider`, `kmsProvider`, `appUrl`, `isFirstRun`, `envKeys[]`. Consumed by the wizard and settings panel.

### H.4 — Storage Test Preview Endpoint
`POST /settings/test-storage-preview` accepts provider config in the request body. Instantiates a temporary provider via duck-typed settings adapter (same pattern as Item F email preview). Frontend sends current form values; Test button disabled until required bucket/credential fields are filled.

### J.5 / J.6 / J.7 — Wizard and Settings Panel Personalization
**Wizard**: fetches profile on load. Step 3 (success screen) is now context-aware — shows storage warning if GCS/S3 is active, email dev-mode warning if `EMAIL_PROVIDER_TYPE=console`, and contextual next-step cards instead of a generic paragraph.

**Settings panel** (File Storage tab):
- Env-sourced fields show an `env var` badge and are rendered read-only with a "Set via environment variable" note.
- Provider type shown as a read-only active-provider badge (with "requires redeployment" note) when `STORAGE_PROVIDER_TYPE` is env-sourced.
- Service account JSON field hidden on Cloud Run (`kmsProvider=gcp`) — replaced with "Workload Identity active" note.
- Storage Test button uses `test-storage-preview` with current form values; disabled until required fields are populated.

### J.2 / J.3 — Platform Starter Files
New `deploy/` directory at repo root:

| File | Purpose |
|---|---|
| `deploy/env.reference.md` | Full reference for all AECMS env vars |
| `deploy/railway/env.example` | Railway variable template |
| `deploy/coolify/env.example` | Coolify/VPS variable template |
| `deploy/coolify/docker-compose.production.yml` | Production Compose for Coolify |
| `deploy/cloud-run/env.example` | GitHub Variables + Secrets reference for Cloud Run |

### J.8 — Owner's Manual HTML Site
`docs/owners-manual/` — a self-contained HTML site (no CDN dependencies, works locally):

| File | Content |
|---|---|
| `index.html` | Overview, quick-start paths, what you need |
| `style.css` | Shared styles — sidebar, callouts, step lists, platform cards |
| `ch01-infrastructure.html` | Full guide: hosting, database, storage, email, Redis decisions |
| `ch02-platform-setup/index.html` | Platform comparison with links |
| `ch02-platform-setup/railway.html` | Full Railway setup guide |
| `ch02-platform-setup/coolify.html` | Full Coolify + VPS setup guide |
| `ch02-platform-setup/cloud-run.html` | Full Cloud Run setup guide |
| `ch02-platform-setup/render.html` + `fly.html` | Stub guides with key notes |
| `ch03-aecms-config.html` | Env var config reference, platform file index |
| `ch04-first-launch.html` | Wizard walkthrough, post-wizard checklist |
| `ch05-admin-settings.html` | Settings tab reference |
| `ch06-going-live.html` | Domain mapping per platform, pre-launch checklist |
| `ch07-maintenance.html` | Updates, backups, cost monitoring |

---

## Item K — Next.js Security Upgrade (14.0.4 → 15.3.9) ✅

**Problem**: `next@14.0.4` carried 14 published CVEs (DoS, request smuggling, cache poisoning, XSS). `npm audit` during the CI/CD log review surfaced this. Next.js 16.2.9 was attempted but had an unfixed `/_global-error` prerender bug with Turbopack + React 19 (`useContext null` in `__next_viewport_boundary__`); 15.3.9 was chosen as the stable target.

**Changes**:
- Upgraded `next` from `14.0.4` → `15.3.9`
- `next.config.mjs`: removed deprecated `eslint` block and `webpack()` chunk-split function; added `turbopack: {}` to satisfy Turbopack config requirement
- Root layout: added separate `Viewport` export (required in Next.js 15+; can no longer be part of `Metadata`)
- `app/global-error.tsx`: added full `<head>` (Next.js 15 requirement — global-error replaces root layout)
- Restored `pages/_document.tsx` and `pages/_error.tsx` (still required in Next.js 15 for Pages Router `/404` fallback generation)
- Async params migration in `[...slug]/page.tsx`, `admin/pages/[id]/edit/page.tsx`, `admin/pages/[id]/preview/page.tsx`
- Refactored three `'use client'` page files that failed Next.js 15's static generation prerender worker to server component wrappers:
  - `app/setup/page.tsx` → thin server wrapper; client logic moved to `SetupWizard.tsx`
  - `app/admin/orders/[id]/page.tsx` → server wrapper; logic moved to `AdminOrderDetailClient.tsx`
  - `app/admin/maintenance/migrate-content/page.tsx` → server wrapper rendering client component
- `JSX.IntrinsicElements` → `React.JSX.IntrinsicElements` in `ArticleEmbed.tsx` and `ProductEmbed.tsx` (namespace moved in newer `@types/react`)
- Added `export const dynamic = 'force-dynamic'` to checkout cancel/success pages

**Note**: Next.js 16 upgrade deferred — `16.2.9` has unfixed prerender bug. Plan as separate phase once `16.3.x` stabilizes.

**Files changed**: `frontend/package.json`, `frontend/next.config.mjs`, `frontend/app/layout.tsx`, `frontend/app/global-error.tsx`, `frontend/pages/_document.tsx`, `frontend/pages/_error.tsx`, `frontend/app/(site)/[...slug]/page.tsx`, `frontend/app/admin/pages/[id]/edit/page.tsx`, `frontend/app/admin/pages/[id]/preview/page.tsx`, `frontend/app/setup/page.tsx` + `SetupWizard.tsx` (new), `frontend/app/admin/orders/[id]/page.tsx` + `AdminOrderDetailClient.tsx` (new), `frontend/app/admin/maintenance/migrate-content/page.tsx`, `frontend/components/widgets/ArticleEmbed/ArticleEmbed.tsx`, `frontend/components/widgets/ProductEmbed/ProductEmbed.tsx`, `frontend/app/(site)/checkout/cancel/page.tsx`, `frontend/app/(site)/checkout/success/page.tsx`

---

## Item L — GCS Bucket Permissions for github-ci SA ✅

**Problem**: The H.2-A idempotent bucket creation step in `deploy.yml` was throwing 403 errors silently on every deploy because `github-ci` SA was missing `roles/storage.admin`. Buckets existed for the deploy succeeded, but a new owner's first deploy would fail at bucket creation.

**Changes**:
- Granted `roles/storage.admin` to `github-ci` SA on the the GCP project (immediate live fix)
- Added `roles/storage.admin` to the CI SA role list in `backend/scripts/gcp-setup.sh` so new owners running the setup script get correct permissions automatically

**Files changed**: `backend/scripts/gcp-setup.sh`

---

## Post-J Fixes (2026-06-21)

Three bugs found during live testing of the production deploy:

### Homepage Warning Conditional
The settings panel warning incorrectly appended *"Visitors will be redirected to /articles"* even when `_home_` was published and would catch the fallback. Fixed the conditional in `SettingsClient.tsx` so the redirect message only appears when both the designated page and `_home_` are unpublished.

### KINDLE_FROM_EMAIL Env Var Removed
The Kindle wizard sender address was hardcoded as a build-time env var (`NEXT_PUBLIC_KINDLE_SENDER_EMAIL`), requiring a redeploy to change. Removed the env var entirely. `GET /setup/profile` now returns `kindleFromEmail` (reads `email.kindle_from` → `email.from_address` from ISM). The wizard fetches it at runtime via SWR. Removed the variable from `deploy.yml`, `env.example` files, and the Owner's Manual.

### Sample Content Seed Timing
`seed-sample-content.js` ran at container boot before the wizard, when no owner user existed. After wizard completion, the boot-time guard was already satisfied so content was never seeded. Fixed by moving `seedSampleContent(ownerId)` into `SetupService.completeSetup()` — fires immediately after owner creation, with idempotency guards on each slug.

**Files changed**: `frontend/app/admin/settings/SettingsClient.tsx`, `frontend/components/digital/KindleWizard.tsx`, `backend/src/setup/setup.service.ts`, `.github/workflows/deploy.yml`, `deploy/*/env.example` files, `docs/owners-manual/`

---

## Item M — File Manager (Media Library) ✅

### M.1 — PageMedia Join Table

Added `PageMedia` model to Prisma schema (mirroring `ArticleMedia`/`ProductMedia`): composite PK on `[page_id, media_id]`, cascade delete, `order` and `is_primary` fields. Added reverse relations on `Page` and `Media` models.

**Migration**: `20260621061222_add_page_media_and_media_manage`

### M.2 — MediaSyncService (Shared TipTap Content Extractor)

New service `backend/src/media/media-sync.service.ts`. Single public method: `syncEntityMedia(entityType, entityId, content, explicitMediaIds[])`.

Extracts two TipTap node types:
- `image` nodes: `attrs.src` URL → strips `/uploads/` prefix → resolves to media ID via `media.filename` DB lookup
- `mediaCarousel` nodes: `attrs.media` JSON array → extracts `id` fields directly (already media UUIDs)

Merges explicit gallery IDs (first, with `is_primary` and `order` semantics) with inline-only IDs (appended after). Writes the merged set to `ArticleMedia`, `ProductMedia`, or `PageMedia` in a single delete + createMany.

**Integration**:
- `ArticlesService`: removed `setArticleMedia()` private method; replaced both call sites with `mediaSync.syncEntityMedia('article', ...)`
- `ProductsService`: removed `setProductMedia()` private method; replaced both call sites with `mediaSync.syncEntityMedia('product', ...)`
- `PagesService`: added `mediaSync.syncEntityMedia('page', ...)` after create and update — pages now tracked for the first time
- `MediaModule` exports `MediaSyncService`; `ArticlesModule`, `ProductsModule`, `PagesModule` now import `MediaModule`

### M.3 — BackstageGuard on Media Write Endpoints

Added `BackstageGuard` to `POST /media/upload`, `PATCH /media/:id`, `DELETE /media/:id`. Previously these only checked `JwtAuthGuard + CapabilityGuard`, meaning a customer-session JWT with `media.upload` or `media.delete` could call them.

### M.4 — `media.manage` Capability

Added to capabilities seed (category: `content`, scope: `backstage`). Granted to Admin and Owner. Gates bulk-delete and file-replace endpoints.

### M.5 — New Backend Endpoints

| Endpoint | Capability | Description |
|---|---|---|
| `POST /media/bulk-upload` | `media.upload` | Multi-file + zip extraction. Zip limits: 50 MB per zip, 100 MB total uncompressed, 500 entries, 10 MB per extracted file. Returns `{ succeeded[], failed[] }`. |
| `DELETE /media/bulk` | `media.manage` | Batch delete by ID array. Returns `{ deleted[], failed[] }`. |
| `POST /media/:id/replace` | `media.manage` | Overwrites bytes at same storage key — URL stays stable. Regenerates thumbnail in-place. Audit logged with old/new size and mime type. |
| `GET /media/:id/usage` | `BackstageGuard` | Returns `{ total_uses, articles[], products[], pages[] }` from join tables. No JSON scanning. |
| `GET /digital-products/files/all` | `digital.deliver` | Paginated backstage catalogue of all `DigitalProductFile` rows with product joins. |

`GET /media` extended with `mime_type`, `in_use`, and `sort` query params. Now returns `total_uses` count per item (from join table `_count`).

`adm-zip` added to backend dependencies for zip extraction.

### M.6 — Frontend `/admin/media`

New page at `frontend/app/admin/media/` (server wrapper + `MediaLibraryClient.tsx`). Added **Media** nav item to backstage sidebar (between Pages and Orders; gated on `media.upload`).

**Media Library tab**:
- Thumbnail grid (4–6 columns depending on detail panel state), with in-use green dot badge and hover-reveal checkbox
- Filter bar: search, MIME type (All / Images / PDFs), In Use toggle (All / In Use / Unused), sort (date / name / size)
- Selection mode header with bulk-delete trigger
- Bulk uploader (collapsible): drag-and-drop zone + browse-files button; zip-aware; per-batch `POST /media/bulk-upload`; shows succeeded/failed counts on completion
- Detail panel (slides in from right on card click): full preview, read-only metadata, editable alt text/caption (PATCH on blur), "Used in" section with links to article/product/page edit pages, Download/Replace/Delete actions with in-use warning on single delete
- Bulk delete confirmation modal: lists count of in-use files; two-button confirm

**Digital Files tab**:
- Read-only table of all digital source files with format badge, product name (link to product edit page), storage path (display-only), personalization status badges, upload date
- Informational banner: *"Digital source files are managed from each product's edit page."*
- No file operations — intentional security boundary

### Test results after Item M

| Suite | Count |
|-------|-------|
| Backend unit tests | 190/190 ✅ |
| Frontend unit tests | 125/125 ✅ |

---

## Full Test Results

| Suite | Before Phase 22 | After Items A–M |
|-------|--------|-------|
| Backend unit tests | 190/190 | 190/190 ✅ |
| Frontend unit tests | 125/125 | 125/125 ✅ |

---

## Git Log

```
(Item M — uncommitted, working tree)
f662187 Fix: seed sample content in completeSetup() instead of docker-start.sh boot
fbfc0d3 Phase 22 items K/L: Next.js 15 upgrade changes (modified files)
85ca5e8 Phase 22 items K/L: Next.js 15.3.9 security upgrade + GCS bucket permissions
eb8d731 Fix: remove KINDLE_FROM_EMAIL env var; Kindle wizard reads sender from ISM at runtime
c56a7de Fix: homepage warning incorrectly appended /articles redirect when _home_ is published
527f346 Phase 22: completion report updated, CLAUDE.md status updated to COMPLETE
b7545c8 Phase 22 Item J: new owner experience, platform config helpers, Owner's Manual
bd96d29 Phase 22: completion report, updated CLAUDE.md, plan docs
b86727b Phase 22 items A/B: TipTap version alignment, Node.js 22 upgrade
3ecea7c Phase 22 items G/I: sample content seed, _home_ guard, homepage warning, CSV export
013f777 Phase 22 items C/D/E/F: wizard placeholders, password toggles, capability seed, email test
```

---

## Remaining Items

All planned items are complete. H.2-B (storage test button sends current form values) was implemented as part of J/H.4 and incorrectly marked "Not started" in a prior revision of this report. H.3 (provider type read-only badge) was absorbed into J.7. No outstanding items remain.

---

## Session 2026-06-21 — Post-Phase-22 Additions

These items were completed in the session following Phase 22, after the first live production deployment. They are recorded here rather than as a new phase because they are continuations of Phase 21/22 work rather than a new capability area.

### Seed content bug fixes

Four separate bugs prevented the seeded pages from rendering in the TipTap editor and on the customer-facing site:

1. **Zone format**: Pages require `{ layout, zones: { main: <tiptap-doc> } }` — raw TipTap JSON (`{ type:'doc', content:[] }`) falls back to empty zones in `parsePageContent()`. Both `_home_` and `about-pages` were being created with the wrong format. Fixed: `pageDoc()` helper wraps all page content in zone format.

2. **Empty text nodes**: `{ type:'text', text:'' }` is invalid in TipTap's schema. A document containing one causes TipTap to silently discard the entire document and render nothing. The `p()` helper was emitting these for blank spacer paragraphs. Fixed: `p()` now filters empty runs and emits bare `{ type:'paragraph' }` (no `content` key) for spacers.

3. **Three creation paths**: `setup.service.ts`, `seed.ts` section 5, and `seed-sample-content.js` all created `_home_`. The wizard ran first on the live install and created `_home_` with wrong-format content; the seed script found it existing and skipped. Fixed: wizard no longer creates pages (boot script handles them unconditionally); section 5 in `seed.ts` removed.

4. **CJS/TS dual-file drift**: `prisma/seed-sample-content.ts` (which had the fixes) and `scripts/seed-sample-content.js` (which Docker actually runs) had diverged. Fixed: TS file deleted; JS file is the single source of truth; `seed-all.sh` updated to call the JS file directly.

**Commits**: `064d39b`, `0e1417d`, `4039db1`, `54b738d`, `ab16c02`

### Wizard tutorial content upgrade

The wizard's `seedSampleContent()` had thin one-liner placeholder content for the tutorial article and product. Upgraded to full rich TipTap documents:

- **"About Articles"** (`slug: welcome`): h1, intro paragraph, four h2 sections (What an Article contains, Publishing, Comments and reviews, Version history), bullet lists
- **"About Products"** (`slug: about-products`): h1, intro paragraph, four h2 sections (Product types, Key fields, Digital file delivery, Payments), bullet lists with all three product types described

At the same time, article and product creation was removed from `seed-sample-content.js` — the wizard is the correct place for content that requires an owner ID.

**Commit**: `ccad262`

### Generic distribution — personal identifier purge

After the FvR content migration was complete and confirmed live, all personal and site-specific identifiers were removed from the repo to make AECMS suitable for generic open-source distribution:

**Deleted** (9 items): `FvR_Deployment/`, five FvR seed scripts, `seed-faux-orders.js`, `docs/CLIPBOARD.md` (contained raw DB credentials), `HANDOFF_NOTES.md`

**Sanitized** (37 files): all references to the live site domain, personal email address, personal GitHub username, personal name, GCP project IDs and numbers, Cloud Run deployment URLs, DB password, product brand names — replaced with generic placeholders or made dynamic.

Zero personal identifier matches remain in any tracked source file.

**Commit**: `71d3dc6`

### Live deployment policy

With a live deployment running, a backward-compatibility policy was documented to govern all future `deploy` branch merges. Additive-only migrations, no destructive schema changes in the same deploy as the code that reads them, maintenance windows required for anything that can't comply.

Documented in `CLAUDE.md` (top of file, before phase status) and `docs/DEPLOYMENT.md` (decision table at the top of the guide).

**Commit**: `2354890`

### Dynamic customer-facing branding

**Problem**: The customer-facing `Header.tsx` had `AECMS` hardcoded as the top-left site badge. The `Footer.tsx` had the previous owner's site name and tagline hardcoded.

**Fix**:
- `app/(site)/layout.tsx` upgraded to async Server Component; fetches `site_title` from `GET /settings-public/general` server-side (5-min revalidation), passes to `<Header>` as prop
- `Header.tsx`: renders `siteTitle` prop in the logo position
- `Footer.tsx`: async Server Component; fetches `site_title` and `tagline`; renders owner's brand in the brand column and copyright line; tagline renders conditionally if configured

Any owner who sets their site title via the wizard or Admin → Settings → General immediately sees their own branding on the customer-facing site. Backstage retains "AECMS Admin".

**Commit**: `f31ac9d`

### AECMS donation link in backstage sidebar

Added a small "AECMS is open source — donate ♥" link at the bottom of the backstage sidebar footer, linking to the AECMS GiveSendGo campaign. Styled as dim secondary text (`text-foreground/35`), accent on hover — present on every backstage page but unobtrusive.

**Commit**: `f31ac9d`

---

## Next Steps

- **Phase 24**: Sales tax infrastructure (activation trigger: $1k revenue or Texas Comptroller registration)
- **Next.js 16**: Deferred until `16.3.x` stabilizes (unfixed `/_global-error` prerender bug in `16.2.9`)
