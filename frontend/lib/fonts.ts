/** Curated font library entry */
export interface FontEntry {
  id: string;
  name: string;           // display name e.g. "Playfair / Source Serif"
  importUrl: string;      // Google Fonts <link> href (or empty for system fonts)
  headingFamily: string;  // CSS font-family value for --font-heading
  bodyFamily: string;     // CSS font-family value for --font-body
  category: 'editorial' | 'modern' | 'literary' | 'humanist' | 'system';
  isSystem?: boolean;     // true for the "no import" system default entry
}

/** Built-in curated pairs shipped with AECMS. */
export const CURATED_FONTS: FontEntry[] = [
  {
    id: 'system',
    name: 'System (default)',
    importUrl: '',
    headingFamily: 'Georgia, serif',
    bodyFamily: 'system-ui, sans-serif',
    category: 'system',
    isSystem: true,
  },
  {
    id: 'playfair-source',
    name: 'Playfair / Source Serif',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap',
    headingFamily: "'Playfair Display', Georgia, serif",
    bodyFamily: "'Source Serif 4', Georgia, serif",
    category: 'editorial',
  },
  {
    id: 'merriweather-inter',
    name: 'Merriweather / Inter',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap',
    headingFamily: "'Merriweather', Georgia, serif",
    bodyFamily: "'Inter', system-ui, sans-serif",
    category: 'modern',
  },
  {
    id: 'dm-serif-dm-sans',
    name: 'DM Serif / DM Sans',
    importUrl:
      'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&display=swap',
    headingFamily: "'DM Serif Display', Georgia, serif",
    bodyFamily: "'DM Sans', system-ui, sans-serif",
    category: 'modern',
  },
  {
    id: 'cormorant-jost',
    name: 'Cormorant / Jost',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&display=swap',
    headingFamily: "'Cormorant Garamond', Georgia, serif",
    bodyFamily: "'Jost', system-ui, sans-serif",
    category: 'literary',
  },
  {
    id: 'lora-raleway',
    name: 'Lora / Raleway',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Raleway:wght@400;500;600&display=swap',
    headingFamily: "'Lora', Georgia, serif",
    bodyFamily: "'Raleway', system-ui, sans-serif",
    category: 'humanist',
  },
  {
    id: 'crimson-work-sans',
    name: 'Crimson Pro / Work Sans',
    importUrl:
      'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Work+Sans:wght@400;500;600&display=swap',
    headingFamily: "'Crimson Pro', Georgia, serif",
    bodyFamily: "'Work Sans', system-ui, sans-serif",
    category: 'editorial',
  },
];

export function getFontById(id: string, customFonts: FontEntry[] = []): FontEntry | undefined {
  return [...CURATED_FONTS, ...customFonts].find((f) => f.id === id);
}
