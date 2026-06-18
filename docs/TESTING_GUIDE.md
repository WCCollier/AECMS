# AECMS Comprehensive Testing Guide

**Version**: 2.5  
**Last Updated**: 2026-06-18  
**Status**: Phases 14–20 complete — digital delivery, settings UI, dynamic nav, alternate domain redirects, RSS feed widget, and themes all verified; Digital Library panel on account page; two security bugs fixed (capability info disclosure, appearance endpoint auth)

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
cd /workspaces/AECMS/backend && npm run test     # 190 backend unit tests
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
17. [Digital Library Panel Testing](#digital-library-panel-testing-phase-14-qa)
18. [Admin Settings Testing](#admin-settings-testing-phase-15)
19. [Navigation & Routing Testing](#navigation--routing-testing-phase-16)
20. [Alternate Domain Redirect Testing](#alternate-domain-redirect-testing-phase-17)
21. [RSS Feed Widget Testing](#rss-feed-widget-testing-phase-18)
22. [Themes & Appearance Testing](#themes--appearance-testing-phase-20)
23. [Production Checklist](#production-checklist)

---

## Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Owner | owner@aecms.local  | Admin123!@# | All permissions; owner of seeded content |
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

**Phase 14 QA fixes applied (2026-06-17):**
- Cart remove/decrement 403 fixed (userId takes priority over sessionId in ownership check)
- Digital product creation now redirects to edit page (Digital Files panel immediately available)
- `personalizationEnabled` string→boolean coercion fixed for FormData uploads
- PDF upload format sync bug fixed (file picker was showing EPUB filter after EPUB uploaded)
- Same-format file upload now replaces the existing slot (upsert) with a Replace button per row
- DigitalFilesPanel moved to left column of product edit form; orange border
- Digital products blocked from publishing without at least one source file
- Order status badges normalized: `frontend/lib/orderStatus.ts` used across all 5 locations
- Product slug mangled on soft-delete (`__DELETED__{ts}__{slug}`) — frees unique slot
- Product SKU/slug reuse from deleted products triggers a warning alert (not a block)
- Article and page slugs permanently reserved after deletion — new content with same slug is blocked with a restoration message

**Name fields (2026-06-17, session 2):**
- `users.username` column added (unique) — now required at registration and persisted
- Registration form: `display_name` replaced with optional First Name + Last Name fields; `username` correctly wired to backend
- `orders.customer_name` column added — stores resolved full name at purchase time
- Checkout now collects first + last name from all buyers (guests always; authenticated users prompted if name missing from account)
- Collected name back-filled to `users.first_name`/`last_name` on first purchase so subsequent checkouts are pre-filled
- Personalization chain updated: `order.customer_name` now takes priority over separate user lookup
- Account page updated: shows Name, @username, email, role, member since

---

## Automated Testing

### Backend Unit Tests (190 tests)

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

# Refresh token (field name is camelCase: refreshToken)
curl -s -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}' | jq .

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

> **Email provider**: `EMAIL_PROVIDER_TYPE=smtp` is active — emails are sent via Gmail (`moriakul@gmail.com`). Verification emails for real addresses will land in inboxes. For test accounts with fake addresses (e.g. `verify-test@example.com`), delivery will fail silently; grab the token from the backend log instead.

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

This section covers the full Phase 14 digital delivery flow: creating a digital product with source files, purchasing it, downloading the personalized copy, and sending it to a Kindle device.

> **Email**: `EMAIL_PROVIDER_TYPE=smtp` is active — Kindle delivery emails are sent for real via `moriakul@gmail.com`. Amazon requires that address to be in your **Approved Personal Document E-mail List** before a send will succeed; the wizard guides you through adding it in Step 2. Set `PAYMENT_TEST_MODE=true` in `backend/.env` for instant payment confirmation during testing.

---

### Part A — Create a Digital Product and Upload Source Files

#### 1. Create the product (Admin UI)

1. Log into the admin panel at `/admin` (backstage login + 2FA required)
2. Navigate to **Products → New Product**
3. Set **Type** to `Digital`
4. Give it a name, price, description, and set status to `Published`
5. Save — note the product ID from the URL (`/admin/products/<ID>/edit`)

**Via API:**
```bash
PRODUCT=$(curl -s -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Digital Book",
    "description": "<p>A test digital product.</p>",
    "price": 9.99,
    "product_type": "digital",
    "status": "published",
    "visibility": "public"
  }')
PRODUCT_ID=$(echo $PRODUCT | jq -r '.id')
echo "Product ID: $PRODUCT_ID"
```

#### 2. Upload source files (Admin UI — Digital Files panel)

On the product edit page (`/admin/products/<ID>/edit`), scroll past the Inventory Tracker to the **Digital Files** panel. It appears only for `product_type = digital` products.

- Select format **EPUB** from the dropdown, click **Upload EPUB**, choose your `.epub` file
- Select format **PDF** from the dropdown, click **Upload PDF**, choose your `.pdf` file
- Each uploaded file appears with its filename and a "⚠️ Not yet tested" badge

**Via API:**
```bash
# Upload EPUB
curl -s -X POST http://localhost:4000/digital-products/files \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/path/to/book.epub" \
  -F "productId=$PRODUCT_ID" \
  -F "format=epub" \
  -F "personalizationEnabled=true" \
  -F "maxDownloads=5" | jq '{id,format,personalizationEnabled}'

# Upload PDF
curl -s -X POST http://localhost:4000/digital-products/files \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/path/to/book.pdf" \
  -F "productId=$PRODUCT_ID" \
  -F "format=pdf" \
  -F "personalizationEnabled=true" | jq '{id,format,personalizationEnabled}'

# Verify both files exist
curl -s "http://localhost:4000/digital-products/products/$PRODUCT_ID/files" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {id,format,personalizationEnabled,personalizationTested}'
```

#### 3. Test personalization

In the **Digital Files** panel, click **Test** next to the EPUB row. A personalized test copy (`TEST-<filename>.epub`) is generated with dummy data ("Test Customer", order "TEST-00000") and immediately downloaded by your browser. Repeat for PDF.

After testing, the badge changes from "⚠️ Not yet tested" to "✅ Personalization tested".

**Via API** (streams the file):
```bash
# Get file ID
FILE_ID=$(curl -s "http://localhost:4000/digital-products/products/$PRODUCT_ID/files" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

curl -s -X POST http://localhost:4000/digital-products/files/test-personalization \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$FILE_ID\"}" \
  --output /tmp/test-personalized.epub

ls -lh /tmp/test-personalized.epub
# Verify: open the file — first page should have "Licensed Copy / Test Customer / TEST-00000"
```

---

### Part B — Purchase a Digital Product

Digital products skip the shipping step in checkout entirely — the address form is not shown.

> **Name at checkout**: The Payment Method step now prompts for First Name + Last Name when the buyer doesn't have a name on file. For guests, name is always collected. The name is stored on the order (`customer_name`) and used for personalization. For the API test below, pass `customer_first_name` to get a personalized name on the download.

#### Test mode (fastest)

```bash
# Add to cart (anonymous)
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
curl -s -X POST http://localhost:4000/cart/items \
  -H "x-session-id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":\"$PRODUCT_ID\",\"quantity\":1}" | jq '{id,subtotal}'

# Create order (no shipping_address needed for digital-only cart)
# Pass customer_first_name for personalization; omit to use email as fallback
ORDER=$(curl -s -X POST http://localhost:4000/orders \
  -H "x-session-id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"customer_first_name":"Jane","customer_last_name":"Tester"}')
ORDER_ID=$(echo $ORDER | jq -r '.id')
echo "Order ID: $ORDER_ID"

# Simulate payment completion — creates download tokens automatically
curl -s -X POST "http://localhost:4000/payments/test/simulate/$ORDER_ID" \
  -H "x-session-id: $SESSION_ID" | jq .
# Order status → processing; download tokens created for each file

# Verify tokens were created
curl -s "http://localhost:4000/digital-products/orders/$ORDER_ID/downloads" \
  -H "x-session-id: $SESSION_ID" | jq '.[] | {id,format,downloadToken,downloadCount,maxDownloads,expiresAt}'
```

#### UI flow (test mode with `PAYMENT_TEST_MODE=true`)

1. Go to `/shop`, add the digital product to cart
2. Proceed to checkout — the **Shipping Information** step is skipped; you land directly on **Payment Method**
3. If not logged in (or logged in without a name on file): enter First Name + Last Name in the name fields that appear above the payment buttons
4. Click **Credit or Debit Card**
5. You are redirected to `/order-confirmation?order=<ID>&test_mode=true`
6. The **Your Digital Downloads** panel appears below the order summary
7. Two rows are visible — one for EPUB, one for PDF — each showing "5 of 5 remaining"

#### Stripe sandbox flow

Run the full checkout with `PAYMENT_TEST_MODE=false` (see [Stripe Sandbox Setup](#stripe-sandbox-setup)):

1. Add digital product to cart, checkout — no shipping form shown
2. Click **Credit or Debit Card** → redirects to Stripe Checkout
3. Enter test card `4242 4242 4242 4242`, complete payment
4. Stripe fires `checkout.session.completed` webhook
5. Backend calls `createDownloadTokensForOrder` automatically
6. `/order-confirmation` page shows the **Your Digital Downloads** panel

Confirm via backend log:
```bash
grep "download tokens" /tmp/backend.log | tail -3
# Expected: "Created 2 download tokens for order ORD-XXXXXX"
```

---

### Part C — Download Controls

#### Customer UI (order confirmation page or account page)

On `/order-confirmation?order=<ID>`, the **Your Digital Downloads** panel shows:

- One row per format (EPUB, PDF)
- A progress bar showing remaining downloads (e.g. "5 of 5 remaining")
- **Download** button — triggers a browser download of the personalized file
- **Kindle** button — opens the Kindle delivery wizard (see Part D)
- Expiry date at the bottom ("Links expire: …")

The same panel appears inline under each order in the **My Account → Order History** section for any order that contains digital items.

After clicking **Download**, refresh the page — the count decrements to "4 of 5 remaining".

#### Download via API

```bash
# Get the download token for a specific order
DOWNLOADS=$(curl -s "http://localhost:4000/digital-products/orders/$ORDER_ID/downloads" \
  -H "Authorization: Bearer $TOKEN")
TOKEN_EPUB=$(echo $DOWNLOADS | jq -r '.[] | select(.format=="epub") | .downloadToken')
TOKEN_PDF=$(echo $DOWNLOADS  | jq -r '.[] | select(.format=="pdf")  | .downloadToken')

# Download EPUB (response is the personalized file)
curl -L "http://localhost:4000/digital-products/download/$TOKEN_EPUB" \
  --output /tmp/my-book.epub
ls -lh /tmp/my-book.epub

# Download PDF
curl -L "http://localhost:4000/digital-products/download/$TOKEN_PDF" \
  --output /tmp/my-book.pdf
ls -lh /tmp/my-book.pdf

# Verify personalization: open /tmp/my-book.pdf — first page should show
# "Licensed Copy / <customer name> / Order: ORD-XXXXX / Purchase Date: …"

# Check count decremented
curl -s "http://localhost:4000/digital-products/orders/$ORDER_ID/downloads" | \
  jq '.[] | {format,downloadCount,maxDownloads}'
```

#### Enforcing the download limit

```bash
# After 5 downloads, the 6th should return 403
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:4000/digital-products/download/$TOKEN_EPUB"
done
# Last line should be 403 with "Maximum downloads reached"
```

**In the UI**: once exhausted, the EPUB row shows a red "Limit reached" badge. The Download and Kindle buttons are replaced by a **Request renewal** button.

#### Admin: regenerate a token (resets count + extends expiry)

```bash
DOWNLOAD_ID=$(echo $DOWNLOADS | jq -r '.[] | select(.format=="epub") | .id')

curl -s -X POST "http://localhost:4000/digital-products/downloads/$DOWNLOAD_ID/regenerate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{downloadToken,downloadCount,expiresAt}'
# downloadCount → 0, new token issued, expires 30 days from now
```

In the admin UI (`/admin/orders/<ID>`), the **Digital Items** panel shows regenerate and extend-expiry controls per format row.

#### Admin: extend expiry without resetting count

```bash
curl -s -X POST "http://localhost:4000/digital-products/downloads/$DOWNLOAD_ID/extend" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days":30}' | jq '{expiresAt}'
# expiresAt advanced by 30 days from current expiry (or today if already expired)
```

---

### Part D — Send to Kindle

The Kindle wizard opens when the customer clicks the **Kindle** button on any download row in the **Your Digital Downloads** panel.

> **Email**: `EMAIL_PROVIDER_TYPE=smtp` is active — clicking Send to Kindle will deliver a real email from `moriakul@gmail.com` to the Kindle address. Amazon will reject the delivery if that sender isn't whitelisted; the wizard walks you through whitelisting it in Step 2. Confirm delivery in `/tmp/backend.log` (`grep -i "kindle"`) and in your Kindle library.

#### New user — full 4-step onboarding wizard

**Step 1 — Find Your Kindle Email**
- Image carousel auto-advances through `to-kindle_1–3_marked.jpg` (6 s per slide)
- Slides show the Amazon Devices page with **green** ovals on "Devices", "Kindle", and "Preferences"
- Enter the device's `@kindle.com` email address in the field
- "Next" is disabled until the address contains `@kindle`

**Step 2 — Whitelist Our Email**
- Carousel shows `to-kindle_3–4_marked.jpg` with a **magenta** oval on "Add a new e-mail address"
- "Add a new e-mail address" text in the instructions is highlighted magenta; "Preferences" is highlighted green
- A copyable code block shows the store's sending address (`moriakul@gmail.com`)
- **Do this step now**: open Amazon → Account & Lists → Content & Devices → Preferences → Personal Document Settings → Approved Personal Document E-mail List → Add `moriakul@gmail.com`
- Once added, click "Next" to confirm

**Step 3 — Name This Device**
- Text input for a friendly name (default: "My Kindle")
- Checkbox: "Save this device to my account" (checked by default)

**Step 4 — Confirm & Send**
- Format selector: EPUB or PDF
- Confirmation summary: product name, email address, device name
- Remaining download count notice ("counts as 1 of your N downloads")
- **Send to Kindle** button

**API equivalent (new device, no save):**
```bash
curl -s -X POST http://localhost:4000/kindle/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"downloadId\": \"$DOWNLOAD_ID\",
    \"kindleEmail\": \"yourname_123@kindle.com\"
  }" | jq .

# Confirm delivery in backend log (look for messageId, not a console dump):
grep -i "kindle" /tmp/backend.log | tail -5
# Then check your Kindle library — the file should appear within a few minutes.
```

#### Returning user — 2-step short flow

If the user has saved Kindle devices, the wizard opens with a device picker instead:

**Step 1 — Choose Your Device**
- Radio list of saved devices (email + friendly name)
- "Add new device" option at the bottom (triggers inline fields for email + name)
- Format selector (EPUB / PDF)
- **Send to Kindle** button (skips all setup steps)

**API equivalent (saved device):**
```bash
# List saved devices
DEVICE_ID=$(curl -s http://localhost:4000/kindle/devices \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST http://localhost:4000/kindle/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"downloadId\":\"$DOWNLOAD_ID\",\"kindleDeviceId\":\"$DEVICE_ID\"}" | jq .
```

#### Verify Kindle tracking

After a successful send, both `download_count` and `kindle_send_count` increment:

```bash
curl -s "http://localhost:4000/digital-products/orders/$ORDER_ID/downloads" | \
  jq '.[] | {format,downloadCount,kindleSendCount,maxDownloads}'
```

In the admin order detail (**Digital Items** panel), the Kindle sends row shows "Kindle sends: N" per format.

#### Image carousel — click to enlarge

Any image in the wizard can be clicked to open a full-screen lightbox. Click outside the enlarged image or the ✕ button to close.

---

### Part E — Admin Digital Tracking Panel

In `/admin/orders/<ID>`, the **Fulfillment → Digital Items** panel shows live download records for every digital item in the order.

Per format row:
- **Usage bar** (e.g. "2 of 5 used")
- Kindle sends count (if any)
- Last downloaded date
- Expiry date (red-highlighted if expired)
- **Regenerate token** button — issues new token, resets count to 0, extends expiry 30 days
- **Extend expiry** input + button — adds N days to current (or today's) expiry without resetting count

If no download tokens exist yet (payment pending), the panel shows a message explaining tokens are auto-created on payment confirmation.

---

### Checklist

**Setup**
- [ ] Digital product created with `product_type = digital`
- [ ] EPUB and PDF files uploaded via Digital Files panel
- [ ] `personalization_tested` badge updates to ✅ after clicking Test

**Purchase**
- [ ] Shipping step is skipped entirely for digital-only carts
- [ ] Download tokens created automatically on payment confirmation (check backend log)
- [ ] Two download records created — one per uploaded format

**Personalization**
- [ ] Test download: first page of EPUB contains "Licensed Copy / Test Customer / TEST-00000"
- [ ] Test download: first page of PDF contains customer name, order number, purchase date
- [ ] Real download: personalized with actual customer name and order number

**Download controls**
- [ ] Download button triggers browser file download
- [ ] `downloadCount` increments after each download
- [ ] "Remaining" count updates on panel refresh
- [ ] 6th download on a limit-5 token returns 403 "Maximum downloads reached"
- [ ] Expired token returns 403 "Download link has expired"
- [ ] "Request renewal" button visible when limit reached or expired

**Admin token management**
- [ ] Regenerate resets count to 0 and issues a new token
- [ ] Extend expiry advances `expiresAt` by specified days
- [ ] Admin panel shows `kindleSendCount` and `lastDownloadedAt`

**Kindle wizard — new user**
- [ ] Step 1: carousel auto-advances; click-to-enlarge works; "Next" disabled without valid Kindle email
- [ ] Step 2: store sending address (`moriakul@gmail.com`) is copyable; whitelist it in Amazon during this step
- [ ] Step 3: device name input; save checkbox
- [ ] Step 4: summary shows email + device name + remaining count
- [ ] Send: backend log shows SMTP `messageId`; file appears in Kindle library; `downloadCount` and `kindleSendCount` both increment

**Kindle wizard — returning user**
- [ ] Device picker shows all saved devices
- [ ] "Add new device" option expands inline fields
- [ ] Send with saved device: no 4-step flow, goes directly to delivery
- [ ] Kindle device CRUD: add, list, update name, delete, default assignment

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

## Digital Library Panel Testing (Phase 14 QA)

The Digital Library panel on `/account` gives buyers a single consolidated view of all their digital purchases across all orders, so they don't have to dig through order history to find download links.

### Backend: all-purchases endpoint

```bash
MEMBER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')

# Get all download records across all orders for this user
curl -s http://localhost:4000/digital-products/my-downloads \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  | jq '.[] | {format, productName: .product.name, downloadCount, maxDownloads, expiresAt}'

# Returns [] for users with no digital purchases — panel is hidden in that case
```

### Verify download token is usable from panel

```bash
DOWNLOADS=$(curl -s http://localhost:4000/digital-products/my-downloads \
  -H "Authorization: Bearer $MEMBER_TOKEN")
DL_TOKEN=$(echo $DOWNLOADS | jq -r '.[0].downloadToken')

curl -sI "http://localhost:4000/digital-products/download/$DL_TOKEN"
# Expected: 200 with Content-Disposition: attachment
```

### Account page panel (UI)

1. Log in as a member who has purchased a digital product
2. Navigate to `/account`
3. The **My Digital Library** section appears between Profile and Order History
4. The section is absent entirely if the user has no digital purchases
5. Each purchased product appears as a group heading
6. Under each product: one row per format (EPUB / PDF) showing:
   - Format badge
   - Download progress bar ("3 of 5 remaining")
   - Expiry date
   - **Download** button
   - **Kindle** button (EPUB rows only)
   - **Request renewal** button (replaces the above when exhausted or expired)

### Checklist
- [ ] `GET /digital-products/my-downloads` returns all formats across all orders for the user
- [ ] Returns `[]` for users with no digital purchases
- [ ] Panel is invisible on `/account` for users with no purchases
- [ ] Panel appears between Profile and Order History sections
- [ ] Each product is a group with its formats listed below
- [ ] Download button works from the panel (count decrements)
- [ ] Kindle button appears for EPUB rows only
- [ ] Exhausted/expired rows show "Request renewal" button instead

---

## Admin Settings Testing (Phase 15)

Covers SiteSettings DB table, AES-256-GCM KeyProvider, and the settings UI tabs (General / Site Identity / Email / Payment Providers). Navigate to `/admin/settings` — requires backstage login + 2FA as Owner.

**Access levels**: Owner has `system.configure` (full read/write on all tabs). Admin has `system.appearance` only (can update the theme key via `PATCH /settings/appearance` but cannot reach the main settings page).

---

### Tab 1 — General (UI)

1. Change **Site Title** to something temporary (e.g. "Test Site Title") and **Tagline**
2. Click **Save Changes** — "Unsaved changes" label disappears, "Saved" appears
3. Open a new tab to `http://localhost:3000` — title change should be reflected
4. Verify via API (no auth required):
   ```bash
   curl -s http://localhost:4000/settings-public/general | jq .
   ```
5. Change **Homepage** to **Static Page** — a Page ID input appears. Switch back to **Latest Articles** and save
6. Revert site title to its original value and save

---

### Tab 2 — Site Identity (UI)

1. Enter any image URL in **Logo URL** — a small preview renders below the field immediately
2. Enter a URL in **Favicon URL** — 32×32 preview appears
3. Use the color picker to change **Brand Color** — hex input and picker stay in sync
4. Save — confirm no error (logo/favicon wiring is production-only; visual effect comes at deployment)

---

### Tab 3 — Email / SMTP (UI)

The fields should already be populated from the working Gmail SMTP config (`smtp.gmail.com`, port 587, STARTTLS, `moriakul@gmail.com`).

1. Confirm all fields are pre-populated
2. The password field shows `•••••••` — click the eye icon to reveal/hide
3. **Do not change any values** — you don't want to overwrite the working SMTP config
4. Click **Send Test Email** — spinner appears, then green ✓ or red ✗ with message
5. Confirm delivery:
   ```bash
   grep -i "messageId\|test email" /tmp/backend.log | tail -3
   ```
6. Check inbox at moriakul@gmail.com for the test email

---

### Tab 4 — Payment Providers (UI)

**Payment Mode toggle:**
1. Confirm the radio is on **Test Mode**
2. Click **Live Mode** — a browser `confirm()` dialog warns that real charges will be processed. Click **Cancel** — mode stays on Test Mode
3. Optionally click Live Mode and confirm — a red warning banner appears. Switch back to Test Mode and save immediately

**Stripe section:**
1. Publishable Key field shows `pk_test_...` (pre-populated)
2. Secret Key and Webhook Secret show `•••••••` — eye icon reveals them
3. Click **Verify Stripe Connection** — makes a live call to `stripe.balance.retrieve()`
   - Expected: green **✓ Connected** badge top-right of the Stripe card
   - If red ✗: check `grep STRIPE_SECRET /workspaces/AECMS/backend/.env`
4. Note: the Verify buttons bypass `PAYMENT_TEST_MODE` and always hit the real Stripe/PayPal APIs, so they work regardless of the mode toggle

**PayPal section:**
1. Client ID shows the sandbox `AaBb...` value; Client Secret shows `•••••••`
2. Click **Verify PayPal Connection** — fetches a PayPal OAuth access token as a connectivity test
   - Expected: green **✓ Connected** badge
   - If red ✗: check `grep PAYPAL /workspaces/AECMS/backend/.env`

**Dirty state:**
1. Save Changes button should be disabled (nothing changed)
2. Edit any field, then undo the change — Save re-enables on any keystroke
3. Save — completes cleanly, button disables again

---

### API verification

```bash
# Public endpoints — no auth
curl -s http://localhost:4000/settings-public/theme | jq .
# Returns: { "palette": "midnight", "fontPairing": "default" }

curl -s http://localhost:4000/settings-public/general | jq .
# Returns: { "site_title": "...", "tagline": "..." }

# Full settings read — Owner backstage token required
curl -s http://localhost:4000/settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'keys'
# Encrypted fields (SMTP password, API keys) returned as "***"

# Appearance update — Admin backstage token accepted
curl -s -X PATCH http://localhost:4000/settings/appearance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updates":{"theme":"{\"palette\":\"forest\",\"fontPairing\":\"serif-classic\"}"}}' | jq .

# Non-theme keys silently dropped — confirm original value unchanged
curl -s -X PATCH http://localhost:4000/settings/appearance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updates":{"general.site_title":"Hack"}}' | jq .
curl -s http://localhost:4000/settings-public/general | jq .site_title
# Should still be the original value
```

### Access control

```bash
# Customer-session token (not backstage) — must return 401, not 403
MEMBER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')

curl -s http://localhost:4000/settings \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq .statusCode
# Expected: 401

curl -s -X PATCH http://localhost:4000/settings/appearance \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq .statusCode
# Expected: 401
```

### Checklist
- [ ] General tab: site title change saves and appears on `http://localhost:3000`
- [ ] `GET /settings-public/general` reflects the change without auth
- [ ] Identity tab: logo URL renders a preview image inline
- [ ] Email tab: fields pre-populated; password field has show/hide toggle
- [ ] Send Test Email: green ✓ result and `messageId` in backend log
- [ ] Payment tab: mode toggle shows Live Mode warning dialog on click
- [ ] Stripe Verify Connection: green ✓ Connected
- [ ] PayPal Verify Connection: green ✓ Connected
- [ ] Save button disabled when no changes; re-enables on any edit
- [ ] `GET /settings` requires Owner backstage token; encrypted fields shown as `***`
- [ ] `PATCH /settings/appearance` accepted with Admin backstage token
- [ ] `PATCH /settings/appearance` silently drops non-theme keys
- [ ] Member customer token receives 401 (not 403) on all `/settings` endpoints

---

## Navigation & Routing Testing (Phase 16)

Phase 16 added dynamic navigation menus sourced from the database, the `/articles` route (replacing `/latest`), a catch-all `[...slug]` route for pages, and page hierarchy (parent → child).

### Dynamic nav endpoint

```bash
# Returns only published pages that have nav_label set
curl -s http://localhost:4000/pages/nav | jq '.[] | {title,slug,nav_label,nav_order,parent_id}'
```

Open `http://localhost:3000` — the header should list links for every page returned by this endpoint, in `nav_order` sequence.

### Articles route (formerly /latest)

```bash
# /articles returns published articles
curl -s "http://localhost:4000/articles?status=published&limit=3" | jq '.data[] | {title,slug}'

# /latest should 301-redirect to /articles in the browser
curl -sI http://localhost:3000/latest | grep -E "^HTTP|^location"
# Expected: HTTP/1.1 301 ... and location: /articles

# Individual article at /articles/<slug>
curl -s "http://localhost:4000/articles/slug/how-writing-works" | jq '{title,slug}'
```

### Catch-all page routing

```bash
# Get a page by slug (single level)
curl -s "http://localhost:4000/pages/by-path/about" | jq '{id,title,slug,status}'

# Create a parent + child page to test nesting
PARENT=$(curl -s -X POST http://localhost:4000/pages \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"About","slug":"about","content":"{}","status":"published","visibility":"public"}')
PARENT_ID=$(echo $PARENT | jq -r '.id')

curl -s -X POST http://localhost:4000/pages \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Team\",\"slug\":\"team\",\"parent_id\":\"$PARENT_ID\",\"content\":\"{}\",\"status\":\"published\",\"visibility\":\"public\"}" \
  | jq '{id,title,slug,parent_id}'

# Child page is accessible at /about/team in the frontend
```

### Admin nav fields (UI)

1. Log in at `/admin` (backstage session)
2. **Pages → Edit** any published page
3. Set **Nav Label** (e.g. "About Us") and **Nav Order** (e.g. 10), save
4. Reload `http://localhost:3000` — header updates without a frontend rebuild

### Checklist
- [ ] `GET /pages/nav` returns only published pages with `nav_label` set
- [ ] `/latest` in browser 301-redirects to `/articles`
- [ ] `/articles` page loads with published articles
- [ ] `/articles/<slug>` loads the individual article
- [ ] `GET /pages/by-path/<slug>` returns the matching page
- [ ] Catch-all `[...slug]` route renders the correct page from DB
- [ ] Nav label set in admin appears in header without a server restart
- [ ] Page hierarchy: child accessible at `/parent-slug/child-slug`

---

## Alternate Domain Redirect Testing (Phase 17)

Phase 17 added Next.js middleware that issues a `301` redirect when a request arrives via a secondary domain configured with `alias_type = 'redirect'`.

> Full end-to-end testing requires a real secondary domain pointing to your server. In development, verify the API shape and review the middleware source at `frontend/middleware.ts`.

### Create a redirect alias

```bash
ALIAS=$(curl -s -X POST http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"old.example.com","target_route":"/shop","alias_type":"redirect"}')
echo $ALIAS | jq '{id,domain,alias_type,target_route,verification_token}'
```

### alias_type field

```bash
# List aliases and confirm alias_type is stored
curl -s http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | {domain,alias_type,status,target_route}'
# alias_type "proxy" is reserved for a future phase (not yet implemented)
```

### Middleware behaviour (with real domain)

When `Host: old.example.com` arrives at Next.js and the alias status is `active`:
1. Middleware loads alias list from the DB (via backend API, cached)
2. Matches `Host` header against `domain` field
3. Issues `HTTP 301` to `https://<primary-domain><target_route>`

### Checklist
- [ ] `POST /domain-aliases` with `alias_type: "redirect"` stores the value correctly
- [ ] `GET /domain-aliases` returns `alias_type` on each record
- [ ] Only Owner backstage token can create/update/delete aliases
- [ ] DNS verification flow generates a unique `verification_token`
- [ ] Verified alias status transitions to `active`

---

## RSS Feed Widget Testing (Phase 18)

Phase 18 added an external feeds module with Redis-cached preview and SSRF protection, an `RssFeedWidget` component, and an `RssEmbed` TipTap node for embedding feeds in articles and pages.

### Backend: preview an RSS feed

```bash
# Preview a public RSS feed (Redis-cached for 15 min)
curl -s "http://localhost:4000/external-feeds/preview?url=https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" \
  | jq '{feedTitle:.feed.title, itemCount:(.items|length)}'

# SSRF protection: private/internal addresses must be blocked
curl -s "http://localhost:4000/external-feeds/preview?url=http://localhost:5432" | jq .
# Expected: 400 "SSRF protection: private/internal addresses are not allowed"

curl -s "http://localhost:4000/external-feeds/preview?url=http://169.254.169.254/metadata" | jq .
# Expected: 400 (AWS metadata endpoint blocked)

# Invalid URL
curl -s "http://localhost:4000/external-feeds/preview?url=not-a-url" | jq .
# Expected: 400 validation error
```

### Cache behaviour

```bash
# First call fetches live; subsequent calls within 15 min serve from Redis
time curl -s "http://localhost:4000/external-feeds/preview?url=https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" > /dev/null
time curl -s "http://localhost:4000/external-feeds/preview?url=https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" > /dev/null
# Second call should be <10 ms if cache hit
```

### Frontend: RssEmbed widget in TipTap editor

1. Open an article at `/admin/articles/<ID>/edit`
2. In the TipTap toolbar, click the RSS icon (External Feed)
3. Paste a valid RSS URL in the dialog and click Insert
4. The editor shows a live preview: feed title, first few items with a height fade, and a CTA button
5. Save and view the published article — the feed renders the same way for visitors

### Checklist
- [ ] `GET /external-feeds/preview?url=<RSS_URL>` returns feed metadata and items
- [ ] Private and link-local IP addresses return 400 (SSRF protection)
- [ ] Second request for the same URL is noticeably faster (cache hit)
- [ ] `RssEmbed` node insertable from TipTap toolbar
- [ ] Feed preview in editor shows title, item list, and CTA
- [ ] Feed renders correctly on the published article/page frontend

---

## Themes & Appearance Testing (Phase 20)

Phase 20 added 8 color palettes, 5 typography pairings, CSS variable injection in the root layout, and the `/admin/settings/appearance` backstage UI.

### Available palettes and font pairings

Palette IDs: `midnight`, `ocean`, `forest`, `ember`, `monochrome`, `lavender`, `rose-gold`, `desert`  
Font pairing IDs: `default`, `serif-classic`, `humanist`, `technical`, `editorial`

All definitions live in `frontend/lib/themes.ts`.

### Update theme via API

```bash
curl -s -X PATCH http://localhost:4000/settings/appearance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "theme": "{\"palette\":\"ocean\",\"fontPairing\":\"serif-classic\"}"
    }
  }' | jq .

# Verify publicly
curl -s http://localhost:4000/settings-public/theme | jq .
# Returns: { "palette": "ocean", "fontPairing": "serif-classic" }
```

### CSS variable injection

The root layout (`frontend/app/layout.tsx`) fetches `/settings-public/theme` at request time and injects CSS custom properties on `<html>`. Verify:

```bash
curl -s http://localhost:3000 | grep -o 'style="--[^"]*"' | head -1
# Expected output contains --color-background, --color-foreground, --color-accent, etc.
```

### Admin appearance UI

1. Log in at `/admin` (Admin or Owner backstage session)
2. Navigate to **Settings → Appearance**
3. Current palette and font are pre-selected (loaded from `GET /settings-public/theme` — no `system.configure` required)
4. Click a different palette — selection highlight moves; "Unsaved changes" label appears
5. Click **Save & Publish**
6. Hard-reload `http://localhost:3000` — site colours and fonts reflect the new theme

### Reset to defaults

```bash
curl -s -X PATCH http://localhost:4000/settings/appearance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updates":{"theme":"{\"palette\":\"midnight\",\"fontPairing\":\"default\"}"}}' | jq .
```

### Checklist
- [ ] 8 palette cards visible in `/admin/settings/appearance`
- [ ] 5 font pairing rows visible
- [ ] Current palette and font pre-selected on page load (no login as owner needed)
- [ ] Selecting palette/font marks form dirty ("Unsaved changes")
- [ ] Save & Publish writes to DB; `GET /settings-public/theme` reflects new values immediately
- [ ] CSS variables injected on `<html>` element on `http://localhost:3000`
- [ ] Site colours change after theme update + hard refresh
- [ ] Member customer token cannot reach `/settings/appearance` (401)
- [ ] `GET /settings-public/theme` returns `{ palette: "midnight", fontPairing: "default" }` when no theme stored

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

## Quick Reference: API Endpoints (135 total)

| Module | Endpoints | Backstage Required |
|--------|-----------|-------------------|
| Auth | 7 | Partial |
| Capabilities | 7 | Partial (own caps: any auth) |
| Media | 6 | Yes |
| Categories | 5 | Partial |
| Tags | 5 | Partial |
| Articles | 9 (incl. 3 version) | Partial |
| Pages | 10 (incl. 3 version + /nav + /by-path) | Partial |
| Products | 10 (incl. 3 version) | Partial |
| Cart | 6 | No (optional auth) |
| Orders | 7 | Partial |
| Payments | 12 (incl. reconcile) | Partial |
| Comments | 12 | Partial |
| Digital Products | 14 (incl. my-downloads, extend, test-personalization) | Partial |
| Kindle | 7 | No (customer JWT) |
| Domain Aliases | 10 | Owner Only |
| Audit Log | 1 | Yes |
| Settings (private) | 3 (GET, PATCH, PATCH /appearance, POST /test-email) | Owner / Admin |
| Settings (public) | 2 (GET /theme, GET /general) | None |
| External Feeds | 1 (GET /preview) | None |

---

*Updated for AECMS Phases 14–20 — 2026-06-18*
