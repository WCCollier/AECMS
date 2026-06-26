# FR-008: Free Product Checkout

**Status:** `deployed`
**Requested:** 2026-06-26
**Deployed:** 2026-06-26
**Size:** `small` (one new backend endpoint, frontend checkout step change, service product shipping fix)

---

## Synopsis

When a product has a price of zero, the payment step should be bypassed entirely. Instead of presenting Stripe or PayPal buttons, the customer clicks "Complete Free Order" and the order is immediately marked paid, triggering all the same downstream effects a paid order would: digital delivery tokens, order confirmation email, and a full order record in the backstage. Additionally, service products should show the shipping address form (matching physical products), since lesson materials and other physical items may need to be mailed to the student.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Identified during FR planning session |
| 2026-06-26 | deployed | Implemented and deployed in one session |

---

## Discussion

### Free digital products require login

A guest claiming a free digital product has no authentication anchor. With paid products, the payment gateway validates a real email before the transaction completes. For free products, no gateway is involved, so a guest could supply a throwaway address and claim downloads with no accountability. More critically, if the delivery email is lost, a guest has no way to recover their downloads (no "my account" page). **Free digital checkouts require the customer to be logged in.**

Free physical and service checkouts may remain available to guests — the shipping address and name provide sufficient identity for those order types.

### Service products now require a shipping address

Current behaviour: service products skip the shipping step entirely. Correct behaviour: service products show the shipping address form (alongside physical products), because lesson materials and other physical accompaniments may need to be mailed to the student. Mixed carts (e.g. digital + service) will show the shipping step if any service or physical item is present.

### What "free" means in the order record

- `status`: `paid` (immediately on completion)
- `payment_method`: `'free'`
- `payment_reference`: `null`
- `total`: `0.00`

All downstream flows (digital delivery token creation, order confirmation email, backstage order record) fire identically to a paid order.

### Cart total vs. individual product price

The bypass triggers on **cart total === 0**, not on any individual product price. A cart with a $10 item and a $0 item is still a paid cart. A cart where all items are priced at zero is a free cart.

---

## Design & Implementation Guide

### Backend

#### New endpoint: `POST /payments/complete-free`

```
Guards: JwtAuthGuard (optional — allows unauthenticated for physical/service)
Body: { order_id: string }
```

1. Load order with `items → product`.
2. Verify `order.total === 0` (or sum of `unit_price * quantity` across items). Throw `BadRequestException` if total > 0.
3. Verify `order.status === 'pending'`. Throw `ConflictException` if already paid/cancelled.
4. Check for digital items. If any `product_type === 'digital'` and `req.user` is null → throw `UnauthorizedException('Log in to claim free digital products.')`.
5. Mark order paid:
   ```prisma
   order.update({ status: 'paid', payment_method: 'free', payment_reference: null })
   ```
6. Fire (non-fatal, wrapped in try/catch):
   - `digitalProductsService.createDownloadTokensForOrder(order.id)`
   - `orderEmailService.sendOrderConfirmation(order.id)`
7. Return `{ order_id, order_number }`.

**Files:**
- `backend/src/payments/payments.controller.ts` — add `POST /payments/complete-free` route
- `backend/src/payments/payments.service.ts` — add `completeFreeOrder(orderId, userId?)` method

#### Service product shipping fix

No backend change needed — the backend already accepts `shipping_address` on order creation and stores it when provided. The fix is purely frontend.

---

### Frontend

#### 1. Fix `needsShipping` to include service products

```typescript
// frontend/app/(site)/checkout/CheckoutPageClient.tsx  line 40
// Before:
const needsShipping = items.some((item) => item.product.product_type === 'physical');
// After:
const needsShipping = items.some(
  (item) => item.product.product_type === 'physical' || item.product.product_type === 'service'
);
```

#### 2. Detect free cart

```typescript
const isFreeCart = subtotal === 0;
const hasDigital = items.some((item) => item.product.product_type === 'digital');
```

#### 3. Gate free digital checkout

On the payment step, before rendering anything, if `isFreeCart && hasDigital && !isAuthenticated`, render a login prompt instead of the payment card:

```
To claim free digital products, please sign in or create an account.
[Sign In]  [Create Account]
```

#### 4. `handleFreeCheckout()`

New handler alongside `handlePayment()`:

```typescript
const handleFreeCheckout = async () => {
  let currentOrderId = orderId;

  // Create order if not yet created (digital/service path skips shipping step)
  if (!currentOrderId) {
    setIsLoading(true);
    try {
      const validation = await api.post('/cart/validate');
      if (validation.data.adjusted) { await mutateCart(); router.push('/cart'); return; }
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
```

#### 5. Render free checkout button on payment step

Replace the Stripe + PayPal buttons when `isFreeCart`:

```tsx
{isFreeCart ? (
  <>
    <div className="text-center py-2 text-foreground/60 text-sm">
      Your order total is $0.00 — no payment required.
    </div>
    <Button
      className="w-full"
      onClick={handleFreeCheckout}
      disabled={isLoading}
      isLoading={isLoading}
    >
      Complete Free Order
    </Button>
  </>
) : (
  // existing Stripe + PayPal buttons
)}
```

**Files:**
- `frontend/app/(site)/checkout/CheckoutPageClient.tsx`

---

## Acceptance Criteria

- [x] A $0.00 physical product shows the shipping address form
- [x] A $0.00 service product shows the shipping address form (new behaviour)
- [x] A $0.00 digital product, logged-in user: shows "Complete Free Order" button, no payment buttons
- [x] A $0.00 digital product, guest: shows login prompt instead of checkout form
- [x] Clicking "Complete Free Order" creates a `processing` order with `payment_method: 'free'`
- [x] Digital delivery tokens are created and delivery email is sent for free digital orders
- [x] Order confirmation email is sent for all free orders
- [ ] A free order appears correctly in `/admin/orders` with $0.00 total and "Free" payment method (live QA pending)
- [x] A cart with mixed priced ($10) and free ($0) items still routes through Stripe/PayPal (total > 0)
- [x] The `complete-free` endpoint rejects orders with total > 0 with `400 Bad Request`
- [x] The `complete-free` endpoint returns success idempotently for already-completed orders

---

## Completion Report

**Implemented:** 2026-06-26  
**Commit:** feat: FR-008 — free product checkout bypass + service product shipping

**Files changed:**
- `backend/src/payments/dto/create-payment.dto.ts` — `CompleteFreeOrderDto` added
- `backend/src/payments/dto/index.ts` — export added
- `backend/src/payments/payments.service.ts` — `completeFreeOrder()` method; verifies $0 total, checks digital+guest, marks `processing/free`, fires download tokens + confirmation email
- `backend/src/payments/payments.controller.ts` — `POST /payments/complete-free` via `OptionalJwtAuthGuard`
- `frontend/app/(site)/checkout/CheckoutPageClient.tsx` — `needsShipping` extended to include `service`; `isFreeCart`/`hasDigital` computed; `handleFreeCheckout()`; payment step renders free UI or login gate instead of Stripe/PayPal when applicable

**Notes:**
- Order status is `processing` (not `paid`) consistent with how Stripe/PayPal paid orders are recorded — `markAsPaid` in `OrdersService` also sets `processing`.
- Idempotency: already-`processing` or `completed` orders return success silently rather than throwing, so React double-fire or network retry is safe.
- Guests cannot add digital products to cart (capability gate fires at `POST /cart/items`), so the frontend login prompt is the primary UX path; the backend `UnauthorizedException` is belt-and-suspenders.
