# BUG-019: All-digital orders stay "Processing" after payment

**Status:** `in-dev`
**Reported:** 2026-10-05
**Severity:** `low`
**Area:** orders, payments

---

## Description

After a successful payment, an order containing only digital products shows status "Processing" indefinitely, even though the downloads are available immediately. Nothing advances it; only a manual admin status change reaches "Completed". Observed on the first live purchase (ORD-MUUK2WQP-THIU).

---

## Root Cause

`OrdersService.markAsPaid()` and `PaymentsService.completeFreeOrder()` always set `status: 'processing'` regardless of order contents. `processing` means "paid, awaiting fulfilment", which is wrong for orders with nothing to fulfil.

---

## Fix Plan

Rule (owner-confirmed 2026-10-05): an order whose items are all digital is `completed` on payment; any order containing a physical or service item stays `processing`. Kindle delivery is customer-initiated and is not fulfilment.

```
backend/src/orders/orders.service.ts   — paidStatusFor(items); markAsPaid uses it (and audits the real status)
backend/src/payments/payments.service.ts — completeFreeOrder uses it; PayPal capture idempotency accepts completed; reconcile audit logs real status
```

`completed → refunded` remains a valid transition, so digital orders stay refundable. Existing digital orders already in `processing` are not migrated (change by hand in admin if desired).

---

## Completion Report

> _Implemented 2026-10-05; awaiting deploy._

Tests: `paidStatusFor` and `markAsPaid` cases added to `orders.checkout-lifecycle.spec.ts`.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-10-05 | in-dev | Reported from live testing; rule confirmed by owner; implemented |
