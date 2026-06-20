# Phase 22: Dependency Upgrades & Live-Testing Fixes

**Project**: AECMS  
**Phase**: 22  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 21 (first live deployment complete)

---

## Goal

Accumulate and resolve small technical debt items discovered during live testing — version mismatches, deprecated dependencies, minor runtime issues — that are too small to warrant their own phase but important enough to track and eventually ship together.

---

## Item A — TipTap Dependency Version Alignment

**Priority**: Medium  
**Discovered**: 2026-06-19, during CI/CD pipeline work (Phase 21)

### Problem

`@tiptap/extension-text-align` is at `3.25.0` while `@tiptap/starter-kit` is at `3.18.0`. These are from different TipTap release generations. `npm ci` in strict mode rejects this as an unresolved peer dependency.

**Current workaround**: `frontend/.npmrc` sets `legacy-peer-deps=true`, which silences the conflict at install time. The app runs, tests pass, and no runtime breakage has been observed — but the underlying mismatch is real.

### Risk

If any of the custom TipTap nodes rely on an API that changed between 3.18 and 3.25, they could break silently. The gap may also widen as future packages pull in newer TipTap deps.

### Fix

1. Audit current `@tiptap/*` versions in `frontend/package.json`
2. Upgrade all `@tiptap/*` packages to a consistent version (latest 3.x)
3. Manually test all custom nodes in both the article editor and the page builder:
   - MediaCarousel
   - Callout
   - VideoEmbed
   - XEmbed
   - RssEmbed
   - ArticleEmbed
   - ProductEmbed
   - RichTextBox
   - Link insertion modal
4. Run full frontend test suite: `npm test`
5. Remove `legacy-peer-deps=true` from `frontend/.npmrc` once resolved

---

## Item B — Node.js 20 Deprecation Warning in GitHub Actions

**Priority**: Low  
**Discovered**: 2026-06-19, GitHub Actions runner logs

### Problem

Every CI run logs:
```
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4, google-github-actions/auth@v2, google-github-actions/setup-gcloud@v2
```

This is a warning, not a failure, but it will eventually become an error when GitHub drops Node 20 support on runners.

### Fix

Update `.github/workflows/deploy.yml` action versions to Node 24-compatible releases when they become stable:
- `actions/checkout@v4` → `@v5` (when available)
- `actions/setup-node@v4` → `@v5` (when available)
- `google-github-actions/auth@v2` → newer version
- `google-github-actions/setup-gcloud@v2` → newer version

Check https://github.com/actions for current stable versions before upgrading.

---

## Item C — Setup Wizard Placeholder Text Contains Real Personal Info

**Priority**: Medium  
**Discovered**: 2026-06-19, first live run of setup wizard

### Problem

The setup wizard's first slide (site name, tagline, first/last name fields) shows example/placeholder text prefilled with real data from the testbed: "Fantasy v Reality" as the site name and "William Collier" as the owner name. If this project is ever open-sourced, reused, or demoed to a third party, that personal info will be visible to anyone who opens the wizard.

### Fix

Replace the placeholder text in the setup wizard's first slide with generic fictional examples:
- Site name: e.g. `My Awesome Site`
- Tagline: e.g. `Welcome to my corner of the internet`
- First name: e.g. `Jane`
- Last name: e.g. `Smith`

Find and update the relevant component in `frontend/app/` (likely the setup wizard step 1 component).

---

## Item D — Password Fields Missing Show/Hide Toggle and Live Match Validation

**Priority**: Medium  
**Discovered**: 2026-06-19, setup wizard owner account screen  
**Scope confirmed**: 2026-06-20 — 11 password fields across 6 files site-wide

### Problem

No password field anywhere on the site has a visibility toggle. Users entering a password in a form have no way to confirm what they typed without submitting. Live match feedback (for confirm-password pairs) is also absent everywhere.

### Full inventory of password fields

