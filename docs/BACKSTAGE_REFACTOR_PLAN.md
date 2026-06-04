# Backstage Session Bifurcation — Implementation Plan

**Goal**: Fully separate the customer-facing session from the backstage (admin dashboard) session.
A user who is logged in via the customer front door must go through the backstage login flow
(credentials → mandatory 2FA) to access `/admin`, even if their account has elevated privileges.
Backstage access is determined by capability scope, not by hardcoded role strings.

**Nomenclature**:
- **Customer session** — established via `/auth/login`; persistent refresh token; no 2FA
- **Backstage session** — established via `/auth/admin/login` + TOTP 2FA; 7-day refresh token;
  killed by a new backstage login on a different machine; 30-min inactivity auto-logout

---

## Architectural Decisions

### 1. `session_type` discriminator in JWT + DB
Every token (access and refresh) carries `session_type: 'customer' | 'backstage'`.
`refreshTokens()` reads `session_type` from the stored DB row and propagates it to the new pair,
so the session type survives rotation without re-examining role or capabilities each time.

### 2. Backstage access = capability scope, not role
A `scope` column (`'customer' | 'backstage'`) is added to the `Capability` model.
The `adminLogin()` endpoint checks: **Owner** (always eligible) OR **user holds ≥1 backstage-scoped capability**.
The four shipped roles are convenience defaults; custom roles gain/lose backstage access automatically
based on which capabilities they hold.

### 3. Owner special case
Owner is a hardcoded superuser identity that bypasses the capability query entirely.
`user.role === 'owner'` is the only remaining role-string check in backstage access logic.

### 4. Separate frontend token storage
Two independent token slots coexist in `localStorage`:

| Key | Session |
|-----|---------|
| `access_token` | Customer |
| `refresh_token` | Customer |
| `admin_access_token` | Backstage |
| `admin_refresh_token` | Backstage |

The two sessions are fully independent. A user can be logged into both simultaneously.

### 5. Separate Axios instance for admin (`adminApi`)
A second Axios instance (`frontend/lib/adminApi.ts`) uses the admin tokens.
All `app/admin/` components import `adminApi` instead of `api`.
This is the clean isolation boundary — no interceptor logic can mix sessions.

### 6. `RolesGuard` eliminated from controllers
`RolesGuard` + `@Roles(...)` decorators are replaced with `BackstageGuard` + `CapabilityGuard`
across all three controllers that still use role strings (domain-aliases, digital-products,
capabilities). `RolesGuard` itself is left in place but unused in controllers.

### 7. New `domain.manage` capability
Domain alias management currently uses `@Roles(UserRole.owner)` with no capability.
A new `domain.manage` capability (scope: `backstage`) is added and assigned to Owner by default.
The capabilities controller uses `system.configure` (already exists).
Digital products controller maps to existing `product.*` capabilities.

---

## All 29 Capabilities — Scope Classification

All current capabilities are `backstage`-scoped (every one requires the admin dashboard to use).
Customer-side capabilities (e.g., `comment.create`) do not yet exist in the capability system;
when added, they would carry `scope: 'customer'`.

| Capability | Scope |
|------------|-------|
| article.create | backstage |
| article.edit.own | backstage |
| article.edit.any | backstage |
| article.delete.own | backstage |
| article.delete.any | backstage |
| article.publish | backstage |
| page.create | backstage |
| page.edit | backstage |
| page.delete | backstage |
| media.upload | backstage |
| media.delete | backstage |
| product.create | backstage |
| product.edit | backstage |
| product.delete | backstage |
| order.view.all | backstage |
| order.edit | backstage |
| order.refund | backstage |
| user.create | backstage |
| user.edit | backstage |
| user.delete | backstage |
| user.assign_role | backstage |
| user.assign_capability | backstage |
| comment.view.all | backstage |
| comment.moderate | backstage |
| comment.delete | backstage |
| review.moderate | backstage |
| system.configure | backstage |
| system.view_audit | backstage |
| system.export_data | backstage |
| **domain.manage** *(new)* | backstage |

---

## Checklist

### Phase A — Database Schema

- [x] **A1** Add `scope String @default("backstage")` to `Capability` model in `schema.prisma`
- [x] **A2** Add `session_type String @default("customer")` to `RefreshToken` model in `schema.prisma`
- [x] **A3** Run `npx prisma migrate dev --name add_capability_scope_and_session_type`
- [x] **A4** Run `npx prisma generate`

---

### Phase B — Backend: Interfaces & Token Layer

