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

### L — Custom font set management

Location: `frontend/app/admin/settings/appearance/` (new `FontSetManager.tsx` component, rendered below the Palettes section in `AppearanceClient.tsx`)

**Problem:** `frontend/lib/fonts.ts` ships with 6 hardcoded Google Font pairings. There is no runtime UI to add new pairings, so users who want a font not in the curated list must edit source code, and the Mul Converter can only output fonts from the static list.

#### L-a — Data shape

```typescript
interface CustomFontSet {
  id: string;           // crypto.randomUUID()
  name: string;         // Display name, e.g. "Playfair + Source Serif"
  headingFamily: string; // CSS font-family, e.g. "Playfair Display, serif"
  bodyFamily: string;    // CSS font-family, e.g. "Source Serif 4, serif"
  headingUrl: string;    // Google Fonts <link> href for the heading family
  bodyUrl?: string;      // Google Fonts <link> href for body (omit if same URL covers both)
  weights?: string;      // e.g. "400;700" — appended to wght axis or ital param as needed
}
```

Stored under `appearance.custom_fonts` ISM key as a JSON array. No new backend model or endpoint required — uses existing `PATCH /settings/appearance`, same as `appearance.custom_palettes`.

The 6 curated pairings in `frontend/lib/fonts.ts` remain as `CURATED_FONTS` and are always present. At runtime, all pickers (Page Font Picker in AppearanceClient, TipTap per-run font dropdown) merge `CURATED_FONTS` with `custom_fonts` from settings, curated first.

#### L-b — Create form

"Add Font Set" button → collapsible inline form at the bottom of the Fonts section:

| Field | Notes |
|---|---|
| Display name | Required; e.g. "Playfair + Source Serif" |
| Heading font family | CSS `font-family` value, e.g. `Playfair Display, serif` |
| Heading URL | Full Google Fonts `<link>` href from fonts.google.com |
| Body font family | CSS `font-family` value |
| Body URL | Google Fonts `<link>` href for body (leave blank if the heading URL covers both) |

**Live preview:** as the user fills in the fields, inject `<link>` tags into the document head and render two sample lines — a heading sentence in the heading family and a body paragraph in the body family. Preview updates on input blur (not every keystroke, to avoid thrashing network requests for incomplete URLs).

**Validation:**
- `name` required and unique among custom font sets
- `headingFamily` required
- `headingUrl` required; must start with `https://fonts.googleapis.com/` or `https://fonts.gstatic.com/`
- `bodyFamily` required
- `bodyUrl` optional; if provided, same URL prefix check

On save: assign a new `id`, append to `appearance.custom_fonts`, `PATCH /settings/appearance`, collapse form.

#### L-c — Font set list

Below the "Add Font Set" button, a card list of existing custom font sets. Each card shows:
- Font set name (bold)
- Heading sample in the heading family (small text, injected via `<link>` at page load)
- Body sample in the body family
- **Edit** (pencil icon) and **Delete** (× icon) buttons

#### L-d — Edit-in-place

Clicking Edit on a custom font set card expands it to the same form as L-b, pre-populated with the existing values. Save overwrites the matching entry by `id` in the array; Cancel collapses without saving. Same live preview as the create form.

#### L-e — Delete

× button on a card:
- Warn if the font set is currently selected as the site's active font (`appearance.selected_font_id` matches this `id`)
- If in use: confirm dialog "This font set is the active site font. Deleting it will reset the site font to the default. Continue?"
- On confirm: remove from array, save. If it was the active font, also reset the active font selection to the first curated pairing.

#### L-f — Export / Import

**Export:**
- "Export" (↓) icon on each custom font set card
- Downloads `{name}.aecms-font.json` with shape:
  ```json
  { "aecmsType": "font-set", "version": 1, "fontSet": { /* CustomFontSet */ } }
  ```

**Import:**
- "Import Font Set" button in the Fonts section header
- `<input type="file" accept=".json">` → parse → validate `aecmsType === 'font-set'` and required fields
- Assign new `id` via `crypto.randomUUID()`
- Warn (not block) if `name` already exists in custom font sets
- Inject URLs and show a live preview before confirming import
- On confirm: append + save via `PATCH /settings/appearance`

#### L-g — Mul Converter integration

When the Mul Converter analyzes an input page and identifies a font pairing that is not in `CURATED_FONTS`, it outputs a full `CustomFontSet` object in its response alongside the page sections and palette:

```json
{
  "suggestedTitle": "...",
  "palette": { ... },
  "customFont": {
    "name": "Cormorant + Libre Baskerville",
    "headingFamily": "Cormorant Garamond, serif",
    "bodyFamily": "Libre Baskerville, serif",
    "headingUrl": "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700",
    "bodyUrl": "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700"
  },
  "sections": [ ... ]
}
```

System prompt update (§ "Page schema" → fonts): The AI is instructed that if it selects a font pairing not in the curated list, it must output a complete `customFont` object with all required fields populated. If it selects a curated pairing, `customFont` is omitted and `selectedFontId` references a curated id.

ActionBar save flow:
1. If `customFont` is present in the result: before saving the page, `PATCH /settings/appearance` to append the font set to `appearance.custom_fonts` (non-fatal — save continues even if this fails)
2. Apply `selectedFontId` (or the newly saved custom font's `id`) as the page's font selection
3. Continue with palette save and page creation as before

### M — Mul Converter ActionBar integration

- Add "Save as Template" checkbox to `ActionBar.tsx` (default unchecked)
- When checked + Save Both / Create Page fires:
  - After page creation, `POST /templates` with result's sections, result's palette id (if palette was saved), and the Mul's `suggestedTitle` as template name
  - Non-fatal: template save failure doesn't roll back page creation

### N — CLAUDE.md + completion report

- Add Phase 27 entry to CLAUDE.md status list
- Link PRD in docs table
- Write `PHASE_27_COMPLETION_REPORT.md` after implementation

---

## Sequencing notes

- **A–C** (backend) are prerequisites for H–M; can be built independently of D–G and L
- **D–G** (manual palette + export/import) have zero backend dependencies — can ship first as a standalone increment if desired
- **H–M** all depend on A–C
- **L** (custom font sets — L-a through L-g) has zero backend dependencies — same standalone profile as D–G; L-b through L-f can ship without L-g (Mul Converter integration)
- **L-g** (Mul Converter font output) depends on L-b/L-c being implemented so the saved font set appears in the picker immediately after a Mul conversion
- **M** depends on H (both use `POST /templates`)

The **D–G + L-a through L-f** cluster (palette editor + full font set CRUD + export/import) is small enough to ship before the template infrastructure is ready — it completes the design-system story started by the Mul Converter and has real standalone value. L-g and M can follow in a second increment once the template backend (A–C) is also ready.
