# Phase 9 Backstage Refactor — Completion Report

**Completed**: 2026-06-04  
**Branch**: main  
**Tests**: 154 backend / 90 frontend (all passing)

---

## What Was Built

Full bifurcation of the customer-facing experience from the backstage (admin) experience. Prior to this refactor, an admin user logged in via the customer front door could navigate directly to `/admin` without going through 2FA. This violated the design intent.

---

## Nomenclature

| Term | Meaning |
|------|---------|
| **Customer-facing** | The experience of a guest or logged-in member browsing the site, shopping, and commenting |
| **Backstage** | The admin dashboard experience, accessible only via `/admin/login` with mandatory TOTP 2FA |

"Front-end" and "back-end" continue to mean client-side and server-side respectively — never use them to describe the two user experiences.

---

## Core Mechanism: `session_type` Discriminator

Every JWT (access and refresh) now carries `session_type: 'customer' | 'backstage'`. This flows through the entire stack:

- **Issued** by `generateTokens()` — customer login → `'customer'`, backstage login → `'backstage'`
- **Stored** in the `RefreshToken` DB row (`session_type` column)
- **Propagated** through token rotation — `refreshTokens()` reads the stored type and re-embeds it
- **Exposed** on `req.user.session_type` via `JwtStrategy.validate()`
- **Enforced** by `BackstageGuard` on every admin API endpoint

---

## Capability-Based Backstage Access

Backstage access is determined by capability scope, not hardcoded role strings. A user can enter the backstage if:

1. `user.role === 'owner'` (Owner is a hardcoded superuser, always eligible), OR
2. The user holds at least one capability with `scope = 'backstage'`

This means custom roles gain or lose backstage access automatically based on which capabilities are assigned — no code change required.

**`RolesGuard` is no longer used in any controller.** All three controllers that previously used it (domain-aliases, digital-products, capabilities) now use `BackstageGuard + CapabilityGuard`.

---

## Capability System Changes

### New `scope` field on `Capability`

| Scope | Count | Meaning |
|-------|-------|---------|
| `'backstage'` | 30 | Requires admin dashboard to exercise |
| `'customer'` | 4 | Available in customer-facing experience |

### New capabilities added

| Name | Scope | Default roles |
|------|-------|---------------|
| `domain.manage` | backstage | Owner |
| `comment.article` | customer | Member, Admin |
| `review.article` | customer | Member, Admin |
| `comment.product` | customer | Member, Admin |
| `review.product` | customer | Member, Admin |

**Total capabilities: 34** (up from 29 before this refactor).

### Customer-scoped capability enforcement

`comment.article`, `review.article`, `comment.product`, and `review.product` are enforced via a runtime check inside `CommentsService.create()` — not a static `@RequiresCapability()` decorator — because the required capability depends on request body context (`isReview` + `article_id` vs `product_id`). Owner bypasses the check; all others call `CapabilitiesService.userHasCapability()`.

---

## Frontend Token Architecture

Two independent token slots in `localStorage` coexist without conflict:

| Key | Session |
|-----|---------|
| `access_token` | Customer |
| `refresh_token` | Customer |
| `admin_access_token` | Backstage |
| `admin_refresh_token` | Backstage |

User info for the admin sidebar is stored in `sessionStorage.admin_user` by the login/2FA flow.

### Two Axios instances

| Instance | File | Used by |
|----------|------|---------|
| `api` | `frontend/lib/api.ts` | All customer-facing components |
| `adminApi` | `frontend/lib/adminApi.ts` | All `app/admin/` components |

`adminApi` auto-refreshes using `admin_refresh_token`. On refresh failure it clears the admin session and redirects to `/admin/login` without touching the customer session.

### `adminFetcher`

Added to `frontend/lib/swr.ts` alongside the existing `fetcher`. Admin dashboard SWR calls use `adminFetcher`; customer-facing SWR calls continue to use `fetcher`.

---

## Backstage Session Lifecycle

