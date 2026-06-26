# FR-009: Member Subscriptions & Syndication

**Status:** `deployed`
**Requested:** 2026-06-26
**Deployed:** 2026-06-26
**Size:** `medium` (schema migration, new backend module, RSS endpoint, frontend account preferences UI, admin broadcast tool)

---

## Synopsis

Allows site members to opt into email notifications for new articles, new products, and news/alert broadcasts. The account page gains a Notifications section where members manage their subscription preferences. A new admin tool allows the owner to send a broadcast to subscribers. Articles also gain a public RSS feed at `/feed.xml` so readers can subscribe via any feed reader without giving an email address. System emails (auth, digital delivery, order confirmations) are listed for transparency but cannot be opted out of.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-26 | accepted | Planned — implementation deferred |
| 2026-06-26 | accepted | Amended — default subscription preferences, broadcast.config capability, Notifications settings tab added |

---

## Discussion

### Subscription categories

| Category | Trigger | Who can subscribe |
|----------|---------|-------------------|
| **New Articles** | Article published (status changes to `published`) | Any logged-in member |
| **New Products** | Product published (status changes to `published`) | Any logged-in member |
| **News & Alerts** | Manual owner-triggered broadcast from backstage | Any logged-in member |

System emails (authentication, password reset, digital product delivery, order confirmation) are displayed in the account Notifications tab as informational items with no opt-out toggle — members can see what automated emails they'll receive, but these cannot be disabled.

### Default subscription preferences (configurable by owner)

The owner can configure which categories new sign-ups are automatically subscribed to via Admin Settings → Notifications, gated on the `broadcast.config` capability. All three categories default to **off** out of the box — no surprise enrollment without deliberate owner action.

New ISM keys:

| Key | Description | Default |
|-----|-------------|---------|
| `subscription.default_new_articles` | Auto-subscribe new members to New Articles | `false` |
| `subscription.default_new_products` | Auto-subscribe new members to New Products | `false` |
| `subscription.default_news_alerts` | Auto-subscribe new members to News & Alerts | `false` |

During registration (`AuthService.register()`), the three ISM defaults are read via `SettingsService.getEffective()` and applied to the newly-created user's `subscribe_*` fields. Members can change their own preferences at any time from the account Notifications tab.

**New capability:**

| Capability | Scope | Default roles |
|-----------|-------|--------------|
| `broadcast.config` | `backstage` | Owner only (grantable to Admin) |

**Admin Settings — Notifications tab** (new, alongside General / Email / Payments / Storage / Appearance / SEO): Three toggle rows configuring the defaults. Gated on `broadcast.config`.

### Opt-in default

The system-level default for all three categories is **off**. Owners who want all new sign-ups subscribed immediately can flip the ISM toggles. Existing members are never retroactively enrolled — only new registrations read the defaults at sign-up time.

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

#### New capabilities

| Capability | Scope | Default roles | Purpose |
|-----------|-------|--------------|---------|
| `broadcast.send` | `backstage` | Owner only | Send a news/alert broadcast |
| `broadcast.config` | `backstage` | Owner only (grantable to Admin) | Configure default subscription preferences in Settings |

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

New page at `/admin/broadcasts`. Simple form:
- Subject line (text input)
- Body (TipTap or textarea — full editor is overkill for a simple alert)
- "Send to N subscribers" button (shows live count fetched from subscriber aggregate)
- Confirmation modal before send

Sidebar nav entry: "Broadcasts" under a new "Communication" section, gated on `broadcast.send`.

**Files:**
- `frontend/app/admin/broadcasts/page.tsx` (new)
- `frontend/app/admin/broadcasts/BroadcastClient.tsx` (new)
- `frontend/app/admin/layout.tsx` — add "Broadcasts" nav item

### Admin Settings — Notifications tab

New tab in Admin Settings, gated on `broadcast.config`. Three toggle rows:
- **New Articles** — "Auto-subscribe new members to new article emails"
- **New Products** — "Auto-subscribe new members to new product emails"
- **News & Alerts** — "Auto-subscribe new members to news and alert broadcasts"

Helper text beneath each: "Members can always change this in their own account settings."

**Files:**
- `frontend/app/admin/settings/NotificationsTab.tsx` (new)
- `frontend/app/admin/settings/SettingsClient.tsx` — add Notifications tab to tab list

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

- [ ] Admin Settings → Notifications tab allows owner to configure default subscription preferences for new sign-ups
- [ ] New registrations automatically inherit the configured defaults at sign-up time
- [ ] Existing members are unaffected when defaults change
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

1. Schema migration (`subscribe_*` fields + `unsubscribe_token` on User)
2. ISM keys + `broadcast.config` / `broadcast.send` capabilities seeded
3. `SubscriptionsModule` (service + controller + endpoints)
4. Admin Settings Notifications tab (`broadcast.config` gate, ISM defaults UI)
5. Registration hook — read ISM defaults and apply to new user on sign-up
6. Hook `notifyNewArticle` / `notifyNewProduct` into Articles/Products services
7. Account page Notifications tab (member preferences + system email list)
8. Unsubscribe landing page
9. RSS feed route
10. Admin broadcast page (`broadcast.send` gate) + sidebar nav entry

---

## Completion Report

**Deployed:** 2026-06-26

### What was built

All 10 implementation steps completed:

**Schema**: Migration `20260626160043_add_subscription_preferences` — added `subscribe_new_articles`, `subscribe_new_products`, `subscribe_news_alerts` (all `Boolean @default(false)`) and `unsubscribe_token String?` to the `users` table.

**Capabilities**: `broadcast.send` and `broadcast.config` added to `CAPABILITY_DEFINITIONS` and `seed-minimal.js`. Owner-only by default; `broadcast.config` can be granted to Admin.

**ISM defaults**: `subscription.default_new_articles`, `subscription.default_new_products`, `subscription.default_news_alerts` seeded to `false` in `defaultSettings`.

**Backend — SubscriptionsModule** (`backend/src/subscriptions/`):
- `subscriptions.service.ts` — getPreferences, updatePreferences (generates unsubscribe token on first subscription), unsubscribeByToken, notifyNewArticle, notifyNewProduct, sendBroadcast, getSubscriberCount
- `subscriptions.controller.ts` — 5 endpoints: GET/PATCH `/subscriptions/preferences` (JwtAuthGuard), GET `/subscriptions/unsubscribe` (public), GET `/subscriptions/counts` + POST `/subscriptions/broadcast` (BackstageGuard + broadcast.send)

**Backend — Hooks**: `ArticlesService.update()` and `ProductsService.update()` each fire-and-forget call `notifyNewArticle/notifyNewProduct` on status → published transition. Logger captures errors; failures never block the publish.

**Backend — Registration**: `AuthService.register()` reads 3 ISM keys directly via `prisma.siteSettings.findMany()` (avoids circular module dependency AuthModule → SettingsModule → CapabilitiesModule → AuthModule) and applies defaults to new user at creation time.

**Backend — Settings**: `PATCH /settings/notifications` endpoint added (gated on `broadcast.config`), accepting `subscription.*` keys. `GET /settings` now also allows `broadcast.config` capability in addition to the four configure atoms.

**Frontend — Admin Settings Notifications tab** (`SettingsClient.tsx`): New `notifications` tab, visible only to users with `broadcast.config` cap. Three checkbox toggles for the ISM subscription defaults, saving to `PATCH /settings/notifications`.

**Frontend — Admin Broadcasts page** (`/admin/broadcasts`): Simple form with subject + body + live subscriber count + confirmation modal before send. Gated on `broadcast.send` cap; sidebar nav entry added.

**Frontend — Account Notifications tab** (`AccountPageClient.tsx`): Collapsible "Notifications" section with read-only system emails list + three toggle rows (New Articles, New Products, News & Alerts). Each toggle calls `PATCH /subscriptions/preferences` on change; shows "Saved" flash.

**Frontend — Unsubscribe page** (`/auth/unsubscribe`): Reads `?token=&category=` from URL, calls `GET /subscriptions/unsubscribe` without auth, shows confirmation or error.

**Frontend — RSS feed** (`/feed.xml/route.ts`): Next.js route handler serving RSS 2.0 XML, revalidates hourly. Fetches 50 most-recent published articles from backend. RSS auto-discovery `<link rel="alternate">` added to `app/layout.tsx`.

### Notable implementation decisions

- **No circular dep**: `AuthService` reads subscription ISM defaults via `prisma.siteSettings.findMany()` directly instead of injecting `SettingsService`, which would have created a `AuthModule → SettingsModule → AuditModule → CapabilitiesModule → AuthModule` cycle.
- **One unsubscribe token per user**: Token is generated lazily on first subscription action and reused across all categories. The `category` query param scopes which preference is turned off.
- **Notification email FROM address**: Uses `email.notification_from` if set, falls back to `email.system_from`.

---

## Testing Guide

### API

```bash
# 1. Get preferences (customer session)
curl http://localhost:4000/subscriptions/preferences \
  -H "Authorization: Bearer <member_token>"

# 2. Update preferences
curl -X PATCH http://localhost:4000/subscriptions/preferences \
  -H "Authorization: Bearer <member_token>" \
  -H "Content-Type: application/json" \
  -d '{"subscribe_new_articles":true}'

# 3. Test unsubscribe (token from user DB row)
curl "http://localhost:4000/subscriptions/unsubscribe?token=<token>&category=articles"

# 4. RSS feed
curl http://localhost:3000/feed.xml
```

### UI flows

1. **Account → Notifications**: Log in as member, go to `/account`, expand Notifications → toggle New Articles → confirm "Saved" flash; toggle off → re-check DB.
2. **Admin Settings → Notifications tab**: Log in to backstage as owner, go to Settings → Notifications tab (new, last tab) → toggle defaults → save.
3. **Admin Broadcasts**: Go to `/admin/broadcasts` → enter subject + body → "Send" → confirmation modal → confirm → success message with count.
4. **Unsubscribe link**: Navigate to `/auth/unsubscribe?token=<token>&category=articles` → confirm "Unsubscribed" message.
5. **RSS**: Visit `/feed.xml` → confirm valid RSS 2.0 XML with articles. Check `<head>` source for `<link rel="alternate" type="application/rss+xml">`.
6. **Publish hook** (manual): In backstage, publish a draft article while member is subscribed → confirm email logged (console provider in dev).

### Live deployment

Run migration on Neon before deploying code:
```bash
DATABASE_URL=<neon-url> npx prisma migrate deploy
```
The migration adds nullable/boolean-with-default columns only — fully backward-compatible.
