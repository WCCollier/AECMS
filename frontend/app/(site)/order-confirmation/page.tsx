import { Suspense } from 'react';
import { OrderConfirmationClient } from './OrderConfirmationClient';

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center text-foreground/60">Loading…</div>}>
      <OrderConfirmationClient />
    </Suspense>
  );
}
