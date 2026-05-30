'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import api, { getErrorMessage } from '@/lib/api';

// PayPal redirects here after buyer approval with ?token=<paypalOrderId>&order=<aecmsOrderId>
// We capture the payment then send the user to the order confirmation page.
export function PayPalSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [error, setError] = useState('');

  useEffect(() => {
    const orderId = searchParams?.get('order');
    const paypalToken = searchParams?.get('token'); // PayPal order ID

    if (!orderId || !paypalToken) {
      setError('Missing payment parameters. Please contact support.');
      return;
    }

    (async () => {
      try {
        await api.post('/payments/capture-paypal', {
          order_id: orderId,
          paypal_order_id: paypalToken,
        });
        await clearCart();
        router.replace(`/order-confirmation?order=${orderId}`);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, [searchParams, router, clearCart]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <a href="/cart" className="text-accent hover:underline">Return to cart</a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 text-center text-foreground/60">
      Capturing payment…
    </div>
  );
}
