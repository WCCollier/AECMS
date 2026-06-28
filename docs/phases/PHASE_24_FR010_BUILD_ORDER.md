# Phase 24 + FR-010: Combined Build Order

**Covers**: Phase 24A (Sales Tax), Phase 24B (Shipping), FR-010 (PII Encryption at Rest)  
**Status**: 📋 PLANNED  
**Source docs**: [PHASE_24_PLAN.md](./PHASE_24_PLAN.md) · [FR-010-pii-encryption.md](../feature-requests/FR-010-pii-encryption.md)

---

## ⚡ Current owner action required

Steps 1–8 (Phase 24 infrastructure) and FR-010 Deploy 1 (new encrypted columns, dual-write code) are live as of 2026-06-28. The backfill scripts are now ready to run.

### Step A — Set required environment variables

In the Codespaces terminal, export both variables (get `SETTINGS_ENCRYPTION_KEY` from `backend/.env`):

```bash
export DATABASE_URL="postgresql://..."   # your Neon direct URL (not the pooler)
export SETTINGS_ENCRYPTION_KEY="..."     # 64-char hex from backend/.env
```

Confirm the DB connects:

```bash
cd /workspaces/AECMS/backend && node -e "const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query('SELECT 1').then(()=>{console.log('OK');p.end()}).catch(e=>{console.error(e);p.end();})"
```

### Step B — Run all five backfill scripts

Run these one at a time. Each is idempotent — safe to run twice if interrupted.

```bash
# Step 9 — encrypt existing TOTP secrets
node backend/scripts/encrypt-totp-backfill.js

# Step 10 — encrypt existing OAuth tokens (likely 0 rows; run anyway)
node backend/scripts/encrypt-oauth-backfill.js

# Step 11 — encrypt existing order shipping PII
node backend/scripts/encrypt-orders-backfill.js

# Step 12 — encrypt existing user first/last names
node backend/scripts/encrypt-users-names-backfill.js

# Step 13 — hash existing IP addresses (likely 0 rows; run anyway)
node backend/scripts/hash-ip-backfill.js
```

### Step C — Verify the live site

1. **2FA** — log into `/admin/login` with a 2FA-enabled account. TOTP codes must still be accepted.
2. **Display name** — confirm your name appears correctly in the admin sidebar and `/account`.
3. **Orders** — open Admin → Orders and confirm shipping names/addresses still display on existing orders.
4. **Address book** — open `/account` → Addresses, confirm your saved address (if any) still shows.

### Step D — Signal Claude to deploy Deploy 2

When all verifications pass, tell Claude: **"Backfills verified — deploy Deploy 2."**

Claude will then merge commit `bc95ed4` to the deploy branch. That deploy drops all plaintext columns. The site remains live throughout — Deploy 2 is fully backward compatible with the data written by Deploy 1 code.

### Step E — Fill in Shop Config [BROWSER]

After the deploy settles (can be done any time after Step A):

1. Go to Admin → Shop Config
2. Fill in **Legal business name** and **Business address** (used by Stripe Tax for nexus determination)
3. Optionally add EIN and state tax registration number (required before activating tax collection)
4. Save

---

## How to read this document

Each step is labeled with:

- **Who**: `[OWNER]` = you must do this; `[CLAUDE]` = automated from Codespaces terminal
- **Where**: `[CODESPACES]` = terminal only; `[BROWSER]` = requires a browser session; `[NEON]` = requires your saved Neon direct URL
- **Deploy impact**: `[SINGLE DEPLOY]` = one merge to `deploy`; `[DEPLOY 1 OF 2]` / `[DEPLOY 2 OF 2]` = two-pass live-safe sequence; `[NO DEPLOY]` = runs between deploys against the live DB

Live deployment rule: between `[DEPLOY 1 OF 2]` and `[DEPLOY 2 OF 2]`, the live site is running code that writes to both the old column and the new encrypted column simultaneously. Do not skip the gap — the backfill must complete and be verified before Deploy 2 removes the old column.

---

## Build strategy: ship dark, activate when ready

