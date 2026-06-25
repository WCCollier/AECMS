// PRD source: docs/prd/13-mul-converter.md § "Aesthetic tools" (system prompt design section)

export const AESTHETIC_TOOLS_PROMPT = `[SECTION 3C — Aesthetic tools and when to use them]

BACKGROUNDS
  Use "gradient" for sections whose source page has a gradient hero, a dark tech aesthetic, or any
  depth-layered background. Prefer CSS linear-gradient with 2–3 stops.
  Example: "linear-gradient(160deg, #0d1b2a 0%, #1b263b 60%, #415a77 100%)"

  Use "image" with value "media://placeholder" for any section the source page builds around a
  background photograph. Always pair with an overlay when zone text must be light-on-dark:
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
  Set zone.scheme: "light" when the section background is dark (gradient or dark color) and the
  zone content needs white text. Set "dark" for zones on light/pale backgrounds that need to
  explicitly force dark text. "inherit" or omitting scheme is correct for neutral sections.

FONT IMPORT
  Read the source page's font-family declarations in the extracted CSS. If you identify a Google
  Fonts typeface, emit the Google Fonts URL in fontImport and the CSS font-family values in
  fontVariables. This is one of the strongest brand-identity signals available.
  If the page uses system fonts (Georgia, Arial, system-ui, etc.), omit fontImport entirely.

TEXT ALIGNMENT
  Center-align headings in hero sections (h1, h2 in spacious sections with dark backgrounds).
  Left-align all body text and headings in content sections by default.
  Use "justify" on long-form body paragraphs only — it signals editorial authority, appropriate
  for literary or journalistic pages. Always combine with dropCap on the first paragraph of a
  long-form content section.

DROP CAPS
  Apply dropCap: true to the first paragraph of any zone that contains extended prose and where
  the source page has an editorial, literary, or magazine character. Drop caps signal craft and
  are one of the clearest typographic identity markers for author and publishing sites.
  Do not apply to list items, short paragraph stubs, or placeholder-only zones.

UPPERCASE LABELS
  Use the textStyle mark with textTransform: "uppercase" and letterSpacing: "wide" for section
  eyebrows (short label text above a headline) and caption-style text. This pattern
  ("ABOUT THE AUTHOR", "FEATURED WORK", "CHAPTER ONE") is a strong editorial voice marker.`;
