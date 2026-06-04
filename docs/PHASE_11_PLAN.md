# Phase 11: Pages — Widget-Composed Page Builder

**Project**: AECMS - Advanced Ecommerce Content Management System  
**Phase**: 11  
**Status**: 📋 PLANNED  
**PRD References**: `docs/prd/01-content-management.md § Pages`, `docs/prd/10-product-embedding.md`

---

## Goal

Deliver the Pages content type as a fully functional, widget-composed page builder. Pages are distinct from Articles and Products: they have no conventional content body — their content is entirely composed of widget blocks arranged in layout zones. Phase 11 also introduces the dual-size widget rendering system, which all existing widgets (and new embed widgets) participate in, plus protection against nested widget embedding.

---

## What's Already in Place

| Item | Status |
|------|--------|
| `Page` DB model (`id`, `title`, `slug`, `content`, `template`, `status`, `visibility`, `parent_id`, SEO fields, granular permission flags) | ✅ Schema + backend module exist |
| `PagesService` + `PagesController` (7 endpoints: CRUD, hierarchy, slug lookup) | ✅ Exists |
| Page template types documented: Default, Home, Landing Page, Split Comparison, Article List | ✅ PRD 01 spec |
| Split Comparison layout: 50/50, edge-to-edge, mobile stacks — CSS spec written | ✅ PRD 01 spec |
| Product embed large + small variants (card embed, inline embed) | ✅ PRD 10 spec |
| Widget system two-zone model (hero + body TipTap) | ✅ Phase 10B live |
| MediaCarousel, Callout, VideoEmbed, XEmbed — TipTap nodes + display components | ✅ Phase 10B live |

**What this phase adds:** the page layout engine (multi-zone JSON storage), the dual-size widget system, new ArticleEmbed and ProductEmbed TipTap nodes, small variants for every widget, nested embed protection, frontend routing, and the backstage page builder UI.

---

## Architecture: How Pages Work

### Layout Zones

A Page has a layout type that determines which zones exist and how they are sized:

| Layout | Zones | Main width | Sidebar/secondary |
|--------|-------|------------|-------------------|
| `no_sidebar` | `main` only | 100% | — |
| `sidebar_left` | `sidebar` + `main` | ~70% | ~30% left |
| `sidebar_right` | `main` + `sidebar` | ~70% | ~30% right |
| `split_comparison` | `left` + `right` | 50% | 50% |

Each zone holds an independent TipTap JSON document. The page is assembled by rendering each zone's document side-by-side according to the layout template.

### Content Storage

The `Page.content` field changes from a raw HTML/TipTap string to a structured JSON envelope:

```typescript
interface PageContent {
  layout: 'no_sidebar' | 'sidebar_left' | 'sidebar_right' | 'split_comparison';
  zones: {
    main?: TipTapDoc;      // no_sidebar, sidebar_left, sidebar_right
    sidebar?: TipTapDoc;   // sidebar_left, sidebar_right
    left?: TipTapDoc;      // split_comparison
    right?: TipTapDoc;     // split_comparison
  };
}
```

Each `TipTapDoc` is a standard TipTap JSON document (`{ type: 'doc', content: [...] }`). The same widget TipTap nodes used inside Articles and Products are reused here without modification.

### Widget Conditional Display

Every widget node carries an optional `show_when` attribute that controls whether the widget renders for the current viewer. This enables dynamic page composition — an author can place a "Sign in to order" callout and an adjacent product card in the same zone, with each set to display only to the appropriate audience. Only the relevant widget renders; the other produces no DOM output.

**Attribute values:**
- `'always'` (default) — renders for all viewers
- `'logged_in'` — renders only when a user session exists
- `'logged_out'` — renders only when no user session exists

**Implementation:**

A shared attribute definition is mixed into every widget node's `addAttributes()`:

```typescript
// frontend/components/editor/extensions/conditionalDisplay.ts
export const conditionalDisplayAttribute = {
  show_when: {
    default: 'always',
    parseHTML: el => el.getAttribute('data-show-when') ?? 'always',
    renderHTML: attrs => ({ 'data-show-when': attrs.show_when }),
  },
};
```

A single wrapper component handles the auth check client-side:

