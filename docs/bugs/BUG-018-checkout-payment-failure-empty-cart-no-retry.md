# BUG-018: Checkout payment-failure handling (empty cart, no retry, stock never released)

**Status:** `in-dev`
**Reported:** 2026-10-04
**Severity:** `high`
**Area:** checkout, orders, payments, stock

---

## Description

When the payment step fails (observed: `create-intent` 400, see the payments `isAvailable()` fix) the checkout error shows for a moment and the page then reloads to "Your cart is empty". The same happens after a Stripe cancel: the cancel page's "Try Again" link goes to `/checkout`, which also shows an empty cart. The pending order cannot be retried from the UI, and its stock stays decremented until someone cancels it manually.

---

## Reproduction Steps

1. Add a product to the cart, go to checkout, click Pay with Stripe.
2. Make the payment step fail (or cancel on the Stripe page).
3. Observed: error flashes, then "Your cart is empty"; after cancel, "Try Again" lands on the empty-cart view.
4. Expected: error stays visible; buyer can retry payment for the same order.

---

## Root Cause

Several independent facts, verified in code 2026-10-04:

1. **Cart is cleared at order creation, not at payment.** `OrdersService.createFromCart()` calls `cartService.clearCart()` (`orders.service.ts:~220`). `CheckoutPageClient.tsx` keeps the order ID only in React state; SWR revalidation then sees `items.length === 0` and line ~271 replaces the whole view with the empty-cart screen, hiding the error.
2. **No retry route.** `CancelClient.tsx` links "Try Again" to `/checkout` (no order param); the page does not load a pending order.
3. **Backend refuses a second session.** `createPaymentIntent` throws `Order already has a payment intent` if `payment_intent_id` is set (`payments.service.ts:~107`), so retry would fail even if the UI allowed it.
4. **Failure/expiry webhooks do nothing.** `handlePaymentFailed` (also used for `checkout.session.expired`) only logs ("Order remains in pending status - user can retry"). Stock is not restored.
5. **No automatic expiry of pending orders.** Only the nightly PayPal reconcile cron exists; it recovers paid PayPal orders and leaves the rest. `OrdersService.cancel()` restores stock but is manual (`POST /orders/:id/cancel`) and does not expire the Stripe session.
6. **`markAsPaid` has no status guard** (`orders.service.ts:370`). A cancelled order (stock already restored) whose Stripe session is still open can still be paid and flipped to `processing`, which oversells.

### Stock system as it exists today (research)

- **Two layers.** *Virtual reservation* while items sit in carts: `CartService.getVirtualAvailableStock()` = `product.stock_quantity − SUM(cart_items in OTHER carts)`; used by add-to-cart, update-item and `validateCart` (Phase 9). *Real decrement* at order creation: `createFromCart` decrements `stock_quantity` and sets `out_of_stock` at 0, then clears the cart. So the reservation moves from virtual to real at that moment.
- **Return-to-inventory today:** only `OrdersService.cancel()` (manual, pending orders only; increments stock and forces `stock_status: 'in_stock'`, even for backorder items).
- **No cart expiry.** `docs/IMPLEMENTATION_PLAN.md` lists "Cart expiration (30 days inactive)" as done, but no code deletes stale carts (only `clearCart`, guest-merge delete). Abandoned guest carts reserve virtual stock indefinitely.
- **Only cron job:** `paypal-reconcile` (02:00 America/Chicago). `ScheduleModule` is already registered in `PaymentsModule`.
- Service/digital products are exempt from stock logic.

### Stripe behavior (docs.stripe.com, checked 2026-10-04)

- Checkout Sessions default to 24h expiry; `expires_at` may be set between 30 min and 24 h.
- Stripe sends `checkout.session.expired` on expiry, and documents using it to return reserved inventory.
- `sessions.expire` expires an open session immediately.

---

## Fix Plan

**Decision (2026-10-04): option 3** — retry from the pending order plus automatic expiry. Stripe hold time: 30 minutes, no longer. Stale-cart cleanup included. Scope is the whole collection of checkout defects listed under Root Cause.

Common to 2 and 3:

