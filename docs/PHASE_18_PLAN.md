# Phase 18: Substack Integration Widget

**Project**: AECMS  
**Phase**: 18  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 10B (Widget system — inline nodes), Phase 11 (Page builder)

---

## Goal

Add a widget type — usable in both the page builder and (optionally) as a TipTap inline node in articles — that fetches and displays a preview of one or more posts from a Substack publication, with a height-capped fade and a "Continue Reading on Substack" call-to-action button.

---

## Background: What Substack Exposes

Substack does **not** have a public API. What is available:
- **RSS feed**: `https://{publication}.substack.com/feed` — standard Atom/RSS 2.0 XML. Contains: title, link, description (HTML excerpt or full body depending on publication settings), author, pubDate, enclosures (images).
- **Embed iframes**: Substack provides an `<iframe>` embed code for individual posts but these are limited in styling.
- **OEmbed**: Not standard; Substack does not implement the oEmbed discovery spec.

**Conclusion**: RSS is the correct integration point. It gives us full control over styling and works without API keys.

---

## Part A — Backend: RSS Fetcher + Cache

### A1 — New endpoint: `GET /external-feeds/preview`

Query params:
- `url` — the RSS feed URL (e.g., `https://wccollier.substack.com/feed`)
- `count` — number of items to return (default 3, max 10)
- `item_id` — (optional) return a specific item by GUID/link for a "pinned post" widget

Response shape:
```json
{
  "feed_title": "W.C. Collier on Substack",
  "feed_url": "https://wccollier.substack.com",
  "items": [
    {
      "title": "The Article Title",
      "url": "https://wccollier.substack.com/p/the-article-title",
      "published_at": "2026-06-10T12:00:00Z",
      "excerpt": "The first few hundred characters of the post body, HTML stripped...",
      "image_url": "https://..." // from enclosure or og:image if fetched
    }
  ]
}
```

### A2 — Caching

Fetching an RSS feed on every page render would be slow and could get rate-limited. Cache in Redis with configurable TTL.

**Cache key**: `external_feed:{hash_of_url}`  
**TTL**: 15 minutes default (configurable per widget instance in the future)

Cache miss → fetch RSS URL → parse XML → strip HTML from description → store in Redis → return.

**Implementation**: Use `fast-xml-parser` or Node's built-in XML parser to parse the RSS. Do not use `node-html-parser` for the description field — just strip all HTML tags with a regex or `striptags` package to get a plain text excerpt.

### A3 — Security

The `url` parameter is a server-side fetch. To prevent SSRF (Server-Side Request Forgery):
- Validate that the URL is `https://` only
- Validate that the hostname ends with `.substack.com` OR is in an owner-managed allowlist stored in settings
- Do not follow redirects that change the domain
- Set a 5-second fetch timeout

The allowlist approach is better long-term: lets the owner add their own domains (for personal newsletters or other RSS sources) without being locked to Substack.

### A4 — Module location

Add to an `ExternalFeedsModule` (`backend/src/external-feeds/`). This keeps it separate from the widget system — the widget system calls this service, but the service itself is generic.

