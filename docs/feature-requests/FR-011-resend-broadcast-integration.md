# FR-011: Resend Broadcast Integration

**Status:** `accepted`
**Requested:** 2026-06-27
**Deployed:** —
**Size:** `medium`

---

## Synopsis

AECMS currently sends all subscriber notification emails (new article, new product, admin broadcast) via a per-subscriber SMTP loop. This approach works at small scale but counts each send against Resend's 100/day transactional cap if Resend is the configured SMTP relay — a ceiling that becomes a reliability problem as subscriber lists grow. Resend's Broadcast API solves this: it accepts a single API call per broadcast, sends to a managed contact list at the marketing-email quota (unlimited sends, 1,000 contacts free), and handles RFC-8058 `List-Unsubscribe` headers and per-topic opt-out mechanics automatically. This FR adds a Broadcast section to the Email Settings panel and wires the three subscriber notification types to the Broadcast API when Resend is configured. The five transactional email types (verification, password reset, order confirmation, digital delivery, test) continue to use the existing SMTP path unchanged.

The SMTP fallback is not a degraded mode — it is the correct behavior for owners with small lists. An owner using Resend as an SMTP relay with a handful of subscribers does not need to configure Resend Broadcast at all; the transactional cap is not a practical concern at that scale. When their list becomes real, they configure the Broadcast section, run the backfill script once, and the system upgrades itself with no redeploy.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Designed during email architecture session; follows FR-009 syndication work |
| 2026-07-04 | accepted | Pre-build design review: audience ID gap found and corrected; AECMS token unsubscribe semantic corrected; sync architecture documented; backfill script promoted to permanent operator tool |

---

## Discussion

### Email type classification

**Transactional (Send API / SMTP — existing, unchanged):**

| Email | Rationale |
|-------|-----------|
| Account verification | Response to recipient's own registration; cannot opt out |
| Password reset | Response to recipient's own request; cannot opt out |
| Order confirmation | Triggered by recipient's own purchase; legally expected |
| Digital/Kindle delivery | Triggered by recipient's own purchase; file delivery |
| Test email (admin) | Point-to-point diagnostic; not a subscriber email |

**Broadcast API (new path, Resend only):**

| Email | Rationale |
|-------|-----------|
| New article notification | Publisher action → N subscribers; opt-in list; unsubscribable |
| New product notification | Publisher action → N subscribers; opt-in list; unsubscribable |
| Admin broadcast/newsletter | Explicitly a list send; always was a broadcast in concept |

### Why Resend Topics (not Segments)

Topics are the right primitive because AECMS's three subscription categories are independent — a user can subscribe to articles but not products. Marking a contact globally `unsubscribed: true` would break all three categories at once; Topics scope the unsubscribe to the correct category only. The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder, when a `topic_id` is attached to a broadcast, generates a per-topic unsubscribe link rather than a global one.

### Sync architecture

AECMS is the system of record for subscription state. Resend is a downstream mirror. Every write to AECMS subscription state pushes a corresponding delta to Resend. The only exception is the inbound webhook, where Resend notifies AECMS of an external change, and AECMS writes it back to stay consistent.

```
AECMS DB  ←→  ResendBroadcastService  ←→  Resend Audience + Topics
              (push on every write)         (push back via webhook)
```

**Sync trigger 1 — Initial backfill (one-time operator action)**

The owner runs `backend/scripts/resend-backfill.ts` after configuring Resend credentials in the admin settings panel. The script queries all non-deleted users with at least one `subscribe_*: true`, upserts each as a Resend contact in the configured audience, and subscribes them to the matching topics. The script is idempotent — safe to re-run at any time as a recovery action (e.g. after accidental audience deletion). It lives permanently in the codebase as an operator tool, not a one-time throwaway.

**Sync trigger 2 — New user registration**

When a user registers, `auth.service.ts` already reads ISM subscription defaults and sets the three `subscribe_*` flags at DB row creation time. FR-011 adds a fire-and-forget call immediately after `prisma.user.create()`:

