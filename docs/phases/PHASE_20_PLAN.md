# Phase 20: Themes and Templates

**Project**: AECMS  
**Phase**: 20  
**Status**: 📋 PLANNED  
**Dependencies**: Phase 19 (deployed), Phase 16 (pages finalized)

---

## Goal

Give the site owner a backstage Theme panel to control the visual identity of the site: color palette, typography scale, header/page background images, and expanded page templates. The system must not require a rebuild — themes must apply at runtime via CSS variables or class-based switching.

---

## Background: Current State

Tailwind CSS v4 is used with a custom CSS variable theme defined in `frontend/app/globals.css`. The current variables include:
- `--background`, `--foreground`, `--surface`, `--surface-raised`, `--border`, `--accent`, `--accent-foreground`

These are set once at build time. There is no runtime theme switching and no backstage control for them. Tailwind v4's approach (CSS-first configuration via `@theme`) makes runtime variable-swapping straightforward.

---

## Part A — Color Palette System

### A1 — Color theory foundations

A well-designed theme provides at least three color roles:
- **Background / Neutral**: The page background and surface colors (near-white in light mode, near-black in dark mode)
- **Accent / Primary**: The brand color — used for links, buttons, and highlights
- **Contrast / Foreground**: Text and icon color — must have sufficient contrast against background

Harmony schemes (from color theory) that tend to produce pleasing palettes for websites:

| Scheme | Description | Use case |
|--------|-------------|----------|
| **Monochromatic** | Single hue, multiple tints/shades | Elegant, minimal; easiest to get right |
| **Analogous** | 2–3 adjacent hues on the wheel | Calm, cohesive; good for content sites |
| **Split complementary** | Base hue + two hues adjacent to its complement | Vibrant but balanced; good for creative sites |
| **Tetradic / double complementary** | Four hues at 90° intervals | Maximum variety; hardest to balance; use sparingly |
| **Triadic** | Three hues at 120° intervals | Bold; works well with one dominant and two accents |

**Recommended approach**: Offer a curated set of 8–12 pre-designed palettes (each labeled with a name and its color scheme type), plus a custom palette mode where the owner picks an accent color and the system derives a harmonious full palette.

### A2 — CSS variable approach (recommended)

Each theme is a set of CSS variable values. Themes are stored in the `SiteSettings` table (from Phase 19) as JSON. The Next.js layout injects them as an inline `<style>` block in `<head>`:

```html
<style>
  :root {
    --background: 0 0% 98%;
    --foreground: 220 15% 12%;
    --accent: 262 83% 58%;
    /* ... */
  }
</style>
```

This approach:
- Requires zero rebuild
- Works with Tailwind v4 (which reads CSS variables)
- Can be updated from the backstage and takes effect on next page load (or immediately via SSE/websocket push for live preview)
- Supports dark mode variants via `@media (prefers-color-scheme: dark)` inside the injected block

### A3 — Curated palette catalogue

Propose these starting palettes (each is a complete set of CSS variables):

| Name | Scheme | Accent | Character |
|------|--------|--------|-----------|
| **Midnight** | Monochromatic | Deep indigo `#4F46E5` | Default dark; sophisticated |
| **Slate** | Monochromatic | Slate blue `#6366F1` | Clean, technical |
| **Sage** | Analogous | Forest green `#16A34A` | Nature, calm |
| **Ember** | Analogous | Burnt orange `#EA580C` | Warm, editorial |
| **Dusk** | Split complementary | Violet `#7C3AED` + coral `#F87171` | Creative, vivid |
| **Ocean** | Triadic | Teal `#0891B2` with gold accents | Elegant, nautical |
| **Parchment** | Monochromatic | Warm brown `#92400E` | Literary, antiquarian |
| **Noir** | Monochromatic | Pure black/white | Minimalist fashion |

Each palette defines:
- Light mode: `--background`, `--foreground`, `--surface`, `--surface-raised`, `--border`, `--accent`, `--accent-foreground`, `--muted`
- Dark mode: same set of variables for dark variant
- Both modes are stored together and injected with a `@media (prefers-color-scheme: dark)` block

