# Payment Sandbox Setup in GitHub Codespaces

**Written**: 2026-06-16  
**Context**: Discovered during Phase 13 QA while testing Stripe and PayPal sandbox checkouts end-to-end in a GitHub Codespace.

This document records the bugs found and fixed, plus the correct setup procedure for future Codespace restarts.

---

## Correct Setup Procedure (TL;DR)

Every time a Codespace restarts, do these steps in order:

### 1. Start the app
```bash
bash /workspaces/AECMS/start-dev.sh
```

### 2. Start Stripe listener — MUST use `--api-key`
```bash
stripe listen --api-key $STRIPE_SECRET_KEY --forward-to localhost:4000/payments/webhooks/stripe
```

The `whsec_...` it prints goes in `backend/.env` as `STRIPE_WEBHOOK_SECRET`. On subsequent restarts of the same Codespace, the secret is usually the same — check before updating.

### 3. Verify both providers are live
```bash
curl -s http://localhost:4000/payments/providers
# → {"providers":["stripe","paypal"]}
```

### 4. PayPal — no extra setup required
PayPal sandbox credentials are already in `backend/.env`. No CLI listener needed — PayPal uses capture-on-return rather than webhooks. Just need the sandbox buyer account credentials from [developer.paypal.com](https://developer.paypal.com) → Testing Tools → Sandbox Accounts → Personal (buyer) account.

### 5. Test card numbers (Stripe)
| Scenario | Card |
|----------|------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| 3D Secure | `4000 0025 0000 3155` |

Any future expiry, any CVC, any postal code.

---

## Stripe Bugs (Found During Phase 13 QA)

Three bugs stacked on top of each other. Each masked the next.

---

### Stripe Bug 1 — Wrong Stripe Account (CLI vs API Key)

**Symptom**: Stripe checkout sessions completed successfully on Stripe's side, but `stripe listen` never forwarded any webhook events to the backend. Orders stayed `pending` indefinitely.

**Root cause**: The Stripe CLI authenticates to whichever account was used in `stripe login`. This was a *different* Stripe account than the one whose API key is in `backend/.env`.

- `stripe whoami` showed: `acct_1SKmOdRJANXtuLUP`
- `STRIPE_SECRET_KEY` in `.env` belonged to: `acct_1SvDASIlQFMXryDR`

When `stripe listen` runs without `--api-key`, it subscribes to the wrong account's event stream. Real checkout events never arrive. Additionally, `stripe trigger` test events are signed with the wrong CLI secret, so signature verification fails for both real and synthetic events.

**Fix**: Always pass `--api-key` to `stripe listen`:
```bash
stripe listen --api-key sk_test_51SvDAS... --forward-to localhost:4000/payments/webhooks/stripe
```

**Diagnostic**:
```bash
stripe whoami
# Compare the account ID shown to the one embedded in STRIPE_SECRET_KEY (sk_test_51YYYYY...)
# If they differ, you need --api-key
```

---

### Stripe Bug 2 — Missing Raw Body

**Symptom**: After fixing Bug 1, events were forwarded but the backend returned 500 with `Error: Missing raw body`.

**Root cause**: Stripe's webhook verification requires the exact raw bytes of the HTTP body to compute the HMAC. NestJS's default global JSON body parser consumed the body before the webhook handler ran, discarding the raw bytes.

Adding `{ rawBody: true }` to `NestFactory.create` is the documented approach but proved unreliable — the raw body sometimes arrived as a string instead of a Buffer, which still failed HMAC verification.

**Fix**: Disable NestJS's built-in body parser and apply `express.raw()` manually for the webhook route only:

```ts
// main.ts
const app = await NestFactory.create(AppModule, { bodyParser: false });

app.use('/payments/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
```

`express.raw()` stores the body as a Buffer in `req.body`. The controller reads it as:
```ts
const payload = (req.body as Buffer | undefined) ?? req.rawBody;
```

---

### Stripe Bug 3 — Codespaces Secret Injected as `PLACEHOLDER`

**Symptom**: After fixing Bugs 1 and 2, `constructEvent` still threw `StripeSignatureVerificationError`. Manual HMAC debugging revealed the backend was verifying against the string literal `"PLACEHOLDER"`.

**Root cause**: GitHub Codespaces injects repository secrets as system-level environment variables before Node.js starts. `STRIPE_WEBHOOK_SECRET` was stored as a Codespaces secret with value `PLACEHOLDER`. `dotenv` does **not** override variables that already exist in `process.env`, so every edit to `backend/.env` was silently ignored at runtime.

**Why it was hard to find**: `cat backend/.env` showed the correct value. `echo $STRIPE_WEBHOOK_SECRET` in the terminal showed `PLACEHOLDER`. The running backend always saw `PLACEHOLDER`.

**Fix — two parts**:

Part A — load `.env` with `override: true` at the top of `main.ts`, before `NestFactory.create`:
```ts
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true });
```

Part B — `StripeProvider` reads the secret directly from `process.env` rather than `ConfigService`, because ConfigService caches values at module init time before the dotenv override takes effect:
```ts
this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  || this.configService.get<string>('STRIPE_WEBHOOK_SECRET')
  || null;
```

**Check if affected**:
```bash
echo $STRIPE_WEBHOOK_SECRET
# If this prints PLACEHOLDER, edits to .env won't take without the override fix
```

---

### Stripe Bug 4 — `FRONTEND_URL=localhost` in Success/Cancel URLs

**Symptom**: After a successful Stripe payment, the browser was redirected to `http://localhost:3000/order-confirmation?...` which doesn't load when connecting to a Codespace remotely.

**Root cause**: `backend/.env` had `FRONTEND_URL=http://localhost:3000`. Stripe bakes `success_url` and `cancel_url` into the checkout session at creation time.

**Fix**: `StripeProvider` auto-detects the Codespace URL from env vars GitHub injects into every Codespace:

```ts
private getFrontendUrl(): string {
  const codespaceName = process.env.CODESPACE_NAME;
  const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespaceName && codespaceDomain) {
    return `https://${codespaceName}-3000.${codespaceDomain}`;
  }
  return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
}
```

`FRONTEND_URL` is still used as the fallback for local Docker and production.

**Testing the full webhook chain without a checkout**:
```bash
stripe trigger checkout.session.completed --api-key $STRIPE_SECRET_KEY
# Confirms signing → raw body → HMAC → handler chain.
# Won't match a real order (no valid order_id in metadata) but that's fine for chain verification.
```

---

## PayPal Bugs (Found During Phase 13 QA)

---

### PayPal Bug 1 — `FRONTEND_URL=localhost` in Return/Cancel URLs

**Symptom**: PayPal checkout completed on sandbox.paypal.com, but the browser was redirected to `http://localhost:3000/checkout/success?...` which doesn't load in a Codespace.

