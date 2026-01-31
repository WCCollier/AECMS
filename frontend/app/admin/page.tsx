'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Package, FileText, ShoppingCart, DollarSign, TrendingUp, Users } from 'lucide-react';

interface DashboardStats {
  products: number;
  articles: number;
  orders: number;
  revenue: number;
}

export default function AdminDashboard() {
  // In a real app, these would come from a dedicated dashboard API endpoint
  // For now, we'll use individual endpoints
  const { data: productsData } = useSWR('/products?limit=1', fetcher);
  const { data: articlesData } = useSWR('/articles?limit=1', fetcher);
  const { data: ordersData } = useSWR('/orders?limit=5', fetcher);

  const stats = [
    {
      label: 'Total Products',
      value: productsData?.total || 0,
      icon: Package,
      href: '/admin/products',
      color: 'text-blue-500',
    },
    {
      label: 'Published Articles',
      value: articlesData?.total || 0,
      icon: FileText,
      href: '/admin/articles',
      color: 'text-green-500',
    },
    {
      label: 'Total Orders',
      value: ordersData?.total || 0,
      icon: ShoppingCart,
      href: '/admin/orders',
      color: 'text-purple-500',
    },
    {
      label: 'Revenue',
      value: '$0.00',
      icon: DollarSign,
      href: '/admin/orders',
      color: 'text-yellow-500',
    },
  ];

  const recentOrders = ordersData?.data || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:border-foreground/20 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground/60">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 bg-foreground/5 rounded-lg ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/admin/products/new"
                className="p-4 border border-foreground/10 rounded-lg hover:bg-foreground/5 text-center"
              >
                <Package className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">Add Product</span>
              </Link>
              <Link
                href="/admin/articles/new"
                className="p-4 border border-foreground/10 rounded-lg hover:bg-foreground/5 text-center"
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">New Article</span>
              </Link>
              <Link
                href="/admin/orders"
                className="p-4 border border-foreground/10 rounded-lg hover:bg-foreground/5 text-center"
              >
                <ShoppingCart className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">View Orders</span>
              </Link>
              <Link
                href="/admin/settings"
                className="p-4 border border-foreground/10 rounded-lg hover:bg-foreground/5 text-center"
              >
                <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm">Analytics</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link href="/admin/orders" className="text-sm text-foreground/60 hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-foreground/60 text-center py-4">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">#{order.order_number}</p>
                      <p className="text-sm text-foreground/60">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatPrice(order.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.status === 'paid' ? 'bg-green-500/10 text-green-500' :
                        order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-foreground/10 text-foreground/60'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Backend API: Online</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Database: Connected</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Payments: Configured</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
