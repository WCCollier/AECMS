# Phase 22 Completion Report: Dependency Upgrades & Live-Testing Fixes

**Project**: AECMS  
**Phase**: 22  
**Status**: ✅ COMPLETE  
**Completed**: 2026-06-20  
**Commits**: 3 (`013f777`, `3ecea7c`, `b86727b`)

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

**Problem**: The wizard's first step (Site Identity) showed real personal information in placeholder text: "Fantasy v Reality" as site name, "Ideas worth fighting for" as tagline, "William" / "Collier" as first/last name.

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
Replaced 7 hardcoded FvR-specific values with GitHub Variables (`vars.GCP_PROJECT_NUMBER`, `vars.GCP_PROJECT_ID`, `vars.APP_DOMAIN`, `vars.GCS_MEDIA_BUCKET`, `vars.GCS_DIGITAL_BUCKET`, `vars.SETTINGS_KMS_SECRET_ID`, `vars.KINDLE_FROM_EMAIL`). New owners set these 7 values in GitHub repo Settings → Variables; no file editing required. Also added `GCS_BUCKET_MEDIA` and `GCS_BUCKET_DIGITAL` to backend `set-env-vars` so the `getAll()` env fallback populates File Storage tab correctly on Cloud Run.

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

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| Backend unit tests | 190/190 | 190/190 ✅ |
| Frontend unit tests | 125/125 | 125/125 ✅ |

---

## Git Log

```
b7545c8 Phase 22 Item J: new owner experience, platform config helpers, Owner's Manual
b86727b Phase 22 items A/B: TipTap version alignment, Node.js 22 upgrade
3ecea7c Phase 22 items G/I: sample content seed, _home_ guard, homepage warning, CSV export
013f777 Phase 22 items C/D/E/F: wizard placeholders, password toggles, capability seed, email test
```

---

## Next Steps

- **Deploy**: Merge `main → deploy` and push to trigger the GitHub Actions pipeline (update GitHub Variables first: GCP_PROJECT_NUMBER, GCP_PROJECT_ID, APP_DOMAIN, GCS_MEDIA_BUCKET, GCS_DIGITAL_BUCKET, SETTINGS_KMS_SECRET_ID, KINDLE_FROM_EMAIL)
- **Phase 21 remaining**: FvR content migration (`seed-fvr.ts` against production DB via Cloud SQL proxy) + Phase 21 completion report
- **Phase 23**: Owner knows what goes here
- **Phase 24**: Sales tax infrastructure (activation trigger: $1k revenue or Texas Comptroller registration)
