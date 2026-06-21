# Phase 23 Plan: Mul Converter

**Status**: 📋 PLANNED  
**PRD**: `docs/prd/13-mul-converter.md`  
**Dependencies**: Phase 20 (Appearance/themes), Phase 15 (ISM), Phase 11 (Page zone-layout)

---

## Overview

Implement the Mul Converter — a backstage AI tool that ingests a target public webpage, extracts its visual identity, and emits a custom color palette and a page layout scaffold.

The phase has two sequential parts, each with its own production deployment:

**Part 1 — Page Schema Evolution (Items A–C)**: The existing flat zone model (`layout` + `zones`) cannot express multi-section layouts with per-section backgrounds, which is the minimum needed for Mul Converter scaffolds to be useful. Items A–C implement the section-based content model, section-aware page editor, and page background support. These items have standalone value independent of the Mul Converter and deploy first, followed by a soak period before Part 2 begins.

**Part 2 — Mul Converter (Items D–O)**: The AI tool itself. Owner supplies their own API key (Anthropic or OpenAI); the module handles SSRF-safe fetching, HTML extraction, prompt assembly, structured output parsing, and saving results to the palette and page systems.

Full design specification: `docs/prd/13-mul-converter.md`.

## Deployment Strategy

All work is on branch `feature/phase-23`. Two separate merges to `main → deploy`:

1. **Part 1 deploy**: When items A–C pass acceptance criteria — merge Part 1 commits to `main → deploy`. Continue Part 2 on `feature/phase-23`.
2. **Soak period**: Owner tests the section editor and renderer in production. Bugs fixed on `feature/phase-23`, rebased onto `main`, redeployed as needed.
3. **Part 2 deploy**: When items D–O pass acceptance criteria and AI output quality is considered stable — merge remaining commits to `main → deploy`.

Any hotfixes to `main` during development must be rebased into `feature/phase-23` promptly (`git rebase main` from the feature branch).

---

## Part 1: Page Schema Evolution

### A — Section-Based Content Model (Backend)

Implement the `SectionsPageContent` schema alongside the existing `ZonePageContent` format:

- Define TypeScript types: `PageZone`, `PageSection`, `SectionsPageContent` in `frontend/types/index.ts` and equivalent backend types
  - `PageZone`: `{ id: string; span: number; content: TipTapDoc }`
  - `PageSection`: `{ id: string; columns: number; minHeight?: string; background?: {...}; zones: PageZone[] }`
  - `SectionsPageContent`: `{ type: 'sections'; sections: PageSection[] }`
  - Note: `columns` always equals `sum(zone.span)` — it is derived from spans, not set independently. Stored explicitly for schema consistency and AI round-trips. The human editor never exposes `columns` as an input; it is computed automatically.
- Update `parsePageContent()` in `frontend/lib/pageContent.ts`: detect `obj.type === 'sections'` before falling through to `layout`/`zones` detection
- Update the page renderer (`/[...slug]/page.tsx`): if `type === 'sections'`, render sections as a vertical stack; each section renders a CSS grid with `grid-template-columns: repeat(columns, 1fr)` and each zone gets `grid-column: span N`
- Update `GET /pages/:id` and `POST /pages` backend: accept either schema in the `content` JSONB field — no migration required
- Server-side validation on `POST`/`PATCH /pages`: if content is `type: 'sections'`, verify that each section's zone spans sum to `columns`
- Add **"Upgrade to Section Layout"** action in page settings menu: converts legacy `layout`/`zones` content to a single equivalent section (lossless; mapping defined in PRD). Saves on next explicit save — not auto-saved.

**Files**: `frontend/types/index.ts`, `frontend/lib/pageContent.ts`, `frontend/app/(site)/[...slug]/page.tsx`, `backend/src/pages/pages.service.ts`

---

### B — Section Editor UI

Extend the Page editor in `/admin/pages/[id]` to handle `type: 'sections'` content. Full UX spec in PRD §Section Editor UI.