### A3a — Dark mode ✅ DECIDED

> **Decision**: No user-togglable dark mode. The owner sets the theme; visitors see exactly that. Dark mode / user-switching held for a future upgrade.

The theme is applied unconditionally — no `@media (prefers-color-scheme: dark)` block, no toggle button for visitors. The owner may choose to set a dark palette if desired; that simply becomes the site's permanent appearance.

### A4 — Custom palette builder

Option for the owner to define a custom palette:

**Input**: A single accent color (HSL or hex picker)  
**Derived automatically**:
- Background: white (light mode) or very dark shade of the accent hue at low saturation
- Surface: off-white or dark-surface with slight hue tint
- Foreground: near-black or near-white with guaranteed WCAG AA contrast ratio vs background (calculated in code)
- Border: mid-tone at low saturation
- Accent foreground: white or black, whichever contrasts better with the accent

Use the HSL color model for derivation — easy to adjust lightness while keeping hue and saturation.

```typescript
function deriveTheme(accentHex: string): ThemeVariables {
  const [h, s, l] = hexToHsl(accentHex);
  return {
    background: `${h} ${Math.min(s * 0.1, 5)}% 98%`,  // near-white with faint hue
    foreground: `${h} ${Math.min(s * 0.2, 15)}% 10%`, // near-black
    accent: `${h} ${s}% ${l}%`,
    'accent-foreground': l > 50 ? '0 0% 0%' : '0 0% 100%',
    surface: `${h} ${Math.min(s * 0.15, 8)}% 96%`,
    // ...
  };
}
```

---

## Part B — Typography

### B1 — Font families

Currently using system font stack. Add three settable font roles:
- **Heading font**: Used for `h1`–`h4`. Options: serif (elegant, literary), display sans-serif (modern), or slab serif (editorial).
- **Body font**: Used for article/page text. Options: readable sans-serif, classic serif.
- **Monospace font**: Used for code blocks.

**Font delivery**: Use Google Fonts (loaded at runtime via `<link>` in `<head>`). The chosen font slugs are stored in settings and injected by the layout. No font files are bundled at build time.

**Curated pairings** (rather than free-form font selection — too many options leads to bad choices):

| Name | Heading | Body |
|------|---------|------|
| Classic Literary | Playfair Display (serif) | Lora (serif) |
| Modern Editorial | DM Serif Display | DM Sans |
| Tech Minimal | Inter | Inter |
| Authorly | Cormorant Garamond | Source Sans Pro |
| Friendly | Nunito | Nunito Sans |

### B2 — Font scope ✅ DECIDED

> **Decision**: Lock the font to the selected pairing. Do not allow browser font preferences to override the site's typography.

**Why this is the right call**: When the owner chooses a pairing like Cormorant Garamond + Source Sans Pro, that choice is part of the site's visual identity. A visitor's "override document fonts" browser setting (Chrome: Settings → Appearance → Customize fonts → "Override website fonts") is opt-in and disabled by default — the overwhelming majority of users will see the selected font. The tiny minority who have explicitly overridden fonts have made an accessibility choice for themselves; nothing in CSS can reliably override that without accessibility implications.

**How to enforce it**: Specify `font-family` explicitly on `body`, `h1`–`h4`, and `code` elements using the Google Fonts `@import`. This is sufficient — browsers apply the override setting only when the user has actively enabled it, and specifying the font is no more or less "locked" than standard web font usage.

No extra work is required: standard Google Fonts usage already applies the font to all users who haven't explicitly opted into browser overrides.

### B3 — Type scale

Expose a single "type size" slider: Compact / Default / Generous. This adjusts the CSS `font-size` root value (affects all `rem`-based sizing throughout the app).

---

## Part C — Background Images

### C1 — Page / global background

Allow the owner to set a background image (or pattern) that tiles or covers the page background behind all content. Applied via `background-image` on the `<body>` element.

