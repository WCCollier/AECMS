# Phase 5: Payments Integration - Configuration Guide

**Status**: ✅ Configured and Working
**Architecture**: Stripe (primary) + PayPal (secondary)

---

## Payment Architecture

### Stripe (Primary Provider)
Stripe handles **all primary payment methods** through a single integration:
- 💳 Credit/Debit Cards
- 🍎 Apple Pay
- 📱 Google Pay
- 📦 Amazon Pay

All of these are enabled via **Stripe Checkout** or **Payment Elements** - no separate integrations needed.

### PayPal (Secondary Provider)
PayPal serves as an **alternative payment method** for customers who:
- Prefer PayPal's buyer protection
- Have PayPal balance they want to use
- Don't want to enter card details

---

## Secrets Management Strategy

### Development (Codespaces)
| Secret | Source | Notes |
|--------|--------|-------|
| `STRIPE_SECRET_KEY` | Codespaces Secrets | `sk_test_...` sandbox key |
| `STRIPE_WEBHOOK_SECRET` | Codespaces Secrets | `whsec_...` from Stripe CLI |
| `PAYPAL_CLIENT_ID` | Codespaces Secrets | Sandbox app credentials |
| `PAYPAL_CLIENT_SECRET` | Codespaces Secrets | Sandbox app credentials |

### Production
| Secret | Source | Notes |
|--------|--------|-------|
| `STRIPE_SECRET_KEY` | Production env vars | `sk_live_...` live key |
| `STRIPE_WEBHOOK_SECRET` | Production env vars | From Stripe Dashboard webhook |
| `PAYPAL_CLIENT_ID` | Production env vars | Live app credentials |
| `PAYPAL_CLIENT_SECRET` | Production env vars | Live app credentials |

**Important**: Production keys should NEVER be stored in Codespaces or development environments.

---

## Current Configuration Status

### ✅ Stripe - Working
```bash
# Verified via backend logs:
[StripeProvider] Stripe provider initialized
```

### ✅ PayPal - Working
```bash
# Verified via backend logs:
[PayPalProvider] PayPal provider initialized (sandbox mode)
```

### ⏸️ Amazon Pay Provider - Deprecated
The standalone `AmazonPayProvider` is no longer needed. Amazon Pay is handled through Stripe Checkout.

---

## Local Development Setup

### 1. Start Backend
```bash
cd backend && npm run start:dev
```

### 2. Verify Providers
```bash
curl http://localhost:4000/payments/providers
# Expected: {"providers":["stripe","paypal"]}
```

### 3. Stripe Webhook Forwarding (for testing)
In a separate terminal:
```bash
stripe listen --forward-to localhost:4000/payments/webhooks/stripe
```

This forwards Stripe test webhooks to your local server.

---

## Environment Variables

### Backend `.env` (non-secret config only)
```bash
# Test Mode: Set to 'true' to simulate payments without real provider credentials
PAYMENT_TEST_MODE=false

# Frontend URL (for payment redirects)
FRONTEND_URL=http://localhost:3000

# Store name (shown to customers)
STORE_NAME=AECMS Store
```

### Codespaces Secrets (sensitive credentials)
These are already configured:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

---

## Enabling Additional Payment Methods in Stripe

To enable Apple Pay, Google Pay, and Amazon Pay in Stripe:

1. Go to **Stripe Dashboard** → **Settings** → **Payment methods**
2. Enable the payment methods you want:
   - ✅ Cards (enabled by default)
   - ✅ Apple Pay
   - ✅ Google Pay
   - ✅ Amazon Pay
3. For Apple Pay: Verify your domain in Stripe Dashboard
4. No code changes needed - Stripe Checkout/Elements handles the UI automatically

---

## Testing Procedures

### Prerequisites
```bash
# 1. Start backend
cd backend && npm run start:dev

# 2. Verify providers are available
curl http://localhost:4000/payments/providers
# Expected: {"providers":["stripe","paypal"]}

# 3. Get auth token (for authenticated requests)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq -r '.access_token')
```

---

### Stripe Sandbox Testing

#### Test Card Numbers
| Card | Number | Exp | CVC | Result |
|------|--------|-----|-----|--------|
| Success | `4242 4242 4242 4242` | Any future | Any 3 digits | Payment succeeds |
| Decline | `4000 0000 0000 0002` | Any future | Any 3 digits | Payment declined |
| Auth Required | `4000 0025 0000 3155` | Any future | Any 3 digits | 3D Secure required |
| Insufficient Funds | `4000 0000 0000 9995` | Any future | Any 3 digits | Declined |

#### Step 1: Create a Test Product
```bash
curl -X POST http://localhost:4000/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "slug": "test-product",
    "price": 1999,
    "sku": "TEST-001",
    "stock_quantity": 100,
    "visibility": "public"
  }'
# Save the product ID from response
```

#### Step 2: Add to Cart
```bash
curl -X POST http://localhost:4000/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "<PRODUCT_ID>",
    "quantity": 1
  }'
```

