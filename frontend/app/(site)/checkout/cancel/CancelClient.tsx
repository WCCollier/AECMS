'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { XCircle } from 'lucide-react';

// Stripe and PayPal both redirect here when the buyer cancels payment.
// The order remains in 'pending' status and can be retried.
export function CancelClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order');

  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <XCircle className="w-16 h-16 mx-auto text-foreground/30 mb-6" />
      <h1 className="text-2xl font-bold mb-3">Payment Cancelled</h1>
      <p className="text-foreground/60 mb-8">
        Your payment was not completed. Your order has not been charged. You can
        try again or return to your cart.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {orderId && (
          <Link href={`/checkout`}>
            <Button>Try Again</Button>
          </Link>
        )}
        <Link href="/cart">
          <Button variant="outline">Return to Cart</Button>
        </Link>
      </div>
    </div>
  );
}
