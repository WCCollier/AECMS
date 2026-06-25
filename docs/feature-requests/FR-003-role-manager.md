# FR-003: Role Manager

**Status:** `accepted`
**Requested:** 2026-06-25
**Deployed:** —
**Size:** `large` (schema migration + new module + new UI)

---

## Synopsis

Replace the hardcoded `UserRole` enum with a first-class `roles` table, and add a Role Manager backstage tool (gated on a new `role.manage` capability, Owner-only by default) that lets the owner create named roles, assign any combination of capabilities to them, rename or delete them, and assign them to users. The four canonical roles (Owner, Admin, Member, Guest) ship as pre-seeded rows — not code constants — so they are modifiable and deletable subject to the same rules as any other role. Owner is the only permanently protected role.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-25 | accepted | Designed and planned; ready for implementation sprint |

---

## Discussion

### Request context

The capability system is fully built on the backend (assign/revoke per role or per user, all endpoints exist). The only UI today is a role-change dropdown on `/admin/users` (uses `user.assign_role`). No UI exists for editing what capabilities a role holds, and no mechanism exists for creating custom roles at all. The owner's request: roles should be a live catalogue the owner can manage, not a compile-time constant.

### The structural problem

`RoleCapability.role` is typed `UserRole` — a PostgreSQL enum with exactly four values. Any capability assignment to a role outside those four values would be rejected at the DB level. Custom roles are therefore impossible without a schema migration.

### Schema migration strategy

The migration replaces the `UserRole` enum with a `roles` table whose `name` column (string PK) takes over as the FK target. The four existing enum values become seeded rows. String comparisons replace `UserRole.owner` enum references in the backend. Because string values are identical to current enum values (`'owner'`, `'admin'`, `'member'`, `'guest'`), most guard logic requires only a find-and-replace from `UserRole.owner` → `'owner'` etc.

**This must be a two-deploy migration** per the live deployment policy:

*Deploy 1 — additive:*
- Add `roles` table; seed four system rows
- Add `role_name TEXT` column (nullable, FK to `roles.name`) to `users` and `role_capabilities`
- Backfill both columns from the existing enum columns
- Switch all code to read/write the new string columns
- Deploy; verify

*Deploy 2 — cleanup (after Deploy 1 is confirmed stable):*
- Drop old `role UserRole` columns from `users` and `role_capabilities`
- Drop the `UserRole` PostgreSQL enum type

### Options considered

| Option | Trade-off |
|--------|-----------|
| `roles` table with string PK (recommended) | Clean, no enum after migration; string values unchanged so guards barely touched |
| Keep enum + separate `custom_roles` table | Avoids migration but creates a dual system; capability queries become conditional; messy forever |
| UUID PK on `roles` | Cleaner semantically but breaks all `user.role === 'owner'` string comparisons; more code change for no benefit |

### Decisions

- **String PK on `roles`** — name is the identity. `user.role === 'owner'` continues to work unchanged after migration. Custom role names are slugs (lowercase, hyphens, no spaces).
- **`role.manage` capability** — new cap, Owner-only in seed. Gates all role CRUD endpoints and the Role Manager UI page.
- **Owner is the only protected role** — `is_protected: true` in the roles table. Cannot edit its capability set, cannot delete it, cannot rename it. All other canonical roles (Admin, Member, Guest) are modifiable and deletable.
- **Guest role is virtual** — No user record ever has `role = 'guest'`; it exists in `roles` and `role_capabilities` only to drive `guestHasAnyCapability()` in the capability guard. The UI should show it with a "virtual — applies to logged-out visitors" note and 0 users, and make its capabilities editable.
- **Delete guard** — A role cannot be deleted while any user holds it. The delete endpoint returns 409 with a count of affected users and a suggestion to reassign them first.
- **Default registration role** — Currently hardcoded as `'member'`. If `member` is deleted, new registrations break. Mitigation: block deletion of the role currently set as the default registration role, or expose a "default role" setting in Site Settings so the owner can change it before deleting `member`.
- **No capability-scope restriction in role assignment** — Any capability (backstage or customer) can go into any role. The owner is responsible for sensible configuration.

