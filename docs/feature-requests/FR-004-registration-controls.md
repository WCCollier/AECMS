# FR-004: Registration Controls

**Status:** `deployed`
**Requested:** 2026-06-25
**Deployed:** 2026-06-25
**Size:** `medium` (1–2 days — migration + settings + new endpoints + new UI page)

---

## Synopsis

Two related improvements to the new-user registration flow: (1) the default role assigned to new registrations is now a Site Settings value instead of a hardcoded constant, so owners who configure a more elevated default role can do so without touching code; (2) a new "require approval" toggle (Owner-only) gates new accounts behind an admin approval step before they can log in, with a dedicated approval panel and email notification to all approval-capable users when a pending registration arrives.

Also bundled: remove `'admin'` from `RESERVED_NAMES` in `roles.service.ts` — it has no systemic constraint and should be freely reclaimable after deletion.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-25 | accepted | Fully designed and planned; ready for implementation |
| 2026-06-25 | deployed | Implemented to main; CI/CD deploying to production |

---

## Discussion

### Request context

FR-003 (Role Manager) made the default registration role configurable in principle — the owner can now create any role and assign any capability set. But `auth.service.ts` still hardcodes `role: 'member'` at registration time, and the delete guard in `roles.service.ts` still hardcodes the string `'member'` as the protected default. These need to move to a settings key.

Separately: if an owner elevates the default role (e.g. to a "Patron" role with content access), they need a supervision mechanism so that role isn't handed to arbitrary anonymous sign-ups. The approval gate solves this.

### Decisions

- **`general.default_role`** setting key (string, defaults to `'member'`). Read at registration time; delete guard reads it at delete time.
- **`general.require_registration_approval`** setting key (`'true'`/`'false'`, defaults to `'false'`). The toggle is off by default so existing installs are unaffected.
- **Toggle-on backfill**: when the toggle flips `false → true`, all currently email-verified users are auto-approved (`approved_at = now()`) so no one is retroactively locked out.
- **Approval trigger point**: email verification, not registration. Notifying approvers of an unverified address would create noise from typos and bots.
- **Rejection requires a reason** (required field). Reason stored in the audit log. The account is soft-deleted, freeing the email address for re-registration.
- **Approver notification**: on email verification (when approval required), query all users who hold `registration.approve` (via role or direct user capability) and send each a notification email if SMTP is configured. Silently skipped if SMTP is not configured.
- **No real-time nav badge**: approvers get email notification; a badge would require polling on every backstage page load. Skip.
- **`registration.approve`** seeds to Admin role at install (removable via Role Manager). Admin can action approvals but cannot change the policy (`registration.configure` is Owner-only).
- **`'admin'` removed from `RESERVED_NAMES`**: no systemic constraint — it's a seed artifact. After deletion it becomes reclaimable. `'member'` also removed from `RESERVED_NAMES` (delete guard now dynamic, reading the setting).

### Out of scope

- Re-approval workflows (approved user losing access)
- Bulk approve / reject
- Approval request expiry / auto-rejection after N days
- Per-role approval policy (approval required only for certain roles)

---

## Design & Implementation Guide

### New capabilities

| Capability | Category | Scope | Default holders |
|---|---|---|---|
| `registration.configure` | system | backstage | Owner only |
| `registration.approve` | users | backstage | Owner + Admin |

Add to `capability-definitions.ts` and `seed-minimal.js`. `registration.approve` goes into `adminBackstageCaps` in seed.

### Migration (additive)

```sql
ALTER TABLE "users" ADD COLUMN "approved_at"  TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "approved_by"  TEXT REFERENCES "users"("id");
```

Both nullable. Existing users unaffected. No backfill needed in the migration itself — the backfill only runs at runtime when the toggle is switched on.

### Settings keys (seed in `seed-minimal.js` `defaultSettings`)

```javascript
{ key: 'general.default_role',                    value: 'member' },
{ key: 'general.require_registration_approval',   value: 'false'  },
```

