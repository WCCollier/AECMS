'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, PasswordInput, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { api } from '@/lib/api';

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    if (!token) setTokenMissing(true);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-4 space-y-4">
            <p className="text-foreground/70">No reset token found in this link.</p>
            <Link href="/auth/forgot-password" className="text-foreground font-medium hover:underline text-sm">
              Request a new password reset
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="text-2xl font-bold mb-4 inline-block">
            AECMS
          </Link>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {success ? 'Password updated' : 'Choose a new password for your account.'}
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
              Your password has been updated successfully.
            </div>
            <Link
              href="/auth/login"
              className="inline-block mt-2 text-foreground font-medium hover:underline text-sm"
            >
              Sign in with your new password
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                  {error}{' '}
                  {error.includes('expired') && (
                    <Link href="/auth/forgot-password" className="underline">
                      Request a new link
                    </Link>
                  )}
                </div>
              )}

              <PasswordInput
                label="New password"
                name="newPassword"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />

              <PasswordInput
                label="Confirm new password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />

              <p className="text-xs text-foreground/50">Password must be at least 8 characters.</p>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Update password
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
