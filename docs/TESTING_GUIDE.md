# AECMS Comprehensive Testing Guide

**Version**: 2.0  
**Last Updated**: 2026-06-04  
**Status**: Phase 13 — Full-system QA (see `docs/PHASE_13_PLAN.md` for the detailed checklist)

---

## Quick Start

```bash
# Start everything (handles Docker, migrations, seeding, both servers)
bash /workspaces/AECMS/start-dev.sh

# Tail both logs
tail -f /tmp/backend.log /tmp/frontend.log

# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

> **Codespaces note**: `docker-compose up` is broken due to a BuildKit issue. Always use `bash start-dev.sh` — it starts the postgres and redis containers directly via `docker run`/`docker start` and runs all seed scripts if the database is empty.

**Run unit tests**
```bash
cd /workspaces/AECMS/backend && npm run test     # 176 backend unit tests
cd /workspaces/AECMS/frontend && npm run test    # 125 frontend unit tests
```

---

## Table of Contents

1. [Test Credentials](#test-credentials)
2. [Stripe Sandbox Setup](#stripe-sandbox-setup)
3. [PayPal Sandbox Setup](#paypal-sandbox-setup)
4. [Phase 13 Testing Sequence](#phase-13-testing-sequence)
5. [Automated Testing](#automated-testing)
6. [Authentication Testing](#authentication-testing)
7. [Email Verification Testing](#email-verification-testing)
8. [Content Management Testing](#content-management-testing)
9. [Widget & Page Builder Testing](#widget--page-builder-testing)
10. [Ecommerce Testing](#ecommerce-testing)
11. [Order Management Testing](#order-management-testing)
12. [Payments Testing](#payments-testing)
13. [Audit Log & Version History Testing](#audit-log--version-history-testing)
14. [Digital Products Testing](#digital-products-testing)
15. [Comments & Moderation Testing](#comments--moderation-testing)
16. [Domain Aliases Testing](#domain-aliases-testing)
17. [Production Checklist](#production-checklist)

---

## Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Owner | owner@aecms.local | Admin123!@# | All permissions; owner of seeded content |
| Admin | admin@aecms.local | Admin123!@# | Most backstage capabilities |
| Member | member@aecms.local | Member123!@# | Customer-facing only |

**Get a customer-session token (curl):**
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' \
  | jq -r '.accessToken')
echo $TOKEN
```

**Get a backstage token** requires two steps (2FA):
```bash
# Step 1: get pre-auth token
PRE=$(curl -s -X POST http://localhost:4000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' \
  | jq -r '.preAuthToken')

# Step 2: verify TOTP (get code from authenticator app)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/admin/verify-2fa \
  -H "Content-Type: application/json" \
  -d "{\"pre_auth_token\":\"$PRE\",\"code\":\"<6-DIGIT-CODE>\"}" \
  | jq -r '.accessToken')
echo $ADMIN_TOKEN
```

---

## Stripe Sandbox Setup

These steps must be repeated each time the Codespace restarts, because `stripe listen` issues a new `whsec_...` per session.

### Step 1 — Verify keys are present

```bash
grep -E "STRIPE|PAYMENT_TEST_MODE" /workspaces/AECMS/backend/.env
```