**Options**:
- **Solid color** (current behavior)
- **Subtle texture** — a curated set of CSS patterns (noise, grid lines, dots, diagonal lines) generated as inline SVG data URIs — no image upload required
- **Custom image** — owner uploads a photo; displayed as a fixed or scroll attachment with `background-size: cover`
- **Gradient** — linear or radial gradient between two colors in the active palette

**Opacity control**: Background images should be settable to partial opacity (e.g., 10–30%) so text remains readable. Implement as a separate overlay `<div>` with `opacity: 0.15` over a white/dark base, rather than `background-opacity` (which doesn't exist in CSS).

### C2 — Header / hero background

The site header (`<header>`) and any full-width hero sections can have their own background image, distinct from the page background.

**Options**:
- Solid accent color (current)
- Custom image with parallax scroll effect (CSS `background-attachment: fixed`)
- Dark overlay + image (for text legibility)

### C3 — Per-page background ✅ DECIDED

> **Decision**: No per-page themes for now. KISS. All pages share the site-wide theme set by the owner. Can be revisited in a later upgrade.

---

## Part D — Templates

### D1 — Current templates

The Page model has a `template` field (`String @default("full-width")`). Currently the supported templates appear to be `full-width` only (or unimplemented).

### D2 — Proposed template set

| Template | Description | Use case |
|----------|-------------|----------|
| `full-width` | Single column, full content width | Default; long-form articles |
| `sidebar-right` | Content + narrow right sidebar | Blog with widgets/links |
| `sidebar-left` | Narrow left sidebar + content | Personal profile |
| `two-column` | Equal split, two content areas | Comparison pages |
| `landing` | Centered hero + sections | Author homepage |
| `narrow` | Constrained max-width (prose-width) | Reading-optimized articles |
| `blank` | No header/footer chrome | Embed pages, landing pages |

### D3 — Template implementation

Templates are Next.js layout variants. The `PageRenderer` component (`frontend/components/pages/PageRenderer.tsx`) checks the `page.template` value and wraps the content accordingly.

No new DB schema needed — the `template` field already exists. Just add the new template components.

---

## Part E — Backstage Theme Panel

A new backstage route: `/admin/settings/appearance`

Sections:
1. **Color Palette** — palette picker (grid of swatches) + custom color picker
2. **Typography** — font pairing selector + type scale
3. **Backgrounds** — page background, header background, per-page override options
4. **Preview** — live preview iframe of the site with the selected theme applied (no save needed to see changes — preview uses query-param theme override)
5. **Save & Publish** — saves theme to DB; site immediately reflects new theme

### E1 — Live preview

The most delightful part of this feature. The theme panel should have an inline preview pane (an `<iframe>` pointing to `/?theme_preview=true&theme={json}`) where theme changes reflect in real-time without saving.

The frontend middleware reads `?theme_preview` and injects the preview theme variables instead of the DB-stored theme. The preview never affects real visitors.

### E2 — DB storage

Store the active theme as a single `SiteSettings` entry with key `theme`:
```json
{
  "palette": "midnight",
  "customAccent": null,
  "fontPairing": "modern-editorial",
  "typeScale": "default",
  "pageBackground": { "type": "solid" },
  "headerBackground": { "type": "accent" }
}
```

---

## Implementation Order

1. CSS variable injection in layout (`RootLayout` reads from `SiteSettings`, injects inline style) — this is the foundation everything else builds on
2. `SiteSettings` model + service (or fold into existing settings infrastructure from Phase 19)
3. Curated palette catalogue (hardcoded in code as CSS variable sets; no DB migration)
4. Backstage palette picker UI
5. Font pairings + Google Fonts injection
6. Background image upload for page/header
7. Per-page background override
8. Template variants (full-width, sidebar, landing, narrow)
9. Live preview iframe
10. Custom palette builder (derived from accent color)

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Dark mode | No user toggle; owner sets theme; visitors see it as-is |
| Font scope | Lock to selected pairing via standard Google Fonts CSS; browser override opt-in is a user's explicit choice, not a design concern |
| Per-page themes | Not in scope for Phase 20; deferred |
| CSS approach | CSS variables (Tailwind v4 compatible, no rebuild needed) |
