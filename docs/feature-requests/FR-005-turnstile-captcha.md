# FR-005: Cloudflare Turnstile CAPTCHA

**Status:** `deployed`
**Requested:** 2026-06-25
**Deployed:** 2026-06-25
**Size:** `small` (a few hours)

---

## Synopsis

Adds Cloudflare Turnstile CAPTCHA to the public registration form to block automated sign-up bots. Unlike the registration approval gate (FR-004), Turnstile works silently in the background — real users see no puzzle. The feature is fully controlled through the Admin Settings panel: saving both a site key and a secret key activates the widget; clearing either field disables it. No rebuild or redeploy is required to toggle CAPTCHA on or off.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-25 | accepted | Three bot accounts found on live site; CAPTCHA chosen over approval gate |
| 2026-06-25 | deployed | Implemented and committed to main; included in next deploy |

---

## Discussion

### Request context

Three automated bot accounts were discovered in the live users table (all unverified, none could log in). The registration form had no bot protection. The options were:

1. Enable the approval gate (FR-004) — would require admin action on every new account, adding friction for legitimate users
2. Add CAPTCHA — invisible to real users, stops bots without changing the self-service registration experience

The owner chose CAPTCHA.

The initial implementation (same session) baked `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as a Docker build arg. This had a significant drawback: to activate or deactivate CAPTCHA required a code push, a Docker rebuild, and a full redeploy. In the follow-up session the owner requested that Turnstile be brought under the ISM settings panel, matching how SMTP, Stripe, PayPal, and storage credentials are managed.

### Options considered

| Option | Trade-off |
|--------|-----------|
| Google reCAPTCHA v3 | Mature, but requires Google account, sends user data to Google, some privacy concerns |
| hCAPTCHA | Good privacy posture, but adds a puzzle challenge that can frustrate real users |
| Cloudflare Turnstile | Privacy-friendly, no puzzle, free plan available, Managed widget passes silently for normal users |
| No CAPTCHA — approval gate only | More admin overhead; approval gate is better suited for role-elevation scenarios |

### Decisions

- **Turnstile chosen** over reCAPTCHA / hCAPTCHA: no user-facing puzzle, free, privacy-preserving.
- **Managed widget type**: Cloudflare evaluates the visitor silently. The user sees a brief "Verifying…" indicator at most.
- **Keys stored in ISM**: `security.turnstile_site_key` (plaintext — it's public anyway) and `security.turnstile_secret_key_enc` (AES-256-GCM encrypted at rest via the existing KeyProvider chain). Both are saved via the existing `PATCH /settings/general` endpoint by adding `security.*` to its namespace filter.
- **Runtime site-key fetch**: the registration page calls `GET /settings-public/captcha` on mount to retrieve the site key. If it comes back null the Turnstile widget does not render. This eliminates the build-time `NEXT_PUBLIC_*` requirement entirely.
- **Inline decrypt in `AuthService`**: to avoid a circular module dependency (`AuthModule → SettingsModule → CapabilitiesModule → AuthModule`), `AuthService` reads the encrypted DB row via `PrismaService` and decrypts it inline using a locally instantiated `LocalKeyProvider`, sourcing the SEK from `ConfigService`. This deliberately does not inject `SettingsService`.
- **Env var fallback**: `TURNSTILE_SECRET_KEY` environment variable still works as a fallback during the transition period, after which it can be cleared.
- **No build-arg or GitHub Actions secret needed**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` build arg removed from `Dockerfile`; `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` removed from `deploy.yml`. Existing GH repo secrets can be deleted.

### Out of scope

- Per-page CAPTCHA (only registration is protected)
- CAPTCHA on login or password reset (Turnstile is most valuable at account creation)
- Server-side CAPTCHA challenge for API-direct registrations (the check is in `AuthService.register()` and applies to all callers, including direct API access)

---

## Design & Implementation Guide

### ISM keys

| Key | Encrypted | Description |
|-----|-----------|-------------|
| `security.turnstile_site_key` | No | Public site key — served via unauthenticated API, used in browser widget |
| `security.turnstile_secret_key_enc` | Yes (AES-256-GCM) | Server-side secret — verified against Cloudflare API on each registration |

