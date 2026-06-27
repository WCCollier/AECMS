# FR-011: Resend Broadcast Integration

**Status:** `accepted`
**Requested:** 2026-06-27
**Deployed:** —
**Size:** `medium`

---

## Synopsis

AECMS currently sends all subscriber notification emails (new article, new product, admin broadcast) via a per-subscriber SMTP loop. This approach works at small scale but counts each send against Resend's 100/day transactional cap if Resend is the configured SMTP relay — a ceiling that becomes a reliability problem as subscriber lists grow. Resend's Broadcast API solves this: it accepts a single API call per broadcast, sends to a managed contact list at the marketing-email quota (unlimited sends, 1,000 contacts free), and handles RFC-8058 `List-Unsubscribe` headers and per-topic opt-out mechanics automatically. This FR adds a Broadcast section to the Email Settings panel and wires the three subscriber notification types to the Broadcast API when Resend is configured. The five transactional email types (verification, password reset, order confirmation, digital delivery, test) continue to use the existing SMTP path unchanged.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Designed during email architecture session; follows FR-009 syndication work |

---

## Discussion

### Request context

During an email architecture review, it became clear that new article notifications, new product notifications, and admin broadcasts are semantically broadcasts — they are triggered by a publisher action, sent to an opt-in list, and are unsubscribable — not transactional emails triggered by a recipient action. Routing them through the transactional Send API (via SMTP loop) is both conceptually wrong and practically fragile against Resend's 100/day transactional cap. The Broadcast API is the correct channel, and Resend's Topics feature maps directly to AECMS's existing three-category subscription model (`subscribe_new_articles`, `subscribe_new_products`, `subscribe_news_alerts`).

### Email type classification

**Transactional (Send API / SMTP — existing, unchanged):**

| Email | Rationale |
|-------|-----------|
| Account verification | Response to recipient's own registration; cannot opt out |
| Password reset | Response to recipient's own request; cannot opt out |
| Order confirmation | Triggered by recipient's own purchase; legally expected |
| Digital/Kindle delivery | Triggered by recipient's own purchase; file delivery |
| Test email (admin) | Point-to-point diagnostic; not a subscriber email |

These five are 1:1 system responses to user actions. There is no concept of unsubscribing from your own order confirmation. The existing `SmtpEmailProvider` + nodemailer stack handles all five with no changes.

**Broadcast API (new path, Resend only):**

| Email | Rationale |
|-------|-----------|
| New article notification | Publisher action → N subscribers; opt-in list; unsubscribable |
| New product notification | Publisher action → N subscribers; opt-in list; unsubscribable |
| Admin broadcast/newsletter | Explicitly a list send; always was a broadcast in concept |

These three are 1:many publisher-triggered sends. Moving them to the Broadcast API removes the per-subscriber loop, eliminates the transactional cap risk, and lets Resend inject compliant `List-Unsubscribe` headers automatically.

### Fallback behavior

If `email.broadcast_provider` is unset, the system falls back to the existing SMTP loop for all three broadcast types — exactly as it works today. No regression for deployments not using Resend. The SMTP path remains fully functional as the default.

### Why Resend Topics (not Segments)

Resend has both Segments (filter contacts by property) and Topics (named subscription categories a contact can independently opt in/out of). Topics are the right primitive here because AECMS's three subscription categories are independent — a user can subscribe to articles but not products. Marking a contact globally `unsubscribed: true` would break all three categories at once; Topics scope the unsubscribe to the correct category only. The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder, when a `topic_id` is attached to a broadcast, generates a per-topic unsubscribe link rather than a global one.

### Bidirectional sync

The integration has two sync directions:

**Outbound (AECMS → Resend)** — three triggers:
1. **Registration**: upsert contact; subscribe to topics matching ISM subscription defaults (FR-009 defaults already stored in ISM)
2. **Preference change**: user toggles a category in `/account` → add or remove from the corresponding Resend topic
3. **Hard unsubscribe via AECMS token** (existing `/auth/unsubscribe` flow): mark contact `unsubscribed: true` globally in Resend

