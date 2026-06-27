# FR-015: Collection Embed — preview/full display modes and tag exclusion filter

**Status:** `accepted`
**Size:** `medium`
**Area:** page-editor, widgets, articles, products, backend

---

## Synopsis

Extend the `SearchResultsEmbed` TipTap widget (the "collection embed") with two new per-item display modes and a tag exclusion filter. Existing `grid` and `list` card modes are unchanged. The new modes render actual article/product content inline rather than a summary card. The tag exclusion filter works exactly like the existing inclusion filter — same `TagChipStrip` UI, same AND/OR toggle — but narrows results by rejecting items that carry the excluded tags.

---

## What already exists (no changes needed to core infrastructure)

- `SearchResultsWidget.tsx` — consumer-side renderer; handles paginated and infinite-scroll modes
- `useArticles` / `useProducts` hooks — pass tag filters to backend
- `useInfiniteArticles` / `useInfiniteProducts` — same
- `TagChipStrip` — reusable tag selector UI with AND/ANY toggle; already used for inclusion tags
- `RichTextContent` component — renders TipTap JSON read-only; used on article/product detail pages already

The backend already returns the full `content` field (TipTap JSON) on articles and `description` on products in `GET /articles` and `GET /products` list responses, so no schema or query changes are needed to access content for inline rendering.

---

## New Display Modes

`display` attribute (currently `'grid' | 'list'`) is extended to `'grid' | 'list' | 'preview' | 'full'`. Grid and list continue to work exactly as before.

### Preview mode (`display: 'preview'`)

Each result item is rendered as a `100dvh`-tall pane:
- Layout: always vertically stacked (single column), regardless of the grid/list selector (that selector is hidden in the config panel when preview or full is active)
- Inside the pane: article/product title, author + date line, and the full content rendered by `RichTextContent`, starting from the top
- A CSS gradient overlay fades the bottom `30%` of the pane from transparent to `var(--background)`, giving the impression of truncation
- Below the pane (or anchored to the bottom of the pane, above the fade): a **"Continue reading →"** link that navigates to `/articles/:slug` or `/shop/:slug`
- Pagination / infinite scroll operate exactly as in card modes — the panes stack vertically; "next page" or the scroll sentinel loads the next batch

Use case: a long-form publication landing page that teases each recent article at full viewport height, inviting the reader to dive in.

### Full display mode (`display: 'full'`)

Each result item is fully rendered inline:
- Layout: always single-column, vertically stacked, separated by a `<hr>` divider or a spacer
- Inside each item: same structure as the consumer-facing article or product detail page — title, metadata (author, date, tags), then `RichTextContent` rendering the complete body
- No height limit, no fade, no "continue reading" link
- Pagination / infinite scroll continue to work; each "page" adds more full-rendered items below

**Warnings to surface in the config panel when full or preview is selected:**
- "Full/Preview display renders the complete article or product body. Pages with many results may become very long."
- Recursive embeds: if an article's content itself contains a `SearchResultsEmbed` node, that widget is rendered as a placeholder `[Collection Embed]` label inside the inline render to prevent infinite recursion. This is handled by passing a `depth` prop to `RichTextContent` and skipping `SearchResultsEmbed` nodes when `depth > 0`.

**Products in full mode:** render `description` (TipTap JSON body) via `RichTextContent`. Also render price, product type badge, and an "Add to cart" / "View product" button at the bottom of each item.

---

## Tag Exclusion Filter

A second `TagChipStrip` in the config panel labelled **"Exclude these tags"**, positioned below the existing inclusion strip. Same interaction model: type to search, select tags, remove with ×. Same ALL/ANY toggle — but semantically inverted:

| Toggle value | Meaning |
|---|---|
| `any` | Exclude items that have **any** of the listed exclusion tags (most common: "hide anything tagged with Sponsored or Draft") |
| `all` | Exclude items only if they have **every** listed exclusion tag (niche: "only suppress items that are simultaneously tagged both X and Y") |

### Backward compatibility

Existing embedded nodes have no `excludeTags` attribute. They receive an empty array default and are unaffected. The exclusion filter is a pure narrowing of the result set — it can never return more results than the same query without it.

### New node attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `excludeTags` | `string` (JSON `string[]`) | `'[]'` | Slugs of tags to exclude |
| `excludeTagLogic` | `'any' \| 'all'` | `'any'` | Exclusion logic: any = exclude if has any; all = exclude only if has all |

---

## Backend Design