No DB table needed for Phase 18 (the feed URL is stored in the widget's JSON data, and the cache lives in Redis). A future phase could add a `FeedSubscription` table for scheduled pre-warming.

---

## Part B — Frontend Widget

### B1 — Widget type: `SubstackFeed`

New widget type alongside the existing `MediaCarousel`, `Callout`, `VideoEmbed`, `XEmbed` types. Widget data structure:

```typescript
interface SubstackFeedWidgetData {
  feedUrl: string;           // e.g., "https://wccollier.substack.com/feed"
  count: number;             // 1–5 posts
  layout: 'list' | 'card';  // card = grid cards; list = stacked rows
  showImage: boolean;        // show post image/thumbnail
  fadeHeight: number;        // px cutoff for the fade (default 200)
  ctaLabel: string;          // button label (default "Continue Reading on Substack")
  specificItemUrl?: string;  // pin a specific post instead of showing latest
}
```

### B2 — Widget renderer

**Fade effect**: A `<div>` with `max-height: {fadeHeight}px; overflow: hidden; position: relative;` and a pseudo-element or a sibling `<div>` with a gradient overlay (`background: linear-gradient(transparent, var(--background))`). Below the faded content: the CTA button.

```tsx
function SubstackFeedWidget({ data }: { data: SubstackFeedWidgetData }) {
  const { feedData, isLoading } = useFeed(data.feedUrl, data.count);
  
  return (
    <div className="relative">
      <div style={{ maxHeight: data.fadeHeight, overflow: 'hidden' }}>
        {/* Post previews */}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      <div className="flex justify-center mt-2">
        <a href={data.feedUrl.replace('/feed', '')} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">{data.ctaLabel}</Button>
        </a>
      </div>
    </div>
  );
}
```

The fade overlay should be rendered as a sibling positioned absolutely over the content div, not a pseudo-element (Tailwind can't generate pseudo-elements dynamically).

### B3 — Data fetching strategy

**Option A — SSR (server component fetches from backend)**:
The page or article that contains the widget is server-rendered; the RSS data is fetched server-side via the backend `/external-feeds/preview` endpoint and embedded in the initial HTML. No loading spinner; no client-side fetch.

**Pros**: Best performance; content is in initial HTML for SEO.  
**Cons**: Adds fetch latency to page SSR; if Substack is down, the page itself is slowed.

**Option B — Client-side SWR fetch** (recommended):
The widget renders a placeholder on load and fetches from `/external-feeds/preview` via SWR. The backend serves cached data (usually from Redis, very fast). 

**Pros**: Page renders instantly; Substack outage doesn't affect page load; easy to implement.  
**Cons**: Brief loading state; content not in initial HTML (doesn't matter for SEO if it's supplementary).

Recommendation: Use Option B. The widget is supplementary content, not primary SEO content.

### B4 — Widget config panel (in page builder)

In the backstage page builder, the widget config panel (the drawer that opens when you click a widget) should have:
- **Feed URL** — text input with placeholder `https://yourname.substack.com/feed`
- **Number of posts** — number input (1–5)
- **Layout** — select: List / Cards
- **Show image** — toggle
- **Fade height** — number input (px)
- **CTA label** — text input
- **Pin specific post** — toggle; when on, shows a URL input for the specific post URL

### B5 — Inline TipTap node (optional)

If you want the widget to also be embeddable inside article body text (as a TipTap node), add a `SubstackEmbed` node type similar to the existing `VideoEmbed` or `XEmbed` nodes. The data would be the same structure; the rendering would be narrower (constrained to article body width). This is a low-effort addition once the standalone widget exists.

---

## Part C — Generalization: RSS Widget

The same widget can be generalized beyond Substack. If you expand to other newsletters or external blogs, the `feedUrl` just points to a different RSS feed. The backend allowlist controls which external domains are permitted. Name the widget "RSS Feed" or "Newsletter Preview" in the backstage to make it clear it's not Substack-only.

Future feed sources this would support:
- Substack publications
- Medium RSS feeds
- Any personal blog with RSS
- Podcast feeds (though audio rendering is a separate feature)
- YouTube channel RSS feeds

---

## Implementation Order

1. `ExternalFeedsModule` — backend service + Redis caching + SSRF validation
2. `GET /external-feeds/preview` endpoint
3. Frontend `useExternalFeed(url, count)` SWR hook
4. `SubstackFeedWidget` renderer component
5. Widget registration in the page builder widget picker
6. Backstage config panel for the widget
7. (Optional) TipTap inline node

Estimated effort: 2–3 days for the full implementation.

---

## Open Questions for Owner

1. **Scope**: RSS-only (Substack), or general RSS from any URL (with allowlist)? General is barely more work and more useful long-term.
2. **Layout preference**: Do you want multiple posts stacked with fades on each, or a single-post feature preview? Single-post with a strong CTA is simpler and often more effective.
3. **SEO**: Is it important that the Substack preview content appear in Google's index of your site? If so, we should use Option A (SSR). If it's supplementary, Option B (client-side SWR) is fine.
4. **"Continue reading" destination**: Should the CTA open the full Substack post in a new tab, or link to your Substack profile/index page? Probably the individual post URL for a specific-post widget; the publication home for a "latest posts" widget.
