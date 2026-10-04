# Bug Queue

Known bugs, planned fixes, and fix history. One file per bug under `docs/bugs/`.

**Status values:** `open` → `in-dev` → `fixed` (or `deferred` / `wont-fix`)

**Severity:** `critical` (data loss / security) · `high` (broken flow) · `medium` (wrong behavior, workaround exists) · `low` (cosmetic / edge case)

---

## Open

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-017](BUG-017-cart-line-item-thumbnail-broken.md) | medium | frontend, cart, media | Cart page line-item thumbnail image broken on live site (possibly related to `image` 400) |

## In Dev

_None_

## Fixed

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| [BUG-016](BUG-016-email-case-sensitivity.md) | high | auth, backend | Email case-sensitive at all auth entry points — `.toLowerCase()` added to register, login, adminLogin, resendVerification, forgotPassword, Resend webhook |
| [BUG-015](BUG-015-verify-email-link-404.md) | critical | auth, email | Verify-email link in registration email returns 404 — URL was `/verify-email` instead of `/auth/verify-email`; approval email also linked to `/login` instead of `/auth/login` |
| [BUG-014](BUG-014-favicon-not-applied-from-settings.md) | medium | frontend, settings | Favicon set in Site Identity has no effect — `app/favicon.ico` auto-injection overrides dynamic icon; fixed by moving to `public/` + `generateMetadata()` with mime type |
| [BUG-012](BUG-012-domain-alias-routing-never-activates.md) | high | domain-aliases, middleware, frontend | Secondary domain routing not working — unauthenticated `/domain-routing` endpoint, `verified_at` UI fix, route shadowing fix; confirmed working in production |
| [BUG-013](BUG-013-assign-modal-select-all-wrong-scope.md) | medium | backstage, tags, FR-016 | Assign modal Select All scoped to wrong set when filter active; filter not live on keystroke |
| [BUG-011](BUG-011-totp-secret-wiped-by-fr010-deploy2.md) | critical | auth, FR-010, deployment | TOTP secret wiped by Deploy 2; owner ran SQL remediation + re-setup 2FA |
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
