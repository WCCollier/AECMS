export interface ThemeColors {
  background: string;
  surface: string;
  'surface-raised': string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  'accent-hover': string;
  'accent-dim': string;
  'accent-foreground': string;
}

export interface ThemePalette {
  id: string;
  name: string;
  scheme: string;
  colors: ThemeColors;
}

export interface FontPairing {
  id: string;
  name: string;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  headingCss: string;
  bodyCss: string;
}

export const PALETTES: ThemePalette[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    scheme: 'Monochromatic',
    colors: {
      background:        '#080d18',
      surface:           '#0f1929',
      'surface-raised':  '#162035',
      foreground:        '#dce8f0',
      muted:             '#6b88a0',
      border:            '#1a2840',
      accent:            '#2dd4bf',
      'accent-hover':    '#14b8a6',
      'accent-dim':      '#0d9488',
      'accent-foreground': '#06111f',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    scheme: 'Monochromatic',
    colors: {
      background:        '#0b0e16',
      surface:           '#141720',
      'surface-raised':  '#1c2130',
      foreground:        '#e2e6f0',
      muted:             '#6872a0',
      border:            '#1e2438',
      accent:            '#818cf8',
      'accent-hover':    '#6366f1',
      'accent-dim':      '#4338ca',
      'accent-foreground': '#080a14',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    scheme: 'Analogous',
    colors: {
      background:        '#050f0a',
      surface:           '#0a1a10',
      'surface-raised':  '#112418',
      foreground:        '#d8edd6',
      muted:             '#5a8a62',
      border:            '#152e1c',
      accent:            '#4ade80',
      'accent-hover':    '#22c55e',
      'accent-dim':      '#16a34a',
      'accent-foreground': '#030f06',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    scheme: 'Analogous',
    colors: {
      background:        '#120a04',
      surface:           '#1e120a',
      'surface-raised':  '#2a1c10',
      foreground:        '#f0ddd0',
      muted:             '#9a7060',
      border:            '#2e1e14',
      accent:            '#fb923c',
      'accent-hover':    '#f97316',
      'accent-dim':      '#ea580c',
      'accent-foreground': '#120a04',
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    scheme: 'Split complementary',
    colors: {
      background:        '#0e0814',
      surface:           '#170e20',
      'surface-raised':  '#20152c',
      foreground:        '#eadaf5',
      muted:             '#8a6aaa',
      border:            '#241830',
      accent:            '#c084fc',
      'accent-hover':    '#a855f7',
      'accent-dim':      '#9333ea',
      'accent-foreground': '#0e0814',
    },
  },
  {
    id: 'parchment',
    name: 'Parchment',
    scheme: 'Monochromatic (light)',
    colors: {
      background:        '#f9f4ef',
      surface:           '#f0e8de',
      'surface-raised':  '#e8ddd1',
      foreground:        '#2c1a0e',
      muted:             '#8a6a50',
      border:            '#d4c4b4',
      accent:            '#92400e',
      'accent-hover':    '#78350f',
      'accent-dim':      '#7c2d12',
      'accent-foreground': '#fef3c7',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    scheme: 'Triadic',
    colors: {
      background:        '#060e14',
      surface:           '#0a1820',
      'surface-raised':  '#10202c',
      foreground:        '#d0e8f4',
      muted:             '#4a7890',
      border:            '#142030',
      accent:            '#22d3ee',
      'accent-hover':    '#06b6d4',
      'accent-dim':      '#0891b2',
      'accent-foreground': '#060e14',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    scheme: 'Monochromatic',
    colors: {
      background:        '#000000',
      surface:           '#0d0d0d',
      'surface-raised':  '#1a1a1a',
      foreground:        '#f0f0f0',
      muted:             '#666666',
      border:            '#222222',
      accent:            '#ffffff',
      'accent-hover':    '#e0e0e0',
      'accent-dim':      '#c0c0c0',
      'accent-foreground': '#000000',
    },
  },
];

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'default',
    name: 'Default (Inter)',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    headingCss: "'Inter', system-ui, sans-serif",
    bodyCss: "'Inter', system-ui, sans-serif",
  },
  {
    id: 'classic-literary',
    name: 'Classic Literary',
    headingFont: 'Playfair Display',
    bodyFont: 'Lora',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
    headingCss: "'Playfair Display', Georgia, serif",
    bodyCss: "'Lora', Georgia, serif",
  },
  {
    id: 'modern-editorial',
    name: 'Modern Editorial',
    headingFont: 'DM Serif Display',
    bodyFont: 'DM Sans',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap',
    headingCss: "'DM Serif Display', Georgia, serif",
    bodyCss: "'DM Sans', system-ui, sans-serif",
  },
  {
    id: 'authorly',
    name: 'Authorly',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Source Sans 3',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap',
    headingCss: "'Cormorant Garamond', Georgia, serif",
    bodyCss: "'Source Sans 3', system-ui, sans-serif",
  },
  {
    id: 'friendly',
    name: 'Friendly',
    headingFont: 'Nunito',
    bodyFont: 'Nunito Sans',
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Nunito+Sans:wght@300;400;600&display=swap',
    headingCss: "'Nunito', system-ui, sans-serif",
    bodyCss: "'Nunito Sans', system-ui, sans-serif",
  },
];

export function getPaletteById(id: string): ThemePalette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function getFontPairingById(id: string): FontPairing {
  return FONT_PAIRINGS.find((f) => f.id === id) ?? FONT_PAIRINGS[0];
}

export function buildCssOverrides(palette: ThemePalette, fontPairing: FontPairing): string {
  const c = palette.colors;
  return `:root {
  --color-background: ${c.background};
  --color-surface: ${c.surface};
  --color-surface-raised: ${c['surface-raised']};
  --color-foreground: ${c.foreground};
  --color-muted: ${c.muted};
  --color-border: ${c.border};
  --color-accent: ${c.accent};
  --color-accent-hover: ${c['accent-hover']};
  --color-accent-dim: ${c['accent-dim']};
  --color-accent-foreground: ${c['accent-foreground']};
  /* Derived transparency tokens — resolved from the above at runtime */
  --color-accent-subtle:    color-mix(in srgb, var(--color-accent) 12%, transparent);
  --color-accent-ghost:     color-mix(in srgb, var(--color-accent)  6%, transparent);
  --color-accent-border:    color-mix(in srgb, var(--color-accent) 35%, transparent);
  --color-selection-bg:     color-mix(in srgb, var(--color-accent) 15%, transparent);
  --color-danger:           #f87171;
  --color-danger-bg:        color-mix(in srgb, #f87171 12%, transparent);
}
body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: ${fontPairing.bodyCss};
}
h1, h2, h3, h4, h5, h6 {
  font-family: ${fontPairing.headingCss};
}`;
}
