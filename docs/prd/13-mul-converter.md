# PRD 13: Mul Converter

**Version**: 1.5  
**Status**: Draft  
**Phase**: 23  
**Author**: WCCollier

---

## Overview

The **Mul Converter** is an AI-driven backstage tool that ingests an arbitrary public webpage and emits two things:

1. **A custom color palette** — mirroring the visual identity of the target site, saved into the Appearance system
2. **A page layout scaffold** — a new Page draft whose sections approximate the spatial layout of the ingested page, ready for the owner to fill with real content

The name is an internal tool identity and requires no explanation in UI copy.

The Mul Converter depends on an expanded page schema — the **section-based content model** described below — which must be implemented first. The existing flat zone model (`layout` + `zones`) cannot express a multi-section layout with per-section backgrounds, which is the minimum needed to produce meaningful scaffolds.

---

## Goals

- Let owners style-match their AECMS site to an existing brand or reference design without manual color-picking
- Let owners use a reference page as a structural starting point for a new custom page layout
- Minimize external dependencies; prefer text-based AI analysis over a screenshot pipeline in v1
- Treat the AI model and API key as owner-supplied configuration, not baked-in infrastructure

---

## Renderer-First Design Principle

The AI speaks JSON directly. It does not go through the human section editor — it emits the full output schema and the backend saves it verbatim. This means **the renderer is the contract; the human editor is progressive UI built on top of it.**

Concretely:

- Every property documented in the AI output schema (gradients, overlays, drop caps, font imports, zone schemes, etc.) must be **handled by the page renderer** before Part 2 ships.
- The human section editor does **not** need to expose UI controls for all of these properties on day one. It must, however, be a faithful steward: any property present in the stored JSON that the editor doesn't know how to display an explicit control for must be **passed through unchanged on save**. Unknown properties must never be silently dropped.
- Human editor controls for AI-accessible properties can be added incrementally over subsequent phases. There is no requirement for parity between what the AI can produce and what the human can directly manipulate.

This unlocks an important capability: an owner can run the Mul Converter to produce a richly styled page (gradient hero, custom fonts, drop cap opening paragraph, overlay scrim), open it in the section editor to adjust placeholder text, and save — without any of the AI-applied styling being lost, even though the editor has no controls for those properties yet.

---

## Non-Goals (v1)

- Automated content migration (text, images) from the source page
- Semantic replication of navigation structure
- Support for CSS animations or transparency effects in the palette color slots
- Batch/multi-URL analysis
- Conversion history or diff view
- Freeform/absolute canvas positioning (see Page Schema Evolution below)
- Human editor UI controls for every AI-accessible property (see Renderer-First Design below)

---

## Access Control

| Who | Access |
|-----|--------|
| Owner | Full access (configure, run, save) |
| Admin | Blocked (capability-gated) |
| Member / Guest | No access |

**New capability**: `mul.convert` — scope: `backstage`, default: Owner only.

This capability gates all Mul Converter routes (settings + analysis).

---

## User Flow

```
[Owner opens /admin/mul-converter]
         │
         ▼
[Step 1 — Configure (first time only)]
  TEXT MODEL
    Provider: Anthropic | OpenAI | xAI
    Model: text field (e.g. claude-sonnet-4-6, gpt-4o, grok-4)
    API Key: password field → saved encrypted in ISM (per platform, shared if same as image provider)
  IMAGE GENERATION (optional)
    Provider: Disabled | OpenAI | Flux (fal.ai) | Stability AI
    Model: text field (e.g. gpt-image-1, flux-kontext-pro)
    API Key: password field → reuses text key if same platform; otherwise separate ISM key
    Mode: Brief-only | + Reference images (opt-in — see Image Generation section)
         │
         ▼
[Step 2 — Enter Target URL]
  Text field: https://example.com/page-to-analyze
  "Load Preview" button
         │
         ▼
[Step 3 — Preview Panel]
  <iframe> renders the target URL client-side
  "Looks right — Analyze" button
  ← "Try a different URL" link
         │
         ▼
[Step 4 — Analyzing…]
  Spinner + status message ("Fetching page…", "Sending to AI…", "Building result…")
         │
         ▼
[Step 5 — Results]
  Left: Color Palette preview (10 swatches, all slot names + hex values, editable)
  Right: Layout preview (layout selector badge + TipTap zone diagram)
  Bottom: AI notes (a sentence or two about the source page and confidence)
         │
         ├── [Save Palette Only]   → appends to custom_palettes ISM key; no page created
         ├── [Create Page Draft]   → POST /pages with AI zone content; no palette saved
         └── [Save Both]           → saves palette + creates page draft; redirects to Page editor
```

---

## Page Schema Evolution

### Why the current schema is insufficient

The existing page content format (`{ layout, zones }`) supports four hardcoded grid configurations with named zones. This is enough for static content pages but cannot express:

- Multiple stacked sections with different column counts
- A per-section background (image, color, fixed, parallax)
- A hero section that fills the viewport height
- Any structure the Mul Converter would generate from a real landing page

### Option space considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **More named layouts** | Add `three_column`, `magazine`, etc. to the layout enum | Too rigid; Mul Converter still can't express multi-section pages |
| **Section-based stack** | Page = vertical stack of sections; each section has column count + background | ✅ Chosen |
| **Freeform canvas** | Each block has absolute x/y/width/height coordinates | Out of scope — breaks responsive design without a full breakpoint system; Webflow-class complexity |

### Section-based content model

A new `type: 'sections'` page format runs alongside the existing `layout`/`zones` format. Both are valid; `parsePageContent()` detects which is present. Existing pages are unaffected.

```typescript
interface PageZone {
  id: string;       // client-generated UUID
  span: number;     // positive integer; number of grid columns this zone occupies
  scheme?: 'inherit' | 'light' | 'dark';  // text color context for this zone
                    //   inherit (default) — uses the page foreground CSS variable
                    //   light — forces light-on-dark text (white foreground)
                    //   dark  — forces dark-on-light text (near-black foreground)
                    // Use when a zone sits on a dark background section but the
                    // zone itself needs its own text treatment.
  content: TipTapDoc;
}

interface SectionBackground {
  type: 'none' | 'color' | 'gradient' | 'image';
  value?: string;
    // type 'color'    → hex string, e.g. "#1a2b3c"
    // type 'gradient' → CSS gradient string, e.g. "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
    //                   Any valid CSS gradient expression is accepted.
    // type 'image'    → "media://uuid" for a Media Library asset, or
    //                   "media://placeholder" for an AI-generated slot the owner will fill
  attachment?: 'scroll' | 'fixed' | 'parallax';  // only meaningful for 'image'
  overlay?: {
    color: string;    // hex color for the scrim, e.g. "#000000"
    opacity: number;  // 0–1; typical values 0.3–0.6
  };
    // overlay renders as a semi-transparent layer between the background and the zone content.
    // Essential for image + light-text combinations (the classic hero pattern).
    // Works with all background types but is most useful with 'image' and 'gradient'.
}

interface PageSection {
  id: string;         // client-generated UUID
  columns: number;    // grid resolution for this section — positive integer, no upper limit
  minHeight?: string; // CSS value — e.g. "100vh", "400px"; omit for auto height
  padding?: 'none' | 'compact' | 'normal' | 'spacious';
    // Controls vertical padding (padding-block) on the section:
    //   none      → py-0  (flush sections, used for full-bleed image blocks)
    //   compact   → py-8  (tight content rows, feature grids)
    //   normal    → py-16 (default; body content sections)
    //   spacious  → py-24 (hero sections, major transitions)
    // Omitting padding defaults to 'normal'.
  background?: SectionBackground;
  zones: PageZone[];  // ordered left-to-right; spans must sum to columns
}

interface SectionsPageContent {
  type: 'sections';
  fontImport?: string;
    // A Google Fonts (or other web font provider) @import URL.
    // e.g. "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap"
    // Injected as a <link> in the page <head> when this page is rendered.
    // Does not affect other pages or the global theme.
  fontVariables?: {
    heading?: string;  // CSS font-family value, e.g. "'Playfair Display', Georgia, serif"
    body?: string;     // CSS font-family value, e.g. "'Lato', system-ui, sans-serif"
  };
    // When set, these override --font-heading and --font-body CSS variables for this page only.
    // Only meaningful when fontImport is also set (otherwise the font may not be available).
  sections: PageSection[];
}
```

