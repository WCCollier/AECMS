# Bug Queue

Known bugs, planned fixes, and fix history. One file per bug under `docs/bugs/`.

**Status values:** `open` → `in-dev` → `fixed` (or `deferred` / `wont-fix`)

**Severity:** `critical` (data loss / security) · `high` (broken flow) · `medium` (wrong behavior, workaround exists) · `low` (cosmetic / edge case)

---

## Open

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-007](BUG-007-tag-assign-modal-always-empty.md) | high | backstage, tags | Tag Assign modal shows "All already tagged" for every tag — `limit=1000` exceeds `@Max(100)` DTO constraint, silent `.catch` hides the 400, `articles=[]` and `products=[]` for every call |
| [BUG-009](BUG-009-preview-full-missing-scroll-mode-toggle.md) | medium | frontend, editor, widgets | Collection Embed config: Scroll mode toggle hidden for Preview/Full modes — `!isInlineDisplay` guard too broad; page-size selector visible but scroll-mode toggle is not, so infinite scroll cannot be disabled for inline display types |
| [BUG-008](BUG-008-preview-pane-scrim-button-alignment.md) | medium | frontend, widgets | Collection Embed preview pane: (1) no scrim — wrong CSS var `--background` vs `--color-background`; (2) button text invisible — `.prose-article a` overrides `text-white`; (3) text left-aligned while button floats center — `prose-article max-width: 68ch` not centered, button independently centered |
| [BUG-006](BUG-006-gallery-field-broken-thumbnails-and-tiptap-image-no-library.md) | critical/medium | media, frontend, editor | (A) No `images.remotePatterns` in next.config.mjs — Next.js `<Image>` silently blocks all cloud storage URLs; breaks article/product cards, detail carousels, embed widgets, and admin gallery thumbnails site-wide. (B) TipTap image insert has no media library browser. |
| [BUG-001](BUG-001-2fa-session-expired-no-redirect.md) | medium | auth | Session-expired error on 2FA page doesn't redirect back to login |
| [BUG-002](BUG-002-mul-converter-palette-saved-multiple-times.md) | medium | mul-converter | Save buttons re-enable after `done`, allowing duplicate palette entries |

## In Dev

_None_

## Fixed

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-005](BUG-005-no-tag-editor-on-article-product-forms.md) | high | backstage, articles, products | No tag editor on article or product forms — `TagField` component missing; backend always supported it |
| [BUG-004](BUG-004-zone-vertical-alignment-icons-and-no-effect.md) | medium | page-editor, sections | Zone vertical alignment: wrong icons (horizontal variants used) and no visual effect (alignSelf on auto-height grid row) |
| [BUG-003](BUG-003-media-uploads-broken-on-cloud-storage.md) | high | media, storage | Uploaded images and thumbnails broken on live site — all URL construction now delegates to `storageProvider.getUrl()` |

## Deferred / Won't Fix

_None_
