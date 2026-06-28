# BUG-010: No way to edit display name (first/last) on the account page

**Status:** `fixed`
**Reported:** 2026-06-28
**Severity:** `high`
**Area:** frontend, auth, account

---

## Description

The customer-facing `/account` page shows the user's first name, last name, and username in the Profile section, but provides no way to edit them. There is no "Edit Profile" form and no backend endpoint to update these fields. Users who need to set or correct their display name have no path to do so — this is especially pressing because the PII encryption migration (FR-010 Deploy 2) nulled out all existing names when the plaintext columns were dropped.

---

## Reproduction Steps

1. Log in as any user on the customer-facing site.
2. Navigate to `/account`.
3. Observe the Profile section shows Name/Username/Email/Role read-only.
4. There is no edit button, no form, and no way to change first name, last name, or username.

Expected: an Edit Profile section (or inline edit) that lets users update `first_name`, `last_name`, and optionally `username`.

---

## Root Cause

Two gaps, both missing:

- **Backend**: `auth.controller.ts` has `PATCH /auth/change-password` and `PATCH /auth/shipping-address` but no `PATCH /auth/profile` endpoint. `AuthService` has no `updateProfile()` method.
- **Frontend**: `AccountPageClient.tsx` (lines 170–202) renders the Profile section as display-only with no edit state, no form, and no API call.

---

## Fix Plan

### Backend

Add `PATCH /auth/profile` to `AuthController`, protected by `JwtAuthGuard` (customer session).

DTO (`UpdateProfileDto`):
- `first_name?: string` (max 100)
- `last_name?: string` (max 100)
- `username?: string` (max 50, alphanumeric + underscores, unique)

`AuthService.updateProfile(userId, dto)`:
- Encrypt `first_name`/`last_name` via `EncryptionService` before writing to `first_name_enc`/`last_name_enc`
- If `username` provided, check uniqueness (throw 409 if taken)
- Return updated user shape matching `GET /auth/me`

```
backend/src/auth/dto/update-profile.dto.ts   — new DTO
backend/src/auth/auth.service.ts             — add updateProfile()
backend/src/auth/auth.controller.ts          — add PATCH /auth/profile
```

### Frontend

Add an "Edit Profile" collapsible section to `AccountPageClient.tsx`, following the same accordion pattern as Change Password.

Fields: First name, Last name, Username (optional).

On submit: `api.patch('/auth/profile', { first_name, last_name, username })`, then refresh `AuthContext` user.

```
frontend/app/(site)/account/AccountPageClient.tsx  — add profile edit section + state
```

### Key considerations
- Write to `first_name_enc`/`last_name_enc` (encrypted columns), not the dropped plaintext columns.
- Username uniqueness must be checked server-side; return a clear 409 message.
- After save, the auth context user object must be refreshed so the Profile section immediately reflects the new name.
- OAuth users may not have a password but should still be able to edit their profile.

---

## Completion Report

**Fixed:** 2026-06-28
**Commit(s):** `5156afe`

### What changed

Implemented as planned. `PATCH /auth/profile` added to `AuthController` behind `JwtAuthGuard`. New `UpdateProfileDto` accepts optional `firstName`, `lastName`, `username`. `AuthService.updateProfile()` encrypts names via `EncryptionService` before writing to `first_name_enc`/`last_name_enc`; checks username uniqueness and throws 409 on conflict. Returns decrypted field values.

Account page gains a collapsible **Edit Profile** section following the same accordion pattern as Change Password. Opens pre-filled with current values. Only non-empty fields are sent — blank fields are skipped, preserving existing values. Calls `refreshUser()` on success so the Profile header reflects the new name immediately.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-28 | open | Initial report — oversight discovered after FR-010 Deploy 2 nulled existing names |
| 2026-06-28 | fixed | PATCH /auth/profile + Edit Profile section on account page deployed in 5156afe |
