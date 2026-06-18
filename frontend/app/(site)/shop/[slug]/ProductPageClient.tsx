'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MediaGallery } from '@/components/widgets';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useProduct } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/api';
import { fetcher } from '@/lib/swr';
import { Button, Card, CardContent } from '@/components/ui';
import { ShoppingCart, Minus, Plus, ArrowLeft, Check } from 'lucide-react';
import { CommentList } from '@/components/comments/CommentList';
import { RichTextContent } from '@/components/editor';
import type { Order, PaginatedResponse } from '@/types';

export function ProductPageClient() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const { product, isLoading, isError } = useProduct(slug || '');
  const { addItem } = useCart();
  const { user } = useAuth();

  // Fetch orders only when authenticated; used to determine verified-purchase status
  const { data: ordersData } = useSWR<PaginatedResponse<Order>>(
    user ? '/orders/my?limit=100' : null,
    fetcher,
  );
  const verifiedPurchase = !!(product && (ordersData?.data ?? []).some(
    (o) =>
      ['processing', 'completed'].includes(o.status) &&
      o.items?.some((i: any) => i.product_id === product.id),
  ));
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    setAddError('');
    try {
      await addItem(product.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      setAddError(getErrorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  if (!slug || isLoading) {
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

  const isService = product.product_type === 'service';
  const isDigital = product.product_type === 'digital';
  const isUnavailable = isService && product.stock_status === 'unavailable';
  const isOutOfStock = !isService && !isDigital && product.stock_quantity != null && product.stock_quantity <= 0;
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
        {/* Hero media — carousel when multiple product images exist */}
        <div className="relative">
          <MediaGallery
            media={product.media ?? []}
            aspectRatio="square"
            fallback={
              <div className="w-full h-full flex items-center justify-center text-foreground/30">
                <ShoppingCart className="w-24 h-24" />
              </div>
            }
          />
          {discount && (
            <span className="absolute top-4 left-4 z-20 bg-red-500 text-white text-sm px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.title}</h1>

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
            <RichTextContent
              content={product.description}
              className="prose prose-sm max-w-none mb-6 text-foreground/70"
            />
          )}

          {/* Stock / Availability Status */}
          <div className="mb-6">
            {isDigital ? (
              <span className="text-green-500 font-medium">Available for download</span>
            ) : isService ? (
              isUnavailable ? (
                <span className="text-red-500 font-medium">Not Available</span>
              ) : (
                <span className="text-green-500 font-medium">Available — contact us to schedule</span>
              )
            ) : isOutOfStock ? (
              <span className="text-red-500 font-medium">Out of Stock</span>
            ) : product.stock_quantity != null ? (
              <span className="text-green-500 font-medium">{product.stock_quantity} in stock</span>
            ) : (
              <span className="text-green-500 font-medium">In Stock</span>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Hide quantity selector for service and digital products */}
                {!isService && !isDigital && (
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
                )}

                <Button
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || isUnavailable || adding}
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
                      {isService ? 'Reserve' : 'Add to Cart'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {addError && (
            <p className="text-sm text-red-500 -mt-3 mb-4">{addError}</p>
          )}

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

      <CommentList productId={product.id} verifiedPurchase={verifiedPurchase} />
    </div>
  );
}
