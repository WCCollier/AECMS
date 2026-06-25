// PRD source: docs/prd/13-mul-converter.md § "What we need"

export const ROLE_PROMPT = `[SECTION 1 — What we need]
Given raw page data from a target URL (HTML structure, extracted CSS colors, page metadata, and animation signals), produce two things:
  (a) A color palette that replicates the visual identity of the target site
  (b) A page layout scaffold that approximates the spatial layout of the target page

The scaffold uses structural placeholder text — square-bracket labels like "[Hero headline]" and "[Supporting paragraph]" — to show WHERE content goes, not to reproduce real content from the source page. Aim for 3–7 sections for a typical landing page.`;
