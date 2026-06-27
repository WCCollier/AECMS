# BUG-002: Mul Converter saves duplicate palettes on repeated or confused clicks

**Status:** `open`
**Reported:** 2026-06-27
**Severity:** `medium`
**Area:** mul-converter — ActionBar, palette save flow

---

## Description

After a successful Mul Converter analysis, clicking any save action that includes a palette (Save Palette Only, Save Both) saves the palette correctly but leaves all three action buttons re-enabled in the `done` state. The success message reads "Done! Check your Media Library for generated images" — which is about image generation, not palette saving — so a user with no images (text-only ingest) sees a confusing success state and may click save again. Each additional click appends another copy of the palette (same name and colors, but a new UUID) to the stored list. Three clicks → three identical-looking palettes in the theme picker.

A second contributing issue makes this worse: `newPalette` is constructed unconditionally in the component body on every render, so each render produces a fresh UUID. This means each duplicate gets a unique ID that Prisma/the settings store treats as a distinct entry — there's no natural deduplication backstop.

---

## Reproduction Steps

1. Run a text-only Mul Converter ingest (no images) and get a result.
2. Click **Save Palette Only** (or **Save Both**).
3. Observe the success message: "Done! Check your Media Library for generated images."
4. Note that all three buttons are re-enabled.
5. Click **Save Palette Only** again.
6. Repeat once more.
7. Navigate to **Settings → Appearance** and open the custom palette list.
8. **Observed:** Three palettes with identical names and color values.
9. **Expected:** One palette; buttons disabled (or reset) after the first successful save.

---

## Root Cause

Two issues combine to produce the symptom:

### Issue 1 — Buttons re-enable after `done` state (`ActionBar.tsx`)

`busy` is defined as:

```typescript
// ActionBar.tsx line 91
const busy = state === 'savingPalette' || state === 'creatingPage' || state === 'savingBoth';
```

`'done'` is not included, so once a save completes the three buttons are re-enabled and clickable. There is no guard preventing a second (or third) palette save after the first succeeds.

### Issue 2 — `newPalette` is unmemoized (`ActionBar.tsx` lines 22–27)

```typescript
const newPalette: ThemePalette = {
  id: `custom-${crypto.randomUUID()}`,  // new UUID on every render
  name: result.palette.name,
  ...
};
```

Because `newPalette` is declared at the component body level without `useMemo`, every render creates a new object with a new UUID. The `savePalette` function closes over the `newPalette` from its own render cycle. This means each additional click sends a palette that is a distinct object (different ID) even though name and colors are identical — so the settings store appends it rather than detecting a duplicate.

### Combined effect

Each click after the first:
- Reads the now-updated `customPalettes` (SWR has re-fetched after the previous save)
- Appends a new `newPalette` (same content, fresh UUID)
- PATCHes `/settings/appearance` with the grown array
- Server upserts the full array — no deduplication at this layer

Backend (`settings.controller.ts`, `settings.service.ts`) is correct; it faithfully stores whatever array the frontend sends.

---

## Fix Plan

All changes are in `frontend/app/admin/mul-converter/components/ActionBar.tsx`. No backend changes needed.

### 1 — Disable buttons permanently in `done` state

Change `busy` to also cover `'done'`:

```typescript
const busy =
  state === 'savingPalette' ||
  state === 'creatingPage' ||
  state === 'savingBoth' ||
  state === 'done';
```

This is the primary fix. Once any save action succeeds, all three buttons are disabled for the lifetime of the component mount. If the user wants to save again they must re-run the analysis (navigating away resets state).

### 2 — Stabilize `newPalette` with `useMemo`

```typescript
import React, { useState, useMemo } from 'react';

const newPalette: ThemePalette = useMemo(() => ({
  id: `custom-${crypto.randomUUID()}`,
  name: result.palette.name,
  scheme: result.palette.scheme,
  colors: result.palette.colors as unknown as ThemePalette['colors'],
}), [result.palette]);
```

This ensures the same object (same UUID) is used throughout the component's lifetime unless `result.palette` actually changes. Removes the risk of identity-based duplication if the first fix ever regresses.

### 3 — Clarify the success message for palette-only saves

The current message ("Done! Check your Media Library for generated images") is only meaningful when images were generated. For text-only saves, it's confusing and doesn't confirm the palette was saved.

```typescript
{state === 'done' && (
  <p className="text-xs text-green-400">
    Saved! {result.page?.sections?.length
      ? 'Page draft and palette have been created.'
      : 'Palette has been saved to your theme.'}
  </p>
)}
```

A simpler approach: always say "Saved! Your selections have been applied." and drop the Media Library reference (which is only relevant if image generation was run, which happens during analyze, not during save).

### Key considerations

- Fix 1 is sufficient to prevent the bug. Fixes 2 and 3 are hardening and UX improvements.
- The `done` state is local to the ActionBar mount. Navigating to the page editor (which `handleBoth` triggers via `onPageCreated → router.push`) unmounts the component anyway, so the button lockout only matters for the "Save Palette Only" path where the user stays on the Mul Converter page.
- No migration or backend work required.
- No new tests strictly required; the existing Mul Converter tests (if any) should be checked to ensure they don't rely on buttons being re-enabled after save.

---

## Completion Report

> _Fill in after fix is deployed._

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | open | Reported after text-only Mul Converter test produced 3 duplicate palettes |
