# Phase 13: Full-System QA

**Project**: AECMS  
**Phase**: 13  
**Status**: 🔄 IN PROGRESS  
**Prerequisite**: Phase 12 complete, Stripe/PayPal sandbox configured

---

## Scope

Phase 13 is a manual testing phase, not a development phase. It covers all features built since Phase 9's structured QA was last updated, plus the outstanding Phase 9 items (admin CRUD, orders) that were superseded by development work. No significant coding is expected; bugs discovered should be filed and tracked in the testing sequence.

**Features under test:**

| Feature | Phase Built | Phase 9 status |
|---------|-------------|----------------|
| Admin CRUD — Articles | Phase 3/9 | Untested (Step 9) |
| Admin CRUD — Products | Phase 4/9 | Untested (Step 10) |
| Admin CRUD — Pages | Phase 11 | New |
| Admin CRUD — Orders | Phase 4/9 | Untested (Step 11) |
| Stripe live sandbox checkout | Phase 5/9 | Partially tested (stub only) |
| PayPal live sandbox checkout | Phase 5 | Untested |
| PayPal zombie-order reconciliation | Phase 13 | New |
| Widget system (all 5 types) | Phase 10A/10B | Untested |
| Page builder (all 4 layouts) | Phase 11 | New |
| Public slug routing | Phase 11 | New |
| Audit log viewer | Phase 12 | New |
| Version history — articles | Phase 12 | New |
| Version history — products | Phase 12 | New |
| Version history — pages | Phase 12 | New |
| Order status history timeline | Phase 12 | New |
| Seeded order history | Phase 13 | New |

---

## Testing Sequence

Work through each area in order. Each step's prerequisites are stated. An `[ ]` item that fails should be noted with a short description of the failure before moving on.

---

### Area 1 — Stripe Live Sandbox Setup

**Prerequisite**: `stripe` CLI must be authenticated. Run `! stripe whoami` — if it returns an email, you're logged in. Otherwise `! stripe login`.

**Setup steps (do once per Codespace restart):**

1. Set `PAYMENT_TEST_MODE=false` in `backend/.env`
2. Run `stripe listen --forward-to localhost:4000/payments/webhooks/stripe` in a separate terminal
3. Copy the `whsec_...` printed on the first line into `STRIPE_WEBHOOK_SECRET` in `backend/.env`
4. Restart the backend: `! pkill -f "nest start" && sleep 2 && cd /workspaces/AECMS/backend && npm run start:dev &`
5. Confirm: `! curl -s http://localhost:4000/payments/providers` should return `{"providers":["stripe","paypal"]}`

