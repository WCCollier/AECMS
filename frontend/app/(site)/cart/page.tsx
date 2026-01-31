'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, CardContent, CardFooter } from '@/components/ui';
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft } from 'lucide-react';

export default function CartPage() {
  const { items, subtotal, isLoading, updateItem, removeItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 bg-foreground/5 rounded-lg">
              <div className="w-24 h-24 bg-foreground/10 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-foreground/10 rounded w-1/2 mb-2" />
                <div className="h-4 bg-foreground/10 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
        <div className="text-center py-16">
          <ShoppingCart className="w-16 h-16 mx-auto text-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-foreground/60 mb-6">Add some products to get started</p>
          <Link href="/shop">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <Button variant="ghost" onClick={() => clearCart()}>
          Clear Cart
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <Link href={`/shop/${item.product.slug}`} className="shrink-0">
                    <div className="w-24 h-24 relative bg-foreground/5 rounded-lg overflow-hidden">
                      {item.product.featured_image_url ? (
                        <Image
                          src={item.product.featured_image_url}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/30">
                          <ShoppingCart className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/shop/${item.product.slug}`}>
                      <h3 className="font-semibold hover:text-foreground/70 truncate">
                        {item.product.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-foreground/60">{formatPrice(item.unit_price)} each</p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center border border-foreground/20 rounded-lg">
                        <button
                          className="p-1.5 hover:bg-foreground/5"
                          onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-sm">{item.quantity}</span>
                        <button
                          className="p-1.5 hover:bg-foreground/5"
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        className="p-1.5 text-foreground/50 hover:text-red-500 transition-colors"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.unit_price * item.quantity)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/60">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Shipping</span>
                  <span className="text-foreground/60">Calculated at checkout</span>
                </div>
                <hr className="my-4 border-foreground/10" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-6 pt-0">
              <div className="w-full space-y-3">
                <Link href="/checkout" className="block">
                  <Button className="w-full">
                    Proceed to Checkout
                  </Button>
                </Link>
                {!isAuthenticated && (
                  <p className="text-xs text-center text-foreground/60">
                    <Link href="/auth/login" className="underline">Sign in</Link> for faster checkout
                  </p>
                )}
                <Link href="/shop" className="block">
                  <Button variant="outline" className="w-full">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
