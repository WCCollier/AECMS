'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProducts } from '@/hooks/useProducts';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { products, totalPages, isLoading } = useProducts({ page, limit: 10, search: search || undefined });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
          <Input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
              <p className="text-foreground/60">No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">SKU</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Price</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Stock</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-foreground/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-foreground/10 rounded flex items-center justify-center">
                            <Package className="w-5 h-5 text-foreground/50" />
                          </div>
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">{product.sku}</td>
                      <td className="px-6 py-4">{formatPrice(product.price)}</td>
                      <td className="px-6 py-4">
                        {product.track_inventory ? product.stock_quantity : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          product.status === 'published' ? 'bg-green-500/10 text-green-500' :
                          product.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-foreground/10 text-foreground/60'
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/products/${product.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
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