```tsx
// frontend/components/widgets/ConditionalWidget.tsx
export function ConditionalWidget({ showWhen, children }: { showWhen: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;                           // hold until auth resolves — no flash
  if (showWhen === 'logged_in'  && !user) return null;
  if (showWhen === 'logged_out' &&  user) return null;
  return <>{children}</>;
}
```

Every widget's display-mode render path wraps its output in `<ConditionalWidget showWhen={node.attrs.show_when}>`. In the backstage editor, the NodeView always renders the widget regardless of condition (the author needs to see all content), but shows a small badge — **"Members only"** or **"Guests only"** — when a non-default condition is set. The condition is set via a toggle in the same edit-overlay panel each widget already has, adding three radio options: Always / Members only / Guests only.

**Important: display convenience, not a security boundary.** The full page content, including conditionally-hidden widgets, is delivered to the browser as TipTap JSON. The `show_when` check runs entirely client-side. A motivated user inspecting page source could read the hidden widget's attributes. For genuinely private content, use the Page or Article `visibility: logged_in_only` server-side gate instead. Widget-level conditions are for *experience design* — showing contextually relevant UI to different audience segments — not for access control.

**Auth-state flash:** Because auth state is read from `localStorage` via the auth context, it resolves synchronously on the first render cycle in practice. The `loading` guard in `ConditionalWidget` handles the edge case where the context hasn't settled yet, ensuring nothing flickers.

**Future extension:** `show_when` can be extended to additional values (`'verified_purchaser'`, `'role_admin'`, arbitrary capability strings) without structural changes. The attribute and wrapper already support it — only new cases in the `ConditionalWidget` switch are needed.

### Widget Dual-Size System

Every widget renders in two sizes: **large** and **small**. The size is determined by *where the widget lives*, not by the widget itself.

```
Context               → Size
─────────────────────────────
main zone             → large
sidebar zone          → small
split left/right @ lg: → large
split left/right @ <lg → small
inline in Article/Product body → large
```

A React context (`WidgetSizeContext`) wraps each zone at render time, carrying its size. All widget display components read from this context via `useWidgetSize()`:

```typescript
type WidgetSize = 'large' | 'small';
const WidgetSizeContext = React.createContext<WidgetSize>('large');
export const useWidgetSize = () => React.useContext(WidgetSizeContext);
```

The split-comparison layout additionally uses a `useMediaQuery` hook to switch between large and small at the `lg` (1024px) breakpoint. This means a widget in the split layout renders large on desktop and small on mobile without any per-widget breakpoint logic.

In the TipTap editor (backstage), widgets always render in large mode so the author can see the full version.

---

## Sections

- **A** — Layout engine + Page schema update
- **B** — Widget sizing context system
- **C** — Small variants: existing widgets (MediaCarousel, Callout, VideoEmbed, XEmbed)
- **D** — ArticleEmbed widget (large + small + TipTap node)
- **E** — ProductEmbed widget (large + small + TipTap node)
- **F** — Nested embed protection
- **G** — RichTextBox widget
- **H** — Frontend: page routing + layout renderer
- **I** — Backend: page content zones API
- **J** — Backstage page builder UI
- **K** — Tests & verification

---

## Section A — Layout Engine + Page Schema Update

### A1 — Schema migration

The `Page.template` field (String, default `'full-width'`) is kept as-is — the layout is encoded inside the `content` JSON envelope and does not need a separate DB column. The existing `Page` model requires no migration.

> If a future design requires layout-level indexing or filtering, `template` can be backfilled. For now the content envelope carries the source of truth.

### A2 — `PageContent` TypeScript type

Add to `frontend/types/index.ts` and `backend/src/pages/types.ts`:

```typescript
export type PageLayout = 'no_sidebar' | 'sidebar_left' | 'sidebar_right' | 'split_comparison';

export interface PageContent {
  layout: PageLayout;
  zones: {
    main?: object;     // TipTap JSON doc
    sidebar?: object;
    left?: object;
    right?: object;
  };
}
```

### A3 — Zone helper utilities

`frontend/lib/pageContent.ts`:

```typescript
// Returns the zones expected for a given layout
export function getZonesForLayout(layout: PageLayout): (keyof PageContent['zones'])[]

// Returns true if content is a valid PageContent envelope
export function isPageContent(s: string): boolean

// Returns CSS class string for the layout wrapper
export function layoutContainerClass(layout: PageLayout): string
```

---

## Section B — Widget Sizing Context

### B1 — `WidgetSizeContext`

