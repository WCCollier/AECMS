# Phase 13 Completion Report: Full-System QA

**Project**: AECMS  
**Phase**: 13  
**Status**: ✅ COMPLETE (partial — see Deferred Items)  
**Primary commit**: `ec1af02`  
**Supporting commits**: `8103479`, `793a526`, `357792a`, `d3833f1`, `f6f3d76`  
**Date**: 2026-06-05 through 2026-06-16

---

## Summary

Phase 13 was a structured manual QA phase covering all features built since Phase 9's last verified QA pass. Unlike previous phases, it combined testing with development: every bug discovered during testing was fixed immediately, and several systemic issues identified during review (capability-hardcoding, widget rendering defects, TipTap editor state corruption) were refactored as part of the phase rather than deferred.

**Areas verified**: Admin CRUD (Articles, Products, Pages), Widget system (all 7 types), Stripe sandbox checkout, Audit log viewer  
**Areas with bugs fixed and re-verified**: Stripe webhook verification in Codespaces, PayPal capture idempotency, Order confirmation status messaging  
**Areas deferred to post-Phase 14**: PayPal sandbox end-to-end, Order management UI (status changes, refunds), Version history restore flow, PayPal reconciliation endpoint

---

## Areas Completed

### Area 3 — Admin CRUD: Articles ✅

All checklist items passed. TipTap editor re-opens saved content correctly after a prior bug (raw JSON display on re-edit) was fixed. Version History panel visible and populated after publish.

**Bug fixed**: TipTap editor rendered raw JSON on re-edit. Root cause: the editor was not detecting stored TipTap JSON vs. legacy HTML. Fixed by checking `content.type === 'doc'` before choosing the content format.

### Area 4 — Admin CRUD: Products ✅

All checklist items passed. SKU auto-generation, manual override, prefix-by-type, compare-at-price, image upload, and stock tracking all verified. Version history panel shows a version after each save.

**Archived product UX**: Added a "Discontinued" badge to archived products in the admin listing. Products with `status === 'archived'` also display the badge on the storefront to distinguish them from in-stock items.

**Trash UI**: Admin listing now shows a "Trash" toggle for users with `article.delete.any` or `article.delete.own` capability. In trash view, each row has a Restore button. Restoring creates a draft copy; the deleted record remains soft-deleted.

### Area 5 — Admin CRUD: Pages ✅

All checklist items passed. Four layout options render correctly. Zone editors populate per layout. Widget `show_when` conditional display verified for both guest and member. Version history records publish. Reserved slug conflict returns 409.

### Area 6 — Widget System ✅

All 7 widget types (MediaCarousel, Callout, VideoEmbed, XEmbed, ArticleEmbed, ProductEmbed, RichTextBox) verified in both large and small render modes. Key findings and fixes:

- **VideoEmbed / XEmbed editor leak**: Raw editor controls were bleeding through into display mode. Fixed by adding a `mode` prop and conditionally rendering editor UI only when `mode === 'edit'`.
- **XEmbed small mode**: Twitter `widgets.js` was loading even in small mode (sidebar context), causing layout jank. Fixed by gating the script injection on `size === 'large'`.
- **Article Large widget**: Added `max-height` cap and teal fade gradient to prevent oversized embeds from breaking page layout.
- **Article Small widget**: Removed placeholder thumbnail when article has no image — was showing a grey box.
- **Product Large widget**: Now uses `aspect-video` image ratio and shows first paragraph of description.
- **Widget title settings**: Added per-embed title controls: `titleOverride`, `titleCase`, `titleAlign`, `titleLevel`, `titleHidden`. These appear in the widget settings drawer.
- **Link underline**: Inline style override added to remove default link underline from widget card links.

### Area 7 — Stripe Sandbox Checkout ✅

Full Stripe checkout flow verified in Codespaces environment. Three bugs were discovered and fixed:

