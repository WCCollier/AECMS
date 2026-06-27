# Feature Requests

Small, self-contained features that don't constitute major phase-level work. One file per FR under `docs/feature-requests/`.

**Status values:** `draft` → `accepted` → `in-planning` → `in-dev` → `in-testing` → `deployed` (or `deferred` / `rejected`)

**Size:** `small` (hours) · `medium` (1–2 days) · `large` (3–5 days)

---

## Active / Planned

| ID | Size | Status | Description |
|----|------|--------|-------------|
| [FR-010](FR-010-pii-encryption.md) | medium | accepted | PII Encryption at Rest — `EncryptionService`, encrypted `UserAddress`, backfill for existing plaintext PII; paired with Phase 24 |
| [FR-011](FR-011-resend-broadcast-integration.md) | medium | accepted | Resend Broadcast Integration — article/product/admin broadcasts via Resend Broadcast API + Topics; SMTP loop fallback when unset |

## Deployed

| ID | Size | Description |
|----|------|-------------|
| [FR-009](FR-009-syndication.md) | large | Member Subscriptions & Syndication — opt-in email notifications, admin broadcast, RSS feed, unsubscribe page |
| [FR-008](FR-008-free-products.md) | small | Free Product Checkout — bypass payment for $0 orders; service products require shipping address |
| [FR-007](FR-007-order-confirmation-emails.md) | small | Order Confirmation Emails — fire-and-forget on Stripe webhook + PayPal capture |
| [FR-006](FR-006-forgot-password.md) | small | Forgot Password / Password Reset — enumeration-safe; `/auth/forgot-password` + `/auth/reset-password` |
| [FR-005](FR-005-turnstile-captcha.md) | small | Cloudflare Turnstile CAPTCHA — configurable via ISM (Settings → General) |
| [FR-004](FR-004-registration-controls.md) | small | Registration Controls — default role, approval gate, `/admin/registrations` |
| [FR-003](FR-003-role-manager.md) | medium | Role Manager — `roles` table, `role_name: string`, `UserRole` enum fully removed |
| [FR-002](FR-002-owner-capability-sync.md) | small | Owner Capability Sync — Owner capability set synced on login |
| [FR-001](FR-001-tag-search-and-collection-embed.md) | medium | Tag-filtered search, `UnifiedSearchInput`, category schema drop, `SearchResultsEmbed` |

## Deferred / Rejected

_None_