New file: `frontend/contexts/WidgetSizeContext.tsx`

```typescript
export type WidgetSize = 'large' | 'small';
export const WidgetSizeContext = React.createContext<WidgetSize>('large');

export function WidgetSizeProvider({ size, children }: { size: WidgetSize; children: React.ReactNode }) {
  return <WidgetSizeContext.Provider value={size}>{children}</WidgetSizeContext.Provider>;
}

export function useWidgetSize(): WidgetSize {
  return React.useContext(WidgetSizeContext);
}
```

### B2 — Split-comparison responsive switching

`frontend/hooks/useIsDesktop.ts` — returns `true` when viewport `>= 1024px` (Tailwind `lg` breakpoint), using `window.matchMedia`. Defaults to `true` on SSR.

The split-comparison zone renderer wraps each column:

```tsx
const isDesktop = useIsDesktop();
const size: WidgetSize = isDesktop ? 'large' : 'small';

<WidgetSizeProvider size={size}>
  <RichTextContent content={zone} />
</WidgetSizeProvider>
```

### B3 — Article and Product body zone

When `RichTextContent` is used inside an Article or Product detail page (not a Page), it renders with a default `WidgetSizeProvider size="large"` wrapper. This is the existing behavior — no change needed, but it should be documented.

---

## Section C — Small Variants: Existing Widgets

Each widget's display component reads `useWidgetSize()` and branches. No TipTap node changes are needed — the size decision is purely in the display layer.

### C1 — MediaCarousel small

**Large** (current): Full carousel with dot indicators, prev/next arrow buttons, image counter badge, keyboard navigation.

**Small**: Single-image display that auto-advances through images every 3 seconds. No controls visible (no arrows, no dots, no counter). Reduced height. Falls back to a static image if only one image.

```tsx
// Inside MediaGallery.tsx
const size = useWidgetSize();
if (size === 'small') {
  return <MediaCarouselSmall media={media} />;
}
```

`MediaCarouselSmall`: uses `useEffect` + `setInterval(3000)` to cycle the index. Single `<Image>` with `object-cover`. Cleans up interval on unmount.

### C2 — Callout small

**Large** (current): Bordered card with colored background, icon, and `NodeViewContent` / `children` for rich text body.

**Small**: Single-line horizontal pill. Icon (16px) + first line of text content only (truncated to ~80 chars). No background fill — left-border accent only.

```
ℹ  This is an important note that may be truncated here…
```

Implementation: in the Callout display component, if `size === 'small'`, extract the text content from `children` via a `ref` on a hidden div, then truncate. Alternatively, accept an optional `summary` prop that the TipTap node can populate from its first paragraph's text.

> TBD: the exact mechanism for extracting first-line text from React children in the small Callout. The simplest approach is to render the children in a visually-hidden div and read its `textContent`. Prototype and adjust during implementation.

### C3 — VideoEmbed small

**Large** (current): `aspect-video` iframe, full width of container.

**Small**: Static thumbnail image linking to the video. For YouTube, use `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`. For Vimeo, use the Vimeo oEmbed thumbnail endpoint. Clicking the thumbnail opens the video URL in a new tab (does not embed the iframe). A small play button overlay on the thumbnail.

### C4 — XEmbed small

**Large** (current): Full embedded tweet/post — Twitter `widgets.js` renders the full blockquote with avatar, account name, text, date, engagement counts.

**Small**: A compact card using real post data fetched via Twitter's public oEmbed endpoint — no API key required. Displays:
- **@handle** — extracted from the URL pattern `https://x.com/{handle}/status/{id}`
- **Author display name** — from oEmbed `author_name` field
- **Truncated post text** — extracted from oEmbed `html` field (strip HTML tags, take first ~120 chars)
- Small X logo icon
- "View on X ↗" link to the original URL
- No avatar, no engagement counts, no iframe

```
┌─────────────────────────────────────────┐
│ 𝕏  @WCCollier · WC Collier             │
│    "Post text truncated to about 120    │
│     characters here…"                  │
│    View on X ↗                         │
└─────────────────────────────────────────┘
```

**oEmbed Route Handler** — `frontend/app/api/oembed/twitter/route.ts`

Proxies requests to `https://publish.twitter.com/oembed?url={encodedUrl}` server-side (avoids CORS). Uses Next.js fetch caching with `next: { revalidate: 3600 }` so the oEmbed response is cached for 1 hour per URL — the upstream endpoint is called at most once per hour per unique post URL regardless of page view volume. Returns `{ author_name, author_url, html }`.

