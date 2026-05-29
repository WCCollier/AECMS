'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { getErrorMessage } from '@/lib/api';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

type VerificationStatus = 'loading' | 'success' | 'error' | 'no-token';

export function VerifyEmailPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verifyEmail = async () => {
      try {
        await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
      } catch (error) {
        setStatus('error');
        setErrorMessage(getErrorMessage(error));
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="text-2xl font-bold mb-4 inline-block">
            AECMS
          </Link>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your email address...'}
            {status === 'success' && 'Your email has been verified'}
            {status === 'error' && 'Verification failed'}
            {status === 'no-token' && 'Invalid verification link'}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <LoadingSpinner />
              <p className="text-foreground/70">Please wait while we verify your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <SuccessIcon />
              <p className="text-foreground/70">
                Your email has been successfully verified. You can now sign in to your account.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <ErrorIcon />
              <p className="text-red-500">{errorMessage}</p>
              <p className="text-foreground/70 text-sm">
                The verification link may have expired or is invalid. Please request a new verification email.
              </p>
            </div>
          )}

          {status === 'no-token' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <ErrorIcon />
              <p className="text-foreground/70">
                No verification token was provided. Please check your email for the correct verification link.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {status === 'success' && (
            <Link href="/auth/login" className="w-full">
              <Button className="w-full">Sign In</Button>
            </Link>
          )}

          {(status === 'error' || status === 'no-token') && (
            <>
              <Link href="/auth/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </>
          )}

          {status === 'loading' && (
            <Button variant="outline" className="w-full" disabled>
              Please wait...
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-12 w-12 text-foreground"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
      <svg
        className="h-8 w-8 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    </div>
  );
}

function ErrorIcon() {
  return (
    <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
      <svg
        className="h-8 w-8 text-red-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </div>
  );
}