Expected output includes:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYMENT_TEST_MODE=true           ← change this
STRIPE_WEBHOOK_SECRET=PLACEHOLDER ← change this
```

If `STRIPE_SECRET_KEY` is missing, the sandbox keys are stored as Codespaces Secrets. Recreate the Codespace or set them manually.

### Step 2 — Disable test mode

Edit `backend/.env`:
```
PAYMENT_TEST_MODE=false
```

### Step 3 — Start the Stripe webhook forwarder

In a **new terminal tab**:
```bash
stripe listen --forward-to localhost:4000/payments/webhooks/stripe
```

First output line will look like:
```
> Ready! Your webhook signing secret is whsec_abc123... (^C to quit)
```

Copy that `whsec_...` value.

### Step 4 — Set the webhook secret

Edit `backend/.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_abc123...   ← paste the value from step 3
```

### Step 5 — Restart the backend

```bash
pkill -f "nest start"
sleep 2
cd /workspaces/AECMS/backend && npm run start:dev &
```

Or use `! bash /workspaces/AECMS/start-dev.sh` which handles this.

### Step 6 — Verify

```bash
curl -s http://localhost:4000/payments/providers
# Expected: {"providers":["stripe","paypal"]}
```

Also watch the `stripe listen` terminal — when a test payment fires, you'll see events logged there in real-time.

### Stripe Test Cards

Use these on Stripe's hosted checkout page (not in our frontend — checkout redirects to Stripe):

| Scenario | Card number | Expiry | CVC |
|----------|-------------|--------|-----|
| **Success** | `4242 4242 4242 4242` | Any future | Any 3 digits |
| Generic decline | `4000 0000 0000 0002` | Any future | Any |
| Insufficient funds | `4000 0000 0000 9995` | Any future | Any |
| 3D Secure (approve) | `4000 0025 0000 3155` | Any future | Any |
| 3D Secure (fail) | `4000 0000 0000 3220` | Any future | Any |
| Expired card | `4000 0000 0000 0069` | Any future | Any |

**Postal code**: enter any 5 digits (e.g. `90210`).

### Triggering Stripe Events Manually

```bash
# Simulate a completed checkout session (useful for testing webhooks without UI)
stripe trigger checkout.session.completed

# Verify the webhook was received
# Check the stripe listen terminal — it will show the event
# Check the backend logs — it will log "Processing stripe webhook: checkout.session.completed"
```

---

## PayPal Sandbox Setup

### Step 1 — Verify keys are present

```bash
grep -E "PAYPAL" /workspaces/AECMS/backend/.env
```

Expected:
```
PAYPAL_CLIENT_ID=AXxx...
PAYPAL_CLIENT_SECRET=EXxx...
PAYPAL_MODE=sandbox
```

### Step 2 — Get your sandbox buyer account

1. Go to [developer.paypal.com](https://developer.paypal.com) and log in
2. Navigate to **Testing Tools → Sandbox Accounts**
3. Find the account with type **Personal (Simulated Buyer)**
4. Click the three-dot menu → **View/Edit Account** to see the password
5. Note the sandbox email (usually `sb-XXXXX@personal.example.com`) and password

### Step 3 — Confirm test mode is off

`PAYMENT_TEST_MODE=false` should already be set from the Stripe setup.

### Step 4 — Verify

```bash
curl -s http://localhost:4000/payments/providers
# Expected: {"providers":["stripe","paypal"]}
```

### PayPal Test Flow

PayPal uses a **redirect flow** — no card number is entered in our frontend:

1. Customer clicks "Pay with PayPal" at checkout
2. Browser redirects to `sandbox.paypal.com`
3. Customer logs in with sandbox buyer account credentials
4. Clicks **Pay Now** to approve
5. Browser redirects back to `/checkout/success?order=...`
6. Our frontend automatically calls `POST /payments/capture-paypal`
7. Order transitions to `processing`

**Important**: The capture-on-return is automatic. If the browser redirect back fails (e.g. browser closed), the nightly reconciliation job (`0 2 * * *`) or the manual trigger (`POST /payments/paypal/reconcile`) will recover the order.

### PayPal Manual Reconciliation

```bash
# Trigger zombie-order recovery manually (requires backstage token)
curl -s -X POST http://localhost:4000/payments/paypal/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Returns: {"checked": N, "recovered": N, "errors": N}
```

---

## Phase 13 Testing Sequence

See `docs/PHASE_13_PLAN.md` for the full checklist with step-by-step instructions for each area.

**Summary of areas:**
1. Stripe live sandbox setup
2. PayPal live sandbox setup
3. ✅ Admin CRUD — Articles (Phase 9 Step 9)
4. ✅ Admin CRUD — Products (Phase 9 Step 10)
5. ✅ Admin CRUD — Pages (Phase 11)
6. ✅ Widget system — all 6 widget types
7. ✅ Full Stripe sandbox checkout
8. PayPal sandbox capture-on-return
9. Order management with seeded order history
10. ✅ Audit log viewer
11. Version history — articles, products, pages
12. PayPal reconciliation endpoint

---

## Automated Testing

### Backend Unit Tests (176 tests)

```bash
cd /workspaces/AECMS/backend && npm run test
```

Suites:
- `audit.service.spec.ts` — hash chaining, error isolation
- `auth.service.spec.ts` — JWT, TOTP, session types
- `capabilities.service.spec.ts` — RBAC
- `comments.service.spec.ts` — create, moderate, reply rules
- `pages.service.spec.ts` — reserved slugs, findBySlug
- `moderation.service.spec.ts` — AI/profanity pipeline
- `digital-products.service.spec.ts` — file management
- `kindle.service.spec.ts` — Kindle delivery
- `personalization.service.spec.ts` — watermarking
- `domain-aliases.service.spec.ts` — DNS verification

### Backend E2E Tests (16 tests)

```bash
cd /workspaces/AECMS/backend && npm run test:e2e
# Requires Docker containers running (start-dev.sh handles this)
```

### Frontend Unit Tests (125 tests)

```bash
cd /workspaces/AECMS/frontend && npm run test
```

Suites include: Button, Input, Card, Header, Footer, useAuth, useCart, useArticles, useProducts, Login, Register, Shop, Cart, Admin, PageContent, StripWidgetNodes, WidgetSizeContext, SKU generation.

---

## Authentication Testing

### Customer-facing login

```bash
# Login
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq .

