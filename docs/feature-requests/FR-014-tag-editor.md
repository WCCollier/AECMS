# FR-014: Tag Editor

**Status:** `deployed`
**Size:** `medium`
**Area:** backstage, tags, articles, products

---

## Synopsis

Add a dedicated `/admin/tags` management panel that gives Owners and Admins full CRUD control over tags plus a mass-assignment flow. A new `tag.edit` capability gates all four operations. The panel replaces the current situation where tags can only be created inline from the article/product form (via `TagField`) and cannot be renamed, deleted, or bulk-assigned from anywhere in the backstage.

---

## What already exists (no changes needed)

- `GET /tags` — public; returns all tags ordered by name with article count. Already returns `_count`.
- `GET /tags/:slug` — public.
- `PATCH /tags/:id` — exists, currently gated on `article.edit.any`.
- `DELETE /tags/:id` — exists, currently gated on `article.delete.any`. Has an extra guard that **blocks deletion when the tag has articles** — this must be removed (see below).
- `POST /tags` — exists, currently gated on `article.create`.
- Prisma schema: `ArticleTag` and `ProductTag` junction tables both have `onDelete: Cascade`, so deleting a tag row automatically removes all article/product associations at the DB level.

---

## Operations

### A — Edit a tag

Rename the tag's display name and optionally its slug. The tag's `id` never changes, so all article/product assignments in the join table survive intact.

**Slug-change ramification (display in UI as a warning):** The slug is used in two external-facing places:
1. `SearchResultsEmbed` TipTap nodes store the tag slug as a filter attribute. Any widget configured with the old slug will silently return no results.
2. Customer-facing URLs like `/articles?tag=old-slug` (bookmarks, shared links) will stop filtering correctly.

The warning should be shown inline whenever the slug field is edited and differs from the original.

Auto-suggest: when the name changes, auto-derive a new slug using the same `generateSlug()` logic already on the backend. The slug field is editable independently — the auto-suggestion is not forced.

### B — Delete a tag

Remove the tag record. The DB cascade removes it from all `article_tags` and `product_tags` rows automatically. No migration needed; cascade is already defined.

**Required backend change:** `TagsService.remove()` currently throws `BadRequestException` if the tag has associated articles. This guard must be removed. The cascade handles cleanup; the guard was premature protection against accidental deletion that the new confirmation dialog replaces.

UI: a confirmation dialog must show before deletion:
> Delete **"tagname"**? This will remove it from **N articles** and **M products**. It will also break any Search Collection widgets or bookmarked URLs that filter by this tag. This cannot be undone.

Counts for N and M come from extending `findAll()` to include both article and product counts (see Backend section).

### C — Create a tag without assigning

A top-of-page "Add Tag" form (or small inline form at the bottom of the list) that accepts a name (slug auto-generated, editable) and optional description. Posts to `POST /tags`. No article/product assignment required. This mirrors what `TagField` does inline, but from a central management surface.

### D — Mass assign

From any tag's row, a "Assign to content" action opens a modal:

1. Modal header: **Assign "tagname" to content**
2. Two sections side by side (or stacked on mobile): **Articles** and **Products**
3. Each item rendered as a selectable card: title + current tag status
   - Items that **already have** the tag: shown with a filled tag icon badge; not selectable (assignment is already done; this surface is additive-only)
   - Items that **don't have** the tag: checkbox, selectable
4. Select All / Deselect All per section
5. Confirm button: **Assign to X items** (disabled when 0 selected)
6. On confirm: `POST /tags/:id/assign` with `{ article_ids: [], product_ids: [] }`; the backend connects each ID via Prisma `connect` (idempotent). Modal closes on success, tag row counts update.

**Additive-only:** this surface does not remove the tag from any item. Removing a tag from a specific article/product is done from that article/product's edit form using `TagField`.

---

## Capability

| Capability | Scope | Default roles |
|-----------|-------|---------------|
| `tag.edit` | `backstage` | Owner, Admin |

This single capability gates all four operations: create, edit, delete, and mass-assign. Using one atom keeps the role manager simple — the operations are inseparable in practice (an admin who can rename tags should be able to delete them too).

**Capability changes to existing endpoints:**
- `POST /tags` — change from `article.create` → `tag.edit`
- `PATCH /tags/:id` — change from `article.edit.any` → `tag.edit`
- `DELETE /tags/:id` — change from `article.delete.any` → `tag.edit`