```
backend/src/payments/payments.service.ts  — createPaymentIntent: allow pending order with an existing session; expire the old Stripe session, create new, overwrite payment_intent_id
backend/src/orders/orders.service.ts      — markAsPaid: guard against cancelled orders (refund/flag instead of flipping to processing)
frontend/.../checkout/CheckoutPageClient.tsx — accept ?order=<id>; load pending order; render payment step when cart is empty; never replace an active error with the empty-cart view
frontend/.../checkout/cancel/CancelClient.tsx — "Try Again" -> /checkout?order=<id>
```

Added by option 3:

```
backend/src/payments/providers/stripe.provider.ts — set expires_at (e.g. 30-60 min) on session create
backend/src/payments/payments.service.ts          — handlePaymentFailed: on checkout.session.expired, cancel the pending order and restore stock (idempotent)
backend/src/orders/orders.service.ts              — cancel(): expire the Stripe session; restore stock without forcing in_stock on backorder items
backend/src/payments/payments.service.ts (cron)   — stale pending-order sweep for PayPal/unpaid orders; check provider status before cancelling
(optional) backend/src/cart                       — stale-cart cleanup (30-day plan item) so abandoned carts stop reserving stock
```

### Key considerations
- No schema change required for 2; 3 may want an `expires_at` on orders (additive, nullable) but can derive from `created_at`.
- Never cancel an order whose Stripe session is `complete` or whose PayPal order is APPROVED/COMPLETED (webhook may be late) — query provider first.
- Stock restore must be idempotent (expired webhook + cron + manual cancel can all fire).
- PayPal has no equivalent of `checkout.session.expired`; it needs the cron sweep.
- Tests: retry on an order with a prior session; expired webhook restores stock once; markAsPaid on cancelled order; checkout page with empty cart + `?order`.

---

## Completion Report

> _Implemented 2026-10-04; awaiting deploy and live verification. Set to `fixed` after._

**Commit(s):** see git log (`fix(BUG-018)`)

### What changed
- **Retry (root causes 1-3):** `/checkout?order=<id>` and a remembered order id (sessionStorage) load the pending order and drive the page from it, so the cart being empty no longer hides the payment step or the error. Cancel page "Try Again" links to it. `createPaymentIntent` now accepts a pending order with an earlier session: it refuses only if that session was paid, creates the new session, stores its id, and only then expires the old one. A dead or expired order shows an explanatory notice instead of an empty cart. "Back to Shipping" is no longer offered after the order exists (it would have created a duplicate order).
- **Stock release (4-5):** Stripe sessions are created with `expires_at` = 30 min (+30 s margin for Stripe's 30-minute floor). `checkout.session.expired` cancels the order and restores stock, only when the expired session is the order's current one. A 15-minute sweep (`pending-order-sweep`) cancels pending orders idle > 45 min unless their session is paid; this also covers PayPal, which has no expiry event. All cancellation goes through `OrdersService.cancelPendingOrder()` (idempotent; only the caller that flips pending → cancelled restores stock).
- **Manual cancel:** `cancel()` now checks and closes the payment session first (refuses if paid) and no longer forces `stock_status: 'in_stock'`; stock is re-opened only if it was out_of_stock and has units again.
- **Oversell guard (6):** `markAsPaid` only applies to pending orders. A payment arriving for a cancelled order is not applied; it logs an error and writes an `order.payment_on_cancelled` audit event for a manual refund.
- **Stale carts:** nightly `stale-cart-purge` (03:00 America/Chicago) deletes carts with no cart or item activity for 30 days, releasing their virtual reservation (the "cart expiration" the implementation plan listed but never built).
- No schema change; backward compatible.

### Known limits
- A buyer who approves a PayPal order more than 45 min after checkout (never reaching our redirect) may find the order swept; the payment is then flagged for manual refund via the audit event. PayPal approved orders are skipped by the sweep.
- A payment landing between the old-session check and the old-session expiry during a retry could in theory leave two live sessions; the second expires after 30 min.
- Refund-path stock restoration was not reviewed here.
- Frontend resume flow has no component test (type-check and lint only); verify live.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-10-04 | open | Found during live Stripe test; research of stock/reservation system and Stripe expiry recorded |
| 2026-10-04 | in-dev | Option 3 chosen; implemented, awaiting deploy |
