'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder } from '@/hooks/useOrders';
import api from '@/lib/api';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui';
import { ArrowLeft, CreditCard, ShoppingCart } from 'lucide-react';
import type { PaymentIntent, ShippingAddress } from '@/types';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'shipping' | 'payment'>('shipping');
  const [orderId, setOrderId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: user?.email || '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const shippingAddress: ShippingAddress = {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country: formData.country,
      };

      const order = await createOrder({
        shipping_address: shippingAddress,
        guest_email: !isAuthenticated ? formData.email : undefined,
      });

      setOrderId(order.id);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (provider: 'stripe' | 'paypal') => {
    if (!orderId) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post<PaymentIntent>('/payments/create-intent', {
        order_id: orderId,
        provider,
      });

      if (provider === 'stripe') {
        // For Stripe, we'd normally use Stripe.js here
        // For now, show a placeholder message
        alert(`Stripe payment created. Client secret: ${response.data.client_secret}\n\nIn production, this would open Stripe Elements.`);
        // After successful payment, clear cart and redirect
        await clearCart();
        router.push(`/order-confirmation?order=${orderId}`);
      } else if (provider === 'paypal') {
        // Redirect to PayPal approval URL
        if (response.data.approval_url) {
          window.location.href = response.data.approval_url;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <ShoppingCart className="w-16 h-16 mx-auto text-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-foreground/60 mb-6">Add some products before checkout</p>
          <Link href="/shop">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse Products
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/cart" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Cart
      </Link>

      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      {error && (
        <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="md:col-span-2">
          {step === 'shipping' ? (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Information</CardTitle>
              </CardHeader>
              <form onSubmit={handleShippingSubmit}>
                <CardContent className="space-y-4">
                  {!isAuthenticated && (
                    <Input
                      label="Email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="your@email.com"
                    />
                  )}

                  <Input
                    label="Street Address"
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    required
                    placeholder="123 Main St"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                    <Input
                      label="State"
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Postal Code"
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Country
                      </label>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background"
                        required
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    Continue to Payment
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full justify-start h-auto py-4"
                  variant="outline"
                  onClick={() => handlePayment('stripe')}
                  disabled={isLoading}
                >
                  <CreditCard className="w-6 h-6 mr-4" />
                  <div className="text-left">
                    <p className="font-semibold">Credit Card</p>
                    <p className="text-sm text-foreground/60">Pay with Visa, Mastercard, or AMEX</p>
                  </div>
                </Button>

                <Button
                  className="w-full justify-start h-auto py-4"
                  variant="outline"
                  onClick={() => handlePayment('paypal')}
                  disabled={isLoading}
                >
                  <div className="w-6 h-6 mr-4 flex items-center justify-center font-bold text-blue-600">
                    P
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">PayPal</p>
                    <p className="text-sm text-foreground/60">Pay with your PayPal account</p>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('shipping')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Shipping
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground/70">
                      {item.product.name} x {item.quantity}
                    </span>
                    <span>{formatPrice(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
                <hr className="border-foreground/10" />
                <div className="flex justify-between">
                  <span className="text-foreground/60">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/60">Shipping</span>
                  <span className="text-foreground/60">Free</span>
                </div>
                <hr className="border-foreground/10" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
