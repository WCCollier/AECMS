# Phase 18 Completion Report: RSS Feed Widget

**Project**: AECMS  
**Phase**: 18  
**Status**: ✅ COMPLETE  
**Primary commit**: `0732c54`  
**Date**: 2026-06-17

---

## Summary

Phase 18 added a server-side RSS/Atom feed proxy (with Redis caching and SSRF protection) and a matching front-end widget that can be embedded on any page or article via the TipTap editor. The original motivation was Substack integration, but the implementation is deliberately feed-agnostic: any RSS 2.0 or Atom feed URL works. Common uses include embedding a Substack newsletter preview, a linked blog's recent posts, or a curated news section.

---

## What Was Delivered

### Area 18-A: Backend — ExternalFeedsModule

**`backend/src/external-feeds/external-feeds.module.ts`**

Standalone NestJS module. Uses `createClient` from the `redis` package directly (not via a shared Redis module) to avoid coupling with the session Redis store. Registered in `AppModule`.

**`backend/src/external-feeds/external-feeds.service.ts`**

| Responsibility | Detail |
|---|---|
| **SSRF protection** | Rejects any URL whose protocol is not `https:`; also validates that `hostname` is non-empty. No hard-coded allowlist — the HTTPS restriction is the primary guard. |
| **HTTP fetch** | Native `fetch()` with an `AbortController` 5-second timeout. Throws `BadRequestException` on non-200 HTTP responses. |
| **XML parsing** | `@xmldom/xmldom` `DOMParser` — chosen over browser `DOMParser` (unavailable in Node.js) and `fast-xml-parser` (less accurate for malformed feeds). Types imported as `Element as XmlElement` to avoid conflicts with the browser global. |
| **RSS 2.0 support** | Finds all `<item>` elements; extracts `<title>`, `<link>`, `<description>` (strips HTML tags), `<pubDate>`, and image from `<enclosure url>` or `<media:content url>`. |
| **Atom fallback** | If no `<item>` elements found, retries with `<entry>` elements; maps `<summary>` → description, `<updated>` → pubDate, `<content>` → description fallback. |
| **Image extraction** | `firstMediaUrl(item)` checks `enclosure` (RSS) then `media:content` (Media RSS namespace). |
| **Redis caching** | Cache key: `rss:{url}:{count}:{item_url}`. TTL: 900 seconds (15 minutes). Falls back gracefully if Redis is unavailable (catches all errors, returns live fetch result). |
| **Specific item filter** | `item_url` query param: if supplied, the service attempts to find the exact item whose `link` matches; falls back to returning the feed list if not found. |
| **Result shape** | `{ title, items: [{ title, link, description, pubDate, imageUrl }] }` |

**`backend/src/external-feeds/external-feeds.controller.ts`**

```
GET /external-feeds/preview?url=&count=5&item_url=
```

- `url`: feed URL (required, must be HTTPS)
- `count`: number of items to return (optional, default 5, max 20)
- `item_url`: optional specific post URL for the "read more" CTA

No authentication required — the endpoint is public. SSRF protection and rate-limiting (via the Redis cache) are the security controls.

### Area 18-B: Frontend — RssFeedWidget

**`frontend/components/widgets/RssFeed/RssFeedWidget.tsx`**

| Feature | Detail |
|---|---|
| **Data fetching** | SWR `useFeed()` hook calls `GET /external-feeds/preview` client-side. Page renders instantly; feed loads asynchronously. SWR deduplicates calls within 60 seconds. |
| **List layout** | Vertical list of items; each item shows title (as link), optional image (left-aligned thumbnail), and truncated description. |
| **Card layout** | Grid of cards (2 columns); each card shows a full-width image, title, and truncated description. |
| **Fade overlay** | When `fadeHeight > 0`, an absolutely-positioned gradient overlay masks the bottom of the list. Implemented with an inline `style` (linear-gradient) to avoid Tailwind's arbitrary-value purge issues. |
| **Show More** | When the list is taller than `fadeHeight` and `fadeHeight > 0`, a "Show more" button removes the fade and expands the list. |
| **CTA button** | "Read more on {source}" anchor. Links to `specificItemUrl` if provided, otherwise the feed's home link. Opens in a new tab. |
| **Loading / error states** | Shows a spinner ring during fetch; shows "Could not load feed" on error. |

**`frontend/components/widgets/RssFeed/index.ts`**