- [x] **B1** `auth-response.interface.ts` — add `session_type: 'customer' | 'backstage'` to `TokenPayload`
- [x] **B2** `auth.service.ts` — `generateTokens()`: add `sessionType: 'customer' | 'backstage'` param; embed in both access and refresh JWT payloads
- [x] **B3** `auth.service.ts` — `storeRefreshToken()`: add `sessionType` param; write to `session_type` column; returns `{ id }` so callers can reference the stored row
- [x] **B4** `auth.service.ts` — `refreshTokens()`: read `session_type` from the stored `RefreshToken` DB row; pass it through to `generateTokens()` and `storeRefreshToken()` so type survives rotation
- [x] **B5** `jwt.strategy.ts` — expose `session_type` from JWT payload in the `validate()` return value so it lands on `req.user`

---

### Phase C — Backend: Admin Login & Backstage Session Logic

- [x] **C1** `auth.service.ts` — `adminLogin()`: replace `user.role !== 'admin' && user.role !== 'owner'` check with:
  - Owner → always eligible (bypass capability query)
  - Others → query `UserCapability` + `RoleCapability` for any capability with `scope = 'backstage'`; if none → `403 ForbiddenException`
- [x] **C2** `auth.service.ts` — `adminLogin()` (2FA-not-set-up path): pass `sessionType: 'backstage'` to `generateTokens()` and `storeRefreshToken()`
- [x] **C3** `auth.service.ts` — `verifyTwoFactor()`: pass `sessionType: 'backstage'` to `generateTokens()` and `storeRefreshToken()`; after issuing new tokens, call `revokeOtherBackstageSessions(userId, newRefreshTokenId)` to kill other backstage sessions on other machines
- [x] **C4** `auth.service.ts` — add private `revokeOtherBackstageSessions(userId, excludeId)`: sets `revoked_at` on all `RefreshToken` rows where `user_id = userId AND session_type = 'backstage' AND id != excludeId AND revoked_at IS NULL`
- [x] **C5** `auth.service.ts` — `login()` (customer front door): pass `sessionType: 'customer'` to `generateTokens()` and `storeRefreshToken()`

---

### Phase D — Backend: `BackstageGuard` & Controller Cleanup

- [x] **D1** Create `backend/src/auth/guards/backstage.guard.ts`:
  - Requires `JwtAuthGuard` to have already run (i.e., `req.user` is populated)
  - Passes if `req.user.session_type === 'backstage'`
  - Throw `ForbiddenException('Backstage session required')` otherwise
- [x] **D2** `domain-aliases.controller.ts` — replace `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` with `@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)` + `@RequiresCapability('domain.manage')` on all endpoints
- [x] **D3** `digital-products.controller.ts` — replace all `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin', 'owner')` with `@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)` + appropriate `@RequiresCapability`
- [x] **D4** `capabilities.controller.ts` — replace `@UseGuards(RolesGuard)` + `@Roles(UserRole.owner)` with `@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)` + `@RequiresCapability('system.configure')`
- [x] **D5** Add `BackstageGuard` to `AuthModule` providers and exports
- [x] **D6** *(post-plan fix)* Add `AuthModule` + `CapabilitiesModule` imports to `DomainAliasesModule`, `DigitalProductsModule`, and `CapabilitiesModule` — required for NestJS dependency injection of `BackstageGuard` and `CapabilityGuard`

---

### Phase E — Database: Seed Updates

- [x] **E1** `prisma/seed.ts` — add `scope: 'backstage'` to all 29 existing capability upsert calls; update `update:{}` to also set scope on re-seed
- [x] **E2** `prisma/seed.ts` — add new `domain.manage` capability entry (`scope: 'backstage'`, category: `'system'`)
- [x] **E3** Owner receives `domain.manage` automatically via the "Owner gets all capabilities" default logic
- [x] **E4** Seed verified: 30 capabilities, all with `scope = 'backstage'`

---

### Phase F — Frontend: Token Storage & API Clients

- [x] **F1** `frontend/lib/api.ts` — add helper functions: `getAdminAccessToken`, `setAdminAccessToken`, `getAdminRefreshToken`, `setAdminRefreshToken`, `clearAdminSession`
- [x] **F2** Create `frontend/lib/adminApi.ts` — new Axios instance using admin tokens; auto-refreshes via `admin_refresh_token`; on refresh failure clears admin session and redirects to `/admin/login`

---

### Phase G — Frontend: Admin Login Flow

- [x] **G1** `app/admin/login/AdminLoginClient.tsx` — stores to `admin_*` keys; stores `admin_user` in sessionStorage; removed `refreshUser()` call; customer session untouched
- [x] **G2** `app/admin/login/2fa/TwoFactorClient.tsx` — stores to `admin_*` keys; stores `admin_user` in sessionStorage; removed `refreshUser()` call
- [ ] **G3** `app/admin/login/setup/SetupTwoFactorClient.tsx` — still reads `user` from `useAuth()` (customer session) and uses `api` for the setup/enable calls; needs to read from `sessionStorage.admin_user` and switch calls to `adminApi`

---

### Phase H — Frontend: Admin Layout & Activity Guard