```typescript
// GET /api/oembed/twitter?url=https://x.com/handle/status/id
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return Response.json({ error: 'url required' }, { status: 400 });

  const res = await fetch(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return Response.json({ error: 'fetch failed' }, { status: 502 });
  const data = await res.json();
  return Response.json({ author_name: data.author_name, author_url: data.author_url, html: data.html });
}
```

**`XEmbed` small variant** fetches from this Route Handler via SWR when `size === 'small'`. Falls back gracefully to the handle-only stub (`"View post by @handle on X ↗"`) if the fetch fails or is loading, so the widget is never blank.

### C5 — Callout TipTap node update

The Callout TipTap node needs to propagate a `summary` attribute — the plain-text content of its first paragraph — so the small display can show a preview without reading DOM children. This attribute is auto-computed on every `onUpdate` in the NodeView and stored as a node attribute (not user-editable):

```typescript
addAttributes() {
  return {
    type: { default: 'info' },
    summary: { default: '' },  // auto-populated, not user-visible
  };
}
```

`CalloutNodeView` updates `summary` on blur: `editor.commands.updateAttributes('callout', { summary: nodeRef.current?.textContent?.slice(0, 100) ?? '' })`.

---

## Section D — ArticleEmbed Widget

### D1 — Display component: `ArticleEmbed`

`frontend/components/widgets/ArticleEmbed/ArticleEmbed.tsx`

Props: `{ articleId: string }`

Fetches article data client-side via SWR: `GET /articles/{id}` (public endpoint, no auth needed for public articles). Shows a skeleton while loading.

**Large variant:**
```
┌────────────────────────────────────────┐
│  [Featured image — 16:9 aspect ratio]  │
│                                        │
│  Category badge(s)                     │
│  Title (H3, linked to /latest/slug)    │
│  Published date                        │
│                                        │
│  First paragraph of article text       │
│  (stripped of widget nodes — see §F)   │
│                                        │
│  [Read more →]                         │
└────────────────────────────────────────┘
```

**Small variant:**
```
┌──────────────────────────────────────────┐
│ [img 80×80]  Title (linked, 2-line max)  │
│              Excerpt (1 line, truncated) │
│              [Read more →]              │
└──────────────────────────────────────────┘
```

The "first paragraph of article text" is derived by running `stripWidgetNodes()` (Section F) on the article's TipTap JSON, then extracting the text content of the first `paragraph` node.

### D2 — TipTap extension: `articleEmbed`

`frontend/components/editor/extensions/article-embed.tsx`

- `Node.create({ name: 'articleEmbed', group: 'block', atom: true })`
- Attribute: `articleId: string`
- `ArticleEmbedNodeView`: shows an article-picker search field when `articleId` is empty; renders `<ArticleEmbed articleId={...} />` when set; edit/remove overlay when not editing
- Toolbar button: newspaper icon; `insertArticleEmbed()` inserts node with empty `articleId` (triggers picker immediately)

### D3 — Article picker

A modal/panel that:
- Shows a searchable list of published articles (fetched from `GET /articles?status=published&limit=50`)
- Selecting an article sets the `articleId` attribute on the node

---

## Section E — ProductEmbed Widget

### E1 — Display component: `ProductEmbed`

`frontend/components/widgets/ProductEmbed/ProductEmbed.tsx`

Fetches: `GET /products/{id}`

**Large variant** (aligns with PRD 10 "Variant A: Card Embed"):
```
┌────────────────────────────────────────┐
│  [Featured image — square aspect]      │
│                                        │
│  Product name (H3, linked)             │
│  ★★★★☆  (N reviews)                   │
│  $39.99  ~~$49.99~~  (if on sale)      │
│  Stock status                          │
│                                        │
│  [Add to Cart]   [View Details →]     │
└────────────────────────────────────────┘
```

**Small variant** (aligns with PRD 10 "Variant B: Inline Embed", expanded slightly):
```
┌─────────────────────────────────────────┐
│ [img 64×64]  Name (linked, 2-line max)  │
│              $39.99                     │
│              [🛒]  [View →]            │
└─────────────────────────────────────────┘
```

Add-to-cart works from both variants (calls `useCart().addItem(productId, 1)`).

