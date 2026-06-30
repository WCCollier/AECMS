# BUG-012: Domain alias routing never activates — secondary domain always serves full site

**Status:** `fixed`
**Reported:** 2026-06-30
**Severity:** `high`
**Area:** domain-aliases, middleware, backend

---

## Description

Secondary domains configured in the Domains settings panel (e.g. `wccollier.com` aliased to `/author`) are silently ignored at runtime. Instead of redirecting or proxying to the configured target route, the secondary domain serves the full site from its root, indistinguishable from the primary domain. The Domains panel shows the alias as verified and active, giving no indication that routing is broken.

---

## Reproduction Steps

1. In the backstage, configure a domain alias: `wccollier.com` → `/author` (redirect or proxy).
2. Verify the alias via DNS TXT record; the panel shows "Verified / Active".
3. Visit `https://wccollier.com` in a browser.
4. **Observed:** The full site homepage loads — same content as `https://fantasyvreality.com/`.
5. **Expected:** A 301 redirect to `https://fantasyvreality.com/author` (redirect mode) or a transparent rewrite showing `/author` content under the `wccollier.com` URL (proxy mode).

---

## Root Cause

The Next.js middleware (`frontend/middleware.ts`) fetches the active alias list from the backend at startup and on cache expiry:

```ts
const res = await fetch(`${backendUrl}/domain-aliases/active`, {
  headers: { 'x-internal-request': '1' },
  ...
});
```

`GET /domain-aliases/active` is protected by class-level guards on `DomainAliasesController`:

```ts
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('domain.manage')
```

The middleware is a server-to-server call with no auth token. The backend returns **401**. `res.ok` is false, so `aliasCache` stays `null`, `aliasCache ?? []` returns `[]`, and `aliases.find(a => a.domain === host)` always returns `undefined`. The middleware falls through to `NextResponse.next()`, serving the site normally from any domain.

The `x-internal-request: '1'` header in the original fetch has no corresponding handler on the backend — it was ignored entirely.

---

## Fix Plan

Add a new, unauthenticated controller for the routing table endpoint. Keep the existing authenticated endpoint intact. Update the middleware to call the new endpoint.

```
backend/src/domain-aliases/domain-routing.controller.ts  — new; GET /domain-aliases/routing with no guards
backend/src/domain-aliases/domain-aliases.module.ts      — register DomainRoutingController
frontend/middleware.ts                                   — change /domain-aliases/active → /domain-aliases/routing
```

### Key considerations
- The routing table data (domain → target_route + alias_type) is not sensitive — it describes public URL-to-URL mappings.
- The existing `GET /domain-aliases/active` endpoint is unchanged and remains fully authenticated for any future admin callers.
- The `x-internal-request` header is dropped from the middleware fetch since the new endpoint needs no auth.

---

## Completion Report

**Fixed:** 2026-06-30
**Commit(s):** see status history

### What changed

- Created `backend/src/domain-aliases/domain-routing.controller.ts`: a single `GET /domain-aliases/routing` endpoint on `DomainRoutingController` with no auth guards.
- Registered `DomainRoutingController` alongside `DomainAliasesController` in `DomainAliasesModule`.
- Updated `frontend/middleware.ts` to fetch `/domain-aliases/routing` instead of `/domain-aliases/active`, and removed the now-unnecessary `x-internal-request` header.
- All 190 backend unit tests pass after the change.

**Deployment note:** after deploying, verify via the Neon SQL editor that the `wccollier.com` alias row has `is_active = true` AND `verified_at IS NOT NULL`. If `verified_at` is null, re-run the verify action in the Domains panel.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-30 | open | Reported: secondary domain routes to site root instead of aliased target |
| 2026-06-30 | fixed | `DomainRoutingController` added; middleware updated to call unauthenticated endpoint |
