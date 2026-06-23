'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  LayoutTemplate,
  ClipboardList,
  Paintbrush,
  Images,
  Users,
} from 'lucide-react';
import { getAdminAccessToken, clearAdminSession } from '@/lib/api';
import adminApi from '@/lib/adminApi';
import { useBackstageActivity } from '@/hooks/useBackstageActivity';

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

const CONFIGURE_CAPS = [
  'system.configure.general',
  'system.configure.email',
  'system.configure.payments',
  'system.configure.storage',
] as const;

const navItems: { href: string; label: string; icon: React.ElementType; requiredCap?: string | readonly string[] }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/pages', label: 'Pages', icon: LayoutTemplate },
  { href: '/admin/media', label: 'Media', icon: Images, requiredCap: 'media.upload' },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/users', label: 'Users', icon: Users, requiredCap: 'user.assign_role' },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ClipboardList, requiredCap: 'system.view_audit' },
  { href: '/admin/domains', label: 'Domains', icon: Globe, requiredCap: 'domain.manage' },
  { href: '/admin/settings/appearance', label: 'Appearance', icon: Paintbrush, requiredCap: 'system.appearance' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, requiredCap: CONFIGURE_CAPS },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [userCaps, setUserCaps] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = pathname?.startsWith('/admin/login') ?? false;

  // Inactivity auto-logout (3 hours) — runs on all admin pages including login
  useBackstageActivity();

  useEffect(() => {
    if (isLoginRoute) { setChecked(true); return; }

    const validate = (background = false) => {
      // Reject immediately if no token exists at all
      const token = getAdminAccessToken();
      if (!token) {
        router.push('/admin/login');
        return;
      }

      // Resolve user identity: prefer sessionStorage (survives tab refreshes but
      // not full browser restarts). If missing, we have no user ID to validate
      // against — force re-login rather than render a ghost session.
      const stored = typeof window !== 'undefined'
        ? sessionStorage.getItem('admin_user')
        : null;

      let userId: string | null = null;
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (!background) setAdminUser(u);
          userId = u.id;
        } catch { /* ignore malformed sessionStorage */ }
      }

      if (!userId) {
        // sessionStorage is missing (new tab or browser restart).
        // Fall back to decoding the userId from the JWT payload — no signature
        // verification needed here; the server validates on the API call below.
        // Do NOT call clearAdminSession(): localStorage is shared across tabs,
        // and wiping it here would destroy the session in the original tab.
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub ?? null;
        } catch { /* malformed token — fall through to redirect */ }
      }

      if (!userId) {
        // Token is malformed and we can't determine user identity.
        clearAdminSession();
        router.push('/admin/login');
        return;
      }

      // Always validate against the server before rendering the admin UI.
      // adminApi's response interceptor will attempt token refresh on 401.
      // If refresh also fails, the interceptor clears the session and hard-redirects
      // to /admin/login. We must NOT call setChecked(true) until this resolves so
      // the admin UI is never shown to an unauthenticated request.
      adminApi.get(`/capabilities/users/${userId}`)
        .then((res) => {
          setUserCaps((res.data as { name: string }[]).map((c) => c.name));
          setChecked(true);
        })
        .catch(() => {
          // Interceptor has already cleared the session and redirected.
          // Keep the spinner; do not render the admin UI.
        });
    };

    // Run on mount (blocks render until validated)
    validate(false);

    // Re-validate silently when the user returns to the tab — catches ghost
    // sessions caused by token expiry or browser restart while the tab was hidden.
    // background=true skips setAdminUser so the sidebar display doesn't flicker.
    const onFocus = () => validate(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isLoginRoute, router]);

  const handleLogout = () => {
    clearAdminSession();
    router.push('/admin/login');
  };

  if (isLoginRoute) return <>{children}</>;

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  const displayName = adminUser?.firstName
    ? `${adminUser.firstName} ${adminUser.lastName ?? ''}`.trim()
    : adminUser?.email ?? '';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden bg-surface border-b border-border p-4 flex items-center justify-between">
        <Link href="/admin" className="text-xl font-bold text-accent">
          AECMS Admin
        </Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-64 bg-surface border-r border-border
            transform transition-transform lg:transform-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border hidden lg:block">
              <Link href="/admin" className="text-xl font-bold text-accent">
                AECMS Admin
              </Link>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems
                .filter(item => {
                  if (!item.requiredCap) return true;
                  const caps = Array.isArray(item.requiredCap) ? item.requiredCap : [item.requiredCap];
                  return caps.some(c => userCaps.includes(c));
                })
                .map(item => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors
                        ${isActive
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'text-foreground/60 hover:bg-surface-raised hover:text-foreground'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
            </nav>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold">
                  {displayName[0]?.toUpperCase() ?? 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName}</p>
                  <p className="text-sm text-foreground/60 truncate">{adminUser?.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/"
                  className="flex-1 px-3 py-2 text-sm text-center border border-border rounded-lg hover:bg-surface-raised hover:text-accent transition-colors"
                >
                  View Site
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface-raised hover:text-accent transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              <a
                href="https://www.givesendgo.com/aecms-an-open-source-e-commerce-cms?utm_source=sharelink&utm_medium=copy_link&utm_campaign=aecms-an-open-source-e-commerce-cms"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-xs text-center text-foreground/35 hover:text-accent transition-colors"
              >
                AECMS is open source — donate ♥
              </a>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-h-screen lg:min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