| File | Fields | Notes |
|------|--------|-------|
| `app/setup/page.tsx` | password, confirm password | Setup wizard owner account creation |
| `app/admin/login/AdminLoginClient.tsx` | password | Backstage login |
| `app/auth/login/LoginPageClient.tsx` | password | Customer-facing login |
| `app/auth/register/RegisterPageClient.tsx` | password, confirm password | Customer registration |
| `components/layout/Header.tsx` | password | Inline login form in site header dropdown |
| `app/(site)/account/AccountPageClient.tsx` | current password, new password, confirm new password, password (delete-account confirmation) | Account → Change Password; Account → Delete Account |

### Fix

**Step 1 — Create a shared `PasswordInput` component**

Add `frontend/components/ui/PasswordInput.tsx`. It wraps the existing `Input` component and maintains a local `visible` boolean:

- When `visible = false`: renders `type="password"` (default)
- When `visible = true`: renders `type="text"`
- Renders an eyeball icon button (SVG, no extra dependency) absolutely positioned at the right edge of the field. The icon switches between eye-open and eye-slash. Button is `type="button"` with `aria-label="Show password"` / `"Hide password"` and `tabIndex={-1}` so tab focus goes to the next real field.
- Accepts all props that `Input` accepts, plus an optional `showToggle` prop (defaults to `true`) to allow disabling the toggle for specific contexts if ever needed.

**Step 2 — Replace `Input type="password"` with `PasswordInput` across all 6 files**

Each of the 11 fields listed above becomes a `PasswordInput`. No logic changes required — just import swap and prop passthrough.

**Step 3 — Add live match validation to confirm-password fields**

There are three confirm-password fields: setup wizard, registration, and Account → Change Password. For each:
- Track the primary password and confirm-password values in the existing form state (already tracked for submission)
- When the confirm field has been touched (blurred at least once or has a non-empty value) and does not match the primary: show a red border + small inline message below — *"Passwords do not match"*
- When they match: show neutral/green indicator or no message
- Do not block form submission on mismatch — validation on submit already catches it; this is live UX feedback only
- The delete-account password field and all login fields have no pair, so no match logic applies there

### Note on philosophy

The primary motivation for `type="password"` masking is shared/public terminals. For a personal CMS where the owner is the primary backstage user typing on their own device, the masking is a minor annoyance with no meaningful security benefit. The toggle lets the user make their own call, which is the right default for this product.

---

## Item E — Production Deployment Does Not Run Capability Seed

**Priority**: High  
**Discovered**: 2026-06-19, first live deployment

### Problem

`prisma migrate deploy` (run on every container start) applies schema migrations but does not run seeds. The `capabilities` and `role_capabilities` tables were empty after first deploy, so all sidebar items gated on capabilities were invisible — even for the Owner account.

Fixed manually for the current deployment by running `seed.ts` with `SEED_PROFILE=minimal` directly against the production DB via Cloud SQL proxy.

### Fix

The container CMD should run the minimal seed after migrations on first boot (i.e. when the capabilities table is empty). Options:

**Option A (preferred):** Add a seed guard to the startup command — check if capabilities exist, and if not, run the minimal seed:
```dockerfile
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main"]
```
Replace with a startup script that conditionally seeds:
```sh
#!/bin/sh
node_modules/.bin/prisma migrate deploy
# Seed only if capabilities table is empty (idempotent guard)
CAPS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.capability.count().then(n => { console.log(n); p.\$disconnect(); });
")
if [ "$CAPS" = "0" ]; then
  echo 'Seeding capabilities...'
  node_modules/.bin/ts-node prisma/seed.ts
fi
exec node dist/src/main
```

**Option B (simpler):** Make `prisma migrate deploy` always followed by `prisma db seed` with `SEED_PROFILE=minimal`. Since all seed operations use `upsert`, this is idempotent and safe to run on every startup — just slightly slower cold start.

---

## Item F — Email Settings: Test Button Should Use Live Form Values

**Priority**: Medium  
**Discovered**: 2026-06-19, first live configuration of email settings

### Problem

The "Send Test Email" button is always enabled, even before the user has entered or saved any configuration. A user naturally tries to test immediately after filling in the fields — but the button currently tests whatever is *saved* in the backend, not what is typed in the form. This caused confusion: test appeared to do nothing (or fail) until settings were saved first.

