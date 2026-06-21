# PRD 13: Mul Converter

**Version**: 1.0  
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

## Non-Goals (v1)

- Automated content migration (text, images) from the source page
- Semantic replication of navigation structure
- Support for CSS animations, gradients as accent colors, or transparency effects in the palette
- Font pairing extraction (deferred to v2; font names are read but not yet wired into the font pairing system)
- Batch/multi-URL analysis
- Conversion history or diff view
- Freeform/absolute canvas positioning (see Page Schema Evolution below)

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
  Provider: Anthropic | OpenAI
  Model: text field (e.g. claude-sonnet-4-6, gpt-4o)
  API Key: password field → saved encrypted in ISM as mul.api_key_enc
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
  content: TipTapDoc;
}

interface PageSection {
  id: string;       // client-generated UUID
  columns: number;  // grid resolution for this section — positive integer, no upper limit
  minHeight?: string;  // CSS value — e.g. "100vh", "400px"; omit for auto height
  background?: {
    type: 'none' | 'color' | 'image';
    value?: string;       // hex string for 'color'; "media://uuid" for 'image'
    attachment?: 'scroll' | 'fixed' | 'parallax';
  };
  zones: PageZone[];  // ordered left-to-right; spans must sum to columns
}

interface SectionsPageContent {
  type: 'sections';
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
  analyze(data: PageData, outputSchema: MulOutputSchema): Promise<MulResult>;
}

class AnthropicMulProvider implements MulProvider { ... }
class OpenAIMulProvider      implements MulProvider { ... }
```

Provider is selected at request time by reading `mul.provider` from ISM. The module **does not require** the Anthropic or OpenAI SDK to be present in the container — both providers are implemented as thin HTTP clients (using `fetch`/`axios`) so neither SDK is a hard dependency. This keeps the Docker image lean and keeps provider support additive.

### ISM Keys (namespace: `mul.*`)

| Key | Encrypted | Description |
|-----|-----------|-------------|
| `mul.provider` | No | `anthropic` \| `openai` |
| `mul.model` | No | e.g. `claude-sonnet-4-6`, `gpt-4o` |
| `mul.api_key_enc` | Yes (`_enc`) | API key for the chosen provider |

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
  { "type": "heading", "attrs": { "level": 1|2|3 }, "content": [{ "type": "text", "text": "..." }] }
  { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
  { "type": "bulletList", "content": [{ "type": "listItem", "content": [...] }] }

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
    "sections": [
      {
        "columns": number,    // positive integer — grid resolution for this section
        "minHeight": string | undefined,
        "background": { "type": "none"|"color"|"image", "value": string, "attachment": "scroll"|"fixed"|"parallax" } | undefined,
        "zones": [            // ordered array, left to right; spans must sum to columns
          { "id": string, "span": number, "content": { "type": "doc", "content": [...] } }
        ]
      }
      // … one entry per section
    ]
  },
  "metadata": {
    "confidence": "high" | "medium" | "low",
    "notes": string           // 1–2 sentences: what you inferred and any caveats
  }
}
```

The system prompt is assembled in `MulConverterService.buildSystemPrompt()` and kept as a constant — it is not user-editable in v1.

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

The settings panel is a collapsible `<details>` section at the top. On first visit (when `mul.provider` is unset), it is pre-expanded with a banner: "Configure your AI provider before running your first analysis."

Provider radio: `Anthropic` | `OpenAI`  
Model input: text field, pre-filled with a sensible default based on selected provider (`claude-sonnet-4-6` for Anthropic, `gpt-4o` for OpenAI)  
API Key: password-style input; shows `••••••••` if a key is already saved  
Save button: `PATCH /mul/settings`

---

## LLM Model Recommendations

The user supplies their own model. The system prompt is text-only (no image attachments in v1), so any sufficiently capable text model works. Guidance shown in the settings panel:

| Provider | Recommended Model | Notes |
|----------|------------------|-------|
| Anthropic | `claude-sonnet-4-6` | Best balance of speed, cost, and layout reasoning. Strong structured output via tool use. |
| Anthropic | `claude-opus-4-8` | Highest quality for complex pages; noticeably more expensive. |
| OpenAI | `gpt-4o` | Equivalent quality to Sonnet 4.6; supports strict JSON schema. |
| OpenAI | `gpt-4o-mini` | Faster and cheaper; acceptable for simple pages with straightforward color schemes. |

**Why not require a vision model?** The text-based HTML extraction is sufficient for most palette and layout inferences. The dominant CSS colors are explicitly present in the source; the DOM structure gives enough layout signal. Vision adds marginal value at higher cost and API complexity. A vision enhancement path is reserved for v2 (see Future Work).

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
  │  4. Read provider/model/key from ISM
  │  5. Build system prompt + user message
  │  6. Call AI provider (Anthropic or OpenAI)
  │  7. Parse + validate structured JSON response
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

## Future Work (v2+)

- **Vision mode**: Optionally take a screenshot via a configurable screenshot API (urlbox.io, htmlcsstoimage.com) and send the image to a vision-capable model alongside the HTML data. Significantly better for visually unusual pages that don't expose colors in CSS, or pages that rely on background images for layout identity.
- **Font pairing extraction**: Read `font-family` declarations from extracted CSS; map to available font pairings or generate a Google Fonts URL for custom pairings.
- **Section background image upload**: After scaffold creation, prompt the owner to upload images from the Media Library to fill `"media://placeholder"` background slots in the generated sections.
- **Conversion history**: Store past `MulResult` entries so the owner can revisit or re-apply a previous analysis without re-fetching.
- **Palette editing UI**: A color-picker interface for adjusting individual slots before saving, rather than raw hex inputs.
- **Export / share**: Export a palette as a JSON file that another AECMS instance can import.
- **Section responsive overrides**: Per-section `collapseBelow` setting to control at which breakpoint columns collapse — for cases where a 2-column section should remain 2-column on tablet.
- **Freeform canvas positioning**: Absolute x/y placement of blocks. Requires a full breakpoint system to remain responsive; out of scope for AECMS's lightweight positioning as a CMS, not a visual builder.