**`columns` and spans.** `columns` is always equal to the sum of all zone spans in the section — it is a derived value, not an independent input. The human editor never asks the owner to set `columns` directly; it is computed automatically as zones are added, removed, or resized. It is stored explicitly in the JSON for two reasons: schema round-trip consistency, and so the AI can declare a grid resolution upfront before enumerating zones.

For the AI, `columns` is a first-class concept (it sets the design intent before listing zones). For the human editor, it is an implementation detail that stays invisible.

**Zone ordering and span constraint.** `zones` is an ordered array; left-to-right rendering order is explicit. All `span` values in a section must sum to `columns`. Validated server-side on save.

**Examples:**
```
columns:3, zones:[{span:1},{span:2}]          → 1/3 + 2/3 split
columns:3, zones:[{span:2},{span:1}]          → 2/3 + 1/3 split
columns:4, zones:[{span:1},{span:2},{span:1}] → narrow + feature + narrow (1-2-1)
columns:4, zones:[{span:2},{span:2}]          → two equal halves
columns:1, zones:[{span:1}]                   → full-width single zone
```

**Responsive behavior**: sections stack vertically; all zones within a section collapse to full-width single-column below the `md` breakpoint. No breakpoint configuration is exposed in v1.

**Backward compatibility**: `parsePageContent()` adds a branch — if `obj.type === 'sections'`, return `SectionsPageContent`; otherwise fall through to existing `layout`/`zones` detection. The page renderer and editor handle both types. No DB migration is needed (JSONB column accepts either shape). See *Legacy Pages in the New Editor* below for how old pages behave when opened for editing.

---

### Section Editor UI

The page editor (`/admin/pages/[id]`) operates in one of two modes depending on the stored content format:

- **Section mode** — when content is `type: 'sections'`, or when creating a new page
- **Legacy mode** — when content is the old `{ layout, zones }` format; renders the existing flat-zone editor unchanged

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Page Title  [slug]  [Status ▾]  [Save]  [Preview ↗]           │
│  Nav: Show in nav [✓]  Label [____]  Nav order [3]              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⠿  [Feature Centre ▾]  [██▌████▌██]  [⊕]  [⚙]  [↕ 100vh ▾]  [×] │
│    template picker      span diagram  +zone  bg   height    del   │
├────────────────┬──────────────────────────┬────────────────────┤
│  Zone 1        │       Zone 2             │  Zone 3            │
│  (span 1)      │       (span 2)           │  (span 1)          │
│                │                          │                    │
│  [TipTap]      │  [TipTap]                │  [TipTap]          │
│                │                          │                    │
└────────────────┴──────────────────────────┴────────────────────┘

                        [+ Add Section]

┌─────────────────────────────────────────────────────────────────┐
│ ⠿  [Half / Half ▾]  [████▌████]  [⊕]  [⚙]  [↕ Auto ▾]  [×]    │
├─────────────────────────────────┬───────────────────────────────┤
│  Zone 1 (span 1)                │  Zone 2 (span 1)              │
│  [TipTap]                       │  [TipTap]                     │
└─────────────────────────────────┴───────────────────────────────┘
```

#### Section header bar — element by element

| Element | Behaviour |
|---------|-----------|
| **⠿** drag handle | Reorders sections via `@dnd-kit/sortable` |
| **Template picker** | Button shows current layout name (or "Custom" if no canonical match). Opens a popover with 7 canonical layout icons. Selecting one warns-then-resets zones if any zone has content. |
| **Span diagram** | Proportional block representation of zones. Gutter between adjacent zones is a draggable handle — drag redistributes span between the two neighbours in whole-unit increments; cannot drag a zone below span 1. Clicking a zone block reveals an inline numeric span input. |
| **⊕ add zone** | Appends a new zone (span 1) to the right; `columns` increments by 1 (grid expands, existing zones unchanged). |
| **⚙ background** | Opens a flyout: type radio (None / Color / Image); color picker for Color; Media Library picker for Image; attachment selector (Scroll / Fixed / Parallax). |
| **↕ height** | Dropdown: Auto / 50vh / 100vh / Custom (reveals a text input for arbitrary CSS value). |
| **× delete** | Removes the section. Warns if any zone has content ("This section has content. Deleting it will remove that content permanently.") |

#### Canonical layout templates

| Name | Spans | Visual |
|------|-------|--------|
| Full Width | `[1]` | `████████` |
| Half / Half | `[1,1]` | `████▌████` |
| Two-thirds / One-third | `[2,1]` | `█████▌███` |
| One-third / Two-thirds | `[1,2]` | `███▌█████` |
| Three Equal | `[1,1,1]` | `███▌███▌███` |
| Feature Centre | `[1,2,1]` | `██▌████▌██` |
| Four Equal | `[1,1,1,1]` | `██▌██▌██▌██` |

"Custom" appears in the picker label (non-selectable) when the current arrangement doesn't match any canonical.

#### Zone body

No layout controls inside the zone body. The TipTap editor fills the zone. A thin label at top ("Span 2") fades when the editor is focused. A split icon (⊞) visible on zone hover at the top-right triggers **Split Zone**: divides the zone into two equal halves (if odd span, the left half gets the extra column). Split is always available regardless of span size — if span is 1, it increments to 2 and adds the new zone, expanding `columns` by 1.

#### Zone removal

Clicking × on a zone in the span diagram removes it. Its span is absorbed by the nearest neighbour (right-preferring; falls back to left). Warns if the zone has content.

#### Zone span editing rules

| Operation | Effect on `columns` |
|-----------|-------------------|
| Gutter drag right/left | `columns` unchanged — redistribution between neighbours |
| ⊕ Add zone (span 1) | `columns` += 1 |
| × Remove zone | `columns` -= removed zone's span |
| Type new span in inline input | `columns` updated to maintain sum |
| Split zone | `columns` += 1 if span was 1; else unchanged (span redistributed) |

#### Add Section

`[+ Add Section]` opens the template picker popover inline. Selecting a template appends a new section with that zone arrangement, empty content, no background. Escape cancels.

---

### Legacy Pages in the New Editor

The `content` JSONB column accepts either schema indefinitely. There is no migration, forced or otherwise. Each page remembers its own format:

- **Rendering**: `parsePageContent()` detects `obj.type === 'sections'` first; falls through to `'layout' in obj` for old content. Both renderer branches remain active permanently. Old pages render via the legacy branch — no visual change.
- **Editing**: Opening an old page in the admin editor loads the **legacy flat-zone editor** exactly as it exists today. The owner sees no difference.
- **Upgrading**: An explicit **"Upgrade to Section Layout"** action is available in the page settings menu (not a banner — it should be opt-in, not nagging). On confirm, the legacy zones are converted to a single section losslessly:

| Old layout | Section equivalent |
|---|---|
| `no_sidebar` | `columns:1, zones:[{span:1, content: zones.main}]` |
| `sidebar_left` | `columns:4, zones:[{span:1, content: zones.sidebar}, {span:3, content: zones.main}]` |
| `sidebar_right` | `columns:4, zones:[{span:3, content: zones.main}, {span:1, content: zones.sidebar}]` |
| `split_comparison` | `columns:2, zones:[{span:1, content: zones.left}, {span:1, content: zones.right}]` |

All TipTap content is preserved. The page is saved in section format on the next save after upgrade. The upgrade is reversible only by reverting the save (no automatic undo after save).

**Summary**: The system stores records in whichever format they were created or last saved in. It remembers how to read and render both. Old pages are never touched unless the owner explicitly chooses to upgrade them.

---

### Two-Part Deployment Strategy

Phase 23 is deployed in two discrete pushes to `deploy`:

**Part 1 deploy** (Items A–C complete):
- Section schema + `parsePageContent()` detection
- Section renderer (customer-facing)
- Section editor (backstage)
- Per-section backgrounds
- Custom palettes ISM key + Appearance panel extension
- Legacy editor and pages: fully unchanged

**Soak period**: Owner uses the section editor to build new pages and tests the end-to-end experience. Bugs surface and get fixed on `feature/phase-23`, rebased onto `main`, and redeployed before Part 2 begins.

**Part 2 deploy** (Items D–O complete):
- MulConverterModule (backend)
- Mul Converter UI (backstage)
- AI provider abstraction (Anthropic + OpenAI)

The feature branch (`feature/phase-23`) stays open throughout. Part 1 is merged to `main → deploy` when items A–C pass acceptance criteria. Part 2 merges when items D–O are complete and the AI output quality is considered stable.

---

## Backend Module: `MulConverterModule`

### Endpoints

| Method | Path | Capability | Description |
|--------|------|------------|-------------|
| `GET` | `/mul/settings` | `mul.convert` | Returns current provider + model (key redacted) |
| `PATCH` | `/mul/settings` | `mul.convert` | Saves provider, model, API key to ISM |
| `POST` | `/mul/analyze` | `mul.convert` | Fetch + extract + AI analyze → returns MulResult |

### SSRF Protection

`POST /mul/analyze` validates the incoming URL before fetching:
- Must be `http://` or `https://` scheme only
- Must resolve to a public IP (no RFC 1918, loopback, link-local, or metadata service IPs)
- Follows the same validation pattern already used in `ExternalFeedsModule`
- Max redirect depth: 3
- Request timeout: 10s
- Response size limit: 2 MB (HTML only; images/assets not fetched)