```
prisma.user.create(...)          ← sets subscribe_* flags from ISM defaults
resendBroadcastService.upsertContact(email, firstName, lastName)
for each flag that is true:
  resendBroadcastService.subscribeToTopic(email, topicId)
```

Only fires when `broadcast_provider === 'resend'`. `ResendBroadcastService` is registered in `EmailModule` (which is `@Global()`) and injected into `AuthService` with no new module imports required.

**Sync trigger 3 — User changes preferences (`/account` → Notifications tab)**

`SubscriptionsService.updatePreferences()` writes new flags to the DB. FR-011 adds a sync call after the DB write. Because `updatePreferences()` currently receives only `userId`, the sync branch fetches the user's email from the DB before calling Resend:

```
DB updated with new flags
if broadcast_provider === 'resend':
  fetch user email from DB
  for each category in dto:
    if newly true  → subscribeToTopic(email, topicId)
    if newly false → unsubscribeFromTopic(email, topicId)
```

Only categories present in the DTO are touched. Other topic subscriptions are unaffected.

**Sync trigger 4 — Resend-side unsubscribe (inbound webhook)**

When a user clicks the Resend-managed unsubscribe link in a broadcast email, Resend records the opt-out and fires a webhook to `POST /email/webhooks/resend`. The handler:

1. Verifies the HMAC signature using `email.broadcast_resend_webhook_secret_enc` — returns 401 immediately if invalid
2. Extracts email and `topic_id` from the payload (`contact.unsubscribed` event)
3. Reverse-looks up `topic_id` against the three ISM topic ID keys to determine the affected category
4. Sets the corresponding `subscribe_*` field to `false` in the DB
5. Returns 200

The result: the user's `/account` Notifications tab reflects the opt-out on their next visit.

**Sync trigger 5 — AECMS-native token unsubscribe (edge case)**

`GET /subscriptions/unsubscribe?token=...&category=articles` is the old SMTP-path unsubscribe link. In Resend broadcast mode, broadcast emails carry `{{{RESEND_UNSUBSCRIBE_URL}}}` so this endpoint is never called from those emails. It can only be triggered by someone clicking an old SMTP-era link from their inbox after the owner switched to Resend.

When this happens with `broadcast_provider === 'resend'`, the handler syncs the single affected category to its corresponding Resend topic subscription (same delta-sync as trigger 3). It does **not** mark the contact globally unsubscribed — a per-category AECMS token unsubscribe is not a global opt-out. Global `unsubscribed: true` in Resend is reserved for future account deletion flows only.

### Fallback behavior

If `email.broadcast_provider` is unset, the system falls back to the existing SMTP loop for all three broadcast types — exactly as it works today. No regression for deployments not using Resend. The SMTP path remains fully functional as the intended default for small lists.

The UI should communicate this clearly in the "None" state: *"Broadcast emails (article notifications, product notifications, newsletters) will be sent individually via your SMTP settings above. For large subscriber lists, consider connecting a dedicated broadcast provider."*

### Clearing broadcast settings / reverting to SMTP

The owner can revert to SMTP-only at any time by clearing `email.broadcast_provider`. When cleared:
- `email.broadcast_provider` is deleted or set to empty
- All `email.broadcast_resend_*` keys are left in place (non-destructive; can be reconnected without re-entering from scratch)
- The system immediately falls back to the SMTP loop
- No contact data is modified in Resend; the contact list persists

The UI should show: *"Broadcasts will be sent via SMTP to each subscriber individually. Resend contact sync will be paused."*

### BroadcastClient success message

`BroadcastClient.tsx` displays "Broadcast sent to {N} subscribers" using `{ sent: number }` from `sendBroadcast()`. In Resend mode there is no per-subscriber count (one API call). The Resend path returns the AECMS DB count of `subscribe_news_alerts: true` users as `sent` — already available at the top of `sendBroadcast()`. No frontend changes required.

### Template compatibility

