# Phase 5: Payments Integration - Human Configuration Guide

**Status**: Code Complete - Awaiting Your Configuration
**Estimated Time**: 45-60 minutes for all three providers

---

## Quick Start (Test Mode First)

Before configuring real payment providers, verify the system works in test mode:

```bash
# Add to backend/.env
PAYMENT_TEST_MODE=true

# Start the backend
cd backend && npm run start:dev

# Test the endpoints
curl http://localhost:4000/payments/providers
# Should return: {"providers":["stripe","paypal","amazon_pay"]}
```

---

## Your Configuration Tasks

### Task 1: Stripe Setup (Primary Provider)

**Time**: ~10 minutes

#### Step 1.1: Create/Access Stripe Account
1. Go to https://dashboard.stripe.com
2. Sign up or log in
3. Make sure you're in **Test Mode** (toggle in top-right)

#### Step 1.2: Get API Keys
1. Go to **Developers** → **API keys**
2. Copy the **Secret key** (starts with `sk_test_`)
3. Copy the **Publishable key** (starts with `pk_test_`) - for frontend later

#### Step 1.3: Configure Webhook
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   - Local development: Use [Stripe CLI](https://stripe.com/docs/stripe-cli) or ngrok
   - Production: `https://your-domain.com/payments/webhooks/stripe`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

#### Step 1.4: Set Environment Variables
Add to `backend/.env`:
```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

#### Step 1.5: Test Stripe Integration
```bash
# Restart backend
npm run start:dev

# Verify Stripe is available
curl http://localhost:4000/payments/providers
# Should include "stripe" in the list

# Create a test order first (requires auth), then:
# POST /payments/create-intent with {"order_id": "...", "provider": "stripe"}
```

**Test Card Numbers**:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

---

### Task 2: PayPal Setup (Secondary Provider)

**Time**: ~15 minutes

#### Step 2.1: Create/Access PayPal Developer Account
1. Go to https://developer.paypal.com
2. Log in with your PayPal account (or create one)

#### Step 2.2: Create Sandbox App
1. Go to **Dashboard** → **My Apps & Credentials**
2. Make sure you're in **Sandbox** mode
3. Click **Create App**
4. Enter app name: "AECMS Store" (or your preference)
5. Select **Merchant** as the app type
6. Click **Create App**

#### Step 2.3: Get Credentials
1. On your app page, copy:
   - **Client ID**
   - **Secret** (click "Show" to reveal)

#### Step 2.4: Configure Webhook
1. Scroll down to **Webhooks** section
2. Click **Add Webhook**
3. Enter your webhook URL:
   - Local: Use ngrok tunnel
   - Production: `https://your-domain.com/payments/webhooks/paypal`
4. Select events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
5. Click **Save**

#### Step 2.5: Set Environment Variables
Add to `backend/.env`:
```bash
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_secret_here
PAYPAL_MODE=sandbox
```

#### Step 2.6: Test PayPal Integration
```bash
# Restart backend
npm run start:dev

# Verify PayPal is available
curl http://localhost:4000/payments/providers
# Should include "paypal" in the list
```

**Sandbox Test Accounts**:
- Go to **Sandbox** → **Accounts** in PayPal Developer Dashboard
- Use the auto-generated buyer account for testing
- Email format: `sb-xxxxx@personal.example.com`
- Password: View in account details

---

### Task 3: Amazon Pay Setup (Tertiary Provider)

**Time**: ~20 minutes

#### Step 3.1: Register for Amazon Pay
1. Go to https://pay.amazon.com/merchant
2. Click **Register** or **Sign In**
3. Complete merchant registration if new

#### Step 3.2: Access Seller Central
1. Go to https://sellercentral.amazon.com
2. Navigate to **Integration** → **MWS Access** (or Amazon Pay Integration)

#### Step 3.3: Create API Credentials
1. In Seller Central, go to **Integration Central**
2. Click **Amazon Pay**
3. Generate new API credentials:
   - Note your **Merchant ID** (starts with `A`)
   - Note your **Public Key ID**
   - Download your **Private Key** (PEM file) - SAVE THIS SECURELY

#### Step 3.4: Configure IPN (Instant Payment Notification)
1. In Amazon Pay settings, find **IPN Settings**
2. Add your IPN URL:
   - Production: `https://your-domain.com/payments/webhooks/amazon-pay`
   - Note: Amazon Pay uses SNS for notifications

#### Step 3.5: Set Environment Variables
Add to `backend/.env`:
```bash
AMAZON_PAY_MERCHANT_ID=A1B2C3D4E5F6G7
AMAZON_PAY_PUBLIC_KEY_ID=LIVE-XXXXXXXX
AMAZON_PAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
YOUR_PRIVATE_KEY_CONTENT_HERE
-----END RSA PRIVATE KEY-----"
AMAZON_PAY_REGION=na
AMAZON_PAY_SANDBOX=true
```

**Note**: For the private key, you can either:
- Paste the entire key as a single line with `\n` for newlines
- Or set `AMAZON_PAY_PRIVATE_KEY_PATH=/path/to/key.pem` (requires code modification)

#### Step 3.6: Test Amazon Pay Integration
```bash
# Restart backend
npm run start:dev

# Verify Amazon Pay is available
curl http://localhost:4000/payments/providers
# Should include "amazon_pay" in the list

# Get button config for frontend
curl http://localhost:4000/payments/amazon-pay/button-config
```

---

## Complete Environment Variables

Here's your complete `backend/.env` additions:

```bash
# ===================
# PAYMENT CONFIGURATION
# ===================

# Test Mode (set to false when using real credentials)
PAYMENT_TEST_MODE=false

# Frontend URL (for payment redirects)
FRONTEND_URL=http://localhost:3000

# Store name (shown to customers)
STORE_NAME=AECMS Store

# ----- Stripe -----
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ----- PayPal -----
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox

# ----- Amazon Pay -----
AMAZON_PAY_MERCHANT_ID=A...
AMAZON_PAY_PUBLIC_KEY_ID=LIVE-...
AMAZON_PAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
AMAZON_PAY_REGION=na
AMAZON_PAY_SANDBOX=true
```

---

## Testing Checklist

### Basic Verification
- [ ] `PAYMENT_TEST_MODE=false` in `.env`
- [ ] Backend restarts without errors
- [ ] `GET /payments/providers` returns configured providers

### Stripe Testing
- [ ] Create order via `POST /orders`
- [ ] Create payment intent via `POST /payments/create-intent`
- [ ] Receive `client_secret` in response
- [ ] (Frontend) Complete payment with test card `4242424242424242`
- [ ] Verify webhook received at `/payments/webhooks/stripe`
- [ ] Verify order status changed to `paid`

### PayPal Testing
- [ ] Create order via `POST /orders`
- [ ] Create payment intent via `POST /payments/create-intent` with `provider: "paypal"`
- [ ] Receive approval URL in response
- [ ] (Frontend) Redirect user to PayPal approval URL
- [ ] User approves payment in PayPal sandbox
- [ ] Capture payment via `POST /payments/capture-paypal`
- [ ] Verify order status changed to `paid`

### Amazon Pay Testing
- [ ] Create order via `POST /orders`
- [ ] Create payment intent via `POST /payments/create-intent` with `provider: "amazon_pay"`
- [ ] Receive checkout session ID in response
- [ ] (Frontend) Initialize Amazon Pay button with session ID
- [ ] User completes payment in Amazon Pay sandbox
- [ ] Capture payment via `POST /payments/capture-amazon-pay`
- [ ] Verify order status changed to `paid`

### Refund Testing
- [ ] Create and complete a payment
- [ ] Process refund via `POST /payments/refund/:orderId`
- [ ] Verify refund appears in provider dashboard
- [ ] Verify order status changed to `refunded`

---

## Webhook Testing (Local Development)

For local development, you need to expose your localhost to receive webhooks.

### Option 1: Stripe CLI (Recommended for Stripe)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:4000/payments/webhooks/stripe

# Copy the webhook signing secret it provides
```

### Option 2: ngrok (Works for all providers)
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Expose your backend
ngrok http 4000

# Use the https URL (e.g., https://abc123.ngrok.io) for webhooks
```

---

## Troubleshooting

### "Provider not available" error
- Check environment variables are set correctly
- Restart the backend after changing `.env`
- Check backend logs for initialization errors

### Webhooks not receiving
- Verify webhook URL is publicly accessible
- Check webhook secret matches
- Look at provider's webhook logs for delivery attempts

### Payment fails silently
- Check backend console for errors
- Verify order exists and is in `pending` status
- Check provider dashboard for failed attempts

### Amazon Pay signature errors
- Verify private key is correctly formatted
- Check region matches your merchant account
- Ensure sandbox mode matches account type

---

## Production Checklist

Before going live:

- [ ] Switch all providers from test/sandbox to live mode
- [ ] Update environment variables with live API keys
- [ ] Update webhook URLs to production domain
- [ ] Test with small real payments
- [ ] Enable HTTPS on all webhook endpoints
- [ ] Set up monitoring for payment failures
- [ ] Configure error alerting

---

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/payments/providers` | GET | None | List available providers |
| `/payments/create-intent` | POST | Optional | Create payment for order |
| `/payments/capture-paypal` | POST | Optional | Capture PayPal payment |
| `/payments/capture-amazon-pay` | POST | Optional | Capture Amazon Pay payment |
| `/payments/amazon-pay/button-config` | GET | None | Get Amazon Pay button config |
| `/payments/refund/:orderId` | POST | JWT + `order.refund` | Process refund |
| `/payments/webhooks/stripe` | POST | None | Stripe webhook |
| `/payments/webhooks/paypal` | POST | None | PayPal webhook |
| `/payments/webhooks/amazon-pay` | POST | None | Amazon Pay IPN |
| `/payments/test/simulate/:orderId` | POST | JWT | Simulate payment (test mode) |

---

*Last updated: 2026-01-30*