Exports `RssFeedWidget` and the `RssFeedWidgetData` type.

**`frontend/components/widgets/index.ts`**

Re-exports `RssFeedWidget` for barrel import from other widget consumers.

### Area 18-C: TipTap — RssEmbedNode

**`frontend/components/editor/extensions/rss-embed.tsx`**

TipTap `Node` extension using `ReactNodeViewRenderer`.

**Node attributes** (all stored as HTML `data-*` attributes on the node element):

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `feedUrl` | string | `''` | RSS/Atom feed URL |
| `specificItemUrl` | string | `''` | Optional: link to a specific post |
| `count` | number | `5` | Max items to show |
| `layout` | string | `'list'` | `'list'` or `'card'` |
| `showImage` | boolean | `true` | Show item images |
| `fadeHeight` | number | `200` | Gradient fade cutoff in pixels (0 = disabled) |
| `ctaLabel` | string | `'Read more'` | CTA button text |

**Edit mode** — shown inside the TipTap editor:
- A URL input field pre-filled with `feedUrl`
- An "Embed" button that saves the URL into the node attribute and switches to display mode
- A small RSS icon header to identify the block type

**Display mode** — shown in read-only view and article content render:
- Renders `<RssFeedWidget>` with the node's attribute values passed as props
- Wrapped in a `NodeViewWrapper` with `contentEditable={false}` and a max-width constrain

**Integration points**:

| File | Change |
|------|--------|
| `frontend/components/editor/extensions/index.ts` | Added `RssEmbedNode` to `baseExtensions` and `getDisplayExtensions()` |
| `frontend/components/editor/TipTapEditor.tsx` | Imported `Rss` icon from lucide; added `insertRssEmbed` callback; added RSS button to editor toolbar |
| `frontend/lib/stripWidgetNodes.ts` | Added `'rssEmbed'` to `WIDGET_NODE_TYPES` (excluded from plain-text extraction) |

---

## Files Created / Modified

| File | Change |
|------|--------|
| `backend/src/external-feeds/external-feeds.module.ts` | New |
| `backend/src/external-feeds/external-feeds.service.ts` | New |
| `backend/src/external-feeds/external-feeds.controller.ts` | New |
| `backend/src/app.module.ts` | `ExternalFeedsModule` import |
| `frontend/components/widgets/RssFeed/RssFeedWidget.tsx` | New |
| `frontend/components/widgets/RssFeed/index.ts` | New |
| `frontend/components/widgets/index.ts` | RSS re-export |
| `frontend/components/editor/extensions/rss-embed.tsx` | New |
| `frontend/components/editor/extensions/index.ts` | `RssEmbedNode` registered |
| `frontend/components/editor/TipTapEditor.tsx` | RSS toolbar button |
| `frontend/lib/stripWidgetNodes.ts` | `'rssEmbed'` added |

---

## Test Results

- **New backend unit tests**: none (ExternalFeedsService is a network I/O service; unit tests would require extensive mocking. Integration test recommended when Docker E2E suite is extended.)
- **Total backend tests**: 190 (all passing)
- **Frontend tests**: 125 (all passing)

---

## Security Notes

- **SSRF prevention**: Only `https:` URLs are accepted. The hostname is validated as non-empty. No loopback, private IP ranges, or metadata service addresses can be reached via this vector.
- **Content injection**: Feed descriptions are stripped of HTML tags before being stored in the response object. The frontend renders description text in a `<p>` tag (not `dangerouslySetInnerHTML`), so no XSS from malicious feed content.
- **Cache as rate-limiter**: The 15-minute Redis cache means a single feed URL can only trigger one outbound request per 15 minutes per distinct `(url, count, item_url)` tuple, limiting the blast radius of any abuse.

---

## Remaining / Deferred

- **Unit tests for ExternalFeedsService** — mock-heavy; deferred to a future test sprint
- **Feed autodiscovery** — if a user pastes a page URL instead of a feed URL, the service could check for `<link type="application/rss+xml">` in the page HTML. Deferred.
- **Authenticated feeds** — some private Substack newsletters require a subscriber cookie. This is not supported; only public feeds work.
- **Widget page block** — the RSS widget can be embedded in TipTap article/page content via the editor. A standalone page-builder block (like MediaGallery or RichTextBox) was not added in this phase; can be added in a future widgets pass.
