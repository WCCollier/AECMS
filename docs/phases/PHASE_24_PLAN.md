# Phase 24: Commerce Infrastructure — Tax & Shipping

**Project**: AECMS  
**Phase**: 24  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 21 (live deployment), Phase 22 (dependency cleanup)

This phase covers three sub-phases. All infrastructure is built and deployed unconditionally. Commerce features are activated via ISM flags when the owner is ready — no redeploy required.

| Sub-phase | Scope | Activation flag |
|-----------|-------|-----------------|
| **24C — Shop Config** | Business identity (legal name, EIN, registration number, business address, shipping origin), Shop Config admin panel, `shop.configure` capability | Always on — configuration panel, no toggle needed |
| **24A — Sales Tax** | Stripe Tax integration, PayPal flat-rate, tax settings, receipts, reporting | `tax.enabled` (default `false`) |
| **24B — Shipping** | Flat-rate tiers, shipping origin from Shop Config, per-product override, cart/checkout display, order shipping line | `shipping.enabled` (default `false`) |

---

# Phase 24A — Sales Tax Collection & Accounting Infrastructure

## Goal

Add sales tax collection to the checkout flow and provide the owner with the reporting infrastructure needed to remit collected tax to the appropriate authorities. Design for the current reality (Texas physical nexus only, low volume) while being extensible to multi-state economic nexus as the business grows.

---

## Build vs. Activation

**Build**: The full Phase 24A infrastructure is built and deployed unconditionally. All tax logic is gated on `tax.enabled` (ISM key, default `false`). With the flag off, no tax is computed, shown, or charged — the code is completely inert to customers.

**Activation**: The owner sets `tax.enabled = true` in Admin Settings when their legal situation is settled. Prerequisites before flipping the flag:
- Registered with the relevant state tax authority (e.g. Texas Comptroller) and permit number in hand
- Stripe Tax enabled in the Stripe Dashboard with correct business address
- Business state and flat rate configured in Admin Settings → Tax

This design allows any owner — including one who has recently relocated or is unsure of their nexus — to deploy the full system and activate tax collection independently, with no redeploy required.

---

## Background: Current Tax Situation

