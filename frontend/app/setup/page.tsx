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

interface DeployProfile {
  storageProvider: string;
  emailProvider: string;
  kmsProvider: string;
  appUrl: string;
  isFirstRun: boolean;
  envKeys: string[];
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

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [profile, setProfile] = useState<DeployProfile | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api-proxy/setup/status').then((r) => r.json()),
      fetch('/api-proxy/setup/profile').then((r) => r.json()).catch(() => null),
    ])
      .then(([status, profileData]) => {
        if (!status.required) router.replace('/');
        else {
          if (profileData) setProfile(profileData);
          setChecking(false);
        }
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
                  placeholder="My Awesome Site"
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
                  placeholder="Welcome to my corner of the internet"
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
                    placeholder="Jane"
                    className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    value={data.last_name}
                    onChange={set('last_name')}
                    placeholder="Smith"
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
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={data.password}
                    onChange={set('password')}
                    placeholder="12+ characters"
                    className="w-full px-3 py-2.5 pr-10 border border-foreground/20 rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <button type="button" tabIndex={-1} aria-label={showPwd ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors focus:outline-none">
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <PasswordStrength password={data.password} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={data.confirm_password}
                    onChange={set('confirm_password')}
                    onBlur={() => setConfirmTouched(true)}
                    placeholder="Repeat password"
                    className={`w-full px-3 py-2.5 pr-10 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
                      confirmTouched && data.confirm_password.length > 0 && data.password !== data.confirm_password
                        ? 'border-red-500'
                        : 'border-foreground/20'
                    }`}
                  />
                  <button type="button" tabIndex={-1} aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors focus:outline-none">
                    {showConfirmPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {confirmTouched && data.confirm_password.length > 0 && data.password !== data.confirm_password && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
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
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="text-green-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">Account created</h2>
                <p className="text-sm text-foreground/60 mt-1">
                  <strong>{data.site_name}</strong> is set up.
                </p>
              </div>

              <div className="border border-foreground/10 rounded-lg divide-y divide-foreground/10 text-sm">
                {/* Storage next step */}
                {profile?.storageProvider === 'gcs' || profile?.storageProvider === 's3' ? (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    <div>
                      <p className="font-medium text-foreground/80">Confirm storage buckets</p>
                      <p className="text-xs text-foreground/50 mt-0.5">
                        {profile.storageProvider === 'gcs' ? 'Google Cloud Storage' : 'S3-compatible storage'} is active.
                        Verify your bucket names in <strong>Settings → File Storage</strong> after logging in.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <div>
                      <p className="font-medium text-foreground/80">Local storage active</p>
                      <p className="text-xs text-foreground/50 mt-0.5">Files will be stored on this server. No additional configuration needed.</p>
                    </div>
                  </div>
                )}

                {/* Email next step */}
                {profile?.emailProvider === 'console' ? (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    <div>
                      <p className="font-medium text-foreground/80">Email is in development mode</p>
                      <p className="text-xs text-foreground/50 mt-0.5">
                        No emails will be sent. Configure SMTP in <strong>Settings → Email</strong> when ready.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-foreground/30 mt-0.5">→</span>
                    <div>
                      <p className="font-medium text-foreground/80">Configure email</p>
                      <p className="text-xs text-foreground/50 mt-0.5">
                        Add your SMTP credentials in <strong>Settings → Email</strong> to enable order receipts and verification emails.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payments */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="text-foreground/30 mt-0.5">→</span>
                  <div>
                    <p className="font-medium text-foreground/80">Connect payment providers</p>
                    <p className="text-xs text-foreground/50 mt-0.5">Add Stripe and/or PayPal keys in <strong>Settings → Payment Providers</strong>.</p>
                  </div>
                </div>

                {/* 2FA reminder */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="text-foreground/30 mt-0.5">→</span>
                  <div>
                    <p className="font-medium text-foreground/80">Set up two-factor authentication</p>
                    <p className="text-xs text-foreground/50 mt-0.5">You&apos;ll be prompted on first backstage login.</p>
                  </div>
                </div>
              </div>

              <a
                href="/admin"
                className="block mt-2 py-2.5 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity text-center"
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