### E2 — TipTap extension: `productEmbed`

`frontend/components/editor/extensions/product-embed.tsx`

Same pattern as `articleEmbed`: atom node, `productId` attribute, picker panel, edit/remove overlay, toolbar button (shopping bag icon).

### E3 — Product picker

Same pattern as the article picker but fetches `GET /products?status=published&limit=50`.

---

## Section F — Nested Embed Protection

### F1 — `stripWidgetNodes(doc)`

`frontend/lib/stripWidgetNodes.ts`

```typescript
const WIDGET_NODE_TYPES = new Set([
  'mediaCarousel', 'callout', 'videoEmbed', 'xEmbed',
  'articleEmbed', 'productEmbed', 'image',
]);

export function stripWidgetNodes(doc: object): object {
  // Deep-clones the TipTap JSON doc, recursively removing any node
  // whose `type` is in WIDGET_NODE_TYPES.
  // Returns the cleaned doc.
}
```

### F2 — Usage in ArticleEmbed and ProductEmbed

When rendering the article/product content *inside* an embed widget (for the preview paragraph), pass the article's TipTap JSON through `stripWidgetNodes()` before extracting text. This prevents a MediaCarousel or XEmbed that appears early in the article from rendering inside the embed card.

```typescript
const cleanDoc = stripWidgetNodes(article.content);
const firstParagraph = extractFirstParagraphText(cleanDoc);
```

`extractFirstParagraphText` walks the cleaned doc and returns the text content of the first `paragraph` node (joining all `text` leaf nodes).

### F3 — No recursive rendering

`ArticleEmbed` and `ProductEmbed` never pass article/product content to `RichTextContent` for full rendering inside an embed. They only extract text. This is the architectural guarantee: widget content inside an embedded article is never rendered as HTML or TipTap in the embed card, only as a plain text excerpt.

---

## Section G — RichTextBox Widget

A RichTextBox is a styled content block that can be dropped into a page zone — it is the widget equivalent of "just write some text here," with an optional border/background treatment to visually distinguish it from surrounding zone content.

### G1 — Display component

`frontend/components/widgets/RichTextBox/RichTextBox.tsx`

- Large and small: renders identically — `<RichTextContent content={content} className="prose" />`
- Small variant adds a visual warning banner below if `content` has > 300 characters of text: "Long content may be hard to read in this display area."

### G2 — TipTap extension: `richTextBox`

`frontend/components/editor/extensions/rich-text-box.tsx`

**Architecture: `NodeViewContent`, not a nested editor.**

RichTextBox is a **non-atom node** with `content: 'block+'`. Its NodeView uses TipTap's `NodeViewContent` component — the same mechanism the Callout node already uses — rather than spawning a second `useEditor` instance inside the NodeView.

```typescript
Node.create({
  name: 'richTextBox',
  group: 'block',
  content: 'block+',   // non-atom: content managed by the outer editor
  defining: true,
})
```

```tsx
function RichTextBoxNodeView({ node, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="border border-border rounded-lg p-4 my-4">
      {editor.isEditable && (
        <div className="text-xs text-foreground/40 mb-2 select-none">Rich Text Box</div>
      )}
      <NodeViewContent className="prose" />  {/* outer editor manages this */}
    </NodeViewWrapper>
  );
}
```

`NodeViewContent` renders the node's actual ProseMirror content as an editable region owned by the outer editor. Keyboard events, focus, undo/redo, and cursor movement all go through the outer editor's transaction system. There are no two editors — there is one editor, and the NodeView provides the visual wrapper around the content TipTap was already going to render.

This is architecturally identical to Callout (which wraps `NodeViewContent` in a colored card). RichTextBox is essentially a Callout without the icon/type system — just a styled box with editable block content inside.

**Toolbar button:** `TextCursor` icon; `insertRichTextBox()` inserts `{ type: 'richTextBox', content: [{ type: 'paragraph' }] }`.

**`show_when` attribute:** included via `conditionalDisplayAttribute` like all other widget nodes.

---

## Section H — Frontend: Page Routing + Layout Renderer

### H1 — Route: `/[slug]`

New file: `frontend/app/(site)/[slug]/page.tsx`

This catch-all route matches any slug at the root level that doesn't match an existing route. Next.js route resolution order means the existing named routes (`/shop`, `/latest`, `/cart`, etc.) take precedence — the `[slug]` page only catches slugs not already claimed.