Both `GET /articles` and `GET /products` need two new query params.

### New query params (both endpoints)

| Param | Type | Description |
|-------|------|-------------|
| `exclude_tags` | `string` (comma-separated slugs) | Tags to exclude |
| `exclude_tag_logic` | `'any' \| 'all'` | Defaults to `'any'` |

### DTOs

**`QueryArticlesDto`** and **`QueryProductsDto`** — add:
```typescript
@IsString() @IsOptional()
exclude_tags?: string;   // comma-separated slugs

@IsEnum(['any', 'all']) @IsOptional()
exclude_tag_logic?: 'any' | 'all';
```

### Prisma WHERE clause additions

In `ArticlesService.findAll()` and `ProductsService.findAll()`, after the existing inclusion tag logic:

```typescript
if (excludeSlugs.length > 0) {
  if (excludeTagLogic === 'all') {
    // Exclude only items that have EVERY excluded tag
    // = keep items missing at least one excluded tag
    // = NOT (has tag1 AND has tag2 AND ...)
    where.NOT = {
      AND: excludeSlugs.map((slug) => ({
        tags: { some: { tag: { slug } } },
      })),
    };
  } else {
    // 'any': exclude items that have ANY excluded tag (default)
    where.NOT = {
      tags: { some: { tag: { slug: { in: excludeSlugs } } } },
    };
  }
}
```

> **Note:** If `where.NOT` is already set by other logic, use spread/merge rather than overwriting. Currently no other code sets `where.NOT` in either service.

---

## Frontend Design

### `SearchResultsAttrs` interface additions

```typescript
excludeTags: string;      // JSON string, default '[]'
excludeTagLogic: 'any' | 'all';  // default 'any'
// display extended: 'grid' | 'list' | 'preview' | 'full'
```

### `SearchResultsEmbedNode` attribute additions

```typescript
excludeTags:    { default: '[]' },
excludeTagLogic: { default: 'any' },
```

`display` default remains `'grid'`; the new values are just added as valid options.

### Config panel (`search-results-embed.tsx`) changes

1. **Display selector** — add "Preview (100vh pane)" and "Full article/product" options to the existing dropdown. When either is selected, hide the Grid/List toggle (layout is forced to stacked).

2. **Exclusion strip** — add a second `TagChipStrip` below the existing inclusion one, labelled "Exclude these tags", wired to `excludeTags` / `excludeTagLogic` attrs. Same `allLabel="ALL"` / `anyLabel="ANY"` toggle, but use different label text to distinguish: e.g. "ALL" → "Exclude if has ALL" vs "ANY" → "Exclude if has ANY".

3. **Warning banner** — when `display` is `'preview'` or `'full'`, show a small info callout in the panel: _"Full/Preview display renders the complete article or product body inline. Use a small page size or paginated mode to avoid very long pages."_

### `SearchResultsWidget.tsx` changes

- Accept two new props: `excludeTags: string[]`, `excludeTagLogic: 'any' | 'all'`
- Pass to all four hooks (`useArticles`, `useInfiniteArticles`, `useProducts`, `useInfiniteProducts`)
- Add a branch for `display === 'preview'` and `display === 'full'` in the render path, rendering the new item components instead of `ArticleCard` / `ProductCard`

### New components

```
frontend/components/widgets/SearchResultsEmbed/
  ArticlePreviewPane.tsx   — 100dvh pane with fade and "continue reading" link
  ArticleFullEmbed.tsx     — full article inline (title + meta + RichTextContent)
  ProductPreviewPane.tsx   — 100dvh pane for products
  ProductFullEmbed.tsx     — full product inline (title + meta + description + CTA)
```

Each component receives the full article/product object (which the existing hooks already return) and a `depth: number` prop threaded down from `SearchResultsWidget`. When `depth > 0`, `RichTextContent` skips `SearchResultsEmbed` nodes, rendering a `[Collection embed]` placeholder instead.

### Hook additions (`useArticles`, `useProducts`, `useInfiniteArticles`, `useInfiniteProducts`)

Each hook already accepts `tags` and `tagLogic`. Add:
```typescript
excludeTags?: string[];
excludeTagLogic?: 'any' | 'all';
```
Build the query string: `exclude_tags=slug1,slug2&exclude_tag_logic=any`.

---

## Key Considerations

