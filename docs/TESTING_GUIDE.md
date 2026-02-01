# AECMS Comprehensive Testing Guide

**Version**: 1.0
**Last Updated**: 2026-02-01
**Status**: Phase 8 - Production Readiness Testing

---

## Quick Start

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
2. [Automated Testing](#automated-testing)
3. [Authentication Testing](#authentication-testing)
4. [Content Management Testing](#content-management-testing)
5. [Ecommerce Testing](#ecommerce-testing)
6. [Payments Testing](#payments-testing)
7. [Digital Products Testing](#digital-products-testing)
8. [Comments & Moderation Testing](#comments--moderation-testing)
9. [Frontend E2E Testing](#frontend-e2e-testing)
10. [Production Checklist](#production-checklist)

---

## Test Credentials

| Role | Email | Password | Capabilities |
|------|-------|----------|--------------|
| Owner | owner@aecms.local | Admin123!@# | All |
| Admin | admin@aecms.local | Admin123!@# | Most admin functions |
| Member | member@aecms.local | Member123!@# | Basic user functions |

**Get Auth Token**:
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq -r '.access_token')

echo $TOKEN
```

---

## Automated Testing

### Backend Unit Tests (121 tests)
```bash
cd backend && npm run test
```

### Backend E2E Tests (16 tests)
```bash
cd backend && npm run test:e2e
```

### Frontend Unit Tests (72 tests)
```bash
cd frontend && npm run test
```

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

## Quick Reference: API Endpoints (100 total)

| Module | Endpoints | Auth Required |
|--------|-----------|---------------|
| Auth | 5 | Partial |
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
| Comments | 11 | Partial |
| Digital Products | 11 | Yes |
| Kindle | 7 | Yes |

---

*Generated for AECMS Phase 8 - Production Readiness*