- New pages default to `type: 'sections'` with a single Full Width section (1 zone, span 1)
- Existing pages with `layout`/`zones` content: load the legacy flat-zone editor unchanged
- **Section header bar** (per section, always visible):
  - ⠿ drag handle — reorder sections via `@dnd-kit/sortable`
  - Template picker button — shows current layout name or "Custom"; opens popover with 7 canonical layouts as visual icons; selecting one warns-then-resets zones if content exists
  - Span diagram — proportional block visual of zones; gutter handles between zones are draggable (redistributes span between neighbours in whole-unit increments, min span 1 per zone); clicking a zone block reveals inline span numeric input
  - ⊕ add zone — appends span-1 zone to right; `columns` += 1
  - ⚙ background flyout — type (None/Color/Image), color picker, Media Library picker, attachment (Scroll/Fixed/Parallax)
  - ↕ height dropdown — Auto / 50vh / 100vh / Custom text input
  - × delete — removes section; warns if content exists
- **Zone body**: TipTap editor fills zone; thin "Span N" label fades on focus; ⊞ split icon on hover triggers Split Zone action (divides span in half; if span=1, expands grid by 1)
- **Zone removal**: × on zone in span diagram; span absorbed by nearest neighbour (right-preferring); warns if content exists
- **Add Section**: button opens template picker popover; selection appends new section with chosen arrangement, empty content
- `columns` is never shown to the user as a raw number — it is computed as `sum(spans)` and stored silently

**Files**: `frontend/app/admin/pages/[id]/PageEditor.tsx` (or equivalent), new `SectionEditor` sub-component

---

### C — Page Background (Section-Level)

Implement the `background` field on each section:

- **Backend**: `background` is stored as part of the section JSON in the `content` JSONB field — no schema change needed
- **Renderer**: apply `background-color`, `background-image: url(...)`, and `background-attachment: fixed|scroll` CSS to the section container element based on `background.type` and `background.attachment`
  - `type: 'color'` → `backgroundColor: value`
  - `type: 'image'` → `backgroundImage: url(resolvedUrl)`, `backgroundSize: cover`, `backgroundPosition: center`
  - `attachment: 'parallax'` → `backgroundAttachment: fixed` + a `transform` or scroll-event approach for the parallax effect (simple CSS fixed-attachment parallax is sufficient for v1)
- **`media://uuid` resolution**: when `background.value` starts with `media://`, resolve the UUID to the actual media URL via the existing media service
- **Editor UI**: background picker in the section header bar — type radio (None / Color / Image), color swatch input for 'color', Media Library picker for 'image', attachment selector (Scroll / Fixed / Parallax)

**Files**: Section renderer, `SectionEditor` background picker, `frontend/lib/pageContent.ts` (background type definitions)

---

## Part 2: Mul Converter

### D — `mul.convert` Capability + Route Guard

- Add `mul.convert` to the capabilities seed (`seed.ts`) — scope `backstage`, default bundle: Owner only
- Add `POST /mul/analyze`, `GET /mul/settings`, `PATCH /mul/settings` — all gated by `@RequiresCapability('mul.convert')`
- Let the seed handle capability insertion on next boot (same pattern as other capability additions)

**Files**: `backend/prisma/seed.ts`, new `MulConverterModule`

---

### E — ISM Keys for Mul Converter

- Add three keys to `ENV_KEY_MAP` in `settings.service.ts`: `mul.provider`, `mul.model`, `mul.api_key_enc`
- No migration needed (SiteSettings stores arbitrary key/value)
- `PATCH /mul/settings` writes these three keys; `GET /mul/settings` reads and redacts `mul.api_key_enc`

**Files**: `backend/src/settings/settings.service.ts`, new `MulConverterController`

---

### F — Custom Palettes ISM Key

- New ISM key: `appearance.custom_palettes` (plaintext JSON array, not `_enc`)
- Extend `GET /settings-public/theme` response to include `customPalettes: ThemePalette[]`
- Extend `PATCH /settings/appearance` to accept + store `customPalettes` in the `system.appearance` namespace
- `AppearanceClient`: merge hardcoded `PALETTES` with `customPalettes` from API response; render custom palettes with a "Custom" badge and a delete button

