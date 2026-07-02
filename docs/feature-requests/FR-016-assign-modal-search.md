# FR-016: Assign Modal Search Filters

**Status:** `deployed`
**Size:** `small`
**Area:** backstage, tags

---

## Synopsis

The "Assign tag to content" modal in `/admin/tags` shows flat unfiltered lists of all untagged articles and all untagged products. At any realistic content volume these lists become unwieldy. Add an independent `UnifiedSearchInput` bar above each list so the user can filter by title text and/or existing tags before selecting items to assign. Filtering is client-side — no new API calls, no backend changes.

---

## Design

### Search bars

One `UnifiedSearchInput` instance above the Articles checklist and one above the Products checklist. Each operates independently. The existing component already handles:
- Freehand text → title substring match
- Tag chips (selected from a typeahead) → articles/products must carry those tags (ALL or ANY toggle appears with ≥2 chips)
- Enter to commit; chip add/remove auto-commits

Placeholders: `"Filter articles by title or tag…"` / `"Filter products by title or tag…"`.

### Filtering logic

```typescript
// applied to untaggedArticles / untaggedProducts before rendering
const textOk = !filter.search ||
  item.title.toLowerCase().includes(filter.search.toLowerCase());
const tagOk = filter.tags.length === 0 || (
  filter.tagLogic === 'and'
    ? filter.tags.every(slug => item.tags.some(t => t.slug === slug))
    : filter.tags.some(slug => item.tags.some(t => t.slug === slug))
);
```

### Section header

- No filter active: `Articles (N untagged)`
- Filter active with results: `Articles (M of N untagged)`
- Filter active with zero results: `Articles (0 of N match)`

### Selection persistence

Selections are stored by `id` in the existing `Set<string>`. Items filtered out of the visible list **remain selected** — they are not deselected when the filter changes. The Assign button count always reflects the true total including hidden selections.

When a filter is active and there are hidden selected items, a note appears below the list:

> _N item(s) selected but not visible in the current filter._

### "Select all" / "Deselect all"

- **"Select all"** → selects only the currently visible filtered items (scoped to what the user can see).
- **"Deselect all"** → clears all selections including hidden ones.

### `useTags()` inside `UnifiedSearchInput`

The component calls `useTags()` internally to populate the tag typeahead. Because SWR is already running on the tags page, the tags list is in the SWR cache — no second network request fires.

---

## Files changed

```
frontend/app/admin/tags/TagEditorClient.tsx  — AssignModal: add filter state, UnifiedSearchInput instances, filtered lists, updated header counts and select-all logic
```

No backend changes. No new files. No migration.

---

## Completion Report

**Fixed:** 2026-07-02
**Commit(s):** see status history

### What changed

Added `articleFilter` and `productFilter` state to `AssignModal`. Each list gets a `UnifiedSearchInput` instance that fires into its respective filter state. Lists are derived from the existing fetched data via inline filtering. "Select all" is scoped to the filtered view; "Deselect all" clears all. A hidden-selection count note appears when filtered items are selected. Section header shows "M of N" when a filter is active.

---

## Testing Guide

1. Open `/admin/tags` → click **Assign** on any tag that has several untagged articles.
2. **Text filter**: type a partial title in the article search bar → list narrows to matching titles. Clear → full list returns.
3. **Tag filter**: type a tag name in the article search bar → select from the typeahead chip → list narrows to articles carrying that tag. ALL/ANY toggle appears with ≥2 tag chips.
4. **Enter to commit**: type text and press Enter rather than waiting for chip selection → list filters by text.
5. **Selection persistence**: select two visible articles → add a filter that hides one of them → the button still reads "Assign to 2 items". Remove the filter → both remain checked.
6. **Hidden selection note**: with a filter active and a hidden item selected, verify the "N item(s) selected but not visible" note appears below the list.
7. **"Select all"** with a filter: selects only visible items. Remove filter → previously unselected hidden items are not checked.
8. **"Deselect all"** with hidden selections: clears everything including hidden items.
9. **Products list**: verify identical behaviour in the products section independently.
10. **Assign**: confirm the final assignment correctly includes both visible and hidden selected items.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-02 | accepted | Planned and briefed |
| 2026-07-02 | deployed | Implemented in TagEditorClient.tsx |
