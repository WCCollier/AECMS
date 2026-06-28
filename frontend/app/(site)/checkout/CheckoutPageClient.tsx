'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder } from '@/hooks/useOrders';
import api, { getErrorMessage } from '@/lib/api';

const ADJUSTMENT_KEY = 'cart_stock_adjustments';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui';
import { ArrowLeft, ShoppingCart, Loader2 } from 'lucide-react';
import type { PaymentIntent, ShippingAddress, UserAddress } from '@/types';

export function CheckoutPageClient() {
  const router = useRouter();
  const { items, subtotal, clearCart, mutate: mutateCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'shipping' | 'payment'>('shipping');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null);

  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });

  // Physical and service products require a shipping address (service may mail materials)
  const needsShipping = items.some(
    (item) => item.product.product_type === 'physical' || item.product.product_type === 'service',
  );
  // Cart is free when all items total zero
  const isFreeCart = subtotal === 0 && items.length > 0;
  // Free digital products require a logged-in user (no payment gateway to validate guest identity)
  const hasDigital = items.some((item) => item.product.product_type === 'digital');
  // Show name fields when guest, or when logged-in user hasn't provided a name yet
  const needsName = !isAuthenticated || !user?.firstName;

  // Load default saved address for authenticated users
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get<UserAddress | null>('/addresses/default').then((res) => {
      const addr = res.data;
      setDefaultAddress(addr);
      if (addr) {
        setFormData((prev) => ({
          ...prev,
          street: addr.street,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postal_code,
          country: addr.country,
        }));
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  // Skip shipping step for digital/service-only carts
  useEffect(() => {
    if (items.length > 0 && !needsShipping) {
      setStep('payment');
    }
  }, [items.length, needsShipping]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
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
      // Pre-flight: validate cart stock and correct any over-limit quantities
      const validation = await api.post<{
        adjusted: boolean;
        changes: Array<{ product_name: string; action: 'removed' | 'reduced'; from: number; to: number }>;
      }>('/cart/validate');

      if (validation.data.adjusted) {
        const messages = validation.data.changes.map((c) =>
          c.action === 'removed'
            ? `"${c.product_name}" was removed (no longer in stock)`
            : `"${c.product_name}" quantity reduced from ${c.from} to ${c.to} (only ${c.to} available)`,
        );
        sessionStorage.setItem(ADJUSTMENT_KEY, JSON.stringify(messages));
        await mutateCart();
        router.push('/cart');
        return;
      }

      const shippingAddress: ShippingAddress = {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country: formData.country,
      };

      // Optionally save address to address book
      let savedAddressId: string | undefined;
      if (saveAddress && isAuthenticated) {
        try {
          const res = await api.post<UserAddress>('/addresses', {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
            is_default: true,
          });
          savedAddressId = res.data.id;
        } catch { /* non-fatal — order still proceeds */ }
      }

      const order = await createOrder({
        shipping_address: shippingAddress,
        address_id: savedAddressId,
        guest_email: !isAuthenticated ? formData.email : undefined,
        customer_first_name: formData.firstName || undefined,
        customer_last_name: formData.lastName || undefined,
      });

      setOrderId(order.id);
      setStep('payment');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (provider: 'stripe' | 'paypal') => {
    if (needsName && !formData.firstName) {
      setError('Please enter your first name before continuing.');
      return;
    }

    let currentOrderId = orderId;

    // For digital/service carts, create the order now if not yet created
    if (!currentOrderId && !needsShipping) {
      setIsLoading(true);
      setError('');
      try {
        const validation = await api.post<{ adjusted: boolean; changes: any[] }>('/cart/validate');
        if (validation.data.adjusted) {
          await mutateCart();
          router.push('/cart');
          return;
        }
        const order = await createOrder({
          guest_email: !isAuthenticated ? formData.email : undefined,
          customer_first_name: formData.firstName || undefined,
          customer_last_name: formData.lastName || undefined,
        });
        currentOrderId = order.id;
        setOrderId(order.id);
      } catch (err) {
        setError(getErrorMessage(err));
        setIsLoading(false);
        return;
      }
    }

    if (!currentOrderId) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post<PaymentIntent>('/payments/create-intent', {
        order_id: currentOrderId,
        provider,
      });

      if (provider === 'stripe') {
        if (response.data.client_secret) {
          setRedirecting(true);
          await clearCart();
          window.location.href = response.data.client_secret;
        }
      } else if (provider === 'paypal') {
        if (response.data.client_secret) {
          setRedirecting(true);
          window.location.href = response.data.client_secret;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFreeCheckout = async () => {
    let currentOrderId = orderId;

    if (!currentOrderId && !needsShipping) {
      setIsLoading(true);
      setError('');
      try {
        const validation = await api.post<{ adjusted: boolean; changes: any[] }>('/cart/validate');
        if (validation.data.adjusted) {
          await mutateCart();
          router.push('/cart');
          return;
        }
        const order = await createOrder({
          guest_email: !isAuthenticated ? formData.email : undefined,
          customer_first_name: formData.firstName || undefined,
          customer_last_name: formData.lastName || undefined,
        });
        currentOrderId = order.id;
        setOrderId(order.id);
      } catch (err) {
        setError(getErrorMessage(err));
        setIsLoading(false);
        return;
      }
    }

    if (!currentOrderId) return;
    setIsLoading(true);
    setError('');
    try {
      await api.post('/payments/complete-free', { order_id: currentOrderId });
      await clearCart();
      router.push(`/order-confirmation?order=${currentOrderId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 mx-auto text-foreground/40 mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Redirecting to secure payment…</h2>
          <p className="text-foreground/50">Please do not close this page.</p>
        </div>
      </div>
    );
  }

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

  const addressChanged = defaultAddress && (
    formData.street !== defaultAddress.street ||
    formData.city !== defaultAddress.city ||
    formData.state !== defaultAddress.state ||
    formData.postal_code !== defaultAddress.postal_code ||
    formData.country !== defaultAddress.country
  );

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
        <div className="md:col-span-2">
          {step === 'shipping' && needsShipping ? (
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

                  {needsName && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="First Name"
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        placeholder="Jane"
                        autoComplete="given-name"
                      />
                      <Input
                        label="Last Name"
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        placeholder="Smith"
                        autoComplete="family-name"
                      />
                    </div>
                  )}

                  {defaultAddress && (
                    <div className="text-sm text-foreground/60 bg-foreground/5 rounded-lg px-3 py-2">
                      Your saved address has been pre-filled below.
                    </div>
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

                  {isAuthenticated && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="rounded"
                      />
                      {defaultAddress
                        ? 'Save as new default address'
                        : 'Save this address for future orders'}
                    </label>
                  )}
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
                <CardTitle>{isFreeCart ? 'Complete Your Order' : 'Payment Method'}</CardTitle>
                {!needsShipping && !isFreeCart && (
                  <p className="text-sm text-foreground/60 mt-1">
                    No shipping required for your items.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guest login gate for free digital products */}
                {isFreeCart && hasDigital && !isAuthenticated ? (
                  <div className="text-center py-4 space-y-4">
                    <p className="text-foreground/70">
                      Please sign in to claim free digital products. This ensures you can access your downloads at any time from your account.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" onClick={() => router.push('/auth/login?redirect=/checkout')}>
                        Sign In
                      </Button>
                      <Button onClick={() => router.push('/auth/register?redirect=/checkout')}>
                        Create Account
                      </Button>
                    </div>
                  </div>
                ) : isFreeCart ? (
                  <>
                    {!isAuthenticated && !needsShipping && (
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
                    {needsName && !needsShipping && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="First Name"
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                          placeholder="Jane"
                          autoComplete="given-name"
                        />
                        <Input
                          label="Last Name"
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                          placeholder="Smith"
                          autoComplete="family-name"
                        />
                      </div>
                    )}
                    <p className="text-sm text-center text-foreground/60">
                      Your order total is $0.00 — no payment required.
                    </p>
                    <Button
                      className="w-full"
                      onClick={handleFreeCheckout}
                      disabled={isLoading}
                      isLoading={isLoading}
                    >
                      Complete Free Order
                    </Button>
                    {needsShipping && (
                      <Button variant="ghost" className="w-full" onClick={() => setStep('shipping')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Shipping
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {!isAuthenticated && !needsShipping && (
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

                    {needsName && !needsShipping && (
                      <div className="space-y-3">
                        <p className="text-sm text-foreground/60">
                          {isAuthenticated
                            ? 'Please add your name — it\'ll be used for personalised digital files and receipts.'
                            : 'Your name is used for personalised digital files and receipts.'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="First Name"
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            placeholder="Jane"
                            autoComplete="given-name"
                          />
                          <Input
                            label="Last Name"
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            placeholder="Smith"
                            autoComplete="family-name"
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full justify-start h-auto py-4"
                      variant="outline"
                      onClick={() => handlePayment('stripe')}
                      disabled={isLoading}
                    >
                      <img src="/stripe-logo.svg" alt="Stripe" className="h-5 mr-4 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold">Credit or Debit Card</p>
                        <p className="text-sm text-foreground/60 flex items-center gap-1.5 flex-wrap">
                          Visa, Mastercard, AMEX
                          <span className="text-foreground/30">·</span>
                          <span className="inline-flex items-center gap-1">
                            includes
                            <img src="/amazon-pay-logo.svg" alt="Amazon Pay" className="h-5 inline-block" />
                          </span>
                        </p>
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

                    {needsShipping && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setStep('shipping')}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Shipping
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

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
                      {item.product.title} x {item.quantity}
                      {item.product.product_type !== 'physical' && (
                        <span className="ml-1 text-foreground/40 text-xs capitalize">
                          ({item.product.product_type})
                        </span>
                      )}
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
                  <span className="text-foreground/60">{needsShipping ? 'Free' : 'N/A'}</span>
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
