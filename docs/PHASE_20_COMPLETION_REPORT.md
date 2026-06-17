# Phase 20 Completion Report: Themes and Templates

**Project**: AECMS  
**Phase**: 20  
**Status**: ✅ COMPLETE  
**Primary commit**: `76ae614`  
**Date**: 2026-06-17

---

## Summary

Phase 20 introduced a full theming system: 8 curated colour palettes and 5 typography pairings, all selectable through an admin appearance UI and applied site-wide via CSS custom properties injected into the root layout at request time. The theme is stored as a single JSON value in the `SiteSettings` table (added in Phase 15) and is fetched server-side on every page render with a 5-minute Next.js cache, so visitors see the updated theme within 5 minutes of the owner saving it — no server restart required.

---

## What Was Delivered

### Area 20-A: Theme Catalogue (`frontend/lib/themes.ts`)

**8 Colour Palettes**

Each palette defines a `ThemeColors` object with 10 CSS variable values:

| Variable | Purpose |
|---|---|
| `--color-background` | Page background |
| `--color-surface` | Card / sidebar background |
| `--color-surface-raised` | Hover states, dropdowns |
| `--color-foreground` | Primary text |
| `--color-muted` | Secondary text, placeholders |
| `--color-border` | Dividers, input borders |
| `--color-accent` | Primary action colour (buttons, links) |
| `--color-accent-hover` | Hover state of accent |
| `--color-accent-foreground` | Text on accent backgrounds |
| `--color-destructive` | Error / danger colour |

| Palette | Scheme | Character |
|---------|--------|-----------|
| Midnight | dark | Deep navy background, blue accent |
| Slate | dark | Cool charcoal, slate-blue accent |
| Sage | light | Off-white, earthy green accent |
| Ember | dark | Near-black, warm amber accent |
| Dusk | dark | Indigo-purple, violet accent |
| Parchment | light | Warm cream, terracotta accent |
| Ocean | light | Light blue-grey, teal accent |
| Noir | dark | True black, white accent |

**5 Font Pairings**

Each pairing provides `headingFont`, `bodyFont`, `headingCss`, `bodyCss` (CSS font-family strings), and a `googleFontsUrl` for loading from Google Fonts:

| ID | Name | Heading | Body |
|----|------|---------|------|
| `default` | Default / Inter | Inter | Inter |
| `classic-literary` | Classic Literary | Playfair Display | Lora |
| `modern-editorial` | Modern Editorial | Libre Baskerville | Source Sans 3 |
| `authorly` | Authorly | Merriweather | Nunito Sans |
| `friendly` | Friendly | Poppins | Open Sans |

The `'default'` pairing uses `Inter` which is already bundled by Next.js; its `googleFontsUrl` is empty and no `<link>` tag is injected.

**`buildCssOverrides(palette, fontPairing)`**

Returns a CSS string suitable for injection in a `<style>` block:

```css
:root {
  --color-background: #0d1117;
  --color-foreground: #e6edf3;
  /* … other colour vars … */
}
body { font-family: 'Lora', Georgia, serif; }
h1, h2, h3, h4, h5, h6 { font-family: 'Playfair Display', Georgia, serif; }
```

**`getPaletteById(id)`** and **`getFontPairingById(id)`** — look up by ID with safe fallback to the first entry.

### Area 20-B: Root Layout Theme Injection

**`frontend/app/layout.tsx`** — changed from a synchronous component to an `async` server component.

```typescript
async function getSiteTheme() {
  const [themeRes, generalRes] = await Promise.all([
    fetch(`${backendUrl}/settings-public/theme`, { next: { revalidate: 300 } }),
    fetch(`${backendUrl}/settings-public/general`, { next: { revalidate: 300 } }),
  ]);
  // ...
}
```

- Both fetches use Next.js `fetch` with `{ next: { revalidate: 300 } }` (5-minute ISR cache)
- Falls back silently to `'midnight'` palette + `'default'` font pairing if the backend is unreachable (graceful degradation; the site still renders with sensible defaults)
- Injects into `<head>`:
  1. `<style>` block with the output of `buildCssOverrides(palette, fontPairing)`
  2. Google Fonts `<link rel="preconnect">` + `<link rel="stylesheet">` (only when `fontPairing.id !== 'default'`)

The CSS variables override the Tailwind defaults defined in `globals.css` via the cascade (`:root` specificity is equal, but the injected `<style>` appears later in `<head>` than the compiled stylesheet link).

