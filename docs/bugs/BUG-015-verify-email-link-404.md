# BUG-015: Verify Email Link Produces 404

**Status:** `fixed`
**Reported:** 2026-07-05
**Severity:** `critical`
**Area:** auth, email

---

## Description

New users who self-register receive a verification email with a link that returns a 404. The backend constructs the verification URL as `${appUrl}/verify-email?token=...`, but the Next.js route lives at `/auth/verify-email`. This breaks the entire self-sign-up flow — no user can verify their email without manual intervention.

A secondary issue in the same file: the account-approval email (sent to users when an admin approves their registration) links to `${appUrl}/login` and `${appUrl}/login` in its HTML and plain-text bodies respectively, but the login page is at `/auth/login`.

---

## Reproduction Steps

1. Register a new account at `/auth/register`.
2. Open the verification email that arrives.
3. Click "Verify Email Address".
4. Observe: 404 Not Found.
5. Expected: `/auth/verify-email?token=...` page loads and confirms the account.

---

## Root Cause

`backend/src/auth/auth.service.ts`, `sendVerificationEmail()`:

- Line 665: `const verificationUrl = \`${appUrl}/verify-email?token=${token}\``  
  Should be `/auth/verify-email`.

- Line 1127 (approval email HTML): `<a href="${appUrl}/login">`  
  Should be `/auth/login`.

- Line 1135 (approval email plain-text): `Log in at: ${appUrl}/login`  
  Should be `/auth/login`.

The reset-password URL on line 756 (`/auth/reset-password`) was already correct — the verify-email path was simply never updated when auth routes were consolidated under the `/auth/` prefix.

---

## Fix Plan

Three one-line changes in `backend/src/auth/auth.service.ts`:

```
auth.service.ts:665  — /verify-email  →  /auth/verify-email
auth.service.ts:1127 — /login         →  /auth/login  (HTML anchor)
auth.service.ts:1135 — /login         →  /auth/login  (plain-text)
```

No schema changes, no migration, no frontend changes needed.

---

## Completion Report

**Fixed:** 2026-07-05
**Commit(s):** see next commit

### What changed

All three lines corrected as planned. Auth service unit tests (19/19) confirmed passing after the fix.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-05 | open | Live user hit 404 on verify-email link |
| 2026-07-05 | fixed | Three URL paths corrected in auth.service.ts |
