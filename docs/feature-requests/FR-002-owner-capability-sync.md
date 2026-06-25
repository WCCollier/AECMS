# FR-002: Owner Capability Sync on Login

**Status:** `deployed`
**Requested:** 2026-06-25
**Deployed:** 2026-06-25
**Size:** `small`

---

## Synopsis

On every Owner backstage login, the system upserts all canonically-defined capabilities into the database and assigns them all to the Owner's user record. This guarantees the Owner always holds the full capability set at runtime — even after an upgrade that adds new capabilities — regardless of whether the deployment seed ran correctly. The Owner can then delegate any subset of capabilities to Admin or other roles through the capability assignment matrix.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-25 | deployed | Built and shipped same session as request |

---

## Discussion

### Request context

During Phase 23 QA on the live deployment, the Mul Converter nav item was invisible to the Owner because `mul.convert` had never been inserted into the `capabilities` table. The root cause: `docker-start.sh` only ran the seed when the capabilities table was empty (fresh DB), so any capability added after the initial live deployment was silently missing.

The immediate fix (FR deploy: always run `seed-minimal.js` on startup) handles the symptom. This FR addresses the underlying requirement: the Owner must never be locked out of a capability due to incomplete seeding, and must always have the full set available to delegate.

### Options considered

| Option | Trade-off |
|--------|-----------|
| Always run seed on startup | Done as immediate fix. Belt, not suspenders — still depends on startup script execution. |
| Owner login sync (this FR) | Runtime guarantee, completely independent of seed order or startup script success. Self-healing on every login. |
| Owner bypass via wildcard at runtime | Already exists — `getUserCapabilities` returns all DB caps for owners. But if the cap isn't in the DB, it can't be delegated and won't appear in a future assignment matrix UI. |

### Decisions

- **Canonical list in code**: `backend/src/capabilities/capability-definitions.ts` is the single source of truth. Both the runtime sync and future tooling read from it. `seed-minimal.js` remains the bootstrap path (kept in sync manually).
- **Fire-and-forget async**: Sync runs concurrently with token issuance. Errors are logged but never block login. The worst case is the owner logs in successfully and a new cap doesn't appear until the next login.
- **Self-granted**: `granted_by = userId` (owner grants to themselves) — semantically correct and satisfies the DB `NOT NULL` constraint.
- **Both login paths**: Sync runs in both the no-2FA fast path (`adminLogin`) and the 2FA completion path (`verifyTwoFactor`) so it fires regardless of 2FA setup state.
- **No circular dependency**: Implemented directly in `AuthService` using `PrismaService` to avoid `AuthModule ↔ CapabilitiesModule` circular imports.

### Out of scope

- Syncing capabilities on non-Owner login (not needed — non-owners get explicitly-granted caps only).
- Removing capabilities from the owner if they are removed from the definitions list (never remove from an owner; let them revoke manually if needed).
- Capability assignment matrix UI — that's a future backstage feature; this FR only ensures the data is correct.

---

## Design & Implementation Guide

### Overview

A new `syncOwnerCapabilities(userId)` method on `AuthService` iterates `CAPABILITY_DEFINITIONS`, upserts each into the `capabilities` table, and creates `UserCapability` rows for any not already assigned. Called fire-and-forget after full token issuance on Owner login.

### Backend changes

```
backend/src/capabilities/capability-definitions.ts   — NEW: canonical TS capability list
backend/src/auth/auth.service.ts                     — import definitions; add syncOwnerCapabilities();
                                                        call after token issuance in adminLogin() and verifyTwoFactor()
```

### Frontend changes

None.

### Data model

No schema changes. Uses existing `UserCapability` table.

### API contract

No new endpoints.

### Key implementation notes

- `syncOwnerCapabilities` is async but called with `.catch()` only — login response is never delayed.
- `UserCapability` has a unique constraint on `(user_id, capability_id)` — the `findFirst`-before-`create` guard prevents duplicate key errors.
- `granted_by` is set to `userId` (self-grant) to satisfy the NOT NULL constraint.
- If a capability was previously unknown and not yet in the DB, the upsert creates it, making it immediately visible in any capability assignment UI.

---

## Completion Report

**Implemented:** 2026-06-25
**Commit(s):** see git log for FR-002

### What was built

Exactly as designed. `capability-definitions.ts` created with all 48 capabilities. `syncOwnerCapabilities` added to `AuthService`. Called at both login completion points (no-2FA path in `adminLogin`, 2FA path in `verifyTwoFactor`).

### Deviations from design

None.

### Known limitations

- Sync is sequential (one cap at a time) rather than batched. With ~48 capabilities this is negligible (~50ms), but would need batching if the cap list grew to hundreds.

---

## Testing Guide

### Prerequisites

- A live or local instance with an Owner account.
- A new capability not yet in the DB (simulate by inserting a test cap into `capability-definitions.ts` or by verifying `mul.convert` on a pre-fix live deployment).

### Test scenarios

**A. New capability appears after login**
1. Ensure a new capability is in `capability-definitions.ts` but not in the DB.
2. Log in as Owner to backstage.
3. Navigate to the relevant backstage page (e.g., Mul Converter).
4. Expected: nav item is visible; capability row exists in `user_capabilities` table.

**B. Idempotent re-login**
1. Log out and log in again as Owner.
2. Expected: no errors; no duplicate `user_capabilities` rows; login completes at normal speed.

**C. Non-owner login is unaffected**
1. Log in as Admin.
2. Expected: `user_capabilities` table not changed for admin user; admin only sees caps explicitly granted to their role.

**D. Login not blocked on sync failure**
1. (Theoretical) Simulate DB error mid-sync by temporarily breaking the connection.
2. Expected: login still succeeds; error logged to console but not surfaced to user.

### Acceptance criteria

- [x] Owner sees all defined capabilities in sidebar after first login post-deployment.
- [x] Newly added capabilities appear on next Owner login with no manual intervention.
- [x] Non-owner login flow is unchanged.
- [x] Duplicate rows are not created on repeated logins.
- [x] TypeScript compiles cleanly (`tsc --noEmit` passes).
