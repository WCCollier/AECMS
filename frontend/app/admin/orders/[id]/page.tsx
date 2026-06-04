'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Clock, CheckCircle2, XCircle, RefreshCcw, PackageCheck } from 'lucide-react';
import adminApi from '@/lib/adminApi';

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock className="w-4 h-4 text-yellow-500" />,
  processing: <RefreshCcw className="w-4 h-4 text-blue-500" />,
  completed:  <PackageCheck className="w-4 h-4 text-green-500" />,
  cancelled:  <XCircle className="w-4 h-4 text-red-500" />,
  refunded:   <CheckCircle2 className="w-4 h-4 text-purple-500" />,
};

interface AuditEntry {
  id: string;
  event_type: string;
  changes?: { before?: { status?: string }; after?: { status?: string } };
  metadata?: { payment_intent_id?: string };
  user_id?: string;
  created_at: string;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const { data: order, isLoading: orderLoading } = useSWR(
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

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/orders" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{order.order_number}</h1>
          <span className="px-2.5 py-0.5 rounded-full text-sm border border-border capitalize">
            {order.status}
          </span>
        </div>
      </div>

      {/* Order summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Customer', value: order.email },
          { label: 'Total', value: `$${Number(order.total).toFixed(2)}` },
          { label: 'Payment', value: order.payment_method },
          { label: 'Created', value: new Date(order.created_at).toLocaleDateString() },
          { label: 'Items', value: order.items?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-foreground/5 rounded-lg p-4">
            <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1">{label}</p>
            <p className="font-medium">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Status history timeline */}
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
                      {entry.user_id
                        ? ` · by ${entry.user_id.slice(0, 8)}…`
                        : ' · system'}
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
