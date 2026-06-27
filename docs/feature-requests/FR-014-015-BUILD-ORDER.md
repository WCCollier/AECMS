# FR-014 + FR-015 Combined Build Order

Both FRs are additive — no schema migrations, no column renames, no data backfills. They can ship in a single PR. Build FR-014 first (backend capability infrastructure is a prerequisite for nothing in FR-015, but it's cleaner to land the simpler one first and keep the commit history readable).

---

## FR-014: Tag Editor

### No migrations required
- No new Prisma models or columns
- Capability rows are added by the existing seed mechanism (run once after deploy via `prisma db seed` or the capability sync on Owner login)

---

### Step 1 — Backend: capability + DTO

**`backend/src/capabilities/capability.seed.ts`**
- Add `{ name: 'tag.edit', scope: 'backstage', description: 'Create, rename, delete, and bulk-assign tags' }` to the capabilities list
- Add `'tag.edit'` to the Owner and Admin role seed entries

**`backend/src/tags/dto/bulk-assign-tag.dto.ts`** _(new)_
```typescript
export class BulkAssignTagDto {
  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  article_ids?: string[];

  @IsArray() @IsUUID('4', { each: true }) @IsOptional()
  product_ids?: string[];
}
```

**`backend/src/tags/dto/index.ts`**
- Export `BulkAssignTagDto`

---

### Step 2 — Backend: service changes

**`backend/src/tags/tags.service.ts`**

`findAll()` — extend Prisma include to count both articles and products:
```typescript
_count: { select: { articles: true, products: true } },
```
Return shape gains `product_count`; `article_count` already present.

`remove()` — delete the guard block that throws when the tag has articles. The DB `onDelete: Cascade` on both junction tables handles cleanup automatically.

`bulkAssign(tagId, articleIds, productIds)` — new method: upsert rows into `article_tags` / `product_tags` in a transaction using the explicit junction models. Idempotent.

---

### Step 3 — Backend: controller changes

**`backend/src/tags/tags.controller.ts`**
- `POST /tags` → change `@RequiresCapability('article.create')` to `'tag.edit'`
- `PATCH /tags/:id` → change from `'article.edit.any'` to `'tag.edit'`
- `DELETE /tags/:id` → change from `'article.delete.any'` to `'tag.edit'`
- Add new endpoint `POST /tags/:id/assign` — `tag.edit`, `@HttpCode(204)`, calls `bulkAssign()`

---

### Step 4 — Frontend: admin page

**`frontend/app/admin/tags/page.tsx`** _(new)_
- Server component shell; metadata `{ title: 'Tags' }`; renders `<TagEditorClient />`

**`frontend/app/admin/tags/TagEditorClient.tsx`** _(new)_

UI sections:
1. **Header row** — "Tags" heading + "Add Tag" collapsible form (name input → auto-slug → `POST /tags`)
2. **Tag table** — SWR fetch of `GET /tags`; columns: Name, Slug, Articles, Products, Actions
3. **Inline edit row** — Edit button expands the row to name + slug inputs; slug field shows yellow warning banner when it differs from original; Save → `PATCH /tags/:id`; Cancel collapses
4. **Delete** — inline confirmation card showing article + product counts and the breaking-change warning; Confirm → `DELETE /tags/:id`
5. **Assign modal** — fetches `GET /articles?limit=1000` and `GET /products?limit=1000`; derives already-tagged items from their `tags[]` array; renders two checkable sections; Confirm → `POST /tags/:id/assign`; revalidates main SWR key on success

---

### Step 5 — Frontend: sidebar nav

**`frontend/app/admin/layout.tsx`**
- Add `{ label: 'Tags', href: '/admin/tags', icon: Tag, capability: 'tag.edit' }` in the content group (between Articles and Pages)

---

## FR-015: Collection Embed Extensions

### No migrations required
- New node attributes default gracefully in existing serialized TipTap JSON (missing attr = default value)
- New query params are optional; existing callers without them are unaffected

---

### Step 6 — Backend: tag exclusion query params

**`backend/src/articles/dto/query-articles.dto.ts`**
- Add `exclude_tags?: string` (`@IsString @IsOptional`)
- Add `exclude_tag_logic?: 'any' | 'all'` (`@IsEnum @IsOptional`, default `'any'`)

**`backend/src/articles/articles.service.ts`** — in `findAll()`, after existing inclusion tag logic:
```typescript
// 'any': exclude if has ANY excluded tag
where.NOT = { tags: { some: { tag: { slug: { in: excludeSlugs } } } } };

// 'all': exclude only if has EVERY excluded tag
where.NOT = {
  AND: excludeSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } })),
};
```

**`backend/src/products/dto/query-products.dto.ts`** — same additions

**`backend/src/products/products.service.ts`** — same NOT clause in `findAll()`

---

### Step 7 — Frontend: hook additions

**`frontend/hooks/useArticles.ts`**
**`frontend/hooks/useInfiniteArticles.ts`**
**`frontend/hooks/useProducts.ts`**
**`frontend/hooks/useInfiniteProducts.ts`**

Each gains two optional params: `excludeTags?: string[]`, `excludeTagLogic?: 'any' | 'all'`. Build into query string: `exclude_tags=a,b&exclude_tag_logic=any`. No changes to callers that don't supply them.

---

### Step 8 — Frontend: new item components

All four are new files in `frontend/components/widgets/SearchResultsEmbed/`:

**`ArticlePreviewPane.tsx`**
- Props: `article: Article`, `depth: number`
- `100dvh` wrapper, `overflow: hidden`, `position: relative`
- Renders title + author/date line + `<RichTextContent content={article.content} depth={depth + 1} />`
- Bottom fade: `position: absolute; bottom: 0; gradient transparent → var(--background); pointer-events: none`
- "Continue reading →" link to `/articles/:slug`

**`ArticleFullEmbed.tsx`**
- Props: `article: Article`, `depth: number`
- Renders full article: title, author/date, tags strip, `<RichTextContent content={article.content} depth={depth + 1} />`
- Followed by `<hr>` divider

**`ProductPreviewPane.tsx`**
- Same pattern as ArticlePreviewPane; uses `product.description` for body
- "View product →" link to `/shop/:slug`

**`ProductFullEmbed.tsx`**
- Full product: title, price badge, `<RichTextContent content={product.description} depth={depth + 1} />`
- "View product →" CTA button at bottom; `<hr>` divider

---

### Step 9 — Frontend: RichTextContent depth guard

**`frontend/components/editor/RichTextContent.tsx`** (or wherever TipTap read-only is configured)

Add `depth?: number` prop (default `0`). Pass it into the TipTap editor extensions or node views. When `depth > 0`, the `SearchResultsEmbed` node view renders:
```tsx
<div className="border border-foreground/10 rounded px-3 py-2 text-sm text-foreground/40 my-4">
  [Collection embed]
</div>
```
instead of the live widget. This is the entire recursion guard — one prop, one conditional in the node view.

---

### Step 10 — Frontend: SearchResultsWidget

**`frontend/components/widgets/SearchResultsWidget.tsx`**

New props: `excludeTags?: string[]`, `excludeTagLogic?: 'any' | 'all'`, `depth?: number` (default `0`)

Pass `excludeTags` and `excludeTagLogic` through to all four hooks.

Add render branches alongside existing `display === 'grid'` / `'list'`:
```tsx
if (display === 'preview') {
  return items.map((item) =>
    contentType === 'articles'
      ? <ArticlePreviewPane key={item.id} article={item} depth={depth} />
      : <ProductPreviewPane key={item.id} product={item} depth={depth} />
  );
}
if (display === 'full') {
  return items.map((item) =>
    contentType === 'articles'
      ? <ArticleFullEmbed key={item.id} article={item} depth={depth} />
      : <ProductFullEmbed key={item.id} product={item} depth={depth} />
  );
}
```

Pagination / infinite scroll wiring is unchanged — it wraps the render output regardless of display mode.

---

### Step 11 — Frontend: TipTap node + config panel

**`frontend/components/editor/extensions/search-results-embed.tsx`**

**New attributes:**
```typescript
excludeTags:     { default: '[]' },
excludeTagLogic: { default: 'any' },
// display already exists — extend valid values to include 'preview' | 'full'
```

**Config panel additions:**
- Display selector: add "Preview (100vh pane)" and "Full article/product" options; hide the Grid/List radio when either is active
- Below the inclusion `TagChipStrip`: add a second `TagChipStrip` labelled "Exclude tags", wired to `excludeTags` / `excludeTagLogic`; label the toggle "Exclude if has ANY / ALL" to disambiguate from the inclusion toggle
- Info callout when `display === 'preview' || 'full'`: _"Full/Preview display renders the complete body inline. Keep page size small or use pagination to avoid very long pages."_

**Node view** (`SearchResultsEmbedNodeView`): pass `depth={0}` explicitly to `SearchResultsWidget` (the node view is always at depth 0; recursion only happens via `RichTextContent` → embedded articles).

---

## Deployment

Single commit to `main` → merge to `deploy` → CI builds → Cloud Run deploys.

**Post-deploy owner action required:**
Run `prisma db seed` (or log in as Owner — the FR-014 `tag.edit` capability is added to the seed; Owner login triggers capability sync via FR-002). This seeds the new capability and role associations on the live database.

**Verification order:**
1. Log in as Admin → `/admin/tags` is visible and all four operations work
2. Log in as Member → `/admin/tags` inaccessible
3. Edit any article → add "Sponsored" tag → create a collection embed with "Sponsored" in the exclusion filter → verify it's absent from results
4. Create a page with `display: preview` on a collection embed → publish → visit consumer page → panes render at 100dvh with fade
5. Create a page with `display: full` → verify complete content renders; if any article itself embeds a collection, verify `[Collection embed]` placeholder appears

---

## File Count

| FR | New files | Modified files |
|----|-----------|----------------|
| FR-014 | 3 (DTO, page, TagEditorClient) | 4 (capability seed, tags service, tags controller, admin layout) |
| FR-015 | 4 (4 item components) | 9 (2 DTOs, 2 services, 4 hooks, SearchResultsWidget, search-results-embed node, RichTextContent) |
| **Total** | **7** | **13** |
