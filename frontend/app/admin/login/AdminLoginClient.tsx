'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import api, { getErrorMessage, setAccessToken } from '@/lib/api';

interface LoginForm {
  email: string;
  password: string;
}

export function AdminLoginClient() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

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
      }>('/auth/admin/login', data);

      const result = response.data;

      if (result.requiresTwoFactor && result.preAuthToken) {
        // Redirect to 2FA challenge, carry pre-auth token in sessionStorage
        sessionStorage.setItem('admin_pre_auth_token', result.preAuthToken);
        router.push('/admin/login/2fa');
        return;
      }

      // 2FA not yet set up — store tokens and redirect to setup
      if (result.accessToken && result.refreshToken) {
        setAccessToken(result.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('refresh_token', result.refreshToken);
        }
        await refreshUser();

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
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 text-sm"
              />
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