**Root cause**: Same as Stripe Bug 4. PayPal's `return_url` and `cancel_url` are set when the PayPal order is created and can't be changed after the fact.

**Fix**: `PayPalProvider` got the same `getFrontendUrl()` method as `StripeProvider`.

**Recovery if you hit this**: The PayPal order IS approved on PayPal's side. Navigate manually to:
```
https://<your-codespace>-3000.app.github.dev/checkout/success?order=<AECMS_ORDER_ID>&token=<PAYPAL_ORDER_ID>
```
The success page will call capture automatically. Or call the capture endpoint directly:
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aecms.local","password":"Member123!@#"}' | jq -r '.accessToken')

curl -X POST http://localhost:4000/payments/capture-paypal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paypal_order_id":"<PAYPAL_ORDER_ID>","order_id":"<AECMS_ORDER_ID>"}'
```

---

### PayPal Bug 2 — Double Capture from React StrictMode + `INTERNAL_SERVICE_ERROR`

**Symptom**: After fixing Bug 1, the redirect landed on `/checkout/success` correctly but showed a 500 error briefly before the order confirmation appeared. Backend logs showed `INTERNAL_SERVICE_ERROR` from PayPal. The order was `processing` despite the error.

**Root cause**: Two issues compounding each other:

1. **React StrictMode** (active in development) mounts components twice to detect side effects. The `useEffect` in `PayPalSuccessClient` fired twice, sending two concurrent capture requests.

2. **PayPal's behaviour on duplicate capture**: The first request captured the payment successfully. The second request arrived milliseconds later with an already-captured order ID. PayPal returned `INTERNAL_SERVICE_ERROR` rather than a clear `ORDER_ALREADY_CAPTURED` error.

The first capture succeeded and marked the order `processing`. The second returned 500 to the frontend, showing a misleading error. The order was paid correctly.

**Fix — two parts**:

Part A — idempotency guard in `PaymentsService`: if the order is already `processing` with a `payment_intent_id`, return success immediately:
```ts
if (order.status === 'processing' && order.payment_intent_id) {
  return { success: true, order_id: order.id, payment_id: order.payment_intent_id, status: 'succeeded' };
}
```

Part B — `PayPalProvider` fallback: if PayPal's capture API returns an error, fetch the order's actual status. If it's `COMPLETED`, treat as success:
```ts
if (!response.ok) {
  const { rawStatus, captureId } = await this.getOrderRawStatus(paymentId);
  if (rawStatus === 'COMPLETED' && captureId) {
    return { id: captureId, ..., status: 'succeeded' };
  }
  throw new Error(`PayPal capture error: ${error.message}`);
}
```

---

### PayPal Bug 3 — Order Confirmation Showed Wrong Status Message

**Symptom**: After a successful PayPal capture, the confirmation page showed an amber badge and "Payment will be confirmed shortly" even though the order was `processing`.

**Root cause**: The status message in `OrderConfirmationClient.tsx` was hardcoded unconditionally regardless of actual order status.

**Fix**: Badge colour and message now reflect the actual status:
- `pending` → amber badge + "Payment will be confirmed shortly."
- `processing` / `completed` → green badge + "Payment confirmed."

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/main.ts` | `bodyParser: false` + `express.raw()` for Stripe webhook; `dotenv({ override: true })` before bootstrap |
| `backend/src/payments/providers/stripe.provider.ts` | `getFrontendUrl()`; read `STRIPE_WEBHOOK_SECRET` from `process.env` directly |
| `backend/src/payments/providers/paypal.provider.ts` | `getFrontendUrl()`; fallback to order status check on capture error |
| `backend/src/payments/payments.controller.ts` | Read `req.body` (Buffer from `express.raw`) instead of `req.rawBody` |
| `backend/src/payments/payments.service.ts` | Idempotency guard on PayPal capture |
| `frontend/app/(site)/order-confirmation/OrderConfirmationClient.tsx` | Status-aware badge colour and message |