### Out of scope

- Per-user capability overrides (adding individual caps on top of a user's role) — backend supports it but UI for it is a separate FR.
- Role hierarchy or inheritance (role A inherits from role B) — not needed; flat capability lists are sufficient.
- Public-facing role display names — roles are purely an admin concept.
- Audit logging of role CRUD operations — desirable but not blocking; can add later.

### Special cases and edge cases

| Case | Handling |
|------|----------|
| Delete role with active users | 409 — return user count, block deletion |
| Delete Owner role | 403 — always blocked (`is_protected`) |
| Edit Owner role capabilities | 403 — always blocked |
| Delete the default registration role | 409 — block until a new default is set |
| Guest role user count | Always 0 (virtual); displayed with explanatory note |
| Custom role name collision with existing role | 409 — duplicate name rejected |
| Custom role name `'owner'` or other system names | 409 — reserved names blocked |
| `syncOwnerCapabilities` (FR-002) | Unaffected — assigns `UserCapability` rows directly; role FK is irrelevant |
| Backstage access calculation | Unaffected — still driven by `≥1 backstage-scoped capability`, not role name |
| Owner `user.role === 'owner'` guard | Unaffected — string comparison, same value after migration |

---

## Design & Implementation Guide

### Overview

Three phases: (1) schema migration, (2) backend CRUD endpoints + service, (3) frontend Role Manager UI.

### New capability

```
role.manage    category: system    scope: backstage    Owner-only default
```

Add to `capability-definitions.ts` and `seed-minimal.js`.

### Backend changes

```
backend/prisma/schema.prisma
  — add Role model (name PK, label, is_protected, created_at)
  — add role_name String? to User (nullable during migration)
  — add role_name String? to RoleCapability (nullable during migration)
  — migrations: deploy-1 (additive), deploy-2 (cleanup)

backend/src/roles/                          NEW MODULE
  roles.module.ts
  roles.service.ts                          CRUD: list, create, update, delete, get-members
  roles.controller.ts                       endpoints below
  dto/create-role.dto.ts
  dto/update-role.dto.ts

backend/src/capabilities/capabilities.service.ts
  — UserRole.owner → 'owner' (string literal) throughout
  — RoleCapability queries use role_name column after deploy-1

backend/src/capabilities/capability-definitions.ts
  — add role.manage

backend/scripts/seed-minimal.js
  — seed roles table alongside capabilities
  — add role.manage to capabilities list
```

### New endpoints

| Method | Path | Cap required | Description |
|--------|------|-------------|-------------|
| `GET` | `/roles` | `role.manage` | List all roles with user counts |
| `POST` | `/roles` | `role.manage` | Create custom role |
| `PATCH` | `/roles/:name` | `role.manage` | Rename role or update label |
| `DELETE` | `/roles/:name` | `role.manage` | Delete role (fails if users assigned or is_protected) |
| `GET` | `/roles/:name/capabilities` | `role.manage` | List capabilities for role |
| `PUT` | `/roles/:name/capabilities` | `role.manage` | Replace full capability set for role |
| `GET` | `/roles/:name/members` | `role.manage` | List users assigned to role |

Role assignment to users continues to use `PATCH /users/:id/role` (existing, gated on `user.assign_role`).

### Frontend changes

```
frontend/app/admin/roles/                   NEW PAGE (gated: role.manage)
  page.tsx
  RolesClient.tsx                           role catalogue list
  components/RoleEditor.tsx                 capability checkbox matrix + save
  components/RoleDeleteModal.tsx            confirm + "N users must be reassigned" warning

frontend/app/admin/layout.tsx
  — add Roles nav item (requiredCap: 'role.manage')

frontend/app/admin/users/UsersClient.tsx
  — change role dropdown to fetch from /roles instead of hardcoded enum
```

### Data model (Deploy 1)

```prisma
model Role {
  name         String   @id            // 'owner', 'admin', 'member', 'guest', or custom slug
  label        String                  // display name: 'Owner', 'Admin', …
  is_protected Boolean  @default(false)
  created_at   DateTime @default(now())

  users             User[]           @relation("UserRole")
  role_capabilities RoleCapability[]
  @@map("roles")
}

// User.role changes from UserRole enum to:
model User {
  // …existing fields…
  role  String   @default("member")  // FK → roles.name
  // …
}

// RoleCapability.role changes from UserRole enum to:
model RoleCapability {
  // …
  role  String   // FK → roles.name
  // …
}
```

### UI: Role Manager page

**List view** (`/admin/roles`):
- Table: role label, slug, capability count, user count, Protected badge
- "New Role" button (opens inline or modal form: name + label)
- Row actions: Edit (opens editor), Delete (disabled if protected or has users)

**Role editor** (inline drawer or sub-page):
- Two-column capability matrix grouped by category: Backstage | Customer
- Checkboxes; Save button
- Owner role: all checkboxes read-only, save disabled
- Guest role: shows "virtual — applies to logged-out visitors" banner

**User assignment** (existing `/admin/users`):
- Role dropdown populated from `GET /roles` instead of hardcoded enum values

---

## Migration Plan

### Deploy 1 checklist
- [ ] Add `roles` table migration + seed rows
- [ ] Add `role_name` nullable column to `users` + backfill
- [ ] Add `role_name` nullable column to `role_capabilities` + backfill
- [ ] Switch all backend reads/writes to new columns (keep old columns, don't drop yet)
- [ ] Add `role.manage` capability + `RolesModule` endpoints
- [ ] Add Role Manager frontend
- [ ] Deploy and QA on live

### Deploy 2 checklist (after Deploy 1 stable, separate PR)
- [ ] Drop `role UserRole` from `users`
- [ ] Drop `role UserRole` from `role_capabilities`
- [ ] Drop `UserRole` enum from schema
- [ ] Remove any remaining `UserRole` enum import from TypeScript

---

## Completion Report

> _Fill in after implementation._

---

## Testing Guide

### Test scenarios

**A. Create a custom role**
1. Log in as Owner → `/admin/roles` → New Role → name: `editor`, label: `Editor`
2. Check `article.create`, `article.edit.any`, `article.publish`, `media.upload`
3. Save → role appears in catalogue with 4 capabilities
4. Go to `/admin/users` → assign a user to `editor` → verify they can create articles but not manage orders

**B. Edit a canonical role**
1. Open `admin` role → uncheck `user.assign_role` → Save
2. Log in as an Admin → verify Users page no longer shows role dropdown

**C. Delete a custom role with users**
1. Assign a user to the custom role from test A
2. Attempt to delete the `editor` role → expect 409 with user count
3. Reassign the user to `member` → retry delete → succeeds

**D. Owner role is protected**
1. Open Owner role in editor → all checkboxes read-only, Save disabled
2. `DELETE /roles/owner` → expect 403

**E. Guest role display**
1. `/admin/roles` → Guest row shows 0 users + "virtual" note
2. Can edit Guest capabilities → add `comment.article` → Save → verify unauthenticated comment attempt now allowed

**F. Default role protection**
1. Attempt to delete `member` while it is the default registration role → expect 409

### Acceptance criteria

- [ ] Custom roles can be created, edited, and deleted
- [ ] Owner role cannot be edited or deleted
- [ ] Role with active users cannot be deleted
- [ ] Default registration role cannot be deleted without first reassigning the default
- [ ] Guest role shows virtual note, capabilities editable
- [ ] Role dropdown in `/admin/users` reflects live role catalogue
- [ ] `role.manage` capability gates all role CRUD; non-owners without it see no Role Manager nav item
- [ ] Deploy 1 migration is backward compatible; live instance continues to function during rollout
- [ ] TypeScript compiles cleanly after enum removal in Deploy 2