**Bug 1 — Webhook signature mismatch in Codespaces**: Stripe CLI forwarding signs events with a different secret than the production webhook. Fixed by running `stripe listen --forward-to ...` and updating `STRIPE_WEBHOOK_SECRET` with the printed `whsec_...` value on each Codespace restart. Setup procedure documented in `docs/STRIPE_CODESPACES_SETUP.md`.

**Bug 2 — PayPal return/cancel URLs**: Hardcoded `localhost` in PayPal redirect URLs failed in Codespaces (port-forwarded URLs differ). Fixed in `PayPalProvider` to use `NEXT_PUBLIC_APP_URL` env var.

**Bug 3 — PayPal capture idempotency**: Re-fetching `/checkout/success?order=...` re-triggered capture, which PayPal rejected with `INTERNAL_SERVICE_ERROR` if the order was already captured. Fixed by checking `order.payment_status === 'processing'` before calling capture.

**Bug 4 — Order confirmation status message**: Page showed "Payment processing" for already-captured orders. Fixed to show appropriate message per status.

Order status badges in the admin order list were also corrected — all 7 real `OrderStatus` enum values now have distinct badge colors, replacing the stale `paid` check.

### Area 10 — Audit Log Viewer ✅

All checklist items passed. Audit log loads for Owner session, event type and resource type filters work, row expansion shows before/after JSON diff, `auth.login_failed` events correctly have no `user_id`. Pagination confirmed working.

---

## Major Code Changes

### Backend: Capability-Based Access Control Refactor

The most significant code change in Phase 13 was replacing all role-hardcoded `isAdmin` checks with proper capability-based evaluation. This affected three modules: Articles, Products, and Pages.

**The problem**: Two patterns were broken simultaneously:
1. Public GET endpoints used `user.role === 'owner' || user.role === 'admin'` — violating the principle that the Owner browsing the customer-facing store should see only published content.
2. PATCH/DELETE endpoints derived `isAdmin` from `user.capabilities?.includes(...)`, but `capabilities` was never populated on `req.user` by the JWT strategy, so `isAdmin` was silently always `false`.

**The fix**: 
- GET endpoints now use `session_type === 'backstage'` to gate content visibility elevation. A backstage token is only issued after admin login + 2FA, making it a valid capability-respecting proxy.
- PATCH/DELETE endpoints now call `CapabilitiesService.userHasCapability(userId, capabilityName)` directly, returning a real DB-backed result.
- Added `.own` vs `.any` capability split: `article.edit.own` / `article.edit.any` (was `article.edit`), `product.edit.own` / `product.edit` (existing "any"), `product.delete.own` / `product.delete`.
- `checkEditAccess()` and `checkDeleteAccess()` service methods updated to accept two boolean parameters rather than a single `isAdmin` flag.

**New capabilities seeded**:
- `product.edit.own` — edit products you created
- `product.delete.own` — delete products you created
- `article.edit.own` and `article.delete.own` added to Admin role (existed as definitions, were not assigned)
- `article.delete.any` added to Admin role
- `page.create`, `page.edit`, `page.delete` added to Admin role

**Trash access gating**: `include_deleted=true` now resolves both `canDeleteAny` and `canDeleteOwn` at the controller level. If `canDeleteAny`, all deleted records are returned. If `canDeleteOwn` only, the service adds `author_id: userId` to the where clause. If neither, the flag is silently stripped.

**`auth/me` updated**: Returns `hasBackstageAccess` boolean. Admin layout nav is now filtered by this flag — users without backstage access cannot reach the admin panel even with a direct URL.

**Audit log access**: Previously role-gated (`owner` only). Now gated on `system.view_audit` capability, making it delegatable.

**Inactivity timer**: Backstage sessions now auto-logout after 30 minutes of inactivity. Timer resets on `mousemove`, `keydown`, `click`, `scroll`, and `touch` events.

### Backend: Cart 403 Fix

`cart.service.ts` `updateItem()` and `removeItem()` threw 403 when a logged-in user's cart had a stored `session_id` that didn't match the current session ID header. Fixed by checking `userId` ownership first and skipping the `sessionId` check entirely for authenticated users.

