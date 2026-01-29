# Phase 5: Payments Integration - Implementation Plan

## Overview

Phase 5 implements payment processing with Stripe (primary) and PayPal (secondary). This document outlines what can be built autonomously and what requires human intervention.

## What Can Be Built Autonomously

### 1. Payment Service Infrastructure ✅
- Abstract PaymentProvider interface
- Stripe service implementation (code structure)
- PayPal service implementation (code structure)
- Payment controller with endpoints
- DTOs for payment requests/responses
- Webhook handlers (Stripe, PayPal)

### 2. Database Integration ✅
- Payment model already exists in schema
- Order payment fields ready
- Digital download generation on payment

### 3. Environment Configuration ✅
- Environment variable validation
- Configuration module updates
- Mock/test mode for development

### 4. Testing Infrastructure ✅
- Unit tests with mocked payment providers
- E2E tests with test mode
- Webhook signature verification tests

## What Requires Human Intervention

### 1. Stripe Setup (User Action Required)
- [ ] Create Stripe account at https://stripe.com
- [ ] Get API keys from Dashboard → Developers → API keys
- [ ] Set environment variables:
  - `STRIPE_SECRET_KEY` - sk_test_... or sk_live_...
  - `STRIPE_PUBLISHABLE_KEY` - pk_test_... or pk_live_...
  - `STRIPE_WEBHOOK_SECRET` - whsec_...
- [ ] Configure webhook endpoint in Stripe Dashboard:
  - URL: `{API_URL}/payments/webhooks/stripe`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 2. PayPal Setup (User Action Required)
- [ ] Create PayPal Developer account at https://developer.paypal.com
- [ ] Create app in Dashboard → My Apps & Credentials
- [ ] Set environment variables:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - `PAYPAL_MODE` - 'sandbox' or 'live'
- [ ] Configure webhook in PayPal Dashboard:
  - URL: `{API_URL}/payments/webhooks/paypal`
  - Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`

### 3. Testing with Real Providers
- [ ] Test Stripe with test card 4242424242424242
- [ ] Test PayPal with sandbox accounts
- [ ] Verify webhook delivery

## Implementation Phases

### Phase 5a: Core Infrastructure (Autonomous) ✅
1. Create payments module structure
2. Implement PaymentProvider interface
3. Create Stripe service with full implementation
4. Create PayPal service with full implementation
5. Implement webhook handlers
6. Add payment endpoints to orders flow
7. Write unit tests with mocks

### Phase 5b: Configuration & Documentation (Autonomous) ✅
1. Update environment validation
2. Create setup documentation
3. Create test mode that works without keys
4. Document all required environment variables

### Phase 5c: Integration Testing (Requires User)
1. User configures Stripe test keys
2. User configures PayPal sandbox
3. Test full checkout flow
4. Test webhook handling
5. Test refund flow

## API Endpoints to Create

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/payments/create-paypal-order` | POST | Create PayPal order |
| `/payments/capture-paypal/:orderId` | POST | Capture PayPal payment |
| `/payments/webhooks/stripe` | POST | Stripe webhook handler |
| `/payments/webhooks/paypal` | POST | PayPal webhook handler |
| `/payments/refund/:orderId` | POST | Process refund |

## Environment Variables Required

```bash
# Stripe (Required for Stripe payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal (Required for PayPal payments)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox  # or 'live'

# Optional - enables test mode without real keys
PAYMENT_TEST_MODE=true
```

## Files to Create

```
src/payments/
├── payments.module.ts
├── payments.controller.ts
├── payments.service.ts
├── providers/
│   ├── payment-provider.interface.ts
│   ├── stripe.provider.ts
│   └── paypal.provider.ts
├── dto/
│   ├── create-payment-intent.dto.ts
│   ├── capture-payment.dto.ts
│   └── index.ts
└── payments.service.spec.ts
```

## Checklist for User Return

When you return, you'll need to:

1. **Set up Stripe** (~10 minutes)
   - Create account / login
   - Copy test API keys to environment
   - Set up webhook endpoint

2. **Set up PayPal** (~15 minutes)
   - Create developer account / login
   - Create sandbox app
   - Copy credentials to environment
   - Set up webhook

3. **Test the integration**
   - Run E2E tests with real test keys
   - Test checkout flow in browser
   - Verify webhooks are received

4. **Review and approve**
   - Check the implementation
   - Approve for production use
