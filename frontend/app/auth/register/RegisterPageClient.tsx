'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, PasswordInput, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function RegisterPageClient() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const passwordMismatch =
    confirmTouched &&
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      setIsLoading(false);
      return;
    }

    try {
      await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        captchaToken: captchaToken || undefined,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      // Reset CAPTCHA so user can retry — tokens are single-use
      turnstileRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="text-2xl font-bold mb-4 inline-block">
            AECMS
          </Link>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Sign up to start shopping and managing content</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />

            <Input
              label="Username"
              type="text"
              name="username"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              hint="3-30 characters, letters, numbers, underscores"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                type="text"
                name="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={handleChange}
                autoComplete="given-name"
                hint="Optional"
              />
              <Input
                label="Last Name"
                type="text"
                name="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleChange}
                autoComplete="family-name"
              />
            </div>

            <PasswordInput
              label="Password"
              name="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              hint="At least 8 characters"
            />

            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={() => setConfirmTouched(true)}
              required
              autoComplete="new-password"
              error={passwordMismatch ? 'Passwords do not match' : undefined}
            />

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="rounded border-foreground/20 mt-0.5" required />
              <span className="text-foreground/70">
                I agree to the{' '}
                <Link href="/terms" className="text-foreground hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-foreground hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>

            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onError={() => { setCaptchaToken(''); }}
                  onExpire={() => { setCaptchaToken(''); }}
                  options={{ theme: 'dark' }}
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>

            <p className="text-center text-sm text-foreground/60">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-foreground font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
