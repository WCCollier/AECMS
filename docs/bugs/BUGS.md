# Bug Queue

Known bugs, planned fixes, and fix history. One file per bug under `docs/bugs/`.

**Status values:** `open` → `in-dev` → `fixed` (or `deferred` / `wont-fix`)

**Severity:** `critical` (data loss / security) · `high` (broken flow) · `medium` (wrong behavior, workaround exists) · `low` (cosmetic / edge case)

---

## Open

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-011](BUG-011-totp-secret-wiped-by-fr010-deploy2.md) | critical | auth, FR-010, deployment | TOTP secret wiped by Deploy 2 (plaintext col dropped before backfill); owner locked out of backstage — SQL remediation + 2FA re-setup required |

## In Dev

_None_

## Fixed

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-012](BUG-012-domain-alias-routing-never-activates.md) | high | domain-aliases, middleware | Secondary domain routing never fired — backend `/domain-aliases/active` required auth the middleware couldn't provide; fixed with unauthenticated `/domain-aliases/routing` endpoint |
| [BUG-010](BUG-010-no-profile-edit-on-account-page.md) | high | frontend, auth, account | No profile edit on account page — `PATCH /auth/profile` + Edit Profile section added |
| [BUG-007](BUG-007-tag-assign-modal-always-empty.md) | high | backstage, tags | Tag Assign modal showed "All already tagged" — `limit=1000` exceeded `@Max(100)`, silent catch hid the 400 |
| [BUG-002](BUG-002-mul-converter-palette-saved-multiple-times.md) | medium | mul-converter | Save buttons re-enabled after `done`, allowing duplicate palette entries |
| [BUG-001](BUG-001-2fa-session-expired-no-redirect.md) | medium | auth | Session-expired error on 2FA page didn't redirect back to login |
| [BUG-009](BUG-009-preview-full-missing-scroll-mode-toggle.md) | medium | frontend, editor, widgets | Collection Embed config: Scroll mode toggle hidden for Preview/Full modes — `!isInlineDisplay` guard too broad |
| [BUG-008](BUG-008-preview-pane-scrim-button-alignment.md) | medium | frontend, widgets | Collection Embed preview pane: missing scrim, invisible button text, content/button misalignment |
| [BUG-006](BUG-006-gallery-field-broken-thumbnails-and-tiptap-image-no-library.md) | critical/medium | media, frontend, editor | No `images.remotePatterns` in next.config.mjs + TipTap image insert lacked media library browser |
| [BUG-005](BUG-005-no-tag-editor-on-article-product-forms.md) | high | backstage, articles, products | No tag editor on article or product forms — `TagField` component missing |
| [BUG-004](BUG-004-zone-vertical-alignment-icons-and-no-effect.md) | medium | page-editor, sections | Zone vertical alignment: wrong icons and no visual effect |
| [BUG-003](BUG-003-media-uploads-broken-on-cloud-storage.md) | high | media, storage | Uploaded images and thumbnails broken on live site |

## Deferred / Won't Fix

_None_