### Desired Flow

1. User fills in all required email fields (host, port, user, password, from address)
2. The Test button becomes active as soon as all fields have values
3. Clicking Test sends the *current form values* to the backend for a live test — without requiring a save first
4. If the test passes, the user can then save; if it fails, they can adjust and re-test

### Fix

**Backend**: Add a `POST /settings/test-email-preview` endpoint (or extend the existing one) that accepts email config as request body instead of reading from the DB.

**Frontend** (`SettingsClient.tsx`, Email tab):
- Disable the Test button until all required fields (smtp_host, smtp_port, smtp_user, smtp_password, smtp_from) are non-empty
- When Test is clicked, POST the current form values to the preview endpoint rather than the saved-config endpoint
- Add a short helper text below the button, e.g.: *"Test uses the values currently entered above. Save after a successful test."*

---

## Item G — Setup Wizard Should Seed Sample Draft Content

**Priority**: Medium  
**Discovered**: 2026-06-19, first live run of setup wizard

### Problem

After completing the setup wizard, the owner lands in a completely empty backstage — no pages, no articles, no products. There is no in-app guidance explaining how each content type works, what fields it has, or how it fits into the site. A new install should feel welcoming and self-explanatory, not blank.

### Desired Behavior

After the wizard completes (or as part of the minimal seed), the system creates the following draft content items:

#### Pages (2 items)

| Slug | Title | Content | Deletable? |
|------|-------|---------|------------|
| `_home_` | "Home" | Blank starter page with a single placeholder heading ("Your homepage goes here") and a brief note directing the owner to publish this page and switch Homepage Mode to "Page" in General Settings when ready. | **No** — `_home_` is the system's last-resort homepage fallback; see G.1 below. |
| `about-pages` | "About Pages" | Explains what pages are (widget-composed layout vs rich-text body), how the page hierarchy and parent/child relationships work, how the catch-all `[...slug]` routing resolves URLs, and how to connect pages to the nav menu. **Specifically covers the homepage waterfall** (see content note below). |

**Content note for `about-pages` — homepage waterfall section:**

The page should explain, in plain language, the three-level homepage resolution the system uses when Homepage Mode is set to "Page" in General Settings:

1. The owner designates a specific Page as the homepage. That page is served at `/` and is also accessible at its own slug URL (e.g. `/my-landing-page`).
2. If that designated page is unpublished, deleted, or missing, the system falls back to the page with the reserved slug `_home_`. Publish that page and it silently catches the gap.
3. If `_home_` is also missing or unpublished, the site redirects `/` to `/articles` — so the site always has a working root, but the owner may be surprised by the redirect.

The takeaway for the owner: keep `_home_` published as a safety net, even if a different page is their real homepage.

#### Article (1 item)

| Slug | Title | Content |
|------|-------|---------|
| `welcome` | "About Articles" | Explains what articles are, which fields they have (title, body, categories, tags, featured image, status), how the comment and review system works, and how to publish. |

#### Product (1 item)

| Title | Content |
|-------|---------|
| "About Products" | Explains the three product types (physical, digital, service); describes SKU, price, compare-at price, stock management, digital file upload, and the Stripe/PayPal checkout path. |

All items are created with `status: draft` — never visible to site visitors. The owner can edit, publish, or delete them freely (except the `_home_` page; see G.1).

### G.1 — Backend deletion guard is missing for `_home_`

The frontend hides the Delete button for any page with `slug === '_home_'` (`AdminPagesClient.tsx` line 143), but the backend has no equivalent guard. A direct `DELETE /pages/:id` API call bypasses the UI entirely and will delete the page.

**Fix:** Add a guard in `pages.service.ts` `remove()`, before the permission check, that throws `ForbiddenException('The system homepage page cannot be deleted.')` when `page.slug === '_home_'`.

### G.2 — No backstage warning when "Page" mode has no published homepage

If the owner sets Homepage Mode to `static_page` but hasn't published any page as their homepage (no `homepage_page_id` set and `_home_` is also draft/absent), visiting `/` silently falls back to `/articles`. There is no backstage indicator that the configured mode is effectively inactive.