# Get profile
curl -s http://localhost:4000/auth/me -H "Authorization: Bearer $TOKEN" | jq .

# Refresh token
curl -s -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}' | jq .

# Logout
curl -s -X POST http://localhost:4000/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}' | jq .
```

### Backstage login (2FA required)

```bash
# Step 1: password
curl -s -X POST http://localhost:4000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq .
# Returns: { requiresTwoFactor: true, preAuthToken: "..." }

# Step 2: TOTP
curl -s -X POST http://localhost:4000/auth/admin/verify-2fa \
  -H "Content-Type: application/json" \
  -d '{"pre_auth_token":"<PRE_AUTH>","code":"<6_DIGITS>"}' | jq .
# Returns: accessToken, refreshToken, user
```

### Session isolation test

While logged into both customer-facing and backstage simultaneously:
- Customer logout should not clear backstage tokens
- Backstage logout should not clear customer tokens
- New backstage login revokes other active backstage sessions

### Checklist
- [ ] Customer login/logout cycle
- [ ] Backstage login requires TOTP
- [ ] Both sessions active simultaneously without interference
- [ ] Token refresh preserves session_type
- [ ] Protected backstage endpoints reject customer-session tokens (403)

---

## Email Verification Testing

Email provider is set to `console` in development — all emails are printed to the backend log (`/tmp/backend.log`), not actually sent.

```bash
# Register a new user
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test@example.com","password":"Test123!@#","first_name":"Test","last_name":"User"}' | jq .

# The verification token will appear in /tmp/backend.log:
grep "verify-email" /tmp/backend.log | tail -3

# Attempt login before verification (should fail 401)
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test@example.com","password":"Test123!@#"}' | jq .

# Verify email using token from logs
curl -s "http://localhost:4000/auth/verify-email?token=<TOKEN>" | jq .

# Login should now succeed
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test@example.com","password":"Test123!@#"}' | jq .
```

### Checklist
- [ ] Registration creates unverified user
- [ ] Unverified user cannot log in (401)
- [ ] Verification token appears in backend console log
- [ ] Verify-email endpoint accepts token
- [ ] Verified user can log in

---

## Content Management Testing

### Articles API

```bash
# List published articles (public)
curl -s "http://localhost:4000/articles?status=published&limit=5" | jq '.meta'

# Get by slug
curl -s "http://localhost:4000/articles/slug/how-writing-works" | jq '{id,title,status}'

# Create (requires backstage token)
curl -s -X POST http://localhost:4000/articles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Hello world\"}]}]}",
    "status": "published",
    "visibility": "public"
  }' | jq '{id,title,slug}'

# Update (returns new version if published)
curl -s -X PATCH http://localhost:4000/articles/<ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","change_summary":"Fixed typo"}' | jq '{id,title}'

# List versions
curl -s "http://localhost:4000/articles/<ID>/versions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {version_number,title,change_summary,created_at}'