```typescript
// app/(site)/[slug]/page.tsx
export async function generateStaticParams() { return []; }  // fully dynamic

async function getPage(slug: string): Promise<Page | null> {
  // Fetches from GET /pages/slug/{slug} (public endpoint)
}

export default async function SlugPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();
  return <PageRenderer page={page} />;
}
```

### H2 — `PageRenderer`

`frontend/components/pages/PageRenderer.tsx` — client component

Parses `page.content` as `PageContent`. Renders the correct layout template based on `content.layout`.

```tsx
export function PageRenderer({ page }: { page: Page }) {
  const content = parsePageContent(page.content);
  switch (content.layout) {
    case 'no_sidebar':       return <NoSidebarLayout zones={content.zones} />;
    case 'sidebar_left':     return <SidebarLeftLayout zones={content.zones} />;
    case 'sidebar_right':    return <SidebarRightLayout zones={content.zones} />;
    case 'split_comparison': return <SplitComparisonLayout zones={content.zones} />;
  }
}
```

### H3 — Layout components

`frontend/components/pages/layouts/`

**`NoSidebarLayout`** — single column, full content width (max-w-3xl centered):
```tsx
<WidgetSizeProvider size="large">
  <RichTextContent content={zones.main} className="prose-page" />
</WidgetSizeProvider>
```

**`SidebarLeftLayout` / `SidebarRightLayout`** — CSS Grid or Flexbox, `lg:grid-cols-[280px_1fr]` / `lg:grid-cols-[1fr_280px]`, stacks on mobile:
```tsx
// Sidebar column
<WidgetSizeProvider size="small">
  <RichTextContent content={zones.sidebar} className="prose-sidebar" />
</WidgetSizeProvider>

// Main column
<WidgetSizeProvider size="large">
  <RichTextContent content={zones.main} className="prose-page" />
</WidgetSizeProvider>
```

**`SplitComparisonLayout`** — exactly as specified in PRD 01 (50vw each, edge-to-edge, stacks on mobile):
```tsx
const isDesktop = useIsDesktop();
const size: WidgetSize = isDesktop ? 'large' : 'small';
// Both columns use the same dynamically-chosen size
```

### H4 — Slug reservation

A protected list of slugs that cannot be used for Pages (reserved by the application):

```typescript
export const RESERVED_SLUGS = ['shop', 'latest', 'cart', 'checkout', 'account', 'order-confirmation', 'admin'];
```

The `PagesService.create()` and `PagesService.update()` methods validate against this list and throw `ConflictException` if a reserved slug is used.

---

## Section I — Backend: Page Content Zones API

### I1 — `PagesService` updates

The existing service stores and returns `content` as an opaque string. No changes needed on the service layer — it continues to store whatever JSON string it receives. The `PageContent` envelope is a frontend/API contract concern.

Add `GET /pages/slug/:slug` endpoint if not present (for frontend routing — fetches by slug instead of ID).

### I2 — DTO validation

`CreatePageDto` / `UpdatePageDto`: add `layout` field (`IsIn(['no_sidebar', 'sidebar_left', 'sidebar_right', 'split_comparison'])`). The `content` field remains a string. The page builder submits `JSON.stringify(pageContent)`.

### I3 — Slug reservation enforcement

Add a `RESERVED_SLUGS` constant to `PagesService`. Check in `create()` and `update()`:

```typescript
if (RESERVED_SLUGS.includes(slug)) {
  throw new ConflictException(`"${slug}" is reserved and cannot be used as a page slug`);
}
```

---

## Section J — Backstage Page Builder UI

### J1 — New page form: `NewPageClient`

`frontend/app/admin/pages/new/NewPageClient.tsx`

Step 1: Choose layout (visual card selector showing the four layout types with diagram icons).  
Step 2: Enter title (slug auto-generated).  
Step 3: The multi-zone editor (below).

### J2 — Multi-zone editor

`frontend/components/admin/PageZoneEditor.tsx`

Renders one TipTap editor per zone for the chosen layout. Zone labels:
- `no_sidebar`: single editor labelled "Page Content"
- `sidebar_left` / `sidebar_right`: two editors side-by-side, labelled "Main Content" and "Sidebar"
- `split_comparison`: two editors labelled "Left Panel" and "Right Panel"

