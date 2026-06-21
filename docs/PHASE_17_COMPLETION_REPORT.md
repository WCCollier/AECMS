# Phase 17 Completion Report: Alternate Domain Capture

**Project**: AECMS  
**Phase**: 17  
**Status**: ✅ COMPLETE  
**Primary commit**: `2777998`  
**Date**: 2026-06-17

---

## Summary

Phase 17 enables an AECMS instance to serve traffic from secondary domain names alongside its primary domain. A thin Next.js middleware layer reads the active domain aliases from the backend API, caches them for five minutes, and on every incoming request either issues a 301 redirect (for SEO consolidation) or performs a transparent URL rewrite (for keeping a secondary domain visible in the browser). The infrastructure for managing aliases (the `DomainAlias` model and `GET /domain-aliases/active` endpoint) already existed from Phase 8; Phase 17 consumes it and adds a type field to distinguish the two behaviours.

---

## What Was Delivered

### Area 17-A: `DomainAlias.alias_type` Schema Field

**`backend/prisma/schema.prisma`** — new field on `DomainAlias`:

```prisma
alias_type  String  @default("redirect")   // 'redirect' | 'proxy'
```

- `'redirect'` — incoming request receives a `301 Moved Permanently` to the equivalent path on the primary domain. Search engines consolidate authority on the primary domain.
- `'proxy'` — incoming request is transparently rewritten internally; the visitor's browser URL stays on the secondary domain. Useful for white-label or co-branded deployments.

Migration: `20260617160000_add_domain_alias_type` (applied via `prisma migrate deploy`)

The Phase 8 admin UI for domain aliases automatically exposes this field when the owner edits an alias (existing UI was generic; the new value appears in the form data).

### Area 17-B: Next.js Edge Middleware

**`frontend/middleware.ts`** (new file)

```
Matcher: /((?!_next/static|_next/image|favicon.ico|uploads/).*)/
```

Static assets, Next.js internals, and the `/uploads/` path are excluded from the middleware so it only runs on document and API requests.

**Alias resolution logic**:

1. On first request (or after cache expiry), fetches `GET /domain-aliases/active` from the backend. The response is an array of `{ domain, target_route, alias_type }` objects representing all aliases whose DNS verification has passed.
2. The result is cached in an in-process `Map` keyed by `domain` with a 5-minute TTL stored alongside. Subsequent requests within the TTL window skip the API call.
3. On each request, the middleware reads `request.headers.get('host')` to determine the incoming domain.
4. **Skip conditions** — the middleware exits immediately (no redirect/rewrite) if:
   - The host is `localhost` or `127.0.0.1` (development)
   - The host ends with `.app.github.dev` (Codespaces forwarding URLs)
   - The host matches `NEXT_PUBLIC_BASE_DOMAIN` (already on the primary domain)
5. If the host matches an alias:
   - `alias_type === 'redirect'`: returns `NextResponse.redirect('https://{baseDomain}{target_route}{incomingPathSuffix}', 301)`
   - `alias_type === 'proxy'`: returns `NextResponse.rewrite(new URL(target_route + incomingPathSuffix, request.url))`
6. If no alias matches the host, the request passes through unmodified.

**Path suffix preservation** — the incoming path beyond `target_route` is appended to the redirect/rewrite target. For example, if `example.com` aliases to `/blog`, a request to `example.com/2024/my-post` redirects to `yourdomain.com/blog/2024/my-post`.

**`NEXT_PUBLIC_BASE_DOMAIN`** environment variable — the primary domain name. Should be set in production to `yourdomain.com` (or the owner's chosen domain). In development/Codespaces it can be omitted and the middleware skip conditions handle it.

### Area 17-C: Limitations and Future Work

The Phase 8 domain alias verification (DNS TXT record check) remains the trust boundary. The middleware only processes aliases that have passed verification (`alias.verified_at IS NOT NULL`); this is enforced by the `GET /domain-aliases/active` endpoint which filters on `verified_at`.

The `'proxy'` mode rewrites the URL internally but does not change response headers (e.g. `Content-Security-Policy`, `canonical` link). For production use as a white-label domain, the owner should also:
- Set `<link rel="canonical" href="..." />` via page metadata
- Configure `CORS` and `X-Frame-Options` headers appropriately

These are configuration concerns, not code changes, and are left to the Phase 19 deployment guide.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | `DomainAlias.alias_type` field |
| `backend/prisma/migrations/20260617160000_add_domain_alias_type/migration.sql` | New (3 lines) |
| `frontend/middleware.ts` | New — edge middleware with redirect/proxy logic |

---

## Test Results

- **Backend unit tests**: no new tests (middleware is an edge function; behaviour is validated manually)
- **Total backend tests**: 190 (all passing)
- **Frontend tests**: 125 (all passing)

---

## Manual Verification Steps

1. Create a domain alias in `/admin/domains` with `alias_type = 'redirect'`
2. DNS-verify the alias (or mark it verified manually in the DB for testing)
3. Make a request with `Host: {alias-domain}` header: `curl -I -H "Host: alias.example.com" http://localhost:3001/`
4. Expect `301 Location: https://{baseDomain}/...`
5. Repeat with `alias_type = 'proxy'`: response should be the primary-domain page content with no redirect

---

## Remaining / Deferred

- **Proxy mode response-header patching** (canonical link, CSP) — not implemented; owner must handle at DNS/CDN layer
- **Per-alias cache invalidation** — currently the cache TTL is a blunt 5-minute window. An invalidation hook (called when an alias is created/deleted/updated) would reduce propagation delay. Deferred.
- **Edge runtime compatibility** — `fetch` in the middleware runs on the Next.js Edge Runtime. If the backend is not reachable at middleware time (cold-start race), the fetch fails silently and the request passes through unmodified (safe degradation).