### Area 20-C: Backend — PublicSettingsController

**`backend/src/settings/settings.controller.ts`** — added `PublicSettingsController` (no auth):

| Endpoint | Response |
|----------|----------|
| `GET /settings-public/theme` | `{ paletteId: string, fontPairingId: string }` |
| `GET /settings-public/general` | `{ siteTitle: string, tagline: string }` |

Both endpoints call `SettingsService.get()` internally and return only the specific non-sensitive fields. The underlying `theme` setting is stored as `JSON.stringify({ palette, fontPairing })`.

**`backend/src/settings/settings.module.ts`** — registered `PublicSettingsController` in the `controllers` array.

### Area 20-D: Admin Appearance UI

**`frontend/app/admin/settings/appearance/page.tsx`** — server shell (metadata title + renders `AppearanceClient`).

**`frontend/app/admin/settings/appearance/AppearanceClient.tsx`** — client component:

**Colour Palette grid** (4 columns, responsive to 2 on mobile):
- Each palette button shows: coloured background, three accent-dot swatches, palette name, scheme label, and a miniature "Button" pill using the palette's actual accent colour
- Selected state: blue border + blue checkmark badge in top-right corner
- Clicking a palette sets the selection and marks the form dirty

**Typography list** (vertical list):
- Each row shows: pairing name, heading/body font names, and a live preview using the CSS font-family string (`Aa` in heading font, `Bb Cc` in body font)
- Selected state: blue border + blue-tinted background
- Note at the bottom: "Font previews above use system fonts. The selected font will be loaded from Google Fonts on the live site." (Google Fonts don't load inside the admin — avoids unnecessary external requests on every admin page view)

**Save & Publish button**:
- Disabled when no changes are pending (tracked via `dirty` state)
- Calls `PATCH /settings` with `{ updates: { theme: JSON.stringify({ palette, fontPairing }) } }`
- On success: re-fetches settings, clears dirty state, shows "Saved" label

**Live CSS preview** (collapsible `<details>`):
- Shows the raw CSS output of `buildCssOverrides()` for the currently selected combination
- Useful for debugging or copying into a custom CSS tool

**`frontend/app/admin/layout.tsx`** — Appearance nav item added:
- Icon: `Paintbrush` (lucide)
- `requiredCap: 'system.configure'` — hidden from users without the configure capability
- Placed above Settings in the sidebar nav order

---

## Files Created / Modified

| File | Change |
|------|--------|
| `frontend/lib/themes.ts` | New — 8 palettes, 5 pairings, build helper |
| `frontend/app/layout.tsx` | Changed to async server component with theme injection |
| `backend/src/settings/settings.controller.ts` | `PublicSettingsController` added |
| `backend/src/settings/settings.module.ts` | `PublicSettingsController` registered |
| `frontend/app/admin/settings/appearance/page.tsx` | New (server shell) |
| `frontend/app/admin/settings/appearance/AppearanceClient.tsx` | New (palette grid + font list) |
| `frontend/app/admin/layout.tsx` | Appearance nav item |

---

## Test Results

- **New backend unit tests**: none (PublicSettingsController is a thin pass-through; covered by SettingsService tests)
- **Total backend tests**: 190 (all passing)
- **Frontend tests**: 125 (all passing)

---

## How Theme Changes Propagate

```
Owner saves in /admin/settings/appearance
  → PATCH /settings { theme: "{palette, fontPairing}" }
  → SiteSettings row updated
  → Next.js ISR cache for /settings-public/theme expires after 5 min
  → Next page render fetches fresh theme
  → New <style> block injected
  → Visitor sees new theme
```

For instant propagation (e.g. during a demo), the owner can trigger a cache bust by calling `GET /settings-public/theme` with a cache-busting query param, or by restarting the Next.js server.

---

## Remaining / Deferred

- **Custom colour picker** — the appearance UI only exposes the 8 curated palettes. A free-form colour picker for custom palettes is deferred (significant UI complexity, low priority for the initial deployment).
- **Custom CSS field** — a raw CSS textarea would allow the owner to override individual variables. Deferred.
- **Dark/light mode toggle for visitors** — the palettes are fixed at one mode (dark or light). A per-visitor mode toggle (with `prefers-color-scheme` support) is deferred.
- **Font upload** — only Google Fonts pairings are supported. Self-hosted font upload would require storage provider integration. Deferred to Phase 19 or later.
- **Preview iframe** — the admin page could embed a preview iframe of the site in real time. Deferred (cross-origin complexity).