Each editor uses `getEditorExtensions()` (all widget nodes available). The toolbar is the same as the article/product editor, including all widget insert buttons.

The sidebar and right/left-panel editors show a visual hint: "Content here renders in compact (small) widget mode." The main editor shows no hint.

### J3 — Widget size preview toggle

A toggle button in the page builder: "Preview small widgets" — switches all editors to render widgets in their small variant so the author can see how sidebar content will look. This is done by temporarily wrapping editors in `<WidgetSizeProvider size="small">` when the toggle is on.

### J4 — Pages list: `/admin/pages`

Table: title, slug, layout, status, last updated, Edit / Delete actions. Same pattern as the articles list page.

### J5 — Edit page: `/admin/pages/[id]/edit`

Loads existing `PageContent`, renders `PageZoneEditor` pre-populated. Layout change allowed (shows confirmation: "Changing layout will preserve Main/Left content but may discard sidebar/right content").

---

## Section K — Tests & Verification

### Backend unit tests
- `PagesService`: reserved slug throws `ConflictException`; `GET /pages/slug/:slug` returns correct page; `content` round-trips correctly as JSON string

### Frontend unit tests
- `stripWidgetNodes`: removes all widget node types; leaves paragraphs, headings, lists intact; handles nested content; handles empty doc
- `extractFirstParagraphText`: returns correct text from cleaned doc
- `parsePageContent`: handles valid `PageContent` JSON; gracefully returns default for invalid/legacy content
- `getZonesForLayout`: returns correct zone keys per layout
- `WidgetSizeContext`: provider sets value; consumer reads correct size

### Manual verification
- [ ] Create page with `no_sidebar` layout → renders at `/{slug}`, full-width, all widgets render large
- [ ] Create page with `sidebar_left` → main zone large, sidebar zone small; widgets in sidebar show small variants
- [ ] Create page with `split_comparison` → desktop: large widgets; mobile (≤1024px): small widgets; stacks vertically
- [ ] ArticleEmbed in a page → shows featured image + first paragraph (stripped of nested widgets); small variant shows thumbnail + excerpt
- [ ] ProductEmbed in a page → shows image + name + price + Add to Cart; small variant shows compact card
- [ ] Article whose first content block is a MediaCarousel → when embedded via ArticleEmbed, carousel does not appear; only text content shown
- [ ] XEmbed small variant → shows `@handle` and "View on X" link, no iframe loaded
- [ ] MediaCarousel small variant → auto-rotates, no controls
- [ ] Callout small variant → single-line pill with icon and truncated text
- [ ] VideoEmbed small → thumbnail with play overlay, no iframe
- [ ] Reserved slug (`shop`, `admin`, etc.) → create/update returns 409
- [ ] Slug that conflicts with existing page → 409
- [ ] `/admin/pages` list loads, create/edit/delete work
- [ ] Layout change in page editor → confirmation prompt; content preserved in main zone

---

## Files to Create

### Frontend — new
| File | Purpose |
|------|---------|
| `contexts/WidgetSizeContext.tsx` | `WidgetSize` context + provider + hook |
| `hooks/useIsDesktop.ts` | `matchMedia` hook for `>= 1024px` |
| `lib/stripWidgetNodes.ts` | Removes widget nodes from TipTap JSON |
| `lib/pageContent.ts` | `parsePageContent`, `getZonesForLayout`, `layoutContainerClass` |
| `components/widgets/ArticleEmbed/ArticleEmbed.tsx` | Large + small display |
| `components/widgets/ProductEmbed/ProductEmbed.tsx` | Large + small display with cart action |
| `components/widgets/RichTextBox/RichTextBox.tsx` | Display + character-count warning |
| `components/editor/extensions/article-embed.tsx` | TipTap node + NodeView + article picker |
| `components/editor/extensions/product-embed.tsx` | TipTap node + NodeView + product picker |
| `components/editor/extensions/rich-text-box.tsx` | TipTap node + nested editor NodeView |
| `components/pages/PageRenderer.tsx` | Layout dispatcher |
| `components/pages/layouts/NoSidebarLayout.tsx` | Single-column layout |
| `components/pages/layouts/SidebarLeftLayout.tsx` | Main + left sidebar layout |
| `components/pages/layouts/SidebarRightLayout.tsx` | Main + right sidebar layout |
| `components/pages/layouts/SplitComparisonLayout.tsx` | 50/50 split layout |
| `components/admin/PageZoneEditor.tsx` | Multi-zone TipTap editor for page builder |
| `app/(site)/[slug]/page.tsx` | Dynamic slug routing |
| `app/admin/pages/page.tsx` | Pages list |
| `app/admin/pages/new/page.tsx` + `NewPageClient.tsx` | Create page |
| `app/admin/pages/[id]/edit/page.tsx` + `EditPageClient.tsx` | Edit page |