`GET /tags` and `GET /tags/:slug` remain public (needed for customer-facing tag filtering and `TagField` in the article/product forms).

---

## Backend Design

### `TagsService` changes

**`findAll()`** — extend to include product count alongside article count:
```typescript
include: {
  _count: { select: { articles: true, products: true } },
},
```
Return shape adds `product_count: number` alongside the existing `article_count`.

**`remove(id)`** — remove the guard:
```typescript
// DELETE: remove this block entirely
if (tag.articles.length > 0) {
  throw new BadRequestException('Cannot delete tag with associated articles');
}
```
The DB cascade makes this safe. The confirmation dialog in the UI is the user-facing protection.

**`bulkAssign(id, articleIds, productIds)`** — new method:
```typescript
async bulkAssign(tagId: string, articleIds: string[], productIds: string[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    if (articleIds.length) {
      await Promise.all(articleIds.map((aid) =>
        tx.articleTag.upsert({
          where: { article_id_tag_id: { article_id: aid, tag_id: tagId } },
          create: { article_id: aid, tag_id: tagId },
          update: {},
        })
      ));
    }
    if (productIds.length) {
      await Promise.all(productIds.map((pid) =>
        tx.productTag.upsert({
          where: { product_id_tag_id: { product_id: pid, tag_id: tagId } },
          create: { product_id: pid, tag_id: tagId },
          update: {},
        })
      ));
    }
  });
}
```
Using `upsert` on the explicit junction models (rather than `article.update({ tags: { connect } })`) avoids loading the article record and is idempotent.

### `TagsController` changes

- Swap `@RequiresCapability()` on POST/PATCH/DELETE as above
- Add new endpoint:

```typescript
@Post(':id/assign')
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('tag.edit')
@HttpCode(204)
async bulkAssign(@Param('id') id: string, @Body() dto: BulkAssignTagDto): Promise<void> {
  await this.tagsService.bulkAssign(id, dto.article_ids ?? [], dto.product_ids ?? []);
}
```

**`BulkAssignTagDto`:**
```typescript
export class BulkAssignTagDto {
  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  article_ids?: string[];

  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  product_ids?: string[];
}
```

### `capability.seed.ts`

Add to the Admin and Owner role seed entries:
```
'tag.edit'   scope: 'backstage'
```

---

## Frontend Design

### New page: `/admin/tags`

```
frontend/app/admin/tags/page.tsx          — server shell (metadata, cap check)
frontend/app/admin/tags/TagEditorClient.tsx — all client logic
```

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Tags                              [+ Add Tag]       │
├──────────┬────────────┬──────┬────────┬─────────────┤
│ Name     │ Slug       │ Art. │ Prod.  │ Actions      │
├──────────┼────────────┼──────┼────────┼─────────────┤
│ Fiction  │ fiction    │  12  │   3    │ Edit Assign Delete │
│ Sci-Fi   │ sci-fi     │   4  │   0    │ Edit Assign Delete │
│ ...                                                   │
└─────────────────────────────────────────────────────┘
```

- Tags fetched via `GET /tags` (SWR, auto-revalidates after mutations)
- Table sorted by name ascending
- Counts shown as article-icon + number, product-icon + number

**Inline edit row:** clicking Edit expands the row to show name and slug inputs, a Save button, and a Cancel link. Slug field shows a yellow warning banner if it differs from the original slug value. Save calls `PATCH /tags/:id`, closes edit mode, revalidates SWR.

**Add Tag form:** collapsible panel at the top (or a small card below the table). Name input → slug auto-derived (editable). Submit calls `POST /tags`, revalidates, clears form.

**Delete:** clicking Delete shows a `window.confirm`-style inline confirmation card beneath the row (or a small modal) with the counts and the breaking-change warning. Confirm calls `DELETE /tags/:id`, revalidates.

**Assign modal:** full-screen overlay or large dialog:
- Fetches `GET /articles?limit=1000` and `GET /products?limit=1000` on mount
- Derives which IDs already have the tag from their `tags: Tag[]` array
- Two sections: Articles, Products — each a scrollable checklist
- "Select all untagged" shortcut per section
- Confirm button disabled until ≥1 item checked
- Calls `POST /tags/:id/assign`; closes on success; revalidates main tag list

### Admin sidebar

Add a **Tags** nav entry, visible only when the user holds `tag.edit`:

```
frontend/app/admin/layout.tsx
  — Add { label: 'Tags', href: '/admin/tags', icon: Tag, capability: 'tag.edit' }
  — Position: between Articles and Pages (content group)