- **`100dvh` vs `100vh`:** Use `dvh` (dynamic viewport height) to avoid the mobile-browser address-bar jump issue. Falls back to `100vh` for older browsers via CSS.
- **Recursive embed protection:** The `depth` prop is the simplest guard. `SearchResultsWidget` passes `depth + 1` to `ArticleFullEmbed` / `ArticlePreviewPane`, which pass it to `RichTextContent`. `RichTextContent` (or the TipTap node view) renders a non-interactive placeholder when `depth > 0`. No changes needed to the persistence layer.
- **Content in list responses:** Confirmed — `GET /articles` and `GET /products` both use `...article` / `...product` spreads in their transform methods with no `select` clause, so `content` (articles) and `description` (products) are already present in every list response. No backend changes needed on this point.
- **Preview pane fade colour:** The gradient must use `var(--background)` (or the theme-aware CSS variable) so it blends correctly across all 8 palettes. Hardcoding a colour would break dark and light themes.
- **Full mode + products:** "Full product" includes the `description` TipTap body. It does not replicate the pricing panel, reviews, or add-to-cart widget from the product detail page — just a "View product →" link CTA at the bottom. Replicating the full commerce UI inside an embed would be overly complex and inconsistent.
- **Exclusion + inclusion interaction:** A tag can appear in both the inclusion and exclusion lists simultaneously. In this edge case the exclusion wins (nothing matches both conditions), producing an empty result. The UI does not need to prevent this but could warn.
- **`exclude_tag_logic` naming:** The naming mirrors `tag_logic` for consistency. Both services need to handle the default (`'any'`) when the param is absent.

---

## Files to Create / Modify

```
backend/src/articles/dto/query-articles.dto.ts    — add exclude_tags, exclude_tag_logic
backend/src/articles/articles.service.ts          — apply NOT clause in findAll()
backend/src/products/dto/query-products.dto.ts    — same
backend/src/products/products.service.ts          — same

frontend/hooks/useArticles.ts                     — add excludeTags/excludeTagLogic params
frontend/hooks/useInfiniteArticles.ts             — same
frontend/hooks/useProducts.ts                     — same
frontend/hooks/useInfiniteProducts.ts             — same

frontend/components/editor/extensions/search-results-embed.tsx
  — extend display options to include 'preview' and 'full'
  — add exclusion TagChipStrip + attrs
  — add config panel warning for preview/full

frontend/components/widgets/SearchResultsWidget.tsx
  — add excludeTags/excludeTagLogic props → pass to hooks
  — add render branches for preview and full display modes
  — thread depth prop

frontend/components/widgets/SearchResultsEmbed/ArticlePreviewPane.tsx   — new
frontend/components/widgets/SearchResultsEmbed/ArticleFullEmbed.tsx      — new
frontend/components/widgets/SearchResultsEmbed/ProductPreviewPane.tsx    — new
frontend/components/widgets/SearchResultsEmbed/ProductFullEmbed.tsx      — new
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

1. **Grid/list unchanged:** Open an existing collection embed — verify it renders identically before and after.
2. **Preview mode:** Configure a collection embed to `display: preview`. Publish the page. Verify each result renders at ~100vh, content is visible, fade appears at bottom, "Continue reading" link navigates correctly.
3. **Full mode:** Configure `display: full`. Verify entire article/product body renders inline. Verify a `<hr>` divider separates items. Verify an article embedding another collection embed renders `[Collection embed]` placeholder rather than recursing.
4. **Exclusion filter — any:** Tag a couple of articles with "Sponsored". Add "Sponsored" to the exclusion filter (ANY mode). Verify sponsored articles do not appear in the embed.
5. **Exclusion filter — all:** Add tags "X" and "Y" to exclusion in ALL mode. Create articles: one with only X, one with only Y, one with both X and Y. Verify only the "both X and Y" article is excluded.
6. **Exclusion + inclusion combined:** Set include filter to tag "Fiction" and exclude filter to tag "Short". Verify only Fiction articles without the Short tag appear.
7. **Exclusion in infinite scroll mode:** Set exclusion filter on an infinite-scroll embed. Verify subsequent pages also exclude the tagged items.
8. **Backward compatibility:** Load a page with an existing collection embed that has no `excludeTags` attribute in its stored JSON. Verify it renders normally (no console errors, no missing results).
9. **Preview pane fade colour:** Test in both a light and a dark palette. Verify the fade gradient blends into the page background in both cases.
10. **Config panel UX:** Verify grid/list selector is hidden when preview or full is active in the editor. Verify the warning banner appears. Verify the exclusion TagChipStrip ALL/ANY toggle is independent of the inclusion toggle.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Initial write-up |
