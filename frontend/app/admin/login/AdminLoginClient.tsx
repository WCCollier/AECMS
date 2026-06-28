'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api, { getErrorMessage, setAdminAccessToken, setAdminRefreshToken } from '@/lib/api';

interface LoginForm {
  email: string;
  password: string;
}

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

export function AdminLoginClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'session_expired') {
      setError('Your session expired. Please log in again.');
    }
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        requiresTwoFactor: boolean;
        twoFactorSetupRequired?: boolean;
        preAuthToken?: string;
        accessToken?: string;
        refreshToken?: string;
        user?: { id: string; email: string; firstName?: string; lastName?: string; role: string };
      }>('/auth/admin/login', data);

      const result = response.data;

      if (result.requiresTwoFactor && result.preAuthToken) {
        // Redirect to 2FA challenge, carry pre-auth token in sessionStorage
        sessionStorage.setItem('admin_pre_auth_token', result.preAuthToken);
        router.push('/admin/login/2fa');
        return;
      }

      // 2FA not yet set up — store to admin session (never touches customer tokens)
      if (result.accessToken && result.refreshToken) {
        setAdminAccessToken(result.accessToken);
        setAdminRefreshToken(result.refreshToken);
        if (result.user && typeof window !== 'undefined') {
          sessionStorage.setItem('admin_user', JSON.stringify(result.user));
        }

        if (result.twoFactorSetupRequired) {
          router.push('/admin/login/setup');
        } else {
          router.push('/admin');
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-foreground/5 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">AECMS Admin</h1>
          <p className="text-foreground/60 mt-1 text-sm">Administrator access only</p>
        </div>

        <div className="bg-background border border-foreground/10 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                autoComplete="username"
                placeholder="admin@example.com"
                className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-foreground/10 text-center">
            <a
              href="/"
              className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              ← Return to site
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-foreground/30 mt-4">
          This portal is for administrators only. Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  );
}
