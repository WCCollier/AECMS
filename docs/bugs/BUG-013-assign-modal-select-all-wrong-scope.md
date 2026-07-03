# BUG-013: Assign modal "Select all" selects wrong items when filter is active

**Status:** `fixed`
**Reported:** 2026-07-03
**Severity:** `medium`
**Area:** backstage, tags, FR-016

---

## Description

In the tag assign modal (`/admin/tags` → Assign), after filtering the article or product list, clicking "Select all" does not check the items currently visible on screen. Instead it either clears all selections (including hidden ones) or selects the full unfiltered list — depending on which of two interacting bugs triggers first.

---

## Root Causes

### Bug A — Select All / Deselect All toggle is scoped to the full set, not the visible set

`handleSelectAllArticles` checks `selectedArticles.size > 0` (the whole set) to decide whether to select or clear:

```typescript
const handleSelectAllArticles = () => {
  if (selectedArticles.size > 0) {
    setSelectedArticles(new Set());       // clears ALL, including hidden selections
  } else {
    setSelectedArticles(new Set(visibleArticles.map((a) => a.id)));
  }
};
```

The button label also keys off the full set (`selectedArticles.size > 0 ? 'Deselect all' : 'Select all'`). This produces a confusing state: if any article is selected but hidden by the active filter, the button says "Deselect all" even though nothing in the visible list is checked. The user sees an empty list and a button labelled "Deselect all," clicks it expecting to select, and instead clears invisible hidden selections.

### Bug B — Filter is not live; text must be committed with Enter

`UnifiedSearchInput` only fires `onSearch` (which updates `articleFilter`) on Enter or chip add/remove. If the user types filter text and clicks "Select all" without pressing Enter, `articleFilter.search` is still `''` and `visibleArticles` is the full unfiltered list. All items get selected, but the user perceives the input as already filtering the list (text is visible in the box), so the wrong items appear selected.

---

## Fix

### `UnifiedSearchInput` — add `liveSearch` prop

New optional prop `liveSearch?: boolean`. When true, `handleInput` immediately fires `onSearch` with the current chips + text on every keystroke, giving real-time filtering. Existing callers (customer-facing article/shop pages) do not pass this prop and are unaffected.

### `AssignModal` — rewrite toggle to scope to visible items only

New logic for both `handleSelectAllArticles` and `handleSelectAllProducts`:
- If ALL currently-visible items are already selected → deselect only the visible ones (preserve hidden selections)
- Otherwise → add all visible items to the selection (preserve existing selections)

Button label: "Deselect visible" when all visible are selected; "Select all" otherwise.

---

## Files changed

```
frontend/components/ui/UnifiedSearchInput.tsx       — add liveSearch prop; fire onSearch on handleInput when liveSearch=true
frontend/app/admin/tags/TagEditorClient.tsx         — pass liveSearch to both UnifiedSearchInput instances; rewrite handleSelectAll* handlers
```

---

## Completion Report

**Fixed:** 2026-07-03
**Commit(s):** see status history

### What changed

- `UnifiedSearchInput`: added `liveSearch?: boolean` prop. When true, `handleInput` fires `onSearch(slugs, tagLogic, text)` immediately on every input change and updates `committed` state so the × clear button appears as expected.
- `AssignModal`: both `handleSelectAllArticles` and `handleSelectAllProducts` now compare the full `visibleXxx` set against current selections. They add/remove only the visible items, never touching hidden selections. Button label is "Deselect visible" when all visible are selected, "Select all" otherwise.
- Both `UnifiedSearchInput` instances in `AssignModal` now receive `liveSearch`.

---

## Testing Guide

1. Open `/admin/tags` → Assign on a tag.
2. Type part of an article title in the article filter box — **without pressing Enter**. The list should filter immediately as you type.
3. Click "Select all." Only the currently-visible filtered items should be checked. Counter shows the correct count.
4. Type a different filter. Previous selections from step 3 persist as hidden. The "N item(s) selected but not visible" note appears.
5. Click "Select all" again. Adds visible items to the selection without clearing the hidden ones.
6. When all visible items are checked, the button reads "Deselect visible." Clicking it unchecks only the visible items; hidden selections remain.
7. Repeat steps 2–6 for the products list independently.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-03 | open | Reported: "Select all" selects wrong items after filtering |
| 2026-07-03 | fixed | liveSearch prop added to UnifiedSearchInput; Select All toggle scoped to visible items |