The existing `buildNotificationHtml()` and `buildBroadcastHtml()` private methods in `SubscriptionsService` can be reused for the Resend path without modification. Passing `'{{{RESEND_UNSUBSCRIBE_URL}}}'` as the `unsubLink` value generates:

```html
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>
```

Resend replaces the triple-brace placeholder with the per-contact, per-topic unsubscribe URL server-side before delivery. No new template methods needed.

### Subscription panel trust copy

The `/account` → Notifications tab must include a reassurance message near the subscription toggles:

> We don't spam. No daily or weekly digests — just one email when a new article or product is published, or in the very rare instance we need to send an all-hands alert.

This is a permanent fixture of the UI, independent of broadcast provider configuration.

### Options considered

| Option | Trade-off |
|--------|-----------|
| Resend Broadcast API with Topics (chosen) | Per-topic unsubscribe; unlimited marketing sends; single API call per broadcast; bidirectional sync required |
| SMTP loop to Resend relay (current) | Zero new code; hits 100/day transactional cap; no compliant List-Unsubscribe headers |
| Resend Broadcast API with Segments only | No per-topic unsubscribe granularity; global unsubscribe breaks multi-category preferences |

---

## Design & Implementation Guide

### Overview

1. Install `resend` npm package in backend
2. Add `ResendBroadcastService` — Resend SDK wrapper for contact and topic management
3. Add `ResendWebhookController` — inbound unsubscribe webhook
4. Extend `SubscriptionsService` — provider branch + outbound sync on all five triggers
5. Extend `AuthService` — registration contact upsert
6. Extend Email Settings UI — Broadcast section
7. Add trust copy to account Notifications tab
8. Write `backend/scripts/resend-backfill.ts` — permanent operator tool

No schema changes. No new capabilities. No migrations. The existing `email.*` key filter in `PATCH /settings/email` already covers all `email.broadcast_*` keys transparently.

### ISM keys

**Existing SMTP keys (unchanged):**
```
email.smtp_host
email.smtp_port
email.smtp_security
email.smtp_user
email.smtp_pass_enc
email.system_from
email.notification_from
```

**New broadcast keys:**
```
email.broadcast_provider                       — 'resend' | unset (unset = SMTP loop fallback)
email.broadcast_resend_api_key_enc             — Resend API key (encrypted)
email.broadcast_resend_audience_id             — Resend Audience UUID (all contacts live here)
email.broadcast_resend_articles_topic_id       — Resend Topic UUID for article notifications
email.broadcast_resend_products_topic_id       — Resend Topic UUID for product notifications
email.broadcast_resend_news_topic_id           — Resend Topic UUID for admin broadcasts
email.broadcast_resend_webhook_secret_enc      — Resend webhook signing secret (encrypted)
```

`email.broadcast_resend_audience_id` is required for all Resend Contacts API calls — Topics are sub-groups within an Audience. The FR's original design omitted this key.

### File map

```
backend/package.json                                    — add resend
backend/src/email/resend-broadcast.service.ts           — new
backend/src/email/resend-webhook.controller.ts          — new
backend/src/email/email.module.ts                       — register new files; export ResendBroadcastService
backend/src/subscriptions/subscriptions.service.ts      — provider branch + 5 sync triggers
backend/src/auth/auth.service.ts                        — registration contact upsert (after prisma.user.create)
backend/scripts/resend-backfill.ts                      — new permanent operator script
frontend/app/admin/settings/SettingsClient.tsx          — Broadcast section in email tab
frontend/app/(site)/account/AccountPageClient.tsx       — trust copy paragraph
```

### `ResendBroadcastService` interface

```typescript
upsertContact(user: { email: string; firstName: string; lastName: string }): Promise<void>
subscribeToTopic(email: string, topicId: string): Promise<void>
unsubscribeFromTopic(email: string, topicId: string): Promise<void>
sendBroadcast(opts: {
  audienceId: string;
  topicId: string;
  from: string;
  subject: string;
  html: string;    // must contain {{{RESEND_UNSUBSCRIBE_URL}}}
}): Promise<void>
```