```

---

## Key Considerations

- **Slug changes are breaking for SearchResultsEmbed nodes.** There is no automatic way to find and update those widget attributes inside stored TipTap JSON across all articles and pages. The UI warning is the only mitigation. A future improvement could scan all content and list affected nodes, but that's out of scope here.
- **Deletion is permanent.** The `onDelete: Cascade` in the schema means the junction rows disappear the moment the tag row is deleted. No soft-delete for tags.
- **No slug uniqueness retry on rename.** If an admin renames tag "Foo" to "Bar" and a "bar" slug already exists, the backend returns a 409. The UI must surface this error clearly.
- **Mass assign is additive only.** To remove a tag from a specific item, use that item's edit form. This scope is intentional — a "mass de-assign" operation with confirmation is a separate concern.
- **Performance.** Fetching up to 1000 articles + 1000 products in the assign modal is fine for a personal CMS. If content grows beyond that, pagination can be added later.
- **`GET /tags` for TagField.** The TagField component uses `GET /tags` with `adminApi` (backstage session). Public users never call this route directly; filtering on the customer-facing side goes through the article/product query params. Changing the tags endpoint capability on POST/PATCH/DELETE does not affect this read path.

---

## Files to Create / Modify

```
backend/src/tags/tags.service.ts
  — findAll(): include product count
  — remove(): delete the "has articles" guard
  — add bulkAssign()

backend/src/tags/tags.controller.ts
  — swap @RequiresCapability on POST/PATCH/DELETE to 'tag.edit'
  — add POST /tags/:id/assign

backend/src/tags/dto/bulk-assign-tag.dto.ts    — new
backend/src/tags/dto/index.ts                   — export new DTO

backend/src/capabilities/capability.seed.ts
  — add 'tag.edit' (backstage) to Owner and Admin entries

frontend/app/admin/tags/page.tsx                — new
frontend/app/admin/tags/TagEditorClient.tsx     — new
frontend/app/admin/layout.tsx                   — add Tags nav entry
```

---

## Completion Report

**Deployed:** 2026-06-27
**Commit(s):** `3916511`

### What changed
Implemented exactly as planned with one minor deviation: `TagChipStrip` does not accept custom `anyLabel`/`allLabel` props, so the exclusion strip uses the existing AND/OR toggle with a helper text note below it explaining the semantics. All four operations (create, rename/re-slug, delete with cascade, bulk-assign) work. The delete confirmation row renders inline below the tag row showing exact article + product counts. The assign modal fetches published articles and products at ≤1000 limit, derives already-tagged items client-side, and uses idempotent upserts on the backend.

---

## Testing Guide

1. **List:** Go to `/admin/tags` — all existing tags appear with correct article and product counts.
2. **Add:** Click Add Tag, enter a name, verify slug auto-generates, submit — tag appears in list with 0 counts.
3. **Edit name only:** Edit a tag's name without changing the slug — no warning shown, save succeeds, all article/product assignments intact.
4. **Edit slug:** Change the slug field — yellow warning banner appears. Save — `PATCH /tags/:id` returns 200, tag slug updated in DB.
5. **Edit duplicate slug:** Try to rename a tag to a slug that already exists — UI surfaces the 409 error inline.
6. **Delete untagged:** Delete a tag with 0 articles and 0 products — succeeds immediately after confirmation.
7. **Delete tagged:** Delete a tag that has articles and products — confirmation shows correct counts, confirm deletes the tag and the article/product assignments are removed (verify by opening an affected article — tag no longer appears).
8. **Mass assign:** Click Assign on a tag — modal opens, already-tagged items shown as non-selectable, untagged items checkable. Select several, confirm — articles/products now have the tag (verify in their edit forms).
9. **Mass assign idempotency:** Assign the same tag to an already-tagged article — no error, no duplicate.
10. **Capability gate:** Log in as a Member — `/admin/tags` is inaccessible (403 or redirect), Tags nav link is hidden.
11. **Admin access:** Log in as an Admin — Tags nav visible, all four operations work.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Initial write-up |
| 2026-06-27 | deployed | Built and shipped in commit 3916511 |
