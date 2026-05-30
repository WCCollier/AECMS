# AECMS Comprehensive Testing Guide

**Version**: 1.2
**Last Updated**: 2026-05-30
**Status**: Phase 9 - User Testing (Steps 1–3, 6 complete)

---

## Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

### Option 2: Manual Development
```bash
# 1. Start services
docker-compose up -d postgres redis

# 2. Start backend (Terminal 1)
cd backend && npm run start:dev

# 3. Start frontend (Terminal 2)
cd frontend && npm run dev

# 4. Run automated tests (Terminal 3)
cd backend && npm run test && npm run test:e2e
cd frontend && npm run test
```

---

## Table of Contents

1. [Test Credentials](#test-credentials)
2. [Phase 9: User Testing Sequence](#phase-9-user-testing-sequence)
3. [Automated Testing](#automated-testing)
4. [Authentication Testing](#authentication-testing)
5. [Email Verification Testing](#email-verification-testing)
6. [Content Management Testing](#content-management-testing)
7. [Ecommerce Testing](#ecommerce-testing)
8. [Payments Testing](#payments-testing)
9. [Digital Products Testing](#digital-products-testing)
10. [Comments & Moderation Testing](#comments--moderation-testing)
11. [Domain Aliases Testing](#domain-aliases-testing)
12. [Frontend E2E Testing](#frontend-e2e-testing)
13. [Production Checklist](#production-checklist)

---

## Test Credentials

| Role | Email | Password | Capabilities |
|------|-------|----------|--------------|
| Owner | owner@aecms.local | Admin123!@# | All |
| Admin | admin@aecms.local | Admin123!@# | Most admin functions |
| Member | member@aecms.local | Member123!@# | Basic user functions |

**Get Auth Token**:
```bash
# Note: Response uses 'accessToken' (camelCase)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq -r '.accessToken')

echo $TOKEN
```

---

## Phase 9: User Testing Sequence

This section covers the structured manual testing sequence for Phase 9. Testing proceeds from the lowest-privilege path (anonymous browsing) upward to admin functions. Work through steps in order — each step's results inform whether the next step is worth attempting.

### Step 1 — Anonymous Article Browsing ✅ Done

- Browse `/latest` and verify article grid loads
- Select a category filter (e.g. "Short Thoughts") in the header nav — URL becomes `?category=short-thoughts`
- Confirm listing filters to that category, subtitle reads "Filtered by: Short Thoughts"
- Open an article, verify content renders (paragraphs, images, embedded media)
- Back-navigate, verify filter is still applied

**Checklist**
- [x] Article listing loads
- [x] Category filter reads URL param and filters results
- [x] Article detail page renders full content
- [x] Tag filtering works the same way

---

### Step 2 — Anonymous Shop Browsing ✅ Done

- Browse `/shop` and verify product grid loads
- Click a product — verify detail page (title, price, description, image)
- Check that "Add to Cart" button is visible without login

**Checklist**
- [x] Product listing loads with prices
- [x] Product detail page loads
- [x] No JS errors in console
- [x] Out-of-stock products handled gracefully

---

### Step 3 — Anonymous Cart Mechanics ✅ Done

- Add a product to cart
- Navigate to another page and back — cart count in header should persist
- Go to `/cart` — verify item, quantity, subtotal
- Change quantity — verify total updates
- Remove item — verify cart empties

**Checklist**
- [x] Add to cart works without login (`x-session-id` generated in localStorage)
- [x] Cart persists across page navigations
- [x] Quantity update recalculates total
- [x] Remove item works
- [x] Empty cart state shows correctly
- [x] Stock limits enforced inline (error shown, not silent failure)
- [x] Service items show no quantity stepper; physical items show stepper
- [x] Cart prices display correctly (NaN bug fixed)

---

### Step 4 — Member Login + Browsing

- Sign in as `member@aecms.local / Member123!@#`
- Verify header changes (account menu appears, "Sign Up" disappears)
- Browse articles — check if any `logged_in_only` content now appears that was hidden anonymously
- Browse shop

**Checklist**
- [ ] Login succeeds and redirects
- [ ] Header reflects logged-in state
- [ ] Auth context persists on page refresh
- [ ] `logged_in_only` articles are visible to members

**Likely issue**: Auth context `refreshUser` race condition on page load may flash the logged-out state briefly.

---

### Step 5 — Member Cart Mechanics

- As logged-in member, repeat the cart test from Step 3
- If you had anonymous cart items in Step 3: check whether they transferred after login (cart merge)

**Checklist**
- [ ] Cart works for logged-in user
- [ ] Anonymous cart merges into member cart on login (or is explicitly cleared — either is acceptable, but the behavior should be consistent)

---

### Step 6 — Checkout as Member (Stripe Sandbox) ✅ Done

**Stripe test card**: `4242 4242 4242 4242`, any future expiry, any 3-digit CVC.

**Checklist**
- [x] Cart pre-flight validate fires before order creation (corrects over-limit quantities)
- [x] Shipping form submits successfully
- [x] Stripe Payment Intent created (sandbox keys configured)
- [x] Stub alert shown (Stripe Elements UI deferred)
- [x] Cart clears after payment stub
- [x] Order confirmation page loads with itemised summary, totals, order number
- [ ] Order status transitions to `paid` via webhook (requires `stripe listen` — deferred)

**Note**: Stripe Elements card UI is not yet built. Payment flow currently stubs via `alert()` then redirects to confirmation. Real card collection requires Stripe Elements integration (deferred polish).

**Stripe decline test cards** (test failure paths):

| Scenario | Card |
|----------|------|
| Generic decline | 4000 0000 0000 0002 |
| Insufficient funds | 4000 0000 0000 9995 |
| 3D Secure required | 4000 0025 0000 3155 |

---

### Step 7 — Guest Checkout

- Log out
- Add items to cart
- Proceed to checkout — verify email collection field appears
- Complete checkout with test card

**Checklist**
- [ ] Guest checkout collects email
- [ ] `OptionalJwtAuthGuard` allows unauthenticated checkout
- [ ] Order created with guest email
- [ ] Confirmation shown

---

### Step 8 — Admin Back Door: 2FA Enrollment

**Do this before any admin CRUD testing** — without a registered TOTP device, the owner account cannot reach the admin dashboard.

- Navigate to `/admin/login`
- Sign in as `owner@aecms.local / Admin123!@#`
- When QR code appears, scan with authenticator app (Google Authenticator, Authy, etc.)
- Enter the 6-digit code to complete enrollment
- Verify you land on the admin dashboard

**Checklist**
- [ ] Admin login page loads at `/admin/login`
- [ ] Credentials accepted, TOTP challenge shown
- [ ] QR code scans correctly
- [ ] 6-digit code accepted, dashboard loads
- [ ] Subsequent logins prompt for TOTP code

---

### Step 9 — Admin CRUD: Articles

- Create a new article via admin form
- Edit an existing article — verify TipTap editor loads content (paragraphs, images)
- Verify existing categories/tags pre-populate on edit form
- Publish/unpublish toggle
- Delete an article

**Checklist**
- [ ] Create article form submits
- [ ] TipTap editor loads existing HTML content correctly
- [ ] Paragraph breaks render in editor
- [ ] Image insert works in editor
- [ ] Categories and tags pre-populate on edit
- [ ] Status toggle (draft/published) works
- [ ] Delete works

**Likely issue**: Edit form may not pre-populate categories/tags from the existing article — those aren't passed in `initialData` currently.

---

### Step 10 — Admin CRUD: Products

- Create a new product
- Edit an existing product
- Toggle published/draft
- Delete a product

**Checklist**
- [ ] Create product form submits with all fields
- [ ] Price stored in cents (display correctly as dollars)
- [ ] Stock quantity updates
- [ ] Image upload works
- [ ] Categories/tags pre-populate on edit

---

### Step 11 — Admin Orders

- View the orders created in Steps 6 and 7
- Update order status (e.g. pending → shipped)

**Checklist**
- [ ] Order list loads with correct totals
- [ ] Order detail shows line items
- [ ] Status update works
- [ ] Guest orders visible (not filtered out)

---

### Anticipated Show-stoppers (by probability)

| Area | Likely Problem |
|------|---------------|
| Cart | Session ID not persisted — cart empties on navigation |
| Checkout | Stripe Payment Intent creation blocked in Codespaces network, or webhook not reachable |
| Admin article edit | Form doesn't pre-populate existing categories/tags |
| Admin 2FA | Blocks all admin testing until enrollment is complete |
| Cart merge | Anonymous → logged-in cart merge probably not implemented |

---

## Automated Testing

### Backend Unit Tests (152 tests)
```bash
cd backend && npm run test
```

**Test Suites:**
- `auth.service.spec.ts` - Authentication logic
- `capabilities.service.spec.ts` - RBAC capabilities
- `comments.service.spec.ts` - Comments CRUD
- `moderation.service.spec.ts` - AI/profanity moderation
- `digital-products.service.spec.ts` - File management
- `kindle.service.spec.ts` - Kindle delivery
- `personalization.service.spec.ts` - File watermarking
- `domain-aliases.service.spec.ts` - Domain mapping

### Backend E2E Tests (16 tests)
```bash
cd backend && npm run test:e2e
```

### Frontend Unit Tests (90 tests)
```bash
cd frontend && npm run test
```

**Test Suites:**
- Components: Button, Input, Card, Header, Footer
- Hooks: useAuth, useCart, useArticles, useProducts
- Pages: Login, Register, Shop, Cart, Admin

### Frontend E2E Tests (Playwright)
```bash
cd frontend && npm run test:e2e
```

---

## Authentication Testing

### 1. Registration
```bash
# Create new user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "display_name": "Test User"
  }'
```
**Expected**: 201 response with access_token

### 2. Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}'
```
**Expected**: 200 response with access_token and refresh_token

### 3. Token Refresh
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'
```

### 4. Get Profile
```bash
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Checklist
- [ ] Registration creates user with Member role
- [ ] Login returns valid JWT tokens
- [ ] Token refresh works before expiry
- [ ] Protected routes reject invalid tokens
- [ ] Password validation enforces requirements

---

## Email Verification Testing

### 1. Register New User
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  --data-raw '{
    "email": "newuser@example.com",
    "password": "Test123!@#",
    "first_name": "Test",
    "last_name": "User"
  }'
```
**Expected**: Returns message to check email, user created with `email_verified: false`

### 2. Check Verification Status (Login Should Fail)
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"newuser@example.com","password":"Test123!@#"}'
```
**Expected**: 401 error "Please verify your email before logging in"

### 3. Resend Verification Email
```bash
curl -X POST http://localhost:4000/auth/resend-verification \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"newuser@example.com"}'
```

### 4. Verify Email (with token from email)
```bash
curl "http://localhost:4000/auth/verify-email?token=<TOKEN_FROM_EMAIL>"
```
**Expected**: 200 success, user can now login

### 5. Frontend Verification Page
- Navigate to `http://localhost:3000/auth/verify-email?token=<TOKEN>`
- Should show success or error message

### Checklist
- [ ] Registration requires email verification
- [ ] Unverified users cannot login
- [ ] Verification email is sent (check console in dev mode)
- [ ] Resend verification works
- [ ] Token expires after 24 hours
- [ ] Frontend verify-email page works

---

## Content Management Testing

### Categories
```bash
# List categories
curl http://localhost:4000/categories

# Create category (requires auth)
curl -X POST http://localhost:4000/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Electronics","slug":"electronics"}'
```

### Tags
```bash
# List tags
curl http://localhost:4000/tags

# Create tag
curl -X POST http://localhost:4000/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Featured","slug":"featured"}'
```

### Articles
```bash
# List published articles
curl http://localhost:4000/articles

# Create article
curl -X POST http://localhost:4000/articles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "slug": "test-article",
    "content": "<p>Article content here</p>",
    "status": "published",
    "visibility": "public"
  }'

# Get by slug
curl http://localhost:4000/articles/slug/test-article
```

### Media Upload
```bash
curl -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg"
```

### Checklist
- [ ] Categories CRUD works
- [ ] Tags CRUD works
- [ ] Articles support draft/published/archived status
- [ ] Visibility controls work (public/logged_in_only/admin_only)
- [ ] Media upload accepts images
- [ ] Slug generation is automatic

---

## Ecommerce Testing

### Products

#### List Products
```bash
curl "http://localhost:4000/products?status=published&visibility=public"
```

#### Create Product
```bash
curl -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "slug": "test-product",
    "description": "A great product",
    "price": 1999,
    "sku": "TEST-001",
    "stock_quantity": 100,
    "status": "published",
    "visibility": "public"
  }'
```

#### Filter Products
```bash
# By category
curl "http://localhost:4000/products?category=electronics"

# By price range
curl "http://localhost:4000/products?min_price=1000&max_price=5000"

# Search
curl "http://localhost:4000/products?search=test"
```

### Cart

#### Add to Cart
```bash
curl -X POST http://localhost:4000/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","quantity":2}'
```

#### Get Cart
```bash
curl http://localhost:4000/cart \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Quantity
```bash
curl -X PATCH http://localhost:4000/cart/items/<ITEM_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity":3}'
```

#### Remove Item
```bash
curl -X DELETE http://localhost:4000/cart/items/<ITEM_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### Orders

#### Create Order
```bash
curl -X POST http://localhost:4000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "US"
    }
  }'
```

#### Get Orders
```bash
curl http://localhost:4000/orders \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Order Details
```bash
curl http://localhost:4000/orders/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### Checklist
- [ ] Products CRUD with all fields
- [ ] Product filtering (category, price, search)
- [ ] Stock tracking updates correctly
- [ ] Cart persists for logged-in users
- [ ] Cart supports guest sessions (cookie-based)
- [ ] Order creation clears cart
- [ ] Order totals calculate correctly
- [ ] Order status updates work

---

## Payments Testing

### Prerequisites
```bash
# Verify providers are available
curl http://localhost:4000/payments/providers
# Expected: {"providers":["stripe","paypal"]}
```

### Stripe Test Cards

| Scenario | Card Number | Exp | CVC |
|----------|-------------|-----|-----|
| Success | 4242 4242 4242 4242 | Any future | Any |
| Decline | 4000 0000 0000 0002 | Any future | Any |
| 3D Secure | 4000 0025 0000 3155 | Any future | Any |
| Insufficient | 4000 0000 0000 9995 | Any future | Any |

### Stripe Payment Flow

#### 1. Create Payment Intent
```bash
curl -X POST http://localhost:4000/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"<ORDER_ID>","provider":"stripe"}'
```
**Response**: `payment_id`, `client_secret`, `status`

#### 2. Webhook Testing
```bash
# Terminal 1: Forward webhooks
stripe listen --forward-to localhost:4000/payments/webhooks/stripe

# Terminal 2: Trigger test event
stripe trigger payment_intent.succeeded
```

#### 3. Verify Order Status
```bash
curl http://localhost:4000/orders/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
# Status should be "paid"
```

### PayPal Payment Flow

#### 1. Create PayPal Payment
```bash
curl -X POST http://localhost:4000/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"<ORDER_ID>","provider":"paypal"}'
```
**Response**: `payment_id`, `approval_url`, `status`

#### 2. Approve in Browser
- Open `approval_url` in browser
- Login with sandbox personal account
- Approve payment
- Note the PayPal order ID from redirect URL

#### 3. Capture Payment
```bash
curl -X POST http://localhost:4000/payments/capture-paypal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id":"<AECMS_ORDER_ID>",
    "paypal_order_id":"<PAYPAL_ORDER_ID>"
  }'
```

### Refunds
```bash
# Full refund
curl -X POST http://localhost:4000/payments/refund/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Customer requested"}'

# Partial refund (500 cents = $5)
curl -X POST http://localhost:4000/payments/refund/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Partial refund","amount":500}'
```

### Test Mode (No Real Credentials)
```bash
# Enable in backend/.env
PAYMENT_TEST_MODE=true

# Simulate payment completion
curl -X POST http://localhost:4000/payments/test/simulate/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### Checklist
- [ ] Stripe payment intent creation
- [ ] Stripe webhook processing
- [ ] Stripe 3D Secure handling
- [ ] Stripe refunds (full and partial)
- [ ] PayPal payment creation
- [ ] PayPal approval flow
- [ ] PayPal capture
- [ ] PayPal refunds
- [ ] Order status updates on payment
- [ ] Payment failure handling

---

## Digital Products Testing

### File Upload
```bash
curl -X POST http://localhost:4000/digital-products/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/ebook.pdf" \
  -F "product_id=<PRODUCT_ID>"
```

### Download Token
```bash
# Generate download token
curl -X POST http://localhost:4000/digital-products/token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","order_id":"<ORDER_ID>"}'
```

### Download File
```bash
curl -X GET "http://localhost:4000/digital-products/download/<TOKEN>" \
  -H "Authorization: Bearer $TOKEN" \
  --output downloaded-file.pdf
```

### Kindle Integration

#### Register Kindle Device
```bash
curl -X POST http://localhost:4000/kindle/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"yourname@kindle.com","name":"My Kindle"}'
```

#### List Devices
```bash
curl http://localhost:4000/kindle/devices \
  -H "Authorization: Bearer $TOKEN"
```

#### Send to Kindle
```bash
curl -X POST http://localhost:4000/kindle/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":"<PRODUCT_ID>","device_id":"<DEVICE_ID>"}'
```

### Checklist
- [ ] Digital file upload works
- [ ] Download tokens are generated
- [ ] Tokens expire correctly
- [ ] Download count tracking
- [ ] File personalization (watermarking)
- [ ] Kindle device registration
- [ ] Send to Kindle delivery
- [ ] Email notifications sent

---

## Comments & Moderation Testing

### Post Comment
```bash
curl -X POST http://localhost:4000/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great article!",
    "article_id": "<ARTICLE_ID>"
  }'
```

### Get Comments
```bash
curl http://localhost:4000/comments?article_id=<ARTICLE_ID>
```

### Reply to Comment
```bash
curl -X POST http://localhost:4000/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Thanks for your feedback!",
    "article_id": "<ARTICLE_ID>",
    "parent_id": "<PARENT_COMMENT_ID>"
  }'
```

### Moderate Comment (Admin)
```bash
# Approve
curl -X PATCH http://localhost:4000/comments/<COMMENT_ID>/approve \
  -H "Authorization: Bearer $TOKEN"

# Reject
curl -X PATCH http://localhost:4000/comments/<COMMENT_ID>/reject \
  -H "Authorization: Bearer $TOKEN"
```

### AI Moderation Test
```bash
# Post potentially problematic content
curl -X POST http://localhost:4000/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"This is spam spam spam","article_id":"<ARTICLE_ID>"}'
# Should be flagged for moderation
```

### Checklist
- [ ] Comment creation
- [ ] Nested replies
- [ ] Comment listing with pagination
- [ ] AI moderation flags inappropriate content
- [ ] Profanity filter blocks bad words
- [ ] Admin approval/rejection
- [ ] Comment soft delete

---

## Domain Aliases Testing

**Note**: Domain Aliases is Owner-only functionality.

### 1. Create Domain Alias
```bash
# Get owner token first
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq -r '.accessToken')

# Create alias
curl -X POST http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw '{"domain":"example.com","target_route":"/shop"}'
```
**Expected**: Returns alias with `verification_token` and DNS instructions

### 2. List Domain Aliases
```bash
curl http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Get Verification Instructions
```bash
curl http://localhost:4000/domain-aliases/<ALIAS_ID>/instructions \
  -H "Authorization: Bearer $TOKEN"
```
**Expected**: DNS TXT record instructions for domain verification

### 4. Verify Domain (after adding TXT record)
```bash
curl -X POST http://localhost:4000/domain-aliases/<ALIAS_ID>/verify \
  -H "Authorization: Bearer $TOKEN"
```
**Expected**: Domain marked as verified and active (if TXT record found)

### 5. Update Alias
```bash
curl -X PATCH http://localhost:4000/domain-aliases/<ALIAS_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw '{"target_route":"/blog"}'
```

### 6. Delete Alias
```bash
curl -X DELETE http://localhost:4000/domain-aliases/<ALIAS_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Test Access Control (Non-Owner Should Fail)
```bash
# Get member token
MEMBER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  --data-raw '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')

# Try to access domain aliases (should fail with 403)
curl http://localhost:4000/domain-aliases \
  -H "Authorization: Bearer $MEMBER_TOKEN"
```
**Expected**: 403 Forbidden

### 8. Admin UI
- Login as owner at `http://localhost:3000/auth/login`
- Navigate to `http://localhost:3000/admin/domains`
- Create, view, and manage domain aliases

### Checklist
- [ ] Create alias with domain and target_route
- [ ] Verification token generated
- [ ] DNS instructions returned
- [ ] Domain verification checks TXT record
- [ ] Only owner can access endpoints
- [ ] Admin UI shows domain management
- [ ] Alias update works
- [ ] Alias deletion works

---

## Frontend E2E Testing

### Run Playwright Tests
```bash
cd frontend

# Install browsers (first time)
npx playwright install

# Run all tests
npm run test:e2e

# Run with UI
npx playwright test --ui

# Run specific test file
npx playwright test e2e/auth.spec.ts
```

### Test Coverage
- `e2e/home.spec.ts` - Homepage rendering
- `e2e/auth.spec.ts` - Login/register flows
- `e2e/shop.spec.ts` - Product listing and details
- `e2e/cart.spec.ts` - Cart operations
- `e2e/latest.spec.ts` - Article listing and details

### Manual Frontend Testing

#### Authentication
1. Navigate to `/auth/login`
2. Login with test credentials
3. Verify redirect to homepage
4. Check user menu appears

#### Shop
1. Navigate to `/shop`
2. Verify product grid loads
3. Click a product
4. Add to cart
5. View cart
6. Proceed to checkout

#### Admin
1. Login as owner/admin
2. Navigate to `/admin`
3. Test product CRUD
4. Test article CRUD
5. View orders

### Checklist
- [ ] Homepage loads
- [ ] Login flow works
- [ ] Registration flow works
- [ ] Shop page shows products
- [ ] Product detail page works
- [ ] Add to cart works
- [ ] Cart updates correctly
- [ ] Checkout form validates
- [ ] Admin dashboard loads
- [ ] Admin CRUD forms work
- [ ] Responsive design works

---

## Production Checklist

### Security
- [ ] HTTPS enabled on all endpoints
- [ ] CORS configured for production domain
- [ ] JWT secrets are unique and secure
- [ ] Rate limiting enabled
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF tokens implemented

### Payments
- [ ] Switch Stripe from `sk_test_` to `sk_live_`
- [ ] Switch PayPal from sandbox to live
- [ ] Configure production webhook URLs
- [ ] Verify domain for Apple Pay
- [ ] Test with small real payments

### Performance
- [ ] Database indexes verified
- [ ] Redis caching enabled
- [ ] Image optimization configured
- [ ] CDN configured for static assets
- [ ] Gzip compression enabled

### Monitoring
- [ ] Error tracking setup (Sentry)
- [ ] Payment failure alerts
- [ ] Server health monitoring
- [ ] Database backup configured

### Environment
- [ ] Production .env secured
- [ ] Debug mode disabled
- [ ] Logging configured appropriately
- [ ] Domain and DNS configured

---

## Quick Reference: API Endpoints (114 total)

| Module | Endpoints | Auth Required |
|--------|-----------|---------------|
| Auth | 7 | Partial |
| Capabilities | 7 | Yes |
| Media | 6 | Yes |
| Categories | 5 | Partial |
| Tags | 5 | Partial |
| Articles | 6 | Partial |
| Pages | 7 | Partial |
| Products | 7 | Partial |
| Cart | 6 | Optional |
| Orders | 7 | Yes |
| Payments | 10 | Partial |
| Comments | 12 | Partial |
| Digital Products | 11 | Yes |
| Kindle | 7 | Yes |
| Domain Aliases | 10 | Owner Only |

---

*Generated for AECMS Phase 8 - Production Readiness*
