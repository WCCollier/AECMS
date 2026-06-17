# Phase 15 Completion Report: Admin Settings

**Project**: AECMS  
**Phase**: 15  
**Status**: ✅ COMPLETE  
**Primary commit**: `860958e`  
**Date**: 2026-06-17

---

## Summary

Phase 15 introduced a generalised, encrypted settings system that lets an owner configure the site without touching environment variables. All settings are stored in a dedicated `site_settings` database table with first-class support for secrets: values whose keys end in `_enc` are encrypted at rest using AES-256-GCM via a pluggable key-provider interface designed to slot into GCP/AWS KMS or HashiCorp Vault in a production deployment. The admin UI surfaces this as a 4-tab settings page covering general content, site identity, email/SMTP, and payment providers.

---

## What Was Delivered

### Area 15-A: Database Schema

**`SiteSettings` model** (`backend/prisma/schema.prisma`)

New table `site_settings`:
- `id UUID PK`
- `key VARCHAR UNIQUE` — namespaced dot-notation key (e.g. `smtp.host`, `stripe.secret_enc`)
- `value TEXT` — plaintext or AES-256-GCM ciphertext (base64)
- `updated_at TIMESTAMPTZ` — auto-updated
- `updated_by UUID` — optional user reference for audit trail

Migration: `20260617123732_add_site_settings`

**Default settings seeded** (via `backend/prisma/seed.ts`):
- `site_title` = "My Site"
- `site_tagline` = ""
- `timezone` = "UTC"
- `date_format` = "MMMM d, yyyy"
- `homepage_mode` = "articles"
- `test_mode` = "false"

### Area 15-B: KeyProvider Abstraction

**Interface** (`backend/src/settings/key-provider.interface.ts`)

```typescript
export const KEY_PROVIDER = 'KEY_PROVIDER';
export interface KeyProvider {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}
```

**`LocalKeyProvider`** (`backend/src/settings/local-key.provider.ts`)

- AES-256-GCM encryption; 32-byte key supplied as 64-char hex via `SETTINGS_ENCRYPTION_KEY` env var
- Each `encrypt()` call generates a fresh random 12-byte IV
- Serialised format: `base64(iv[12] ‖ authTag[16] ‖ ciphertext[n])`
- Throws on key that is not exactly 64 hex characters (fails fast at startup rather than at first use)
- 4 unit tests: round-trip, unique IVs per call, tampered ciphertext throws, bad key throws

**Factory in `SettingsModule`** — `SETTINGS_KMS_PROVIDER` env var selects implementation (default: `'local'`). Switch-case in the factory has stubs for `'gcp'`, `'aws'`, `'vault'` pointing to the extension location.

### Area 15-C: SettingsService

**`backend/src/settings/settings.service.ts`**

| Method | Behaviour |
|--------|-----------|
| `getAll()` | Returns all keys; values of `_enc` keys are replaced with `'••••••••'` |
| `get(key)` | Returns raw DB value for a key (decrypts if `_enc`); returns `null` if not set |
| `set(updates)` | Upserts multiple keys; encrypts `_enc` keys; skips `'••••••••'` or `''` for `_enc` keys (preserves existing secret) |
| `getEffective(key)` | DB value → env fallback via `ENV_KEY_MAP`; used internally by other modules |

All writes emit an audit log entry (`AuditLogService.log()`). Encrypted fields are always logged as `'••••••••'`.

**`ENV_KEY_MAP`** — allows `getEffective()` to fall back to legacy env vars:

| Settings key | Env fallback |
|-------------|-------------|
| `smtp.host` | `SMTP_HOST` |
| `smtp.port` | `SMTP_PORT` |
| `smtp.from` | `SMTP_FROM` |
| `stripe.secret_enc` | `STRIPE_SECRET_KEY` |
| `paypal.client_id_enc` | `PAYPAL_CLIENT_ID` |
| `paypal.client_secret_enc` | `PAYPAL_CLIENT_SECRET` |

### Area 15-D: API Endpoints

**`SettingsController`** (`/settings`) — requires backstage session + `system.configure` capability:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | All settings (redacted) |
| `PATCH` | `/settings` | Upsert one or more keys |
| `POST` | `/settings/test-email` | Send test email using current SMTP config |

