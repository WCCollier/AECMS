# BUG-007: Tag Assign Modal Shows "All Already Tagged" for Every Tag

**Status:** `fixed`
**Severity:** `high`
**Area:** backstage, tags, FR-014

---

## Symptom

In `/admin/tags`, clicking **Assign** on any tag opens the assignment modal, which immediately shows "All published articles already have this tag" and "All published products already have this tag" — for every tag, regardless of how many articles/products actually carry it. No articles or products are selectable.

## Root Cause

Two-part failure:

### 1. `limit=1000` exceeds the DTO max

`AssignModal` fetches content with:
```
GET /articles?limit=1000&status=published
GET /products?limit=1000&status=published
```

Both `QueryArticlesDto` and `QueryProductsDto` enforce `@Max(100)` on the `limit` field via class-validator. NestJS's `ValidationPipe` rejects `limit=1000` and returns a **400 Bad Request** before any query ever runs.

Relevant constraint (same in both DTOs):
```typescript
// backend/src/articles/dto/query-articles.dto.ts:67
@Max(100)
@IsOptional()
limit?: number = 20;
```

### 2. Silent `.catch(() => {})` hides the error

`AssignModal`'s `useEffect` has:
```typescript
// frontend/app/admin/tags/TagEditorClient.tsx
Promise.all([
  adminApi.get('/articles?limit=1000&status=published').then((r) => r.data),
  adminApi.get('/products?limit=1000&status=published').then((r) => r.data),
]).then(([aRes, pRes]) => {
  setArticles(aRes.data ?? []);
  setProducts(pRes.data ?? []);
}).catch(() => {})           // ← swallows the 400, articles/products stay []
  .finally(() => setLoading(false));
```

When the 400 is thrown, the `.catch` fires and neither `setArticles` nor `setProducts` is called. Both remain at their initial value `[]`. `setLoading(false)` still fires, so the modal renders the empty-state message rather than the loading spinner.

**Result:** `untaggedArticles = [].filter(...) = []` for every tag → "All published articles already have this tag."

## Files to Change

| File | Change |
|------|--------|
| `frontend/app/admin/tags/TagEditorClient.tsx` | (A) Change `limit=1000` → `limit=100` on both fetch calls; (B) Add `error` state and surface it in the modal UI instead of swallowing |

No backend changes required — the `@Max(100)` limit is correct and intentional (it prevents accidental large queries). The frontend was simply violating it.

## Fix Plan

### Part A — fix the limit (one-line change per call)

```typescript
// was: adminApi.get('/articles?limit=1000&status=published')
adminApi.get('/articles?limit=100&status=published')

// was: adminApi.get('/products?limit=1000&status=published')
adminApi.get('/products?limit=100&status=published')
```

For a personal CMS, 100 articles and 100 products is a practical ceiling that will never be hit in normal use. If the site ever grows past that, pagination can be added to the modal at that time.

### Part B — surface fetch errors in the modal

Replace the silent catch with an error state:

```typescript
const [fetchError, setFetchError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  setFetchError(null);
  Promise.all([
    adminApi.get('/articles?limit=100&status=published').then((r) => r.data),
    adminApi.get('/products?limit=100&status=published').then((r) => r.data),
  ]).then(([aRes, pRes]) => {
    setArticles(aRes.data ?? []);
    setProducts(pRes.data ?? []);
  }).catch((e) => {
    setFetchError(getErrorMessage(e));
  }).finally(() => setLoading(false));
}, []);
```

Add the error to the modal body, just below the `{loading ? ...}` block:

```tsx
{fetchError && (
  <p className="text-sm text-red-500 py-4 text-center">
    Failed to load content: {fetchError}
  </p>
)}
```

## Testing

1. Open `/admin/tags`, click **Assign** on a tag that has 0 articles → "0 untagged" → shows "All published articles already have this tag." (correct, since there really are none)
2. Click **Assign** on a tag that has some but not all articles → untagged articles appear in the checklist, already-tagged articles are excluded
3. Click **Assign** on a tag with 0 articles/products assigned → all articles and products appear as selectable

## Completion Report

**Files changed:** `frontend/app/admin/tags/TagEditorClient.tsx`

- Changed `limit=1000` → `limit=100` on both article and product fetch calls in `AssignModal.useEffect`
- Replaced `.catch(() => {})` with `.catch((e) => { setFetchError(getErrorMessage(e)); })`
- Added `fetchError` state; modal body shows a centered red error message when fetch fails instead of the misleading "all already tagged" empty state

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Root-caused: limit=1000 exceeds @Max(100), silent catch hides 400 |
| 2026-06-28 | fixed | limit=100, fetchError state replaces silent catch |
