# Phase 28 Plan: Multi-Layer Section Backgrounds

**Status**: 📋 PLANNED  
**PRD**: `docs/prd/13-mul-converter.md` § "Multi-layer section backgrounds"  
**Dependencies**: Phase 23 (single-layer background system, fixed-position stack, mode/movement/exit model)

---

## Overview

Extend the section background system from a single `SectionBackground` object to an ordered array of layers (`SectionBackground[]`). Each layer is an independent fixed-position slide with its own image/color/gradient, movement axis, exit axis, overlay, and drift rate. The fixed-position stack introduced in Phase 23 already accommodates multiple layers per section architecturally — the primary work is data model, scroll handler iteration, and panel UI.

### What this enables

- **Multi-depth parallax**: base color layer + texture PNG at slow drift + cut-out foreground PNG at faster drift — three planes of depth from a single section
- **Composited transparency**: PNG cut-outs with alpha transparency composite over subsequent sections' backgrounds through the z-ordered stack (earlier sections sit above later ones)
- **Simultaneous opposing exits**: two layers exit in opposite directions at the section boundary (e.g., one wipes left while another slides up)
- **Layered vignettes**: separate overlay layers with different gradient directions and opacities for complex lighting effects without baking them into the source image

---

## Schema change

`SectionBackground` → `SectionBackground[]` on `PageSection.backgrounds`:

```typescript
interface PageSection {
  // ...existing fields...
  background?: SectionBackground;   // deprecated — single-layer compat read
  backgrounds?: SectionBackground[]; // new — ordered array, index 0 = topmost layer
}
```

Backward compat: if `backgrounds` is absent, read `background` as a single-entry array. Renderer always works from `backgrounds`. No migration needed — JSONB field stores both schemas; the read-time fallback handles legacy data.

Each `SectionBackground` entry gains two new fields:

```typescript
entry?: SectionBackgroundEntry;  // how the layer animates INTO view when the section enters
                                 // the viewport — required when mode === 'animated'
parallaxRate?: number;           // 0.0–1.0, default 0.1 (10% drift)
                                 // Only meaningful when movement === 'parallax'
```

The existing `mode`/`movement`/`exit`/`overlay`/`imageSize` fields apply independently per layer.

---

## Entry animations

### Entry vocabulary

When `mode === 'animated'`, the layer is "off stage" until the section's top boundary crosses the bottom of the viewport. At that moment the entry animation fires (once per page load) and the layer moves from its initial off-stage state to its resting position, after which the `movement` axis takes over for the duration of the scroll through the section, and `exit` fires as the section's bottom boundary leaves the viewport top.

```typescript
type SectionBackgroundEntry =
  | 'none'        // layer is visible immediately; no entry animation
  | 'fade'        // fades from opacity 0 → 1 over ~0.6s
  | 'fly-left'    // slides in from off-screen left (translateX(-100vw) → 0)
  | 'fly-right'   // slides in from off-screen right (translateX(100vw) → 0)
  | 'fly-up'      // slides in from below the viewport (translateY(100vh) → 0)
  | 'fly-down'    // slides in from above the viewport (translateY(-100vh) → 0)
  | 'zoom'        // scales from 1.15 → 1.0 while fading in (creates "push forward" feel)
  | 'wipe-left'   // clip-path reveals from right → left (content appears from right side first)
  | 'wipe-right'  // clip-path reveals from left → right
  | 'wipe-up'     // clip-path reveals from bottom → top
  | 'wipe-down'   // clip-path reveals from top → bottom
```

`none` is a first-class option (explicitly "no entry animation" rather than unset). Because entry is **required** when `mode === 'animated'`, `none` is the panel default for new layers; the user must make an explicit choice from the three groups before the panel allows saving.

### Entry trigger mechanics

Entry animations are **one-shot per page load**, not scroll-position-continuous (unlike movement and exit). They fire once when the section crosses into the viewport for the first time.

