# Bug Queue

Known bugs, planned fixes, and fix history. One file per bug under `docs/bugs/`.

**Status values:** `open` → `in-dev` → `fixed` (or `deferred` / `wont-fix`)

**Severity:** `critical` (data loss / security) · `high` (broken flow) · `medium` (wrong behavior, workaround exists) · `low` (cosmetic / edge case)

---

## Open

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-001](BUG-001-2fa-session-expired-no-redirect.md) | medium | auth | Session-expired error on 2FA page doesn't redirect back to login |
| [BUG-002](BUG-002-mul-converter-palette-saved-multiple-times.md) | medium | mul-converter | Save buttons re-enable after `done`, allowing duplicate palette entries |

## Fixed (recent)

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
