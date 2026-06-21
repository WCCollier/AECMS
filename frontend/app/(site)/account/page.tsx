export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { AccountPageClient } from './AccountPageClient';

export const metadata = { title: 'My Account' };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center text-foreground/60">Loading…</div>}>
      <AccountPageClient />
    </Suspense>
  );
}