All methods read `email.broadcast_resend_api_key_enc` and `email.broadcast_resend_audience_id` lazily via `SettingsService.getEffective()` — consistent with ISM lazy-read pattern used by all other providers.

`markGloballyUnsubscribed()` is intentionally absent from the interface. Global Resend unsubscription is reserved for account deletion only and is out of scope for this FR.

### `ResendWebhookController`

```
POST /email/webhooks/resend
```

No auth guard — Resend calls this unauthenticated. Signature verified via HMAC-SHA256 using `email.broadcast_resend_webhook_secret_enc` and Node's built-in `crypto` (no `svix` package required). Returns 401 immediately on invalid signature. On `contact.unsubscribed` event, reverse-looks up `topic_id` against the three ISM topic ID keys and sets the corresponding `subscribe_*` field to `false` in the DB.

### `SubscriptionsService` changes

`notifyNewArticle()`, `notifyNewProduct()`, and `sendBroadcast()` each get a provider branch:

```typescript
const broadcastProvider = await this.settingsService.getEffective('email.broadcast_provider');
if (broadcastProvider === 'resend') {
  // single Resend broadcast API call
  // return { sent: localDbSubscriberCount }
}
// existing SMTP loop follows unchanged
```

`updatePreferences()` gets an outbound sync call after the DB write. `unsubscribeByToken()` gets a matching per-topic sync call when `broadcast_provider === 'resend'` (not global unsubscription).

### Email Settings UI — Broadcast section

Added to the Email tab below the existing SMTP fields and test button:

- **Subscriber Broadcasts** heading
- **Broadcast service** selector: `[ None (use SMTP) | Resend ]`
- When `None`: explanatory note about SMTP per-subscriber delivery
- When `Resend`, expands to show:
  - Resend API key (SecretInput, encrypted)
  - Audience ID
  - Articles topic ID
  - Products topic ID
  - News/alerts topic ID
  - Webhook secret (SecretInput, encrypted)
  - **Clear broadcast settings** button with confirmation copy

### Owner setup (one-time, after deploy)

Before Resend broadcast emails will work:

1. In the Resend dashboard, create one **Audience** for the site
2. Inside that audience, create three **Topics**: Articles, Products, News
3. In Email Settings → Subscriber Broadcasts, set provider to **Resend** and fill in:
   - API key
   - Audience ID
   - Three topic UUIDs
   - Webhook secret (generated when registering the webhook)
4. Save settings
5. Register the webhook URL (`https://yourdomain.com/email/webhooks/resend`) in the Resend dashboard for the `contact.unsubscribed` event
6. Run the backfill script: `cd backend && npx ts-node scripts/resend-backfill.ts`

Steps 1–5 are pure configuration — no redeploy required. Step 6 syncs existing subscribers into Resend; the script is idempotent and can be re-run at any time.

### Key implementation notes

- `{{{RESEND_UNSUBSCRIBE_URL}}}` passed as `unsubLink` to existing HTML template builders — no new templates required
- `email.broadcast_resend_audience_id` must be read alongside the API key in every Resend Contacts API call
- Webhook signature: compare HMAC-SHA256(`svix-timestamp + "." + raw body`, secret) against `svix-signature` header — Resend's webhook infrastructure uses the Svix signing format even though the `svix` npm package is not required
- If Resend rejects a broadcast (malformed placeholder, unknown topic ID, etc.), the error must bubble up to the admin UI as an exception — not silently swallowed as in the current per-subscriber fire-and-forget
- The `resend` npm package must be added: `npm install resend` in `backend/`

---

## Completion Report

> _Fill in after implementation._

---

## Testing Guide

> _Written alongside implementation._

### Prerequisites
- Local dev with `SETTINGS_ENCRYPTION_KEY` set
- A Resend account with one audience, three topics, and an API key
- Audience ID and three topic UUIDs noted
- At least two test users with different subscription preference combinations