**Inbound (Resend → AECMS)** — one trigger:
- Contact clicks the per-topic unsubscribe link in a broadcast → Resend fires a webhook → AECMS handler reverse-looks up the topic ID against ISM keys and sets the corresponding `subscribe_*` field to `false` in the DB

The three topic IDs are stored in ISM (`email.broadcast_resend_articles_topic_id` etc.) specifically to enable this reverse lookup in the webhook handler.

### Clearing broadcast settings / reverting to SMTP

The owner can revert to SMTP-only at any time by clearing `email.broadcast_provider` in the Broadcast section of Email Settings (a "Clear / disable broadcast provider" action in the UI). When cleared:
- `email.broadcast_provider` is deleted or set to empty
- All `email.broadcast_resend_*` keys are left in place (non-destructive — they can be re-entered without re-configuring Resend from scratch if the owner wants to re-enable later)
- The system immediately falls back to the SMTP loop for all three broadcast types
- No contact data is modified in Resend; the Resend contact list persists and will be accurate again if broadcast is re-enabled

The UI should make the revert consequence explicit: "Broadcasts will be sent via SMTP to each subscriber individually. Resend contact sync will be paused."

### Options considered

| Option | Trade-off |
|--------|-----------|
| Resend Broadcast API with Topics (chosen) | Per-topic unsubscribe; unlimited marketing sends; single API call per broadcast; bidirectional sync required |
| SMTP loop to Resend relay (current) | Zero new code; hits 100/day transactional cap; no compliant List-Unsubscribe headers |
| Resend Broadcast API with Segments only | No per-topic unsubscribe granularity; global unsubscribe breaks multi-category preferences |

### Design philosophy — progressive complexity

The broadcast configuration is intentionally optional and non-blocking. The system meets the owner where they are:

- **Just getting started**: point SMTP at any existing host (Gmail, Mailgun, etc.). Everything works. No broadcast config required.
- **Using Resend as SMTP relay, small subscriber list**: the 100/day transactional cap is not a practical concern at low volume. No urgency to configure Topics.
- **Subscriber list becomes real**: flip `email.broadcast_provider` to `'resend'`, create three Topics in the Resend dashboard, paste the IDs in, run the backfill script once. No redeploy, no migration — pure configuration.

The fallback to the SMTP loop is not a workaround — it is the correct behavior for deployments that don't need the more sophisticated path yet. Future developers should read the fallback as intentional: this feature is designed to be adopted incrementally, not all-or-nothing.

### Subscription panel trust copy

The subscriber's notification preferences panel (`/account` → Notifications tab) must include a reassurance message near the subscription toggles. Suggested copy:

> We don't spam. No daily or weekly digests — just one email when a new article or product is published, or in the very rare instance we need to send an all-hands alert.

This copy is a permanent fixture of the UI, independent of whether Resend broadcast is configured. It sets honest expectations for subscribers and reduces unsubscribe rates by eliminating the fear of inbox flooding. The exact wording can be adjusted by the owner via a future ISM key (`subscription.trust_copy`) if personalisation is needed, but a sensible default should ship with the feature.

### Out of scope

- Support for broadcast providers other than Resend (selector has one option for now; architecture accommodates future additions via the `email.broadcast_provider` key)
- Migrating transactional emails to Resend's Send API REST client (SMTP relay is sufficient and requires no new code)
- Backfilling existing subscribers into Resend on deploy (covered separately below as a one-time owner action)
- Per-user encryption of subscriber data in Resend (Resend manages its own data security)

---

## Design & Implementation Guide

### Overview

1. Add `ResendBroadcastService` — wraps Resend SDK for contact sync and broadcast sends
2. Add Resend webhook endpoint — syncs inbound unsubscribes back to AECMS DB
3. Extend `SubscriptionsService` — branch on `email.broadcast_provider` for the three broadcast methods
4. Extend Email Settings UI — new Broadcast section with provider selector and Resend config fields
5. Register new ISM keys