**Files**: `backend/src/settings/settings.controller.ts`, `frontend/app/admin/settings/appearance/AppearanceClient.tsx`, `frontend/lib/themes.ts`

---

### G — Page Extraction Pipeline (`MulConverterService.extractPageData`)

- Fetch HTML with SSRF validation (same IP-range blocking pattern as `ExternalFeedsService`)
- Parse with a lightweight HTML parser (e.g. `node-html-parser`) — no headless browser
- Extract:
  - All unique CSS hex/rgb/rgba color values (from `<style>` tags + inline `style=""`) — top 30 by frequency
  - Structural DOM summary: tag + class tokens for top 2 DOM levels, ≤150 elements
  - Meta: `<title>`, description, og:image
- Return `PageData` object

**Files**: `backend/src/mul-converter/mul-converter.service.ts`

---

### H — AI Provider Abstraction + Anthropic Provider

- `MulProvider` interface: `analyze(data: PageData): Promise<MulResult>`
- `AnthropicMulProvider`: HTTP POST to `https://api.anthropic.com/v1/messages`
  - Uses tool use (`tool_choice: { type: 'tool', name: 'emit_result' }`) with the `MulResult` JSON schema as the tool input schema
  - No Anthropic SDK required — thin `fetch` wrapper
- `MulConverterService.buildSystemPrompt()` — assembles the full system prompt as documented in PRD §AI System Prompt Design (references section-based schema)
- Response parsing + schema validation via `zod`

**Files**: `backend/src/mul-converter/providers/anthropic-mul.provider.ts`, `backend/src/mul-converter/mul-converter.service.ts`

---

### I — OpenAI Provider

- `OpenAIMulProvider`: HTTP POST to `https://api.openai.com/v1/chat/completions`
  - Uses `response_format: { type: 'json_schema', json_schema: { schema: <MulResultSchema>, strict: true } }` for `gpt-4o` and later
  - Falls back to `response_format: { type: 'json_object' }` with zod validation for older models
- No OpenAI SDK required — thin `fetch` wrapper

**Files**: `backend/src/mul-converter/providers/openai-mul.provider.ts`

---

### J — `MulConverterModule` Wiring

- NestJS module: `MulConverterModule`
- Controller: `MulConverterController` — three endpoints (see Item D)
- Service: `MulConverterService` — orchestrates extraction + AI call
- Provider factory: reads `mul.provider` from ISM, returns the correct `MulProvider` instance
- Register module in `AppModule`

**Files**: `backend/src/mul-converter/` (new directory)

---

### K — Frontend: `/admin/mul-converter` Route + Page Shell

- New Next.js page at `frontend/app/admin/mul-converter/page.tsx`
- Server component: checks `mul.convert` in session capabilities; renders `<AccessRestricted>` if absent
- Client component: `MulConverterClient`
- Add "Mul Converter" nav link in backstage sidebar under the Pages section — shown only when capability is present

**Files**: `frontend/app/admin/mul-converter/page.tsx`, `frontend/app/admin/mul-converter/MulConverterClient.tsx`, `frontend/app/admin/layout.tsx` (sidebar nav)

---

### L — Frontend: Settings Panel + URL Input

- `MulSettingsPanel`: provider radio (`Anthropic` / `OpenAI`), model text field (smart default per provider), API key password field; `PATCH /mul/settings` on save; pre-expands if no provider is configured
- `UrlInputPanel`: URL text input + "Load Preview" button; validates `https?://` client-side before firing
- On "Load Preview": stores the URL in state; renders `PreviewPanel`

**Files**: `MulConverterClient.tsx` (or split into sub-components)

---

### M — Frontend: Preview Panel

- `<iframe src={targetUrl} sandbox="allow-scripts allow-same-origin" />` in a fixed-height (`h-[500px]`) container
- Info note: "If the preview is blank, the site blocks embedding — this won't affect analysis."
- "Analyze this page →" button triggers `POST /mul/analyze`; shows spinner + status string during the request

---

### N — Frontend: Results Panel

