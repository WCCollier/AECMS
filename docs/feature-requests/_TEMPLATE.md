# FR-000: Feature Name

**Status:** `draft` <!-- draft | accepted | in-planning | in-dev | in-testing | deployed | deferred | rejected -->
**Requested:** YYYY-MM-DD
**Deployed:** —
**Size:** `small` <!-- small (hours) | medium (1-2 days) | large (3-5 days) -->

---

## Synopsis

One paragraph. What the feature does, who it's for, and why it matters. Written so a newcomer can understand the value without reading further.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| YYYY-MM-DD | draft | Initial request |

---

## Discussion

### Request context
Where the request came from and what problem it solves. Include relevant user quotes, pain points, or session context that motivated the feature.

### Options considered
List alternatives that were weighed. For small features this may just be "do it vs. don't do it."

| Option | Trade-off |
|--------|-----------|
| Option A | … |
| Option B | … |

### Decisions
What was decided and why. Bullet the key choices so future-you can understand the reasoning without re-reading the full thread.

- **Decision 1**: Reason.
- **Decision 2**: Reason.

### Out of scope
Things explicitly excluded and why, to prevent scope creep.

---

## Design & Implementation Guide

### Overview
Brief architectural summary — what touches what.

### Backend changes
List files, endpoints, migrations, and DTOs affected.

```
backend/src/module/feature.service.ts   — add X method
backend/prisma/schema.prisma            — add Y field
Migration: add_y_to_table
```

### Frontend changes
List pages, components, and hooks affected.

```
frontend/app/admin/feature/page.tsx     — new page
frontend/components/admin/FeatureForm   — new component
```

### Data model
If a schema change is needed, describe it here. Additive only (see Live Deployment Policy).

```prisma
model ExistingModel {
  // ...existing fields...
  new_field  String?   // added for FR-000
}
```

### API contract
New or modified endpoints.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /resource | backstage | … |
| POST | /resource | backstage | … |

### Key implementation notes
Anything non-obvious: edge cases, constraints, order-of-operations, gotchas.

---

## Completion Report

> _Fill in after implementation. Delete this block if the feature was rejected or deferred._

**Implemented:** YYYY-MM-DD
**Commit(s):** `abc1234`

### What was built
Summary of what actually shipped, noting any deviations from the design above.

### Deviations from design
- Item deferred: reason.
- Approach changed: reason.

### Known limitations
Things that work but aren't ideal, and why they were left as-is.

---

## Testing Guide

> _Written alongside implementation; updated if issues surface during QA._

### Prerequisites
- Running instance (local or live): specify which.
- Seeded test data needed: describe.

### Test scenarios

**A. Happy path**
1. Step one.
2. Step two.
3. Expected result.

**B. Edge case**
1. Step one.
2. Expected result.

**C. Permission / access control**
1. Log in as a role that should NOT have access.
2. Attempt the action.
3. Confirm 403 / hidden UI.

### Acceptance criteria

- [ ] Criterion one.
- [ ] Criterion two.
- [ ] Criterion three.

---

## Outstanding Issues

> _Leave blank until issues surface. Remove section if none exist post-deploy._

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | low | Example: edge case not handled | open |