### Frontend — modified
| File | Change |
|------|--------|
| `components/widgets/MediaGallery/MediaGallery.tsx` | Small auto-rotate variant via `useWidgetSize()` |
| `components/widgets/Callout/Callout.tsx` | Small pill variant via `useWidgetSize()` |
| `components/widgets/VideoEmbed/VideoEmbed.tsx` | Small thumbnail variant |
| `components/widgets/XEmbed/XEmbed.tsx` | Small static-card variant |
| `components/widgets/index.ts` | Add `ArticleEmbed`, `ProductEmbed`, `RichTextBox` exports |
| `components/editor/extensions/index.ts` | Add `ArticleEmbedNode`, `ProductEmbedNode`, `RichTextBoxNode` |
| `components/editor/extensions/callout.tsx` | Add `summary` auto-attribute |

### Backend — modified
| File | Change |
|------|--------|
| `src/pages/pages.service.ts` | Reserved slug check; `findBySlug()` method |
| `src/pages/pages.controller.ts` | `GET /pages/slug/:slug` endpoint |
| `src/pages/dto/create-page.dto.ts` | Add `layout` field validation |

---

## What Is Deferred

| Item | Reason |
|------|--------|
| **Landing Page** (parallax, full-screen sections, animated backgrounds) | Different editing paradigm from the zone/document model — stacked full-viewport sections with per-section backgrounds and scroll behavior. Isolated enough to ship as its own phase once core pages are stable. Implementing it before the zone infrastructure is settled risks having to rework it. |
| **Article List / Product Showcase** (dynamic widgets with live query params) | Different shape from all other widgets — stores filter parameters rather than content IDs, and executes a live API fetch at render time. Deferred until the page editing infrastructure is more nailed down; adding them later is a self-contained extension that won't require touching existing widget or zone code. |
| Page hierarchy (parent/child) display + navigation | Schema exists; admin tree UI and breadcrumb nav deferred |
| Drag-and-drop reorder of widgets within a zone | TipTap handles this via its built-in node dragging; evaluate after baseline ships |
| **Cross-zone drag** — dragging a widget from one zone to another (e.g. main → sidebar) | Zones are independent TipTap documents; cross-zone drag would require extracting node JSON from one editor and inserting into another. Not a native operation. Phase 11 supports cut/paste between zones only. Future enhancement. |
| Custom HTML pane | Security review required; deferred |
| Page version history | Phase 12 scope (applies to Pages too, extending Phase 12 plan) |

---

## PRD Updates Required (after plan approval)

- `docs/prd/01-content-management.md § Pages` — rewrite the Pages section to reflect multi-zone architecture, the four layout types with `WidgetSizeContext`, and the full widget list (adding ArticleEmbed, ProductEmbed, RichTextBox to the planned widgets table)
- `docs/prd/01-content-management.md § Widget System` — add dual-size system spec, `stripWidgetNodes` protection rule
- `docs/prd/10-product-embedding.md` — reconcile ProductEmbed large/small variants with what's specified here; note that the TipTap node approach supersedes the shortcode/markdown insertion methods in the original PRD for body-content embeds

---

## Success Criteria

1. A published Page at slug `my-page` renders at `/my-page` with the correct layout template
2. Reserved slugs (`shop`, `admin`, etc.) are rejected with a 409 on create/update
3. Widgets in a sidebar zone always render in their small variant; widgets in a main zone always render large
4. Widgets in split-comparison zones render large on `>= 1024px` and small on mobile
5. ArticleEmbed never shows a nested widget inside the article preview — only text
6. MediaCarousel small variant auto-rotates and shows no controls
7. XEmbed small variant shows account handle and link, never loads `widgets.js`
8. The backstage page builder allows creating and editing pages with all four layouts
9. All new frontend unit tests pass; existing 90 pass
10. Backend: `GET /pages/slug/:slug` returns correct page; reserved slug check works
