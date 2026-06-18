'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Truck, Package, BarChart3 } from 'lucide-react';
import useSWR from 'swr';
import { ProductForm } from '@/components/admin/ProductForm';
import { VersionHistoryPanel } from '@/components/admin/VersionHistoryPanel';
import { DigitalFilesPanel } from '@/components/digital/DigitalFilesPanel';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { MediaItem } from '@/types';

const adminFetcher = (url: string) => adminApi.get(url).then((r) => r.data);

interface InventoryStats {
  product_type: string;
  stock_quantity: number | null;
  stock_status: string;
  units_in_carts: number;
  units_purchased_not_shipped: number;
  units_available: number | null;
  units_shipped_total: number;
}

function InventoryTracker({ productId, productType }: { productId: string; productType: string }) {
  const { data: stats } = useSWR<InventoryStats>(
    productId ? `/products/${productId}/inventory-stats` : null,
    adminFetcher,
  );

  if (productType !== 'physical' || !stats) return null;

  return (
    <div className="mt-6 border border-border rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-foreground/60" />
        Inventory Tracker
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-foreground/5 rounded-lg p-4 text-center">
          <ShoppingCart className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.units_in_carts}</p>
          <p className="text-xs text-foreground/50 mt-1">In Carts</p>
        </div>
        <div className="bg-foreground/5 rounded-lg p-4 text-center">
          <Package className="w-5 h-5 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{stats.units_purchased_not_shipped}</p>
          <p className="text-xs text-foreground/50 mt-1">Purchased, Not Shipped</p>
        </div>
        <div className="bg-foreground/5 rounded-lg p-4 text-center">
          <BarChart3 className="w-5 h-5 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold">{stats.units_available ?? '∞'}</p>
          <p className="text-xs text-foreground/50 mt-1">Available Stock</p>
        </div>
        <div className="bg-foreground/5 rounded-lg p-4 text-center">
          <Truck className="w-5 h-5 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold">{stats.units_shipped_total}</p>
          <p className="text-xs text-foreground/50 mt-1">Total Shipped</p>
        </div>
      </div>
    </div>
  );
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price?: number | null;
  sku: string;
  stock_quantity: number | null;
  stock_status: 'in_stock' | 'out_of_stock' | 'back_ordered' | 'available' | 'unavailable';
  product_type: 'physical' | 'digital' | 'service';
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
  media: MediaItem[];
}

export function EditProductClient() {
  const params = useParams();
  const productId = params?.id as string | undefined;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digitalFileCount, setDigitalFileCount] = useState(0);
  const [versionKey, setVersionKey] = useState(0);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await adminApi.get(`/products/${productId}`);
        setProduct(response.data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  if (!productId || isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-foreground/10 rounded w-1/4 mb-6" />
          <div className="h-64 bg-foreground/10 rounded" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error || 'Product not found'}
        </div>
        <Link
          href="/admin/products"
          className="inline-flex items-center text-foreground/60 hover:text-foreground mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold">Edit Product</h1>
      </div>

      <ProductForm
        key={formKey}
        productId={productId}
        initialData={{
          ...product,
          compare_at_price: product.compare_at_price ?? undefined,
          stock_quantity: product.stock_quantity ?? 0,
          stock_status: (product.stock_status === 'available' || product.stock_status === 'unavailable')
            ? 'in_stock'
            : (product.stock_status as 'in_stock' | 'out_of_stock' | 'back_ordered') ?? 'in_stock',
        }}
        digitalFileCount={digitalFileCount}
        onSaved={() => setVersionKey((k) => k + 1)}
        mainExtra={
          product.product_type === 'digital'
            ? <DigitalFilesPanel productId={productId} onFileCountChange={setDigitalFileCount} />
            : product.product_type === 'physical'
              ? <InventoryTracker productId={productId} productType={product.product_type} />
              : undefined
        }
      />

      <div className="mt-6">
        <VersionHistoryPanel
          resourceType="products"
          resourceId={productId}
          refreshKey={versionKey}
          onRestored={async () => {
            try {
              const res = await adminApi.get(`/products/${productId}`);
              setProduct(res.data);
              setFormKey((k) => k + 1);
              setVersionKey((k) => k + 1);
            } catch {}
          }}
        />
      </div>
    </div>
  );
}
