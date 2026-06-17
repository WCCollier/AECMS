'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, RefreshCcw, PackageCheck,
  Truck, CalendarCheck, Package,
} from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { Button } from '@/components/ui';
import type { Order, OrderStatus } from '@/types';
import { AdminDigitalPanel } from '@/components/digital/AdminDigitalPanel';
import { orderStatusClass } from '@/lib/orderStatus';

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock className="w-4 h-4 text-yellow-500" />,
  processing: <RefreshCcw className="w-4 h-4 text-blue-500" />,
  scheduled:  <CalendarCheck className="w-4 h-4 text-indigo-500" />,
  shipped:    <Truck className="w-4 h-4 text-purple-500" />,
  completed:  <PackageCheck className="w-4 h-4 text-green-500" />,
  cancelled:  <XCircle className="w-4 h-4 text-red-500" />,
  refunded:   <CheckCircle2 className="w-4 h-4 text-gray-500" />,
};


interface AuditEntry {
  id: string;
  event_type: string;
  changes?: { before?: { status?: string }; after?: { status?: string } };
  user_id?: string;
  created_at: string;
}

function FulfillmentPanel({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState(order.tracking_carrier ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    order.scheduled_at ? new Date(order.scheduled_at).toISOString().slice(0, 16) : '',
  );
  const [scheduledNote, setScheduledNote] = useState(order.scheduled_note ?? '');

  const hasPhysical = (order.items as any[]).some((i) => i.product?.product_type === 'physical');
  const hasService = (order.items as any[]).some((i) => i.product?.product_type === 'service');
  const hasDigital = (order.items as any[]).some((i) => i.product?.product_type === 'digital');

  const patch = async (body: object) => {
    setIsLoading(true);
    setError('');
    try {
      await adminApi.patch(`/orders/${order.id}/fulfillment`, body);
      onUpdate();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const patchStatus = async (status: OrderStatus) => {
    setIsLoading(true);
    setError('');
    try {
      await adminApi.patch(`/orders/${order.id}/status`, { status });
      onUpdate();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Status update failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (order.status === 'cancelled' || order.status === 'refunded') {
    return (
      <div className="bg-foreground/5 rounded-xl p-4 text-sm text-foreground/50">
        Order is {order.status}. No further actions available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>
      )}

      {/* Physical — mark shipped */}
      {hasPhysical && order.status === 'processing' && (
        <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-500" />
            Ship Physical Items
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Carrier</label>
              <input
                type="text"
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                placeholder="UPS, USPS, FedEx…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="1Z999AA1234567890"
                className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => patch({ tracking_carrier: trackingCarrier, tracking_number: trackingNumber, mark_shipped: true })}
            isLoading={isLoading}
            disabled={!trackingNumber}
          >
            <Truck className="w-4 h-4 mr-2" />
            Mark as Shipped
          </Button>
        </div>
      )}

      {/* Physical — update tracking / mark delivered */}
      {hasPhysical && order.status === 'shipped' && (
        <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-purple-500" />
            Update Tracking
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Carrier</label>
              <input
                type="text"
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => patch({ tracking_carrier: trackingCarrier, tracking_number: trackingNumber })}
              isLoading={isLoading}
            >
              Save Tracking
            </Button>
            <Button size="sm" onClick={() => patchStatus('completed')} isLoading={isLoading}>
              <PackageCheck className="w-4 h-4 mr-2" />
              Mark Delivered
            </Button>
          </div>
        </div>
      )}

      {/* Service — schedule */}
      {hasService && order.status === 'processing' && (
        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-indigo-500" />
            Schedule Service
          </h3>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Appointment Date &amp; Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Note to Customer (optional)</label>
            <input
              type="text"
              value={scheduledNote}
              onChange={(e) => setScheduledNote(e.target.value)}
              placeholder="e.g. Zoom link will be sent separately"
              className="w-full px-3 py-2 text-sm rounded-lg border border-foreground/20 bg-background"
            />
          </div>
          <Button
            size="sm"
            onClick={() => patch({ mark_scheduled: true, scheduled_at: scheduledAt, scheduled_note: scheduledNote })}
            isLoading={isLoading}
          >
            <CalendarCheck className="w-4 h-4 mr-2" />
            Mark as Scheduled
          </Button>
        </div>
      )}

      {/* Service — mark complete */}
      {hasService && order.status === 'scheduled' && (
        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Service Completion</h3>
          {order.scheduled_at && (
            <p className="text-sm text-foreground/60">
              Scheduled: {new Date(order.scheduled_at).toLocaleString()}
              {order.scheduled_note && ` — ${order.scheduled_note}`}
            </p>
          )}
          <Button size="sm" onClick={() => patchStatus('completed')} isLoading={isLoading}>
            <PackageCheck className="w-4 h-4 mr-2" />
            Mark Service Complete
          </Button>
        </div>
      )}

      {/* Digital */}
      {hasDigital && (
        <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            Digital Items
          </h3>
          <AdminDigitalPanel orderId={order.id} />
        </div>
      )}

      {/* Generic actions */}
      <div className="flex gap-2 pt-2 border-t border-foreground/10 flex-wrap">
        {order.status === 'processing' && !hasService && !hasPhysical && (
          <Button size="sm" onClick={() => patchStatus('completed')} isLoading={isLoading}>
            <PackageCheck className="w-4 h-4 mr-2" />
            Mark Completed
          </Button>
        )}
        {(['pending', 'processing', 'scheduled'] as OrderStatus[]).includes(order.status) && (
          <Button size="sm" variant="outline" onClick={() => patchStatus('cancelled')} isLoading={isLoading}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel Order
          </Button>
        )}
        {(['processing', 'shipped', 'scheduled', 'completed'] as OrderStatus[]).includes(order.status) && (
          <Button size="sm" variant="outline" onClick={() => patchStatus('refunded')} isLoading={isLoading}>
            Refund
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const { data: order, isLoading: orderLoading, mutate: mutateOrder } = useSWR<Order>(
    orderId ? `/orders/${orderId}` : null,
    fetcher,
  );

  const { data: auditData } = useSWR(
    orderId ? `/audit-logs?resource_type=order&resource_id=${orderId}&limit=50` : null,
    fetcher,
  );

  const statusHistory: AuditEntry[] = (auditData?.data ?? []).filter(
    (e: AuditEntry) => e.event_type === 'order.status_changed',
  );

  if (orderLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-foreground/10 rounded w-1/4" />
          <div className="h-32 bg-foreground/10 rounded" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-red-500">Order not found.</p>
        <Link href="/admin/orders" className="inline-flex items-center text-foreground/60 hover:text-foreground mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Orders
        </Link>
      </div>
    );
  }

  const shippingAddr = order.shipping_address as any;

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <Link href="/admin/orders" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{order.order_number}</h1>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm border capitalize ${orderStatusClass(order.status, true)}`}>
            {STATUS_ICONS[order.status]}
            {order.status}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Customer', value: order.email },
          { label: 'Total', value: `$${Number(order.total).toFixed(2)}` },
          { label: 'Payment', value: order.payment_method ?? '—' },
          { label: 'Paid', value: order.paid_at ? new Date(order.paid_at).toLocaleDateString() : '—' },
          { label: 'Created', value: new Date(order.created_at).toLocaleDateString() },
          { label: 'Items', value: order.items?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-foreground/5 rounded-lg p-4">
            <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1">{label}</p>
            <p className="font-medium">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Items</h2>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Product</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Type</th>
                <th className="px-4 py-3 text-center font-medium text-foreground/70">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/70">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(order.items as any[]).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.product_name ?? item.product?.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/60 capitalize">
                      {item.product?.product_type ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">${Number(item.total_price ?? item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping address */}
      {shippingAddr && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Shipping Address</h2>
          <div className="bg-foreground/5 rounded-xl p-4 text-sm space-y-1">
            {shippingAddr.street && <p>{shippingAddr.street}</p>}
            {shippingAddr.city && (
              <p>
                {shippingAddr.city}
                {shippingAddr.state ? `, ${shippingAddr.state}` : ''}{' '}
                {shippingAddr.postal_code}
              </p>
            )}
            {shippingAddr.country && <p>{shippingAddr.country}</p>}
          </div>
        </div>
      )}

      {/* Fulfillment panel */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Fulfillment</h2>
        <FulfillmentPanel order={order} onUpdate={() => mutateOrder()} />
      </div>

      {/* Status history */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Status History</h2>
        {statusHistory.length === 0 ? (
          <p className="text-foreground/50 text-sm">No status changes recorded yet.</p>
        ) : (
          <ol className="relative border-l border-border ml-2">
            {statusHistory.map((entry) => {
              const toStatus = entry.changes?.after?.status ?? '?';
              const fromStatus = entry.changes?.before?.status;
              return (
                <li key={entry.id} className="mb-6 ml-4">
                  <div className="absolute -left-1.5 mt-1.5 bg-background border border-border rounded-full p-0.5">
                    {STATUS_ICONS[toStatus] ?? <Clock className="w-4 h-4 text-foreground/50" />}
                  </div>
                  <div className="bg-foreground/5 rounded-lg px-4 py-3 border border-border">
                    <p className="font-medium capitalize">
                      {fromStatus ? `${fromStatus} → ` : ''}{toStatus}
                    </p>
                    <p className="text-xs text-foreground/50 mt-1">
                      {new Date(entry.created_at).toLocaleString()}
                      {entry.user_id ? ` · by ${entry.user_id.slice(0, 8)}…` : ' · system'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
