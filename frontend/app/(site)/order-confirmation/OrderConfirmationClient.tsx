'use client';

import { ARTICLES_PATH, PRODUCTS_PATH } from '@/lib/routes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/hooks/useOrders';
import { Button } from '@/components/ui';
import { CheckCircle, Clock, Loader2, ShoppingBag, ArrowRight, XCircle } from 'lucide-react';
import { DigitalDownloadsPanel } from '@/components/digital/DigitalDownloadsPanel';
import { orderStatusClass } from '@/lib/orderStatus';

// Stripe/PayPal send the buyer back before their webhook has necessarily been processed,
// so a just-paid order can still read "pending" for a few seconds. Poll briefly for the flip.
const POLL_INTERVAL_MS = 2000;
const POLL_WINDOW_MS = 30000;

export function OrderConfirmationClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order') ?? '';
  const [startedAt] = useState(() => Date.now());
  const [pollExpired, setPollExpired] = useState(false);
  const { order, isLoading, isError } = useOrder(orderId || undefined, {
    refreshInterval: (o) =>
      o?.status === 'pending' && Date.now() - startedAt < POLL_WINDOW_MS ? POLL_INTERVAL_MS : 0,
  });

  useEffect(() => {
    const t = setTimeout(() => setPollExpired(true), POLL_WINDOW_MS);
    return () => clearTimeout(t);
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground/60">
        Loading your order…
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-foreground/60 mb-4">Order not found.</p>
        <Link href={PRODUCTS_PATH}><Button>Continue Shopping</Button></Link>
      </div>
    );
  }

  const isPending = order.status === 'pending';
  const isClosed = order.status === 'cancelled' || order.status === 'refunded';
  const isPaid = !isPending && !isClosed;

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      {/* Header reflects the real order state, not just that the buyer arrived here */}
      <div className="text-center mb-10">
        {isPaid && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-foreground/60">Thank you for your order. We&apos;ll be in touch soon.</p>
          </>
        )}
        {isPending && !pollExpired && (
          <>
            <Loader2 className="w-16 h-16 text-foreground/40 mx-auto mb-4 animate-spin" />
            <h1 className="text-3xl font-bold mb-2">Confirming your payment…</h1>
            <p className="text-foreground/60">This usually takes just a few seconds. Please keep this page open.</p>
          </>
        )}
        {isPending && pollExpired && (
          <>
            <Clock className="w-16 h-16 text-foreground/40 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Order received</h1>
            <p className="text-foreground/60">
              We haven&apos;t received confirmation of your payment yet. If you were charged, this page
              will update once it arrives and we&apos;ll email you. Your order number is{' '}
              <span className="font-mono">{order.order_number}</span>.
            </p>
          </>
        )}
        {isClosed && (
          <>
            <XCircle className="w-16 h-16 text-foreground/40 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">
              {order.status === 'refunded' ? 'Order refunded' : 'Order cancelled'}
            </h1>
            <p className="text-foreground/60">
              {order.status === 'refunded'
                ? 'This order has been refunded.'
                : 'This order was cancelled and has not been charged.'}
            </p>
          </>
        )}
      </div>

      {/* Order summary card */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Order Summary</h2>
          <span className="text-sm text-foreground/50 font-mono">{order.order_number}</span>
        </div>

        <div className="divide-y divide-border">
          {order.items.map((item) => (
            <div key={item.id} className="py-3 flex justify-between items-start gap-4">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-sm text-foreground/50">
                  {formatPrice(item.unit_price)} × {item.quantity}
                </p>
              </div>
              <p className="font-medium shrink-0">{formatPrice(item.total_price)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-foreground/60">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.shipping > 0 && (
            <div className="flex justify-between text-foreground/60">
              <span>Shipping</span>
              <span>{formatPrice(order.shipping)}</span>
            </div>
          )}
          {(order.tax_amount != null && order.tax_amount > 0) && (
            <div className="flex justify-between text-foreground/60">
              <span>Tax</span>
              <span>{formatPrice(order.tax_amount / 100)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="font-semibold mb-3">Order Status</h2>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${orderStatusClass(order.status)}`}>
            {order.status}
          </span>
          {order.status === 'pending' && (
            <span className="text-sm text-foreground/50">
              Payment will be confirmed shortly.
            </span>
          )}
          {(order.status === 'processing' || order.status === 'completed') && (
            <span className="text-sm text-green-600">
              Payment confirmed.
            </span>
          )}
          {order.status === 'shipped' && order.tracking_number && (
            <span className="text-sm text-foreground/70">
              Tracking: {order.tracking_carrier ? `${order.tracking_carrier} ` : ''}{order.tracking_number}
            </span>
          )}
          {order.status === 'scheduled' && order.scheduled_at && (
            <span className="text-sm text-foreground/70">
              Scheduled: {new Date(order.scheduled_at).toLocaleDateString()}
              {order.scheduled_note && ` — ${order.scheduled_note}`}
            </span>
          )}
        </div>
      </div>

      {/* Digital downloads (shown when order contains digital products) */}
      {isPaid && order.items.some((i) => i.product?.product_type === 'digital') && (
        <DigitalDownloadsPanel orderId={order.id} showAccountHint />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={PRODUCTS_PATH} className="flex-1">
          <Button variant="outline" className="w-full">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Continue Shopping
          </Button>
        </Link>
        <Link href={ARTICLES_PATH} className="flex-1">
          <Button variant="outline" className="w-full">
            Read Latest Articles
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
