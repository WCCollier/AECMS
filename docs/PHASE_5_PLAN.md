# Phase 5: Payments Integration — Configuration & Testing Guide

**Status**: ✅ Code complete — sandbox testing requires one-time CLI setup (see below)
**Architecture**: Stripe Checkout (primary) + PayPal Orders API v2 (secondary)

---

## Payment Architecture

### Stripe (Primary Provider)
Stripe Checkout — a Stripe-hosted payment page — handles all primary methods:
- Credit/Debit Cards
- Apple Pay (automatic where supported)
- Google Pay (automatic where supported)
- Amazon Pay (automatic where supported)

No separate frontend card form or SDK is needed. The backend creates a Checkout Session; the frontend redirects the browser to `session.url`; Stripe handles everything; the buyer is redirected to `/order-confirmation?order=<id>` on success or `/checkout/cancel` on cancellation.

Payment confirmation arrives via the `checkout.session.completed` webhook.

### PayPal (Secondary Provider)
PayPal Orders API v2 — redirect-based flow:
1. Backend creates a PayPal Order, returns the `payer-action` approval URL
2. Frontend redirects buyer to PayPal's site
3. Buyer approves; PayPal redirects to `/checkout/success?order=<id>&token=<paypalOrderId>`
4. The success page calls `POST /payments/capture-paypal`, which completes the charge
5. Frontend redirects to `/order-confirmation?order=<id>`

### Test Mode
`PAYMENT_TEST_MODE=true` in `backend/.env` bypasses both providers entirely, returning a local redirect URL. Use this when real sandbox credentials are unavailable or webhook forwarding is not running.

---

## Secrets

| Variable | Dev source | Value format |
|----------|------------|--------------|
| `STRIPE_SECRET_KEY` | Codespaces Secret | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output | `whsec_...` |
| `PAYPAL_CLIENT_ID` | Codespaces Secret | alphanumeric |
| `PAYPAL_CLIENT_SECRET` | Codespaces Secret | alphanumeric |
| `PAYMENT_TEST_MODE` | `backend/.env` | `true` / `false` |

Production keys go in the production environment only — never in Codespaces.

---

## One-Time Setup for Sandbox Testing

Each time a Codespace restarts, the `.env` file must be recreated and the Stripe webhook forwarder re-launched.

### Step 1 — Set `PAYMENT_TEST_MODE=false` in `backend/.env`

### Step 2 — Start the Stripe CLI forwarder
In a separate terminal:
```bash
stripe listen --forward-to localhost:4000/payments/webhooks/stripe
```
Copy the `whsec_...` secret it prints.

### Step 3 — Set `STRIPE_WEBHOOK_SECRET` in `backend/.env`
```
STRIPE_WEBHOOK_SECRET=whsec_<value from stripe listen>
```

### Step 4 — Restart the backend
```bash
# Kill the running process, then:
cd backend && npm run start:dev
```

---

## Stripe Sandbox Testing

### Test Card Numbers
| Result | Number | Exp | CVC |
|--------|--------|-----|-----|
| Success | `4242 4242 4242 4242` | Any future | Any 3 digits |
| Decline | `4000 0000 0000 0002` | Any future | Any 3 digits |
| 3D Secure | `4000 0025 0000 3155` | Any future | Any 3 digits |
| Insufficient funds | `4000 0000 0000 9995` | Any future | Any 3 digits |

### Test Flow (UI)
1. Add a product to cart as a logged-in or guest user
2. Proceed through checkout → shipping → select **Credit or Debit Card**
3. Browser redirects to Stripe's hosted Checkout page
4. Enter test card details
5. On success: redirected to `/order-confirmation?order=<id>`
6. Order status transitions to `paid` via the `checkout.session.completed` webhook

### Trigger a webhook manually (CLI)
```bash
stripe trigger checkout.session.completed
```

---

## PayPal Sandbox Testing

### Prerequisites
- A **sandbox personal account** from [developer.paypal.com](https://developer.paypal.com) → Sandbox → Accounts

### Test Flow (UI)
1. Add a product to cart
2. Proceed through checkout → shipping → select **PayPal**
3. Browser redirects to PayPal sandbox login
4. Log in with the sandbox personal account credentials
5. Click "Pay Now"
6. Redirected to `/checkout/success?order=<id>&token=<paypalOrderId>`
7. Page calls `POST /payments/capture-paypal` automatically
8. Redirected to `/order-confirmation?order=<id>`

---

## Do NOT Add a Separate Amazon Pay Provider

Amazon Pay is surfaced automatically by Stripe Checkout for eligible customers. A standalone `AmazonPayProvider` was built during development and then removed after this was confirmed. Do not re-add it.
