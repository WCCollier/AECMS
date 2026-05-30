'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/types';
import { Button } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addItem(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const isService = product.product_type === 'service';
  const isUnavailable = isService && product.stock_status === 'unavailable';
  const isOutOfStock = !isService && product.stock_quantity != null && product.stock_quantity <= 0;

  return (
    <Link href={`/shop/${product.slug}`} className="group">
      <div className="bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-colors">
        {/* Image */}
        <div className="aspect-square relative bg-surface-raised">
          {product.featured_image_url ? (
            <Image
              src={product.featured_image_url}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground/30">
              <ShoppingCart className="w-12 h-12" />
            </div>
          )}
          {isUnavailable && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-sm font-medium">Not Available</span>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-sm font-medium">Out of Stock</span>
            </div>
          )}
          {isService && !isUnavailable && (
            <div className="absolute top-2 right-2 bg-accent/90 text-white text-xs px-2 py-0.5 rounded-full">
              Lesson
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold truncate group-hover:text-foreground/70 transition-colors">
            {product.name}
          </h3>
          {product.short_description && (
            <p className="text-sm text-foreground/60 mt-1 line-clamp-2">
              {product.short_description}
            </p>
          )}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatPrice(product.price)}</span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-sm text-foreground/50 line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddToCart}
              disabled={isOutOfStock || isUnavailable}
            >
              {isService ? 'Reserve' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
