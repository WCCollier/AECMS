# FR-013: X Account Timeline TipTap Widget

**Status:** `accepted`
**Size:** `medium`
**Area:** page-editor, widgets, social, backend

---

## Synopsis

Add a new TipTap block node — `XTimelineNode` — that fetches and renders the latest N posts from a specified X (Twitter) account. A backend proxy endpoint handles the X API v2 call and caches results in Redis so the live page never hits the API on every page load. The bearer token is stored encrypted in ISM under a new `social.*` namespace. On first use, the node's editor panel detects that the API key is not yet configured and surfaces a setup form inline, so the owner never has to leave the editor to get started.

**API used:** `GET /2/users/by/username/:handle` (user ID lookup) + `GET /2/users/:id/tweets` (timeline). X API v2, requires paid developer account. At ~$0.005/post-read and a 20-minute Redis cache, cost for a low-traffic personal site is effectively $0.00–$0.05/month.

---

## GUI Flow

### First use (API key not yet configured)

1. Owner opens the TipTap `⊕` insert menu and selects **X Timeline**.
2. The node appears in the editor. Before showing the handle form, it calls `GET /social/x-timeline/status` — a lightweight endpoint that returns `{ configured: boolean }` without hitting the X API.
3. Because `configured: false`, the node renders an **inline setup panel** (not a separate modal window — it lives inside the node's editor view):
   - Short explanation: "Paste your X API v2 Bearer Token below. You can get one at developer.x.com — a Basic plan is sufficient."
   - Secure token input (masked, same style as SMTP password field)
   - **Save** button → `PATCH /settings/social` → token stored as `social.x_bearer_token_enc`
   - **Cancel** → node is deleted from the document
4. On successful save the panel transitions to the **handle/count form** (step 2 below).

### Subsequent uses (API key already in ISM)

1. Owner inserts the node — `GET /social/x-timeline/status` returns `{ configured: true }`.
2. Node shows the **handle/count form** immediately:
   - `@handle` text input (e.g. `AECMS_official`)
   - **Posts to show** selector: 3 / 5 / 10
   - **Visibility** toggles: Always / Logged-in only / Logged-out only (same `show_when` control as every other widget)
3. While the handle is being typed, no fetch is made. Once the owner clicks away or presses Enter, the node fetches `/social/x-timeline?handle=xxx&count=N` and renders a live preview of the tweet cards inside the editor view.

### Live page

The `XTimeline` component fetches `/social/x-timeline?handle=xxx&count=N` from the backend proxy. The backend:
1. Retrieves `social.x_bearer_token_enc` from ISM.
2. Calls `GET /2/users/by/username/:handle` to resolve the handle to a user ID (cached in Redis, 24 h TTL).
3. Calls `GET /2/users/:id/tweets?max_results=N&tweet.fields=created_at,public_metrics,entities` (cached in Redis, 20 min TTL).
4. Returns a normalised array of tweet objects.

The `XTimeline` component renders each tweet as a card: tweet text (with linked @mentions and URLs), relative timestamp, reply/repost/like counts, and a "View on X" link. Cards use site theme colours (no Twitter blue hardcoded).

---

## ISM / Settings

### New ISM key

| ISM key | Env fallback | Description |
|---------|-------------|-------------|
| `social.x_bearer_token_enc` | `X_BEARER_TOKEN` | X API v2 Bearer Token (App-only auth, read-only) |

### New capability

`system.configure.social` — Owner-only. Gates `PATCH /settings/social`. Follows the same atom pattern as `system.configure.email`, `system.configure.payments`, `system.configure.storage`.

Also add to the `GET /settings` any-one-of check.

### New Settings tab

A minimal **Social** tab appears in Admin Settings alongside Email, Payments, Storage. For now it contains only the bearer token field (`SecretInput`, same style as Stripe secret key). Future social integrations (Instagram, LinkedIn, etc.) can be added to this tab.

---

## Backend Design

### New module: `SocialModule`

```
backend/src/social/
  social.module.ts
  social.controller.ts
  social.service.ts
```

**`SocialService`** — mirrors `ExternalFeedsService`:
- Own Redis client (same pattern: connect lazily, warn on error, degrade gracefully if Redis unavailable)
- `getStatus()` — checks if `social.x_bearer_token_enc` is set in ISM; returns `{ configured: boolean }`
- `getXTimeline(handle: string, count: number)` — two-phase:
  1. Resolve handle → userId: `GET https://api.x.com/2/users/by/username/:handle` (Redis key `x:user:{handle}`, TTL 24 h)
  2. Fetch tweets: `GET https://api.x.com/2/users/:id/tweets?max_results=:count&tweet.fields=created_at,public_metrics,entities` (Redis key `x:timeline:{userId}:{count}`, TTL 20 min)
- Both calls use `Authorization: Bearer <token>` from ISM
- Returns normalised `XPost[]`: `{ id, text, created_at, url, metrics: { replies, retweets, likes } }`

**`SocialController`**:
- `GET /social/x-timeline/status` — no auth required (owner already authenticated in editor context; non-owners can't insert nodes anyway)
- `GET /social/x-timeline?handle=xxx&count=N` — no auth; public page renderer calls this. Rate-limited via Redis cache — X API is never hit more than once per 20 min per handle.
- `PATCH /settings/social` — `system.configure.social` capability, filters `social.*` keys

### `SettingsService` additions

- Add `'social.x_bearer_token_enc': 'X_BEARER_TOKEN'` to `ENV_KEY_MAP`
- Add `system.configure.social` to the capability seed (Owner role only)
- Add `social.*` to the `PATCH /settings/social` endpoint key filter

---

## Frontend Design

### New TipTap extension

```
frontend/components/editor/extensions/x-timeline.tsx   ← XTimelineNode
```

**Attributes:** `handle` (string, default `''`), `count` (number, default 5), `show_when` (string, default `'always'`)

**Display extension** (live page):
```tsx
<ConditionalWidget showWhen={showWhen}>
  <XTimeline handle={handle} count={count} />
</ConditionalWidget>
```

**Editor extension**: renders the setup panel (if unconfigured) or handle/count form + live preview (if configured and handle is set). Hover overlay provides edit/delete buttons and `show_when` toggles — identical to `XEmbedNode`.

Register in `frontend/components/editor/extensions/index.ts` alongside `XEmbedNode`.

### New component

```
frontend/components/widgets/XTimeline/
  XTimeline.tsx          ← fetches /social/x-timeline, renders cards
  XTimelineCard.tsx      ← single tweet card
```

`XTimeline` fetches from `/api/social/x-timeline?handle=xxx&count=N` (Next.js API route that proxies to the backend). Renders skeleton cards while loading. On API error (handle not found, token expired) shows a non-intrusive inline message rather than breaking the page.

### Next.js API route

```
frontend/app/api/social/x-timeline/route.ts
frontend/app/api/social/x-timeline/status/route.ts
```

Both proxy to the NestJS backend, same pattern as the existing `/api/oembed/twitter/route.ts`.

### Settings page

Add a **Social** tab to `SettingsClient.tsx`:
- `system.configure.social` capability check (hide tab for non-owners)
- Single `SecretInput` for `social.x_bearer_token_enc`
- `SaveBar` on change

---

## Key Considerations

- **No user OAuth** — this uses App-only Bearer Token auth (read-only public timeline). No per-user tokens, no OAuth flow.
- **Public accounts only** — the X API v2 timeline endpoint only returns tweets from public accounts with App-only auth.
- **Cache on degraded Redis** — if Redis is unavailable, the backend falls through to a live X API call on every page load. This is acceptable for a low-traffic site but should be logged as a warning.
- **Handle vs. userId** — X API v2 prefers stable user IDs. The two-phase lookup (handle → ID → tweets) means a handle rename doesn't break existing nodes (the ID is re-resolved on next cache miss). The stored node attribute remains `handle` for human readability.
- **Cost guard** — the 20-min Redis TTL is the cost control mechanism. No request to the X API will occur more than 3×/hour per unique handle+count combination, regardless of page traffic.
- **First-use cancel** — if the owner cancels the setup panel, the node should be removed from the TipTap document cleanly (call `deleteSelection()` on the editor).
- **Settings tab visibility** — the Social tab in Admin Settings should be gated to owners only (same as Payments), since the bearer token is an account-level secret.
- **`show_when` on live page** — same ConditionalWidget pattern as `XEmbedNode`, `RssFeedNode`, etc. Members-only or guest-only tweet walls are valid use cases.

---

## Files to Create / Modify

```
backend/src/social/social.module.ts          — new
backend/src/social/social.controller.ts      — new
backend/src/social/social.service.ts         — new
backend/src/app.module.ts                    — import SocialModule
backend/src/settings/settings.service.ts     — add social.* to ENV_KEY_MAP
backend/src/settings/settings.controller.ts  — add PATCH /settings/social endpoint
backend/src/capabilities/capability.seed.ts  — add system.configure.social (Owner)

frontend/app/api/social/x-timeline/route.ts          — new Next.js proxy route
frontend/app/api/social/x-timeline/status/route.ts   — new
frontend/components/widgets/XTimeline/XTimeline.tsx   — new
frontend/components/widgets/XTimeline/XTimelineCard.tsx — new
frontend/components/editor/extensions/x-timeline.tsx  — new TipTap node
frontend/components/editor/extensions/index.ts        — register XTimelineNode
frontend/app/admin/settings/SettingsClient.tsx         — add Social tab
```

---

## Completion Report

> _Fill in after deployed._

**Deployed:** YYYY-MM-DD
**Commit(s):** `abc1234`

### What changed
_Summary of the actual implementation, noting any deviations from the plan above._

---

## Testing Guide

1. **First-use flow:** Insert XTimeline node → setup panel appears → enter a valid Bearer Token → Save → handle/count form appears → enter `@handle` → preview renders in editor.
2. **Subsequent use:** Insert a second XTimeline node on any page → setup panel is skipped → handle/count form appears immediately.
3. **Settings tab:** Admin Settings → Social → update the bearer token → save → existing XTimeline nodes on live pages pick up the new token on next cache miss (within 20 min).
4. **Cancel setup:** Insert node → click Cancel → node disappears from document.
5. **Live page rendering:** Publish a page with an XTimeline node → visit the public URL → tweet cards render → check Network tab to confirm the backend endpoint was hit, not the X API directly.
6. **Cache:** Reload the page multiple times → confirm the X API is not called on subsequent loads (check backend logs; Redis hit should be logged).
7. **Invalid handle:** Enter a non-existent handle → node shows an inline "Account not found" message without breaking the page.
8. **Expired/invalid token:** Set an invalid bearer token in ISM → open a page with an XTimeline node → widget shows a non-intrusive error, rest of page is unaffected.
9. **`show_when` gating:** Set a node to "Logged-in only" → verify it is hidden for guest visitors and visible for logged-in members.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Initial write-up; Option A (X API v2 paid) preferred |
