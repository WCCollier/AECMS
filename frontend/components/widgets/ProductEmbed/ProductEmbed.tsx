'use client';

import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Star, ShoppingCart, ArrowRight } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

interface ProductEmbedProps {
  productId: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function StockBadge({ status }: { status: Product['stock_status'] }) {
  const inStock = status === 'in_stock' || status === 'available' || status === 'back_ordered' || status === 'backorder';
  return (
    <span className={`text-xs ${inStock ? 'text-green-600' : 'text-foreground/50'}`}>
      {inStock ? 'In stock' : 'Out of stock'}
    </span>
  );
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating || count === 0) return null;
  const stars = Math.round(rating);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-foreground/20'}`} />
      ))}
      <span className="text-xs text-foreground/60">({count})</span>
    </div>
  );
}

export function ProductEmbed({ productId }: ProductEmbedProps) {
  const size = useWidgetSize();
  const { addItem } = useCart();
  const { data: product, isLoading } = useSWR<Product>(
    productId ? `/products/${productId}` : null,
    fetcher,
  );

  if (isLoading || !product) {
    return (
      <div className={`animate-pulse border border-border rounded-lg overflow-hidden my-4 ${
        size === 'small' ? 'flex gap-3 p-3' : ''
      }`}>
        {size === 'small' ? (
          <>
            <div className="w-16 h-16 bg-foreground/10 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-foreground/10 rounded w-3/4" />
              <div className="h-3 bg-foreground/10 rounded w-1/4" />
            </div>
          </>
        ) : (
          <>
            <div className="aspect-square bg-foreground/10" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-foreground/10 rounded w-3/4" />
              <div className="h-3 bg-foreground/10 rounded w-1/4" />
            </div>
          </>
        )}
      </div>
    );
  }

  const href = `/shop/${product.slug}`;
  const primaryImage = product.media?.find((m) => m.is_primary) ?? product.media?.[0];
  const imageUrl = primaryImage?.url ?? product.featured_image_url ?? null;
  const canAdd = product.stock_status === 'in_stock' || product.stock_status === 'available';

  if (size === 'small') {
    return (
      <div className="flex gap-3 p-3 border border-border rounded-lg my-2">
        <Link href={href} className="flex-shrink-0">
          {imageUrl ? (
            <div className="relative w-16 h-16 rounded overflow-hidden bg-foreground/10">
              <Image src={imageUrl} alt={product.name} fill className="object-cover" sizes="64px" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded bg-foreground/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-foreground/30" />
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={href} className="font-medium text-sm line-clamp-2 hover:text-accent transition-colors block">
            {product.name}
          </Link>
          <p className="text-sm font-semibold mt-0.5">{formatPrice(product.price)}</p>
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => canAdd && addItem(product.id, 1)}
              disabled={!canAdd}
              title="Add to cart"
              className="p-1.5 rounded bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
            </button>
            <Link
              href={href}
              className="p-1.5 rounded border border-border hover:bg-surface-raised transition-colors text-xs flex items-center gap-1 no-underline"
            >
              View <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden my-4">
      {imageUrl && (
        <div className="relative aspect-square bg-foreground/10">
          <Image src={imageUrl} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
      )}
      <div className="p-4">
        <Link href={href} className="group">
          <h3 className="text-lg font-semibold group-hover:text-accent transition-colors">{product.name}</h3>
        </Link>
        <StarRating rating={product.average_rating} count={product.review_count} />
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-xl font-bold">{formatPrice(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-sm text-foreground/50 line-through">{formatPrice(product.compare_at_price)}</span>
          )}
        </div>
        <StockBadge status={product.stock_status} />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => canAdd && addItem(product.id, 1)}
            disabled={!canAdd}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </button>
          <Link
            href={href}
            className="px-4 py-2 border border-border rounded-lg hover:bg-surface-raised transition-colors text-sm no-underline"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
