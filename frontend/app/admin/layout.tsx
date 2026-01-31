'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/articles', label: 'Articles', icon: FileText },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-foreground/5">
      {/* Mobile Header */}
      <div className="lg:hidden bg-background border-b border-foreground/10 p-4 flex items-center justify-between">
        <Link href="/admin" className="text-xl font-bold">
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
            w-64 bg-background border-r border-foreground/10
            transform transition-transform lg:transform-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-foreground/10 hidden lg:block">
              <Link href="/admin" className="text-xl font-bold">
                AECMS Admin
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
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
                        ? 'bg-foreground text-background'
                        : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-foreground/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-foreground/10 rounded-full flex items-center justify-center">
                  {user?.display_name?.[0] || user?.username?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {user?.display_name || user?.username}
                  </p>
                  <p className="text-sm text-foreground/60 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/"
                  className="flex-1 px-3 py-2 text-sm text-center border border-foreground/20 rounded-lg hover:bg-foreground/5"
                >
                  View Site
                </Link>
                <button
                  onClick={() => logout()}
                  className="px-3 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
