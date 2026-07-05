# BUG-016: Email Treated as Case-Sensitive at Sign-In and All Auth Lookups

**Status:** `open`
**Reported:** 2026-07-05
**Severity:** `high`
**Area:** auth, backend

---

## Description

Email addresses are stored exactly as typed at registration and looked up with exact-match Prisma `findUnique` calls, which PostgreSQL resolves case-sensitively on a plain `text` column. A user who registers as `User@Example.com` cannot sign in as `user@example.com`, and vice versa. In practice this surfaces most often when a password manager or email client auto-capitalizes the address differently than the user originally typed it.

---

## Reproduction Steps

1. Register an account with `User@Example.com`.
2. Attempt to sign in with `user@example.com`.
3. Observed: "Invalid credentials" (lookup returns null).
4. Expected: sign-in succeeds — email identity is case-insensitive.

---

## Root Cause

No normalization is applied to email addresses at any entry point. The `email` column has a unique constraint but no collation override, so PostgreSQL compares byte-for-byte.

Affected call sites in `backend/src/auth/auth.service.ts`:

| Line | Operation |
|------|-----------|
| 60 | Registration duplicate check — `findUnique({ where: { email: registerDto.email } })` |
| 101 | `user.create` data — email stored as-typed, no `.toLowerCase()` |
| 137 | Customer login — `findUnique({ where: { email: loginDto.email } })` |
| 200 | Admin login — `findUnique({ where: { email: loginDto.email } })` |
| 588 | Resend verification — `findUnique({ where: { email } })` |
| 707 | Forgot password — `findUnique({ where: { email, ... } })` |

And in `backend/src/email/resend-webhook.controller.ts`:

| Line | Operation |
|------|-----------|
| 111 | Resend webhook unsubscribe — `findUnique({ where: { email } })` |

Note: the admin user-search at `auth.service.ts:984` already uses `mode: 'insensitive'` — that path is fine.

---

## Fix Plan

Normalize all inbound emails to lowercase at the service boundary, not at the DB query level. This keeps the fix localized and avoids scattering `.toLowerCase()` across every query.

**`backend/src/auth/auth.service.ts`**

```
register():    registerDto.email = registerDto.email.toLowerCase()  — before duplicate check and user.create
login():       loginDto.email = loginDto.email.toLowerCase()         — before findUnique
adminLogin():  loginDto.email = loginDto.email.toLowerCase()         — before findUnique
resendVerificationEmail(email):  email = email.toLowerCase()         — top of method
forgotPassword(email):           email = email.toLowerCase()         — top of method
```

**`backend/src/email/resend-webhook.controller.ts`**

```
handleWebhook():  normalize email extracted from webhook payload before findUnique
```

**Existing data:** Any user who registered with an uppercase email (e.g., `User@Example.com`) has that stored in the DB. The fix normalizes future writes but does not backfill existing rows. A migration to `UPDATE "User" SET email = LOWER(email)` is safe to run if any mixed-case rows are found, but should be confirmed against live data first. In practice this is unlikely — most email clients and registration flows produce lowercase addresses.

**Tests:** `auth.service.spec.ts` uses `test@example.com` throughout — no changes needed there. Add a case-normalization test if desired.

---

## Completion Report

> _Fill in after fix is deployed._

**Fixed:** —
**Commit(s):** —

### What changed

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-05 | open | Reported after live sign-in failure due to email capitalization |
