import { Suspense } from 'react';
import { CancelClient } from './CancelClient';

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={null}>
      <CancelClient />
    </Suspense>
  );
}
