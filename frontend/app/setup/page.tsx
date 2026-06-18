'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface FormData {
  site_name: string;
  site_tagline: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

const EMPTY: FormData = {
  site_name: '',
  site_tagline: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
};

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  if (!password) return null;
  return (
    <div className="mt-1">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-foreground/10'}`}
          />
        ))}
      </div>
      <p className="text-xs text-foreground/50">{labels[score]}</p>
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If setup is already complete, redirect home
    fetch('/api-proxy/setup/status')
      .then((r) => r.json())
      .then((d) => {
        if (!d.required) router.replace('/');
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((prev) => ({ ...prev, [field]: e.target.value }));

  const validateStep1 = () => {
    if (!data.site_name.trim()) return 'Site name is required';
    if (!data.first_name.trim()) return 'First name is required';
    if (!data.last_name.trim()) return 'Last name is required';
    return '';
  };

  const validateStep2 = () => {
    if (!data.email.trim() || !data.email.includes('@')) return 'Valid email is required';
    if (data.password.length < 12) return 'Password must be at least 12 characters';
    if (data.password !== data.confirm_password) return 'Passwords do not match';
    return '';
  };

  const next = () => {
    setError('');
    const err = step === 1 ? validateStep1() : '';
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setError('');
    const err = validateStep2();
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api-proxy/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_name: data.site_name.trim(),
          site_tagline: data.site_tagline.trim(),
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          email: data.email.trim(),
          password: data.password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Setup failed');
      }
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-foreground/5 flex items-center justify-center">
        <p className="text-foreground/50">Checking setup status…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-foreground/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Welcome to AECMS</h1>
          <p className="text-foreground/60 mt-1 text-sm">Let&apos;s get your site set up</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step >= n
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/10 text-foreground/40'
                }`}
              >
                {n}
              </div>
              {n < 3 && <div className={`w-8 h-px ${step > n ? 'bg-foreground' : 'bg-foreground/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-background border border-foreground/10 rounded-xl p-8 shadow-sm">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold mb-1">Site Identity</h2>
              <p className="text-sm text-foreground/60 mb-5">
                This is how your site will be identified to visitors.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5">Site Name *</label>
                <input
                  type="text"
                  value={data.site_name}
                  onChange={set('site_name')}
                  placeholder="Fantasy v Reality"
                  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Tagline</label>
                <input
                  type="text"
                  value={data.site_tagline}
                  onChange={set('site_tagline')}
                  placeholder="Ideas worth fighting for"
                  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <hr className="border-foreground/10 my-1" />
              <p className="text-sm text-foreground/60">Your name (shown as author)</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">First Name *</label>
                  <input
                    type="text"
                    value={data.first_name}
                    onChange={set('first_name')}
                    placeholder="William"
                    className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    value={data.last_name}
                    onChange={set('last_name')}
                    placeholder="Collier"
                    className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>

              <button
                onClick={next}
                className="w-full py-2.5 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity mt-2"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold mb-1">Owner Account</h2>
              <p className="text-sm text-foreground/60 mb-5">
                This is the primary admin account. Keep these credentials safe.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={data.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Password *</label>
                <input
                  type="password"
                  value={data.password}
                  onChange={set('password')}
                  placeholder="12+ characters"
                  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <PasswordStrength password={data.password} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm Password *</label>
                <input
                  type="password"
                  value={data.confirm_password}
                  onChange={set('confirm_password')}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 py-2.5 border border-foreground/20 text-sm font-semibold rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Site'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-lg font-semibold">Your site is ready</h2>
              <p className="text-sm text-foreground/60">
                <strong>{data.site_name}</strong> is set up. Log in to the backstage to
                configure email, payments, and storage, then start publishing.
              </p>
              <p className="text-xs text-foreground/40 mt-2">
                You&apos;ll be prompted to set up two-factor authentication on first login.
              </p>
              <a
                href="/admin"
                className="block mt-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Go to Backstage
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