### API contract

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings-public/captcha` | None | Returns `{ turnstile_site_key: string \| null }` |
| `PATCH` | `/settings/general` | `system.configure.general` | Already exists; now also accepts `security.*` keys |

### Backend changes

```
backend/src/settings/settings.service.ts      — add security.* keys to ENV_KEY_MAP
backend/src/settings/settings.controller.ts   — GET /settings-public/captcha; allow security.* in updateGeneral filter
backend/src/auth/auth.service.ts              — getTurnstileSecret() private method; register() uses it
```

### Frontend changes

```
frontend/app/admin/settings/SettingsClient.tsx  — CAPTCHA section in General tab; security.* in TAB_PREFIXES
frontend/app/auth/register/RegisterPageClient.tsx — runtime fetch of site key via useEffect; state replaces build-time constant
frontend/Dockerfile                             — remove NEXT_PUBLIC_TURNSTILE_SITE_KEY ARG/ENV
.github/workflows/deploy.yml                   — remove --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY from set-env-vars
```

### Key implementation notes

- `LocalKeyProvider` throws if the SEK is not a 64-character hex string. `getTurnstileSecret()` guards with `sek?.length === 64` before instantiating it.
- The registration page uses a `useRef<TurnstileInstance>` to call `.reset()` on error, because Turnstile tokens are single-use.
- The `@marsidev/react-turnstile` package was already installed from the initial implementation; no new dependency added in this session.
- `ENV_KEY_MAP` entries for `security.turnstile_site_key` → `TURNSTILE_SITE_KEY` and `security.turnstile_secret_key_enc` → `TURNSTILE_SECRET_KEY` provide backward compatibility for any instance that still has these env vars set.

---

## Completion Report

**Implemented:** 2026-06-25
**Commit(s):** `5197a1a` (feat: Turnstile CAPTCHA configured via ISM settings panel)

### What was built

- `GET /settings-public/captcha` endpoint returns the site key (or null) — no auth required.
- `PATCH /settings/general` now accepts `security.*` keys in addition to `general.*` and `identity.*`.
- `AuthService.getTurnstileSecret()` reads from `SiteSettings` DB first, decrypts inline; falls back to `TURNSTILE_SECRET_KEY` env var.
- Settings → General tab has a new CAPTCHA section: "CAPTCHA Site Key" (text field) + "CAPTCHA Secret Key" (encrypted secret field) + a green status pill when both are filled.
- Registration form fetches the site key at runtime on mount; renders the Turnstile widget only when the key is non-null.
- Dockerfile and `deploy.yml` cleaned of all CAPTCHA-related build args and Cloud Run env vars.

### Deviations from design

None — implemented exactly as decided.

### Known limitations

- No CAPTCHA on the admin login form (intentional — 2FA already protects backstage access).
- The `@marsidev/react-turnstile` package is not tree-shaken off pages where `turnstileSiteKey` is null; it just doesn't render a widget. The bundle impact is negligible.

---

## Testing Guide

### Prerequisites

- A Cloudflare account with a Turnstile site configured (Managed widget type, domain: your site's domain or `localhost`).
- Both site key and secret key from the Cloudflare Dashboard → Turnstile.
- A running AECMS instance with `SETTINGS_ENCRYPTION_KEY` set.

### Test scenarios

**A. Activate CAPTCHA via Settings panel**
1. Log into backstage as Owner.
2. Go to Settings → General → scroll to bottom.
3. Enter the Turnstile site key in "CAPTCHA Site Key".
4. Enter the secret key in "CAPTCHA Secret Key".
5. Click Save Changes.
6. Open the registration form at `/auth/register` in a private window.
7. Expected: Turnstile widget appears below the Terms checkbox.

**B. Register successfully with CAPTCHA active**
1. Fill in the registration form.
2. Wait for the Turnstile widget to show a green checkmark.
3. Submit.
4. Expected: registration succeeds; verification email sent.

**C. Submit without completing CAPTCHA**
1. With CAPTCHA active, submit the registration form before the Turnstile widget completes.
2. Expected: form shows "Please complete the CAPTCHA verification." error; submission blocked client-side.

**D. Deactivate CAPTCHA**
1. Go to Settings → General.
2. Clear the "CAPTCHA Site Key" field.
3. Save.
4. Open `/auth/register` in a private window.
5. Expected: Turnstile widget does not appear; registration works without CAPTCHA.

**E. Invalid secret key (server-side rejection)**
1. Set a valid site key but an invalid secret key.
2. Submit the registration form after the widget completes.
3. Expected: server returns 400 "CAPTCHA verification failed. Please try again." Widget resets.

**F. Permission check**
1. Log in as Admin (not Owner).
2. Go to Settings → General.
3. Expected: CAPTCHA fields are visible and editable (both Owner and Admin hold `system.configure.general` by default).

### Acceptance criteria

- [x] CAPTCHA widget appears on registration form when both keys are configured.
- [x] CAPTCHA widget does not appear when keys are absent.
- [x] Valid Turnstile token allows registration to proceed.
- [x] Missing token blocked client-side before the request is sent.
- [x] Invalid token rejected server-side with a clear error message.
- [x] Widget resets on failed registration (tokens are single-use).
- [x] No Docker rebuild required to activate or deactivate CAPTCHA.
- [x] Secret key stored encrypted in ISM; never returned in any API response.
