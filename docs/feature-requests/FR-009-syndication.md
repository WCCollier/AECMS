# FR-009: Member Subscriptions & Syndication

**Status:** `accepted`
**Requested:** 2026-06-26
**Deployed:** —
**Size:** `medium` (schema migration, new backend module, RSS endpoint, frontend account preferences UI, admin broadcast tool)

---

## Synopsis

Allows site members to opt into email notifications for new articles, new products, and news/alert broadcasts. The account page gains a Notifications section where members manage their subscription preferences. A new admin tool allows the owner to send a broadcast to subscribers. Articles also gain a public RSS feed at `/feed.xml` so readers can subscribe via any feed reader without giving an email address. System emails (auth, digital delivery, order confirmations) are listed for transparency but cannot be opted out of.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Planned — implementation deferred |

---

## Discussion

### Subscription categories

| Category | Trigger | Who can subscribe |
|----------|---------|-------------------|
| **New Articles** | Article published (status changes to `published`) | Any logged-in member |
| **New Products** | Product published (status changes to `published`) | Any logged-in member |
| **News & Alerts** | Manual owner-triggered broadcast from backstage | Any logged-in member |

System emails (authentication, password reset, digital product delivery, order confirmation) are displayed in the account Notifications tab as informational items with no opt-out toggle — members can see what automated emails they'll receive, but these cannot be disabled.

### Opt-in default

All subscriptions are **opt-in** (default: off). No existing member is enrolled without action. New registrations also default to all-off. The account Notifications tab is where members turn categories on.

### Unsubscribe links

Every subscription email includes a one-click unsubscribe link at the bottom. The link is token-based (no login required to use it) and disables only that category for that user. Format:

```
https://yoursite.com/auth/unsubscribe?token={unsubscribe_token}&category=articles
```

The `unsubscribe_token` is a persistent random hex string stored on the User record (generated on first subscription action, never rotates — same token is reused across all categories so one link is enough). The category param scopes which preference is turned off.

### RSS feed

A public RSS 2.0 feed at `/feed.xml` lists the 50 most recently published articles. Includes: `<title>`, `<description>` (excerpt or truncated content), `<link>`, `<pubDate>`, `<guid>`. No authentication required. Complements the email subscription option — some readers prefer feed readers over email.

### Delivery timing

Emails are **fire-and-forget, immediate** — sent inline when the publish event fires, the same pattern as order confirmation emails. No queue, no scheduler. At current traffic levels this is appropriate. If volume grows to the point of needing a queue (hundreds of subscribers, bulk sends taking >5s), a background job system can be added as a follow-on.

### Admin broadcast (News & Alerts)

A simple form in the backstage: subject line + body (plain text or basic TipTap). Sends to all users where `subscribe_news_alerts = true`. No scheduling, no preview-to-self step (owner can test by subscribing their own account). Gated by a new capability: `broadcast.send`.

---

## Schema Changes

```prisma
model User {
  // ... existing fields ...

  // Subscription preferences (all opt-in, default false)
  subscribe_new_articles  Boolean  @default(false)
  subscribe_new_products  Boolean  @default(false)
  subscribe_news_alerts   Boolean  @default(false)

  // Unsubscribe token — generated on first subscription action
  unsubscribe_token       String?
}
```

Migration name: `add_subscription_preferences`

No separate subscription table needed at current scale. If subscriber counts grow into the thousands, a separate table with per-email indexing would be worthwhile — the migration path is straightforward (move the three booleans out).

---

## Backend Changes

### New: `SubscriptionService` (`backend/src/subscriptions/`)

Module: `SubscriptionsModule`

```
subscriptions.module.ts
subscriptions.service.ts
subscriptions.controller.ts
```

#### `SubscriptionsService` methods

| Method | Description |
|--------|-------------|
| `getPreferences(userId)` | Returns `{ subscribe_new_articles, subscribe_new_products, subscribe_news_alerts }` |
| `updatePreferences(userId, dto)` | Updates one or more subscription booleans; generates `unsubscribe_token` if not yet set |
| `unsubscribeByToken(token, category)` | No-auth; finds user by token, sets the specified category preference to false |
| `notifyNewArticle(articleId)` | Sends to all `subscribe_new_articles = true` users |
| `notifyNewProduct(productId)` | Sends to all `subscribe_new_products = true` users |
| `sendBroadcast(subject, body, actorId)` | Sends to all `subscribe_news_alerts = true` users; requires `broadcast.send` capability |

#### Notification email format

All subscription emails follow the same structure:
- Subject: configurable per type (e.g. `New article: {title}`)
- Header: site name + site logo (if set via ISM)
- Body: brief summary + CTA button linking to the content
- Footer: "You're receiving this because you subscribed to [category] from {site_name}. [Unsubscribe from this category]"

#### `notifyNewArticle` / `notifyNewProduct` — where called

These are called from `ArticlesService.update()` and `ProductsService.update()` respectively, when `status` transitions from any non-published value to `published`. The call is fire-and-forget (wrapped in `.catch()` — email failures must never block the publish action).

