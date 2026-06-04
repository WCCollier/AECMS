'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/admin/ProductForm';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  featured_image_url: string | null;
  price: number;
  sku: string;
  stock_quantity: number;
  track_inventory: boolean;
  is_digital: boolean;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
}

export function EditProductClient() {
  const params = useParams();
  const productId = params?.id as string | undefined;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await api.get(`/products/${productId}`);
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

      <ProductForm productId={productId} initialData={product} />
    </div>
  );
}
