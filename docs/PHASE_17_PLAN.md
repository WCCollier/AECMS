# Phase 17: Alternate Domain Capture

**Project**: AECMS  
**Phase**: 17  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 8 (Domain Aliases module — already built), Phase 16 (Page hierarchy / clean URLs)

---

## Goal

Give the site owner a backstage control panel to route secondary domains to specific pages within the CMS. Start with a simple redirect (URL changes in browser), then explore persistent domain aliasing (URL stays as the secondary domain while content comes from the primary site).

---

## Background: What Phase 8 Already Built

Phase 8 created a `DomainAlias` module with full CRUD, DNS TXT record verification, and a backstage UI. The schema is:

```
domain        String @unique  — the secondary domain (e.g., wccollier.com)
target_route  String          — the internal path (e.g., /author)
is_active     Boolean         — true after DNS verification
verified_at   DateTime?
owner_id      String
```

What Phase 8 did NOT build: **actual routing logic**. The active aliases list (`GET /domain-aliases/active`) returns the configured mappings, but nothing in the application reads that list and acts on incoming requests. Phase 17 closes that gap.

---

## Part A — Simple Redirect (Phase 17A)

The simplest possible implementation. When a request arrives at the application from `wccollier.com`, redirect the browser to `fantasyvreality.com/author`.

**Mechanism: Next.js middleware**

```typescript
// frontend/middleware.ts
import { NextResponse, NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? '';  // 'fantasyvreality.com'
  
  // Only act on requests that are NOT the base domain
  if (host && host !== baseDomain && !host.includes('localhost')) {
    const aliases = await fetchActiveAliases(); // from DB or cached
    const alias = aliases.find(a => a.domain === host);
    if (alias) {
      // Append any sub-path the user was browsing
      // e.g., wccollier.com/bio → fantasyvreality.com/author/bio
      const incomingPath = request.nextUrl.pathname;
      const canonicalPath = alias.target_route + (incomingPath === '/' ? '' : incomingPath);
      return NextResponse.redirect(`https://${baseDomain}${canonicalPath}`, { status: 301 });
    }
  }
  return NextResponse.next();
}
```

**Cache strategy**: Active aliases change rarely. Cache the list in Redis with a 5-minute TTL. The middleware can fetch from the backend's `GET /domain-aliases/active` endpoint and cache locally. Alternatively, store as a Next.js `unstable_cache` or Edge Config entry.

**DNS requirement**: For a request to arrive at your server from `wccollier.com`, the domain owner must have a DNS A/CNAME record pointing `wccollier.com` to your server's IP/hostname. This is separate from the verification TXT record already in the system. The backstage UI should explain both:
1. **TXT record** (already exists): Proves you own the domain to AECMS
2. **A/CNAME record** (new instruction): Routes traffic from that domain to your server

**Path rewriting**: The redirect appends the sub-path so `wccollier.com/bio` redirects to `fantasyvreality.com/author/bio` — the alias is a mount point, not a single-URL redirect. Sub-paths that don't resolve to a valid page on the primary site return a 404 from Next.js as normal. No special handling needed — the catch-all route (Phase 16) or named routes handle it.

**DB schema change**: Add `alias_type` to `DomainAlias`:
```prisma
alias_type String @default("redirect")  // 'redirect' | 'proxy' (Phase 17B)
```

**Backstage UI update**: The alias management panel (already built in Phase 8) should show the alias type selector and clearer DNS instructions. Add a "Test Redirect" button that verifies the redirect is working.

---

## Part B — Persistent Domain Alias (Phase 17B)

This is the more ambitious feature: a visitor goes to `wccollier.com/bio` and sees the content from `fantasyvreality.com/author/bio`, but their browser address bar still shows `wccollier.com/bio`. This is a **reverse proxy with path rewriting**.

### Feasibility Analysis

**The core challenge**: When a browser is at `wccollier.com`, same-origin policy means all requests (API calls, asset fetches, navigation) must also go to `wccollier.com`. If the application is only deployed at `fantasyvreality.com`, any `<Link>` the user clicks would take them to `fantasyvreality.com`. To maintain the `wccollier.com` URL persistently, every subsequent navigation must also be intercepted.

This is achievable, but the mechanism depends on the hosting layer.

---

### Option 1 — Next.js Middleware Proxy (same-server approach)

Next.js middleware runs at the edge and can rewrite requests internally without a redirect. The browser never sees the internal rewrite — it only sees the `wccollier.com` URL.

```typescript
// middleware.ts
if (alias && alias.alias_type === 'proxy') {
  // Rewrite: serve /author/bio content when request comes in as wccollier.com/bio
  const rewrittenPath = alias.target_route + (incomingPath === '/' ? '' : incomingPath);
  return NextResponse.rewrite(new URL(rewrittenPath, request.url));
}
```

**How it works**: `NextResponse.rewrite()` changes what URL the Next.js router resolves on the server, but the browser never sees it. The HTML is served with `wccollier.com` as the base. Subsequent `<Link>` navigations will also hit `wccollier.com` and be intercepted and rewritten by middleware again.

**Prerequisites**:
- The DNS A/CNAME for `wccollier.com` must point to the same server as `fantasyvreality.com`
- The SSL certificate for the server must cover both domains (wildcard, multi-SAN, or per-domain via Let's Encrypt)
- The server/hosting layer must be configured to accept requests for both domains and pass them to the same application instance

**What works**: Page content, API calls that go through the same Next.js instance, image assets served by the Next.js image optimization route.

**What needs careful handling**:
- Absolute links in page content (e.g., hardcoded `href="https://fantasyvreality.com/shop"`) will break the alias — the visitor will leave `wccollier.com`. The page builder should generate relative links.
- The site logo and `<Link href="/">` should resolve to the alias domain's root, not the primary domain's root, when browsing under an alias. This requires the application to know which domain the current request came in on.
- SEO: `<link rel="canonical">` should point to `fantasyvreality.com/author` even when browsing at `wccollier.com/bio`. This prevents duplicate content indexing.

**Verdict**: Technically feasible on the same server. Most complexity is in edge cases (absolute links, API base URL, canonical tags). Middleware rewriting is the cleanest implementation at this layer.

---

### Option 2 — Separate Proxy Service (Cloud-native approach)

Deploy a lightweight reverse proxy (Node.js http-proxy, Nginx, or Cloudflare Worker) that:
1. Accepts requests on `wccollier.com`
2. Forwards them to `fantasyvreality.com/author{path}` 
3. Rewrites the response HTML to replace `fantasyvreality.com` with `wccollier.com` in absolute URLs and canonical tags
4. Strips/replaces `Location:` headers on redirects

**Pros**: Complete isolation from the main app; the main app needs no changes; works even if main and alias are on different servers.

**Cons**: Requires running an additional service (extra cost/complexity on Cloud Run); HTML rewriting at the proxy layer is fragile (breaks if the app uses JavaScript-generated URLs); latency (two hops).

**Verdict**: Viable for production but overkill when everything runs on the same platform. Defer to Phase 19 (deployment) when the hosting topology is finalized.

---

### Option 3 — Cloudflare Workers / Pages (zero-infrastructure)

If both domains are behind Cloudflare, a Cloudflare Worker can proxy requests from `wccollier.com` to `fantasyvreality.com/author{path}` at the CDN edge — no additional server required.

```javascript
// Cloudflare Worker
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.hostname = 'fantasyvreality.com';
  url.pathname = '/author' + url.pathname;
  event.respondWith(fetch(url.toString(), event.request));
});
```

**Pros**: Extremely fast (edge); no extra infrastructure; free tier available; the main app sees only `fantasyvreality.com` requests.

**Cons**: Ties the feature to Cloudflare (vendor lock-in); the owner of the secondary domain must have Cloudflare. Not "in-application" — cannot be configured from the backstage UI without a Cloudflare API integration.

**Verdict**: Best production performance, but only works if `wccollier.com` DNS is managed through Cloudflare. Worth noting as the recommended production path.

---

### Phase 17 Scope ✅ DECIDED

> **Decision**: Implement **17A only** (simple redirect). Transparent proxy (17B) held for a future phase.

**17A is the complete Phase 17 scope.** It solves the stated need — `wccollier.com` routes to `/author` — and is fully controllable from the existing backstage UI with minor additions. TLS is not a factor for 17A: the browser simply follows a redirect to the canonical `https://fantasyvreality.com` domain, where TLS is already handled.

