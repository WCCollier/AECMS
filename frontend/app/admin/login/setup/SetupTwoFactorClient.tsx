'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import QRCode from 'react-qr-code';

export function SetupTwoFactorClient() {
  const router = useRouter();
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const adminToken = typeof window !== 'undefined'
      ? localStorage.getItem('admin_access_token')
      : null;
    if (!adminToken) {
      router.replace('/admin/login');
      return;
    }
    adminApi.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup')
      .then(r => { setSetupData(r.data); setIsFetching(false); })
      .catch(err => { setError(getErrorMessage(err)); setIsFetching(false); });
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) setDigits(pasted.split(''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await adminApi.post('/auth/2fa/enable', { code });
      router.push('/admin');
    } catch (err) {
      setError(getErrorMessage(err));
      setDigits(['', '', '', '', '', '']);
      setIsSubmitting(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-foreground/5 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-foreground/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Set Up Two-Factor Authentication</h1>
          <p className="text-foreground/60 mt-1 text-sm">
            Required for admin access. Scan the QR code with your authenticator app.
          </p>
        </div>

        <div className="bg-background border border-foreground/10 rounded-xl p-8 shadow-sm space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {setupData && (
            <>
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl">
                  <QRCode value={setupData.otpauthUrl} size={180} />
                </div>
              </div>

              <div>
                <p className="text-xs text-foreground/50 text-center mb-2">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <div className="bg-foreground/5 rounded-lg px-4 py-2 font-mono text-sm text-center break-all select-all">
                  {setupData.secret}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-center mb-3">
                    Enter the 6-digit code to confirm setup
                  </p>
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
                        disabled={isSubmitting}
                        className="w-11 h-14 text-center text-xl font-bold border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/40 disabled:opacity-50"
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || digits.some(d => !d)}
                  className="w-full py-2.5 px-4 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? 'Enabling…' : 'Enable Two-Factor Authentication'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-foreground/30 mt-4">
          Use Google Authenticator, Authy, or any TOTP-compatible app.
        </p>
      </div>
    </div>
  );
}
