// PRD source: docs/prd/13-mul-converter.md § "Color palette schema"

export const PALETTE_SCHEMA_PROMPT = `[SECTION 2 — Color palette schema]
A palette contains exactly 10 named color slots:
  background        — the page background (dominant, typically darkest or lightest)
  surface           — a slightly elevated surface (cards, panels) — 10–15% lighter/darker than background
  surface-raised    — a further step up (nested cards, hover states)
  foreground        — primary text color — must contrast ≥ 4.5:1 against background
  muted             — secondary/subdued text — must contrast ≥ 3:1 against background
  border            — subtle divider lines — typically 2–3 steps from background
  accent            — the dominant brand/interactive color (button fills, links, highlights)
  accent-hover      — 10% darker than accent (for button hover states)
  accent-dim        — 20% darker than accent (for active/pressed states)
  accent-foreground — text color used ON TOP of accent — must contrast ≥ 4.5:1 against accent

All values must be valid CSS hex colors (e.g. #1a2b3c). Do not use rgb(), hsl(), or named colors.`;