**Fix:** In the General Settings tab of Admin Settings, when `homepage_mode === 'static_page'`, show an inline warning if the selected page ID is empty or if the `_home_` page doesn't exist/isn't published — e.g. *"No published homepage page found. Visitors will be redirected to /articles until one is published."*

### Fix (overall)

1. Correct the `_home_` slug in this plan (it has underscores, not bare `home`) — **done above**.
2. Write sample content (rich TipTap JSON) for each item — concise, practical, plain language.
3. Add the creation logic to the minimal seed (`prisma/seed.ts` or a dedicated `seed-sample-content.ts`) running under `SEED_PROFILE=minimal` (the production boot guard from Item E).
4. Guard each item with a slug/title existence check so re-running the seed on an existing install does not overwrite owner edits.
5. Assign ownership to the first user with `role = 'owner'`.
6. Implement the backend deletion guard (G.1).
7. Implement the backstage warning (G.2).

---

## Item H — File Storage Tab: Reflect Active Config, Lock Pre-Install Decisions, Fix Test Flow

**Priority**: Medium  
**Discovered**: 2026-06-19, first live configuration of GCS storage

### H.1 — Tab shows blanks even when storage is actively configured via env vars

`SettingsService.getAll()` reads only from the database. It does not merge the env var fallbacks that `getEffective()` uses at runtime. As a result, the File Storage tab shows blank fields even when bucket names and provider type are actively in use via environment variables — the app is correctly writing to GCS, but the tab looks unconfigured.

This creates a specific trap: an owner who set bucket names as Cloud Run env vars opens the tab, sees blanks, and either re-enters the values (duplicating them into ISM) or assumes something is broken.

**Fix (backend)**: Update `getAll()` in `settings.service.ts` to merge env var fallbacks for any key not present in the DB — the same DB-over-env logic that `getEffective()` already applies per-key. Return a source flag alongside each value (`"db"` or `"env"`) so the frontend can distinguish them.

**Fix (frontend)**: Render env-var-sourced values as read-only with a small indicator label — e.g. *"Set via environment variable. Enter a value here to override."* When the owner saves a value over an env-sourced one, it is written to ISM and the indicator disappears. This pattern applies to all settings tabs, not just File Storage.

### H.2 — Bucket creation is a manual prerequisite with no automation or documentation

The GCS buckets `fantasyvreality-media` and `fantasyvreality-digital` were created manually via `gcloud storage buckets create` during the Phase 21 setup session. They are not created by the GitHub Actions workflow, the Docker build, the setup wizard, or any install script. `STORAGE_PROVIDER_TYPE=gcs` is hardcoded in the workflow, so any fresh deployment to a new GCP project would start the GCS provider but fail silently on the first file operation because the buckets don't exist.

**Fix options to evaluate in Phase 22:**

- **Option A (preferred for Cloud Run path)**: Add an idempotent bucket-creation step to the GitHub Actions workflow, after the GCP auth step and before the backend deploy. `gcloud storage buckets create` returns a benign error if the bucket already exists, or use `--if-not-exists` when available. Also apply the `allUsers` objectViewer binding for the media bucket in the same step.
- **Option B**: Provide a `scripts/setup-gcs.sh` helper that the owner runs once before first deploy. Document it prominently in DEPLOYMENT.md.
- **Option C**: The setup wizard detects `STORAGE_PROVIDER_TYPE=gcs` and includes a storage validation step that calls `POST /settings/test-storage` and surfaces a clear error if the buckets are missing, with inline instructions.

Options A and C are not mutually exclusive and together give the best experience.

### H.3 — Pre-install decisions should be reflected and locked in the UI

Certain storage properties are established before the app ever starts and should not be freely editable at runtime without consequences:

- **Provider type** (`STORAGE_PROVIDER_TYPE`) is selected at container startup — changing it in the UI has no effect until the container restarts with the new env var. The tab should make this clear, ideally marking the field as *"requires redeployment to change"* and showing the currently active provider (from the running process, not ISM).
- **Bucket names** — once files are stored in a bucket, renaming it here without migrating the data would break all existing media URLs and digital download links. A change to bucket names should surface a prominent warning: *"Changing this after files have been uploaded will break existing media. Migrate your files first."*
- **Credentials JSON** (GCS) and **secret access key** (S3) — these are encrypted at rest in ISM. On Cloud Run with Workload Identity, the credentials field should be blank and marked *"Not required — Cloud Run service account is used automatically."*