---

## Part C — Backstage Control Panel

The Phase 8 backstage UI for domain aliases already exists. Additions needed for Phase 17:

### C1 — Alias type selector
When creating or editing an alias, the owner chooses:
- **Redirect** — browser is sent to the primary domain (URL changes)
- **Transparent proxy** — content served under the alias domain (URL stays) *(requires same-server deployment)*

### C2 — DNS setup instructions panel
The current DNS verification covers the TXT record for ownership proof. Add a second panel: "Traffic Routing Setup" that explains:
1. Add an A record: `wccollier.com → [your server IP]` OR CNAME `wccollier.com → fantasyvreality.com`
2. For transparent proxy: your TLS certificate must also cover `wccollier.com` (instructions vary by host)
3. A "Test routing" button that sends a request through the alias and reports whether it resolves correctly

### C3 — Path append behavior
The owner should understand that the domain alias acts as a mount point: all sub-paths flow through. Show an example in the UI:
```
wccollier.com         →  fantasyvreality.com/author
wccollier.com/bio     →  fantasyvreality.com/author/bio
wccollier.com/gallery →  fantasyvreality.com/author/gallery
```

### C4 — Alias health dashboard
A simple status panel showing:
- DNS TXT verification: ✅ Verified / ⚠️ Pending
- Traffic routing: ✅ Reachable / ⚠️ Not yet configured / ❌ Error
- Alias type: Redirect / Proxy
- Last verified: [timestamp]

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Phase 17 scope | 17A only (simple 301 redirect via Next.js middleware) |
| Transparent proxy | Deferred to a future phase |
| TLS for 17A | Not a factor — redirect sends browser to primary domain where TLS is already handled |
| Bad subpaths | 404 (Next.js normal handling on the primary domain) |

## Deferred: Transparent Proxy Options

For reference when revisiting — the three approaches analyzed above (Next.js rewrite, separate proxy service, Cloudflare Worker) remain valid options. The Cloudflare Worker approach is likely the cleanest production path if `wccollier.com` DNS is managed through Cloudflare. TLS for the secondary domain is the key open question to resolve before implementing 17B — owner to confirm DNS/Cloudflare setup during Phase 19.
