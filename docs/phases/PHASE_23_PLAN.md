# Phase 23 Plan: Mul Converter

**Status**: 🚧 IN PROGRESS — Part 1 built (2026-06-21), pending testbed QA before Part 1 deploy  
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

### ✅ A — Section-Based Content Model (Backend)

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

### ✅ B — Section Editor UI

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

### ✅ C — Page Background (Section-Level)

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

### Part 1 Implementation Notes (commit dabf7b4, 2026-06-21)

**Files added/modified:**
- `frontend/types/index.ts` — added `SectionBackground`, `PageZone`, `PageSection`, `SectionsPageContent`, `AnyPageContent`
- `frontend/lib/pageContent.ts` — added `isSectionsContent()`, `parseAnyPageContent()`, `legacyToSections()`, `defaultSectionsContent()`; `parsePageContent()` remains backward-compatible
- `frontend/components/pages/layouts/SectionsLayout.tsx` — new renderer; sections as vertical CSS grid stack with background + minHeight
- `frontend/components/pages/PageRenderer.tsx` — branches on `isSectionsContent()` before legacy layout switch
- `frontend/components/admin/SectionEditor.tsx` — per-section editor: template picker (7 canonical templates), span diagram with pointer-capture gutter drag, add zone, background flyout (color/image/attachment), height selector, delete, split-zone action, TipTap zone editors in CSS grid
- `frontend/components/admin/SectionsPageEditor.tsx` — manages sections array; dnd-kit vertical reorder; Add Section button
- `frontend/app/admin/pages/[id]/edit/EditPageClient.tsx` — detects content mode on load; sections mode uses SectionsPageEditor; legacy mode retains PageZoneEditor + "Upgrade to Section Layout" conversion button
- `frontend/app/admin/pages/new/NewPageClient.tsx` — simplified; new pages default to `defaultSectionsContent()` (single Full Width section); legacy layout picker removed
- `backend/src/pages/pages.service.ts` — `validateSectionsContent()` called in `create()` and `update()`; rejects spans-≠-columns

**Status:** Built and type-checked. 125 frontend + 190 backend unit tests passing. Awaiting testbed QA before Part 1 deploy to `main → deploy`.

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

---

## Part 3: Scroll-Driven Background Transitions + Gradient Overlays

**Status**: 📋 Planned — begins after Part 2 passes testbed QA and deploys

Part 3 is a renderer and schema evolution with no backend changes. It implements true simultaneous crossfade between section backgrounds, a full transition vocabulary (fade, clip wipes, slide, parallax), gradient overlay masks, and an enriched HTML extraction pipeline that gives the Mul Converter enough signal to select transitions intelligently. No production pages currently use the sections format, so there is no backward compatibility concern for schema changes.

---

### P — Schema: `background.transition` field + `attachment` removal

Introduce `transition` on `SectionBackground` and **remove `attachment` entirely**:

```typescript
transition?: 'none' | 'fixed' | 'fade' | 'wipe-v' | 'wipe-left' | 'wipe-right' | 'slide-up' | 'parallax'
// attachment removed — transition now covers all scroll behaviour cases.
```

`transition` controls both whether a section's background enters the fixed-position stack and how it exits. The fixed stack is an **opt-in** — only engaged when `transition !== 'none'`:

| Value | Rendering | Effect |
|---|---|---|
| `'none'` (default) | **Inline on section div** — scrolls naturally with content | Normal web behaviour; plain websites |
| `'fixed'` | Fixed-position stack, no exit animation | Window-pane: content scrolls over a planted background. Replaces old `attachment: 'fixed'` |
| `'fade'` | Fixed-position stack, opacity 1→0 on exit | Dissolves into section below |
| `'wipe-v'` | Fixed-position stack, clip-path upward on exit | Vertical clip wipe |
| `'wipe-left'` | Fixed-position stack, clip-path left on exit | Lateral wipe, reveals next from right |
| `'wipe-right'` | Fixed-position stack, clip-path right on exit | Lateral wipe, reveals next from left |
| `'slide-up'` | Fixed-position stack, translateY upward on exit | Background slides off screen |
| `'parallax'` | Fixed-position stack, image drifts at ~50% scroll speed | Depth effect; overlay stays planted |