1. **Entry**: `POST /auth/admin/login` — checks Owner OR backstage-scoped capability
2. **2FA gate**: pre-auth token (5-min, `scope: 'pre_2fa'`) → TOTP verify → full backstage tokens
3. **"Kill on other machine"**: `verifyTwoFactor()` calls `revokeOtherBackstageSessions()` after issuing new tokens, revoking all other backstage refresh tokens for that user
4. **Inactivity**: `useBackstageActivity` hook resets a 30-min timer on any user interaction; on timeout, clears admin session and redirects to `/admin/login`
5. **Logout**: `clearAdminSession()` clears `admin_*` localStorage keys and `sessionStorage.admin_user`; customer session is untouched

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `prisma/schema.prisma` | `scope` on Capability; `session_type` on RefreshToken; new index |
| `prisma/seed.ts` | scope on all capabilities; 5 new capabilities; Member default caps; `assignCapsToRole()` helper |
| `src/auth/interfaces/auth-response.interface.ts` | `session_type` in `TokenPayload` |
| `src/auth/auth.service.ts` | `generateTokens()`, `storeRefreshToken()`, `refreshTokens()`, `adminLogin()`, `verifyTwoFactor()`, `login()`, new `revokeOtherBackstageSessions()` |
| `src/auth/strategies/jwt.strategy.ts` | expose `session_type` on `req.user` |
| `src/auth/guards/backstage.guard.ts` | **NEW** — requires `session_type === 'backstage'` |
| `src/auth/auth.module.ts` | `BackstageGuard` in providers + exports |
| `src/capabilities/capabilities.controller.ts` | `RolesGuard` → `BackstageGuard + CapabilityGuard` |
| `src/capabilities/capabilities.module.ts` | import `AuthModule` |
| `src/domain-aliases/domain-aliases.controller.ts` | `RolesGuard` → `BackstageGuard + CapabilityGuard` |
| `src/domain-aliases/domain-aliases.module.ts` | import `AuthModule + CapabilitiesModule` |
| `src/digital-products/digital-products.controller.ts` | `RolesGuard` → `BackstageGuard + CapabilityGuard` |
| `src/digital-products/digital-products.module.ts` | import `AuthModule + CapabilitiesModule` |
| `src/comments/comments.service.ts` | inject `CapabilitiesService`; runtime capability check in `create()` |
| `src/comments/comments.service.spec.ts` | mock `CapabilitiesService`; 2 new capability gate tests |

### Frontend
| File | Change |
|------|--------|
| `lib/api.ts` | admin token helpers: `getAdminAccessToken`, `setAdminAccessToken`, `getAdminRefreshToken`, `setAdminRefreshToken`, `clearAdminSession` |
| `lib/adminApi.ts` | **NEW** — backstage Axios instance |
| `lib/swr.ts` | `adminFetcher` added |
| `hooks/useBackstageActivity.ts` | **NEW** — 30-min inactivity auto-logout |
| `app/admin/layout.tsx` | checks `getAdminAccessToken()`; reads `sessionStorage.admin_user`; backstage logout |
| `app/admin/login/AdminLoginClient.tsx` | stores to `admin_*` keys; removed `refreshUser()` |
| `app/admin/login/2fa/TwoFactorClient.tsx` | stores to `admin_*` keys; removed `refreshUser()` |
| `app/admin/login/setup/SetupTwoFactorClient.tsx` | removed `useAuth()`; uses `adminApi` |
| `app/admin/AdminDashboardClient.tsx` | `adminFetcher` |
| `app/admin/orders/AdminOrdersClient.tsx` | `adminFetcher` |
| `app/admin/articles/[id]/edit/EditArticleClient.tsx` | `adminApi` |
| `app/admin/products/[id]/EditProductClient.tsx` | `adminApi` |
| `hooks/useDomainAliases.ts` | `adminFetcher` + `adminApi` for all calls |

---

## Verification

All items manually verified:
- Customer-session admin navigating to `/admin` → redirected to `/admin/login` ✓
- Backstage login (credentials + TOTP) → dashboard loads ✓
- Backstage logout → customer session unaffected ✓
- Customer logout → backstage session unaffected ✓
- Both sessions active simultaneously ✓
- Member comment/review capabilities: all 4 types work; unverified-purchase review rejected ✓
- 154 backend unit tests passing; 90 frontend unit tests passing ✓
