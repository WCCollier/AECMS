'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { api } from '@/lib/api';

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="text-2xl font-bold mb-4 inline-block">
            AECMS
          </Link>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            {submitted
              ? 'Check your inbox'
              : "Enter your email address and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>

        {submitted ? (
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
              If an account with that email exists, a password reset link has been sent. Check your inbox (and spam folder).
            </div>
            <p className="text-sm text-foreground/60">
              The link expires in 1 hour.
            </p>
          </CardContent>
        ) : (
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
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
                autoComplete="email"
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Send reset link
              </Button>
            </CardFooter>
          </form>
        )}

        <div className="px-6 pb-6 text-center text-sm text-foreground/60">
          <Link href="/auth/login" className="text-foreground font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
