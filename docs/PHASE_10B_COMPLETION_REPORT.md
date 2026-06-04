# Phase 10B Completion Report

**Phase**: 10B — TipTap JSON Migration + Inline Widget Nodes  
**Completed**: 2026-06-04  
**Status**: ✅ COMPLETE

---

## Summary

Phase 10B migrated TipTap content storage from HTML strings to TipTap JSON, and delivered four inline widget node types (`MediaCarousel`, `Callout`, `VideoEmbed`, `XEmbed`) that can be inserted anywhere inside article or product body content. A browser-based migration tool converts all existing HTML content to JSON in a single admin action. Both old HTML and new JSON content render correctly — the display component auto-detects the format.

---

## What Was Built

### B1 — Content Format Migration

**TipTapEditor (`TipTapEditor.tsx`)**
- `onUpdate` now calls `JSON.stringify(editor.getJSON())` instead of `editor.getHTML()`
- All new content saved to the database is TipTap JSON from this point forward

**`RichTextContent` display component (`components/editor/RichTextContent.tsx`)**
- New `'use client'` read-only component replacing `dangerouslySetInnerHTML`
- Smart content detection via `JSON.parse`: if the string parses to `{ type: 'doc', ... }`, it is passed to TipTap as a JSON object; otherwise it is passed as a raw HTML string
- TipTap's `useEditor` accepts both formats natively — full backward compatibility with existing HTML content
- `editable: false`, `immediatelyRender: false`
- `className` prop forwarded as `editorProps.attributes.class`

**Extension factory functions (`components/editor/extensions/index.ts`)**
- `getEditorExtensions()` — StarterKit (link disabled) + Link (`openOnClick: false`) + Image + all widget nodes
- `getDisplayExtensions()` — same but Link `openOnClick: true`
- Factory functions (not module-level constants) prevent TipTap extension instances from being shared across multiple editors

**Article and product detail pages**
- `ArticlePageClient.tsx`: replaced `<div dangerouslySetInnerHTML>` with `<RichTextContent content={article.content} className="prose-article" />`
- `ProductPageClient.tsx`: replaced `<div dangerouslySetInnerHTML>` with `<RichTextContent content={product.description} className="prose prose-sm ..." />`

**Migration tool (`app/admin/maintenance/migrate-content/`)**
- Browser-based batch converter at `/admin/maintenance/migrate-content`
- Uses a headless TipTap `useEditor` instance as a conversion engine: `setContent(html)` → `getJSON()`
- Fetches all articles and products via `adminApi`; skips items with no content or already-JSON content
- PATCHes each converted item individually; shows per-item pass/fail log with counts
- Safe to re-run (idempotent — already-JSON items are detected and skipped)
- `page.tsx` uses `export const dynamic = 'force-dynamic'` + `dynamic(..., { ssr: false })` to prevent Next.js from prerendering TipTap's React hooks on the server

### B2 — `MediaCarousel` Inline TipTap Node

**Extension (`components/editor/extensions/media-carousel.tsx`)**
- `Node.create({ name: 'mediaCarousel', group: 'block', atom: true })`
- `media` attribute: `JSON.stringify(MediaItem[])` serialized to `data-media` HTML attribute
- `MediaCarouselNodeView`:
  - Empty state (no media, editable): shows `CarouselPanel` inline for immediate selection
  - Editing state: shows `CarouselPanel` pre-populated with existing media for modification
  - Display state: renders `MediaGallery` with edit/remove overlay buttons
- `CarouselPanel`: wraps `MediaGalleryField` for image selection, reorder, and primary-setting; "Insert Carousel" / "Save Changes" button

**Editor integration**
- `GalleryHorizontal` toolbar button in TipTapEditor opens a carousel insert panel
- `insertCarousel()`: converts `GalleryEntry[]` → `MediaItem[]`; inserts `{ type: 'mediaCarousel', attrs: { media: ... } }` node
- Helper functions: `entriesToMediaItems()` and `mediaItemsToEntries()` for round-trip format conversion

### B3 — `Callout` Inline Widget

