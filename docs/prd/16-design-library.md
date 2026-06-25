# PRD 16 — Design Library
**Phase 27 · Status: planning**

---

## 1. Vision

AECMS pages are built from a vertical stack of sections, each fully configurable. The Mul Converter can generate a complete page scaffold in seconds. But once a good design exists — whether AI-generated or hand-crafted — there is currently no way to save it, reuse it, share it, or trade it.

The Design Library closes that gap. It introduces:

1. **Manual palette creation** — build custom color palettes by hand, not just via Mul
2. **Page template library** — save any page layout as a named, reusable template
3. **Export / import** — stable JSON file formats for palettes and templates, making designs portable across AECMS instances

The long-term payoff is a community exchange layer: owners share `.aecms-template.json` and `.aecms-palette.json` files on GitHub, forums, or a future marketplace without any platform infrastructure required from us.

---

## 2. Relationship to existing systems

### Custom palettes (already exists, Phase 23 Part 2)
The `appearance.custom_palettes` ISM key already stores a JSON array of `ThemePalette` objects. `PATCH /settings/appearance` already accepts and saves them. `AppearanceClient` already renders custom palettes with a "Custom" badge and delete button. The Mul Converter is the only current path to add one.

### Section-based pages (Phase 23 Part 1)
Pages with `content_type: 'sections'` store a `SectionsPageContent` object containing a `sections` array. This is the raw material for templates — a template is essentially a `sections` array with a name and optional palette reference attached.

### Appearance capability
`system.appearance` (Owner + Admin) already gates palette writes. Templates will be gated similarly.

---

## 3. Feature areas

### 3A — Manual palette creation

**What:** A color-picker UI in the Appearance tab of Admin Settings that lets an owner or admin assemble a 10-slot custom palette by hand and save it.

**The 10 token slots** (same schema as generated palettes):

| Token | Role |
|---|---|
| `background` | Page background — dominant base |
| `surface` | Cards, panels — 10–15% step from background |
| `surface-raised` | Nested cards, hover states — further step |
| `foreground` | Primary text — ≥ 4.5:1 contrast on background |
| `muted` | Secondary text — ≥ 3:1 contrast on background |
| `border` | Divider lines — subtle step from background |
| `accent` | Brand / interactive color |
| `accent-hover` | ~10% darker than accent |
| `accent-dim` | ~20% darker than accent |
| `accent-foreground` | Text on accent — ≥ 4.5:1 contrast on accent |

**UI:**
- "Create Palette" button in Appearance tab opens an inline form (or modal)
- 10 inputs: hex text field + color swatch picker per slot; live preview of the AECMS color variable set
- Name field (required)
- Scheme selector: `light` | `dark` (for the `scheme` field used by zone scheme logic)
- Save → appends to `appearance.custom_palettes` via `PATCH /settings/appearance`

**Edit existing:** Clicking a custom palette in AppearanceClient expands it into the same 10-slot form, pre-populated. Save overwrites the matching entry by `id`.

**Contrast warnings:** Non-blocking inline warnings (yellow border) when a computed contrast ratio falls below the WCAG thresholds for foreground/muted/accent-foreground slots. Owner can override.

---

### 3B — Page template library

**What:** Any page with `content_type: 'sections'` can be saved as a named template. Templates live in a library, browseable at `/admin/templates`, and can be used to instantiate new pages.

**New Prisma model:**

