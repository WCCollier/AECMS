'use client';

import { useState } from 'react';
import api, { getErrorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';

interface ResendVerificationProps {
  initialEmail?: string;
  onSuccess?: () => void;
  className?: string;
}

export function ResendVerification({ initialEmail = '', onSuccess, className = '' }: ResendVerificationProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      await api.post('/auth/resend-verification', { email });
      setStatus('success');
      setMessage('If an account exists with this email and is not yet verified, a verification email has been sent.');
      onSuccess?.();
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus('idle');
            setMessage('');
          }}
          required
          autoComplete="email"
        />

        {status === 'success' && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            {message}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Resend Verification Email
        </Button>
      </form>
    </div>
  );
}