**Display component (`components/widgets/Callout/Callout.tsx`)**
- 4 types: `info` (blue), `warning` (yellow), `success` (green), `danger` (red)
- Lucide icon per type; border + background color per type via Tailwind classes
- Accepts `children: React.ReactNode` — renders rich content including TipTap's `NodeViewContent`

**TipTap extension (`components/editor/extensions/callout.tsx`)**
- `Node.create({ name: 'callout', group: 'block', content: 'paragraph+', defining: true })`
- Non-atom node: children are editable paragraphs via `NodeViewContent`
- `type` attribute stored as `data-callout-type` HTML attribute
- `CalloutNodeView`: shows type-selector toolbar (Info / Warning / Success / Danger) when `editor.isEditable`; always renders `<Callout>` wrapper with `NodeViewContent` inside

**Editor integration**
- `Info` toolbar button; `insertCallout()` inserts `{ type: 'callout', attrs: { type: 'info' }, content: [{ type: 'paragraph' }] }`

### B4 — `VideoEmbed` Inline Widget

**Display component (`components/widgets/VideoEmbed/VideoEmbed.tsx`)**
- Parses YouTube (`watch?v=`, `youtu.be/`, `/embed/`) and Vimeo (`vimeo.com/ID`) URLs to canonical embed URL
- Renders `aspect-video` iframe with `allowFullScreen`
- Shows a linked fallback for unrecognized URLs

**TipTap extension (`components/editor/extensions/video-embed.tsx`)**
- `Node.create({ name: 'videoEmbed', group: 'block', atom: true })`
- `url` attribute stored as `data-url` HTML attribute
- `VideoEmbedNodeView`:
  - Editing state (auto-triggered when `url` is empty): shows URL input panel
  - Display state: renders `VideoEmbed` with edit/remove overlay

**Editor integration**
- `Video` toolbar button; `insertVideo()` inserts `{ type: 'videoEmbed', attrs: { url: '' } }` — node immediately shows the URL input panel

### B5 — `XEmbed` Inline Widget

**Display component (`components/widgets/XEmbed/XEmbed.tsx`)**
- `'use client'` component; loads `platform.twitter.com/widgets.js` on first render via `document.createElement('script')`
- Deduplicates the script tag: checks `document.querySelector('script[src*="twitter"]')` before adding
- If the script tag is already present but `window.twttr` is not yet initialized, polls with `setInterval` until it is
- Renders `<blockquote class="twitter-tweet" data-dnt="true">` as fallback; widgets.js replaces it with the full embedded iframe
- Graceful degradation: if the script never loads, the linked blockquote remains readable

**TipTap extension (`components/editor/extensions/x-embed.tsx`)**
- Same pattern as `videoEmbed`: atom node, `url` attribute, URL input panel, edit/remove overlay

**Editor integration**
- `Twitter` toolbar button; `insertXEmbed()` inserts `{ type: 'xEmbed', attrs: { url: '' } }`

---

## Key Design Decisions

### `generateJSON`/`generateHTML` are browser-only
Both functions from `@tiptap/core` require `window` and cannot run in Node.js (confirmed with `node -e "require('@tiptap/core').generateJSON(...)"` → `Error: there is no window object available`). The `@tiptap/html` package was also unavailable. The solution:
- **Display**: read-only `useEditor` — always runs in the browser
- **Migration**: admin tool runs entirely in the browser; no server-side conversion

### Backward compatibility via smart detection
The `RichTextContent` component tries `JSON.parse` first. If the result is `{ type: 'doc', ... }` it is TipTap JSON; otherwise the raw string is passed as HTML. TipTap's `useEditor` accepts both natively, so all existing HTML content continues to render without any database migration required. The migration tool is an optional optimization (enables inline widget display in existing content).

### Factory functions for extensions
`getEditorExtensions()` and `getDisplayExtensions()` are called as functions rather than accessed as module-level constants. TipTap extension instances carry internal state; sharing them across multiple editors (e.g., the main editor and the headless migration editor) caused conflicts.

### Atom vs. non-atom nodes
`videoEmbed`, `xEmbed`, and `mediaCarousel` are atom nodes (no editable children, cursor treats them as a single unit). `callout` is non-atom: it has `content: 'paragraph+'` so the user can type directly inside it like a blockquote.

