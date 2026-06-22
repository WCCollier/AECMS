# FR-001: Tag-Filtered Search & Collection Embed

**Status:** `in-testing`
**Requested:** 2026-06-22
**Deployed:** —
**Size:** `medium` (2–3 days)

---

## Synopsis

Extend the existing text search on the Articles and Shop pages to support tag-based filtering: as the user types, matching tags appear as selectable chips that act as additive AND filters alongside free-text search. Multiple active tags narrow results to content that carries all of them. Filter state is serialized to the URL so any result set is bookmarkable and shareable. Alongside this, a new `SearchResultsEmbed` TipTap node lets editors embed a persistent, live query (by tag, by text, or both) into any page, rendering as the same infinite-scroll or paginated tile grid the catalog pages use — enabling curated collection pages and topic landing pages without manual curation. Tags serve as the single classification dimension for all content (no separate category taxonomy).

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-22 | in-planning | Initial request and code analysis |
| 2026-06-22 | in-testing | Implementation complete; builds and 190 tests pass |

---

## Discussion

### Request context

The use case is an author site selling books and courses. Tags like `"outsiders"`, `"ai-thriller"`, `"firearms"`, `"non-fiction"` cut across both articles and products. The owner wants to:

1. Let readers search and filter by these concepts naturally, without knowing exact category names.
2. Create Pages like "The Outsiders Series" or "Firearms Training Library" that show a live, auto-updating list of all content tagged `outsiders` — without manually maintaining an article list.
3. Share and bookmark URLs like `/articles?tags=ai-thriller&search=chapter+1` for specific queries.

### Current state (from code review)

