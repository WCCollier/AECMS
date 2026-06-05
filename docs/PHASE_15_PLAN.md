# Phase 15: Admin Settings Module

**Project**: AECMS - Advanced Ecommerce Content Management System  
**Phase**: 15  
**Status**: 📋 PLANNED  
**PRD References**: `docs/prd/02-user-interface.md § Settings Interface`, `docs/prd/09-user-management-auth.md § Owner Capabilities`

---

## Goal

Build the `/admin/settings` module so site owners can configure the instance through the backstage UI without touching `.env` files or restarting servers. Settings are persisted in a new `SiteSettings` database table. The module is split into four tabs: **General**, **Site Identity**, **Email / SMTP**, and **Payment Providers**.

Navigation Menus (the fifth item from the PRD) is deferred — it is large enough to be its own phase and has no blocking dependency on the rest of Settings.

---

## Background

The Settings link already appears in the admin sidebar (`/admin/settings`) but the route does not exist — visiting it returns a 404. All configurable values (site name, SMTP credentials, payment keys) currently live only in `.env` and require a server restart to change, making the system non-operable for non-technical owners.

The payment key storage approach is deliberately conservative: keys are encrypted at rest using AES-256-GCM with a server-side master key (`SETTINGS_ENCRYPTION_KEY` in `.env`). The encryption key itself never enters the database. This is described in detail in the **Payment Provider Security Model** section below.

---

## Sections

- **A** — Database schema: `SiteSettings` table
- **B** — Backend: `SettingsModule` (service + controller + DTOs)
- **C** — Frontend: `/admin/settings` tabbed page
  - **C1** — General tab
  - **C2** — Site Identity tab
  - **C3** — Email / SMTP tab
  - **C4** — Payment Providers tab
- **D** — Runtime config hot-reload (backend reads from DB, not just `.env`)
- **E** — Audit logging for settings changes
- **F** — Tests & verification

---

## Section A — Database Schema

### A1 — `SiteSettings` table

Add to `prisma/schema.prisma`:

```prisma
model SiteSettings {
  id         String   @id @default(uuid())
  key        String   @unique
  value      String   // stored as JSON string; encrypted fields flagged by key convention
  updated_at DateTime @updatedAt
  updated_by String?  // user_id of last editor
}
```

One row per setting key. Keys follow a namespaced convention:

| Namespace | Examples |
|-----------|---------|
| `general.*` | `general.site_title`, `general.tagline`, `general.timezone`, `general.homepage_mode` |
| `identity.*` | `identity.logo_url`, `identity.favicon_url` |
| `email.*` | `email.smtp_host`, `email.smtp_port`, `email.smtp_user`, `email.smtp_pass_enc`, `email.from_address`, `email.from_name`, `email.kindle_from` |
| `payment.*` | `payment.stripe_publishable_key`, `payment.stripe_secret_key_enc`, `payment.stripe_webhook_secret_enc`, `payment.paypal_client_id`, `payment.paypal_client_secret_enc`, `payment.test_mode` |

Keys ending in `_enc` are stored AES-256-GCM encrypted (see Section B3).

Migration name: `add_site_settings`

### A2 — Seeding defaults

`prisma/seed.ts` (or a new `seed-settings.ts`) upserts a minimal set of defaults on first run:

```ts
{ key: 'general.site_title',    value: 'My AECMS Site' }
{ key: 'general.homepage_mode', value: 'latest_articles' }  // or 'static_page'
{ key: 'payment.test_mode',     value: 'true' }
```

All others are empty strings — the UI shows them as blank inputs until the owner fills them in.

---

## Section B — Backend: SettingsModule

### B1 — Module structure

```
backend/src/settings/
  settings.module.ts
  settings.service.ts
  settings.controller.ts
  dto/
    update-settings.dto.ts
```

`SettingsModule` imports `AuditModule` (for change logging) and is imported by `AppModule`.

### B2 — SettingsService

Core methods:

```typescript
// Returns all settings as a flat key→value map, with _enc values redacted to '••••••••'
async getAll(): Promise<Record<string, string>>

// Returns a single value; decrypts _enc keys transparently
async get(key: string): Promise<string | null>

// Upserts one or more keys; encrypts _enc keys before write; logs to AuditLog
async set(updates: Record<string, string>, userId: string): Promise<void>
```

`getAll()` is used by the frontend settings page. Encrypted fields are returned as `'••••••••'` — the actual value is never sent to the browser. To update an encrypted field the owner types a new value; if they leave the field as `'••••••••'` (or blank), the existing stored value is preserved unchanged.

### B3 — Encryption helper

```typescript
// backend/src/settings/settings.crypto.ts

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string, masterKey: string): string {
  // masterKey is hex-encoded 32-byte value from SETTINGS_ENCRYPTION_KEY env var
  // Returns base64(iv + authTag + ciphertext)
}

export function decrypt(stored: string, masterKey: string): string {
  // Reverses encrypt()
}
```