### Frontend: TipTap Improvements

- **Text alignment**: Added left/center/right alignment controls to the TipTap toolbar.
- **`extractAllText` / `stripHtml` utilities**: Added to `frontend/lib/` for HTML legacy content fallback when TipTap JSON is not available.

---

## Bugs Fixed During Phase 13

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| TipTap editor shows raw JSON on re-edit | Editor not detecting stored format | Check `content.type === 'doc'` |
| Stripe webhook fails in Codespaces | CLI forwarding uses different secret | Restart `stripe listen` and update `STRIPE_WEBHOOK_SECRET` on each restart |
| PayPal return URLs hardcoded to localhost | Missing env var in provider | Use `NEXT_PUBLIC_APP_URL` in redirect URLs |
| PayPal capture throws on repeat request | No idempotency check before capture | Check `order.payment_status` before calling capture |
| Order confirmation shows "Payment processing" for captured orders | Status message not checking actual order status | Message derived from live `order.status` |
| `isAdmin` silently `false` on all PATCH/DELETE | JWT strategy doesn't populate `capabilities` | Use `CapabilitiesService.userHasCapability()` directly |
| Owner sees drafts on customer-facing shop | Role check instead of session type check | `isBackstage = session_type === 'backstage'` |
| Cart 403 on remove/decrement for logged-in users | Session ID mismatch when userId present | Skip session ID check when user is authenticated |
| VideoEmbed/XEmbed editor UI visible in display mode | Missing mode guard | Add `mode` prop, gate editor UI on `mode === 'edit'` |
| Twitter `widgets.js` loads in small widget mode | No size gate on script injection | Gate on `size === 'large'` |

---

## Deferred Items

The following Phase 13 areas were not completed due to time constraints and were folded into Phase 14/QA fixes:

| Area | Status | Notes |
|------|--------|-------|
| Area 8 — PayPal sandbox end-to-end | Deferred | PayPal redirect/capture backend was fixed; full browser flow not manually verified |
| Area 9 — Order management UI (status change, refund) | Deferred | Admin order detail was rebuilt in Phase 14; status transitions verified via API only |
| Area 11 — Version history restore flow | Deferred | Version panels visible and populated; restore path not manually verified |
| Area 12 — PayPal reconciliation endpoint | Deferred | Endpoint exists; manual trigger not tested |

---

## Test Status at Phase Completion

- **Backend unit tests**: 176 passing (0 failing)
- **Frontend unit tests**: 125 passing (0 failing)
- **E2E tests**: 16 (require Docker; not run in Codespaces)
- **Manual QA areas passed**: 5 of 12 (Areas 3, 4, 5, 6, 7, 10)

---

## Files Changed (Key)

| File | Change |
|------|--------|
| `backend/src/articles/articles.controller.ts` | Capability-based access, trash query params |
| `backend/src/articles/articles.service.ts` | `.own`/`.any` split on edit/delete/restore |
| `backend/src/products/products.controller.ts` | Capability-based access |
| `backend/src/products/products.service.ts` | `.own`/`.any` split |
| `backend/src/pages/pages.controller.ts` | `isBackstage` for GET; capability guards on write |
| `backend/src/audit/audit.controller.ts` | `system.view_audit` capability gate |
| `backend/src/auth/auth.service.ts` | `hasBackstageAccess` on `/me` response |
| `backend/prisma/seed.ts` | New capabilities + Admin role assignments |
| `frontend/app/admin/articles/AdminArticlesClient.tsx` | Trash toggle, restore, author name chain |
| `frontend/app/admin/products/AdminProductsClient.tsx` | Discontinued badge, trash toggle, restore |
| `frontend/components/widgets/*` | Mode guards, size gates, title settings, rendering fixes |
| `docs/STRIPE_CODESPACES_SETUP.md` | Stripe webhook setup procedure for Codespaces |
