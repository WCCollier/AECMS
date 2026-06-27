# BUG-004: Zone vertical alignment — wrong icons and no visual effect

**Status:** `fixed`
**Reported:** 2026-06-27
**Severity:** `medium`
**Area:** page-editor, sections

---

## Description

The zone toolbar in the Page Editor has a vertical alignment control with three options (top, center, bottom). It has two independent bugs: (A) the icons shown are horizontal-alignment icons — they depict left/center/right distribution rather than top/center/bottom stacking — because the wrong lucide-react icon names were used (`AlignStartVertical` aligns around a *vertical axis*, which is horizontal alignment). (B) Changing the alignment setting has no visual effect on the live page, because the CSS technique used (`alignSelf` on the zone wrapper) only works when the grid row has spare height, but the row height is always `auto`-sized to content so there is never any spare height to align within.

---

## Reproduction Steps

1. Create a page with one section; set its minimum height to `100vh`.
2. Add two zones; put a single H1 in each.
3. Open the zone toolbar and try each of the three alignment options (top / center / bottom).
4. **Observed (A):** The three icons look like ◁▷ left/right alignment buttons, not ▲▼ top/bottom.
5. **Observed (B):** The H1 stays pinned to the top of the section regardless of which option is selected.

---

## Root Cause

### A — Wrong icons (`SectionEditor.tsx` line 4, 466–468)

`AlignStartVertical`, `AlignCenterVertical`, `AlignEndVertical` from lucide-react align elements *around a vertical axis* — i.e. left, centre, right. The correct icons for top/centre/bottom stacking are `AlignStartHorizontal`, `AlignCenterHorizontal`, `AlignEndHorizontal` (aligning around a horizontal axis).

### B — `alignSelf` has no room to act (`SectionsLayout.tsx` lines 21–25, 133–136)

`ZONE_ALIGN_STYLES` used `alignSelf: 'start|center|end'` on the zone grid item. `alignSelf` positions a grid item *within the remaining space of its row track*. But the grid container had no explicit height — its height was auto-sized to the tallest item — so every row track was exactly as tall as its content and there was zero spare space. `alignSelf` was therefore always a no-op.

The section wrapper did carry a `minHeight` (e.g. `100vh`) but that height never propagated into the `ZoneGrid` or its grid rows.

---

## Fix

**`frontend/components/admin/SectionEditor.tsx`** — swap icon imports:
```
AlignStartVertical   → AlignStartHorizontal
AlignCenterVertical  → AlignCenterHorizontal
AlignEndVertical     → AlignEndHorizontal
```

**`frontend/components/pages/layouts/SectionsLayout.tsx`** — three changes:

1. `ZONE_ALIGN_STYLES`: switch from `alignSelf` to `justifyContent` (used inside a flex column zone):
   ```ts
   start:  { justifyContent: 'flex-start' }
   center: { justifyContent: 'center' }
   end:    { justifyContent: 'flex-end' }
   ```

2. Section wrapper divs (both the inFixed spacer and the standard inline path): add `flex flex-col` so `ZoneGrid` can grow to fill the section height with `flex-1`.

3. `ZoneGrid`:
   - Outer div: add `flex-1 min-h-0` (grows within section flex container) and `height: '100%'` on the grid style.
   - Zone wrapper div: add `display: 'flex', flexDirection: 'column'` so `justifyContent` positions content vertically within the full-height zone.

**How the fixed layout flows:**

```
Section wrapper  (flex-col, minHeight: 100vh)
  └── ZoneGrid   (flex-1, height: 100% → fills section content area)
        └── grid (height: 100%)
              └── Zone div  (display: flex, flex-direction: column, justifyContent: center)
                    └── content  ← vertically centred
```

For sections without an explicit `minHeight`, there is no spare height and `justifyContent` silently has no effect, which is correct.

---

## Completion Report

**Fixed:** 2026-06-27
**Commit(s):** pending

### What changed
Implemented exactly as described above. No schema or data changes — `zone.align` values (`start`/`center`/`end`) are unchanged; only the CSS strategy for applying them changed. The fit-width image section render path was left untouched since it has image-defined geometry where vertical zone alignment does not apply.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Reported — wrong icons (A) and no visual effect (B) |
| 2026-06-27 | fixed | Icons corrected; height propagation + flex alignment implemented |