Implementation options (choose one at implementation time):
- **IntersectionObserver** with `threshold: 0, rootMargin: '0px'` watching each section element; on first `isIntersecting = true` event, apply the entry CSS class to the corresponding fixed layer(s) and disconnect the observer for that section.
- **Scroll handler extension**: track a `Set<string>` of `sectionId`s whose entry animation has already fired; in the existing scroll handler, when `sectionTop <= viewportBottom` for the first time for a given section, add a `data-section-entered="true"` attribute to each of the section's fixed layers.

The IntersectionObserver approach is preferred (cleaner, lower CPU on subsequent scrolls), but the scroll handler extension is acceptable if it keeps all animation logic in one place.

CSS for the entry state: fixed layers start with a CSS class `bg-layer--pre-entry` applied at render time; on trigger, this class is replaced (or the `data-section-entered` attribute toggled). The `@keyframes` for each entry type animate from the off-stage initial state to the neutral resting state (`transform: none; opacity: 1; clip-path: inset(0)`).

```css
/* example for fly-left */
@keyframes bg-entry-fly-left {
  from { transform: translateX(-100vw); }
  to   { transform: translateX(0); }
}
.bg-layer[data-entry="fly-left"][data-section-entered="true"] {
  animation: bg-entry-fly-left 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

Duration: 0.4–0.8s depending on entry type. Fly and zoom entries use a deceleration curve (`cubic-bezier(0.22, 1, 0.36, 1)`); wipe entries use a linear curve for the clip-path reveal. All durations and curves are CSS custom properties, so the implementation can expose them as advanced options later without schema changes.

### Interaction with Traditional mode

When `mode === 'traditional'` (or the section uses Traditional → Scroll), `entry` is ignored and no entry animation fires — the same rule that applies to `movement` and `exit`. The panel hides all three of Entry / Movement / Exit when mode is traditional.

### Requirement: all three groups mandatory when animated

When `mode === 'animated'`, the panel enforces that `entry`, `movement`, and `exit` all have a value before the section can be saved. The panel shows the three dropdowns as a single labelled group:

```
▼ Transition (required when Animated)
  Entry    [ Fly in from left    ▼ ]   ← NEW
  Movement [ Parallax            ▼ ]
  Exit     [ Wipe left           ▼ ]
```

If any of the three is unset, the panel shows an inline warning and the SectionEditor save button is disabled for that section. `none` is a valid selection for Entry (meaning "appear instantly"), so the user always has an escape hatch without having to pick Traditional mode.

---

## Renderer changes (`SectionsLayout.tsx`)

`needsFixedStack()` returns true if ANY layer in `backgrounds` has `mode === 'animated'`.

Pass 1 (fixed stack): iterate `fixedEntries`; for each section, iterate its `backgrounds` array and emit one `FixedBackgroundLayer` per animated layer. Z-index allocation: earlier sections sit above later sections; within a section, layer index 0 sits above layer index 1, etc.

Each `FixedBackgroundLayer` renders with:
- `data-entry="${layer.entry ?? 'none'}"` — consumed by CSS to select the correct `@keyframes`
- `class="bg-layer--pre-entry"` initially (holds the layer in its off-stage position)
- `data-section-layer="${sectionId}-${layerIndex}"`
- `data-section-parallax-image="${sectionId}-${layerIndex}"` (when movement = parallax)

Scroll handler: iterate layers per section independently. Each layer has its own `movement`/`exit` axes and `parallaxRate`. Entry animation is triggered separately (IntersectionObserver preferred) and is one-shot per layer — the scroll handler does not re-trigger it.

Traditional layers (mode === 'traditional') within a multi-layer section: rendered as stacked `absolute inset-0` divs inside the section div, in reverse z-order (last layer in array = lowest). At most one Traditional layer per section is meaningful in practice, but the model allows it.

---

## SectionBackgroundPanel UI

The panel body restructures around a layer list:

```
[ Layer 1 ▼ ]  ← collapsed accordion card, draggable
[ Layer 2 ▼ ]
[ + Add Layer ]
```

Each card expands to show the existing Background / Overlay / Transition sub-sections, plus a new "Drift Rate" slider (0–100%, shown only when movement === 'parallax').

The **Transition sub-section** expands from a two-field layout (Movement + Exit) to a three-field layout (Entry + Movement + Exit), shown only when mode = animated. Each field is a labelled dropdown. All three are required; the panel marks any unset field with a red outline and blocks the parent SectionEditor's save for that section until all three are chosen:

```
Transition
  Entry    [ — choose entry —   ▼ ]   (red outline until set; "None" is a valid choice)
  Movement [ — choose movement — ▼ ]
  Exit     [ — choose exit —    ▼ ]
  Drift Rate  ████░░░░  10%        (shown only when movement = parallax)
