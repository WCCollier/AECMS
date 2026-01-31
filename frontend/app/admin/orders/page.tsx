'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { Search, Eye, ShoppingCart } from 'lucide-react';
import type { Order, PaginatedResponse } from '@/types';

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useSWR<PaginatedResponse<Order>>(
    `/orders?page=${page}&limit=10${search ? `&search=${search}` : ''}`,
    fetcher
  );

  const orders = data?.data || [];
  const totalPages = data?.total_pages || 1;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500',
    paid: 'bg-green-500/10 text-green-500',
    processing: 'bg-blue-500/10 text-blue-500',
    shipped: 'bg-purple-500/10 text-purple-500',
    delivered: 'bg-green-500/10 text-green-500',
    cancelled: 'bg-red-500/10 text-red-500',
    refunded: 'bg-gray-500/10 text-gray-500',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Orders</h1>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
          <Input
            type="text"
            placeholder="Search by order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Order</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Customer</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Payment</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Total</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-foreground/5">
                      <td className="px-6 py-4">
                        <span className="font-medium">#{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {order.guest_email || 'Registered User'}
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || statusColors.pending}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.payment_status === 'paid' ? 'bg-green-500/10 text-green-500' :
                          order.payment_status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-foreground/60">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