### H.4 — Test button tests saved config, not current form values

Same issue as Item F (email). Clicking Test Storage tests whatever bucket names and credentials are saved in ISM, not what is currently typed in the form fields. An owner who changes a bucket name and clicks Test before saving will get a result that has nothing to do with what they typed.

**Desired flow**: The Test button sends the current form values directly to the backend for a live round-trip test. It becomes active as soon as all required fields for the selected provider are non-empty. A successful test unlocks the Save button (or at minimum adds a visual confirmation). Helper text below the button: *"Test uses the values currently entered above. Save after a successful test."*

**Fix (backend)**: Extend `POST /settings/test-storage` (or add `POST /settings/test-storage-preview`) to accept provider config as request body and instantiate a temporary provider for the test rather than using the module-injected singleton.

**Fix (frontend)**: Disable Test until required fields are populated. Pass current form values in the POST body. Mirror the same pattern used for the email fix in Item F.

### Install scenario design note

Before implementing H.1–H.4, settle the question of which install paths this tab is designed for:

**Scenario A — Local / single-server (Docker Compose on a VPS)**: Uses `local` storage. The owner never visits this tab. No buckets, no credentials, no configuration needed. This is the default and likely the majority case.

**Scenario B — Cloud Run + GCS**: Buckets are provisioned as part of infrastructure setup (via workflow, script, or Terraform). Provider type and bucket names arrive as Cloud Run env vars; the app uses them immediately. The tab is a read-only confirmation surface, and ISM overrides are only needed if the owner wants to rotate credentials or switch buckets without redeploying. H.1 fixes the blank-field confusion; H.3 adds the lock indicators.

**Scenario C — Any cloud host, no env vars, config via tab only**: The owner creates buckets externally and enters names here. This is the only scenario where the tab is a first-class configuration surface. It requires inline guidance: naming suggestions, permission checklists, links to provider docs. Currently unsupported as a first-class path.

**Likely resolution**: Scenario A is the zero-config default. Scenario B is the cloud upgrade path — automate bucket creation in the workflow (H.2 Option A) so it becomes as close to zero-config as Scenario A. Scenario C is a documented power-user escape hatch. The setup wizard and DEPLOYMENT.md should state this clearly.

---

## Item I — Transaction CSV Export for Accounting

**Priority**: Medium  
**Requested**: 2026-06-20

### Goal

Add a backstage tool to the Admin Orders panel that lets the administrator download a CSV of all transactions (sales, refunds, cancellations) over a selectable date range. The CSV must be suitable for ingestion by accounting software (QuickBooks, Wave, etc.) and AI-assisted bookkeeping tools.

---

### Current data — what is available

The `Order` model tracks sufficient header data: `order_number`, `email`, `customer_name`, `status`, `payment_method`, `payment_intent_id`, `subtotal`, `tax`, `shipping`, `total`, `paid_at`, `created_at`. The `OrderItem` model records quantity and price-at-purchase.

**Two schema gaps** must be closed before the export is useful for accounting:

#### Gap 1 — `OrderItem` stores `product_id` but not the product title

A product can be renamed or soft-deleted after purchase. A CSV produced today against old orders would show a UUID, not a product name. Accounting software and humans both need the name.

**Fix**: Add a `product_title String` snapshot field to `OrderItem`, populated at the time the order is created in `OrdersService.createFromCart()` (alongside the existing `price` snapshot). This is a non-destructive schema addition; existing rows get a migration-applied default (empty string or the current product title via a one-time backfill query).

Migration: `add_order_item_product_title`

#### Gap 2 — Refund details live in `AuditLog`, not on `Order`

