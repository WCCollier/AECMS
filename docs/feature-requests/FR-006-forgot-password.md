# FR-006: Forgot Password / Password Reset

**Status:** `deployed`
**Requested:** 2026-06-26
**Deployed:** —
**Size:** `small` (a few hours — two endpoints, two pages, one email template, one migration)

---

## Synopsis

Adds a self-service password reset flow triggered from the login page. The user enters their email address, receives a time-limited reset link, clicks it, and sets a new password. The link is single-use and expires after one hour. This is a prerequisite for publicly marketing the site — any user who forgets their password is currently permanently locked out with no recovery path. The login page already links to `/auth/forgot-password`; that route currently 404s.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Identified as a launch blocker during pre-marketing gap audit |
| 2026-06-26 | deployed | Implemented in one session — schema fields already existed in initial migration |

---

## Discussion

### Request context

The login page has a "Forgot password?" link pointing to `/auth/forgot-password`. No such page or backend endpoint exists. Any registered user who forgets their password cannot recover access — there is no fallback. For a publicly marketed site this is an unacceptable UX gap that will generate support requests.

### Decisions

- **Token model**: store `password_reset_token` (random hex, 64 chars) and `password_reset_expires` (DateTime) directly on the User record. No separate table needed at current scale.
- **Expiry**: 1 hour. Short enough to limit exposure if the reset email is intercepted; long enough for a user on mobile to complete the flow.
- **Single-use**: token is cleared immediately on successful reset, and also on any subsequent reset request (so requesting twice invalidates the first link).
- **Silent no-op on unknown email**: respond with the same success message whether or not the email is registered, to prevent user enumeration. The backend sends the email only when the user exists.
- **Backstage-only accounts (Owner)**: the Owner can reset their password via this flow. There is no separate admin-only reset path.
- **Rate-limiting**: not built in FR-006; the Turnstile CAPTCHA on registration is the only bot protection. Reset requests are low-friction; rate-limit can be added as a follow-on if abuse surfaces.

### Out of scope

- SMS / phone-based reset
- Security questions
- Admin-forced password reset from the Users panel
- Rate limiting on the reset request endpoint (can be added later)

---

## Design & Implementation Guide

### Schema migration

```prisma
model User {
  // ... existing fields ...
  password_reset_token    String?
  password_reset_expires  DateTime?
}
```

Migration name: `add_password_reset_fields`

### API contract

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/forgot-password` | None | Accepts `{ email }`. Generates token, sends email, returns generic success. |
| `POST` | `/auth/reset-password` | None | Accepts `{ token, newPassword }`. Validates token, hashes + saves new password, clears token. |

Both endpoints return `{ message: string }` — the message is identical whether the user exists or not (forgot) or succeeds/fails (reset, so the token isn't probed).

### Backend changes

```
backend/prisma/schema.prisma                          — add 2 fields to User
backend/prisma/migrations/YYYYMMDD_add_pw_reset/      — migration
backend/src/auth/dto/forgot-password.dto.ts           — { email: string }
backend/src/auth/dto/reset-password.dto.ts            — { token: string; newPassword: string }
backend/src/auth/auth.service.ts                      — forgotPassword(), resetPassword()
backend/src/auth/auth.controller.ts                   — POST /auth/forgot-password, POST /auth/reset-password
```

#### `forgotPassword(email)` logic
1. Find user by email (`deleted_at: null`, `email_verified: true`).
2. Generate `token = crypto.randomBytes(32).toString('hex')`.
3. Write `password_reset_token = token`, `password_reset_expires = now + 1h` to user record.
4. Send email: subject "Reset your password — {site_name}", body with reset link `{APP_URL}/auth/reset-password?token={token}`.
5. Return `{ message: 'If an account with that email exists, a reset link has been sent.' }`.

#### `resetPassword(token, newPassword)` logic
1. Find user where `password_reset_token = token` and `password_reset_expires > now` and `deleted_at: null`.
2. If not found: throw `BadRequestException('Reset link is invalid or has expired.')`.
3. Hash new password (bcrypt cost 12).
4. Update user: `password_hash = newHash`, `password_reset_token = null`, `password_reset_expires = null`.
5. Return `{ message: 'Password updated. You can now log in.' }`.

### Frontend changes

```
frontend/app/auth/forgot-password/page.tsx            — server page (force-dynamic)
frontend/app/auth/forgot-password/ForgotPasswordClient.tsx
frontend/app/auth/reset-password/page.tsx             — server page (force-dynamic)
frontend/app/auth/reset-password/ResetPasswordClient.tsx
```

**ForgotPasswordClient**: single email input field. On submit, calls `POST /auth/forgot-password`. Shows success state ("Check your email") — same UI regardless of whether the account exists.

**ResetPasswordClient**: reads `?token=` from URL query string. Shows two password fields (new + confirm). On submit, calls `POST /auth/reset-password`. On success, shows "Password updated — sign in now" with link to `/auth/login`. On failure (expired token), shows "This link has expired — request a new one" with link back to `/auth/forgot-password`.

### Email template

Plain-text + HTML:
```
Subject: Reset your password — {site_name}