Sections with `transition: 'none'` are entirely uninvolved in the crossfade stack — their backgrounds render as ordinary inline CSS and scroll naturally with the page. Crossfade only occurs between adjacent sections that are both in the fixed stack.

Read-time fallback: stored `attachment: 'parallax'` → `transition: 'parallax'`; stored `attachment: 'fixed'` → `transition: 'fixed'`; all other `attachment` values silently ignored.

**Files**: `frontend/types/index.ts`, `backend/src/pages/pages.service.ts` (validation update)

---

### Q — Schema: gradient overlay

Extend `SectionBackground.overlay` to support gradient masks:

```typescript
overlay?: {
  color?: string      // hex — solid color scrim (existing)
  opacity?: number    // 0–1 — applies only when color is set, no gradient
  gradient?: string   // CSS gradient string — when present, overrides color+opacity
}
```

When `gradient` is set, the overlay div renders `background: <gradient>` directly — alpha is baked into the gradient stops. When only `color` is set, existing behaviour is preserved exactly.

Named patterns (offered as presets in the editor, emittable by the AI):
- **Bottom vignette**: `linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)`
- **Top vignette**: `linear-gradient(to top, transparent 30%, rgba(0,0,0,0.75) 100%)`
- **Dual vignette**: `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.5) 100%)`
- **Radial vignette**: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)`
- **Side fade**: `linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 60%)`

**Files**: `frontend/types/index.ts`

---

### R — Renderer restructure: true crossfade architecture

The renderer splits into two independent render passes. Background composites (image + overlay) are lifted out of their section containers and rendered as a fixed-position stack. Content sections become transparent scroll spacers with no background CSS of their own.

**DOM structure:**

```tsx
<div className="w-full" style={fontVarStyle}>

  {/* PASS 1: Fixed background stack — all composites, z-ordered by section position */}
  <div aria-hidden className="pointer-events-none">
    {content.sections.map((section, i) => {
      if (!section.background || section.background.type === 'none') return null;
      const zIndex = content.sections.length - i;  // earlier = higher z
      return (
        <div
          key={section.id}
          data-bg-for={section.id}
          className="fixed inset-0"
          style={{ zIndex: -zIndex }}
        >
          {/* Sub-layer A: background image or gradient */}
          {section.background.type === 'parallax'
            ? (
              // Parallax: image and overlay are siblings; transform on image only
              <>
                <div className="absolute inset-[-20%]"
                     style={{ backgroundImage: ..., animation: 'parallax-drift ...', animationTimeline: 'view()' }} />
                <div className="absolute inset-0" style={overlayStyle(section.background.overlay)} />
              </>
            ) : (
              // All other transitions: image and overlay are children of the transitioning composite
              <div className="absolute inset-0" style={compositeTransitionStyle(section.background)}>
                <div className="absolute inset-0" style={bgImageStyle(section.background)} />
                {section.background.overlay && (
                  <div className="absolute inset-0" style={overlayStyle(section.background.overlay)} />
                )}
              </div>
            )
          }
        </div>
      );
    })}
  </div>

  {/* PASS 2: Content sections — transparent scroll spacers */}
  {content.sections.map((section) => (
    <div
      key={section.id}
      id={`section-${section.id}`}
      className={`relative ${paddingClass(section.padding)}`}
      style={{ minHeight: section.minHeight }}
    >
      <div style={gridStyle(section)}>
        {section.zones.map(zone => <ZoneRenderer key={zone.id} zone={zone} />)}
      </div>
    </div>
  ))}