All Phase 24 infrastructure — address book, tax settings UI, Stripe Tax integration, PayPal tax, reporting — is built and deployed unconditionally. Tax collection is gated entirely by a single ISM flag (`tax.enabled`, default `false`). With the flag off, no tax is computed, shown, or charged to any customer. The code is inert.

This means the owner (or any future owner of this codebase) can deploy the full system now and activate tax collection independently whenever their legal situation is settled — different state, different nexus threshold, or after Comptroller registration completes.

Shipping follows the same pattern via `shipping.enabled`.

The address book (Step 3) is useful immediately regardless — saved addresses, prefill at checkout, and address forwarding to processors are all live the moment it deploys.

FR-010 encryption work is entirely independent of both tax and shipping.

---

## Before enabling tax collection (not required to build)

These external actions are required before you set `tax.enabled = true` in Admin Settings. They do not block any code work and can be done at any future point.

### P1 — Register with the Texas Comptroller
**[OWNER] [BROWSER]** — external site, no Codespaces involvement  
Go to [comptroller.texas.gov](https://comptroller.texas.gov) and apply for a Texas Sales and Use Tax permit. Free. Takes a few days to receive the permit number. Save the permit number — it goes into Admin Settings → Tax as the `tax.registration_number` ISM key and appears on customer receipts.

Note: if you relocate before activating tax, re-evaluate which state's registration applies. The `tax.business_state` ISM key controls which jurisdiction Stripe Tax uses for nexus determination — update it before flipping `tax.enabled`.

### P2 — Enable Stripe Tax in the Stripe Dashboard
**[OWNER] [BROWSER]** — Stripe Dashboard, not Codespaces  
1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Navigate to **Tax** in the left sidebar
3. Click **Enable Stripe Tax**
4. Enter your business address. Stripe uses this to determine your nexus and compute local rates automatically.

Required before Stripe Tax will compute rates at checkout. The code works without it — Stripe just won't apply tax even when `tax.enabled = true` until this is configured.

---

## Stream overview

All streams begin immediately. No external triggers required to start building. Tax and shipping activation is controlled by ISM flags after deployment.

```
Step 1: EncryptionService  ────────────────────────────────────────────────────┐
                                                                               │
Stream A — Phase 24 (Shop Config + tax + shipping, all ship dark except Shop Config UI)
  Step 2: Shop Config panel (Part J) — Business Identity, ISM keys, capability ┐│
  Step 3: Product tax codes + Tax section in Shop Config  ───────────────────── ┤│
  Step 4: UserAddress model + address book + checkout flow  ──────────────────── ┤│
  Step 5: Stripe Tax integration  ─────────────────────────────────────────────── ┤│
  Step 6: PayPal tax (flat rate, Option A)  ────────────────────────────────────── ┤│
  Step 7: Tax reporting + receipts  ─────────────────────────────────────────────  ┤│
  Step 8: Shipping rates + product override + cart + checkout  ────────────────────┘│
                                                                                    │
Stream B — FR-010 backfills (begin as soon as Step 1 is deployed)                  │
  Step 9:  totp_secret encryption  (2 deploys)  ────────────────────────────────────┤
  Step 10: OAuth token encryption  (2 deploys)  ────────────────────────────────────┤
  Step 11: Orders shipping PII encryption  (2 deploys)  ────────────────────────────┤
  Step 12: Users name field encryption  (2 deploys)  ──────────────────────────────┤
  Step 13: IP hashing  (2 deploys)  ─────────────────────────────────────────────── ┤
  Step 14: Drop legacy users.shipping_* columns  (1 deploy, after Step 4)  ──────────┘
```

Stream B steps are independent of each other and can interleave with Stream A in any order.

---

## Step 1 — EncryptionService

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**

Create `backend/src/encryption/encryption.service.ts` and `encryption.module.ts`. Wraps the existing `KeyProvider` (same AES-256-GCM, same key source) in a separately importable module. No behavior change, no migration, no data touched. Low-risk deploy.

**Live site impact**: None. Pure infrastructure addition.

**After deploy**: Nothing to verify beyond "app still starts." Unblocks all other streams.

---

## Step 2 — Shop Config panel

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**

- New `shop.configure` capability added to capability definitions and seed script (Owner-only, `scope: 'backstage'`)
- ISM keys seeded with empty defaults: `shop.legal_name`, `shop.ein_enc`, `shop.tax_registration_number`, `shop.address_street`, `shop.address_city`, `shop.address_state`, `shop.address_postal_code`, `shop.address_country`, `shop.shipping_same_as_business` (default `true`), `shop.shipping_street`, `shop.shipping_city`, `shop.shipping_state`, `shop.shipping_postal_code`, `shop.shipping_country`
- New **Shop Config** nav item in the backstage sidebar, gated on `shop.configure`
- Business Identity form: legal name, EIN (masked input, stored as `shop.ein_enc`), state registration number, registered address fields
- Shipping Origin section: "Same as business address" checkbox; when unchecked, separate origin address fields appear; `ShopConfigService.getShippingOrigin()` resolves the correct address transparently for all callers
- Tax and Shipping subsections shown read-only (populated in later steps)
- No migration — all data stored in existing `SiteSettings` table via ISM

**Live site impact**: None. Pure admin UI addition.

**After deploy — [OWNER] [BROWSER]**:  
Log into the live admin → Shop Config. Fill in your legal business name, business address, and shipping origin (or check "same as above"). Leave EIN and registration number until you have them. This data is immediately available to the tax and shipping systems once those steps deploy.

---

## Step 3 — Product tax code field + Tax section in Shop Config

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**

- Migration: add `stripe_tax_code String?` to `Product`
- ISM keys seeded with safe defaults: `tax.enabled = false`, `tax.flat_rate`, `tax.default_stripe_tax_code`
- Tax section added to Shop Config panel: `tax.enabled` toggle, default tax code dropdown, PayPal flat rate field; business state and registration number shown read-only from Business Identity
- Tax Code dropdown added to Product edit form
- All tax logic gated on `tax.enabled` — no customer-facing change while `false`

**Live site impact**: Additive migration only. No customer-facing change.

**After deploy**: No owner action needed yet. Leave `tax.enabled = false`. Configure and activate when P1 and P2 are complete.

---

## Step 4 — UserAddress model + address book + checkout flow

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Requires**: Step 1 deployed (needs `EncryptionService`).

- Migration: create `user_addresses` table with `_enc`-suffixed free-text columns; add `address_id FK` to `orders`; deprecate `users.shipping_*` columns (stop writing; reads still work for historical data)
- `AddressesService`: encrypt on write, decrypt on read using `EncryptionService`
- Account UI: Addresses section in `/account` — active immediately
- Checkout flow: address collection step before processor redirect (both Stripe and PayPal paths) — active immediately, regardless of tax status

**Live site impact**: Additive migration. Existing checkout continues to work. The address collection step is new UX — verify end-to-end after deploy.

**After deploy — [OWNER] [BROWSER]**:  
Test the checkout flow with a test product. Confirm the address collection step appears, an address saves to your account, and the address is visible in `/account`. This is independent of tax — the address book is live and useful now.

---

## Step 5 — Stripe Tax integration

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Requires**: Steps 3 and 4 both deployed.

- `stripe.provider.ts`: add `automatic_tax: { enabled: true }` to checkout session; pass `tax_code` per line item; both conditioned on `tax.enabled`
- Migration: add `tax_amount Int?` and `tax_details Json?` to `orders`
- Webhook: extract and store tax from `checkout.session.completed` when present

**Live site impact**: Additive migration. Tax collection activates only when `tax.enabled = true` and P2 (Stripe Tax Dashboard) is configured. Until then, `automatic_tax` is not passed to Stripe and `tax_amount` stays null on all orders.

**After deploy**: No owner action needed. Stripe Tax will silently do nothing until P2 is done and `tax.enabled` is flipped.

---

## Step 6 — PayPal tax (Option A: flat rate)

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Requires**: Step 4 deployed (needs pre-collected address from checkout flow).

- `paypal.provider.ts`: when `tax.enabled = true`, read shipping state from `UserAddress`; apply `tax.flat_rate` from ISM; set `tax_total` in PayPal order line items
- Digital-only PayPal orders: apply flat rate using the state collected in the checkout flow address step

**Live site impact**: No migration. Fully gated by `tax.enabled`.

**After deploy**: No owner action needed.

---

## Step 7 — Tax reporting + receipts

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Requires**: Steps 5 and 6 deployed.

- Order confirmation email: tax line in breakdown (hidden when `tax_amount` is null)
- Customer order detail page: tax line (same condition)
- Admin: Tax Report panel (date range, totals, state breakdown, CSV export)

**Live site impact**: UI-only. Tax line doesn't appear on orders with null `tax_amount` — no visible change until tax is activated.

**After deploy**: No owner action needed.

---

## Activating tax collection (future owner action)

When P1 and P2 are complete and you are ready to collect tax:

**[OWNER] [BROWSER]** — Backstage → Shop Config:
1. Confirm **Business address** and **state** are filled in under Business Identity
2. Enter your **state tax registration number** (Comptroller permit number from P1)
3. In the Tax section, set **PayPal flat rate** to your state's max rate (e.g. `8.25` for Texas)
4. Set **Default Stripe tax code** if desired
5. Set each product's **Tax Code** via the product edit form
6. Flip `tax.enabled = true`

Tax collection goes live immediately on the next customer purchase. No redeploy needed.

---

## Step 8 — Shipping rates + product override + cart + checkout

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Note**: Slots cleanly after Step 4 since the checkout flow is already being restructured. Avoids touching the checkout flow twice if done in the same window.

- ISM keys seeded: `shipping.enabled = false`, `shipping.tier1_label`, `shipping.tier1_rate`, `shipping.tier2_label`, `shipping.tier2_rate`, `shipping.free_threshold`, `shipping.international_rate`
- Shipping origin resolved via `ShopConfigService.getShippingOrigin()` — reads `shop.address_*` or `shop.shipping_*` depending on `shop.shipping_same_as_business` (configured in Step 2)
- Migration: add `shipping_override Int?` to `Product`; add `shipping_amount Int @default(0)` to `Order`
- Cart API: computed `shipping_total` field; applies `international_rate` when destination country ≠ origin country
- Shipping section added to Shop Config panel (rate fields + `shipping.enabled` toggle)
- Stripe + PayPal providers: shipping line items (gated on `shipping.enabled`)
- Cart UI + order confirmation: shipping line display (hidden when zero)
- Admin orders: `shipping_amount` in detail view + CSV export

**Live site impact**: Additive migration. `shipping.enabled = false` means no customer-facing change.

**Activating shipping (future owner action) — [OWNER] [BROWSER]**:  
Backstage → Shop Config → Shipping. Confirm origin address is correct (set in Step 2). Enter tier labels, rates, and optionally international rate and free threshold. Flip `shipping.enabled = true` when ready. No redeploy needed.

---

## FR-010 Backfill Steps

Each step below is a two-deploy sequence. Between Deploy 1 and Deploy 2 you run a backfill script from the Codespaces terminal against your live Neon DB using the direct URL. The live site remains fully functional throughout.

**General pattern for each**:
- **Deploy 1** — **[CLAUDE] [CODESPACES]**: New `_enc` column added (nullable); code writes to both old and new columns simultaneously
- **Backfill** — **[OWNER] [CODESPACES] [NEON]**: Run script using your saved Neon direct URL; verify row counts; verify live site behavior
- **Deploy 2** — **[CLAUDE] [CODESPACES]**: Old plaintext column dropped; code reads only `_enc` column

Do not rush from Deploy 1 to Deploy 2. Verify the backfill completed and the live site is behaving correctly in between.

---

## Step 9 — totp_secret encryption

**Priority: HIGH — plaintext TOTP secret + guessed password = 2FA bypass**  
**Requires**: Step 1 deployed. Begin immediately after.

**Deploy 1** — **[CLAUDE] [CODESPACES]**:
- Migration: add `totp_secret_enc String?` to `users`
- `AuthService.setupTotp()`: encrypt and write to both `totp_secret` and `totp_secret_enc`
- `AuthService.verifyTotp()` and `verifyTotpSetup()`: read `totp_secret_enc` if non-null, fall back to `totp_secret`

**Backfill** — **[OWNER] [CODESPACES] [NEON]**:
```bash
node backend/scripts/encrypt-totp-backfill.js
```
Encrypts all existing `totp_secret` rows into `totp_secret_enc`. Idempotent — safe to run twice.

**Verify** — **[OWNER] [BROWSER]**:  
Log into the live site with a 2FA-enabled account. Confirm TOTP codes are accepted. Inspect the `users` table — `totp_secret_enc` should be a base64 ciphertext; `totp_secret` should still contain the old base32 value (not yet dropped).

**Deploy 2** — **[CLAUDE] [CODESPACES]**:
- Migration: drop `totp_secret`
- Code: remove fallback; read only `totp_secret_enc`; fix schema comment to reflect reality

---

## Step 10 — OAuth token encryption

**Priority: HIGH — live OAuth tokens are replayable if leaked**  
**Requires**: Step 1 deployed. Independent of Step 9.

**Deploy 1** — **[CLAUDE] [CODESPACES]**:
- Migration: add `access_token_enc String?` and `refresh_token_enc String?` to `oauth_accounts`
- OAuth service: write to both old and new columns

**Backfill** — **[OWNER] [CODESPACES] [NEON]**:
```bash
node backend/scripts/encrypt-oauth-backfill.js
```

**Verify** — **[OWNER] [BROWSER]**:  
Log in via Google OAuth. Confirm it works. Inspect `oauth_accounts` — `_enc` columns should be base64 ciphertexts.

**Deploy 2** — **[CLAUDE] [CODESPACES]**:
- Migration: drop `access_token` and `refresh_token`
- Code: read only `_enc` columns; fix schema comments

---

## Step 11 — Orders shipping PII encryption

**Priority: HIGH — full name + home address per transaction**  
**Requires**: Step 1 deployed. Can run in parallel with Steps 9–10.

Columns encrypted: `customer_name`, `shipping_name`, `shipping_address`, `shipping_city`, `shipping_zip`.  
Columns kept plaintext: `shipping_state`, `shipping_country` (used in tax aggregation queries).

**Deploy 1** — **[CLAUDE] [CODESPACES]**:
- Migration: add `_enc` variants of the five fields to `orders`
- `OrdersService`: write to both sets of columns

**Backfill** — **[OWNER] [CODESPACES] [NEON]**:
```bash
node backend/scripts/encrypt-orders-backfill.js
```
Processes in batches of 500 to avoid long-running transactions.

**Verify** — **[OWNER] [BROWSER]**:  
Check an existing order in Admin → Orders. Confirm shipping name and address still display correctly. Place a new test order and confirm the new record is written encrypted.

**Deploy 2** — **[CLAUDE] [CODESPACES]**:
- Migration: drop the five old plaintext columns
- Code: read only `_enc` columns

---

## Step 12 — Users name field encryption

**Priority: MEDIUM — name + email in the same table is a phishing surface**  
**Requires**: Step 1 deployed.

Columns: `first_name` → `first_name_enc`, `last_name` → `last_name_enc`.  
`email` stays plaintext (login key, unique index — cannot be encrypted).

**Deploy 1** — **[CLAUDE] [CODESPACES]**:
- Migration: add `first_name_enc String?` and `last_name_enc String?` to `users`
- `UsersService` / `AuthService`: write to both columns

**Backfill** — **[OWNER] [CODESPACES] [NEON]**:
```bash
node backend/scripts/encrypt-users-names-backfill.js
```

**Verify** — **[OWNER] [BROWSER]**:  
Log in to the live site. Confirm your display name appears correctly in the account page and admin sidebar.

**Deploy 2** — **[CLAUDE] [CODESPACES]**:
- Migration: drop `first_name` and `last_name`
- Code: read only `_enc` columns

---

## Step 13 — IP address hashing

**Priority: LOW — reveals location history; not directly exploitable**  
**Requires**: Step 1 deployed. Do last — lowest risk.

Strategy: hash rather than encrypt (one-way SHA-256). IP addresses need no decryption — they are only used for anomaly detection (compare hash of incoming IP to stored hash).

Columns: `users.last_login_ip` → `last_login_ip_hash`; `refresh_tokens.ip_address` → `ip_address_hash`.

**Deploy 1** — **[CLAUDE] [CODESPACES]**:
- Migration: add `last_login_ip_hash String?` to `users`; add `ip_address_hash String?` to `refresh_tokens`
- Code: compute `SHA-256(ip)` and write to both old and new columns

**Backfill** — **[OWNER] [CODESPACES] [NEON]**:
```bash
node backend/scripts/hash-ip-backfill.js
```

**Deploy 2** — **[CLAUDE] [CODESPACES]**:
- Migration: drop `last_login_ip` and `ip_address`
- Code: store and compare only hashes; display as `[hashed]` in audit logs

---

## Step 14 — Drop legacy users.shipping_* columns

**[CLAUDE] [CODESPACES] [SINGLE DEPLOY]**  
**Requires**: Step 4 (UserAddress) live for at least one deploy cycle and verified working.

Step 4 stops writing to `users.shipping_street/city/state/postal_code/country` but leaves them for historical reads. Drop them once `UserAddress` is confirmed as the live source of truth.

**Deploy** — **[CLAUDE] [CODESPACES]**:
- Migration: drop the five columns
- Code: remove any remaining reads of these columns

**Before deploying**: confirm no admin or account UI still reads the old columns.

---

## Complete sequence at a glance

| Step | What | Deploys | Who | Needs Neon URL | Needs browser |
|------|------|---------|-----|:--------------:|:-------------:|
| 1 | EncryptionService | 1 | CLAUDE | — | — |
| 2 | Shop Config panel (Business Identity, ISM keys, capability) | 1 | CLAUDE | — | ✅ fill in business info |
| 3 | Product tax codes + Tax section in Shop Config | 1 | CLAUDE | — | — |
| 4 | UserAddress + address book + checkout flow | 1 | CLAUDE | — | ✅ verify checkout UX |
| 5 | Stripe Tax integration | 1 | CLAUDE | — | — |
| 6 | PayPal flat-rate tax | 1 | CLAUDE | — | — |
| 7 | Tax reporting + receipts | 1 | CLAUDE | — | — |
| 8 | Shipping rates + product override + cart + checkout | 1 | CLAUDE | — | — |
| 9 | totp_secret encryption | **2** | CLAUDE + OWNER | ✅ backfill | ✅ verify 2FA |
| 10 | OAuth token encryption | **2** | CLAUDE + OWNER | ✅ backfill | ✅ verify OAuth login |
| 11 | Orders shipping PII | **2** | CLAUDE + OWNER | ✅ backfill | ✅ verify order display |
| 12 | Users name fields | **2** | CLAUDE + OWNER | ✅ backfill | ✅ verify display name |
| 13 | IP hashing | **2** | CLAUDE + OWNER | ✅ backfill | — |
| 14 | Drop legacy shipping_* on users | 1 | CLAUDE | — | — |
| P1 | State tax authority registration | 0 | OWNER | — | ✅ external site |
| P2 | Enable Stripe Tax in Dashboard | 0 | OWNER | — | ✅ Stripe Dashboard |
| — | Activate tax (Shop Config → flip tax.enabled) | 0 | OWNER | — | ✅ Shop Config |
| — | Activate shipping (Shop Config → flip shipping.enabled) | 0 | OWNER | — | ✅ Shop Config |

**Total deploys**: 16 (8 single-pass + 5 two-pass pairs + 1 cleanup)  
**Owner-only actions**: Fill in Shop Config after Step 2; backfill run + verification for Steps 9–13; tax and shipping activation (when ready); P1 and P2 (before activating tax, not before building)  
**Assets beyond Codespaces terminal**: Neon direct URL (Steps 9–13 backfills); browser for Shop Config setup, live site verification, and activation steps