- `PaletteResult`: renders 10 color swatches with slot names and hex values; all 10 hex inputs are editable so the owner can tweak before saving
- `LayoutResult`: section count, a visual stack diagram showing the section structure (column count, background indicator, min-height label per section), the AI's `suggestedTitle`
- `AiNotes`: confidence badge (green/yellow/red dot) + `metadata.notes` paragraph
- `ActionBar`: three buttons — "Save Palette", "Create Page Draft", "Save Both"
  - Save Palette: `PATCH /settings/appearance` with `customPalettes` appended
  - Create Page Draft: `POST /pages` with `{ type: 'sections', sections: result.page.sections }` content
  - Save Both: sequential calls; on success redirect to the new page's edit URL

---

### O — Unit Tests

- `MulConverterService` unit tests:
  - SSRF validation (private IPs blocked, loopback blocked, public IPs allowed)
  - `extractPageData`: color extraction, DOM structure trimming
  - `buildSystemPrompt`: returns a non-empty string containing key schema keywords
- `AnthropicMulProvider` unit test: mock fetch, verify request shape, verify response parsing and section schema
- `OpenAIMulProvider` unit test: same pattern
- Section schema: `parsePageContent()` correctly detects `type: 'sections'` vs legacy `layout`/`zones`
- Section schema: server-side span validation rejects sections where zone spans don't sum to `columns`
- Section schema: renderer applies correct `grid-column: span N` per zone for a variety of span arrangements (1+2, 1+2+1, 4, etc.)
- Frontend: `MulConverterClient` render test (settings panel shown when provider unset)

---

## Out of Scope for Phase 23

- Vision/screenshot mode (v2)
- Font pairing extraction (v2)
- Conversion history
- Palette editing beyond the hex input fields in `PaletteResult`
- Section responsive breakpoint overrides
- Freeform/absolute canvas positioning

---

## Acceptance Criteria

### Part 1 — Page Schema (deploy gate before Part 2 begins)
1. New pages default to `type: 'sections'` with a single Full Width section
2. Section editor: owner can add/remove/reorder sections; add/remove/reorder zones within a section; drag gutters to redistribute spans; set min-height; set background (color/image/attachment); choose from 7 canonical layout templates
3. `columns` is never shown as a raw input — derived silently from sum of spans
4. Page renderer correctly renders sections as a vertical stack with per-section CSS grid and background CSS
5. Split Zone works correctly for both span > 1 and span = 1
6. "Upgrade to Section Layout" converts all four legacy layout types losslessly; content is preserved; page saves in section format
7. Existing pages with `layout`/`zones` content continue to render and edit correctly (no regressions)
8. `parsePageContent()` correctly handles both schema types
9. Server-side span validation rejects sections where spans don't sum to `columns`

### Part 2 — Mul Converter
6. Owner with `mul.convert` capability can open `/admin/mul-converter`
7. Owner can configure Anthropic or OpenAI provider + model + API key; key is stored encrypted in ISM
8. Owner enters a public URL; iframe preview renders (with graceful blank-page note if blocked)
9. "Analyze" calls `POST /mul/analyze`; backend SSRF-validates, fetches HTML, extracts data, calls AI
10. Results panel shows palette swatches + section structure diagram within a reasonable time (<30s typical)
11. "Save Palette" appends the custom palette to `appearance.custom_palettes`; it appears in the Appearance panel's palette grid with a "Custom" badge
12. "Create Page Draft" creates a `draft` page with `type: 'sections'` content, visible in the Pages admin list and editable in the section editor
13. "Save Both" does both in sequence
14. All error states (SSRF block, timeout, AI error) show a user-facing message without crashing
15. Owners without `mul.convert` see "Access Restricted" at `/admin/mul-converter`
16. Unit tests pass

---

## Estimated Complexity

**Large**. Part 1 (page schema + section editor) is a self-contained medium-complexity feature — new schema type, new editor UI, new renderer branch. Part 2 (Mul Converter) touches four existing systems plus a new module with two AI provider implementations. The system prompt engineering and structured output parsing are the highest-risk items in Part 2 — plan for iteration cycles before declaring the AI output quality stable.

Sequential implementation order: A → B → C → D → E → F → G → H → I → J → K → L → M → N → O.