# Restore a version
curl -s -X POST "http://localhost:4000/articles/<ID>/versions/1/restore" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id,title,status}'
```

### Pages API

```bash
# List pages
curl -s "http://localhost:4000/pages?status=published" | jq '.data[] | {id,title,slug}'

# Get by slug (public route)
curl -s "http://localhost:4000/pages/slug/test-page" | jq '{id,title,slug,status}'

# Create page with layout
curl -s -X POST http://localhost:4000/pages \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "About",
    "slug": "about",
    "layout": "no_sidebar",
    "content": "{\"layout\":\"no_sidebar\",\"zones\":{\"main\":{\"type\":\"doc\",\"content\":[]}}}",
    "status": "published",
    "visibility": "public"
  }' | jq '{id,title,slug}'

# Try reserved slug (should 409)
curl -s -X POST http://localhost:4000/pages \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Shop","slug":"shop","content":"{}"}' | jq .
```

### Media Upload

```bash
# Upload image
curl -s -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "alt_text=Test image" | jq '{id,filename,url}'

# List media
curl -s "http://localhost:4000/media?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {id,original_name,mime_type}'
```

### Checklist
- [ ] Articles CRUD with backstage token
- [ ] `change_summary` field stored in version
- [ ] Version created on publish; not on draft save
- [ ] Reserved page slugs rejected
- [ ] Pages created with layout field
- [ ] Media upload returns URL accessible at `/uploads/...`

---

## Widget & Page Builder Testing

The TipTap editor supports 7 inline widget types. Test via the article or page editor in the admin.

### Inserting widgets

All widget types are available in the TipTap toolbar via their respective icons. Click the icon to insert; a picker or URL input dialog appears as needed.

| Widget | Toolbar icon | Picker type |
|--------|-------------|-------------|
| MediaCarousel | Image filmstrip | Media library multi-select |
| Callout | Info box | Inline (type content directly) |
| VideoEmbed | Play button | URL input (YouTube/Vimeo) |
| XEmbed | X/Twitter bird | URL input (tweet URL) |
| ArticleEmbed | Document icon | Article search modal |
| ProductEmbed | Shopping bag | Product search modal |
| RichTextBox | Square | Inline (type content directly) |

### Conditional display (`show_when`)

Hover any widget in the editor to reveal the overlay controls. The `show_when` option has three values:
- **Always** (default)
- **Members only** — hidden from logged-out visitors
- **Guests only** — hidden from logged-in members

This is a rendering hint only — the full page JSON is always delivered to the browser. Use `admin_only` visibility on the page/article itself for real access control.

### Small-widget preview in page editor

In `/admin/pages/[id]/edit`, the "Preview small widgets" toggle switches all zone editors to `WidgetSizeProvider size="small"`, letting you see how widgets will render in a sidebar zone without having to switch layouts.

### API test for content migration

If existing articles still have raw HTML content (not TipTap JSON), run the migration endpoint:

```bash
# Trigger content migration (backstage only)
curl -s -X POST http://localhost:3000/admin/maintenance/migrate-content
# This converts HTML strings → TipTap JSON in all articles and products
```

---

## Ecommerce Testing

### SKU Auto-Generation

When creating a new product in the admin UI, the SKU field is auto-populated as you type the product name. The scheme is derived from the product slug and type:

```
TYPE-WORD-WORD-WORD
```

| Type | Prefix | Example name | Generated SKU |
|------|--------|-------------|---------------|
| physical | `P` | American Shooter Hat | `P-AMER-SHOO-HAT` |
| digital | `D` | How Writing Works | `D-HOW-WRIT-WORK` |
| service | `S` | Lesson 1: Marksmanship | `S-LESS-1-MA` |

**Behaviour to verify:**
- The SKU field shows an "(auto-generated)" label while untouched
- Changing the product type (physical/digital/service) updates the prefix live
- Editing the SKU field directly removes the label and stops further auto-generation
- On the Edit Product form, the stored SKU is shown as-is with no auto-generation

**Backend fallback:** if a product is created via the API with no `sku` field (e.g. seed scripts, bulk import), the backend generates the same slug-derived SKU and appends `-2`, `-3`, … until unique.

**Manual override via API:**
```bash
# Provide explicit SKU — overrides auto-generation
curl -s -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Product","sku":"CUSTOM-SKU-001","price":9.99,...}' | jq '{id,name,sku}'

