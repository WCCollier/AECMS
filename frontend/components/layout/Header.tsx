'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { Button, Input, PasswordInput } from '@/components/ui';
import { ShoppingCart, User, Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { getErrorMessage } from '@/lib/api';
import useSWR from 'swr';
import api from '@/lib/api';

interface NavPage {
  id: string;
  title: string;
  slug: string;
  parent_id: string | null;
  nav_order: number;
  children?: NavPage[];
}

const navFetcher = (url: string) => api.get(url).then((r) => r.data);

function buildPagePath(page: NavPage, ancestors: NavPage[] = []): string {
  const allSlugs = [...ancestors.map((a) => a.slug), page.slug];
  return '/' + allSlugs.join('/');
}

function PageNavItem({ page, ancestors = [], navLink, onClose }: {
  page: NavPage;
  ancestors?: NavPage[];
  navLink: string;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = buildPagePath(page, ancestors);
  const hasChildren = page.children && page.children.length > 0;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    // Hover-based close is suppressed while the submenu is pinned open
    closeTimer.current = setTimeout(() => setOpen((o) => (pinned ? o : false)), 100);
  }, [pinned]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (pinned) {
      // Unpin and close
      setPinned(false);
      setOpen(false);
    } else {
      // Pin open (menu was already open via hover; confirm/lock it)
      setPinned(true);
      setOpen(true);
    }
  }, [pinned]);

  return (
    <div className="relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <div className="flex items-center gap-0.5">
        <Link href={href} className={navLink} onClick={onClose}>{page.title}</Link>
        {hasChildren && (
          <button
            type="button"
            onClick={handleChevronClick}
            className={`p-1 rounded transition-colors ${pinned ? 'bg-accent/20 text-accent' : 'hover:bg-foreground/10'}`}
            aria-label={pinned ? 'Unpin submenu' : 'Pin submenu open'}
            aria-pressed={pinned}
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${open ? 'rotate-180' : ''} ${pinned ? 'text-accent' : 'text-foreground/40'}`}
            />
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg py-1 z-50">
          {page.children!.map((child) => (
            <Link
              key={child.id}
              href={buildPagePath(child, [...ancestors, page])}
              className="block px-3 py-2 text-sm text-foreground/70 hover:text-accent hover:bg-surface-raised transition-colors"
              onClick={onClose}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const flyoutRef = useRef<HTMLDivElement>(null);
  const loginBtnRef = useRef<HTMLButtonElement>(null);

  const { data: navPages } = useSWR<NavPage[]>('/pages/nav', navFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const navLink = 'text-foreground/60 hover:text-accent transition-colors text-sm font-medium';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(e.target as Node) &&
        loginBtnRef.current &&
        !loginBtnRef.current.contains(e.target as Node)
      ) {
        setLoginOpen(false);
        setLoginError('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await login(loginData);
      setLoginOpen(false);
      setLoginData({ email: '', password: '' });
    } catch (err) {
      setLoginError(getErrorMessage(err));
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold tracking-tight text-accent">
            AECMS
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7">
            {/* Hard routes — always visible */}
            <Link href="/shop" className={navLink}>Shop</Link>
            <Link href="/articles" className={navLink}>Articles</Link>

            {/* Page taxonomy — shown only when pages exist */}
            {navPages && navPages.length > 0 && (
              <>
                <span className="border-l border-border/40 h-4" />
                {navPages.map((page) => (
                  <PageNavItem key={page.id} page={page} navLink={navLink} />
                ))}
              </>
            )}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3 relative">
            <Link href="/cart" className="relative p-2 hover:bg-surface-raised rounded-lg transition-colors text-foreground/60 hover:text-accent">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link href="/account" className="p-2 hover:bg-surface-raised rounded-lg transition-colors text-foreground/60 hover:text-accent">
                  <User className="w-5 h-5" />
                </Link>
                <Button variant="ghost" size="sm" onClick={() => logout()}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 relative">
                <button
                  ref={loginBtnRef}
                  onClick={() => { setLoginOpen((o) => !o); setLoginError(''); }}
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-accent transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-raised"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
                <Link href="/auth/register">
                  <Button size="sm">Sign Up</Button>
                </Link>

                {/* Login flyout */}
                {loginOpen && (
                  <div
                    ref={flyoutRef}
                    className="absolute top-full right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-lg p-4 z-50"
                  >
                    <p className="text-sm font-semibold mb-3">Sign in to your account</p>
                    <form onSubmit={handleLoginSubmit} className="space-y-3">
                      {loginError && (
                        <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                          {loginError}
                        </p>
                      )}
                      <Input
                        type="email"
                        name="email"
                        id="header-login-email"
                        placeholder="Email"
                        value={loginData.email}
                        onChange={(e) => setLoginData((d) => ({ ...d, email: e.target.value }))}
                        required
                        autoComplete="email"
                        autoFocus
                      />
                      <PasswordInput
                        name="password"
                        id="header-login-password"
                        placeholder="Password"
                        value={loginData.password}
                        onChange={(e) => setLoginData((d) => ({ ...d, password: e.target.value }))}
                        required
                        autoComplete="current-password"
                      />
                      <Button type="submit" className="w-full" size="sm" isLoading={loginLoading}>
                        Sign In
                      </Button>
                      <p className="text-xs text-center text-foreground/50">
                        No account?{' '}
                        <Link href="/auth/register" className="text-accent hover:underline" onClick={() => setLoginOpen(false)}>
                          Sign up
                        </Link>
                      </p>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground/60 hover:text-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              <Link href="/shop" className={navLink} onClick={() => setMobileMenuOpen(false)}>Shop</Link>
              <Link href="/articles" className={navLink} onClick={() => setMobileMenuOpen(false)}>Articles</Link>
              {navPages && navPages.length > 0 && (
                <>
                  <hr className="border-border/40" />
                  {navPages.map((page) => (
                    <div key={page.id}>
                      <Link
                        href={buildPagePath(page)}
                        className={navLink}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {page.title}
                      </Link>
                      {page.children?.map((child) => (
                        <Link
                          key={child.id}
                          href={buildPagePath(child, [page])}
                          className={`block ml-4 mt-2 ${navLink}`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  ))}
                </>
              )}
              <Link href="/cart" className={`${navLink} flex items-center gap-2`} onClick={() => setMobileMenuOpen(false)}>
                Cart {itemCount > 0 && <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full font-bold">{itemCount}</span>}
              </Link>
              <hr className="border-border" />
              {isAuthenticated ? (
                <>
                  <Link href="/account" className={navLink} onClick={() => setMobileMenuOpen(false)}>My Account</Link>
                  <button className={`text-left ${navLink}`} onClick={() => { logout(); setMobileMenuOpen(false); }}>Logout</button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className={navLink} onClick={() => setMobileMenuOpen(false)}>Login</Link>
                  <Link href="/auth/register" className={navLink} onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
