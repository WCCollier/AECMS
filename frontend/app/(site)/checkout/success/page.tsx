import { Suspense } from 'react';
import { PayPalSuccessClient } from './PayPalSuccessClient';

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center text-foreground/60">Processing payment…</div>}>
      <PayPalSuccessClient />
    </Suspense>
  );
}
