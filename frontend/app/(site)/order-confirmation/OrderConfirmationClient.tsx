'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/hooks/useOrders';
import { Button } from '@/components/ui';
import { CheckCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { DigitalDownloadsPanel } from '@/components/digital/DigitalDownloadsPanel';
import { orderStatusClass } from '@/lib/orderStatus';

export function OrderConfirmationClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order') ?? '';
  const { order, isLoading, isError } = useOrder(orderId || undefined);

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
        <Link href="/shop"><Button>Continue Shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      {/* Success header */}
      <div className="text-center mb-10">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-foreground/60">
          Thank you for your order. We&apos;ll be in touch soon.
        </p>
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
          {order.tax > 0 && (
            <div className="flex justify-between text-foreground/60">
              <span>Tax</span>
              <span>{formatPrice(order.tax)}</span>
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
      {order.items.some((i) => i.product?.product_type === 'digital') && (
        <DigitalDownloadsPanel orderId={order.id} showAccountHint />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/shop" className="flex-1">
          <Button variant="outline" className="w-full">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Continue Shopping
          </Button>
        </Link>
        <Link href="/articles" className="flex-1">
          <Button variant="outline" className="w-full">
            Read Latest Articles
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