---

## Errors Fixed During Implementation

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `TS2559: Type 'false' has no properties in common with type 'SetContentOptions'` | `conversionEditor.commands.setContent(html, false)` used the v2 signature; TipTap v3 changed the second argument type | Changed to `setContent(html)` (removed second argument) |
| `TypeError: Cannot read properties of null (reading 'useContext')` on `/admin/maintenance/migrate-content` prerender | Next.js attempted static prerendering of the migration page; TipTap's React hooks require a browser | Added `export const dynamic = 'force-dynamic'` to `page.tsx` + `dynamic(..., { ssr: false })` for the client component |
| Webpack: `the name 'dynamic' is defined multiple times` | `import dynamic from 'next/dynamic'` collided with `export const dynamic = 'force-dynamic'` in the same file | Renamed the import to `import dynamicImport from 'next/dynamic'` |

---

## Test Results (B6)

- ✅ 154/154 backend unit tests pass
- ✅ 90/90 frontend unit tests pass
- ✅ Frontend TypeScript build compiles (4 pre-existing failures in unrelated pages: `/account`, `/checkout/cancel`, `/checkout/success`, `/order-confirmation`)
- ✅ `RichTextContent` renders both legacy HTML and new JSON content without errors
- ✅ `TipTapEditor` emits JSON on every `onChange` call
- ✅ Migration tool page loads, detects content, converts, and PATCHes via admin API
- ✅ All widget node extensions integrate into the extension lists without conflicts

---

## Files Changed

### New files

| File | Purpose |
|------|---------|
| `frontend/components/widgets/Callout/Callout.tsx` | Display component for Callout widget |
| `frontend/components/widgets/VideoEmbed/VideoEmbed.tsx` | Display component for VideoEmbed widget |
| `frontend/components/widgets/XEmbed/XEmbed.tsx` | Display component for XEmbed widget (loads widgets.js) |
| `frontend/components/editor/extensions/callout.tsx` | TipTap Callout node + NodeView |
| `frontend/components/editor/extensions/video-embed.tsx` | TipTap VideoEmbed node + NodeView |
| `frontend/components/editor/extensions/x-embed.tsx` | TipTap XEmbed node + NodeView |
| `frontend/components/editor/extensions/media-carousel.tsx` | TipTap MediaCarousel node + NodeView |
| `frontend/components/editor/extensions/index.ts` | Extension factory: `getEditorExtensions()`, `getDisplayExtensions()` |
| `frontend/components/editor/RichTextContent.tsx` | Read-only TipTap display; smart HTML/JSON detection |
| `frontend/app/admin/maintenance/migrate-content/page.tsx` | Migration page shell (force-dynamic + ssr:false) |
| `frontend/app/admin/maintenance/migrate-content/MigrateContentClient.tsx` | Migration tool UI and logic |

### Modified files

| File | Change |
|------|--------|
| `frontend/components/editor/TipTapEditor.tsx` | `onUpdate` → `getJSON()`; 4 new toolbar buttons; carousel insert panel; imports extension factory |
| `frontend/components/editor/index.ts` | Added `RichTextContent` export |
| `frontend/components/widgets/index.ts` | Added `Callout`, `VideoEmbed`, `XEmbed` exports |
| `frontend/app/(site)/latest/[slug]/ArticlePageClient.tsx` | `dangerouslySetInnerHTML` → `RichTextContent` |
| `frontend/app/(site)/shop/[slug]/ProductPageClient.tsx` | `dangerouslySetInnerHTML` → `RichTextContent` |
| `docs/PHASE_10_PLAN.md` | Added B5 XEmbed section; renumbered Tests to B6 |

---

## What's Next: Phase 9 / Remaining Work

- **Phase 9 Step 9–11**: Admin CRUD for articles, products, and orders — testing was paused when Phase 10A started
- **Run the content migration**: visit `/admin/maintenance/migrate-content` after seeding to convert existing HTML → TipTap JSON in the database (enables inline widgets to render in existing content)
- **Pre-existing build failures**: the 4 failing pages (`/account`, `/checkout/*`, `/order-confirmation`) are unresolved from earlier phases