`SETTINGS_ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). If absent, the backend throws at startup with a clear message rather than silently storing plaintext.

Generation command (add to README / TESTING_GUIDE):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### B4 — Controller

```
GET  /settings          → getAll() — Owner only (BackstageGuard + system.configure capability)
PATCH /settings         → set()    — Owner only
POST /settings/test-email → sends a test email using current SMTP config
```

All endpoints: `JwtAuthGuard → BackstageGuard → CapabilityGuard('system.configure')`.

`system.configure` is an existing capability in the seed (assigned to Owner only — Admins do not get payment or SMTP credentials by default).

### B5 — Runtime config hot-reload

`SettingsService` exposes a `getEffective(key)` method that merges DB value over `.env` fallback:

```typescript
async getEffective(key: string): Promise<string> {
  const dbValue = await this.get(key);
  if (dbValue) return dbValue;
  return process.env[ENV_KEY_MAP[key]] ?? '';
}
```

`ENV_KEY_MAP` is a static mapping from setting key to env var name (e.g. `payment.stripe_secret_key_enc` → `STRIPE_SECRET_KEY`). This means the system works out of the box with only `.env` configured, and DB values take precedence once the owner fills them in through the UI.

Services that currently read `process.env.STRIPE_SECRET_KEY` etc. are updated to call `settingsService.getEffective()` instead. Because `SettingsService` is a singleton injected by NestJS DI, there is no caching concern — each call reads the current DB value.

---

## Section C — Frontend: `/admin/settings`

### C — Shared structure

`app/admin/settings/page.tsx` — server component shell  
`app/admin/settings/SettingsClient.tsx` — client component with tab state

Tab layout (Radix `Tabs`):

```
[General] [Site Identity] [Email / SMTP] [Payment Providers]
```

Each tab has its own `<form>` with a **Save** button. Changes are sent via `adminApi.patch('/settings', { ...updates })`. On success a toast confirms the save. Unsaved changes show a dirty indicator on the tab label.

Owner-only gate: the settings page checks `user.capabilities.includes('system.configure')` (or Owner role). Non-owners who navigate directly see a 403 message.

### C1 — General tab

Fields:
- **Site Title** (`general.site_title`) — text input
- **Tagline** (`general.tagline`) — text input
- **Timezone** (`general.timezone`) — select, IANA timezone list
- **Date Format** (`general.date_format`) — select: `MMM D, YYYY` / `D MMM YYYY` / `YYYY-MM-DD`
- **Homepage** (`general.homepage_mode`) — radio: "Latest Articles" / "Static Page"; if Static Page, a page-picker dropdown appears (`general.homepage_page_id`)

### C2 — Site Identity tab

Fields:
- **Logo** (`identity.logo_url`) — media picker (opens existing media library modal); preview shown
- **Favicon** (`identity.favicon_url`) — media picker; 32×32 preview shown
- **Brand Color** (`identity.brand_color`) — color picker input (`<input type="color">` + hex text fallback)

Note: typography and full theming are deferred to a post-MVP phase. Brand color sets the `--color-accent` CSS variable site-wide via a `<style>` tag injected in the root layout.

### C3 — Email / SMTP tab

Fields:
- **SMTP Host** (`email.smtp_host`) — text
- **SMTP Port** (`email.smtp_port`) — number (default 587)
- **Security** (`email.smtp_security`) — select: None / SSL / TLS / STARTTLS
- **Username** (`email.smtp_user`) — text
- **Password** (`email.smtp_pass_enc`) — password input; placeholder `••••••••` when a value is stored; leave blank to keep existing
- **From Address** (`email.from_address`) — email input
- **From Name** (`email.from_name`) — text
- **Kindle From Address** (`email.kindle_from`) — email input; helper text: "Must be on Amazon's Approved Personal Document Email List"
- **[Send Test Email]** button — calls `POST /settings/test-email`; shows success/error inline

### C4 — Payment Providers tab

See **Payment Provider Security Model** section below for the security rationale.

Fields — Stripe:
- **Mode** (`payment.test_mode`) — toggle: Test / Live; prominent warning when switching to Live
- **Publishable Key** (`payment.stripe_publishable_key`) — text (not secret; displayed in full)
- **Secret Key** (`payment.stripe_secret_key_enc`) — password input; `••••••••` when stored
- **Webhook Secret** (`payment.stripe_webhook_secret_enc`) — password input; `••••••••` when stored
- **[Verify Stripe Connection]** button — calls the Stripe API with the stored keys and returns account name or error

Fields — PayPal:
- **Client ID** (`payment.paypal_client_id`) — text (not secret)
- **Client Secret** (`payment.paypal_client_secret_enc`) — password input; `••••••••` when stored
- **[Verify PayPal Connection]** button — attempts an OAuth token fetch and returns success/error

Both provider sections show a green "Connected" / red "Not configured" status badge that updates after verification.

---

## Section D — Runtime Config Hot-Reload

Update the following services to use `settingsService.getEffective()` instead of `process.env` directly:

| Service | Keys to migrate |
|---------|----------------|
| `StripeProvider` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_TEST_MODE` |
| `PayPalProvider` | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYMENT_TEST_MODE` |
| `EmailService` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` |
| `KindleService` | `KINDLE_FROM_ADDRESS` |

