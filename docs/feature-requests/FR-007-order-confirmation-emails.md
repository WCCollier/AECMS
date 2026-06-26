# FR-007: Order Confirmation Emails

**Status:** `deployed`
**Requested:** 2026-06-26
**Deployed:** —
**Size:** `small` (a few hours — email template, hooks into two payment paths, one test endpoint)

---

## Synopsis

Sends a transactional order confirmation email to the customer immediately after a successful payment. Currently, customers complete a Stripe or PayPal checkout and receive complete silence — no receipt, no summary, no download reminder. For digital products the separate per-file delivery email exists, but there is no order-level summary. This is the single biggest UX gap in the commerce flow: customers will think their purchase failed.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Identified as a launch blocker during pre-marketing gap audit |
| 2026-06-26 | deployed | Implemented in same session as FR-006 |

---

## Discussion

### Request context

The email provider is already wired up and functional (email verification, Kindle delivery, registration approval notifications). No order-level email is sent at any point in the checkout flow. A customer buys a digital book, gets a download link per-file but no order summary. A customer buys a physical product and receives nothing.

### Decisions

- **Trigger point**: The email is sent when the order reaches `paid` status — specifically from two places:
  1. `StripeProvider` inside the `checkout.session.completed` webhook handler, after order is marked `paid`.
  2. `PayPalProvider` inside the `captureOrder()` method, after the PayPal order is captured and the AECMS order is marked `paid`.
  
  Not in `OrdersService.createFromCart()` — the order is `pending` at creation and should not trigger an email yet.

- **EmailModule injection**: `PaymentsModule` currently imports no email infrastructure. Will add `EmailModule` to `PaymentsModule` imports so both providers can inject `EmailProvider`.

- **Template approach**: inline HTML string function — consistent with how the verification and Kindle emails are done. No third-party template engine.

- **Content by order type**:
  - **All orders**: order number, date, items table (name, qty, price), total.
  - **Digital orders**: note that download link(s) have been / will be emailed separately.
  - **Physical orders**: shipping address block. No tracking number at this stage (tracking is a future enhancement).
  - **Service orders**: order summary with confirmation that the seller will be in contact.

- **Guest orders**: email is sent to `order.email`. No account required.

- **Failed email**: log the error but do not fail the webhook/capture response. A failed email must never block order completion.

- **No admin CC**: the owner can monitor orders in the backstage. No CC to the owner on every purchase (would become noise).

### Out of scope

- Order status change emails (shipped, delivered)
- Tracking number insertion
- PDF receipt attachment
- Resend confirmation endpoint for the admin panel (can be FR-008)

---

## Design & Implementation Guide

### Backend changes

```
backend/src/payments/payments.module.ts             — add EmailModule to imports
backend/src/payments/stripe.provider.ts             — inject EmailProvider; call sendOrderConfirmation() in webhook handler
backend/src/payments/paypal.provider.ts             — inject EmailProvider; call sendOrderConfirmation() in captureOrder()
backend/src/payments/order-email.service.ts         — new: OrderEmailService with sendOrderConfirmation()
```

#### `OrderEmailService.sendOrderConfirmation(order)` logic

Takes the full `order` object (with `orderItems` + their product names). Builds an HTML email:

```
Subject: Order confirmed — #{order.order_number}

Hi {customer name or "there"},

Thank you for your order! Here's a summary:

Order #: {order_number}
Date: {formatted date}

Items:
  - {item.title}  ×{qty}  ${price}
  ...
Total: ${order.total}

[If digital]: Your download link(s) will arrive in a separate email shortly.
[If physical]: We'll ship to: {shipping_name}, {address block}
[If service]: We'll be in touch shortly to arrange your {service name}.

Questions? Reply to this email or contact us at {contact_email}.

{site_name}
{site_url}
```

The service reads `general.site_title`, `email.from_address`, and `APP_URL` from the settings / env at send time using the existing `SettingsService.getEffective()` pattern or env var directly.

#### Stripe hook location

In `stripe.provider.ts`, the webhook handler currently:
1. Verifies signature
2. Finds the order
3. Marks it `paid`
4. Calls `digitalProductsService.handleOrderPaid()`

Add **step 5**: `await this.orderEmailService.sendOrderConfirmation(order)` — wrapped in try/catch so email failure never throws in the webhook response.

#### PayPal hook location

In `paypal.provider.ts`, `captureOrder()` currently:
1. Calls PayPal capture API
2. Finds the AECMS order by PayPal order ID
3. Marks it `paid`
4. Calls `digitalProductsService.handleOrderPaid()`

Same pattern: add email send after step 4, wrapped in try/catch.

### Frontend changes

None required. The order confirmation page (`/order-confirmation?order=:id`) already exists and is the redirect target. The email is purely a backend concern.

---

## Completion Report

**Implemented:** 2026-06-26
**Commit(s):** feat: FR-007 Order Confirmation Emails

**Files changed:**
- `backend/src/payments/order-email.service.ts` — new `OrderEmailService.sendOrderConfirmation(orderId)`; fetches order + items with product type join; reads `general.site_title` and `email.from_address` from `SettingsService`; adapts content by product type (digital/physical/service)
- `backend/src/payments/payments.module.ts` — added `OrderEmailService` to providers
- `backend/src/payments/payments.service.ts` — injected `OrderEmailService`; fire-and-forget `.catch()` calls after `markAsPaid` in both `handlePaymentSucceeded()` (Stripe webhook) and `capturePayPalPayment()` (PayPal return)

**Architecture note:** `EmailModule` is `@Global()`, so `EMAIL_PROVIDER` is available to `OrderEmailService` without re-importing the module. `EmailProvider` is imported as `import type` to satisfy `isolatedModules` + `emitDecoratorMetadata`.

---

## Testing Guide

### Prerequisites

- SMTP configured and tested in Settings → Email / SMTP.
- At least one product in the shop.
- Stripe or PayPal sandbox keys active (or use Stripe test mode with a webhook listener).

### Test scenarios

**A. Digital product — Stripe**
1. Add a digital product to cart. Go to checkout → Stripe.
2. Complete payment with Stripe test card `4242 4242 4242 4242`.
3. Expected: order confirmation email arrives at the customer email address. Body shows order number, item name, price, and "download link(s) will arrive separately."

**B. Physical product — Stripe**
1. Add a physical product to cart. Complete checkout with a shipping address.
2. Expected: email shows order number, item, total, and the shipping address.

**C. PayPal checkout**
1. Add any product. Go to checkout → PayPal. Complete in PayPal sandbox.
2. On return to `/checkout/success`, the PayPal capture fires.
3. Expected: order confirmation email arrives.

**D. Guest checkout**
1. Complete a checkout without logging in (guest email address).
2. Expected: confirmation sent to the guest email.

**E. Email failure does not break the order**
1. Temporarily misconfigure SMTP (wrong port).
2. Complete a checkout.
3. Expected: order completes normally (paid status, redirect to confirmation page). Email failure is logged but not surfaced to the customer.

### Acceptance criteria

- [x] Customer receives order confirmation email after Stripe checkout completes.
- [x] Customer receives order confirmation email after PayPal capture completes.
- [x] Email contains order number, item list, and total.
- [x] Physical orders include shipping address.
- [x] Digital orders include a note about download links arriving separately.
- [x] Guest orders are emailed to the address provided at checkout.
- [x] SMTP failure does not affect order status or user experience.
