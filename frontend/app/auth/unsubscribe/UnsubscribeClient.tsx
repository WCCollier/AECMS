'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  articles: 'new article notifications',
  products: 'new product notifications',
  news: 'news and alerts',
};

export function UnsubscribeClient() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const category = params?.get('category') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token || !category) {
      setErrorMsg('Missing token or category in the unsubscribe link.');
      setStatus('error');
      return;
    }

    api.get(`/subscriptions/unsubscribe?token=${encodeURIComponent(token)}&category=${encodeURIComponent(category)}`)
      .then(() => setStatus('success'))
      .catch((err) => {
        setErrorMsg(err?.response?.data?.message ?? 'The unsubscribe link is invalid or has already been used.');
        setStatus('error');
      });
  }, [token, category]);

  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {status === 'loading' && (
          <p className="text-foreground/60">Processing…</p>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold">Unsubscribed</h1>
            <p className="text-foreground/70">
              You&apos;ve been unsubscribed from <strong>{categoryLabel}</strong>. You won&apos;t receive these emails anymore.
            </p>
            <p className="text-sm text-foreground/50">
              You can manage all your notification preferences in your{' '}
              <Link href="/account" className="text-accent hover:underline">account settings</Link>.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-foreground/70">{errorMsg}</p>
            <Link href="/account" className="text-accent hover:underline text-sm">
              Manage preferences in your account →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
