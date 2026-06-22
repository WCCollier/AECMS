# Phase 9 — Step 4 Progress Report

**Date**: 2026-05-30
**Session**: Step 4 — Member Login + Browsing (bug fixes and features from initial testing)

---

## Issues Found and Fixed

### 4.1 — Header Login: Full-page redirect replaced with flyout

**Was**: Clicking "Login" navigated to the dedicated `/auth/login` page.
**Now**: A compact flyout dropdown opens below the Login button in the header. Email and password fields with a submit button appear inline. On success the user stays on the current page and the flyout closes. The dedicated `/auth/login` page is retained for cases where a deep link is needed (e.g., "Sign in" links in emails), and it now honours a `?from=` query param to redirect back to the originating page.

**Mobile**: Login flyout is desktop-only (md+). Mobile menu retains the Link to `/auth/login`.

**Files changed**: `frontend/components/layout/Header.tsx`, `frontend/app/auth/login/LoginPageClient.tsx`

---

### 4.2 — Return to current page after login

Covered by the flyout (user stays in place). The standalone login page also now reads `?from=` and redirects there on success instead of always going to `/`.

---

### 4.3 — Account page (was 404)

Built `/account` route with five sections:

| Section | Content |
|---------|---------|
| Profile | Display name, email (read-only), role, member-since date |
| Order History | 5 most recent orders with status badge and View link |
| Comments & Reviews | 5 most recent, with star rating if review |
| Change Password | Current + new + confirm; all sessions revoked on change; redirect to login |
| Delete Account | Password-confirmation required; owner accounts protected |

**New backend endpoints added**:
- `PATCH /auth/change-password` — requires current password; invalidates all sessions on success
- `DELETE /auth/account` — requires password; owner role protected; soft-deletes via `deleted_at`
- `GET /comments/mine` — returns paginated comments + reviews by the authenticated user

**Files changed**: `frontend/app/(site)/account/page.tsx` (new), `frontend/app/(site)/account/AccountPageClient.tsx` (new), `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/change-password.dto.ts` (new), `backend/src/auth/dto/delete-account.dto.ts` (new), `backend/src/comments/comments.controller.ts`, `backend/src/comments/comments.service.ts`

---

### 4.4 — Comment/Review UI: Proposal documented

See `docs/COMMENT_REVIEW_UI_PROPOSAL.md` for the full plan. Covers:
- `StarInput` (interactive 1–5 rating)
- `CommentForm` (post comment or review, with verified-purchase gating)
- `CommentCard` (display with ratings, verified badge, inline reply)
- `CommentList` (assembles the above, wires to article and product pages)

Backend is complete. Frontend components are not yet built — proposal is ready for review before implementation.

---

## Ancillary Fixes

### A — "nnnn" artifacts in imported articles

**Root cause**: The original Python extraction script treated MySQL `\n` escape sequences as the literal character `n` instead of a newline. This produced `n<h2>` and `nnnn<p>` in the article HTML, which browsers render as visible text before the tags.

**Fix**: Re-extracted all 7 main articles with a corrected parser (ESCAPE_MAP for `\n`, `\r`, `\t`). Updated both the 7 article records in the live DB and the hardcoded content in `backend/prisma/seed-content.ts`. The 51 short-thought articles were unaffected (their content was hardcoded as proper Python strings, not extracted from SQL).

**Verified**: `SELECT COUNT(*) FROM articles WHERE content LIKE 'n<%' OR content LIKE '%nnnn%'` → 0.

---

### B — Logged-in-only test article

Created article **"Members Only: The Case for Situational Awareness"** (`slug: members-only-situational-awareness`) with `visibility: logged_in_only`, categorised as Non-Fiction. Used to verify the visibility filter during Step 4 testing — anonymous users should not see it; logged-in members should.

---

### C — Three training products incorrectly typed as `digital`

The three online course products seeded by `seed-content.ts` were typed as `ProductType.digital` with `stock_quantity: 0`, causing them to display as "Out of Stock." These are scheduling/service products and should be `service` type.

**Fix**: Changed `product_type` to `ProductType.service`, `stock_status` to `StockStatus.available`, `stock_quantity` to `null` in both `seed-content.ts` and the live DB.

Products corrected:
- Sample Product: Safe Gun Ownership and Handling (AS-SGO-001)
- Sample Product Supplemental: Classroom and Lab (AS-CL-001)
- Sample Product Alternative: Direct to Defensive Shooting (AS-DDS-001)

---

### D — SKUs added to all 15 lesson products

All 15 products seeded by `seed_lessons.ts` previously had no SKU. SKUs assigned and persisted to both `seed_lessons.ts` and the live DB.

| Slug | SKU |
|------|-----|
| sample-product-lesson-1-marksmanship | AS-L1-MARKS |
| sample-product-lesson-2-wing-shooting | AS-L2-WING |
| sample-product-lesson-3-defensive-shooting-basics | AS-L3-DEF-B |
| sample-product-lesson-4-defensive-shooting-additional-skills | AS-L4-DEF-A |
| sample-product-supplemental-traditional-static-shooting | AS-SUPP-TSS |
| sample-product-supplemental-traditional-dynamic-shooting | AS-SUPP-TDS |
| sample-product-alternative-direct-to-defensive-shooting | AS-ALT-DDS |
| sample-product-strategies-for-personal-protection | AS-STRAT-PP |
| sample-product-community-training-seminar | AS-COMM-SEM |
| nra-basic-pistol | NRA-BP |
| nra-basic-rifle | NRA-BR |
| nra-personal-protection-inside-the-home | NRA-PPIH |
| nra-personal-protection-outside-the-home | NRA-PPOH |
| sample-product-supplemental-classroom-and-lab-online | AS-SUPP-CAL-O |
| sample-product-hourly-lessons | AS-HOURLY |

All 19 products in the catalogue now have SKUs.

---

## Test Status

- Frontend: 90/90 passing
- Backend: 152/152 passing
- No regressions introduced

---

## Step 4 Checklist Status

| Item | Status |
|------|--------|
| Login succeeds and redirects | Ready to test |
| Header reflects logged-in state | Ready to test |
| Auth context persists on page refresh | Ready to test |
| `logged_in_only` articles visible to members | Ready to test (B above enables this) |
