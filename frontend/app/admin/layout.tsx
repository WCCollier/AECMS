'use client';

import { useEffect, useState } from 'react';
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

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/pages', label: 'Pages', icon: LayoutTemplate },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ClipboardList, requiredCap: 'system.view_audit' },
  { href: '/admin/domains', label: 'Domains', icon: Globe, requiredCap: 'domain.manage' },
  { href: '/admin/settings/appearance', label: 'Appearance', icon: Paintbrush, requiredCap: 'system.configure' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, requiredCap: 'system.configure' },
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

    const token = getAdminAccessToken();
    if (!token) {
      router.push('/admin/login');
      return;
    }

    const stored = typeof window !== 'undefined'
      ? sessionStorage.getItem('admin_user')
      : null;
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setAdminUser(u);
        adminApi.get(`/capabilities/users/${u.id}`)
          .then((res) => setUserCaps((res.data as { name: string }[]).map((c) => c.name)))
          .catch(() => {});
      } catch { /* ignore */ }
    }
    setChecked(true);
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
                .filter(item => !item.requiredCap || userCaps.includes(item.requiredCap))
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