# Omit SKU — backend auto-generates
curl -s -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Product","price":9.99,...}' | jq '{id,name,sku}'
# sku will be "P-MY-PROD" or similar
```

### Products

```bash
# List published products
curl -s "http://localhost:4000/products?status=published" | jq '.data[] | {id,name,price,product_type,stock_status}'

# Get by slug
curl -s "http://localhost:4000/products/slug/american-shooter-hat" | jq '{id,name,price,stock_quantity}'

# Create product (backstage)
curl -s -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Item",
    "description": "<p>Test</p>",
    "price": 9.99,
    "product_type": "physical",
    "stock_quantity": 10,
    "status": "published",
    "visibility": "public"
  }' | jq '{id,name,slug}'

# Update with change summary (creates a version)
curl -s -X PATCH http://localhost:4000/products/<ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":12.99,"change_summary":"Price increase Q2"}' | jq '{id,name,price}'
```

### Cart (anonymous)

```bash
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)

# Add item
curl -s -X POST http://localhost:4000/cart/items \
  -H "x-session-id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","quantity":2}' | jq .

# Get cart
curl -s http://localhost:4000/cart -H "x-session-id: $SESSION_ID" | jq '{subtotal,items:(.items|length)}'

# Validate before checkout (checks stock)
curl -s -X POST http://localhost:4000/cart/validate \
  -H "x-session-id: $SESSION_ID" | jq .
```

### Cart (logged-in)

Same endpoints but use `Authorization: Bearer $TOKEN` instead of `x-session-id`. On first authenticated request the anonymous cart merges into the member's cart.

### Checklist
- [ ] Anonymous cart uses `x-session-id` header
- [ ] Logged-in cart uses JWT bearer token
- [ ] Anonymous → logged-in cart merge works
- [ ] Cart validate returns stock errors inline
- [ ] Product price displayed correctly (not NaN)
- [ ] Service products show no quantity stepper in UI

---

## Order Management Testing

12 seeded orders are in the database with statuses: pending (3), processing (3), completed (3), cancelled (1), refunded (1). Use these for admin management testing.

### Order status update

```bash
# List all orders (backstage)
curl -s "http://localhost:4000/orders?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {order_number,status,total,email}'

# Update status
curl -s -X PATCH "http://localhost:4000/orders/<ORDER_ID>/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' | jq '{id,order_number,status}'

# Valid transitions:
# pending    → processing, cancelled
# processing → completed, cancelled, refunded
# completed  → refunded
# (cancelled and refunded are terminal)
```

### Refunds

```bash
# Full refund
curl -s -X POST "http://localhost:4000/payments/refund/<ORDER_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# Partial refund ($5.00 = 500 cents)
curl -s -X POST "http://localhost:4000/payments/refund/<ORDER_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":500}' | jq .
```

### Status history (audit log)

```bash
# Orders with status history are viewable in the admin at /admin/orders/<id>
# The timeline is sourced from audit_logs filtered by resource_id + event_type