**`PublicSettingsController`** (`/settings-public`) — no authentication:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings-public/theme` | `{ paletteId, fontPairingId }` for root layout |
| `GET` | `/settings-public/general` | `{ siteTitle, tagline }` for root layout |

The public controller intentionally exposes only non-sensitive display values. Secret keys (`_enc`) are never reachable through it.

### Area 15-E: Payment Provider Verification

**`PaymentsService.verifyStripe()`** — calls `stripe.balance.retrieve()` as a lightweight connectivity check; returns `{ ok: true }` on success.

**`PaymentsService.verifyPayPal()`** — calls `paypalProvider.getAccessToken()` and discards the token; returns `{ ok: true }` on success.

Both exposed via `POST /payments/verify/stripe` and `POST /payments/verify/paypal` (backstage + `system.configure`).

### Area 15-F: TestEmailService

**`backend/src/settings/test-email.service.ts`**

- Fetches current SMTP settings via `SettingsService.getEffective()`
- Builds a temporary `SmtpEmailProvider` with those values
- Sends a "Test Email from AECMS" message to the requesting user's email address
- Uses `import type { EmailProvider }` (not value import) to avoid `emitDecoratorMetadata` crash with interface types

### Area 15-G: Frontend Settings UI

**`frontend/app/admin/settings/SettingsClient.tsx`**

4-tab settings page with per-tab dirty tracking and a floating save bar:

**General tab**:
- Site Title, Tagline, Timezone (select), Date Format, Homepage Mode (articles / shop / page)

**Site Identity tab**:
- Logo URL, Favicon URL, Brand Colour (hex input + swatch preview)

**Email / SMTP tab**:
- SMTP Host, Port, Secure (checkbox), Username, Password (SecretInput with show/hide toggle)
- From Name, From Address
- "Send Test Email" button — calls `POST /settings/test-email`; shows status inline

**Payment Providers tab**:
- Stripe section: Secret Key (SecretInput), Publishable Key, Webhook Secret (SecretInput), Test Mode toggle (synced with `test_mode` setting); "Verify Connection" button
- PayPal section: Client ID, Client Secret (SecretInput), Mode toggle (sandbox / live); "Verify Connection" button
- Both verify buttons show a green ✅ / red ✗ badge after the check resolves

**`SecretInput`** component — password-type input with an eye-icon toggle. Value sent to the server is the literal typed string; if the user leaves it empty or as `'••••••••'`, the existing secret is preserved (handled in `SettingsService.set()`).

---

## Files Created / Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | `SiteSettings` model |
| `backend/prisma/migrations/20260617123732_add_site_settings/migration.sql` | New |
| `backend/prisma/seed.ts` | Default site settings seeded |
| `backend/src/settings/key-provider.interface.ts` | New |
| `backend/src/settings/local-key.provider.ts` | New |
| `backend/src/settings/local-key.provider.spec.ts` | New (4 tests) |
| `backend/src/settings/settings.service.ts` | New |
| `backend/src/settings/settings.service.spec.ts` | New (10 tests) |
| `backend/src/settings/settings.controller.ts` | New (SettingsController + PublicSettingsController) |
| `backend/src/settings/settings.module.ts` | New |
| `backend/src/settings/test-email.service.ts` | New |
| `backend/src/settings/dto/update-settings.dto.ts` | New |
| `backend/src/payments/payments.service.ts` | `verifyStripe()`, `verifyPayPal()` |
| `backend/src/payments/payments.controller.ts` | Verify endpoints |
| `backend/src/app.module.ts` | `SettingsModule` import |
| `backend/.env` | `SETTINGS_ENCRYPTION_KEY`, `SETTINGS_KMS_PROVIDER` |
| `frontend/app/admin/settings/page.tsx` | New (server shell) |
| `frontend/app/admin/settings/SettingsClient.tsx` | New (4-tab client UI) |

---

## Test Results

- **New backend unit tests**: 14 (10 in `settings.service.spec.ts` + 4 in `local-key.provider.spec.ts`)
- **Total backend tests**: 190 (all passing)
- **Frontend tests**: 125 (unchanged, all passing)

---

## Remaining / Deferred

- **GCP/AWS/Vault KeyProvider implementations** — stub comments exist in the factory switch-case; implement when Phase 19 (Cloud Run deployment) requires KMS
- **Media upload settings (S3/GCS bucket URL, CDN prefix)** — not in Phase 15 scope; will be added in Phase 19 alongside the storage provider migration
- **Webhook URL display** — the Stripe webhook endpoint URL could be shown in the UI as a convenience; deferred

---

## Configuration Required

Add to `backend/.env` before first use:

```env
SETTINGS_ENCRYPTION_KEY=<64 hex chars>   # openssl rand -hex 32
SETTINGS_KMS_PROVIDER=local
```

The key must be exactly 64 hex characters (32 bytes). If absent or wrong length, `LocalKeyProvider` throws at startup.
