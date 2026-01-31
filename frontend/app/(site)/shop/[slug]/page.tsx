'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProduct } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { Button, Card, CardContent } from '@/components/ui';
import { ShoppingCart, Minus, Plus, ArrowLeft, Check } from 'lucide-react';

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { product, isLoading, isError } = useProduct(slug);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await addItem(product.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-foreground/10 rounded w-24 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="aspect-square bg-foreground/10 rounded-lg" />
            <div>
              <div className="h-8 bg-foreground/10 rounded w-3/4 mb-4" />
              <div className="h-6 bg-foreground/10 rounded w-1/4 mb-6" />
              <div className="h-4 bg-foreground/10 rounded mb-2" />
              <div className="h-4 bg-foreground/10 rounded mb-2" />
              <div className="h-4 bg-foreground/10 rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/shop" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>
        <div className="text-center py-12">
          <p className="text-foreground/60">Product not found.</p>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.track_inventory && product.stock_quantity <= 0 && !product.allow_backorder;
  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Link */}
      <Link href="/shop" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square relative bg-foreground/5 rounded-lg overflow-hidden">
          {product.featured_image_url ? (
            <Image
              src={product.featured_image_url}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground/30">
              <ShoppingCart className="w-24 h-24" />
            </div>
          )}
          {discount && (
            <span className="absolute top-4 left-4 bg-red-500 text-white text-sm px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>

          {/* Price */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-lg text-foreground/50 line-through">
                {formatPrice(product.compare_at_price)}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm max-w-none mb-6 text-foreground/70">
              <p>{product.description}</p>
            </div>
          )}

          {/* Stock Status */}
          <div className="mb-6">
            {isOutOfStock ? (
              <span className="text-red-500 font-medium">Out of Stock</span>
            ) : product.track_inventory ? (
              <span className="text-green-500 font-medium">
                {product.stock_quantity} in stock
              </span>
            ) : (
              <span className="text-green-500 font-medium">In Stock</span>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-foreground/20 rounded-lg">
                  <button
                    className="p-2 hover:bg-foreground/5"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                  <button
                    className="p-2 hover:bg-foreground/5"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || adding}
                  isLoading={adding}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Added!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SKU */}
          <p className="text-sm text-foreground/50">
            SKU: {product.sku}
          </p>

          {/* Categories/Tags */}
          {(product.categories.length > 0 || product.tags.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${cat.slug}`}
                  className="text-sm px-3 py-1 bg-foreground/5 rounded-full hover:bg-foreground/10 transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-sm px-3 py-1 bg-foreground/5 rounded-full"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