### Page Extraction Pipeline

The backend does not use Puppeteer or a screenshot service in v1. Instead:

1. **Fetch HTML** — GET the target URL with a browser-like `User-Agent`. Follow up to 3 redirects.
2. **Extract CSS colors** — Parse all `<style>` tags and any inline `style=""` attributes. Collect all hex, rgb, rgba, and HSL color values. Deduplicate. Sort by frequency (most-used first, up to 30 colors).
3. **Extract DOM structure** — Reduce the HTML to a lightweight structural summary: tag names + class tokens for the top two DOM levels (no content text, no attributes except `class`). Trim to ≤ 150 elements.
4. **Extract meta** — `<title>`, `<meta name="description">`, `<meta property="og:image">`, Open Graph tags.
5. **Assemble `PageData`** — Pass all of the above to the AI provider.

This text-only extraction approach makes the AI task well-defined and avoids vision-model costs for users who prefer lighter/cheaper models.

**Limitation**: This approach only captures colors from inline `<style>` tags and `style=""` attributes in the initial HTML. It does not fetch external CSS files (`<link rel="stylesheet">`) or execute JavaScript. For sites that load styles dynamically (e.g. CSS-in-JS, React-rendered pages), the color extraction will be incomplete.

**v2 enhancement path — Firecrawl**: [Firecrawl](https://firecrawl.dev) is a purpose-built web scraping API that handles JS rendering, bot protection, and clean content extraction. It returns LLM-ready markdown + full rendered HTML after JavaScript execution. Using Firecrawl as the ingest layer in v2 would solve the JS-rendered page problem and produce cleaner text content for layout analysis. Firecrawl has a free tier (500 credits) suitable for a low-usage backstage tool, or can be self-hosted. The extraction pipeline would remain the same; only the HTML source changes from a raw `fetch()` to a Firecrawl API call returning the post-JS-execution DOM.

### AI Provider Abstraction

```typescript
interface MulProvider {
  analyze(data: PageData, systemPrompt: string): Promise<MulResult>;
}

class AnthropicMulProvider implements MulProvider { ... }  // Claude models
class OpenAIMulProvider      implements MulProvider { ... }  // GPT-4o, etc.
class XAIMulProvider         implements MulProvider { ... }  // Grok models (OpenAI-compatible API)
```

Provider is selected at request time by reading `mul.text_provider` from ISM. The module **does not require** any provider SDK to be present in the container — all providers are implemented as thin HTTP clients (`fetch`/`axios`) so no SDK is a hard dependency. xAI's API is OpenAI-compatible (same request shape, different base URL and key), so `XAIMulProvider` is a thin subclass of `OpenAIMulProvider`.

**Provider-native optimization**: When the text layer and image layer use the same platform, the service can collapse both operations into a single API conversation context. The model sees the source page and the image briefs it just wrote, producing better compositional fidelity than two separate calls. This optimization is transparent to the user — it activates automatically when both providers match.

- **OpenAI-native**: When `text_provider === 'openai'` and `image_provider === 'openai'`, use the OpenAI Responses API conversation mode (analysis + image generation in one context window).
- **xAI-native**: When `text_provider === 'xai'` and `image_provider === 'xai'`, use Grok's equivalent multi-turn API to handle analysis and Aurora image generation in one context window. xAI's API is OpenAI-wire-compatible, so the implementation is a thin configuration variant of the OpenAI-native path (different base URL and model names; same request/response shape).

### ISM Keys (namespace: `mul.*`)

Keys are per-platform, not per-layer. When the text model and image model use the same platform (e.g. both OpenAI), one key covers both.

| Key | Encrypted | Description |
|-----|-----------|-------------|
| `mul.text_provider` | No | `anthropic` \| `openai` \| `xai` |
| `mul.text_model` | No | e.g. `claude-sonnet-4-6`, `gpt-4o`, `grok-4` |
| `mul.anthropic_api_key_enc` | Yes | API key for Anthropic (falls back to `ANTHROPIC_API_KEY` env var if unset) |
| `mul.openai_api_key_enc` | Yes | API key for OpenAI — shared by text layer and image layer when both use OpenAI |
| `mul.xai_api_key_enc` | Yes | API key for xAI (Grok models) |
| `mul.image_provider` | No | `openai` \| `xai` \| `flux` \| `stability` — omit or `disabled` to disable image generation |
| `mul.image_model` | No | e.g. `gpt-image-1`, `grok-2-aurora`, `flux-kontext-pro`, `stable-diffusion-xl-1024-v1-0` |
| `mul.fal_api_key_enc` | Yes | API key for fal.ai (FLUX models) |
| `mul.stability_api_key_enc` | Yes | API key for Stability AI |
| `mul.image_reference_mode` | No | `brief-only` (default) \| `reference` — see Image Generation section |

---

## AI System Prompt Design

The system prompt is the core intellectual artifact of this module. It must give the LLM enough context to produce valid, useful output without hallucinating schema fields that don't exist.

### Structure

```
SYSTEM:
You are a design analysis assistant for AECMS, a content management system.

[SECTION 1 — What we need]
Given raw page data from a target URL (HTML structure, extracted CSS colors, page metadata),
produce two things:
  (a) A color palette that replicates the visual identity of the target site
  (b) A page layout scaffold that approximates the spatial layout of the target page

[SECTION 2 — Color palette schema]
A palette contains exactly 10 named color slots:
  background        — the page background (dominant, typically darkest or lightest)
  surface           — a slightly elevated surface (cards, panels) — 10–15% lighter/darker than background
  surface-raised    — a further step up (nested cards, hover states)
  foreground        — primary text color — must contrast ≥ 4.5:1 against background
  muted             — secondary/subdued text — must contrast ≥ 3:1 against background
  border            — subtle divider lines — typically 2–3 steps from background
  accent            — the dominant brand/interactive color (button fills, links, highlights)
  accent-hover      — 10% darker than accent (for button hover states)
  accent-dim        — 20% darker than accent (for active/pressed states)
  accent-foreground — text color used ON TOP of accent — must contrast ≥ 4.5:1 against accent

All values must be valid CSS hex colors (e.g. #1a2b3c). Do not use rgb(), hsl(), or named colors.

[SECTION 3 — Page layout system]
AECMS pages are built from a vertical stack of sections. Each section defines a CSS grid
with a chosen resolution (columns), and contains an ordered array of zones that span across
that grid. This lets you express any column arrangement within a section.

Section schema:
  columns: positive integer — the grid resolution for this section
           Choose whatever resolution naturally fits the layout:
             columns:1  → single full-width zone
             columns:2  → halves, or any 2-unit split
             columns:3  → thirds, or 1+2, 2+1
             columns:4  → quarters, or 1+3, 3+1, 2+2, 1+2+1, etc.
             columns:12 → Bootstrap-style fine-grained control when needed
  minHeight (optional): CSS string — use "100vh" for a full-viewport hero, omit for auto height
  background (optional):
    type: "none" | "color" | "image"
    value: hex color string (for type "color"), e.g. "#1a2b3c"
           or "media://placeholder" (for type "image") — owner will replace with a real upload
    attachment: "scroll" | "fixed" | "parallax"
  zones: ordered array of zone objects, left to right
    Each zone: { "id": "<any string>", "span": <positive integer>, "content": <TipTapDoc> }
    CONSTRAINT: all span values in a section must sum exactly to columns

Zone layout examples (columns → zone spans):
  columns:3 → [{span:1},{span:2}]         (1/3 left + 2/3 right)
  columns:4 → [{span:1},{span:2},{span:1}] (narrow + feature + narrow)
  columns:2 → [{span:1},{span:1}]         (two equal halves)
  columns:1 → [{span:1}]                  (full width)

Each TipTap document:
  { "type": "doc", "content": [...nodes] }

Available TipTap node types for scaffold content:

  Headings:
  { "type": "heading", "attrs": { "level": 1|2|3, "textAlign": "left"|"center"|"right" },
    "content": [{ "type": "text", "text": "...", "marks": [...] }] }

  Paragraphs:
  { "type": "paragraph",
    "attrs": { "textAlign": "left"|"center"|"right"|"justify", "dropCap": true|false },
    "content": [{ "type": "text", "text": "...", "marks": [...] }] }
    // textAlign "justify" produces newspaper-style full-width justification with automatic hyphenation.
    // dropCap true applies an ornate enlarged initial letter to the first character of the paragraph.
    //   Use dropCap on the opening paragraph of long-form content sections to signal literary quality.
    //   Do not combine dropCap with textAlign "center" — the float interaction is undefined.

  Lists:
  { "type": "bulletList", "content": [{ "type": "listItem", "content": [...] }] }
  { "type": "orderedList", "content": [{ "type": "listItem", "content": [...] }] }

  Horizontal rule:
  { "type": "horizontalRule" }
    // Use as a subtle section divider within a zone; prefer over empty paragraphs for spacing.

Available text marks (applied in the "marks" array on text nodes):

  Bold:          { "type": "bold" }
  Italic:        { "type": "italic" }
  Uppercase label (for section labels, eyebrows, captions):
                 { "type": "textStyle", "attrs": { "textTransform": "uppercase", "letterSpacing": "wide" } }
    // Produces the "ABOUT THE AUTHOR" / "CHAPTER ONE" editorial label style.
    // textTransform values: "none" | "uppercase" | "lowercase" | "capitalize"
    // letterSpacing values: "tight" | "normal" | "wide" | "wider"
    // Can combine: uppercase + wide is the most common editorial pattern.

CRITICAL: Do NOT produce empty text nodes ({ "type": "text", "text": "" }) — TipTap will discard
them and silently break the document. Every text node must have non-empty text.

Scaffold content means structural placeholders that show WHERE things go, not real content from the
source page. Use square-bracket labels: "[Hero headline]", "[Supporting paragraph]", "[CTA button]".
A good scaffold reproduces the rhythm and density of the source layout so the owner knows
exactly what to fill in. Aim for 3–7 sections for a typical landing page.

[SECTION 4 — Output format]
Return ONLY a valid JSON object matching this schema. No prose, no markdown, no code fences.

{
  "palette": {
    "name": string,           // a descriptive palette name (1–3 words)
    "scheme": string,         // e.g. "Monochromatic (dark)", "Analogous", "Split complementary"
    "colors": { <10 slot names as above, each a hex color> }
  },
  "page": {
    "suggestedTitle": string, // proposed page title based on the source page
    "fontImport": string | undefined,
      // Google Fonts @import URL if the source page uses a recognisable web font
      // e.g. "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap"
      // Omit if the page uses system fonts or the font is unidentifiable.
    "fontVariables": {
      "heading": string | undefined,  // e.g. "'Playfair Display', Georgia, serif"
      "body": string | undefined      // e.g. "'Lato', system-ui, sans-serif"
    } | undefined,
    "sections": [
      {
        "columns": number,    // positive integer — grid resolution for this section
        "minHeight": string | undefined,   // e.g. "100vh" for hero; omit for auto
        "padding": "none" | "compact" | "normal" | "spacious" | undefined,
        "background": {
          "type": "none" | "color" | "gradient" | "image",
          "value": string | undefined,
            // color    → hex string, e.g. "#1a2b3c"
            // gradient → CSS gradient, e.g. "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)"
            // image    → "media://placeholder"
          "attachment": "scroll" | "fixed" | "parallax" | undefined,
          "overlay": { "color": string, "opacity": number } | undefined
            // overlay.color → hex, e.g. "#000000"
            // overlay.opacity → 0–1, e.g. 0.45
        } | undefined,
        "zones": [            // ordered array, left to right; spans must sum to columns
          {
            "id": string,
            "span": number,
            "scheme": "inherit" | "light" | "dark" | undefined,
            "content": { "type": "doc", "content": [...] }
          }
        ]
      }
      // … one entry per section
    ]
  },
  "imagePromptStyle": {       // only present when image generation is enabled
    "model": string,          // the image model name as configured
    "approach": string,       // the AI's declared prompt strategy for this model
    "exampleFormat": string   // one concrete example of the prompt format to be used
  } | undefined,
  "imageBriefs": {            // only present when image generation is enabled
    "<section-or-zone-id>": {
      "prompt": string,       // the image generation prompt, styled per imagePromptStyle
      "aspectRatio": string,  // e.g. "16:9", "1:1", "3:2"
      "style": "photorealistic" | "illustration" | "abstract",
      "imageSourceUrl": string | undefined
        // Only present when mul.image_reference_mode === "reference".
        // The URL of the source image from the target page (og:image, hero img src, etc.)
        // passed to the image generation API as a composition/style reference.
        // Never stored in AECMS. Only transmitted transiently to the image provider.
        // Owner must enable reference mode explicitly; UI shows:
        //   "Reference mode sends images from the source URL to your image provider.
        //    Only enable if you own or have rights to the source images."
    }
  } | undefined,
  "metadata": {
    "confidence": "high" | "medium" | "low",
    "notes": string           // 1–2 sentences: what you inferred and any caveats
  }
}
```

The system prompt is assembled in `MulConverterService.buildSystemPrompt(config: MulConfig)` and is parameterized on the active configuration — it is not user-editable in v1. Key runtime parameters injected into the prompt:

- `{image_provider}` / `{image_model}` — inserted into Section 5 when image generation is enabled; omitted entirely when disabled
- `{image_reference_mode}` — determines whether `imageSourceUrl` should be populated in briefs

This parameterization is the mechanism that keeps the system open to new and upgraded image models without code changes: the master AI's training knowledge of any named model informs its brief vocabulary automatically.

### Aesthetic Vocabulary — Guidance for the AI

The system prompt must explicitly teach the AI when and how to use each aesthetic tool. Raw schema documentation is insufficient; the AI needs design intent, not just field names. The following guidance belongs in Section 3 of the system prompt:

```
[SECTION 3B — Aesthetic tools and when to use them]

BACKGROUNDS
  Use "gradient" for sections whose source page has a gradient hero, a dark tech aesthetic,
  or any depth-layered background. Prefer CSS linear-gradient with 2–3 stops.
  Example: "linear-gradient(160deg, #0d1b2a 0%, #1b263b 60%, #415a77 100%)"

  Use "image" with type "media://placeholder" for any section the source page builds around
  a background photograph. Always pair with an overlay when the zone text must be light-on-dark:
    overlay: { "color": "#000000", "opacity": 0.45 }
  Adjust opacity: 0.3 for subtle texture, 0.6+ for full legibility.

  Use overlay on gradient backgrounds when zone text needs extra contrast beyond the gradient alone.

PADDING
  Match the source page's visual breathing room:
    spacious → viewport-height heroes, major brand statements
    normal   → standard body sections (default; omit if unsure)
    compact  → feature grids, testimonial rows, tight content bands
    none     → flush image blocks, map embeds, full-bleed elements

ZONE SCHEME
  Set zone.scheme: "light" when the section background is dark (gradient or dark color) and
  the zone content needs white text. Set "dark" for zones on light/pale backgrounds that need
  to explicitly force dark text. "inherit" or omitting scheme is correct for neutral sections.

FONT IMPORT
  Read the source page's font-family declarations in the extracted CSS. If you identify a
  Google Fonts typeface, emit the Google Fonts URL in fontImport and the CSS font-family
  values in fontVariables. This is one of the strongest brand-identity signals available.
  If the page uses system fonts (Georgia, Arial, system-ui, etc.), omit fontImport entirely.

TEXT ALIGNMENT
  Center-align headings in hero sections (h1, h2 in spacious sections with dark backgrounds).
  Left-align all body text and headings in content sections by default.
  Use "justify" on long-form body paragraphs only — it signals editorial authority,
  appropriate for literary or journalistic pages. Always combine with dropCap on the first
  paragraph of a long-form content section.

DROP CAPS
  Apply dropCap: true to the first paragraph of any zone that contains extended prose and
  where the source page has an editorial, literary, or magazine character. Drop caps signal
  craft and are one of the clearest typographic identity markers for author and publishing sites.
  Do not apply to list items, short paragraph stubs, or placeholder-only zones.

UPPERCASE LABELS
  Use the textStyle mark with textTransform: "uppercase" and letterSpacing: "wide" for
  section eyebrows (short label text above a headline) and caption-style text. This pattern
  ("ABOUT THE AUTHOR", "FEATURED WORK", "CHAPTER ONE") is a strong editorial voice marker.
  Match it to the source page's typographic hierarchy.
```

### Image Prompt Self-Optimization (Section 5 of system prompt)

When image generation is enabled, the system prompt includes a Section 5 that instructs the master AI to **declare its prompting strategy for the configured image model before writing any image briefs**. This produces an `imagePromptStyle` field in the output JSON:

```json
"imagePromptStyle": {
  "model": "flux-kontext-pro",
  "approach": "Dense comma-separated visual descriptors. Lead with subject and composition, then artistic style, then lighting, then camera/technical specs. Aspect ratio is a separate field — omit from the prompt string itself. Negative prompts are not used in this context.",
  "exampleFormat": "coastal cliffside at sunset, cinematic photography, golden backlighting, wide angle 24mm, atmospheric haze, warm amber and violet tones"
}
```

**Why this matters:**

- **Self-adapting vocabulary**: DALL-E 3, FLUX Kontext, and Stability SDXL each respond differently to prompt styles. DALL-E 3 handles natural language well; FLUX Kontext prefers dense descriptor lists; Stability has its own emphasis syntax. The master AI calibrates to whichever model is configured.
- **Future-proof**: New image models (DALL-E 4, FLUX 3, Imagen 4, etc.) require no code changes. The master AI applies whatever it knows from its training about the configured model. If the model is unknown, it notes this and applies universal best practices.
- **Inspectable**: The `imagePromptStyle` field is returned in the `MulResult` and shown in the UI (collapsed by default) so the owner can understand why briefs are written the way they are.
- **Not stored**: `imagePromptStyle` is an ephemeral reasoning artifact. It is returned to the client for display but is not saved into the page content JSON.

The Section 5 system prompt text (injected only when `image_provider` is configured):

```
[SECTION 5 — Image brief optimization]
Before writing any imageBriefs, emit an "imagePromptStyle" field. In it:
  1. State the image model name: "{image_model}"
  2. Describe how that model responds best to prompts — vocabulary, syntax, ordering,
     what to emphasize, what to avoid. Draw on your knowledge of this model.
  3. Provide one concrete example of the prompt format you will use.

Apply that declared style consistently to all prompts in the "imageBriefs" field.

If the model name is unfamiliar to you, note this explicitly in "approach" and fall back
to universal best practices: subject-first descriptions, clear style declaration,
explicit lighting and mood descriptors, technical specs as trailing descriptors.
Aspect ratio is always a separate structured field — never embed it in the prompt string.
```

### Structured Output Enforcement

- **Anthropic**: Use tool use / `tool_choice: { type: 'tool', name: 'emit_result' }` with the JSON schema as the tool input schema. This guarantees well-formed JSON that matches the schema.
- **OpenAI**: Use `response_format: { type: 'json_schema', json_schema: { schema: <schema>, strict: true } }` (available in `gpt-4o` and later). Fall back to `response_format: { type: 'json_object' }` if the model doesn't support strict schemas, with server-side validation.

**Note (2026)**: Anthropic's structured outputs API (guaranteed JSON schema adherence, public beta as of mid-2026) is now available for Claude Sonnet 4.6+. This is the preferred path for the Anthropic provider — it eliminates the need for prompt-level JSON coercion and guarantees parse-safe responses. Use `betas: ['output-128k-2025-02-19']` and pass the MulOutputSchema as the `schema` parameter in the messages API call.

---

## Custom Palettes System

Currently, palettes are a hardcoded array in `frontend/lib/themes.ts`. To let Mul Converter (and eventually a manual "Create Palette" flow) add owner-defined palettes, the following extension is required:

**New ISM key**: `appearance.custom_palettes` — stores a JSON array of `ThemePalette[]` objects (same schema as the hardcoded PALETTES array; no `_enc` suffix because palette data is not secret).

**Backend changes**:
- `GET /settings-public/theme` returns `{ palette, fontPairing, customPalettes: ThemePalette[] }`
- `PATCH /settings/appearance` accepts an optional `customPalettes` field alongside `theme`

**Frontend changes**:
- `AppearanceClient` merges `PALETTES` (hardcoded) and `customPalettes` (from settings) into a single display list
- Custom palettes rendered with a "Custom" badge and a delete button
- `themes.ts` `getPaletteById()` also checks custom palettes (fetched and passed in)

When Mul Converter saves a palette, it reads the current `appearance.custom_palettes`, appends the new entry (generating a UUID `id`), and writes back the updated array.

---

## Frontend UI

**Route**: `/admin/mul-converter`  
**Nav entry**: Backstage sidebar → "Pages" section → "Mul Converter" link (only shown if `mul.convert` capability is present)

### Component Breakdown

```
MulConverterPage (server component — checks capability)
  └── MulConverterClient (client component)
        ├── MulSettingsPanel   — provider/model/key config; collapsible after first save
        ├── UrlInputPanel      — URL entry + "Load Preview" button
        ├── PreviewPanel       — <iframe> of target URL; shown after URL entry
        ├── AnalyzeButton      — triggers POST /mul/analyze; shows loading state
        └── ResultsPanel
              ├── PaletteResult — swatches + hex values; all 10 slots editable
              ├── LayoutResult  — layout badge + zone diagram showing scaffold structure
              ├── AiNotes       — confidence badge + notes string
              └── ActionBar     — Save Palette / Create Draft / Save Both
```

### Preview Panel

The preview uses a sandboxed `<iframe>` pointing directly to the target URL (no backend proxy):

```tsx
<iframe
  src={targetUrl}
  sandbox="allow-scripts allow-same-origin"
  className="w-full h-[500px] rounded border border-border"
  title="Target page preview"
/>
```

**Important**: The iframe renders in the user's browser, not on the server. This means:
- It requires the target URL to be publicly accessible from the user's machine
- It is unaffected by the backend SSRF restrictions (those only apply to the server-side fetch)
- Some sites block iframe embedding via `X-Frame-Options: DENY` — if this happens, the iframe shows a blank page. The UI should note: "If the preview is blank, the site blocks embedding — this won't affect analysis."

### Settings Panel

The settings panel is a collapsible `<details>` section at the top. On first visit (when `mul.text_provider` is unset), it is pre-expanded with a banner: "Configure your AI provider before running your first analysis."

**Text Model group:**
- Provider radio: `Anthropic` | `OpenAI` | `xAI`
- Model: text field, pre-filled with a sensible default per provider (`claude-sonnet-4-6` / `gpt-4o` / `grok-4`)
- API Key: password-style input; shows `••••••••` if already saved; Anthropic can be left blank if `ANTHROPIC_API_KEY` is set in the environment

**Image Generation group** (collapsed by default; expands when owner clicks "Enable image generation"):
- Provider radio: `Disabled` | `OpenAI` | `xAI` | `Flux (fal.ai)` | `Stability AI`
- Model: text field, pre-filled with default per provider (`gpt-image-1` / `grok-2-aurora` / `flux-kontext-pro`)
- API Key: hidden when provider matches the text provider (key is shared automatically — applies to both OpenAI↔OpenAI and xAI↔xAI); otherwise separate password input
- Mode toggle: `Brief-only` | `+ Reference images`
  - Reference mode disclosure: *"Reference mode passes images from the source URL to your image provider for style reference. Only enable if you own or have rights to the source images."*
- Info note: "Image generation adds ~10–30s. Generated images are saved to your Media Library."

Save button: `PATCH /mul/settings`

---

## LLM Model Recommendations

The user supplies their own model and API key. The system prompt is text-only (no image attachments in v1), so any sufficiently capable text model works. Guidance shown in the settings panel:

### Text (Semantic) Layer

| Provider | Recommended Model | Notes |
|----------|------------------|-------|
| Anthropic | `claude-sonnet-4-6` | Best balance of speed, cost, and layout reasoning. Strong structured output via tool use. Default recommendation. |
| Anthropic | `claude-opus-4-8` | Highest quality for complex pages and nuanced aesthetic inference; noticeably more expensive. |
| OpenAI | `gpt-4o` | Equivalent quality to Sonnet 4.6; supports strict JSON schema output. |
| OpenAI | `gpt-4o-mini` | Faster and cheaper; acceptable for simple pages with straightforward color schemes. |
| xAI | `grok-4` | 1M-token context window; strong reasoning; lowest reported hallucination rate among frontier models as of mid-2026. OpenAI-compatible API — easy integration. |

### Image Generation Layer

| Provider | Recommended Model | Mode | Notes |
|----------|------------------|------|-------|
| OpenAI | `gpt-image-1` | Brief-only or Reference | Natural language prompts. Shares API key with OpenAI text layer. Best for owners already using OpenAI. OpenAI-native optimization applies automatically when both layers are OpenAI. |
| xAI | `grok-2-aurora` | Brief-only or Reference | xAI's Aurora image generation model. Shares API key with xAI text layer (`mul.xai_api_key_enc`). xAI-native optimization applies automatically when both layers are xAI/Grok. Best for owners already using Grok as the text model. |
| Flux (fal.ai) | `flux-kontext-pro` | Brief-only or Reference | Best quality for reference-conditioned generation. Descriptor-list prompts. Separate fal.ai key required. |
| Flux (fal.ai) | `flux-schnell` | Brief-only | Fastest and cheapest; good for layout scaffolding where photorealism isn't critical. |
| Stability AI | `stable-diffusion-xl-1024-v1-0` | Brief-only | Wide model ecosystem; separate Stability key required. |
| Disabled | — | — | Default. Scaffold uses `media://placeholder` slots the owner fills manually. |

**Why not require a vision model?** The text-based HTML extraction is sufficient for most palette and layout inferences. The dominant CSS colors are explicitly present in the source; the DOM structure gives enough layout signal. Vision adds marginal value at higher cost and API complexity. A vision enhancement path is reserved for v2 (see Future Work).

**Image prompt self-optimization**: The text model calibrates its image brief vocabulary to the configured image model automatically (see *Image Prompt Self-Optimization* above). Owners do not need to learn provider-specific prompt syntax — the master AI handles this.

---

## Data Flow Summary

```
Browser (owner)
  │  POST /mul/analyze { url }
  ▼
MulConverterController
  │  validate capability (mul.convert)
  ▼
MulConverterService.analyze(url)
  │  1. SSRF-validate URL
  │  2. Fetch HTML (timeout 10s, max 2MB)
  │  3. Extract: colors, DOM structure, meta
  │  4. Read text_provider/text_model + image_provider/image_model from ISM
  │  5. Build system prompt (parameterized on image_provider/model if enabled)
  │  6. Call text AI provider (Anthropic, OpenAI, or xAI)
  │     → Response includes: palette, page sections, imagePromptStyle?, imageBriefs?
  │  7. Parse + validate structured JSON response
  │  [if image_provider configured]
  │  8. For each imageBrief: call image provider → bitmap
  │     → Upload to GCS → create Media record → replace media://placeholder with media://uuid
  │  [if text_provider === image_provider === 'openai']
  │  8′. Use OpenAI Responses API conversation mode (steps 6+8 merged into one API call)
  │  [if text_provider === image_provider === 'xai']
  │  8″. Use Grok multi-turn API conversation mode (steps 6+8 merged; xAI-native optimization)
  ▼
  Return MulResult to controller → HTTP 200

Browser (owner)
  │  Receives MulResult
  │  Renders PaletteResult + LayoutResult
  │
  ├── [Save Palette]
  │     PATCH /settings/appearance { customPalettes: [...existing, newPalette] }
  │
  └── [Create Page Draft]
        POST /pages {
          title: result.page.suggestedTitle,
          status: 'draft',
          content: {
            type: 'sections',
            sections: result.page.sections
          }
        }
```

---

## Error States

| Condition | User-facing message |
|-----------|-------------------|
| SSRF / private IP blocked | "This URL points to a private or restricted address and cannot be analyzed." |
| Fetch timeout | "The target page took too long to respond. Try again or check the URL." |
| Response too large | "The page is too large to analyze (limit: 2 MB of HTML)." |
| AI provider error (4xx) | "AI provider returned an error. Check your API key and model name in settings." |
| AI provider rate limit (429) | "AI provider rate limit reached. Wait a moment and try again." |
| AI returns malformed JSON | "The AI response could not be parsed. Try again or switch to a recommended model." |
| iframe blocked (`X-Frame-Options`) | Info note in preview: "Preview blocked by target site — this doesn't affect analysis." |

---

---

## Part 2B — Bitmap-Imitating Layer (Image Generation)

After the core scaffold generation (Part 2) is stable, a progressive-enhancement layer can replace `"media://placeholder"` slots with AI-generated images that approximate the mood and composition of the originals. This is an optional feature gated by a separate image provider configuration.

### Concept

The semantic text model already sees enough to write an image brief — alt text, figure captions, DOM context (`.hero__bg`, `.banner`, `og:image`), and surrounding headline text. Each `"media://placeholder"` in the generated scaffold corresponds to one image brief the model can produce as part of its output. A separate image generation model then renders each brief into a real bitmap. The generated image is uploaded to the Media Library (GCS public bucket) and a `Media` record is created — the section background references a real `media://uuid` from day one.

The generated images are new original works. They are **inspired by** (not reproductions of) the source: the brief describes mood, composition, and subject matter inferred from DOM context, not pixel-level copying. This is legally clean.

### Data Flow

```
MulConverterService.analyze(url)
  │ ... existing text analysis + scaffold generation ...
  │
  ├── for each section with background.type === "image":
  │     AI output includes: imageBriefs[id] = { description, aspectRatio, style }
  │
  ├── [if image provider configured]
  │     for each imageBrief:
  │       → POST to image generation API (brief → bitmap)
  │       → Upload bitmap to GCS public bucket
  │       → Create Media record in DB
  │       → Replace "media://placeholder" with "media://{newUuid}" in sections
  │
  └── Return MulResult (with real media refs if image generation ran)
```

### AI Output Extension

The scaffold generation prompt gains two new output fields when image generation is enabled: `imagePromptStyle` (see *Image Prompt Self-Optimization* above) and `imageBriefs`.

```json
"imagePromptStyle": {
  "model": "flux-kontext-pro",
  "approach": "Dense comma-separated visual descriptors. Lead with subject and composition, then artistic style, then lighting, then technical/camera details. Avoid negative prompts. Aspect ratio is a separate field.",
  "exampleFormat": "coastal cliffside at dusk, cinematic photography, warm amber backlighting, 24mm wide angle, atmospheric haze, violet and gold tones"
},
"imageBriefs": {
  "<zone-or-section-id>": {
    "prompt": "...",         // written in the style declared by imagePromptStyle
    "aspectRatio": "16:9",  // e.g. "16:9", "1:1", "3:2", "4:3"
    "style": "photorealistic | illustration | abstract",
    "imageSourceUrl": "https://source-site.com/hero.jpg"
      // Only populated when mul.image_reference_mode === "reference".
      // Passed to the image provider as a composition/mood reference; never stored.
  }
}
```

The section that declares `background.type: "image"` and `background.value: "media://placeholder"` uses the matching `id` as its key in `imageBriefs`. The master AI extracts candidate `imageSourceUrl` values from the page during its analysis pass (from `og:image`, prominent `<img>` tags, hero element backgrounds) — no extra network fetch is required.

### Image Provider Abstraction

```typescript
interface ImageBrief {
  prompt: string;
  aspectRatio: string;
  style: 'photorealistic' | 'illustration' | 'abstract';
  imageSourceUrl?: string;  // populated in reference mode
}

interface ImageProvider {
  generate(brief: ImageBrief): Promise<Buffer>; // returns PNG/JPEG bytes
}

class GptImage1Provider  implements ImageProvider { ... }  // OpenAI gpt-image-1
class XAIImageProvider   implements ImageProvider { ... }  // xAI Aurora (thin subclass of GptImage1Provider; different base URL + model)
class FluxProvider       implements ImageProvider { ... }  // FLUX models via fal.ai
class StabilityProvider  implements ImageProvider { ... }  // Stability AI SDXL
```

Provider selected by `mul.image_provider` ISM key. All providers use REST/fetch — no image SDK hard dependency. When `imageSourceUrl` is present and the provider supports reference conditioning (OpenAI Responses API, xAI Aurora, FLUX Kontext), it is passed as a reference input. Providers that don't support reference conditioning ignore the field and use `prompt` only.

**Reference mode and OpenAI**: When both `mul.text_provider` and `mul.image_provider` are `openai`, the Responses API conversation mode handles both analysis and reference-conditioned image generation in one context — no separate image API call is needed. The text model's vision understanding of the source page feeds directly into the image generation step.

**Reference mode and xAI**: When both `mul.text_provider` and `mul.image_provider` are `xai`, the same principle applies using Grok's multi-turn API. `XAIImageProvider` is a thin subclass of `GptImage1Provider` with `baseUrl = 'https://api.x.ai/v1'` — xAI's image generation endpoint follows the OpenAI images API shape. The `mul.xai_api_key_enc` key is shared by both layers automatically (per-platform key sharing).

### ISM Keys (Part 2B additions)

Part 2B uses the same per-platform key structure defined in the main ISM Keys table above. No new key slots are needed — `mul.image_provider`, `mul.image_model`, `mul.image_reference_mode`, and the per-platform API keys are all defined there.

### Settings Panel

Image generation settings are integrated into the main MulSettingsPanel as described in the *Settings Panel* section above. No separate panel extension is needed.

### Latency and Cost Notes

- GPT-Image-1 / OpenAI: ~8–15s per image, ~$0.04–0.08 per image (1024×1024)
- xAI Aurora: comparable to GPT-Image-1; pricing subject to xAI's published rates
- Stability AI SDXL: ~3–8s per image, ~$0.002–0.006 per image
- Flux (fal.ai): ~2–5s, competitive pricing, highest quality

For a typical 3-section scaffold with 2 background images, total generation adds ~15–30s. The UI should show per-image progress in the "Analyzing…" step.

---

---

## Part 3: Scroll-Driven Background Transitions + Gradient Overlays

Part 3 implements true simultaneous crossfade between section backgrounds, a full transition vocabulary, gradient overlay masks, and enriched HTML signal extraction for the Mul Converter. No production pages currently use the sections format, so there is no backward compatibility burden.

### Renderer architecture: true crossfade via fixed-position background stack

The renderer splits into two independent passes:

**Pass 1 — Fixed background stack.** All section background composites are rendered as `position: fixed; inset: 0` layers, z-ordered so that earlier sections in the page sit above later ones (section 0 = highest z-index). Scroll-driven animation (`animation-timeline: view()`, anchored to each section's content spacer) drives opacity, clip-path, or transform on each layer as its corresponding section exits the viewport.

**Pass 2 — Transparent content sections.** Content sections are normal document-flow divs with no background CSS. They provide scroll height, anchor animation timelines, and render zone grids above the background stack.

This produces **true simultaneous crossfade**: as section A's composite fades from opacity 1→0, section B's composite (already at full opacity at a lower z-index) is revealed beneath it. At the midpoint of the transition both composites are visible simultaneously — a genuine dissolve, not a sequential fade-to-nothing.

### Composite unit: background image + overlay

The overlay div is a child of the background composite layer — not a sibling at the same level. When the composite transitions (fades, clips, slides), the overlay rides it as a single inseparable unit. No synchronization is needed because there is nothing to synchronize: the scrim belongs to its background.

```
<div class="fixed-bg-layer" style="z-index: N; ...scroll-driven animation...">
  <div class="bg-image" />      ← image
  <div class="bg-overlay" />    ← overlay rides the composite
</div>
```

**Parallax exception.** For `transition: 'parallax'`, the image drifts at ~50% scroll speed while the overlay must remain planted (otherwise the gradient shifts relative to the zone text, breaking legibility). Image and overlay are siblings inside the fixed layer; `transform` is applied only to the image div. The image is oversized by 20% top/bottom to prevent black bars at drift extremes.

### `background.transition` vocabulary

`'parallax'` moves from `attachment` to `transition`. `attachment` is simplified to `'scroll' | 'fixed'` only.

| Value | Visual effect | Best use |
|---|---|---|
| `'none'` | Hard edge (default) | Color and gradient backgrounds; no regression |
| `'fade'` | Composite opacity 1→0 as section exits; dissolves into section below | Hero image sections; default for image backgrounds |
| `'wipe-v'` | Vertical clip wipe upward | Structured transitions; intentional hard-edge variant |
| `'wipe-left'` | Lateral clip wipe, composite clips left revealing next from right | Alternating image+text, magazine style |
| `'wipe-right'` | Lateral clip wipe, reverse | Reverse magazine alternation |
| `'slide-up'` | Composite translates upward off screen | Motion-heavy, scroll-storytelling pages |
| `'parallax'` | Image drifts at ~50% scroll speed; overlay stays planted | Photography-forward, depth aesthetics |

### Gradient overlay patterns

When `overlay.gradient` is set, alpha is baked into the gradient stops; no separate `opacity` field is needed.

| Pattern | CSS | Use |
|---|---|---|
| Bottom vignette | `linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)` | Hero with headline at the bottom — default |
| Top vignette | `linear-gradient(to top, transparent 30%, rgba(0,0,0,0.75) 100%)` | Caption above a photo |
| Dual vignette | `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.5) 100%)` | Framed / cinematic section |
| Radial vignette | `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)` | Centre-focus portrait or product shot |
| Side fade | `linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 60%)` | Text panel beside an image, left-aligned |

### Enriched HTML extraction: `AnimationSignals`

The HTML extractor adds `extractAnimationSignals(html)` producing an `AnimationSignals` struct passed to the AI alongside colors and DOM structure:

```typescript
interface AnimationSignals {
  hasFixedBackground: boolean      // background-attachment: fixed in CSS
  hasScrollTimeline: boolean       // animation-timeline or scroll() detected
  hasKeyframes: boolean            // @keyframes present
  hasOpacityTransition: boolean    // transition/animation involving opacity
  hasTransformTransition: boolean  // transition/animation involving transform
  hasStickyElements: boolean       // position: sticky
  hasHighZIndexStack: boolean      // z-index > 10 on multiple elements
  libraryFingerprints: string[]    // ['aos', 'gsap', 'locomotive', 'framer-motion']
  overlayGradients: string[]       // extracted gradient strings from overlay elements
  motionClassNames: string[]       // class names: parallax, fade, scroll-reveal, etc.
}
```

Library detection is by data-attribute and class-name fingerprint — no script parsing required. This gives the model concrete observable evidence rather than requiring it to guess from palette alone.

### System prompt Section 3C: signal-to-tool decision tree

The system prompt teaches the model to map `AnimationSignals` to transition and overlay choices — **semantic equivalence, not literal CSS replication**:

- `hasFixedBackground` or `motionClassNames` contains `"parallax"` → `transition: 'parallax'`
- `libraryFingerprints` contains `"aos"`, `"framer-motion"`, or `"locomotive"` → `transition: 'fade'` (these libraries predominantly use opacity reveals)
- `libraryFingerprints` contains `"gsap"` → `transition: 'slide-up'` (GSAP commonly animates translateY)
- DOM shows alternating image+text pairs → alternate `'wipe-left'` / `'wipe-right'`
- Photography-forward page, no specific signal → `transition: 'fade'`
- No motion signals, structural/editorial layout → `transition: 'none'`
- `overlayGradients` non-empty → adopt detected gradient direction and alpha
- Hero section with image background and zone heading → bottom vignette gradient overlay by default
- Full-zone body text → solid overlay at 0.4–0.6 opacity
- Decorative / no zone text → no overlay
- Any image background with `transition !== 'none'` → `minHeight: "60vh"`

---

## Future Work (v2+)

- **Vision mode**: Optionally take a screenshot via a configurable screenshot API (urlbox.io, htmlcsstoimage.com) and send the image to a vision-capable model alongside the HTML data. Significantly better for visually unusual pages that don't expose colors in CSS, or pages that rely on background images for layout identity.
- **Media Library image picker for placeholders**: After scaffold creation without image generation, a picker lets the owner drag Media Library assets into `"media://placeholder"` slots inline in the ResultsPanel.
- **Conversion history**: Store past `MulResult` entries so the owner can revisit or re-apply a previous analysis without re-fetching.
- **Palette editing UI**: A color-picker interface for adjusting individual slots before saving, rather than raw hex inputs.
- **Export / share**: Export a palette as a JSON file that another AECMS instance can import.
- **Section responsive overrides**: Per-section `collapseBelow` setting to control at which breakpoint columns collapse — for cases where a 2-column section should remain 2-column on tablet.
- **Human editor controls for AI properties**: UI controls in the section editor for gradient backgrounds, overlay opacity, zone scheme, drop caps, letter spacing, and text transform. These properties are handled by the renderer and steward-preserved by the editor in v1 but have no explicit controls. Add incrementally.
- **Freeform canvas positioning**: Absolute x/y placement of blocks. Requires a full breakpoint system to remain responsive; out of scope for AECMS's lightweight positioning as a CMS, not a visual builder.