### Test scenarios

**A. SMTP fallback (broadcast_provider unset)**
1. Ensure `email.broadcast_provider` is not set.
2. Publish an article → confirm per-subscriber SMTP loop fires as today.
3. Confirm no Resend API calls are made.

**B. Resend broadcast — article notification**
1. Set `email.broadcast_provider = 'resend'` and configure all Resend fields.
2. Publish an article.
3. Confirm a single Resend broadcast API call is made (not N individual sends).
4. Confirm the email body contains a working per-topic unsubscribe link.

**C. Per-topic unsubscribe via Resend webhook**
1. Click the unsubscribe link in a Resend article broadcast email.
2. Confirm Resend fires the webhook to `/email/webhooks/resend`.
3. Confirm `subscribe_new_articles` is set to `false` in the DB for that user.
4. Confirm `subscribe_new_products` and `subscribe_news_alerts` are unaffected.

**D. Preference sync — subscribe**
1. Log in as a user with all subscriptions off.
2. Enable "new articles" in `/account`.
3. Confirm the user is upserted in Resend and subscribed to the articles topic only.

**E. Preference sync — unsubscribe**
1. Log in as a user with articles subscription on.
2. Disable it in `/account`.
3. Confirm the user is removed from the articles topic in Resend.
4. Confirm products and news topics are unaffected.

**F. Registration with defaults**
1. Register a new user while `subscription.default_new_articles = 'true'` and others off.
2. Confirm a Resend contact is created and subscribed to articles topic only.

**G. AECMS token unsubscribe while Resend is configured**
1. Call `GET /subscriptions/unsubscribe?token=...&category=articles` directly.
2. Confirm `subscribe_new_articles` set to `false` in DB.
3. Confirm the articles topic subscription is removed in Resend.
4. Confirm contact is NOT globally unsubscribed in Resend; other topics unaffected.

**H. Clear broadcast settings / revert to SMTP**
1. Click "Clear broadcast settings" in Email Settings.
2. Confirm `email.broadcast_provider` is cleared.
3. Publish a product → confirm per-subscriber SMTP loop fires, no Resend API calls.
4. Confirm Resend contact list is untouched (preserved for reconnection).

**I. Webhook signature rejection**
1. POST to `/email/webhooks/resend` with an invalid or missing signature.
2. Confirm 401 response; no DB changes.

**J. Backfill script**
1. Create several test users with varying subscription combinations.
2. Run `npx ts-node scripts/resend-backfill.ts`.
3. Confirm each user appears as a contact in the correct Resend topics.
4. Run the script again — confirm no duplicates, no errors (idempotent).

### Acceptance criteria

- [ ] `email.broadcast_provider` unset → SMTP loop fires for all three broadcast types (no regression)
- [ ] `email.broadcast_provider = 'resend'` → single Resend broadcast API call per notification type
- [ ] `{{{RESEND_UNSUBSCRIBE_URL}}}` present in all broadcast HTML; topic-scoped unsubscribe works end-to-end
- [ ] Resend webhook syncs unsubscribe back to correct `subscribe_*` field only; other categories unaffected
- [ ] Preference change in `/account` syncs delta to correct Resend topic(s)
- [ ] New user registration syncs contact + topic subscriptions matching ISM defaults
- [ ] AECMS token unsubscribe syncs per-topic to Resend; does NOT globally unsubscribe contact
- [ ] "Clear broadcast settings" reverts to SMTP loop; Resend contact list preserved
- [ ] Webhook rejects unsigned/invalid requests with 401; no DB changes on rejected request
- [ ] All five transactional email types unaffected by any broadcast_provider setting
- [ ] Backfill script is idempotent; correctly subscribes existing users to correct topics
- [ ] Trust copy visible on account Notifications tab regardless of broadcast provider config
- [ ] Broadcast error (e.g. bad topic ID) surfaces to admin UI rather than silently swallowed