</div>
```

**Z-ordering rule:** Section 0 (topmost in page) gets the highest z-index — it starts on top and fades/wipes/slides to reveal section 1 beneath it. Scrolling down peels layers away in order.

**Transition mechanics per `transition` value:**

| Value | Applied to | CSS mechanism | `animation-range` |
|---|---|---|---|
| `none` | — | no animation | — |
| `fade` | composite wrapper | `opacity: 1 → 0` | `exit 0% exit 100%` |
| `wipe-v` | composite wrapper | `clip-path: inset(0% 0 0 0 → 100% 0 0 0)` | `exit 0% exit 100%` |
| `wipe-left` | composite wrapper | `clip-path: inset(0 0% 0 0 → 0 100% 0 0)` | `exit 0% exit 100%` |
| `wipe-right` | composite wrapper | `clip-path: inset(0 0 0 0% → 0 0 0 100%)` | `exit 0% exit 100%` |
| `slide-up` | composite wrapper | `transform: translateY(0 → -30%)` | `exit 0% exit 100%` |
| `parallax` | image div only | `transform: translateY(-15% → 15%)` | `cover 0% cover 100%` |

All `animation-timeline: view()` timelines are anchored to the corresponding content section's scroll position via `data-bg-for` / `id` pairing (or a shared IntersectionObserver).

**Overlay behaviour during transitions:**

For all transitions except `parallax`: the overlay div is a child of the composite wrapper div. When the composite fades, clips, or slides, the overlay rides it — they are one inseparable visual unit. No synchronization needed.

For `parallax`: the image div drifts while the overlay div stays planted. They are siblings inside the fixed background container; `transform` is applied only to the image div. The image is oversized by 20% top/bottom (`inset: -20%`) to prevent black bars at drift extremes.

**`animation-timeline` + Safari fallback:**

CSS `animation-timeline: view()` drives transitions in Chrome, Edge, and Firefox. Safari support arrived in 2024 but can be patchy. A lightweight `IntersectionObserver` + `requestAnimationFrame` fallback is applied when `CSS.supports('animation-timeline', 'view()')` returns false — it computes scroll progress manually and sets the same CSS properties via inline style.

**Narrow-section edge case:**

Sections shorter than the viewport height complete `entry` and `exit` phases in rapid succession. For sections without an explicit `minHeight`, start `animation-range` at `contain 50%` (fade begins only after section midpoint clears the viewport centre) rather than `exit 0%`. The system prompt instructs the AI to assign `minHeight: "60vh"` to any section with a non-`none` transition.

**Files**: `frontend/components/pages/layouts/SectionsLayout.tsx`

---

### S — SectionEditor: Section Background & Overlay Panel

The existing background flyout in the section header bar is promoted to a **Section Background Panel** — a wider slide-in drawer (or large popover, ≥320px) triggered by the ⚙ background button. The flyout approach becomes too cramped once transition and gradient overlay controls are added. The panel has three collapsible sub-sections.

---

#### S1 — Background sub-section

**Type selector** (always visible, radio/tab bar):

```
[ None ]  [ Color ]  [ Gradient ]  [ Image ]
```

**When type = Color:**
- Hex input + color swatch picker
- Live updates section background immediately (no save button; changes apply on panel close)

**When type = Gradient:**
- CSS gradient text input (full width) — accepts any valid CSS gradient string
- Live gradient preview strip (full width, ~40px tall) beneath the input; updates as user types
- Preset row — 6 labeled buttons that populate the input:
  - Linear top→bottom (dark→transparent)
  - Linear bottom→top
  - Linear left→right
  - Radial center
  - Diagonal (135°)
  - Custom (clears to blank)
- Each preset shows a tiny swatch icon

**When type = Image:**
- Current background thumbnail (if set), 80×50px, with "×" clear button
- "Choose from Media Library" button — opens existing MediaLibraryPicker modal
- "Upload image" button — opens file picker, uploads to media library, sets as background
- Once set, thumbnail updates immediately

---

#### S2 — Overlay sub-section (shown when type ≠ None)

**Mode selector** (radio):

```
[ None ]  [ Solid ]  [ Gradient ]
```

**When mode = Solid:**
- Hex color input + swatch picker
- Opacity slider (0–100%) with numeric readout
- Live preview: the section editor shows the overlay at the configured opacity over the background

**When mode = Gradient:**
- CSS gradient text input (full width)
- Live preview strip beneath (same pattern as gradient background)
- Preset buttons — 5 named patterns with visual swatch icons:
  - **Bottom vignette** — `linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)`
  - **Top vignette** — `linear-gradient(to top, transparent 30%, rgba(0,0,0,0.75) 100%)`
  - **Dual vignette** — `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.5) 100%)`
  - **Radial vignette** — `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)`
  - **Side fade (L→R)** — `linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 60%)`

Each preset button shows a small directional gradient icon. Clicking populates the input and updates the live preview.

---

#### S3 — Transition sub-section (shown when type = Image or Gradient)

**Transition picker** — icon + label radio grid (2 or 3 columns):

| Icon | Label | Value | One-line description |
|---|---|---|---|
| ↕ | Scroll | `none` | Background scrolls naturally with the page |
| ▬ | Fixed | `fixed` | Background stays planted; content scrolls over it |
| ◑ | Fade | `fade` | Dissolves into next background |
| ↑▬ | Wipe Down | `wipe-v` | Clips upward off the screen |
| ←▬ | Wipe Left | `wipe-left` | Clips to the left, reveals next from right |
| ▬→ | Wipe Right | `wipe-right` | Clips to the right, reveals next from left |
| ↑↑ | Slide Up | `slide-up` | Background slides upward off screen |
| ≋ | Parallax | `parallax` | Background drifts at half scroll speed |

The label "Scroll" is used in the UI for `transition: 'none'` to make it self-explanatory rather than showing "None."

Descriptions appear as a single line of muted text beneath the selected option.

**Note**: `attachment` (scroll/fixed) is removed entirely — the new fixed-position stack architecture makes it redundant. Any stored `attachment: 'parallax'` is read gracefully as `transition: 'parallax'`.

---

**Panel close behaviour:** Changes are applied live to the in-editor section preview as the user adjusts controls. No explicit "Save" button inside the panel — the section data is saved when the page is saved via the existing Save button in the page header.

**Files**: `frontend/components/admin/SectionEditor.tsx`, `frontend/components/admin/SectionBackgroundPanel.tsx` (new component)

---

### T — Enriched HTML extractor: animation signal extraction

Add `extractAnimationSignals(html)` to `html-extractor.ts`. Scan `<style>` block text and `class=""` attribute values for the following patterns and return a structured `AnimationSignals` object on `PageData`:

```typescript
interface AnimationSignals {
  hasFixedBackground: boolean       // background-attachment: fixed detected in CSS
  hasScrollTimeline: boolean        // animation-timeline or scroll() detected
  hasKeyframes: boolean             // @keyframes present
  hasOpacityTransition: boolean     // transition: opacity or animation with opacity
  hasTransformTransition: boolean   // transition/animation with transform
  hasStickyElements: boolean        // position: sticky detected
  hasHighZIndexStack: boolean       // z-index > 10 on multiple elements
  libraryFingerprints: string[]     // e.g. ['aos', 'gsap', 'locomotive', 'framer-motion']
  overlayGradients: string[]        // extracted linear/radial-gradient values from overlays
  motionClassNames: string[]        // class names containing parallax/fade/scroll/reveal/animate
}
```

**Library fingerprint detection:**

| Library | Signal |
|---|---|
| AOS | `data-aos` attributes or `aos` class names |
| GSAP / ScrollTrigger | `gsap`, `ScrollTrigger` in `<script>` src or inline |
| Locomotive Scroll | `data-scroll`, `data-scroll-container` |
| Framer Motion | `data-framer-motion`, `framer` in script src |
| Generic scroll-reveal | class names: `scroll-reveal`, `fade-in`, `slide-in`, `reveal`, `animate-on-scroll` |

Pass `AnimationSignals` to the AI via the `buildUserMessage()` content block (alongside existing colors and DOM structure).

**Files**: `backend/src/mul-converter/html-extractor.ts`, `backend/src/mul-converter/mul-converter.types.ts`

---

### U — System prompt Section 3C: signal-to-tool decision tree

Replace the stub Section 3C with a full signal-to-tool decision tree that the model applies after reading `AnimationSignals`:

```
[SECTION 3C — Transition and overlay selection]