When a refund is processed, `payments.service.ts` sets `order.status = 'refunded'` but does not record the refund timestamp, amount, or gateway refund ID on the order row. These details are written only to `AuditLog` (`event_type: 'order.refund_initiated'`). Accounting software needs a proper credit line, not just a status flag. Partial refunds (future capability) are especially important to distinguish from full refunds.

**Fix**: Add three nullable fields to the `Order` model:
```prisma
refunded_at     DateTime?
refund_amount   Decimal?  @db.Decimal(10, 2)  // null = full order total
refund_id       String?   // gateway refund reference
```

Update `payments.service.ts` `refund()` to populate all three fields when the refund is confirmed (alongside the existing status update). Existing refunded orders will have `refunded_at = null` — the export falls back to `updated_at` when `refunded_at` is null, with a note in the CSV row.

Migration: `add_order_refund_fields`

---

### CSV format

Each row in the output represents one transaction event. A refunded order produces **two rows**: the original sale row and a refund row (negative amounts) so accounting software can match them.

| Column | Source |
|--------|--------|
| `date` | `paid_at` for sales; `refunded_at` (or `updated_at`) for refunds |
| `type` | `sale`, `refund`, `cancelled` |
| `order_number` | `order.order_number` |
| `customer_email` | `order.email` |
| `customer_name` | `order.customer_name` |
| `payment_method` | `order.payment_method` (`stripe`, `paypal`) |
| `payment_reference` | `order.payment_intent_id` or `order.refund_id` |
| `items` | Semicolon-delimited: `"Product A × 2; Product B × 1"` using snapshot title |
| `subtotal` | `order.subtotal` (negative for refund rows) |
| `tax` | `order.tax` (negative for refund rows) |
| `shipping` | `order.shipping` (negative for refund rows) |
| `total` | `order.total` (negative for refund rows); for partial refunds, `refund_amount` |
| `status` | `order.status` at time of export |
| `notes` | e.g. `"refunded_at unavailable — using updated_at"` for pre-fix refunds |

---

### Backend

**New endpoint**: `GET /orders/export`  
- Protected by `BackstageGuard` + `CapabilityGuard` (`orders.manage` or a new `orders.export` capability — decide at implementation time; `orders.manage` is simplest)  
- Query params: `from` (ISO date, inclusive) and `to` (ISO date, inclusive, defaults to today)  
- Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="transactions-{from}-{to}.csv"`  
- Body: raw CSV string

**Query logic:**
1. `findMany` orders where `created_at` is within the date range AND `status != 'pending'` (pending orders that never converted are not accounting events)
2. Include `items` relation; use `item.product_title` snapshot (with `item.product_id` as fallback for rows pre-dating the migration)
3. For each order: emit a sale row; if `status === 'refunded'`, also emit a refund row

**Implementation location**: `OrdersController` + `OrdersService.exportCsv(from, to)`. Return a plain string; the controller sets response headers directly using `@Res()`.

---

### Frontend

**Location**: Admin Orders panel header bar (alongside the existing filter controls)

**UI**: An "Export CSV" button that opens a compact date-range popover:
- **From**: date picker, defaults to first day of the current calendar month
- **To**: date picker, defaults to today
- A "Download" button that fires `GET /orders/export?from=…&to=…` and triggers a browser download

The date range controls should allow the user to select any past date so they can pull the full transaction history in one shot (e.g. set From to `2000-01-01`).

**Implementation**: Use `adminApi` for the request. Trigger the browser download by creating a temporary `<a>` element with `href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }))` and clicking it programmatically, then revoking the object URL. No new page or route needed.

---

### Implementation order within Item I

1. Schema migrations: `OrderItem.product_title` + `Order.refund_*` fields + optional backfill
2. Update `OrdersService.createFromCart()` to populate `product_title` snapshot
3. Update `PaymentsService.refund()` to populate `refunded_at`, `refund_amount`, `refund_id`
4. Add `OrdersService.exportCsv(from, to)` + `GET /orders/export` endpoint
5. Frontend date-range picker + download trigger in Admin Orders panel

---

## Adding New Items

As live testing surfaces additional new issues, append them here as **Item J**, **Item K**, etc. following the same format:
- Problem description
- Risk / urgency
- Concrete fix steps