`.env` values remain as fallback so the system is not broken if the Settings table is empty (e.g. fresh install, or DB reset).

---

## Section E — Audit Logging

`SettingsService.set()` calls `auditLogService.log()` after every successful write:

```typescript
await this.auditLogService.log({
  event_type: 'settings.changed',
  user_id: userId,
  resource_type: 'settings',
  changes: {
    before: { [key]: isEncrypted(key) ? '••••••••' : oldValue },
    after:  { [key]: isEncrypted(key) ? '••••••••' : newValue },
  },
});
```

Encrypted field values are always recorded as `'••••••••'` in the audit log — the audit trail records *that* a key changed, not *what it changed to*.

---

## Section F — Tests & Verification

### Backend unit tests

- `settings.service.spec.ts`
  - `getAll()` redacts `_enc` keys
  - `set()` encrypts `_enc` keys before write
  - `getEffective()` prefers DB over env
  - `set()` with `'••••••••'` value preserves existing encrypted value
  - `get()` returns null for unknown key (does not throw)

- `settings.crypto.spec.ts`
  - Round-trip: `decrypt(encrypt(plain, key), key) === plain`
  - Different IVs each call (non-deterministic)
  - Tampered ciphertext throws

### Manual verification checklist

- [ ] `/admin/settings` loads without error for Owner session
- [ ] `/admin/settings` shows 403 for Admin session
- [ ] General tab: change site title → save → title appears in browser tab on public site
- [ ] Site Identity tab: upload logo → save → logo appears in public header
- [ ] Email tab: fill SMTP credentials → Send Test Email → email logged to console (dev mode)
- [ ] Email tab: leave password as `••••••••` → save → existing password not overwritten
- [ ] Payment tab: enter Stripe keys → Verify Connection → "Connected" badge appears
- [ ] Payment tab: toggle Test/Live mode → backend uses correct key set
- [ ] Audit log shows `settings.changed` event after each save; encrypted fields show `••••••••`
- [ ] After setting Stripe keys via UI: complete a checkout flow without `.env` values set

---

## Payment Provider Security Model

### The problem

Payment provider credentials (Stripe secret key, PayPal client secret, webhook secrets) are high-value targets. If the database is compromised, plaintext keys mean an attacker can immediately initiate charges, issue refunds, or intercept webhooks.

### The approach: envelope encryption

Keys are stored encrypted in the database using **AES-256-GCM** (authenticated encryption). The encryption is performed server-side using a master key (`SETTINGS_ENCRYPTION_KEY`) that lives only in the environment — never in the database.

```
.env:            SETTINGS_ENCRYPTION_KEY=<64 hex chars>   ← never in DB
database:        payment.stripe_secret_key_enc = <iv + tag + ciphertext>
memory (briefly): plaintext key, used for API call, then discarded
browser:         never sees plaintext; encrypted fields arrive as ••••••••
```

An attacker who steals only the database gets ciphertext they cannot decrypt without the master key. An attacker who steals only the `.env` gets the master key but has no ciphertext to decrypt. Both are required simultaneously — which means a full server compromise, at which point the attacker could read the key from memory anyway.

### What this is NOT

- **Not HSM / KMS**: A proper production deployment would use AWS KMS, HashiCorp Vault, or similar — the encryption key would never be on the same host as the data. This implementation is designed for the AECMS target deployment model (single Docker host, low-traffic personal site) where a managed KMS is disproportionate.
- **Not a replacement for `.env`-only storage**: For deployments where the owner is comfortable with `.env` and server restarts, nothing changes — `.env` values continue to work as fallback and the settings UI can simply be left empty.
- **Not protection against a compromised NestJS process**: If the application itself is compromised, the attacker can call `settingsService.get()` and receive the plaintext key. Envelope encryption protects the database at rest, not the running process.

### Key rotation

When `SETTINGS_ENCRYPTION_KEY` is rotated:
1. New key generated and placed in `.env`
2. Admin triggers `POST /settings/re-encrypt` (Owner-only, not exposed in UI — curl only)
3. Service reads all `_enc` values, decrypts with old key, re-encrypts with new key, writes back
4. Old key discarded

This endpoint is not built in Phase 15 but the architecture supports it. Until it exists, rotation requires a brief manual re-entry of credentials through the UI.

### Recommendation for production deployments

If AECMS is ever deployed to a multi-tenant or commercial hosting context, migrate to AWS KMS or equivalent. The `settings.crypto.ts` helper is the only file that would need to change — the rest of the service is key-management-agnostic.

---

## Known Limitations / Deferred

| Item | Notes |
|------|-------|
| Navigation Menus | Full drag-and-drop menu builder — own phase |
| Theme selection | Post-MVP; brand color covers the MVP need |
| Key rotation UI | `POST /settings/re-encrypt` curl-only for now |
| Multi-site / multi-tenant | Out of scope for AECMS v1 |
| `.env` migration assistant | "Import from .env" button to pre-populate settings from current env vars — nice-to-have, not blocking |
