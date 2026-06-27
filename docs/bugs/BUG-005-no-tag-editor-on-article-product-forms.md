# BUG-005: No tag editor on article or product create/edit forms

**Status:** `fixed`
**Reported:** 2026-06-27
**Severity:** `high`
**Area:** backstage, articles, products, tags

---

## Description

The tag system is the sole mechanism for filtering and categorising content in AECMS — tags drive the `SearchResultsEmbed` widget, the article and shop listing filters, and the public tag browsing URLs (`/articles?tags=slug`). Despite this, neither the article nor the product create/edit forms expose any way to assign tags. The backend fully supports tag assignment (`tag_ids` accepted in DTOs, persisted via delete-then-create on `ArticleTag`/`ProductTag`), the API returns tags on every article and product response, and tags render correctly on public pages — the gap is purely a missing UI component.

---

## Reproduction Steps

1. Go to `/admin/articles/new` or edit any existing article.
2. **Observed:** No tag field anywhere on the form. Tags cannot be assigned via the UI.
3. Go to `/admin/products/new` or edit any existing product.
4. **Observed:** Same — no tag field.
5. **Expected:** A tag selector is present on both forms, allowing the editor to assign existing tags or create new ones inline.

---

## Root Cause

`ArticleForm.tsx` and `ProductForm.tsx` were built without a `TagField` component. Both DTOs (`CreateArticleDto`, `UpdateProductDto`) accept `tag_ids: string[]` and the services persist changes, but `tag_ids` was never included in the form payload. The `initialData` prop type on both forms was also missing `tags?: Tag[]`, so even if a component had existed it could not have been pre-populated on edit.

---

## Fix

**New component** — `frontend/components/admin/TagField.tsx`:
- Combobox-style multi-select: existing tags appear in a dropdown filtered by typed input; selected tags render as dismissible pills inside the input container.
- `GET /tags` fetched via SWR on mount (shared cache across both form instances).
- Inline tag creation: if typed text does not match any existing tag, a **Create "…"** option appears at the bottom of the dropdown; selecting it calls `POST /tags` and adds the result immediately.
- Keyboard: `Enter` selects the first match or creates; `Backspace` on empty input removes the last tag; `Escape` closes the dropdown.

**`ArticleForm.tsx`**:
- Added `tags?: Tag[]` to `initialData` type.
- Added `tags` state initialised from `initialData.tags ?? []`.
- Added `tag_ids: tags.map(t => t.id)` to submit payload.
- Added Tags card in the sidebar (below Publish, above SEO). Tag changes set `isDirtyExtra` so the Save button enables correctly.

**`ProductForm.tsx`**: identical changes; Tags card placed below Publish, above Pricing.

No backend changes required.

---

## Completion Report

**Fixed:** 2026-06-27
**Commit(s):** pending

### What changed
Implemented as described above. No migrations, no new API endpoints, no capability changes.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Reported — tag assignment impossible via UI despite full backend support |
| 2026-06-27 | fixed | TagField component + wiring in both forms |