After reading the AnimationSignals provided in the page data, select transitions
and overlays according to the following rules. Apply them as declarations in the
section JSON you produce. The goal is semantic equivalence — capturing the
motion and depth aesthetic of the source page, not literal CSS replication.

TRANSITION SELECTION (apply to background.transition):

  "parallax"
    → hasFixedBackground: true
    → OR motionClassNames includes "parallax" or "fixed-bg"
    → OR page aesthetic is photography-forward with depth cues (dark palette,
       large hero image, minimal text)

  "fade"  (default for image backgrounds)
    → hasOpacityTransition: true
    → OR libraryFingerprints includes "aos", "framer-motion", or "locomotive"
       (these libraries predominantly use opacity reveals)
    → OR page is photography-forward WITHOUT parallax signals
    → Apply to any section with background.type === "image" unless another
       transition is more specifically indicated

  "wipe-left" / "wipe-right"  (alternate per section)
    → DOM shows repeated alternating image+text section pairs (magazine / editorial layout)
    → OR hasTransformTransition: true AND layout is clearly columnar

  "slide-up"
    → hasTransformTransition: true AND hasKeyframes: true
    → OR libraryFingerprints includes "gsap" (GSAP commonly animates translateY)
    → OR page has strong vertical motion energy (scroll-driven storytelling layout)

  "none"
    → No animation signals detected
    → OR page has a hard structural / editorial aesthetic with no depth cues
    → Always correct for color and gradient backgrounds