```typescript
// In ArticlesService.update():
if (dto.status === 'published' && existingArticle.status !== 'published') {
  this.subscriptionsService.notifyNewArticle(article.id).catch(err =>
    this.logger.error('Failed to send new article notifications', err)
  );
}
```

#### New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/subscriptions/preferences` | `JwtAuthGuard` | Get current user's subscription preferences |
| `PATCH` | `/subscriptions/preferences` | `JwtAuthGuard` | Update subscription preferences |
| `GET` | `/subscriptions/unsubscribe` | None | One-click unsubscribe: `?token={token}&category={articles\|products\|news}` |
| `POST` | `/subscriptions/broadcast` | `JwtAuthGuard + CapabilityGuard(broadcast.send)` | Admin sends a news/alert broadcast |

#### New capability

| Capability | Scope | Default roles |
|-----------|-------|--------------|
| `broadcast.send` | `backstage` | Owner only |

---

## Frontend Changes

### Account page — Notifications tab

Add a **Notifications** tab to the customer-facing account page (`/account` → `AccountPageClient.tsx`).

**System emails section** (read-only, informational):

> These emails are sent automatically and cannot be disabled:
> - **Account verification** — sent when you register
> - **Password reset** — sent when you request a password reset
> - **Order confirmation** — sent after every purchase
> - **Digital product delivery** — sent with your download links after purchase

**Subscription preferences section** (editable):

Three toggle rows, each with label and brief description:
- **New Articles** — "Get an email when a new article is published"
- **New Products** — "Get an email when a new product is added to the shop"
- **News & Alerts** — "Receive occasional news and announcements from the site owner"

Each toggle calls `PATCH /subscriptions/preferences` on change. Show a brief "Saved" flash confirmation.

**Files:**
- `frontend/app/(site)/account/AccountPageClient.tsx` — add Notifications tab
- `frontend/app/auth/unsubscribe/page.tsx` (new) — unsubscribe landing page (shows "You've been unsubscribed from [category]" or error)

### Admin — Broadcast form

New page at `/admin/broadcasts` (or a panel within a future Messaging section). Simple form:
- Subject line (text input)
- Body (TipTap or textarea for now — full editor is overkill for a simple alert)
- "Send to N subscribers" button (shows live count fetched from `GET /subscriptions/preferences` aggregate)
- Confirmation modal before send

Sidebar nav entry: "Broadcasts" under a new "Communication" section, gated on `broadcast.send`.

**Files:**
- `frontend/app/admin/broadcasts/page.tsx` (new)
- `frontend/app/admin/broadcasts/BroadcastClient.tsx` (new)
- `frontend/app/admin/layout.tsx` — add "Broadcasts" nav item

---

## RSS Feed

### `frontend/app/feed.xml/route.ts`

Next.js `route.ts` serving `application/rss+xml`. Fetches the 50 most recently published articles from the backend (`GET /articles?status=published&limit=50&sort=published_at`). Generates RSS 2.0 XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{site_name}</title>
    <link>{canonical_domain}</link>
    <description>{site_description}</description>
    <language>en-us</language>
    <lastBuildDate>{most_recent_article.updated_at}</lastBuildDate>
    {articles.map(a => (
      <item>
        <title>{a.title}</title>
        <link>{canonical_domain}/articles/{a.slug}</link>
        <description>{a.excerpt or truncated meta_description}</description>
        <pubDate>{a.published_at in RFC 822}</pubDate>
        <guid isPermaLink="true">{canonical_domain}/articles/{a.slug}</guid>
      </item>
    ))}
  </channel>
</rss>
```

Revalidate hourly (`export const revalidate = 3600`). Add `<link rel="alternate" type="application/rss+xml">` to the site `<head>` in `app/layout.tsx`.

**File:** `frontend/app/feed.xml/route.ts` (new)

---

## Acceptance Criteria

- [ ] Account page has a Notifications tab with system emails listed (no toggle) and three opt-in toggles
- [ ] Toggling a preference calls the API and persists across sessions
- [ ] Publishing a new article sends an email to all `subscribe_new_articles = true` users
- [ ] Publishing a new product sends an email to all `subscribe_new_products = true` users
- [ ] Subscription emails include a footer unsubscribe link
- [ ] Clicking an unsubscribe link (no login required) disables only that category and shows a confirmation page
- [ ] `/subscriptions/broadcast` endpoint is gated on `broadcast.send` capability
- [ ] Admin broadcast form sends to all `subscribe_news_alerts = true` users
- [ ] `/feed.xml` is a valid RSS 2.0 document listing the 50 most recent published articles
- [ ] `<link rel="alternate" type="application/rss+xml">` is present in the site `<head>`
- [ ] Email failures on publish/broadcast never block the publish action or return errors to the user

---

## Implementation Order

1. Schema migration
2. `SubscriptionsModule` (service + controller + endpoints)
3. Hook `notifyNewArticle` / `notifyNewProduct` into Articles/Products services
4. Account page Notifications tab
5. Unsubscribe landing page
6. RSS feed route
7. Admin broadcast page
8. `broadcast.send` capability + sidebar nav entry
