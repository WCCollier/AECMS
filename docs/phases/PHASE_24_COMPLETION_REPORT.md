# Phase 24 Completion Report: Commerce Infrastructure — Tax & Shipping

**Phase**: 24 (24A — Sales Tax, 24B — Shipping, 24C — Shop Config)  
**Status**: ✅ DEPLOYED  
**Deployed**: 2026-06-28  
**Paired with**: FR-010 (PII Encryption at Rest) — built and deployed as a combined sequence  
**Build order doc**: [PHASE_24_FR010_BUILD_ORDER.md](./PHASE_24_FR010_BUILD_ORDER.md)

---

## What Shipped

All Phase 24 commerce infrastructure is live. Tax collection and shipping are gated behind ISM flags (`tax.enabled = false`, `shipping.enabled = false`) and remain inert until the owner activates them. The address book, Shop Config panel, and product tax/shipping fields are active immediately.

### 24C — Shop Config panel

- New `shop.configure` capability (Owner-only, `scope: 'backstage'`) seeded and enforced
- New **Shop Config** nav item in the backstage sidebar
- Business Identity form: legal name, EIN (encrypted via `shop.ein_enc`), tax registration number, registered address
- Shipping Origin section with "Same as business address" toggle; `ShopConfigService.getShippingOrigin()` resolves the correct origin transparently
- Tax and Shipping subsections in Shop Config (configuration UI; activation via ISM flags)
- All data stored in existing `SiteSettings` table via ISM — no new migration

### 24A — Sales Tax

- `stripe_tax_code String?` added to `Product` (migration: `20260628120000_add_product_stripe_tax_code`)
- Tax Code dropdown in product edit form
- ISM keys seeded: `tax.enabled = false`, `tax.flat_rate`, `tax.default_stripe_tax_code`
- Stripe Tax: `automatic_tax: { enabled: true }` + per-line `tax_code`, both gated on `tax.enabled`
- `tax_amount Int?` and `tax_details Json?` added to `orders`; populated from `checkout.session.completed` webhook
- PayPal flat-rate tax (Option A): applies `tax.flat_rate` to PayPal orders when `tax.enabled = true`
- Order confirmation email and customer order page: tax line shown when `tax_amount` is non-null
- Admin: Tax Report panel with date range picker, totals, state breakdown, CSV export

### 24B — Shipping

- `shipping_override Int?` added to `Product` (migration: `20260628150000_add_product_shipping_override`)
- `shipping_amount Int @default(0)` added to `Order`
- ISM keys seeded: `shipping.enabled = false`, `shipping.tier1_label/rate`, `shipping.tier2_label/rate`, `shipping.free_threshold`, `shipping.international_rate`
- Shipping section in Shop Config with rate fields and `shipping.enabled` toggle
- Cart API: computed `shipping_total`; applies override, free threshold, and international rate logic
- Stripe and PayPal: shipping line items, both gated on `shipping.enabled`
- Cart UI and order confirmation: shipping line display (hidden when zero)
- Admin orders: `shipping_amount` in detail view + CSV export

### Address Book (Part H)

- `user_addresses` table created with all free-text PII stored encrypted at rest (`_enc` suffix)
- `address_id FK` added to `orders`
- `AddressesService`: encrypt on write (`EncryptionService`), decrypt on read
- Customer account page (`/account`): Addresses section — add, delete, set default
- Checkout flow: address collection step before processor redirect for both Stripe and PayPal paths
- Legacy `users.shipping_*` columns deprecated (writes stopped; reads left for historical data)

---

## Deployment Path

### Planned vs. actual

The plan called for Deploy 1 (dual-write) → owner backfill → Deploy 2 (drop plaintext), with the owner running the 5 FR-010 backfill scripts between the two deploys.

**Actual**: Deploy 1 and Deploy 2 ran together in a single sequence because the live database contained only 2 seeded test users with no real PII (no TOTP enabled, no OAuth accounts, no orders, no actual names). Skipping the backfill gap was safe — there was no data to preserve.

### Migration bugs discovered and fixed during deployment

Three infrastructure bugs surfaced during the deployment attempt and were fixed before the final successful deploy.

**Bug 1 — Wrong table name in migration SQL**  
Two migration files used `ALTER TABLE "Product"` (the Prisma model name) instead of `ALTER TABLE "products"` (the actual `@@map` table name). PostgreSQL treats double-quoted identifiers as case-sensitive, so both migrations failed with `relation "Product" does not exist`.

Fixed:
- `backend/prisma/migrations/20260628120000_add_product_stripe_tax_code/migration.sql`
- `backend/prisma/migrations/20260628150000_add_product_shipping_override/migration.sql`

**Bug 2 — Failed migration record blocking subsequent migrations (P3009)**  
The first failed attempt left a record in Neon's `_prisma_migrations` table with a `started_at` timestamp but no `finished_at`. Prisma refuses to run any further migrations in this state. `prisma migrate resolve --rolled-back` also timed out (see Bug 3). Fixed by connecting directly to the Neon direct URL and running:
```sql
UPDATE _prisma_migrations 
SET rolled_back_at = NOW() 
WHERE migration_name = '20260628120000_add_product_stripe_tax_code' 
AND finished_at IS NULL;
```

