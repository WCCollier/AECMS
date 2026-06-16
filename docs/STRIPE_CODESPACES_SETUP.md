# Stripe Sandbox Setup in GitHub Codespaces

**Written**: 2026-06-16  
**Context**: Discovered during Phase 13 QA while testing a live Stripe sandbox checkout end-to-end in a GitHub Codespace.

This document records three stacked bugs that prevented Stripe webhooks from working, plus the correct setup procedure for future Codespace restarts.

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

The `whsec_...` it prints goes in `backend/.env` as `STRIPE_WEBHOOK_SECRET`. On subsequent restarts of the same Codespace, the secret is usually the same — check first before updating.

### 3. Verify
```bash
curl -s http://localhost:4000/payments/providers
# → {"providers":["stripe","paypal"]}
```

### 4. Test card numbers
| Scenario | Card |
|----------|------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| 3D Secure | `4000 0025 0000 3155` |

Any future expiry, any CVC, any postal code.

---

## The Three Stacked Bugs

These bugs were discovered in sequence during a single QA session. Each masked the next.

---

### Bug 1 — Wrong Stripe Account (CLI vs API Key)

**Symptom**: Stripe checkout sessions completed successfully (Stripe showed payment as captured), but `stripe listen` never forwarded any webhook events to the backend. Orders stayed `pending` indefinitely.

**Root cause**: The Stripe CLI (`stripe listen`) authenticates to whichever account was used in `stripe login`. This is almost always a *different* Stripe account than the one whose API key is in `backend/.env`.

- `stripe whoami` showed: `acct_1SKmOdRJANXtuLUP`
- `STRIPE_SECRET_KEY` in `.env` belonged to: `acct_1SvDASIlQFMXryDR`

When `stripe listen` runs without `--api-key`, it subscribes to events for the CLI's authenticated account. Real checkout events go to the *other* account. They never arrive at the listener.

Additionally, if `stripe trigger` is used for testing, the synthetic events are created for the CLI account and signed with that account's CLI secret (`whsec_f1...`). The backend has a different secret (`whsec_bb...`). Signature verification fails for both real and synthetic events.

**Fix**: Always pass `--api-key` to `stripe listen`:
```bash
stripe listen --api-key sk_test_51SvDAS... --forward-to localhost:4000/payments/webhooks/stripe
```

This subscribes to the correct account's event stream AND uses a CLI signing secret derived from that account, which matches what you put in `STRIPE_WEBHOOK_SECRET`.

---

### Bug 2 — Missing Raw Body (NestJS body parser consumed the body before HMAC verification)

**Symptom**: After fixing Bug 1, `stripe listen` correctly forwarded events to `localhost:4000`. The backend received them but returned 500 with `Error: Missing raw body`.

**Root cause**: Stripe's webhook verification (`stripe.webhooks.constructEvent`) requires the *exact raw bytes* of the HTTP request body to compute the HMAC. NestJS's default setup calls `NestFactory.create(AppModule)` which registers a JSON body parser globally. By the time the webhook handler received the request, the JSON had already been parsed into a JavaScript object — the raw bytes were gone.

Adding `{ rawBody: true }` to `NestFactory.create` is the documented NestJS approach, but in practice NestJS's internal body parser configuration and its interaction with the `verify` callback was unreliable — the raw body sometimes arrived as a string instead of a Buffer, which still failed HMAC verification.

**Fix**: Disable NestJS's built-in body parser entirely and register body parsers manually, putting `express.raw()` on the webhook route *before* `express.json()` on everything else:

```ts
// main.ts
const app = await NestFactory.create(AppModule, { bodyParser: false });

// Raw buffer for Stripe — must come before express.json()
app.use('/payments/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON for everything else
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
```

`express.raw()` stores the body as a `Buffer` in `req.body`. The controller reads `req.body` (not `req.rawBody`) for the webhook endpoint. The Buffer is passed directly to `constructEvent`.

In `payments.controller.ts`:
```ts
const payload = (req.body as Buffer | undefined) ?? req.rawBody;
```

---

### Bug 3 — Codespaces Secret Injected as `PLACEHOLDER`, Overriding `.env`

**Symptom**: After fixing Bugs 1 and 2, events were forwarded and received as raw Buffers. But `constructEvent` still threw `StripeSignatureVerificationError`. Manual HMAC debugging revealed the backend was verifying against the string literal `"PLACEHOLDER"` instead of the actual `whsec_...` value, even though `backend/.env` clearly contained the correct secret.

