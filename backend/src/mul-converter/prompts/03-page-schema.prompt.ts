// PRD source: docs/prd/13-mul-converter.md § "Page layout system" + § "Background rendering model"

export const PAGE_SCHEMA_PROMPT = `[SECTION 3 — Page layout system]
AECMS pages are built from a vertical stack of sections. Each section is a SINGLE HORIZONTAL ROW of one or more zones tiled left-to-right. There is no wrapping within a section. To place content on a new visual row, use a new section.

Section design process — always in this order:
  1. Decide the zones: how many, and how wide each one should be relative to the others.
  2. Assign each zone a "span" integer expressing its relative width.
  3. Set "columns" to the sum of all zone spans. This is a DERIVED value — you do not choose it freely.

  columns: DERIVED — always equals sum(zone.span for all zones in this section).
           Do not pick columns first. Design your zones, then sum their spans.

  zones: ordered array of zone objects, left to right
    Each zone: { "id": "<string>", "span": <positive integer>, "scheme": "inherit"|"light"|"dark", "content": <TipTapDoc> }

  minHeight (optional): CSS string — use "100vh" for a full-viewport hero, omit for auto height
  padding (optional): "none" | "compact" | "normal" | "spacious"
  background (optional): — see Background schema below

Zone layout examples (zones → derived columns):
  [{span:1}]                           → columns:1   (single full-width zone)
  [{span:1},{span:1}]                  → columns:2   (two equal halves)
  [{span:2},{span:1}]                  → columns:3   (2/3 left + 1/3 right)
  [{span:1},{span:2},{span:1}]         → columns:4   (narrow + wide + narrow)
  [{span:3},{span:1},{span:1},{span:1}]→ columns:6   (wide feature + 3 equal cards)
  [{span:1},{span:1},{span:1},{span:1}]→ columns:4   (four equal quarters)
  [{span:5},{span:3},{span:4}]         → columns:12  (fine-grained asymmetric split)

WRONG — do not do this:
  columns:4 with zones [{span:4},{span:1},{span:1},{span:1},{span:1}]  ← sum is 8, not 4. INVALID.
  If you want a full-width zone above four equal zones, use TWO sections:
    Section A: [{span:1}]                                  → columns:1  (full-width row)
    Section B: [{span:1},{span:1},{span:1},{span:1}]       → columns:4  (four-quarter row)

[SECTION 3A — Background schema]
The background field has a TWO-TIER rendering architecture. The top-level field is "mode":

  mode: "traditional" | "animated"

  "traditional" — background is rendered as an inline CSS property directly on the section div and
    scrolls naturally with content. No fixed-position stack is engaged. Broadest browser compatibility.
    Use for simple/editorial sites, color/gradient backgrounds, or image backgrounds that should
    scroll with the section rather than remaining fixed.

    Sub-option (only when mode="traditional" and type="image"):
      imageSize: "cover" | "fit-width"
        "cover"     (default) — scales to fill the section; crops if needed. Best for most cases.
        "fit-width" — 100% width at natural height; no cropping. Use for sections that grow
                      dynamically (e.g. article lists), where "cover" would rescale as height grows.

  "animated" — background is rendered as a position:fixed layer in a stacked slide system.
    Only animated sections participate in this stack. The section itself becomes a transparent
    scroll spacer; the fixed layer provides the visual. TWO independent sub-axes apply:

    movement: "fixed" | "parallax"
      How the slide behaves WHILE IT OCCUPIES THE VIEWPORT:
        "fixed"    (default) — background stays planted; content scrolls over it (window-pane effect).
        "parallax" — image drifts upward at ~50% scroll speed; creates a depth illusion.
                     ONLY meaningful with type:"image" — do not use with color or gradient backgrounds.

    exit: "none" | "fade" | "wipe-v" | "wipe-left" | "wipe-right" | "slide-up"
      How the slide gives way WHEN THE SECTION BOUNDARY CROSSES THE VIEWPORT:
        "none"       — snap cut; layer hides immediately once section exits. Clean, abrupt.
        "fade"       — composite dissolves out, revealing the next slide beneath. Most versatile.
        "wipe-v"     — vertical clip-path wipe upward.
        "wipe-left"  — clip wipe from the right edge.
        "wipe-right" — clip wipe from the left edge.
        "slide-up"   — composite translates upward off screen.

    movement and exit are FULLY INDEPENDENT — any combination is valid:
      fixed + fade       → planted background that dissolves (most common animated combo)
      parallax + fade    → drifting image that dissolves; cinematic, photography-forward
      parallax + none    → depth while displayed, snap cut at boundary; clean handoff
      fixed + wipe-left  → planted background that clips away; editorial/magazine
      parallax + slide-up → two competing motion vectors; use only for explicitly motion-heavy sites

  CONSTRAINTS:
    — When mode="traditional": omit movement and exit entirely (they have no effect).
    — When mode="animated": always set both movement and exit explicitly. Default: fixed + none.
    — movement:"parallax" requires type:"image". Never emit parallax with color or gradient backgrounds.
    — imageSize only applies when mode="traditional" and type:"image".

  type: "none" | "color" | "gradient" | "image"
  value: hex color string (type "color"), e.g. "#1a2b3c"
         or CSS gradient string (type "gradient"), e.g. "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)"
         or "media://placeholder" (type "image") — owner will replace with a real upload

  overlay (optional):
    solid form:    { "color": hex, "opacity": 0–1 }
    gradient form: { "color": "#000000", "opacity": 1, "gradient": "<CSS gradient with rgba stops>" }
    Use gradient overlays for dramatic directional vignettes. Omit "gradient" for a flat scrim.
    Gradient examples:
      bottom vignette: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"
      top vignette:    "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 60%)"
      dual vignette:   "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.5) 100%)"

[SECTION 3B — TipTap document schema]
Each TipTap document: { "type": "doc", "content": [...nodes] }

Available TipTap node types for scaffold content:

  Headings:
  { "type": "heading", "attrs": { "level": 1|2|3, "textAlign": "left"|"center"|"right" }, "content": [{ "type": "text", "text": "..." }] }

  Paragraphs:
  { "type": "paragraph", "attrs": { "textAlign": "left"|"center"|"right"|"justify", "dropCap": true|false }, "content": [{ "type": "text", "text": "...", "marks": [...] }] }

  Lists:
  { "type": "bulletList", "content": [{ "type": "listItem", "content": [...] }] }

  Horizontal rule:
  { "type": "horizontalRule" }

Available text marks:
  Bold:    { "type": "bold" }
  Italic:  { "type": "italic" }
  Label style (uppercase, wide-tracked):
           { "type": "textStyle", "attrs": { "textTransform": "uppercase", "letterSpacing": "wide" } }

CRITICAL: Do NOT produce empty text nodes ({ "type": "text", "text": "" }). Every text node must have non-empty text.`;
