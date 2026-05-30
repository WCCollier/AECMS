'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { Button, Input } from '@/components/ui';
import { ShoppingCart, User, Menu, X, LogIn } from 'lucide-react';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { getErrorMessage } from '@/lib/api';

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

  const navLink = 'text-foreground/60 hover:text-accent transition-colors text-sm font-medium';

  // Close flyout on outside click
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
            <Link href="/shop" className={navLink}>Shop</Link>
            <Link href="/latest" className={navLink}>Latest</Link>
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
                      <Input
                        type="password"
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
              <Link href="/latest" className={navLink} onClick={() => setMobileMenuOpen(false)}>Latest</Link>
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
