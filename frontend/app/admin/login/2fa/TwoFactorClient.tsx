'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api, { getErrorMessage, setAdminAccessToken, setAdminRefreshToken } from '@/lib/api';

export function TwoFactorClient() {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Ensure pre-auth token is present
    const token = sessionStorage.getItem('admin_pre_auth_token');
    if (!token) {
      router.replace('/admin/login');
    } else {
      inputRefs.current[0]?.focus();
    }
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (value && index === 5 && next.every(d => d)) {
      submitCode(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      submitCode(pasted);
    }
  };

  const submitCode = async (code: string) => {
    const preAuthToken = sessionStorage.getItem('admin_pre_auth_token');
    if (!preAuthToken) {
      router.replace('/admin/login');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/2fa/verify',
        { preAuthToken, code },
      );

      sessionStorage.removeItem('admin_pre_auth_token');
      setAdminAccessToken(response.data.accessToken);
      setAdminRefreshToken(response.data.refreshToken);
      const userData = (response.data as any).user;
      if (userData && typeof window !== 'undefined') {
        sessionStorage.setItem('admin_user', JSON.stringify(userData));
      }
      router.push('/admin');
    } catch (err) {
      const message = getErrorMessage(err);
      const isSessionExpired =
        message.toLowerCase().includes('session expired') ||
        (err as any)?.response?.status === 401;

      if (isSessionExpired) {
        sessionStorage.removeItem('admin_pre_auth_token');
        router.replace('/admin/login?error=session_expired');
        return;
      }

      setError(message);
      setDigits(['', '', '', '', '', '']);
      setIsLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length === 6) submitCode(code);
  };

  return (
    <div className="min-h-screen bg-foreground/5 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="text-foreground/60 mt-1 text-sm">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="bg-background border border-foreground/10 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={isLoading}
                  className="w-11 h-14 text-center text-xl font-bold border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/40 disabled:opacity-50"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || digits.some(d => !d)}
              className="w-full py-2.5 px-4 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-foreground/10 text-center">
            <a
              href="/admin/login"
              className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              ← Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
