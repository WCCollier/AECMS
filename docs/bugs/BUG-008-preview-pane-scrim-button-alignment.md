# BUG-008: Collection Embed Preview Pane — missing scrim, invisible button text, content/button misalignment

**Status:** `fixed`
**Severity:** `medium`
**Area:** frontend, widgets, FR-015

---

## Symptoms (confirmed via screenshots 2026-06-27 065115 and 065126)

1. **No fade-to-background scrim at the bottom** — the article text clips hard at the bottom edge of the 100dvh pane. No gradient is visible.
2. **Button text invisible until hover** — the "Continue reading →" button has a solid teal background, but the text inside is also teal, making it unreadable. On hover the background darkens slightly but the text remains hard to see.
3. **Content left-aligned while button floats center** — on wide screens, the article text occupies the left portion of the pane while the "Continue reading" button floats to the horizontal center. The two elements do not share a common horizontal axis.

---

## Root Causes

### 1. Wrong CSS variable name for the scrim gradient

`ArticlePreviewPane` and `ProductPreviewPane` use:
```tsx
background: 'linear-gradient(to bottom, transparent, var(--background))'
```

The actual variable name in `frontend/app/globals.css` is `--color-background` (line 23), not `--background`. CSS silently treats an undefined variable as the initial value for `background`, which is transparent. The gradient resolves to `transparent → transparent` and is invisible.

### 2. `.prose-article a` color rule overrides Tailwind `text-white`

`globals.css` line 111:
```css
.prose-article a { color: var(--color-accent); text-decoration: underline; }
```

`SearchResultsWidget` is rendered inside a TipTap `NodeViewWrapper` which lives inside the `.ProseMirror` div that carries the `prose-article` class. Every `<a>` tag — including the `<Link>` in the button — inherits this rule. Tailwind's `text-white` class loses the specificity battle (both are single-class selectors; the stylesheet rule wins because it appears later in the cascade). The result: teal text on a teal background.

### 3. `prose-article` max-width without centering + absolute button at full-container center

`globals.css` lines 96–101:
```css
.prose-article {
  max-width: 68ch;   /* ≈ 578px at 1.05rem */
  /* no margin: 0 auto */
}
```

The prose content starts at the left edge of the padded inner div and extends 68ch to the right. No horizontal centering. Meanwhile the button sits in an absolutely-positioned div with `left-0 right-0 flex justify-center`, which centers it across the FULL outer container width. On a ~1024px-wide viewport, the text occupies the left ~578px while the button is centered at ~512px — they are offset.

---

## Fix Applied

**File:** `frontend/components/widgets/SearchResultsEmbed/ArticlePreviewPane.tsx`
**File:** `frontend/components/widgets/SearchResultsEmbed/ProductPreviewPane.tsx`

### Layout restructure (fixes all three issues)

Replaced the independently-positioned content div and absolutely-positioned button with a **flex column** inside a `max-w-3xl mx-auto` centering container. The button sits at the bottom of the same column as the text, so they share horizontal alignment by construction. The full-width fade overlay stays absolutely positioned on the outer element.

Key changes per component:
- Outer wrapper: `relative overflow-hidden`, `height: 100dvh`
- Inner centering column: `flex flex-col h-full overflow-hidden max-w-3xl mx-auto px-6 md:px-10`
- Content area: `flex-1 overflow-hidden pt-8`
- `RichTextContent` gets `className="prose-article max-w-none"` — prose typography retained but the outer column's `max-w-3xl` provides the width constraint, so the `68ch` max-width from the class would fight and lose gracefully
- Button: lives in `py-6 flex justify-center` at the bottom of the flex column; **`style={{ color: 'white', textDecoration: 'none' }}`** overrides the `.prose-article a` rule via inline specificity
- Scrim: `var(--color-background)` (corrected variable name); spans `inset-x-0` across the full outer container

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | fixed | All three causes identified and corrected in ArticlePreviewPane + ProductPreviewPane |
