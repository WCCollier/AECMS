# BUG-011: TOTP secret wiped by FR-010 Deploy 2 — owner locked out of backstage

**Status:** `open`
**Reported:** 2026-06-28
**Severity:** `critical`
**Area:** auth, FR-010, deployment

---

## Description

After FR-010 Deploy 2 ran (dropping all plaintext PII columns), the owner's TOTP secret was permanently destroyed. The live database now has `totp_secret_enc = NULL` and `totp_enabled = true` for the owner account, making it impossible to pass the 2FA verify step. Attempting to log into backstage reaches the TOTP entry page, but submitting a valid authenticator code returns a 401 with body `"2FA not configured for this account"`. The frontend incorrectly surfaces this as "Your session expired, please log in again" rather than the actual error. The owner is fully locked out of backstage.

---

## Reproduction Steps

1. Navigate to `/admin/login` on the live site.
2. Enter valid owner credentials.
3. Get redirected to the 2FA entry page (because `totp_enabled = true`).
4. Enter a valid TOTP code from the authenticator app.
5. Observe: "Your session expired, please log in again."
6. In browser DevTools → Network → the `/auth/2fa/verify` call returns 401 with body `"2FA not configured for this account"`.

---

## Root Cause

Two compounding failures:

### 1. Backfill check missed real production account

During the FR-010 Deploy 1 → Deploy 2 decision, a query was run against Neon to confirm "no TOTP data exists" before skipping the backfill gap. That query confirmed no TOTP on the two seeded test accounts (`owner@aecms.local`, `admin@aecms.local`), but the real production owner account (`moriakul@gmail.com`) had `totp_enabled = true` and `totp_secret` set. The check was incomplete.

Deploy 2 then dropped the `totp_secret` column. At the same time, `totp_secret_enc` had never been populated for this account (Deploy 1 only dual-wrote on new `setupTotp()` calls; it never backfilled existing rows). The TOTP secret is permanently gone.

The check at `auth.service.ts:285` correctly enforces this:
```typescript
if (!user || !user.totp_secret_enc || !user.totp_enabled) {
  throw new UnauthorizedException('2FA not configured for this account');
}
```

### 2. Frontend surfaces 401 on 2FA page as "session expired"

The `adminApi` interceptor treats any 401 from a backstage-guarded endpoint as a session expiry and shows the generic "session expired" message. On the 2FA verify page, the real error is "2FA not configured" — a different problem from a session timeout — but the user sees the same generic message. This makes the actual failure non-obvious.

The two 401s in the console are: the first from the `/auth/2fa/verify` call itself, and the second from the adminApi token-refresh interceptor that silently retries after the first 401, also getting a 401, before triggering the expiry flow.

---

## Immediate Remediation (no redeploy required)

Run the following in the Neon SQL editor (direct URL, not pooler):

```sql
UPDATE users
SET totp_enabled = false, totp_secret_enc = NULL
WHERE email = 'wcc@fantasyvreality.com';
-- Verify: 1 row updated
```

After running:
1. Go to `/admin/login` and log in with owner credentials.
2. The login flow will see `totp_enabled = false` and skip the 2FA verify page entirely, granting full backstage tokens with `twoFactorSetupRequired: true`.
3. You will be redirected to the TOTP setup page (`/admin/login/setup`) with a fresh QR code.
4. Scan the QR code with your authenticator app and confirm. 2FA is re-established with a new secret stored in `totp_secret_enc`.

---

## Fix Plan

### Code fix — FR-010 Deploy 2 (complete; no change needed)

The application code is correct. `verifyTotpCode()` correctly checks `totp_secret_enc` and `totp_enabled`. The data loss was a deployment decision error, not a code bug.

### Code fix — better 2FA error surfacing

The 2FA verify page should show the actual error message from the 401 response body instead of falling through to the generic "session expired" handler.

```
frontend/app/admin/login/2fa/TwoFactorClient.tsx  — catch the error from the verify call
                                                    and display it inline rather than redirecting
```

Specifically: the `onChange` handler that fires when the 6th digit is entered should `try/catch` the `/auth/2fa/verify` call and, on error, display the response message (e.g. "2FA not configured for this account") in the form rather than relying on the interceptor's generic session-expiry path.

### Process fix — backfill check procedure

Future two-pass deployments that drop plaintext columns must verify ALL real user accounts, not just the seeded test accounts. The correct query before skipping a backfill is:

```sql
-- Confirm zero real users have data in the column being dropped
SELECT COUNT(*) FROM users
WHERE totp_secret IS NOT NULL
  AND email NOT LIKE '%@aecms.local';
```

Add this check pattern to the build order doc for any future two-pass migration.

---

## Completion Report

> _Fill in after remediation is applied._

**Fixed:** YYYY-MM-DD
**Commit(s):** `abc1234` (if code change made)

### What changed

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-28 | open | Owner locked out of backstage; TOTP secret dropped by Deploy 2 before backfill ran; SQL remediation documented above |