No schema changes. No changes to the five transactional email flows. No changes to `SmtpEmailProvider`.

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
email.broadcast_provider                      — 'resend' | unset (unset = SMTP loop fallback)
email.broadcast_resend_api_key_enc            — Resend API key (encrypted)
email.broadcast_resend_articles_topic_id      — Resend topic UUID for article notifications
email.broadcast_resend_products_topic_id      — Resend topic UUID for product notifications
email.broadcast_resend_news_topic_id          — Resend topic UUID for admin broadcasts
email.broadcast_resend_webhook_secret_enc     — Resend webhook signing secret (encrypted)
```

The `email.broadcast_` prefix distinguishes these from the transactional SMTP stack. The `_resend_` infix scopes them to the Resend provider. A future provider (e.g. Mailchimp) would add `email.broadcast_mailchimp_*` keys following the same pattern.

### Backend changes

```
backend/src/email/resend-broadcast.service.ts   — new: Resend SDK wrapper
backend/src/email/resend-webhook.controller.ts  — new: POST /email/webhooks/resend
backend/src/email/email.module.ts               — register new service + controller
backend/src/subscriptions/subscriptions.service.ts  — branch on broadcast_provider
```

#### `ResendBroadcastService`

```typescript
// Responsibilities:
upsertContact(user: { email, firstName, lastName }): Promise<void>
subscribeToTopic(email: string, topicId: string): Promise<void>
unsubscribeFromTopic(email: string, topicId: string): Promise<void>
markGloballyUnsubscribed(email: string): Promise<void>
sendBroadcast(opts: {
  topicId: string;
  from: string;
  subject: string;
  html: string;   // must contain {{{RESEND_UNSUBSCRIBE_URL}}}
}): Promise<void>
```

All methods read `email.broadcast_resend_api_key_enc` lazily via `SettingsService.getEffective()` — consistent with ISM lazy-read pattern used elsewhere.

#### `ResendWebhookController`

```
POST /email/webhooks/resend
```

No auth guard — Resend calls this unauthenticated. Verify signature using `email.broadcast_resend_webhook_secret_enc` before processing. On `contact.unsubscribed` event:
1. Extract email and topic ID from payload
2. Reverse-lookup topic ID against `email.broadcast_resend_*_topic_id` ISM keys
3. Set the corresponding `subscribe_*` field to `false` in the DB

#### `SubscriptionsService` changes

`notifyNewArticle()`, `notifyNewProduct()`, and `sendBroadcast()` each get a provider branch at the top:

```typescript
const broadcastProvider = await this.settingsService.getEffective('email.broadcast_provider');
if (broadcastProvider === 'resend') {
  return this.sendViaResendBroadcast(/* topic-specific args */);
}
// existing SMTP loop follows unchanged
```

`updatePreferences()` gets an outbound sync call after the DB update:

```typescript
if (broadcastProvider === 'resend') {
  await this.resendBroadcastService.syncTopicSubscriptions(userId, dto);
}
```

### Frontend changes

```
frontend/app/admin/settings/EmailSettingsClient.tsx  — add Broadcast section
```

The Email Settings panel gains a new **Subscriber Broadcasts** section below the existing SMTP fields:

- **Broadcast service** selector: `[ None (use SMTP) | Resend ]`
- When Resend selected, expands to show:
  - Resend API key (password input, encrypted at save)
  - Articles topic ID
  - Products topic ID
  - News/alerts topic ID
  - Webhook secret (password input, encrypted at save)
  - A **Clear broadcast settings** button — sets `email.broadcast_provider` to empty and shows confirmation: "Broadcasts will be sent via SMTP to each subscriber individually. Resend contact list is preserved and can be reconnected at any time."

When provider is `None`, the section shows a brief explanation: "Broadcast emails (article notifications, product notifications, newsletters) will be sent individually via your SMTP settings above. For large subscriber lists, consider connecting a dedicated broadcast provider."

### API contract

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/email/webhooks/resend` | None (signature-verified) | Resend unsubscribe/event webhook |