Hi,

Someone (hopefully you) requested a password reset for your {site_name} account.

Click the link below to set a new password. This link expires in 1 hour.

{reset_url}

If you didn't request this, you can safely ignore this email — your password won't change.
```

Sent via the existing `EmailProvider` abstraction (SMTP or console fallback in dev).

---

## Completion Report

**Implemented:** 2026-06-26
**Commit(s):** feat: FR-006 Forgot Password / Password Reset

**Files changed:**
- `backend/src/auth/dto/forgot-password.dto.ts` — new DTO `{ email: string }`
- `backend/src/auth/dto/reset-password.dto.ts` — new DTO `{ token, newPassword }`
- `backend/src/auth/auth.service.ts` — `forgotPassword()`, `resetPassword()`, `sendPasswordResetEmail()`; site name read from ISM via Prisma (no circular dep)
- `backend/src/auth/auth.controller.ts` — `POST /auth/forgot-password`, `POST /auth/reset-password`
- `frontend/app/auth/forgot-password/page.tsx` + `ForgotPasswordClient.tsx` — email input, always-success UI
- `frontend/app/auth/reset-password/page.tsx` + `ResetPasswordClient.tsx` — token from URL, two password fields, success/error states

**No new migration required** — `password_reset_token` and `password_reset_expires` were already present in the initial schema migration (`20260129122758_initial_schema`).

**Enumeration prevention:** `forgotPassword()` always returns the same generic success message regardless of whether the email exists. The email send is wrapped in `.catch()` so SMTP failures don't alter the response either.

---

## Testing Guide

### Test scenarios

**A. Happy path**
1. Go to `/auth/login` → click "Forgot password?"
2. Enter a registered email address → submit.
3. Check inbox for reset email. Click the link.
4. Enter a new password (≥8 chars) and confirm. Submit.
5. Expected: "Password updated" message. Log in with the new password — should succeed.

**B. Unknown email (enumeration prevention)**
1. Enter an email address that is not registered.
2. Expected: identical success message ("Check your email") — no indication the account doesn't exist.

**C. Expired token**
1. Request a reset. Wait for the 1-hour window to pass (or manually set `password_reset_expires` to a past timestamp in the DB).
2. Click the link.
3. Expected: "This link has expired" error with a link to request a new one.

**D. Token reuse**
1. Request a reset. Use the reset link to set a new password successfully.
2. Attempt to use the same link again.
3. Expected: "Reset link is invalid or has expired" error.

**E. Second request invalidates first**
1. Request a reset — receive Link A.
2. Request another reset immediately — receive Link B.
3. Click Link A.
4. Expected: "Reset link is invalid or has expired" (token was overwritten by second request).

### Acceptance criteria

- [x] `/auth/forgot-password` page exists and accepts email input.
- [x] Submitting sends a reset email to the registered address.
- [x] Submitting an unknown email returns the same success UI (no enumeration).
- [x] Reset link sets new password and invalidates the token.
- [x] Expired token shows a clear error with path to request a new link.
- [x] Used token cannot be reused.
- [x] New request invalidates any prior outstanding token.
