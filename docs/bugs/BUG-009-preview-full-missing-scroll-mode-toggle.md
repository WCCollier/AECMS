# BUG-009: Collection Embed configurator hides scroll-mode toggle for Preview and Full display modes

**Status:** `fixed`
**Severity:** `medium`
**Area:** frontend, editor, widgets, FR-015

---

## Symptom

In the Collection Embed config panel, when the display mode is set to **Preview (100vh pane)** or **Full article/product**, the **"Scroll mode"** toggle (Auto / Always paginated) disappears. The **"Items shown"** page-size selector remains visible. The user cannot switch from infinite scroll to paginated mode, which means that when many results exist, preview/full embeds produce arbitrarily long pages with no way to paginate them — even though the warning banner specifically advises using paginated mode for these display types.

## Root Cause

`frontend/components/editor/extensions/search-results-embed.tsx` line 228:

```tsx
{!isInlineDisplay && (        // ← guard was too broad
  <div>
    <p ...>Scroll mode</p>
    <div className="flex gap-2">
      {(['auto', 'paginated'] as DisplayMode[]).map(...)}
    </div>
  </div>
)}
```

`isInlineDisplay` is `true` when `display === 'preview' || display === 'full'`. The original intent (from the FR-015 design spec) was to **hide the Grid/List layout selector** for these modes since layout is forced to single-column. There is no separate Grid/List toggle in the UI — it is already part of the main Display selector. The `!isInlineDisplay` guard was incorrectly applied to the scroll mode toggle instead, which serves a completely independent purpose.

The underlying infrastructure is correct: `displayMode` is saved to the node's attributes and passed through `SearchResultsEmbedNodeView` → `SearchResultsWidget` → `allowInfiniteScroll`. Pagination works correctly for preview and full modes at runtime — the control is simply not exposed in the editor.

## Before / After

**Before:** Config panel for Preview mode shows Items shown selector but no Scroll mode toggle. Users cannot paginate preview/full embeds.

**After:** Scroll mode toggle is visible for all display modes (grid, list, preview, full). The warning banner for inline display modes already mentions paginated mode as a mitigation — the toggle to enable it now appears directly below that warning.

## Fix

**File:** `frontend/components/editor/extensions/search-results-embed.tsx`

Remove the `!isInlineDisplay &&` guard from the scroll mode toggle section so it always renders. No change to the surrounding page-size selector (already always visible) or to the display-mode selector (correctly excludes Preview/Full from the Grid/List options by design of those buttons). Update the section comment to remove the stale reference to hiding the toggle.

```tsx
// Before
{!isInlineDisplay && (
  <div>
    <p className="text-xs font-medium text-foreground/60 mb-1.5">Scroll mode</p>
    ...
  </div>
)}

// After (guard removed — scroll mode applies to all display types)
<div>
  <p className="text-xs font-medium text-foreground/60 mb-1.5">Scroll mode</p>
  ...
</div>
```

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | fixed | Guard removed; scroll mode toggle now visible for all display modes |
