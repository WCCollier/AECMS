# Phase 27 — Design Library

**Status:** 📋 Planned  
**PRD:** `docs/prd/16-design-library.md`  
**Depends on:** Phase 23 (section schema + custom palettes infrastructure)

---

## Goal

Close the loop on AECMS's design capabilities: make good page designs and color palettes saveable, reusable, and tradeable across instances. The Mul Converter generates designs; this phase makes them first-class persistent artifacts.

Three coherent sub-systems, sequenced so earlier ones can ship independently:

1. **Manual palette creation** — build and edit custom palettes without the Mul Converter
2. **Page template library** — save any section-based page as a reusable template
3. **Export / import** — stable JSON formats for palettes and templates; enables community sharing with no platform infrastructure

See PRD for full design spec, file format, access control model, and non-goals.

---

## Implementation items

### A — `template.manage` capability seed

Add to `backend/prisma/seed.ts`:
- Capability: `template.manage`, scope `backstage`, category `content`
- Assign to: Owner, Admin roles

### B — `PageTemplate` Prisma model

Add to `backend/prisma/schema.prisma`:

```prisma
model PageTemplate {
  id           String   @id @default(uuid())
  name         String
  description  String?
  thumbnailId  String?
  sectionsJson Json
  paletteId    String?
  tags         String[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Migration: `npx prisma migrate dev --name add_page_templates`

### C — TemplatesModule backend

New NestJS module at `backend/src/templates/`:
- `TemplatesController` (`/templates`) — all routes gated `BackstageGuard` + `template.manage`
- `TemplatesService` — CRUD via Prisma
- Endpoints:
  - `GET /templates` — list (with optional `?tags=` filter)
  - `POST /templates` — create; body: `{ name, description?, tags?, sectionsJson, paletteId? }`
  - `GET /templates/:id` — fetch single
  - `PATCH /templates/:id` — update metadata or sectionsJson
  - `DELETE /templates/:id` — hard delete (templates have no soft-delete semantics)
- Register in `app.module.ts`

### D — Manual palette creation UI

Location: `frontend/app/admin/settings/appearance/AppearanceClient.tsx` (or extract to `PaletteEditor.tsx` component)

- "Create Palette" button → inline form (collapsible, below existing palette grid)
- 10 hex inputs with color swatch preview, one per token
- Name field + scheme toggle (light / dark)
- Save → `PATCH /settings/appearance` with new palette appended
- On success: `mutateTheme()` to refresh grid

No backend changes — uses existing `PATCH /settings/appearance` + `appearance.custom_palettes` ISM key.

### E — Palette edit-in-place

- Clicking a custom palette in AppearanceClient expands it to the 10-slot form, pre-populated
- Save overwrites the matching entry by `id` in the array
- Cancel collapses without saving

### F — Contrast ratio warnings

- In the palette editor form, compute contrast ratios client-side:
  - `foreground` vs `background` — warn if < 4.5:1
  - `muted` vs `background` — warn if < 3:1
  - `accent-foreground` vs `accent` — warn if < 4.5:1
- Yellow border + ratio display on failing inputs; non-blocking

Use the W3C luminance formula (no external library needed — ~10 lines of math).

### G — Palette export / import

**Export:**
- "Export" (↓) icon button per custom palette in AppearanceClient
- Generates `AecmsPalette` JSON (see PRD §4), triggers browser download as `{name}.aecms-palette.json`

**Import:**
- "Import Palette" button in Appearance tab header
- `<input type="file" accept=".json">` → parse → validate `aecmsType === 'palette'` and presence of all 10 color keys
- Assign new `id` via `crypto.randomUUID()`
- Warn (not block) if `name` already exists in custom palettes
- Append + save via `PATCH /settings/appearance`

### H — "Save as Template" in SectionEditor

- Add "Save as Template…" button to `SectionsPageEditor` toolbar (visible to users with `template.manage`)
- Opens modal: name (required), description, tags (comma-separated), palette link (dropdown of current custom palettes, optional)
- On submit: `POST /templates` with current page's `sections` array
- Success toast with link to `/admin/templates`

### I — `/admin/templates` browse page

`frontend/app/admin/templates/`:
- `page.tsx` — server component wrapper
- `TemplatesClient.tsx` — SWR-fetched grid
  - Card per template: thumbnail (media image, or palette color swatch strip, or generic)
  - Name, description excerpt, tag chips
  - "Use Template", "Export", "Delete" actions
- Tag filter bar at top

### J — Create-from-template flow

"Use Template" button on a template card:
- Modal: title field, slug field (auto-derived, editable)
- On confirm: `POST /pages` with `contentType: 'sections'`, `content: { sections: template.sectionsJson }`
- If template has `paletteId`: check if palette exists in current `customPalettes`; if not, offer to add it (checkbox in modal)
- On page created: `router.push('/admin/pages/{id}')` → lands in SectionEditor

### K — Template export / import

**Export:**
- "Export" icon on template card → downloads `.aecms-template.json`
- If `paletteId` set and palette resolves in current `customPalettes`: embed full palette object inline
- Format: `AecmsTemplate` (see PRD §4)

**Import:**
- "Import Template" button on `/admin/templates` header
- File picker → parse → validate `aecmsType === 'template'`
- If file contains inline palette: show checkbox "Also import palette '{name}'" (default checked)
- `POST /templates` to create template record; optionally `PATCH /settings/appearance` to add palette

### L — Mul Converter ActionBar integration

- Add "Save as Template" checkbox to `ActionBar.tsx` (default unchecked)
- When checked + Save Both / Create Page fires:
  - After page creation, `POST /templates` with result's sections, result's palette id (if palette was saved), and the Mul's `suggestedTitle` as template name
  - Non-fatal: template save failure doesn't roll back page creation

### M — CLAUDE.md + completion report

- Add Phase 27 entry to CLAUDE.md status list
- Link PRD in docs table
- Write `PHASE_27_COMPLETION_REPORT.md` after implementation

---

## Sequencing notes

- **A–C** (backend) are prerequisites for H–L; can be built independently of D–G
- **D–G** (manual palette + export/import) have zero backend dependencies — can ship first as a standalone increment if desired
- **H–L** all depend on A–C
- **L** depends on H (both use `POST /templates`)

The D–G cluster is small enough to consider shipping before the template infrastructure is ready — it completes the palette story started by the Mul Converter and has real standalone value.