# Verify via API
curl -s "http://localhost:4000/audit-logs?resource_type=order&resource_id=<ORDER_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {event_type,changes,created_at}'
```

### Checklist
- [ ] All 12 seeded orders visible in admin
- [ ] Status updates follow valid transitions only
- [ ] Invalid transition returns 400
- [ ] Refund issues via API (test mode) or live gateway (sandbox mode)
- [ ] Status history timeline visible on `/admin/orders/<id>`
- [ ] Audit log records `order.status_changed` and `order.refund_initiated`

---

## Payments Testing

### Which mode to use

| Mode | Config | Use for |
|------|--------|---------|
| Test mode | `PAYMENT_TEST_MODE=true` | Quick local testing; no real API calls |
| Stripe sandbox | `PAYMENT_TEST_MODE=false` + `stripe listen` running | Full checkout flow with Stripe Checkout UI |
| PayPal sandbox | `PAYMENT_TEST_MODE=false` + sandbox credentials | Redirect-based PayPal checkout |

### Test mode (no external calls)

```bash
# Simulate payment completion
curl -s -X POST "http://localhost:4000/payments/test/simulate/<ORDER_ID>" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Order transitions to processing instantly
```

### Stripe sandbox checkout flow

1. Add item to cart, proceed to checkout
2. Select Stripe, click Pay
3. Frontend POSTs to `/payments/create-intent` → gets Stripe Checkout URL
4. Browser redirects to Stripe's hosted checkout page at `checkout.stripe.com`
5. Enter test card details on Stripe's page
6. Stripe redirects to `/checkout/success?order=...` after payment
7. `stripe listen` terminal shows `checkout.session.completed` event
8. Backend processes webhook, marks order as `processing`
9. Order confirmation page shows correct order data

```bash
# Verify webhook was received and logged
curl -s "http://localhost:4000/audit-logs?event_type=order.status_changed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[0] | {changes,created_at}'
```

### PayPal sandbox checkout flow

1. Add item to cart, proceed to checkout
2. Select PayPal, click Pay
3. Frontend POSTs to `/payments/create-intent` → gets PayPal approval URL
4. Browser redirects to `sandbox.paypal.com`
5. Log in with sandbox buyer account
6. Click **Pay Now** to approve
7. Browser redirects to `/checkout/success?order=...`
8. Frontend POSTs to `/payments/capture-paypal` with the PayPal order ID
9. Backend calls PayPal Capture API → marks order as `processing`

### Refund via live gateway

```bash
# Only works with PAYMENT_TEST_MODE=false and a paid order
curl -s -X POST "http://localhost:4000/payments/refund/<ORDER_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### PayPal zombie-order reconciliation

```bash
# Manual trigger (also runs automatically nightly at 02:00 America/Chicago)
curl -s -X POST http://localhost:4000/payments/paypal/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
# Returns: { "checked": N, "recovered": N, "errors": N }
```

### Checklist
- [ ] `PAYMENT_TEST_MODE=true` simulate works
- [ ] Stripe redirect to hosted checkout works
- [ ] Stripe test card `4242...` succeeds, webhook fires
- [ ] Stripe decline card shows error on Stripe's page
- [ ] Order transitions to `processing` after Stripe success
- [ ] PayPal redirect flow redirects to `sandbox.paypal.com`
- [ ] PayPal approval + redirect back + capture works
- [ ] Order transitions to `processing` after PayPal capture
- [ ] Refund API works in test mode
- [ ] `webhook_events` table has rows after Stripe processing
- [ ] Reconcile endpoint returns without error

---

## Audit Log & Version History Testing

### Audit log query

```bash
# All events (owner only — others see their own events only)
curl -s "http://localhost:4000/audit-logs?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {event_type,user_id,resource_type,created_at}'

# Filter by event type
curl -s "http://localhost:4000/audit-logs?event_type=auth.login" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | length'

# Filter by resource
curl -s "http://localhost:4000/audit-logs?resource_type=order&resource_id=<ORDER_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {event_type,changes}'

# Event types present after typical testing:
# auth.login, auth.login_failed, auth.logout, auth.2fa_success, auth.sessions_revoked
# order.status_changed, order.refund_initiated
# article.created, article.updated, article.published, article.deleted
# product.updated, product.deleted
# page.created, page.updated, page.published, page.deleted
# comment.moderated
# media.uploaded, media.deleted
```

### Article version history

```bash
# List versions for an article
curl -s "http://localhost:4000/articles/<ID>/versions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {version_number,title,change_summary,created_at}'

# Get a specific version's full content
curl -s "http://localhost:4000/articles/<ID>/versions/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{version_number,title,content}'

# Restore to version 1 (creates a new draft)
curl -s -X POST "http://localhost:4000/articles/<ID>/versions/1/restore" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id,title,status}'
```

### Product version history

```bash
# Same pattern — versions created on every product save
curl -s "http://localhost:4000/products/<ID>/versions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {version_number,name,price}'
```

### Page version history