`general.default_role` is gated on `system.configure.general` (existing atom).
`general.require_registration_approval` is gated on `registration.configure`.

### Backend changes

```
backend/prisma/schema.prisma
  — add approved_at DateTime? and approved_by String? to User

backend/prisma/migrations/YYYYMMDD_add_registration_approval_fields/
  — migration SQL (additive only)

backend/src/capabilities/capability-definitions.ts
  — add registration.configure, registration.approve

backend/scripts/seed-minimal.js
  — add both capabilities
  — add registration.approve to adminBackstageCaps
  — add general.default_role and general.require_registration_approval to defaultSettings

backend/src/roles/roles.service.ts
  — remove 'admin' and 'member' from RESERVED_NAMES
  — remove DEFAULT_REGISTRATION_ROLE constant
  — inject SettingsService; read general.default_role at delete-time for the guard

backend/src/auth/auth.service.ts
  — register(): read general.default_role from settings instead of hardcoding 'member'
  — verifyEmail(): if require_registration_approval = 'true', do NOT mark approved;
    query all registration.approve holders, send notification email to each;
    return distinct message: "Email verified. Your account is awaiting admin approval."
  — login() / adminLogin(): if require_registration_approval = 'true'
    AND user.approved_at IS NULL → throw UnauthorizedException('Your registration is
    pending approval. You will receive an email when it is reviewed.')
  — add listPendingRegistrations(): users where email_verified=true, approved_at=null,
    deleted_at=null, ordered by created_at asc
  — add approveRegistration(actorId, targetId): set approved_at + approved_by;
    send "Your account has been approved" email (skip silently if no SMTP)
  — add rejectRegistration(actorId, targetId, reason: string): audit log entry with
    reason; soft-delete (set deleted_at)

backend/src/settings/settings.service.ts (or settings.controller.ts)
  — when PATCH /settings/general sets require_registration_approval to 'true':
    auto-approve all currently email-verified, non-deleted users who have approved_at=null
    (UPDATE users SET approved_at = now() WHERE email_verified=true AND approved_at IS NULL
    AND deleted_at IS NULL)

backend/src/users/users.controller.ts
  — GET  /users/pending          → listPendingRegistrations()   requires registration.approve
  — POST /users/:id/approve      → approveRegistration()        requires registration.approve
  — POST /users/:id/reject       → rejectRegistration()         requires registration.approve
```

### Frontend changes

```
frontend/app/admin/settings/  (General tab)
  — "Default registration role" dropdown (GET /roles, exclude guest)
    gated: system.configure.general
  — "Require approval for new registrations" toggle
    gated: registration.configure (shown only if user has this cap)

frontend/app/admin/registrations/page.tsx         NEW
frontend/app/admin/registrations/RegistrationsClient.tsx   NEW
  — Table: email, username, registered date, "verified" badge
  — Approve button → POST /users/:id/approve
  — Reject button → opens inline form requiring reason text, then POST /users/:id/reject
  — Empty state: "No pending registrations" when queue is clear
  — Gated: registration.approve

frontend/app/admin/layout.tsx
  — Add "Registrations" nav item (gated: registration.approve)
    placed near Users in sidebar
```

### Email templates (new)

Two new email cases in `EmailService` / `SmtpEmailProvider`:

1. **Approver notification** (sent to each `.approve` holder on email verification):
   Subject: "New registration pending approval — [email]"
   Body: Name/email of applicant, link to `/admin/registrations`

2. **Approval confirmation** (sent to the applicant on approve):
   Subject: "Your account has been approved"
   Body: "Welcome — you can now log in at [site URL]"

---

## Completion Report

### Files changed

