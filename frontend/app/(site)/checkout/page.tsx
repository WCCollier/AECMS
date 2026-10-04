import { Suspense } from 'react';
import { CheckoutPageClient } from './CheckoutPageClient';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPageClient />
    </Suspense>
  );
}