- **Physical nexus**: Texas (owner's location). Texas taxes most digital goods at 6.25% state + up to 2% local (max 8.25%).
- **Economic nexus in other states**: Texas threshold is $500,000; most other states $100,000 or 200 transactions. Current projected volume does not approach any threshold.
- **Practical liability at current scale**: ~$5–20/year in Texas sales tax. Administrative cost of compliance exceeds the tax owed at this volume.

See research notes from 2026-06-20 session. Revisit annually or when revenue grows meaningfully.

---

## Part A — Pre-Activation Checklist (Non-Code)

These steps are required before setting `tax.enabled = true`. They do not block code work or deployment.

1. **Register with the appropriate state tax authority** (e.g. Texas Comptroller at [comptroller.texas.gov](https://comptroller.texas.gov)). Free. Save the permit number — it goes into Shop Config as `shop.tax_registration_number` and appears on customer receipts. If you relocate before activating, register with the new state instead.
2. **Determine filing frequency**: the state assigns quarterly, monthly, or annual filing based on expected volume. Annual is likely at low volume.
3. **Configure Stripe Tax** in the Stripe Dashboard (Dashboard → Tax → Enable Stripe Tax → enter business address). Stripe uses this for nexus determination and rate computation.
4. **Identify tax codes** for each product type you sell (see Part B).
5. **Fill in Shop Config** in the admin panel (Part J): legal business name, EIN, registration number, business address, and shipping origin if different.

---

## Part B — Product Tax Code Field

Stripe Tax requires a tax code on each line item to determine taxability. PayPal has no equivalent automatic service (see Part D).

### Relevant Stripe tax codes

| Product type | Stripe tax code | Notes |
|---|---|---|
| Physical goods (general) | `txcd_99999999` | Catch-all physical |
| Digital books / ebooks | `txcd_10010001` | |
| Digital audio (music, podcasts) | `txcd_10020000` | |
| Digital video | `txcd_10040000` | |
| Downloadable software | `txcd_10040001` | |
| Online courses / educational content | `txcd_10070000` | |
| Services | `txcd_20030000` | Broadly: non-taxable in many states |

### Schema change

Add `stripe_tax_code` (nullable string) to the `Product` model:

```prisma
stripe_tax_code  String?  // e.g. 'txcd_10010001' for digital books
```

Migration: `20260620000000_add_product_stripe_tax_code`

### Admin UI

Add a **Tax Code** dropdown to the Product edit form (Digital Files panel or its own section). Options are the table above, plus a "Not set (use default)" option. When unset, Stripe Tax falls back to a configurable default in the Stripe Dashboard.

---

## Part C — Stripe Checkout Tax Collection

### Changes to `stripe.provider.ts`

1. Add `automatic_tax: { enabled: true }` to `checkout.sessions.create()`.
2. Pass `tax_code` per line item from `product.stripe_tax_code` (if set).
3. For physical products, ensure `shipping_address_collection` is enabled on the session (already done for shipping) so Stripe can determine the correct local rate.
4. Store the tax amount from `checkout.session.completed` webhook onto the `Order` record.

### Order schema addition

```prisma
tax_amount  Int?  // tax collected in cents, from Stripe webhook
tax_details Json? // breakdown by jurisdiction, for reporting
```

### Webhook update

In `payments.service.ts` handler for `checkout.session.completed`, extract `session.total_details.amount_tax` and `session.total_details.breakdown` and persist them to the order.

---

## Part D — PayPal Tax Handling

PayPal has **no automatic tax calculation service** equivalent to Stripe Tax. This is a confirmed limitation as of 2026. PayPal's built-in tax system only allows manually-configured flat rates per state, set through your PayPal Business dashboard — it cannot determine the correct rate automatically and cannot be driven by an API. It also supports only one rate per state (no ZIP-code-level precision) and doesn't adapt as tax law changes.

### Which address determines tax?

Sales tax sourcing depends on product type:

- **Physical goods**: taxed at the **shipping address** (destination). Nearly all US states are destination-based for physical goods. Stripe Checkout collects the shipping address itself when `shipping_address_collection` is enabled, so this is handled automatically. For PayPal, the shipping address is passed in `purchase_units[].shipping` when creating the order and is available after capture.
- **Digital goods**: taxed at the **billing address** (or "place of first use") because there is no shipping destination. Stripe handles this automatically in Checkout. **PayPal does not expose the buyer's billing address to the merchant** — it stays within the buyer's PayPal account and is never returned by the Orders API. This is the key gap described below.

### The PayPal digital goods billing address gap

For digital product purchases through PayPal, there is no shipping address and PayPal never surfaces a billing address. This means:

- You cannot call the Stripe Tax calculation API with an accurate address before creating the PayPal order, because you have no address to pass.
- You cannot apply a state-accurate flat rate for the same reason.
- **Mitigation**: Add a minimal address-collection step (state + country, not full address) in the AECMS checkout flow before redirecting to PayPal for digital orders. Pass the collected state to the Stripe Tax API, get the calculated tax amount back, and set it as `tax_total` in the PayPal order. This adds one extra step for digital PayPal customers but closes the gap without requiring full address entry.
- **Alternative for now**: Fall back to the configured flat rate (Option A) for PayPal digital orders. This is legally defensible at low volume and single-state nexus.

Note: Collecting an address in AECMS before handing off to either processor is technically viable for prefilling. For Stripe, pass it via a `Customer` object — Stripe prefills it on their checkout page. For PayPal, pass it via `purchase_units[].shipping` — PayPal prefills it, but with `SET_FROM_PROVIDED_ADDRESS` the buyer cannot change it on the PayPal side. Use `GET_FROM_FILE` if you want PayPal to show the buyer's saved address instead (and collect their address for your own tax calculation after capture).

### Options

**Option A — Manual flat rate (simplest)**: Store a configurable flat tax rate in AECMS tax settings (Part E). Apply it to all PayPal orders using shipping state (physical) or the flat rate regardless of address (digital). Accurate enough for Texas-only nexus at low volume. Does not require pre-collecting any address.

**Option B — Stripe Tax API for PayPal orders (recommended when ready)**: Call `POST /v1/tax/calculations` (Stripe's standalone Tax API) before creating the PayPal order, passing the address you have (shipping for physical, pre-collected state for digital). Pass the returned `tax_amount` into PayPal's `tax_total` field. Reuses existing Stripe Tax configuration and keeps rates current automatically. Cost: $0.05 per PayPal order (billed as standalone calculation, not tied to a Stripe transaction). Requires one extra Stripe API call per PayPal checkout initiation.

**Option C — TaxJar integration**: [TaxJar](https://taxjar.com) ($19–99/mo) — independent tax calculation API usable with any payment processor. Overkill at current scale; worth evaluating if PayPal volume grows significantly.

**Option D — No PayPal tax collection**: Accept the limitation and route customers who need a tax-compliant receipt toward Stripe. Acceptable at current PayPal transaction volume.

**Recommendation**: Implement Option A at launch (zero complexity, zero extra API calls). Upgrade to Option B when PayPal volume justifies the extra Stripe API call and the state pre-collection UX step for digital orders.

---

## Part E — Tax Settings in Shop Config

Tax settings live in the **Shop Config** admin panel (Part J), not in the general Settings panel. The Tax section within Shop Config contains:

| Setting | ISM key | Description |
|---|---|---|
| Tax collection enabled | `tax.enabled` | Master on/off switch — default `false` |
| Default Stripe tax code | `tax.default_stripe_tax_code` | Fallback for products with no code set |
| PayPal flat rate (%) | `tax.flat_rate` | Applied to PayPal orders as a pre-calculated `tax_total` |

**Derived from Shop Config Business Identity (Part J) — not stored separately:**
- Business state → `shop.address_state` (used for PayPal flat-rate nexus determination)
- Tax registration number → `shop.tax_registration_number` (shown on receipts)

`tax.enabled = false` is the default. All tax logic is gated on this flag — completely inert until the owner explicitly turns it on.

---

## Part F — Tax Reporting in Admin Dashboard

The owner needs to know how much tax was collected in each period to file returns.

### Backstage: Tax Report panel

Add a **Tax** section to the Admin Orders area or as a standalone report under a new "Reports" nav item:

- Date range picker (default: current calendar quarter)
- Total sales (pre-tax)
- Total tax collected
- Breakdown by state/jurisdiction (from Stripe Tax `breakdown` field)
- CSV export for filing

### Receipts / order confirmation

Update the order confirmation email and the customer-facing order detail page to show:

```
Subtotal:    $9.99
Tax (TX):    $0.82
Total:       $10.81
```

---

## Part G — Multi-State Nexus Monitoring (Future)

Once volume grows, add a monitoring view that shows cumulative revenue and transaction count per state for the trailing 12 months, flagging any state approaching its economic nexus threshold. This is purely informational — it helps the owner know when to register in additional states before the obligation kicks in.

This can be built from the existing `orders` table by aggregating on shipping state (physical) or billing state (digital). No new data collection needed if Part D captures billing state.

---

## Part H — Customer Address Book

Collecting the customer's address in AECMS before redirecting to the payment processor — rather than relying on the processor to collect it — unlocks several benefits:

- **Saved addresses**: logged-in customers who've bought before skip the address step entirely on return visits
- **Tax processor independence**: the tax calculation step sits in AECMS between address collection and processor redirect; swapping tax providers (Stripe Tax → TaxJar → Avalara) requires no checkout flow changes
- **Prefill at processor**: the collected address is forwarded to Stripe (via `Customer` object) or PayPal (via `purchase_units[].shipping` + `SET_FROM_PROVIDED_ADDRESS`) so the customer sees it prefilled at the processor's checkout page
- **Closes the PayPal digital goods gap**: for PayPal digital purchases (no shipping address), collecting state/country in AECMS before the redirect gives the tax calculation an address to work with (see Part D)

**PayPal prefill caveat**: `SET_FROM_PROVIDED_ADDRESS` locks the shipping address on the PayPal side — the buyer cannot change it. Use only when the address was explicitly confirmed by the user in your own checkout flow. For cases where you want PayPal to show the buyer's saved address and let them choose, use `GET_FROM_FILE` instead and read the actual address back from the capture webhook.

### Schema — `UserAddress` model

Replace the existing flat `shipping_*` columns on the `User` model with a proper address table supporting multiple saved addresses:

```prisma
model UserAddress {
  id           String   @id @default(uuid())
  user_id      String
  label        String?              // e.g. "Home", "Work" — plaintext, low sensitivity
  is_default   Boolean  @default(false)

  // All free-text address fields stored encrypted at rest (see Part I)
  full_name_enc     String?          // recipient name
  street_enc        String?
  city_enc          String?
  state             String           // ISO state code — kept plaintext for tax queries
  postal_code_enc   String?
  country           String           // ISO country code — kept plaintext for tax queries

  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  user   User    @relation(fields: [user_id], references: [id], onDelete: Cascade)
  orders Order[]

  @@index([user_id])
  @@map("user_addresses")
}
```

**Why `state` and `country` stay plaintext**: these are the fields the tax calculation and nexus monitoring queries filter on (`WHERE state = 'TX'`). Encrypting them would break those queries. State codes are low-sensitivity on their own — they identify a region, not a person. The identifying combination (name + street + city) is what gets encrypted.

Add to `Order`:
```prisma
address_id  String?   // FK to user_addresses — null for guest orders
```

Migration: `add_user_addresses`

### Checkout flow change

For logged-in customers:
1. If user has a default address: show it with a "Use this address / Change" option
2. If user has no saved address: show the address collection form
3. On submit: save the address to `user_addresses` (if opted in), then proceed to tax calculation → processor redirect

For guest customers:
1. Show address collection form (state/country required for digital; full address required for physical)
2. Address is attached to the order but not persisted to a user account
3. After purchase, prompt: "Create an account to save your address for next time"

### Account UI — Saved Addresses

Add an **Addresses** section to the `/account` page (alongside the existing Notifications section):
- List saved addresses with labels
- Add / edit / delete / set as default
- Mirrors what Stripe and PayPal already show their customers in their own account UIs

---

## Part I — Encryption for PII at Rest (paired with FR-010)

> Full design, backfill strategy, and acceptance criteria: **[FR-010-pii-encryption.md](../feature-requests/FR-010-pii-encryption.md)**. This section is a summary of how Phase 24 fits into that work.


### Current state

The ISM uses AES-256-GCM (`LocalKeyProvider` / `GcpKeyProvider`) for secrets in the `SiteSettings` table. This is proper encryption — random IV per value, auth tag for tamper detection, key stored outside the DB in GCP Secret Manager.

**Everything else is plaintext.** A DB dump today exposes in cleartext:
- `users`: `first_name`, `last_name`, `last_login_ip`, and the existing flat `shipping_*` columns
- `users`: `totp_secret` — the schema comment says "Encrypted" but the auth service reads it directly as base32 with no decrypt call. This is a bug in the comments, not the code. The value is plaintext.
- `oauth_accounts`: `access_token`, `refresh_token` — also commented "Encrypted", also not encrypted
- `orders`: `customer_name`, `shipping_name/address/city/state/zip/country`
- `refresh_tokens`: `ip_address`

### What can and cannot be encrypted at the column level

Columns used in `WHERE` clauses or as unique constraints cannot be encrypted without losing that ability:
- `email` — primary login key, unique index, cannot be encrypted
- `state`, `country` on `UserAddress` — used in tax queries, kept plaintext (low sensitivity individually)

Columns only ever read whole are good encryption candidates:
- Street address, full name, postal code — never queried by value, only fetched by ID

### Design for Phase 24A

The new `UserAddress` model (Part H) is designed encrypted from day one. The `_enc` suffix convention (already established in the ISM) marks which columns are encrypted at rest.

**Implementation**: expose the existing `KeyProvider` beyond `SettingsService` via a thin `EncryptionService`:

```typescript
// backend/src/encryption/encryption.service.ts
@Injectable()
export class EncryptionService {
  constructor(@Inject(KEY_PROVIDER) private kp: KeyProvider) {}
  encrypt(value: string): Promise<string> { return this.kp.encrypt(value); }
  decrypt(value: string): Promise<string>  { return this.kp.decrypt(value); }
}
```

`EncryptionModule` exports `EncryptionService` and provides the same `KEY_PROVIDER` token already used by `SettingsModule`. Any module that stores PII imports `EncryptionModule` and calls `encrypt`/`decrypt` at the service layer before Prisma reads/writes.

### Security debt (not in Phase 24 scope)

The following plaintext PII fields exist today and represent known security debt. They should be addressed in a dedicated security hardening pass, not as part of Phase 24:

| Field | Table | Notes |
|-------|-------|-------|
| `totp_secret` | `users` | Fix the "Encrypted" comment lie; actually encrypt via `EncryptionService` |
| `access_token` / `refresh_token` | `oauth_accounts` | Same — encrypt at write, decrypt at read |
| `customer_name`, `shipping_*` | `orders` | Encrypt new writes; backfill existing rows |
| `ip_address` | `refresh_tokens` | Lower priority — consider storing hashed instead |
| `last_login_ip` | `users` | Same |

Encrypting these fields requires a backfill migration (read each row, encrypt, write back) run during a maintenance window. They cannot be made encrypted and backward-compatible in a single migration.

---

## Part J — Shop Config Admin Panel

A dedicated **Shop Config** panel in the backstage, separate from the general Settings panel, with its own nav heading. This is commerce-specific configuration — information that only matters because money and physical goods are changing hands. Technical infrastructure (SMTP, storage, payment API keys, appearance) remains in Settings.

### Capability

A new `shop.configure` capability (Owner-only, `scope: 'backstage'`) gates the entire Shop Config panel. It follows the same pattern as `system.configure.*` atoms.

### Nav

```
Settings          ← existing: General, Email, Storage, Appearance, SEO, Notifications, Payments
Shop Config       ← new nav heading
  └─ Business     ← business identity, addresses
  └─ Tax          ← tax toggle + settings (reads from Business for state and registration number)
  └─ Shipping     ← shipping toggle + rates (reads from Business for origin address)
```

### Business Identity section

The single source of truth for who the business is and where it operates. All downstream features (tax nexus, shipping origin, receipts, return address) read from here.

| Field | ISM key | Notes |
|-------|---------|-------|
| Legal business name | `shop.legal_name` | Appears on receipts and shipping labels; may differ from site title |
| Federal Tax ID (EIN) | `shop.ein_enc` | Encrypted at rest (`_enc` suffix); needed for future 1099 obligations |
| State tax registration number | `shop.tax_registration_number` | Comptroller permit number or equivalent; shown on receipts |
| Business address — street | `shop.address_street` | Registered legal address |
| Business address — city | `shop.address_city` | |
| Business address — state | `shop.address_state` | ISO state code; used for tax nexus determination |
| Business address — postal code | `shop.address_postal_code` | |
| Business address — country | `shop.address_country` | ISO country code |

### Shipping Origin section (within Business)

Displayed below the registered business address with a **"Shipping origin is the same as business address"** checkbox.

- **Checked** (default): shipping origin fields are hidden; all shipping origin reads resolve to `shop.address_*`
- **Unchecked**: a second set of address fields appears for the warehouse or fulfillment address

| Field | ISM key | Notes |
|-------|---------|-------|
| Same as business address | `shop.shipping_same_as_business` | Boolean; default `true` |
| Shipping origin — street | `shop.shipping_street` | Only used when `same_as_business = false` |
| Shipping origin — city | `shop.shipping_city` | |
| Shipping origin — state | `shop.shipping_state` | |
| Shipping origin — postal code | `shop.shipping_postal_code` | |
| Shipping origin — country | `shop.shipping_country` | |

The `ShopConfigService` (or `SettingsService` extension) exposes a `getShippingOrigin()` helper that resolves the correct address based on the `same_as_business` flag — callers never need to branch on this themselves.

### Tax section

See Part E. The Tax section in Shop Config shows `tax.enabled`, default tax code, and PayPal flat rate. Business state and registration number are displayed read-only here, sourced from Business Identity above, with a link to edit them there.

### Shipping section

See Phase 24B Part A. The Shipping section shows `shipping.enabled` and the flat-rate tiers. Shipping origin is displayed read-only here, sourced from Business Identity above, with a link to edit it there.

---

## Implementation Order

→ See **[PHASE_24_FR010_BUILD_ORDER.md](./PHASE_24_FR010_BUILD_ORDER.md)** for the authoritative step-by-step build order covering Phase 24 and FR-010 together, including live deployment sequences, two-pass backfill steps, owner actions, and which steps require assets beyond the Codespaces terminal.

High-level sequence for reference: EncryptionService → Shop Config panel (Part J) → Tax code field + Tax section → UserAddress + checkout flow → Stripe Tax → PayPal flat rate → Tax reporting → Shipping. FR-010 backfills run in parallel starting after EncryptionService deploys.

---

---

# Phase 24B — Shipping Infrastructure

## Goal

Add shipping cost collection to the checkout flow for physical products. The owner defines one or more flat-rate shipping tiers in Admin Settings; individual products can override with a per-product shipping cost. The shipping amount is shown in the cart, confirmed at checkout, and stored on the order. No carrier API integration — rates are owner-defined.

---

## Build vs. Activation

**Build**: The full Phase 24B infrastructure is built and deployed unconditionally alongside Phase 24A. All shipping logic is gated on `shipping.enabled` (ISM key, default `false`). With the flag off, no shipping cost is added to any cart or order — the code is completely inert.

**Activation**: The owner fills in Shop Config → Shipping rates, then sets `shipping.enabled = true` when ready to charge for shipping. No redeploy required.

---

## Design Principles

- **No carrier APIs**: UPS/FedEx/USPS real-time rate quotes are complex and overkill for a low-volume store. Flat rates configured by the owner are sufficient.
- **Opt-in per product**: digital and service products have no shipping cost. Only physical products trigger the shipping calculation.
- **Additive only**: shipping is an extra line in the order — the product price is unchanged. The Stripe Checkout session receives a shipping line item.
- **Single shipping address model**: the existing `shipping_*` columns on the `Order` model already capture address. No schema changes needed there.

---

## Part A — Shipping Settings in Shop Config

Shipping configuration lives in the **Shop Config** admin panel (Part J of Phase 24A), not in the general Settings panel.

### Shipping origin

The shipping origin address is configured in Shop Config → Business Identity, with a "same as business address" checkbox. The shipping calculation and any future label generation read origin from `ShopConfigService.getShippingOrigin()`. No separate ISM keys in the `shipping.*` namespace for the origin address.

### Flat-rate tiers (ISM keys)

| Setting | ISM key | Description |
|---------|---------|-------------|
| Shipping enabled | `shipping.enabled` | Master toggle — `false` by default; flip to activate |
| Domestic standard label | `shipping.tier1_label` | e.g. "Standard Shipping" |
| Domestic standard rate | `shipping.tier1_rate` | Cents (e.g. `799` = $7.99) |
| Domestic priority label | `shipping.tier2_label` | e.g. "Priority Shipping" (optional second tier) |
| Domestic priority rate | `shipping.tier2_rate` | Cents; leave blank to disable second tier |
| Free shipping threshold | `shipping.free_threshold` | Subtotal in cents above which shipping is free (0 = disabled) |
| International flat rate | `shipping.international_rate` | Cents; applied when destination country ≠ origin country; blank = not offered |

The two domestic tiers (standard/priority) cover the majority of shops. The international rate is a single flat charge — sufficient for low-volume international orders without requiring zone tables.

**Typical configuration workflow**: look up USPS Priority Mail flat-rate box costs from your zip code to a few representative destinations, round up a dollar, set that as `tier1_rate`. If you offer expedited, add `tier2_rate`. Set `international_rate` only if you ship outside your home country. Set `free_threshold` if you want to offer free shipping above a cart total.

**`shipping.enabled` is the sole activation gate.** Setting rates without flipping this flag has no customer-facing effect — useful for configuring everything before going live.

---

## Part B — Per-Product Shipping Override

Add `shipping_override` (nullable integer, cents) to the `Product` model. When set, this overrides the global flat-rate tiers for that product.

```prisma
model Product {
  // ... existing fields ...
  shipping_override  Int?  // shipping cost in cents; null = use global tier
}
```

Migration: `add_product_shipping_override`

**Admin UI**: add a "Shipping Cost Override" field to the Product edit form (Physical product section only, shown when `product_type === 'physical'`). Hint text: "Leave blank to use the global shipping rate from Settings."

---

## Part C — Shipping Calculation at Checkout

### Cart API (`GET /cart`)

Add a computed `shipping_total` field to the cart response:

```ts
shipping_total: number // 0 for non-physical carts; calculated rate for physical
```

Calculation:
1. If `shipping.enabled` is not `'true'`, return 0.
2. If all items are non-physical, return 0.
3. If any physical item has `shipping_override`, use the highest override (one shipping charge per order, covers the most expensive item to ship).
4. Else use `shipping.tier1_rate` (the standard tier; the customer selects standard vs. priority at a later step if tier2 is configured).
5. If cart subtotal ≥ `shipping.free_threshold` (and threshold > 0), return 0.

The tier selection (standard vs. priority) is a future refinement. For 24B, standard rate is always applied.

### Stripe Checkout session

In `stripe.provider.ts`, when building the Checkout session for an order containing physical items:
1. Calculate `shippingCost` using the same logic as the cart.
2. Add a `shipping_options` entry to the session with `shipping_rate_data`:
   ```ts
   shipping_options: [{
     shipping_rate_data: {
       type: 'fixed_amount',
       fixed_amount: { amount: shippingCost, currency: 'usd' },
       display_name: tier1Label,
     }
   }]
   ```
3. Store `shipping_amount` on the order (retrieved from `checkout.session.completed` webhook via `session.shipping_cost?.amount_total`).

### PayPal Orders API

In `paypal.provider.ts`, when building the PayPal order for a physical cart:
1. Calculate `shippingCost`.
2. Set `purchase_units[].amount.breakdown.shipping.value` to the formatted amount.
3. Ensure `purchase_units[].amount.value` includes the shipping cost.
4. Store `shipping_amount` on the order after capture.

### Order schema addition

```prisma
model Order {
  // ... existing fields ...
  shipping_amount  Int  @default(0)  // shipping cost in cents
}
```

Migration: `add_order_shipping_amount`

---

## Part D — Cart and Checkout UI

### Cart page (`/cart`)

Below the subtotal line, add:
```
Subtotal:   $24.99
Shipping:   $7.99   (or "Free" if threshold met, or "Calculated at checkout" if mixed cart)
──────────────────
Total:      $32.98
```

If no physical items: shipping line not shown.

### Order confirmation page and email

Add shipping line to the order summary breakdown:
```
Items:      $24.99
Shipping:   $7.99
Total:      $32.98
```

---

## Part E — Admin Orders

The Orders list and order detail view already show `total`. Add `shipping_amount` to the detail view so the owner can see how much was collected for shipping on each order.

The existing CSV export (`/orders/export`) should include `shipping_amount` as a column.

---

## Implementation Order (24B)

→ See **[PHASE_24_FR010_BUILD_ORDER.md](./PHASE_24_FR010_BUILD_ORDER.md)** (Step 7) for the full build order in context of the combined Phase 24 + FR-010 sequence.

High-level: Shipping settings → `shipping_override` on Product → `shipping_amount` on Order → Cart API + Stripe + PayPal calculation → Cart UI + confirmation updates → Admin orders detail + CSV export.