OVERLAY SELECTION (apply to background.overlay):

  Gradient overlay (bottom vignette — default for hero sections):
    → Section has background.type === "image" AND zones contain heading or
       paragraph content that must be legible
    → Use: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)
    → Increase stop opacity to 0.85–0.90 if foreground text contrast requires it

  Gradient overlay (from overlayGradients in AnimationSignals):
    → If overlayGradients is non-empty: adopt the dominant gradient direction
       and alpha level, expressed as a CSS gradient string

  Solid overlay:
    → Full-zone body text on a busy background (not just a headline)
    → Color: dominant dark from palette; opacity 0.4–0.6

  No overlay:
    → Section has no zone text (purely visual / decorative section)
    → OR background is a flat color or gradient (not an image)

MINHEIGHT RULE:
  Set minHeight: "60vh" on any section with background.type === "image" and
  transition !== "none". This ensures adequate dwell time before the exit
  animation begins, especially on portrait displays.
```

**Files**: `backend/src/mul-converter/system-prompt.ts`

---

### V — Part 3 acceptance criteria

1. `background.transition` stored and round-tripped; omitted renders as `'none'` (no regression)
2. `attachment: 'parallax'` in stored data read gracefully as `transition: 'parallax'`
3. `overlay.gradient` renders correctly; `color`+`opacity` behaviour unchanged
4. Renderer emits a fixed-position background stack (Pass 1) and transparent content sections (Pass 2)
5. Z-ordering: section 0 background is on top; lower sections revealed as upper composites exit
6. `fade` — crossfade is simultaneous: section A fades while section B is already visible beneath it
7. `wipe-left` — section A's composite clips laterally, revealing section B from the opposite edge
8. `parallax` — background image drifts; overlay stays planted; no black bars at extremes
9. Overlay transitions with its background in all modes except parallax (where they are siblings)
10. Narrow-section guard: `animation-range` starts at `contain 50%` for sections without `minHeight`
11. Safari: transitions degrade gracefully to `none`; no JS errors
12. SectionEditor transition picker and gradient overlay presets save correctly and render live
13. `extractAnimationSignals()` correctly detects AOS, `background-attachment: fixed`, opacity transitions, and overlay gradients from sample HTML fixtures
14. Mul Converter AI output includes `transition` and `overlay.gradient` fields informed by detected signals

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

### Part 1 — Page Schema (deploy gate before Part 2 begins) — awaiting testbed QA
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