- [x] **H1** `app/admin/layout.tsx` — checks `getAdminAccessToken()` instead of `user.role`; reads `admin_user` from sessionStorage for sidebar display; redirects to `/admin/login` if no backstage token
- [x] **H2** `app/admin/layout.tsx` — logout calls `clearAdminSession()` + `router.push('/admin/login')`; does not touch customer session
- [x] **H3** Create `frontend/hooks/useBackstageActivity.ts` — 30-min inactivity timer; resets on mouse/keyboard/scroll/touch; on timeout calls `clearAdminSession()` and redirects to `/admin/login`
- [x] **H4** `app/admin/layout.tsx` — invokes `useBackstageActivity()`

---

### Phase I — Frontend: Admin Pages Switch to `adminApi`

- [x] **I1** `app/admin/AdminDashboardClient.tsx` — switched to `adminFetcher` (added to `swr.ts`)
- [x] **I2** `app/admin/products/` — `EditProductClient.tsx` switched to `adminApi`; list page uses `useProducts` hook (reads public GET endpoint, no direct `api` import)
- [x] **I3** `app/admin/articles/` — `EditArticleClient.tsx` switched to `adminApi`; list page uses `useArticles` hook (reads public GET endpoint, no direct `api` import)
- [x] **I4** `app/admin/orders/` — `AdminOrdersClient.tsx` switched to `adminFetcher`
- [ ] **I5** `app/admin/domains/` — `AdminDomainsClient.tsx` uses `useDomainAliases` hook which calls customer `api` for all mutations (POST/PATCH/DELETE); these endpoints are now backstage-gated so the hook must switch to `adminApi` for write operations

---

### Phase J — Tests & Verification

- [ ] **J1** Run `npm run test` in backend — fix any unit tests broken by `session_type` param changes
- [ ] **J2** Run `npm run test` in frontend — fix any unit tests broken by token storage changes
- [ ] **J3** Manual verification — customer front-door:
  - Log in as owner via `/` (front door)
  - Confirm customer experience works (cart, logged-in content)
  - Navigate to `/admin` — confirm redirect to `/admin/login` (not admitted)
- [ ] **J4** Manual verification — backstage:
  - Navigate to `/admin/login` — enter credentials → 2FA → admitted to dashboard
  - Confirm admin actions work (CRUD)
  - Log out of backstage — confirm customer session still active
- [ ] **J5** Manual verification — session isolation:
  - Be logged in to both sessions simultaneously
  - Log out of backstage only → customer session unaffected
  - Log out of customer only → backstage session unaffected
- [ ] **J6** Manual verification — inactivity timeout:
  - Be logged into backstage, idle for 30 min (or reduce timeout temporarily for testing)
  - Confirm redirect to `/admin/login`

---

### Phase K — Cleanup & Documentation

- [ ] **K1** Update `CLAUDE.md` — document the customer/backstage session model and the `session_type` convention
- [ ] **K2** Create `docs/PHASE_9_BACKSTAGE_COMPLETION.md` — record what changed and why
- [x] **K3** Committed in logical groups: (1) main implementation, (2) fix BackstageGuard providers, (3) fix module dependency imports

---

## File Impact Summary

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | `scope` on Capability, `session_type` on RefreshToken |
| `backend/prisma/seed.ts` | scope on all capabilities, new domain.manage cap |
| `backend/src/auth/interfaces/auth-response.interface.ts` | `session_type` in TokenPayload |
| `backend/src/auth/auth.service.ts` | generateTokens, storeRefreshToken, adminLogin, verifyTwoFactor, refreshTokens, login, new revokeOtherBackstageSessions |
| `backend/src/auth/strategies/jwt.strategy.ts` | expose session_type on req.user |
| `backend/src/auth/guards/backstage.guard.ts` | **NEW** |
| `backend/src/auth/auth.module.ts` | export BackstageGuard |
| `backend/src/domain-aliases/domain-aliases.controller.ts` | RolesGuard → BackstageGuard + CapabilityGuard |
| `backend/src/digital-products/digital-products.controller.ts` | RolesGuard → BackstageGuard + CapabilityGuard |
| `backend/src/capabilities/capabilities.controller.ts` | RolesGuard → BackstageGuard + CapabilityGuard |
| `frontend/lib/api.ts` | admin token helpers |
| `frontend/lib/adminApi.ts` | **NEW** |
| `frontend/hooks/useBackstageActivity.ts` | **NEW** |
| `frontend/app/admin/layout.tsx` | backstage token check, adminLogout, activity hook |
| `frontend/app/admin/login/AdminLoginClient.tsx` | admin token storage |
| `frontend/app/admin/login/2fa/TwoFactorClient.tsx` | admin token storage |
| `frontend/app/admin/login/setup/SetupTwoFactorClient.tsx` | read from admin session |
| `frontend/app/admin/**/*.tsx` (5 page files) | api → adminApi |