```bash
# Versions created on publish or update-of-published pages
curl -s "http://localhost:4000/pages/<ID>/versions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {version_number,title,change_summary}'

# Page version stores full PageContent JSON (layout + all zones)
curl -s "http://localhost:4000/pages/<ID>/versions/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{version_number,title,content}' | head -20
```

### Hash chain integrity check

Each `AuditLog` row has `entry_hash` (SHA-256 of the row contents + `previous_hash`). Manual verification:

```bash
# Get last 3 audit entries
psql $DATABASE_URL -c "SELECT id, entry_hash, previous_hash, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 3;"
# previous_hash of row N should equal entry_hash of row N-1
```

### Checklist
- [ ] Audit log viewer loads at `/admin/audit-log`
- [ ] Event type filter narrows results
- [ ] Row expand shows changes JSON for status_changed events
- [ ] `auth.login_failed` entries have null user_id
- [ ] Article versions created on publish; not on draft-only saves
- [ ] Product versions created on every admin save
- [ ] Page versions created on publish or update-of-published
- [ ] Restore creates a new draft with correct content
- [ ] Version history panel in editors lazy-loads on expand

---

## Digital Products Testing

### Upload and download

```bash
# Upload a digital file to a product
curl -s -X POST http://localhost:4000/digital-products/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/path/to/book.pdf" \
  -F "product_id=<PRODUCT_ID>" \
  -F "format=pdf" \
  -F "max_downloads=5" | jq .

# Generate download token (called by the system after order completion)
curl -s -X POST http://localhost:4000/digital-products/token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","order_id":"<ORDER_ID>"}' | jq '{token,expires_at}'

# Download using token
curl -s -L "http://localhost:4000/digital-products/download/<TOKEN>" \
  -H "Authorization: Bearer $TOKEN" \
  --output /tmp/downloaded.pdf
ls -lh /tmp/downloaded.pdf
```

### Kindle delivery

```bash
# Register a Kindle device
curl -s -X POST http://localhost:4000/kindle/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kindle_email":"yourname@kindle.com","friendly_name":"My Kindle"}' | jq .

# List devices
curl -s http://localhost:4000/kindle/devices -H "Authorization: Bearer $TOKEN" | jq .

# Send to Kindle (EMAIL_PROVIDER_TYPE=console in dev — no real email sent)
curl -s -X POST http://localhost:4000/kindle/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","device_id":"<DEVICE_ID>"}' | jq .
# Check /tmp/backend.log for the simulated email
```

### Checklist
- [ ] File upload creates `DigitalProductFile` record
- [ ] Download token generated and expires
- [ ] Download count increments per download
- [ ] Max download limit enforced
- [ ] Kindle device registration works
- [ ] Send to Kindle logs email content to console

---

## Comments & Moderation Testing

### Post and retrieve

```bash
# Post a comment (member token required)
MEMBER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')

ARTICLE_ID=$(curl -s "http://localhost:4000/articles?status=published&limit=1" | jq -r '.data[0].id')

curl -s -X POST http://localhost:4000/comments \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Great article!\",\"article_id\":\"$ARTICLE_ID\"}" | jq '{id,status,moderation_status}'

# Get comments for article
curl -s "http://localhost:4000/comments?article_id=$ARTICLE_ID" | jq '.data[] | {id,content,status}'
```

### Product review (requires verified purchase)

```bash
# Post a review (requires a completed/processing order containing the product)
curl -s -X POST http://localhost:4000/comments \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\":\"Excellent course material.\",
    \"title\":\"Highly recommended\",
    \"product_id\":\"<PRODUCT_ID>\",
    \"ratings\":[{\"title\":\"Overall\",\"value\":5}]
  }" | jq '{id,verified_purchase,status}'
```

### Moderation (admin)

```bash
# View pending moderation queue
curl -s "http://localhost:4000/comments/admin/moderation-queue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {id,content,moderation_status}'

# Approve
curl -s -X POST "http://localhost:4000/comments/admin/<COMMENT_ID>/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id,status}'

# Reject
curl -s -X POST "http://localhost:4000/comments/admin/<COMMENT_ID>/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id,status}'

# Mark spam
curl -s -X POST "http://localhost:4000/comments/admin/<COMMENT_ID>/spam" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id,status}'
```