#### Step 3: Create Order
```bash
curl -X POST http://localhost:4000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address": {
      "street": "123 Test St",
      "city": "Test City",
      "state": "TS",
      "postal_code": "12345",
      "country": "US"
    }
  }'
# Save the order ID from response
```

#### Step 4: Create Stripe Payment Intent
```bash
curl -X POST http://localhost:4000/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<ORDER_ID>",
    "provider": "stripe"
  }'
# Response includes: payment_id, client_secret, status
```

#### Step 5: Confirm Payment (via Stripe CLI)
```bash
# In a separate terminal, start webhook forwarding:
stripe listen --forward-to localhost:4000/payments/webhooks/stripe

# Trigger a test payment event:
stripe trigger payment_intent.succeeded
```

#### Step 6: Verify Order Status
```bash
curl http://localhost:4000/orders/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
# Status should be "paid" after webhook processes
```

---

### PayPal Sandbox Testing

#### Prerequisites
- PayPal sandbox personal account credentials (from developer.paypal.com → Sandbox → Accounts)
- Note: PayPal creates test accounts automatically when you create a sandbox app

#### Step 1: Create Order (same as Stripe steps 1-3)
Follow Stripe steps 1-3 to create a product, add to cart, and create an order.

#### Step 2: Create PayPal Payment
```bash
curl -X POST http://localhost:4000/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<ORDER_ID>",
    "provider": "paypal"
  }'
# Response includes: payment_id, approval_url, status
```

#### Step 3: Approve Payment in Browser
1. Open the `approval_url` from the response in your browser
2. Login with your **sandbox personal account** credentials:
   - Find credentials at: developer.paypal.com → Sandbox → Accounts
   - Click "..." next to the Personal account → View/Edit Account
3. Click "Approve" or "Continue" to authorize the payment
4. You'll be redirected back (to FRONTEND_URL with PayPal order ID in URL)

#### Step 4: Capture the Payment
```bash
curl -X POST http://localhost:4000/payments/capture-paypal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<AECMS_ORDER_ID>",
    "paypal_order_id": "<PAYPAL_ORDER_ID_FROM_REDIRECT>"
  }'
# Response: { success: true, status: "succeeded" }
```

#### Step 5: Verify Order Status
```bash
curl http://localhost:4000/orders/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
# Status should be "paid"
```

---

### Refund Testing

#### Stripe Refund
```bash
curl -X POST http://localhost:4000/payments/refund/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested refund"
  }'
# For partial refund, add: "amount": 500 (in cents)
```

#### PayPal Refund
```bash
curl -X POST http://localhost:4000/payments/refund/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested refund"
  }'
```

---

### Test Mode (No Credentials)

If you want to test without real sandbox credentials:

```bash
# 1. Enable test mode in backend/.env
PAYMENT_TEST_MODE=true

# 2. Restart backend
npm run start:dev

# 3. All providers will be available with mock responses
curl http://localhost:4000/payments/providers
# {"providers":["stripe","paypal"]}

# 4. Create mock payment intent
curl -X POST http://localhost:4000/payments/create-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "<ORDER_ID>", "provider": "stripe"}'
# Returns mock payment_id and client_secret

# 5. Simulate payment completion
curl -X POST http://localhost:4000/payments/test/simulate/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN"
# Marks order as paid without real payment
```

---

### Testing Checklist

#### Stripe
- [ ] Provider shows in `/payments/providers`
- [ ] Create payment intent returns `client_secret`
- [ ] Webhook forwarding works (`stripe listen`)
- [ ] Payment success updates order to "paid"
- [ ] Payment failure is handled gracefully
- [ ] Refund processes successfully

#### PayPal
- [ ] Provider shows in `/payments/providers`
- [ ] Create payment returns `approval_url`
- [ ] Sandbox login and approval works
- [ ] Capture payment succeeds
- [ ] Order status updates to "paid"
- [ ] Refund processes successfully

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/payments/providers` | GET | None | List available providers |
| `/payments/create-intent` | POST | Optional | Create payment for order |
| `/payments/capture-paypal` | POST | Optional | Capture PayPal payment |
| `/payments/refund/:orderId` | POST | JWT + `order.refund` | Process refund |
| `/payments/webhooks/stripe` | POST | None | Stripe webhook |
| `/payments/webhooks/paypal` | POST | None | PayPal webhook |

---

## Production Checklist

Before going live:

- [ ] Switch Stripe keys from `sk_test_` to `sk_live_`
- [ ] Switch PayPal from sandbox to live mode
- [ ] Configure production webhook URLs in Stripe Dashboard
- [ ] Configure production webhook URLs in PayPal Dashboard
- [ ] Verify domain for Apple Pay
- [ ] Test with small real payments
- [ ] Enable HTTPS on all endpoints
- [ ] Set up monitoring for payment failures

---

*Last updated: 2026-01-31*