| What | Status |
|------|--------|
| `GET /articles?search=` | ✅ works (title + excerpt + content) |
| `GET /articles?tag=<slug>` | ✅ works (single tag by slug) |
| `GET /articles?tag_id=<uuid>` | ✅ works (single tag by UUID) |
| `GET /products?search=` | ✅ works |
| `GET /products?tag_id=<uuid>` | ✅ works (single tag) |
| `GET /products?tag=<slug>` | ❌ not exposed (service supports it, controller doesn't) |
| Multi-tag filtering | ❌ neither endpoint supports it |
| Tag chip UI on listing pages | ❌ not present |
| Tag param wired into `useProducts` hook | ❌ hook doesn't accept it |
| `GET /tags` | ✅ public, unguarded, returns all tags |
| SearchResultsEmbed node | ❌ doesn't exist |

### Options considered

**Tag-match UX: typeahead dropdown vs. exact-match detection**

| Option | Trade-off |
|--------|-----------|
| A. Typeahead: as user types, show dropdown of matching tags; click to add as chip | Clean UX, discoverable, handles partial matches; requires fetching tag list upfront |
| B. Exact-match detection: if typed text is exactly a tag name, auto-promote it | Surprising UX ("where did my text go?"), breaks when tag names have spaces; not recommended |
| C. Separate tag picker control (e.g. a `<select>` or checkboxes) alongside the search box | Always visible but takes up space; fine as an alternative for power users |

**Recommendation: Option A** (typeahead) — tags load once on mount (~few KB), client-side filter keeps it fast with no extra requests. No passive "all tags" row — the tag list is expected to grow arbitrarily, making a static row impractical.

**Multi-tag filter logic: AND (decided)**

Tags function as the sole classification dimension (no separate category taxonomy), so multi-tag AND queries are a core MVP need — e.g., `outsiders + ebook` to find the Outsiders e-book specifically, or `firearms + beginner` to find entry-level course content. OR logic would make tags less useful as a classification system because it produces over-broad results once a few tags are active. AND is the correct default and the only mode shipped.

**Embed content type: articles only vs. products only vs. both**

| Option | Trade-off |
|--------|-----------|
| Separate `ArticleCollectionEmbed` and `ProductCollectionEmbed` nodes | Simpler rendering (each uses its existing card); two nodes in the insert menu |
| Single `SearchResultsEmbed` with `contentType` attribute | One node to learn; `contentType: 'articles' \| 'products'` controls which API + card to use |

**Recommendation: Single node** — the two rendering branches are nearly identical (same infinite/paginated shell, different card component). The config modal makes the content type obvious.

**URL schema for tags**

`?tags=slug1,slug2` (comma-separated, alongside existing `?search=` param). This keeps URLs clean and human-readable. `?tag=` (singular) stays supported for backward compat with any existing links.

### Decisions

- **Tag UX**: Typeahead dropdown on input focus/keystroke; selected tags render as removable chips beside the search box. No passive all-tags row.
- **Filter logic**: AND by default. An ALL/ANY pill toggle on the chip strip lets the user switch to OR. Toggle appears only when 2+ chips are active. Default (AND) requires no URL param.
- **URL shape**: `?search=text&tags=slug1,slug2&tag_logic=or` — `tag_logic` is omitted when AND (default). `tags` is the new multi-slug param; `tag` (singular) remains for backward compat and maps to a one-item `tags` array on mount.
- **Backend param**: Add `tags` (comma-separated slugs) and `tag_logic?: 'and' | 'or'` to `QueryArticlesDto` and `QueryProductsDto`. AND uses chained Prisma `AND` clauses; OR uses `{ slug: { in: slugs } }` (see implementation guide).
- **Embed**: One `SearchResultsEmbed` TipTap node. Stores `contentType`, `tags[]`, `tagLogic: 'and' | 'or'`, `search`, `display`, `pageSize`, `title`. Renders live via the same hooks. The ALL/ANY toggle is always visible in the config modal (the editor should always be explicit about the logic for a persistent query).
- **No new DB schema** — tags already exist; this is purely a query-layer and UI change.
- **No new API endpoints** — extend existing `GET /articles` and `GET /products` query params.

### Out of scope

- OR-mode as a separate default — AND remains the default; OR is available via the ALL/ANY toggle (see TagChipStrip design).
- Cross-type unified search (searching articles + products simultaneously in one result set) — would require a new endpoint and a mixed card component. Viable future FR.
- Tag management UI improvements (reordering, merging, color labels) — separate concern.

---

## Design & Implementation Guide

### Overview

Two parallel tracks that share the same query parameter extensions:

**Track A — Listing page enhancement**: Both `LatestPageClient` and `ShopPageClient` gain a tag autocomplete + chip strip. `useArticles`, `useInfiniteArticles`, `useProducts`, `useInfiniteProducts` gain a `tags?: string[]` parameter that appends `?tags=slug1,slug2`. URL state gains `?tags=`.

**Track B — Embed node**: `SearchResultsEmbed` TipTap extension stores query config as node attrs. The corresponding React component fetches live results using the extended hooks and renders using existing `ArticleCard` / `ProductCard` components. The TipTap insert menu gains a "Collection" entry.

### Backend changes

**`backend/src/articles/dto/query-articles.dto.ts`**
```
Add: @IsOptional() @IsString() tags?: string;                    // comma-separated slugs
Add: @IsOptional() @IsIn(['and', 'or']) tag_logic?: 'and' | 'or'; // default 'and'
```

**`backend/src/articles/articles.service.ts`** — in `findAll()`:
```typescript
// replace the existing single tag_id / tag handling block:
if (tags) {
  const slugs = tags.split(',').map(s => s.trim()).filter(Boolean);
  const logic = tag_logic ?? 'and';
  if (slugs.length === 1) {
    where.tags = { some: { tag: { slug: slugs[0] } } };
  } else if (slugs.length > 1 && logic === 'or') {
    where.tags = { some: { tag: { slug: { in: slugs } } } };
  } else if (slugs.length > 1) {
    // AND: each slug gets its own `some` clause — `{ in }` would be OR
    where.AND = [
      ...(where.AND as any[] ?? []),
      ...slugs.map(slug => ({ tags: { some: { tag: { slug } } } })),
    ];
  }
} else if (tag_id) {
  where.tags = { some: { tag_id } };
} else if (tag) {
  where.tags = { some: { tag: { slug: tag } } };
}
```
Note: `tags` takes precedence over `tag_id` / `tag`. Single-slug queries are logic-agnostic.

**`backend/src/products/dto/query-products.dto.ts`**
```
Add: @IsOptional() @IsString() tags?: string;
Add: @IsOptional() @IsString() tag?: string;                       // single slug (parity with articles)
Add: @IsOptional() @IsIn(['and', 'or']) tag_logic?: 'and' | 'or';
```

**`backend/src/products/products.service.ts`** — in `findAll()`: identical branching logic as articles above.

**`backend/src/products/products.controller.ts`** — add `@ApiQuery` for `tag`, `tags`, and `tag_logic`.

No migrations needed.

### Frontend changes

```
frontend/hooks/useArticles.ts          — add tags?: string[], tagLogic?: 'and'|'or'
frontend/hooks/useInfiniteArticles.ts  — same
frontend/hooks/useProducts.ts          — same
frontend/hooks/useInfiniteProducts.ts  — same
frontend/hooks/useTags.ts              — NEW: fetch GET /tags once, SWR-cached 5 min
frontend/components/ui/TagChipStrip.tsx  — NEW: chip strip + typeahead + ALL/ANY toggle
frontend/app/(site)/articles/LatestPageClient.tsx  — wire TagChipStrip + URL state
frontend/app/(site)/shop/ShopPageClient.tsx        — wire TagChipStrip + URL state
frontend/components/editor/extensions/search-results-embed.tsx  — NEW: TipTap node
frontend/components/widgets/SearchResultsWidget.tsx             — NEW: render component
```

### `TagChipStrip` component design

```tsx
interface TagChipStripProps {
  selected: string[];                        // active tag slugs
  tagLogic: 'and' | 'or';                   // controlled by parent
  onChange: (tags: string[]) => void;
  onLogicChange: (logic: 'and' | 'or') => void;
  placeholder?: string;
}
```

Behavior:
1. Renders active tags as `×`-dismissible chips (rounded-full, accent-colored when active, same visual language as the toggle).
2. A tag input field shows a typeahead dropdown of matching tags from `useTags()` as the user types. Already-selected tags are hidden from the dropdown.
3. Clicking a tag in the dropdown adds it to `selected`; clicking `×` on a chip removes it.
4. The **ALL/ANY pill toggle** appears (with `opacity-0 → opacity-100` fade) when `selected.length >= 2`. It sits inline with the chips, to their right.
5. The component is stateless — parent controls all state.
6. No passive all-tags row.

**ALL/ANY toggle visual spec:**
- Fixed-width pill track (`w-16 h-6`), `rounded-full`, `border border-foreground/20`, `bg-foreground/5` — matches chip container styling.
- "ALL" label on the left of the track, "ANY" on the right, both in `text-[10px] font-semibold`.
- A `w-5 h-5 rounded-full bg-accent` circle slides between left and right positions via `transition-transform`.
- The label under the circle renders in `text-white` (or `text-accent-foreground`); the inactive label renders `text-foreground/30`.
- On hover, a tooltip appears after a 500ms delay (CSS `delay-500` via Tailwind `group-hover:`) with text: "ALL: results must have every selected tag · ANY: results must have at least one".

### `SearchResultsEmbed` TipTap node

**Node attrs** (stored in the page JSON):
```typescript
interface SearchResultsAttrs {
  contentType: 'articles' | 'products';
  tags: string[];               // tag slugs
  tagLogic: 'and' | 'or';      // default 'and'
  search: string;               // free-text query (may be empty)
  display: 'grid' | 'list';
  pageSize: number;             // default 6, max 12
  title: string;                // optional display heading
}
```

**Editor (backstage) behavior**: Renders a bordered "Collection" placeholder card showing the configured query summary (e.g., "Articles · ALL of: outsiders, ai-thriller"). Clicking opens a config modal.

**Config modal fields**:
- Content type: Articles / Products (radio)
- Tags: TagChipStrip — includes the ALL/ANY toggle, always visible in the modal (editor should always be explicit about logic for a persistent query)
- Search text: text input
- Heading: text input (shown above the results on the page)
- Display: Grid / List (toggle)
- Page size: 3 / 6 / 9 / 12 (select)

**Customer-facing behavior**: `SearchResultsWidget` uses `useArticles` or `useProducts` with the stored `tags` and `search` attrs. Renders `pageSize` items in the chosen display with paginated controls (infinite scroll is not used in embeds — the page itself may scroll). A "See all" link at the bottom points to `/articles?tags=...&search=...` or `/shop?tags=...&search=...`.

### API contract

No new endpoints. Extended existing params:

| Method | Path | New param | Description |
|--------|------|-----------|-------------|
| GET | /articles | `tags` | Comma-separated tag slugs |
| GET | /articles | `tag_logic` | `and` (default) or `or`; ignored for single tag |
| GET | /products | `tags` | Comma-separated tag slugs |
| GET | /products | `tag_logic` | `and` (default) or `or` |
| GET | /products | `tag` | Single tag slug (parity with articles) |
| GET | /tags | — | Already public; used for typeahead autocomplete |

### URL state (listing pages)

New `?tags=` and `?tag_logic=` params mirror `?search=` handling:
- On mount, parse `searchParams.get('tags')?.split(',')` → initial chip state; `searchParams.get('tag_logic')` → initial toggle state (defaults to `'and'`).
- On chip add/remove or toggle change, update URL with `router.replace()` (no page reload).
- `?tag_logic=or` is written to the URL only when OR is active; AND is the silent default (cleaner URLs).
- `?tag=slug` (singular, existing) continues to work — on mount, treat it as a one-chip `?tags=slug`.

### Key implementation notes

- Tag slugs in the URL are human-readable (`ai-thriller`) not UUIDs. The backend already supports slug-based lookup on articles; products need parity (see backend section).
- `useTags()` hook should use `staleWhileRevalidate` with a 5-minute revalidation — the tag list changes infrequently.
- In the embed, `pageSize` should be capped at 12 server-side to prevent abuse (the existing `limit` param already enforces this via the `limit: LIMIT` default in hooks, but the embed should explicitly pass its configured value).
- `SearchResultsEmbed` extension goes in `frontend/components/editor/extensions/` alongside the existing embed nodes. Register it in `index.ts`. Add "Collection" to the TipTap insert menu in the editor toolbar.
- The `TagChipStrip` component should be in `frontend/components/ui/` (reusable across listing pages and the embed config modal). Export it from the `ui` index.

---

## Completion Report

**Implemented:** 2026-06-22
**Commit(s):** pending

### What was built

All items from the design guide shipped as specified. No deviations.

- **Backend**: `tags` (comma-separated slugs) and `tag_logic` (`and`|`or`) params added to `QueryArticlesDto` and `QueryProductsDto`. `tag` (single slug) parity added to products. Prisma query branches correctly: single slug → simple `some`; multi AND → chained `AND` clauses; multi OR → `some { in }`. Existing `tag_id` and `tag` params preserved for backward compat.
- **`useTags` hook**: SWR-cached, 5-minute dedup window, used by `TagChipStrip` for typeahead.
- **Hooks updated**: `useArticles`, `useInfiniteArticles`, `useProducts`, `useInfiniteProducts` all accept `tags?: string[]` and `tagLogic?: 'and' | 'or'`.
- **`TagChipStrip`**: Reusable chip strip with typeahead dropdown, already-selected tag filtering, ALL/ANY sliding pill toggle (appears at ≥2 chips; always visible in embed config via `alwaysShowLogic` prop), CSS 500ms hover tooltip.
- **Listing pages**: `/articles` and `/shop` both gained the `TagChipStrip` below the search bar. URL state fully serialized: `?tags=slug1,slug2&tag_logic=or&search=text`. Legacy `?tag=slug` read on mount and treated as single chip.
- **`SearchResultsWidget`**: Renders live article or product tiles with paginated controls and "See all" link. No infinite scroll in embed context.
- **`SearchResultsEmbedNode`**: TipTap node with config modal (content type, tags, logic, text, heading, display, page size). Editor placeholder shows query summary. Registered in both `getEditorExtensions()` and `getDisplayExtensions()`. Toolbar button uses `LibraryBig` icon.

### Deviations from design
None.

### Known limitations
- `SearchResultsWidget` uses `limit: 0` as a sentinel to skip the inactive query (articles hook when in products mode and vice versa). This results in a `GET /articles?limit=0` call that returns an empty page — harmless but slightly inelegant. A null-key pattern could suppress it entirely in a future cleanup.

---

## Testing Guide

> _To be written alongside implementation._

### Prerequisites
- Local instance running (`bash start-dev.sh`).
- At least 3 tags in the DB, each assigned to at least 2 articles or products.
- At least one page with a `SearchResultsEmbed` node.

### Test scenarios

**A. Typeahead tag selection on /articles**
1. Navigate to `/articles`.
2. Click the tag input and type the first 2 letters of a known tag.
3. Confirm matching tags appear in a dropdown; already-active tags are absent.
4. Click a tag — confirm it becomes a chip, results filter immediately, URL updates to `?tags=<slug>`.
5. Add a second tag — confirm results are narrowed to articles carrying **both** tags (AND). An article with only one of the two tags should disappear.
6. Remove a chip via `×` — confirm the broader result set returns.

**B. AND narrowing verification**
1. Seed: article A has tags `outsiders` + `ebook`; article B has tag `outsiders` only.
2. Select tag `outsiders` — both A and B appear.
3. Select tag `ebook` — only A appears.
4. This is the critical AND contract test.

**C. Text + tag combined search**
1. Add a tag chip as above.
2. Type text in the text search box and submit.
3. Confirm results must satisfy both the active tag(s) AND the text match.
4. URL should read `?tags=slug&search=text`.

**D. Bookmarkable URL**
1. Apply two tag chips + text search on `/articles`.
2. Copy the URL, open in a new tab.
3. Confirm both chips and the text search are pre-populated from URL params, results match.
4. Confirm `?tag=slug` (singular, legacy) on mount is treated as a single-chip `?tags=slug`.

**E. `/shop` tag filtering**
1. Navigate to `/shop`.
2. Repeat scenarios A–D with product tags.

**F. SearchResultsEmbed — editor config**
1. Open a page in the backstage editor.
2. Insert a "Collection" embed node.
3. Configure: Articles, tags `outsiders` + `ebook`, no text, Grid, 6 items, heading "The Outsiders E-Books".
4. Confirm the editor shows a placeholder card summarising the query ("Articles tagged: outsiders, ebook").
5. Save the page.

**G. SearchResultsEmbed — customer render**
1. View the page from scenario F as a visitor.
2. Confirm only articles tagged with both `outsiders` AND `ebook` appear in the grid under the heading.
3. Confirm "See all" link goes to `/articles?tags=outsiders,ebook`.
4. Add a new article tagged `outsiders` only (not `ebook`) — reload the page, confirm it does NOT appear (AND filter holds in the embed).
5. Add the `ebook` tag to that article — reload, confirm it now appears.

**H. Embed pagination**
1. Configure an embed with `pageSize: 3` and enough content to page.
2. Confirm Previous/Next controls appear and work.
3. Confirm infinite scroll is NOT active inside the embed (page itself scrolls normally).

**I. Empty state**
1. Configure an embed with a tag combination that has no content.
2. Confirm a "No results" message renders (not an error or blank space).

### Acceptance criteria

- [ ] Typing in the tag input on `/articles` shows a typeahead dropdown; already-selected tags are absent.
- [ ] Selected tags render as removable chips; URL updates to `?tags=` without full reload.
- [ ] ALL/ANY toggle appears (fades in) only when 2+ chips are active; hidden with 0 or 1 chip.
- [ ] Toggle slides smoothly between positions; active label is visually highlighted; inactive label is dimmed.
- [ ] Hovering the toggle for 500ms shows a tooltip explaining ALL vs ANY semantics.
- [ ] Adding a second chip in AND (ALL) mode narrows results — content missing either tag disappears.
- [ ] Switching to OR (ANY) mode broadens results — content with either tag appears.
- [ ] `?tag_logic=or` appears in the URL only when OR is active; absent (not `=and`) when AND is active.
- [ ] Text search and tag chips apply simultaneously; text match is always ANDed with the tag filter regardless of tag logic.
- [ ] `/shop` has the same tag chip + toggle capability.
- [ ] Direct URL with `?tags=slug1,slug2&tag_logic=or&search=text` pre-populates all controls correctly.
- [ ] Legacy `?tag=slug` (singular) in URL is treated as a single active chip on mount.
- [ ] `SearchResultsEmbed` node is insertable from the TipTap editor.
- [ ] Embed config modal shows ALL/ANY toggle at all times (always explicit for persistent queries).
- [ ] Embed placeholder card summarises logic: "Articles · ALL of: …" or "Articles · ANY of: …".
- [ ] Embed renders results respecting the configured tag logic.
- [ ] "See all" link in embed includes `?tag_logic=or` when OR mode is set.
- [ ] Empty-state message shown when query returns zero results.
- [ ] No DB schema changes required (no migrations).

---

## Outstanding Issues

_None yet._