**Root cause**: GitHub Codespaces injects repository secrets as *system-level environment variables* into the Codespace shell. `STRIPE_WEBHOOK_SECRET` was stored as a Codespaces secret with value `PLACEHOLDER` (the project's placeholder before real keys were configured). System-level env vars are set in the process *before* Node.js starts.

`dotenv` (and NestJS's ConfigModule which wraps it) does **not** override environment variables that already exist in `process.env`. So every time the backend started, `dotenv` loaded `backend/.env` but silently skipped `STRIPE_WEBHOOK_SECRET` because the system had already set it to `PLACEHOLDER`.

**Why this was hard to find**: The Codespace terminal `echo $STRIPE_WEBHOOK_SECRET` shows `PLACEHOLDER`. Every edit to `.env` appeared to work — `cat backend/.env` showed the correct value — but the running backend never saw it.

**Fix — two parts**:

**Part A**: Load `.env` with `override: true` at the very top of `main.ts`, before `NestFactory.create`:

```ts
// main.ts
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true });
```

This updates `process.env` with `.env` values *before* NestJS ConfigModule initializes. The path uses `process.cwd()` (always `backend/` when started via `npm run start:dev`) rather than `__dirname` (which resolves incorrectly from `dist/`).

**Part B**: `StripeProvider` reads the webhook secret directly from `process.env` rather than from `ConfigService`, because ConfigService caches env var values at module initialization time and the cache is not invalidated by the dotenv override:

```ts
// stripe.provider.ts
this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  || this.configService.get<string>('STRIPE_WEBHOOK_SECRET')
  || null;
```

**Permanent fix**: Update the `STRIPE_WEBHOOK_SECRET` Codespaces secret (in GitHub → Repository Settings → Secrets → Codespaces) with the real `whsec_...` value once it's known. This eliminates the override dance entirely. However, since the `whsec_` changes each time the CLI is re-authenticated or a new device is used, the `.env` override approach is more practical for day-to-day development.

---

### Bonus: `FRONTEND_URL=localhost` in Stripe Success/Cancel URLs

**Symptom**: After a successful payment on Stripe's hosted checkout page, the browser was redirected to `http://localhost:3000/order-confirmation?...` instead of the Codespace's public URL. `localhost` doesn't work in a browser connecting to a Codespace remotely.

**Root cause**: `backend/.env` had `FRONTEND_URL=http://localhost:3000`. Stripe's checkout session `success_url` and `cancel_url` are set when the session is created — they're baked into the session object. The backend used `FRONTEND_URL` to construct those URLs.

**Fix**: `StripeProvider` now auto-detects the Codespace URL from environment variables that GitHub injects automatically into every Codespace:

```ts
// stripe.provider.ts
private getFrontendUrl(): string {
  const codespaceName = process.env.CODESPACE_NAME;
  const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespaceName && codespaceDomain) {
    return `https://${codespaceName}-3000.${codespaceDomain}`;
  }
  return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
}
```

No `.env` change needed in Codespaces. In local Docker or production, `FRONTEND_URL` is still used as the fallback.

---

## Debugging Notes

### Confirming the stripe listen account mismatch
```bash
stripe whoami
# Account: <name> (acct_XXXXX)
# Compare acct_XXXXX to the account ID embedded in STRIPE_SECRET_KEY (sk_test_51YYYYY...)
# If XXXXX ≠ YYYYY, you have a mismatch. Use --api-key.
```

### Confirming the Codespaces secret override
```bash
echo $STRIPE_WEBHOOK_SECRET
# If this prints PLACEHOLDER (or anything other than whsec_...), the Codespace secret is overriding .env
```

### Checking the webhook arrived and was verified
```bash
tail -f /tmp/backend.log | grep -i "webhook\|checkout.session\|StripeSignature"
```

A successful flow shows no errors and the order's `paid_at` column is set:
```bash
docker exec aecms-postgres psql -U aecms -d aecms \
  -c "SELECT order_number, status, paid_at FROM orders ORDER BY created_at DESC LIMIT 3;"
```

### Testing the webhook without a full checkout
```bash
stripe trigger checkout.session.completed --api-key $STRIPE_SECRET_KEY
```

This fires a synthetic `checkout.session.completed` event through the `stripe listen` tunnel. It won't match a real order in the DB (the metadata won't contain a valid `order_id`), but it confirms the signing, raw body parsing, and HMAC verification chain all work.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/main.ts` | `bodyParser: false` + `express.raw()` for webhook route; `dotenv({ override: true })` before bootstrap; Codespace URL detection for CORS |
| `backend/src/payments/providers/stripe.provider.ts` | `getFrontendUrl()` for Codespace-aware success/cancel URLs; read `STRIPE_WEBHOOK_SECRET` from `process.env` directly |
| `backend/src/payments/payments.controller.ts` | Read `req.body` (Buffer from `express.raw`) instead of `req.rawBody` |
