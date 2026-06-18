import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Setup status cache ────────────────────────────────────────────────────────
let setupRequired: boolean | null = null;
let setupRequiredExpiry = 0;

async function checkSetupRequired(): Promise<boolean> {
  // Once confirmed not required, never need to check again (Owner cannot be deleted)
  if (setupRequired === false) return false;
  // Re-check every 30s while required (so redirect lifts quickly after wizard completes)
  if (setupRequired === true && Date.now() < setupRequiredExpiry) return true;

  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/setup/status`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setupRequired = Boolean(data.required);
      setupRequiredExpiry = Date.now() + 30_000;
    }
  } catch {
    // If backend is unreachable, don't block the request
    return false;
  }
  return setupRequired ?? false;
}

// ── Domain alias cache ────────────────────────────────────────────────────────
let aliasCache: Array<{ domain: string; target_route: string; alias_type: string }> | null = null;
let aliasCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getActiveAliases() {
  if (aliasCache && Date.now() < aliasCacheExpiry) {
    return aliasCache;
  }
  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/domain-aliases/active`, {
      headers: { 'x-internal-request': '1' },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      aliasCache = await res.json();
      aliasCacheExpiry = Date.now() + CACHE_TTL_MS;
    }
  } catch {
    // Cache miss — return existing stale cache or empty list
  }
  return aliasCache ?? [];
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── First-run setup redirect ──────────────────────────────────────────────
  // Allow /setup itself and API proxy calls through unconditionally
  const isSetupExempt =
    pathname === '/setup' ||
    pathname.startsWith('/api-proxy/') ||
    pathname.startsWith('/uploads/');

  if (!isSetupExempt) {
    const required = await checkSetupRequired();
    if (required) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  // ── Domain alias redirect ─────────────────────────────────────────────────
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? '';
  const host = (request.headers.get('host') ?? '').replace(/:\d+$/, ''); // strip port

  // Only act on secondary domains, not the primary domain or localhost
  if (!host || !baseDomain || host === baseDomain || host.includes('localhost') || host.includes('codespace')) {
    return NextResponse.next();
  }

  const aliases = await getActiveAliases();
  const alias = aliases.find((a) => a.domain === host);

  if (!alias) {
    return NextResponse.next();
  }

  const incomingPath = request.nextUrl.pathname;
  const targetPath = alias.target_route.replace(/\/$/, '') + (incomingPath === '/' ? '' : incomingPath);

  if (alias.alias_type === 'proxy') {
    // Transparent proxy: rewrite to primary domain path, URL stays as secondary domain
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.hostname = baseDomain;
    rewriteUrl.pathname = targetPath;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Default: 301 redirect to primary domain
  const redirectUrl = `https://${baseDomain}${targetPath}`;
  return NextResponse.redirect(redirectUrl, { status: 301 });
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
};