### Checklist
- [ ] Comment requires authentication (401 without token)
- [ ] Comment auto-moderation runs async (check `moderation_status` after a moment)
- [ ] Product review requires verified purchase (403 without matching order)
- [ ] One review per user per product enforced
- [ ] Admin approve/reject/spam work and write to audit log
- [ ] Nested replies (single level only)

---

## Domain Aliases Testing

Owner-only functionality. Requires a real domain you control for full DNS verification testing.

```bash
# Create alias
curl -s -X POST http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","target_route":"/shop"}' | jq '{id,domain,verification_token}'

# Get verification instructions
curl -s "http://localhost:4000/domain-aliases/<ID>/instructions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Attempt verification (will fail without actual DNS record in dev)
curl -s -X POST "http://localhost:4000/domain-aliases/<ID>/verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Non-owner access should fail
MEMBER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')
curl -s "http://localhost:4000/domain-aliases" -H "Authorization: Bearer $MEMBER_TOKEN" | jq .
# Expected: 403
```

### Checklist
- [ ] Create alias generates verification_token
- [ ] Only owner can access domain-aliases endpoints
- [ ] Admin and member get 403

---

## Production Checklist

### Before go-live

**Payments**
- [ ] Set `PAYMENT_TEST_MODE=false` permanently
- [ ] Replace Stripe test keys (`sk_test_...`) with live keys (`sk_live_...`)
- [ ] Configure production Stripe webhook URL in Stripe Dashboard
- [ ] Replace PayPal sandbox credentials with live credentials
- [ ] Set `PAYPAL_MODE=live` in environment
- [ ] Test with small real transactions ($1) before launch
- [ ] Set up Stripe webhook for production endpoint (not `stripe listen`)

**Security**
- [ ] Generate new `JWT_SECRET` (32+ random chars) for production
- [ ] Ensure all secrets are in environment variables, not in `.env` files committed to git
- [ ] Configure HTTPS — all HTTP requests should redirect to HTTPS
- [ ] Set `CORS` to production domain only
- [ ] Review `rate limiting` settings in NestJS config
- [ ] Confirm `bcrypt` rounds = 12 (already set)

**Infrastructure**
- [ ] PostgreSQL running on a managed host (not Docker on the app server)
- [ ] Redis configured for session/cache
- [ ] Persistent file storage for uploads (not ephemeral container filesystem)
- [ ] Automated database backups configured
- [ ] `NODE_ENV=production` and `nest start:prod` (not `start:dev`)

**Email**
- [ ] Set `EMAIL_PROVIDER_TYPE=smtp` (not `console`)
- [ ] Configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- [ ] Test verification email delivery end-to-end
- [ ] Test Kindle delivery email

**Monitoring**
- [ ] Backend error logging to a log aggregator (not just stdout)
- [ ] Stripe webhook delivery failure alerts in Stripe Dashboard
- [ ] Database disk space monitoring
- [ ] PayPal sandbox accounts deleted; live accounts configured

**Performance**
- [ ] `next build` + `next start` for the frontend (not `next dev`)
- [ ] CDN for `/uploads` static files (or cloud storage + CDN)
- [ ] Database connection pooling configured (Prisma default is fine for low traffic)

---

## Quick Reference: API Endpoints (127 total)

| Module | Endpoints | Backstage Required |
|--------|-----------|-------------------|
| Auth | 7 | Partial |
| Capabilities | 7 | Yes |
| Media | 6 | Yes |
| Categories | 5 | Partial |
| Tags | 5 | Partial |
| Articles | 9 (incl. 3 version) | Partial |
| Pages | 10 (incl. 3 version) | Partial |
| Products | 10 (incl. 3 version) | Partial |
| Cart | 6 | No (optional auth) |
| Orders | 7 | Partial |
| Payments | 12 (incl. reconcile) | Partial |
| Comments | 12 | Partial |
| Digital Products | 11 | Yes |
| Kindle | 7 | Yes |
| Domain Aliases | 10 | Owner Only |
| Audit Log | 1 | Yes |

---

*Updated for AECMS Phase 12/13 — 2026-06-04*
