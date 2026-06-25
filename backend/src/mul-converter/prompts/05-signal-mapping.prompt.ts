// PRD source: docs/prd/13-mul-converter.md § "Background rendering model: two-tier architecture"
//             + § "SectionBackgroundPanel UI flow" + § AnimationSignals decision tree

export const SIGNAL_MAPPING_PROMPT = `[SECTION 3D — Background animation decision tree]

Use the AnimationSignals provided in the user message to select mode, movement, and exit for each
section's background. The three fields are independent axes — choose each on its own merits.

━━━ STEP 1: Choose mode (Traditional vs Animated) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set mode: "traditional" when:
  — Source page has no scroll-driven animations, parallax, or sticky effects
  — Section background is type "color" or "gradient" (these have no spatial depth; animation adds nothing)
  — Site has a simple, informational, or editorial layout with no depth cues
  — Any section using imageSize "fit-width" (Traditional only; use for growing-height sections)

Set mode: "animated" when:
  — Source page uses any scroll-linked animation library (AOS, GSAP, Locomotive, Framer Motion)
  — Source page has background-attachment:fixed or parallax effects (hasFixedBackground: true)
  — Section background is type "image" AND the page has visual depth cues (dark palette, large hero,
    photography-forward layout)
  — Section is a hero or major visual statement and the site has any animation signals at all

Default for image backgrounds: mode "animated". Default for color/gradient: mode "traditional".

━━━ STEP 2: Choose movement (Fixed vs Parallax) — Animated sections only ━━━━━━━━━━━━━━━━━

  movement: "parallax"
    → hasFixedBackground: true
    → OR motionClassNames contains "parallax" or "fixed-bg"
    → OR libraryFingerprints contains "locomotive" (Locomotive Scroll is parallax-first)
    → OR site is photography-forward with strong depth cues (dark tones, large hero photographs,
       minimal text, portfolio or nature aesthetic)
    CONSTRAINT: parallax is only meaningful with type "image". Never set parallax on color or
    gradient backgrounds — they have no spatial depth and the drift effect produces nothing.

  movement: "fixed" (default for all other cases)
    → The safe default. Background stays planted; content scrolls over it.
    → Use when motion signals are present but don't specifically indicate parallax.
    → Always correct with type "gradient" or "color" if somehow mode ends up "animated".

━━━ STEP 3: Choose exit (snap/fade/wipe/slide) — Animated sections only ━━━━━━━━━━━━━━━━━━

Apply the FIRST matching rule:

  1. libraryFingerprints contains "aos" OR "framer-motion" OR "scrollreveal"
     OR hasOpacityTransition: true (without a more specific signal below)
     → exit: "fade"
     Rationale: these libraries predominantly use opacity reveals.

  2. libraryFingerprints contains "gsap"
     AND (hasTransformTransition: true OR hasKeyframes: true)
     → exit: "slide-up"
     Rationale: GSAP sites commonly animate translateY.

  3. DOM structure shows repeated alternating image+text section pairs (img next to a content div,
     repeating across 3+ sections — the classic magazine/editorial layout)
     → alternate exit: "wipe-left" and "wipe-right" across those sections

  4. hasScrollTimeline: true (without library fingerprint)
     → exit: "fade"

  5. hasTransformTransition: true WITHOUT hasKeyframes (simple CSS transitions, not library-driven)
     → exit: "slide-up"

  6. hasHighZIndexStack: true (multiple z-index > 10 elements, suggests intentional layering)
     → exit: "none" (snap cut — the layering is architectural, not transitional)

  7. Photography-forward site (image backgrounds on multiple sections, no specific exit signal)
     → exit: "fade"

  8. No motion signals / structural or editorial layout
     → exit: "none"

━━━ Combination guidance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Common combinations and their character:
  fixed + fade       → smooth dissolve from a planted background; universally appropriate starting point
  fixed + none       → snap cut; bold, structural; works for design-confident sites
  parallax + fade    → cinematic depth; best for photography portfolios, book covers, storytelling
  parallax + none    → depth while displayed, clean snap at boundary; slightly more abrupt
  fixed + wipe-left  → editorial; pair with alternating wipe-right on adjacent sections
  fixed + slide-up   → assertive vertical motion; for explicitly scroll-storytelling sites

Combinations to avoid:
  parallax + slide-up → two competing motion vectors (drift + slide); disorienting. Only use if
                        the source site is explicitly motion-heavy with both patterns clearly present.
  parallax + wipe-*   → similarly competing vectors; prefer fade or none for parallax exit.

━━━ Overlay defaults (apply after mode/movement/exit are set) ━━━━━━━━━━━━━━━━━━━━━━━━━━━

  — Image background, mode "animated", zone has heading or paragraph text:
    → add bottom vignette overlay by default:
      gradient: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"
    → set zone.scheme: "light" on the heading zone

  — Image background, movement "parallax":
    → always add an overlay; prefer dual vignette or bottom vignette

  — overlayGradients in AnimationSignals is non-empty:
    → adopt the dominant gradient direction and alpha level as the overlay gradient

  — Gradient backgrounds:
    → only add overlay if zone text needs extra contrast beyond the gradient itself

  — Color backgrounds with zone text:
    → no overlay needed; rely on zone.scheme and palette contrast

━━━ minHeight rule ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set minHeight: "60vh" on any section where:
  — type is "image" AND mode is "animated"
  — OR movement is "parallax"
This ensures adequate dwell time before the exit animation begins, especially on portrait displays.`;