```

Layer ordering: drag handle on each card, same `@dnd-kit/sortable` pattern as section reorder. Layer 1 = topmost in the stack.

Delete: × button on each card; warns if the layer has content. Minimum one layer always present.

The existing single-layer panel becomes the collapsed-but-expanded state of layer 1 when there is only one layer — no UI regression for single-layer sections.

---

## Mul Converter integration

The AI output schema gains `backgrounds: SectionBackground[]` replacing `background`. Single-layer output remains valid (array of one). The system prompt section 3 (page schema) and section 3D (signal mapping) are updated to describe multi-layer output when signals indicate layered depth (e.g., `hasHighZIndexStack: true`, multiple detected overlay gradients, or photography-forward + strong motion signals).

When `mode === 'animated'`, the AI **must** output all three of `entry`, `movement`, and `exit` for each layer — the same requirement as the panel. If the AI omits `entry`, the parser defaults it to `'none'` rather than failing, but the system prompt instructs the AI to always set it explicitly.

`entry` guidance in the system prompt (§ 3D signal mapping):
- Strong horizontal motion cues (e.g., sidescrolling layout, chevron-heavy design) → `fly-left` or `fly-right`
- Depth / reveal cues (curtain-open compositions, masked images) → `wipe-right` or `wipe-down`
- Cinematic / slow-reveal cues → `zoom` or `fade`
- Neutral / content-first sections → `fade` or `none`

`parallaxRate` field is set by the AI based on signal strength:
- Strong depth cues (multiple parallax signals) → 0.15–0.2 for foreground layer, 0.05–0.08 for background layer
- Moderate depth → 0.1 (default) for all layers
- Decorative texture → 0.05

---

## Acceptance criteria

1. Single-layer sections with saved `background` (old schema) render identically — no regression
2. `backgrounds` array with 2–3 layers renders each as an independent fixed-position layer
3. Z-ordering: layer 0 sits above layer 1 within the same section; section 0 sits above section 1 across sections
4. PNG transparency in any layer composites correctly over lower layers and subsequent sections
5. Independent `parallaxRate` per layer produces visually distinct drift speeds
6. Opposing exits (layer 0 wipes left, layer 1 wipes right) animate correctly and simultaneously
7. **Entry — fly-in variants**: with `entry: 'fly-left'`, the layer arrives from off-screen left and stops in position as the section enters the viewport; equivalent test for `fly-right`, `fly-up`, `fly-down`
8. **Entry — fade / zoom / wipe variants**: each entry type visually distinct and matches its description
9. **Entry — one-shot**: scrolling back up and down does not replay the entry animation a second time
10. **Entry — `none`**: layer is immediately visible when the section enters; no animation fires
11. **Traditional mode**: no entry animation fires for Traditional-mode layers; panel hides all three Transition dropdowns
12. **Panel validation**: saving a section with `mode = 'animated'` and any of Entry / Movement / Exit unset is blocked; error message identifies which fields are missing
13. Panel: add/remove/reorder layers; each card has full Background/Overlay/Transition controls
14. Panel: single-layer section shows no UI regression vs current panel
15. Mul Converter: AI output includes `entry` on every animated layer; all three groups populated; output saves and renders correctly

---

## Out of scope

- More than 5 layers per section (diminishing returns, complexity cost)
- Per-layer `minHeight` (section-level only)
- Layer blend modes (CSS `mix-blend-mode`) — separate future item
- Video layers — separate future item
