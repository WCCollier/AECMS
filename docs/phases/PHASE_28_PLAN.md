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

Each `SectionBackground` entry gains one new field:

```typescript
parallaxRate?: number;  // 0.0–1.0, default 0.1 (10% drift)
                        // Allows independent drift speeds per layer for multi-depth parallax.
                        // Only meaningful when movement === 'parallax'.
```

The existing `mode`/`movement`/`exit`/`overlay`/`imageSize` fields apply independently per layer.

---

## Renderer changes (`SectionsLayout.tsx`)

`needsFixedStack()` returns true if ANY layer in `backgrounds` has `mode === 'animated'`.

Pass 1 (fixed stack): iterate `fixedEntries`; for each section, iterate its `backgrounds` array and emit one `FixedBackgroundLayer` per animated layer. Z-index allocation: earlier sections sit above later sections; within a section, layer index 0 sits above layer index 1, etc.

Scroll handler: iterate layers per section independently. Each layer has its own `movement`/`exit` axes and `parallaxRate`. The `data-section-layer` attribute becomes `data-section-layer="${sectionId}-${layerIndex}"` and `data-section-parallax-image` becomes `data-section-parallax-image="${sectionId}-${layerIndex}"`.

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

Layer ordering: drag handle on each card, same `@dnd-kit/sortable` pattern as section reorder. Layer 1 = topmost in the stack.

Delete: × button on each card; warns if the layer has content. Minimum one layer always present.

The existing single-layer panel becomes the collapsed-but-expanded state of layer 1 when there is only one layer — no UI regression for single-layer sections.

---

## Mul Converter integration

The AI output schema gains `backgrounds: SectionBackground[]` replacing `background`. Single-layer output remains valid (array of one). The system prompt section 3 (page schema) and section 3D (signal mapping) are updated to describe multi-layer output when signals indicate layered depth (e.g., `hasHighZIndexStack: true`, multiple detected overlay gradients, or photography-forward + strong motion signals).

The `parallaxRate` field is set by the AI based on signal strength:
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
7. Panel: add/remove/reorder layers; each card has full Background/Overlay/Transition controls
8. Panel: single-layer section shows no UI regression vs current panel
9. Mul Converter: AI output includes `backgrounds` array; multi-layer output saves and renders correctly

---

## Out of scope

- More than 5 layers per section (diminishing returns, complexity cost)
- Per-layer `minHeight` (section-level only)
- Layer blend modes (CSS `mix-blend-mode`) — separate future item
- Video layers — separate future item