```prisma
model PageTemplate {
  id            String   @id @default(uuid())
  name          String
  description   String?
  thumbnailId   String?           // media UUID — optional screenshot
  sectionsJson  Json              // copy of the sections array at save time
  paletteId     String?           // custom palette id to co-activate, or null
  tags          String[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

`paletteId` is a soft reference (string, not a FK) to a custom palette `id` in `appearance.custom_palettes`. When creating a page from template, if `paletteId` is set and the palette doesn't exist in the target instance (import scenario), the template can carry the palette inline.

**Save-as-template action:**
- "Save as Template…" button in SectionEditor toolbar (Owner/Admin only, gated by new `template.manage` capability)
- Modal: name field, optional description, optional tag(s), optional palette link (dropdown of current custom palettes)
- On save: `POST /templates` with the current page's `sections` array

**Browse library (`/admin/templates`):**
- Thumbnail grid — thumbnail image if set, else auto-generated color swatch from the linked palette, else a generic placeholder
- Filter by tag
- "Use Template" → opens a create-page dialog (title + slug), then `POST /pages` with sections pre-populated
- "Delete", "Edit metadata" actions

**Mul Converter integration:**
- ActionBar gains an optional "Save as Template" checkbox in addition to "Create Page" and "Save Palette"
- When checked and user clicks Save Both / Create Page: after page creation, also `POST /templates` with the result

---

### 3C — Export / import

**Palette export:**
- "Export" button on each custom palette entry in AppearanceClient
- Downloads a single `.aecms-palette.json` file

**Palette import:**
- "Import Palette" button in Appearance tab
- File picker accepting `.json` / `.aecms-palette.json`
- Validates schema, assigns new `id` (preserves `name`), appends to `appearance.custom_palettes`
- Shows conflict warning if a palette with the same `name` already exists (not a block — owner decides)

**Template export:**
- "Export" button on each template in `/admin/templates`
- Downloads `.aecms-template.json` — includes `sectionsJson`, `name`, `description`, `tags`, and the full palette object inline if `paletteId` resolves

**Template import:**
- "Import Template" button on `/admin/templates`
- File picker accepting `.json` / `.aecms-template.json`
- If file contains an inline palette: optionally import it too (separate checkbox)
- Inserts template record; does not automatically create a page

---

## 4. File format specification

### `AecmsPalette` (`.aecms-palette.json`)

```json
{
  "aecmsType": "palette",
  "version": 1,
  "palette": {
    "id": "<uuid>",
    "name": "Midnight Technocrat",
    "scheme": "dark",
    "colors": {
      "background":        "#0d1117",
      "surface":           "#161b22",
      "surface-raised":    "#21262d",
      "foreground":        "#e6edf3",
      "muted":             "#8b949e",
      "border":            "#30363d",
      "accent":            "#238636",
      "accent-hover":      "#2ea043",
      "accent-dim":        "#196127",
      "accent-foreground": "#ffffff"
    }
  }
}
```

### `AecmsTemplate` (`.aecms-template.json`)

```json
{
  "aecmsType": "template",
  "version": 1,
  "template": {
    "name": "Dark Hero + Three-Column Features",
    "description": "...",
    "tags": ["landing", "dark", "tech"],
    "sectionsJson": [ /* sections array */ ],
    "palette": { /* inline AecmsPalette.palette object, or null */ }
  }
}
```

`aecmsType` and `version` are the discriminator fields for import validation. Version bumps are additive; importers should accept any `version >= 1`.

---

## 5. Access control

| Action | Capability |
|---|---|
| Create / edit / delete custom palette | `system.appearance` (existing) |
| Import / export palette | `system.appearance` |
| Save page as template | `template.manage` (new) |
| Browse template library | `template.manage` |
| Create page from template | `template.manage` |
| Export / import template | `template.manage` |

`template.manage`: scope `backstage`. Default assignment: Owner + Admin (mirrors `system.appearance` pattern).

---

## 6. Non-goals for Phase 27

- **Hosted marketplace / discovery feed** — community trading happens via file sharing; no platform infrastructure needed
- **Template versioning** — templates are snapshots; edit by re-save
- **Thumbnail auto-capture** (e.g. headless browser screenshot) — thumbnail is optional upload; auto-capture is a future enhancement
- **Per-zone palette overrides in templates** — zone `scheme` (light/dark) already handles this at the section level

---

## 7. Implementation sequence

**A** — `template.manage` capability seed  
**B** — `PageTemplate` Prisma model + migration  
**C** — `TemplatesModule` backend (CRUD endpoints: `GET /templates`, `POST /templates`, `GET /templates/:id`, `PATCH /templates/:id`, `DELETE /templates/:id`)  
**D** — Manual palette creation UI (Appearance tab — no backend changes needed)  
**E** — Palette edit-in-place (AppearanceClient expansion)  
**F** — Contrast ratio warning indicators in palette editor  
**G** — Palette export / import (Appearance tab)  
**H** — "Save as Template" action in SectionEditor  
**I** — `/admin/templates` browse page  
**J** — Create-from-template flow  
**K** — Template export / import  
**L** — Mul Converter ActionBar "Save as Template" option  
**M** — CLAUDE.md update, completion report  

A–C are backend prerequisites. D–G are independent of B–C and can be built in parallel. H–L depend on B–C.
