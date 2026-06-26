export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { UnsubscribeClient } from './UnsubscribeClient';

export const metadata = { title: 'Unsubscribe' };

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-foreground/60">Loading…</div>}>
      <UnsubscribeClient />
    </Suspense>
  );
}