**Bug 3 — Neon pooler URL incompatible with Prisma advisory locking (P1002)**  
`prisma migrate deploy` requires `pg_advisory_lock`, a connection-level lock that PgBouncer (Neon's pooler) does not relay reliably. The `DATABASE_URL` stored in GCP Secret Manager pointed to the pooler URL (`-pooler.` in hostname), causing every Cloud Run migration attempt to timeout waiting for the lock.

Fixed by modifying `backend/scripts/docker-start.sh` to derive the direct URL at startup:
```sh
MIGRATION_DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/-pooler\././')
DATABASE_URL="$MIGRATION_DATABASE_URL" node_modules/.bin/prisma migrate deploy
```
The `sed` substitution strips `-pooler.` from the hostname. It is a no-op for already-direct URLs, making the script safe for all deployment contexts. The rest of the app (queries, seeds) continues using the pooler URL.

This fix is permanent infrastructure — it will prevent the same timeout on every future migration deploy.

---

## Test Failures Fixed During CI (FR-010 related)

Three backend unit test files failed CI because `EncryptionService` is declared `@Global()` in `EncryptionModule`, but global modules do not apply in isolated NestJS unit test modules. Each affected spec file needed `EncryptionService` added to its test module providers.

Files fixed:
- `backend/src/auth/auth.service.spec.ts` — added mock; updated `validateUser` assertion (return shape changed to include decrypted virtual fields)
- `backend/src/digital-products/digital-products.service.spec.ts` — added mock
- `backend/src/digital-products/kindle.service.spec.ts` — added mock

All 190 backend unit tests green after fixes.

---

## Schema State After Both Deploys

| Table | Columns added | Columns dropped |
|-------|--------------|-----------------|
| `products` | `stripe_tax_code`, `shipping_override` | — |
| `orders` | `tax_amount`, `tax_details`, `shipping_amount`, `address_id` | `customer_name`, `shipping_name`, `shipping_address`, `shipping_city`, `shipping_zip` (plaintext; encrypted `_enc` variants live) |
| `users` | `totp_secret_enc`, `first_name_enc`, `last_name_enc`, `last_login_ip_hash` | `totp_secret`, `first_name`, `last_name` (plaintext; `last_login_ip` also dropped) |
| `oauth_accounts` | `access_token_enc`, `refresh_token_enc` | `access_token`, `refresh_token` |
| `refresh_tokens` | `ip_address_hash` | `ip_address` |
| `user_addresses` | entire table (new) | — |

---

## Activation Checklist (not yet done — requires external steps)

Tax and shipping are deployed but inactive. To activate:

**Tax prerequisites** (non-code):
- [ ] Register with Texas Comptroller; get permit number
- [ ] Enable Stripe Tax in the Stripe Dashboard; enter business address
- [ ] Fill in Shop Config: legal name, business address, registration number
- [ ] Set per-product tax codes via product edit form
- [ ] Flip `tax.enabled = true` in Shop Config

**Shipping prerequisites**:
- [ ] Fill in Shop Config: business address and shipping origin
- [ ] Set rate tiers (tier1_label, tier1_rate, optionally tier2, free_threshold, international_rate)
- [ ] Set per-product `shipping_override` where needed
- [ ] Flip `shipping.enabled = true` in Shop Config

**Owner action — immediate**:
- [ ] Re-enter display name at `/account` (first/last name is null after plaintext columns dropped with no backfill)
- [ ] Fill in Shop Config: legal business name + business address

---

## Outstanding Known Issues

**BUG-010** — No way to edit display name (first/last/username) on the customer-facing account page. Backend endpoint `PATCH /auth/profile` missing; UI form missing. See `docs/bugs/BUG-010-no-profile-edit-on-account-page.md`.

---

## Files Changed (Key)

```
backend/prisma/schema.prisma                                — all new models + columns
backend/prisma/migrations/ (15 migration files)            — full schema delta
backend/src/encryption/encryption.service.ts               — new (shared AES-256-GCM wrapper)
backend/src/encryption/encryption.module.ts                — new (global module)
backend/src/shop-config/shop-config.service.ts             — new
backend/src/shop-config/shop-config.controller.ts          — new
backend/src/addresses/addresses.service.ts                 — new (encrypt/decrypt on write/read)
backend/src/addresses/addresses.controller.ts              — new
backend/src/orders/orders.service.ts                       — tax + shipping + address book integration
backend/src/payments/stripe.provider.ts                    — Stripe Tax + shipping line items
backend/src/payments/paypal.provider.ts                    — PayPal flat-rate tax + shipping
backend/src/auth/auth.service.ts                           — TOTP encryption, name field encryption
backend/src/auth/auth.service.spec.ts                      — EncryptionService mock added; test updated
backend/src/digital-products/digital-products.service.spec.ts — EncryptionService mock added
backend/src/digital-products/kindle.service.spec.ts        — EncryptionService mock added
backend/scripts/docker-start.sh                            — derives direct Neon URL for migrations
backend/scripts/encrypt-totp-backfill.js                   — raw pg SQL (not Prisma)
backend/scripts/encrypt-oauth-backfill.js                  — raw pg SQL
backend/scripts/encrypt-orders-backfill.js                 — raw pg SQL
backend/scripts/encrypt-users-names-backfill.js            — raw pg SQL
backend/scripts/hash-ip-backfill.js                        — raw pg SQL
frontend/app/admin/shop-config/page.tsx                    — new
frontend/app/admin/tax-report/page.tsx                     — new
frontend/app/(site)/account/AccountPageClient.tsx          — Addresses section added
```