All other changes are internal to the service layer. No new admin API endpoints — the broadcast settings are stored via the existing `PATCH /settings/email` endpoint.

### Owner setup (one-time, post-deploy)

Before broadcast emails will work via Resend:

1. In the Resend dashboard, create three Topics: `Articles`, `Products`, `News`
2. Copy the three topic UUIDs into Email Settings → Subscriber Broadcasts
3. Add the Resend API key and webhook secret
4. Register the webhook URL (`https://yourdomain.com/email/webhooks/resend`) in the Resend dashboard for the `contact.unsubscribed` event
5. Run the one-time contact backfill script (provided with this FR) to sync existing subscribers into Resend

The backfill script iterates all users with any `subscribe_*` flag set to `true`, upserts them as Resend contacts, and subscribes them to the appropriate topics. It is idempotent and safe to re-run.

### Key implementation notes

- The `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder must appear in every broadcast HTML body. The service layer injects it where the existing `unsubLink` variable currently appears in the HTML templates.
- The existing `unsubscribe_token` on `users` is still used for the AECMS-native unsubscribe path (transactional notification emails sent via SMTP). The two unsubscribe paths coexist.
- Contact merge fields: `{{{contact.first_name|there}}}` replaces the current `sub.first_name || 'there'` interpolation in broadcast HTML.
- If Resend rejects a broadcast (e.g. missing topic ID, malformed placeholder), the error should surface to the admin UI — not silently swallowed like the current per-subscriber fire-and-forget.
- The webhook endpoint must handle Resend's signature verification before touching the DB. An unverified request should return 401 immediately.

---

## Completion Report

> _Fill in after implementation._

---

## Testing Guide

> _Written alongside implementation._

### Prerequisites
- Local dev with `SETTINGS_ENCRYPTION_KEY` set
- A Resend account with three topics created and topic IDs noted
- At least two test users with different subscription preference combinations

### Test scenarios

**A. SMTP fallback (broadcast_provider unset)**
1. Ensure `email.broadcast_provider` is not set.
2. Publish an article → confirm per-subscriber SMTP loop fires as today.
3. Confirm no Resend API calls are made.

**B. Resend broadcast — article notification**
1. Set `email.broadcast_provider = 'resend'` and configure topic IDs.
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
3. Confirm the user is upserted in Resend and subscribed to the articles topic.

**E. Clear broadcast settings / revert to SMTP**
1. Click "Clear broadcast settings" in Email Settings.
2. Confirm `email.broadcast_provider` is cleared.
3. Publish a product → confirm per-subscriber SMTP loop fires, no Resend API calls.
4. Confirm Resend contact list is untouched (preserved for reconnection).

**F. Webhook signature rejection**
1. POST to `/email/webhooks/resend` with an invalid signature.
2. Confirm 401 response; no DB changes.

### Acceptance criteria

- [ ] `email.broadcast_provider` unset → SMTP loop fires for all three broadcast types (no regression)
- [ ] `email.broadcast_provider = 'resend'` → single Resend broadcast API call per notification type
- [ ] `{{{RESEND_UNSUBSCRIBE_URL}}}` present in all broadcast HTML; topic-scoped unsubscribe works
- [ ] Resend webhook syncs unsubscribe back to correct `subscribe_*` field only
- [ ] Preference change in `/account` syncs to Resend topic subscription
- [ ] Hard unsubscribe via AECMS token marks contact globally unsubscribed in Resend
- [ ] "Clear broadcast settings" reverts to SMTP loop; Resend contact list preserved
- [ ] Webhook rejects unsigned requests with 401
- [ ] All five transactional email types unaffected by any broadcast_provider setting
- [ ] Backfill script is idempotent and correctly subscribes existing users to correct topics