**Test cards (use on Stripe's hosted checkout page):**

| Scenario | Card number | Extra |
|----------|-------------|-------|
| Success | `4242 4242 4242 4242` | Any future expiry, any CVC |
| Decline | `4000 0000 0000 0002` | — |
| Insufficient funds | `4000 0000 0000 9995` | — |
| 3D Secure required | `4000 0025 0000 3155` | Approve the challenge |

**Checklist**
- [ ] `stripe listen` prints a `whsec_...` value and shows "Ready!"
- [ ] `PAYMENT_TEST_MODE=false` + STRIPE_WEBHOOK_SECRET set; backend restarts cleanly
- [ ] `/payments/providers` returns `["stripe","paypal"]`

---

### Area 2 — PayPal Live Sandbox Setup

**Prerequisite**: PayPal sandbox credentials must be in `backend/.env` (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET). These were configured in Phase 5 via Codespaces Secrets.

**Setup steps (one-time):**

1. Log into [developer.paypal.com](https://developer.paypal.com) with your PayPal account
2. Go to **Testing Tools → Sandbox Accounts**
3. Note the email/password of the **Personal** (buyer) sandbox account
4. Confirm `PAYMENT_TEST_MODE=false` is set (same as Stripe setup above)
5. Verify: `! curl -s http://localhost:4000/payments/providers` returns both providers

**PayPal test flow summary:**
- Choose PayPal at checkout → redirected to `sandbox.paypal.com`
- Log in with the sandbox buyer account
- Approve the payment → redirected back to `/checkout/success?order=...`
- Frontend calls `/payments/capture-paypal` automatically
- Order should transition to `processing`

**Checklist**
- [ ] Sandbox buyer account credentials confirmed
- [ ] PayPal provider returns as available
- [ ] No "PayPal is not configured" error in backend logs

---

### Area 3 — Admin CRUD: Articles *(Phase 9 Step 9)* ✅

**Prerequisite**: Backstage session active (logged in at `/admin/login`).

1. Navigate to `/admin/articles` → click **New Article**
2. Enter a title — verify slug auto-populates
3. Write a few paragraphs in the TipTap editor
4. Add an image via the media insert toolbar button
5. Set status to **Published**, click Save
6. Open the newly created article at its public URL (`/latest` → click it)
7. Back in admin, click Edit — verify content re-opens correctly
8. Change the title, save — verify slug was not auto-changed
9. Change status to Draft, save — verify article disappears from public listing
10. Delete the article — verify it no longer appears in the admin list

**Checklist**
- [x] Create article form submits
- [x] Slug auto-populates from title on new article
- [x] TipTap editor saves and re-loads content correctly (no blank editor on edit)
- [x] Image can be inserted into article body
- [x] Published article appears on `/latest`
- [x] Draft article does not appear on `/latest`
- [x] Delete removes article from list
- [x] Version History panel is visible in the edit form and loads versions after publish

---

### Area 4 — Admin CRUD: Products *(Phase 9 Step 10)* ✅

1. Navigate to `/admin/products` → click **New Product**
2. Set type to **Physical**, begin typing name "Test Rifle Case"
3. Verify the SKU field auto-populates as you type: should become `P-TEST-RIFL-CASE` and show "(auto-generated)" label
4. Change product type to **Service** — verify SKU prefix updates to `S-`
5. Manually edit the SKU to "MY-CUSTOM-SKU" — verify the "(auto-generated)" label disappears and the field stays fixed even if you change the name
6. Enter price $9.99, stock 3
7. Upload a product image
8. Set status to **Published**, save
9. Open `/shop` — verify product appears with the custom SKU stored correctly
10. Add the product to cart, proceed to checkout (stop at payment page)
11. Back in admin, edit the product: change price to $12.99, save
12. Verify price updated on `/shop` product detail
13. Check Version History panel — verify a version was created
14. Open a **second new product** form, leave SKU untouched — verify auto-generated value differs from the first product's auto SKU
15. Delete the test product — verify it disappears from shop

**Checklist**
- [x] SKU auto-populates from slug as name is typed
- [x] SKU prefix changes with product type (P/D/S)
- [x] "(auto-generated)" label visible while auto; disappears on manual edit
- [x] Manual SKU override persists; auto-generation does not resume
- [x] Existing product edit shows stored SKU with no auto-generation
- [x] Auto-SKU format matches PRD scheme: `TYPE-WORD-WORD-WORD`
- [x] Product create with all required fields
- [x] Image upload and display in shop
- [x] Stock quantity shown and tracked
- [x] Compare-at price displays strikethrough on shop page
- [x] Edit saves correctly; price update reflected on storefront
- [x] Version history panel shows version after save
- [x] Delete soft-deletes (product disappears from shop)

---

### Area 5 — Admin CRUD: Pages *(Phase 11 — new)* ✅

1. Navigate to `/admin/pages` → click **New Page**
2. Select layout **Sidebar Right**, enter title "Test Page", slug "test-page"
3. In the Main zone editor, type a paragraph and insert a Callout widget
4. In the Sidebar zone, insert a MediaGallery widget
5. Set status to **Published**, save
6. Navigate to `/test-page` in the customer-facing experience — verify page renders with correct layout
7. Back in admin, edit the page: toggle "Preview small widgets" — verify sidebar widgets render in small mode
8. Change the Callout widget's `show_when` to **Members only** — save
9. View `/test-page` while logged out — Callout should be hidden; while logged in as member — should appear
10. Check Version History panel
11. Restore a previous version — verify it creates a draft

**Checklist**
- [x] Four layout options appear in the layout picker
- [x] Zone editors render for the chosen layout (main + sidebar for sidebar-right)
- [x] Widgets insert and save correctly
- [x] `show_when` conditional display works (guest vs. member)
- [x] "Preview small widgets" toggle changes widget rendering in editor
- [x] Published page is reachable at its slug
- [x] Page doesn't appear at reserved slug (try creating with slug "shop" — should 409)
- [x] Version history records publish; restore creates new draft

---

### Area 6 — Widget System *(Phase 10A/10B — new)* ✅

Test each widget type in the TipTap editor (use an article or page in admin).

**MediaCarousel**
- [x] Insert MediaCarousel, add 3 images from media library
- [x] Carousel renders with arrows and dots in large mode
- [x] In a sidebar zone (small mode), carousel auto-rotates with no controls

**Callout**
- [x] Insert Callout, write 2 sentences
- [x] In large mode: full callout box with icon
- [x] In small mode: single-line pill with truncated text
- [x] `show_when` badge and buttons appear on hover in editor

**VideoEmbed**
- [x] Insert VideoEmbed, paste a YouTube URL
- [x] Video embeds and plays in large mode
- [x] In small mode: thumbnail with play button overlay, links to YouTube in new tab

**XEmbed (Twitter/X)**
- [x] Insert XEmbed, paste a tweet URL
- [x] Tweet renders in large mode (Twitter widget loads)
- [x] In small mode: oEmbed card with author, truncated text, "View on X" link
- [x] No Twitter `widgets.js` loads in small mode

**ArticleEmbed**
- [x] Insert ArticleEmbed, search and select an article
- [x] Large card shows image, title, date, excerpt (no nested widgets in excerpt)
- [x] Small card shows thumbnail, title, excerpt

**ProductEmbed**
- [x] Insert ProductEmbed, search and select a product
- [x] Large card shows image, price, stock status, Add to Cart button
- [x] Add to Cart from embed works (item appears in cart)
- [x] Small card shows thumbnail, price, mini Add to Cart

**RichTextBox**
- [x] Insert RichTextBox, type content and add a heading
- [x] In small mode: same content + character-count warning if >300 chars

---

### Area 7 — Full Stripe Sandbox Checkout

**Prerequisite**: Area 1 setup complete, `stripe listen` running.

1. Log in as member, add the American Shooter Hat (physical, $24.99) to cart
2. Go to `/cart` → Proceed to Checkout
3. Fill in shipping address
4. Select Stripe, click Pay → should redirect to Stripe's hosted checkout page
5. Enter test card `4242 4242 4242 4242`, expiry `12/30`, CVC `123`
6. Complete payment → redirected to `/order-confirmation?order=...`
7. In the `stripe listen` terminal, verify a `checkout.session.completed` event fired
8. Check order in admin at `/admin/orders` — status should be `processing`
9. In `/admin/orders/<id>`, verify status history timeline shows `pending → processing`
10. Check `/admin/audit-log` — verify `order.status_changed` event is present

**Decline path:**
- Add an item, proceed to checkout, use card `4000 0000 0000 0002`
- Verify Stripe shows a decline on their hosted page
- Order should remain `pending` in admin

**Checklist**
- [ ] Redirect to Stripe hosted checkout page works
- [ ] Success card completes and redirects to order confirmation
- [ ] Order confirmation shows correct items, total, order number
- [ ] Webhook fires and order transitions to `processing`
- [ ] Status history timeline shows the transition
- [ ] Audit log has `order.status_changed` entry
- [ ] `webhook_events` table has a row (verify via: `! cd backend && npx prisma studio` or psql)
- [ ] Decline path leaves order in `pending`

---

### Area 8 — PayPal Sandbox Checkout

**Prerequisite**: Area 2 setup complete. PayPal sandbox buyer account credentials in hand.

1. Log in as member, add a service product (no shipping) to cart
2. Proceed to Checkout, select PayPal
3. Should redirect to `sandbox.paypal.com`
4. Log in with sandbox buyer account and approve
5. Redirected back to `/checkout/success?order=...`
6. Frontend automatically calls capture — verify order transitions to `processing`
7. Check admin order detail page for status history

**Checklist**
- [ ] Redirect to PayPal sandbox works
- [ ] Approve on PayPal sandbox page
- [ ] Redirect back to checkout success
- [ ] Order transitions to `processing` after capture
- [ ] Status timeline shows the transition in order detail

---

### Area 9 — Order Management *(Phase 9 Step 11 + seeded orders)*

The database has 12 seeded orders across various statuses. Use these for admin management testing.

1. Navigate to `/admin/orders`
2. Verify all 12 seeded orders appear with correct status badges and totals
3. Click a **processing** order to open the detail page
4. Update status to **completed** via the status dropdown (if it exists) or via API
5. Verify status history timeline updates
6. Find a **pending** order, update to **cancelled** — verify it cannot be paid after
7. Test refund: find a **processing** or **completed** order, issue a full refund
8. Verify order status changes to `refunded` and audit log records `order.refund_initiated`
9. Test order search by order number and by customer email

**Status update via API (if UI doesn't have a dropdown yet):**
```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@aecms.local","password":"Admin123!@#"}' | jq -r '.accessToken')
# Then use 2FA token at /auth/admin/verify-2fa

curl -X PATCH http://localhost:4000/orders/<ORDER_ID>/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

**Checklist**
- [ ] Order list loads with all 12 seeded orders
- [ ] Status badges display correctly
- [ ] Order detail page shows status history timeline
- [ ] Status update works (pending → processing → completed path)
- [ ] Refund endpoint works; order status → `refunded`
- [ ] Audit log records status changes and refund
- [ ] Guest orders are visible and distinguishable

---

### Area 10 — Audit Log Viewer *(Phase 12 — new)* ✅

1. Navigate to `/admin/audit-log` (visible only with Owner session)
2. Verify the events from your testing above appear (logins, order changes, article edits)
3. Test filter by event type: select `auth.login` — verify only login events show
4. Test filter by resource type: select `order` — verify only order events show
5. Expand a row with `changes` (e.g. an `order.status_changed` event) — verify before/after JSON is shown
6. Expand an `auth.login_failed` event — verify `metadata.reason` is shown, `user_id` is null

**Checklist**
- [x] Audit log page loads for Owner session
- [x] Events from testing appear (login, CRUD, order status changes)
- [x] Event type filter works
- [x] Resource type filter works
- [x] Row expand shows changes and metadata JSON
- [x] `auth.login_failed` events have no user_id
- [x] Pagination works if >30 events

---

### Area 11 — Version History *(Phase 12 — new)*

**Articles:**
1. Edit an article, make a change, save as Published
2. In the Version History panel (bottom of edit page), expand it
3. Verify a version appears with version number, title, date
4. Click Restore on the oldest version → confirm dialog → Restore
5. Verify article content reverts to that version, status is now Draft

**Products:**
1. Edit the American Shooter Hat, change price to $27.99, save
2. Edit again, change price back to $24.99, save
3. Open Version History panel — should show 2 versions
4. Restore version 1 — verify price reverts to $27.99 (the first save)

**Pages:**
1. Edit the test page created in Area 5
2. Make a layout change or add a widget, save
3. Open Version History — verify version recorded
4. Restore a previous version → verify page content reverts

**Checklist**
- [ ] Article version created on publish/update-published
- [ ] Version list shows in panel (lazy-loaded on expand)
- [ ] Restore confirmation dialog appears
- [ ] Restore creates a new draft with old content
- [ ] Product version created on every save
- [ ] Page version created on publish/update-published
- [ ] Restored page has correct layout and zone content

---

### Area 12 — PayPal Reconciliation *(Phase 13 — new)*

This tests the zombie-order recovery mechanism.

1. Set `PAYMENT_TEST_MODE=false`, verify PayPal is available
2. Manually trigger reconciliation: `! curl -s -X POST http://localhost:4000/payments/paypal/reconcile -H "Authorization: Bearer $ADMIN_TOKEN"`
3. Expected response: `{"checked":N,"recovered":0,"errors":0}` (0 recovered since no real zombies exist in test data)
4. Verify the endpoint requires a backstage session (try without auth — should 401)
5. Check backend logs for `[paypal-reconcile]` lines

**Checklist**
- [ ] Manual reconcile endpoint responds without error
- [ ] Returns `checked`, `recovered`, `errors` counts
- [ ] Requires backstage auth (401 without token)
- [ ] Skips silently if `PAYMENT_TEST_MODE=true`

---

## Known Limitations Going Into Phase 13

| Item | Status | Notes |
|------|--------|-------|
| Stripe Elements card UI | Deferred | Checkout uses Stripe-hosted page (Checkout Sessions), which is actually better |
| PayPal webhook verification | Partial | Logs warning; capture-on-return works fine |
| Cross-zone widget drag in page builder | Deferred | Cut/paste works; drag is a Phase N enhancement |
| Admin order status dropdown | Not built | Use API or wait for Phase 14 polish |
| Email delivery in dev | Console only | Email content logged to backend console, not sent |

---

## Regression Checklist

After each area, spot-check that features from earlier phases haven't broken:

- [ ] Anonymous browsing still works (no 500s on `/latest`, `/shop`)
- [ ] Cart persists across navigation
- [ ] Member login / logout cycle works cleanly
- [ ] Backend unit tests still pass: `! cd /workspaces/AECMS/backend && npm run test`
- [ ] Frontend unit tests still pass: `! cd /workspaces/AECMS/frontend && npm run test`