**Backend:**
- `prisma/schema.prisma` — added `approved_at DateTime?` + `approved_by String?` to `User`
- `prisma/migrations/20260625200000_add_registration_approval_fields/migration.sql` — additive columns
- `src/capabilities/capability-definitions.ts` — added `registration.configure` + `registration.approve`
- `scripts/seed-minimal.js` — new caps, `registration.approve` → adminBackstageCaps, 2 new defaultSettings
- `src/roles/roles.service.ts` — removed `'admin'`+`'member'` from `RESERVED_NAMES`; dynamic delete guard reads `general.default_role` from DB
- `src/auth/auth.service.ts` — `register()` reads `general.default_role`; `login()`+`adminLogin()` call `assertApproved()`; `verifyEmail()` notifies approvers when gate is on; new methods: `listPendingRegistrations()`, `approveRegistration()`, `rejectRegistration()`, `notifyApprovers()`, `assertApproved()`, `isApprovalRequired()`
- `src/settings/settings.service.ts` — toggle-on backfill in `set()`: when `general.require_registration_approval` flips to `'true'`, auto-approves all existing email-verified users
- `src/users/users.controller.ts` — 3 new endpoints: `GET /users/pending`, `POST /users/:id/approve`, `POST /users/:id/reject` (all gated `registration.approve`)
- `src/auth/auth.service.spec.ts` — extended mock with `siteSettings`, `capability`, `roleCapability`, `userCapability`; added `role_name`+`approved_at` to `mockUser`

**Frontend:**
- `app/admin/settings/SettingsClient.tsx` — General tab: default role dropdown (from live `/roles`) + approval toggle with inline warning link
- `app/admin/registrations/page.tsx` (new) — page shell with `force-dynamic`
- `app/admin/registrations/RegistrationsClient.tsx` (new) — pending table, Approve button, Reject modal (reason required), success/error flash
- `app/admin/layout.tsx` — "Registrations" nav item (UserCheck icon, gated `registration.approve`)
- `app/admin/roles/page.tsx` — added `force-dynamic` (fixes static prerender error discovered during build)

---

## Testing Guide

### Test scenarios

**A. Default role change**
1. `/admin/settings` → General → set Default Registration Role to a custom role (e.g. `contributor`)
2. Register a new account → verify email
3. Check `/admin/users` → new user shows `contributor` role

**B. Approval gate — basic flow**
1. `/admin/settings` → General → enable "Require approval for new registrations" (requires `registration.configure` cap)
2. Register new account → verify email → attempt login → expect "pending approval" error
3. Log in as admin → `/admin/registrations` → approve the account
4. Applicant can now log in

**C. Rejection with reason**
1. Pending registration in queue → click Reject
2. Submit without reason → expect validation error (reason required)
3. Submit with reason → account soft-deleted; audit log shows reason and actor
4. Same email address can be used to register again

**D. Approver email notification**
1. Approval gate ON, SMTP configured
2. New registration → verifies email
3. All users with `registration.approve` (via role or direct cap) receive notification email

**E. Toggle-on backfill**
1. Existing verified users present, approved_at = null
2. Enable approval toggle
3. All existing verified users now have approved_at set — they can still log in

**F. Default role delete guard (dynamic)**
1. Set default role to `contributor`
2. Attempt to delete `contributor` → expect 409 (it's the current default)
3. Change default role back to `member`
4. Delete `contributor` → succeeds

**G. Admin removed from RESERVED_NAMES**
1. Delete `admin` role (must have 0 users assigned first)
2. Create new role named `admin` via Role Manager → should succeed

### Acceptance criteria

- [ ] `general.default_role` setting controls new-user role assignment
- [ ] Delete guard reads setting dynamically; `member` is deletable when no longer default
- [ ] `admin` can be deleted and recreated freely
- [ ] Approval gate off by default; toggle only visible to `registration.configure` holders
- [ ] When gate is on: email-verified users cannot log in until approved
- [ ] Toggle-on backfills approved_at for all existing verified users
- [ ] Approval panel visible to `registration.approve` holders
- [ ] Rejection requires reason; reason in audit log; account soft-deleted
- [ ] Approvers receive notification email on email verification (when gate on, SMTP configured)
- [ ] Applicant receives approval email (when SMTP configured)
- [ ] TypeScript compiles cleanly; all tests pass
