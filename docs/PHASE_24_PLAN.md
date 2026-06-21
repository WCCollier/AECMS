# Phase 24: Sales Tax Collection & Accounting Infrastructure

**Project**: AECMS  
**Phase**: 24  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 21 (live deployment), Phase 22 (dependency cleanup)

---

## Goal

Add sales tax collection to the checkout flow and provide the owner with the reporting infrastructure needed to remit collected tax to the appropriate authorities. Design for the current reality (Texas physical nexus only, low volume) while being extensible to multi-state economic nexus as the business grows.

---

## Activation Trigger

Do not implement Phase 24 until one of these conditions is met:

- Annual revenue crosses **$1,000** (enough to justify the administrative overhead), OR
- The owner registers with the Texas Comptroller and becomes legally obligated to collect, OR
- The business expands to a product line or volume that creates economic nexus in additional states

Until then, the codebase carries no tax collection logic and the owner accepts the theoretical liability consciously.

---

## Background: Current Tax Situation

- **Physical nexus**: Texas (owner's location). Texas taxes most digital goods at 6.25% state + up to 2% local (max 8.25%).
- **Economic nexus in other states**: Texas threshold is $500,000; most other states $100,000 or 200 transactions. Current projected volume does not approach any threshold.
- **Practical liability at current scale**: ~$5–20/year in Texas sales tax. Administrative cost of compliance exceeds the tax owed at this volume.

See research notes from 2026-06-20 session. Revisit annually or when revenue grows meaningfully.

---

## Part A — External Prerequisites (Non-Code)

Before any code is written, the owner must complete these steps:

1. **Register with the Texas Comptroller** for a sales tax permit at [comptroller.texas.gov](https://comptroller.texas.gov). Free to register.
2. **Determine filing frequency**: Texas assigns quarterly, monthly, or annual filing based on expected volume. Annual is likely at this scale.
3. **Configure Stripe Tax** in the Stripe Dashboard:
   - Go to Dashboard → Tax → Enable Stripe Tax
   - Enter your business address (Texas)
   - Stripe uses this to determine your nexus and apply correct rates
4. **Identify tax codes** for each product type you sell (see Part B).

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

**Confirmed options:**

**Option A — Manual flat rate (recommended for now)**: Store a configurable flat tax rate per state in AECMS tax settings (Part E). Apply it to PayPal orders based on the shipping state (physical) or billing state (digital, collected at checkout). The PayPal Orders API v2 supports explicit `tax_total` in line items — set it to the pre-calculated amount. Accurate enough for Texas-only nexus and single-state situations.

**Option B — TaxJar integration**: [TaxJar](https://taxjar.com) ($19–99/mo depending on volume) provides an API that calculates the precise rate for any US address and product type, handles economic nexus tracking, and offers a PayPal integration. Worth it if PayPal volume is significant and multi-state nexus becomes a concern. Overkill at current scale.

**Option C — Stripe Tax API for PayPal orders**: Use Stripe Tax's calculation API (not Checkout) to compute the correct tax for a given address + product, then pass the result to PayPal. More accurate than flat rates and reuses existing Stripe Tax configuration. Additional complexity: requires a Stripe API call before every PayPal checkout initiation.

**Option D — No PayPal tax collection**: Route PayPal checkout users through Stripe for tax-compliant receipts, and document the limitation. Acceptable at current PayPal transaction volume.

**Recommendation**: Implement Option A first (flat rate per state, configurable in Tax Settings). If PayPal volume grows or multi-state nexus is triggered, evaluate TaxJar (Option B). The architecture should make the tax calculation step injectable so the provider can be swapped without rewriting the checkout flow.

---

## Part E — Tax Settings in Admin Settings

Add a **Tax** tab (or section within General Settings) to the Admin Settings UI:

| Setting | ISM key | Description |
|---|---|---|
| Tax collection enabled | `tax.enabled` | Master on/off switch |
| Default Stripe tax code | `tax.default_stripe_tax_code` | Fallback for products with no code set |
| Business state | `tax.business_state` | Used for PayPal flat-rate fallback (e.g. `TX`) |
| Flat tax rate (%) | `tax.flat_rate` | PayPal fallback rate (e.g. `8.25`) |
| Tax registration number | `tax.registration_number` | Texas Comptroller permit number, shown on receipts |

`tax.enabled = false` is the default. All tax logic is gated on this flag so it is completely inert until the owner explicitly turns it on.

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

## Implementation Order

1. Part A (external prerequisites) — owner action, no code
2. Part B (product tax code field) — schema + admin UI
3. Part E (tax settings) — ISM keys + settings tab
4. Part C (Stripe checkout) — provider changes + order schema
5. Part D (PayPal) — decision point, then implementation
6. Part F (reporting) — receipts first, then dashboard report
7. Part G (nexus monitoring) — deferred until meaningful multi-state volume
