# AECMS Project - Claude Code Context

## Project Overview

**AECMS** (Advanced Ecommerce Content Management System) is a lightweight, host-agnostic CMS with integrated ecommerce capabilities, designed as a modern alternative to WordPress.

**Key Goals**: Personal CMS with ecommerce for low-traffic sites, free-tier hosting optimized, host-agnostic (Docker), WordPress migration capability, no vendor lock-in.

## Technology Stack

- **Backend**: NestJS + PostgreSQL 15 + Prisma + Redis + TypeScript
- **Frontend**: Next.js 14+ + Tailwind CSS + Radix UI + TipTap
- **Payments**: Stripe (primary - cards, Apple Pay, Google Pay, Amazon Pay via Checkout), PayPal (secondary)
- **Auth**: JWT + OAuth (Google, Apple) + 2FA for admin
- **Deployment**: Docker Compose (portable)

## ⚠️ Live Deployment Policy

**As of 2026-06-21, AECMS has at least one live deployment in the wild.**

Every merge to the `deploy` branch must be:
- **Live-patchable** — the running instance must continue to function correctly immediately after deploy, without requiring manual intervention, data fixes, or downtime.
- **Backward compatible** — database migrations must be additive only (new columns/tables with defaults or nullable); no column renames, drops, or constraint changes that break the currently-deployed code before it is replaced.

Specific rules:
- Never rename or remove a DB column in the same migration that changes code that reads it. Split into two deploys: (1) add new column + write to both, (2) remove old column after code no longer reads it.
- Never add a NOT NULL column without a default or a preceding backfill migration.
- Never change an enum by removing a value that live data may contain.
- ISM keys and environment variable names must be treated as a stable API — rename only with a transition period.
- If a migration cannot be made backward compatible, it requires a coordinated maintenance window and must be called out explicitly before merging to `deploy`.

## Current Project Status

**Phases 0–22**: ✅ ALL COMPLETE — foundation, auth/RBAC, content management (articles, pages, media), ecommerce (products, cart, orders), payments (Stripe + PayPal), frontend (Next.js, Tailwind, Radix, TipTap), digital products + Kindle, domain aliasing + email verification, widget system (inline TipTap nodes: MediaCarousel, Callout, VideoEmbed, XEmbed, SearchResultsEmbed, RssEmbed), page builder (sections/zones, dual-size widgets), audit trail + version history, admin settings + ISM, nav menus, alternate domain capture, RSS widget, themes (8 palettes, 5 font pairings), Cloud Run deployment, Node 22 + Next.js 15 upgrades, media library + bulk upload, CSV export, role manager (UserRole enum removed).

**Phase 23**: ✅ DEPLOYED — Mul Converter + Section Background System. All 3 parts built: (1) section-based page schema, SectionEditor, SectionsLayout renderer; (2) MulConverterModule (3 endpoints), AI providers (Anthropic/OpenAI/xAI text + GPT-Image-1/FLUX/Stability image), /admin/mul-converter UI; (3) true crossfade renderer, full transition vocabulary (none/fixed/fade/wipe-*/slide-up/parallax), gradient overlays, SectionBackgroundPanel. PRD: `docs/prd/13-mul-converter.md` v1.7. Plan: `docs/phases/PHASE_23_PLAN.md`

**FR-001**: ✅ LIVE — Tag-filtered search, UnifiedSearchInput, category schema drop, SearchResultsEmbed. Docs: `docs/feature-requests/FR-001-tag-search-and-collection-embed.md`
**FR-002**: ✅ LIVE — Owner capability sync on login. Docs: `docs/feature-requests/FR-002-owner-capability-sync.md`
**FR-003**: ✅ LIVE — Role Manager: `roles` table, `role_name: string`, `UserRole` enum fully removed. Docs: `docs/feature-requests/FR-003-role-manager.md`
**FR-004**: ✅ LIVE — Registration Controls: default role, approval gate, /admin/registrations. Docs: `docs/feature-requests/FR-004-registration-controls.md`
**FR-005**: ✅ LIVE — Cloudflare Turnstile CAPTCHA via ISM (Settings → General). Docs: `docs/feature-requests/FR-005-turnstile-captcha.md`
**FR-006**: ✅ DEPLOYED — Forgot Password / Password Reset (`/auth/forgot-password`, `/auth/reset-password`). Enumeration-safe. Docs: `docs/feature-requests/FR-006-forgot-password.md`
**FR-007**: ✅ DEPLOYED — Order Confirmation Emails (`OrderEmailService`, fire-and-forget on Stripe webhook + PayPal capture, adapts by product type). Docs: `docs/feature-requests/FR-007-order-confirmation-emails.md`
**FR-008**: ✅ DEPLOYED — Free Product Checkout: bypass payment for $0 orders, service products now require shipping address, free digital requires login. Docs: `docs/feature-requests/FR-008-free-products.md`
**FR-009**: ✅ DEPLOYED — Member Subscriptions & Syndication: opt-in email notifications for articles/products/news, admin broadcast tool, RSS feed at `/feed.xml`, account Notifications tab, unsubscribe page, default subscription ISM settings. Docs: `docs/feature-requests/FR-009-syndication.md`
**FR-010**: 📋 ACCEPTED — PII Encryption at Rest: `EncryptionService` (shared AES-256-GCM wrapper), `UserAddress` encrypted from day one, backfill for existing plaintext PII (`totp_secret`, OAuth tokens, order shipping fields, user names, IP hashing). Paired with Phase 24. Docs: `docs/feature-requests/FR-010-pii-encryption.md`
**FR-011**: 📋 ACCEPTED — Resend Broadcast Integration: article/product/admin notifications routed to Resend Broadcast API + Topics when `email.broadcast_provider = 'resend'`; SMTP loop fallback when unset; bidirectional contact/topic sync; webhook for inbound unsubscribes. Docs: `docs/feature-requests/FR-011-resend-broadcast-integration.md`

**Phase 24A**: 📋 PLANNED — Sales tax. Trigger: revenue >$1k or TX Comptroller registration. Plan: `docs/phases/PHASE_24_PLAN.md`
**Phase 24B**: 📋 PLANNED — Shipping. Trigger: first physical product sale. Plan: `docs/phases/PHASE_24_PLAN.md`
**Phase 25**: ✅ DEPLOYED — Cloud SQL → Neon migration. Database now on Neon free tier; Cloud SQL deleted. Plan: `docs/phases/PHASE_25_PLAN.md`
**Phase 26**: ✅ DEPLOYED — SEO toolkit: generateMetadata on all site routes, JSON-LD (Book/Article/Person/WebSite/BreadcrumbList), /sitemap.xml, /robots.txt, SEO settings tab, per-content SEO panels + snippet preview, book fields (ISBN/format/page count/publisher/Amazon+Goodreads URLs), Owner's Manual ch08. PRD: `docs/prd/15-seo-toolkit.md`. Plan: `docs/phases/PHASE_26_PLAN.md`
**Phase 27**: 📋 PLANNED — Design Library: manual palettes, page templates, export/import. PRD: `docs/prd/16-design-library.md`. Plan: `docs/phases/PHASE_27_PLAN.md`
**Phase 28**: 📋 PLANNED — Multi-layer section backgrounds. Plan: `docs/phases/PHASE_28_PLAN.md`
**Phase 31**: 💡 CONCEPT — Native mobile app. PRD: `docs/prd/14-mobile-app.md`

**Test Status**: 125 frontend + 190 backend unit tests (all passing); 16 backend E2E tests (require Docker)
**API Modules**: Auth, Capabilities, Media, Tags, Articles, Pages, Products, Cart, Orders, Payments, Comments, Digital Products, Kindle, Domain Aliases, Roles (Categories module removed in FR-001)

## Key Architecture Decisions

- **User Roles**: Owner > Admin > Member > Guest — stored in the `roles` table (string PK); these are live DB rows, not a hardcoded enum. Canonical roles are protection-flagged: Owner=full (immutable), Guest=constrained (customer caps only, not deletable), Admin/Member=none (freely editable/deletable). Custom roles can be created through the Role Manager.
- **Session Model**: Two fully independent sessions per user — see below
- **Visibility**: public, logged_in_only, admin_only
- **Granular Permissions**: Per-content author_can_edit/delete, admin_can_edit/delete flags
- **Products**: Separate from Articles, dual-nature (content + commerce fields)

## Session Architecture: Customer-Facing vs Backstage

**Terminology**: Never say "front-end / back-end" for the two experiences — those terms already mean client-side / server-side in this codebase. Use **customer-facing** and **backstage**.

### Customer-Facing Session
- Entry: `POST /auth/login` — no 2FA, persistent refresh token
- Token storage: `localStorage.access_token` + `localStorage.refresh_token`
- API client: `frontend/lib/api.ts` (default `api` instance)
- `session_type: 'customer'` embedded in JWT payload

### Backstage Session
- Entry: `POST /auth/admin/login` → TOTP 2FA → full tokens
- Token storage: `localStorage.admin_access_token` + `localStorage.admin_refresh_token`
- API client: `frontend/lib/adminApi.ts` (`adminApi` instance — always use this in `app/admin/`)
- `session_type: 'backstage'` embedded in JWT payload
- 7-day refresh token; killed across machines on new backstage login; 30-min inactivity auto-logout
- User info for the sidebar stored in `sessionStorage.admin_user` by the login flow

The two sessions are fully independent and can be active simultaneously.

### Backstage Access Control
Backstage access is **capability-scoped, not role-hardcoded**:
- A user gains backstage access if `user.role === 'owner'` OR they hold ≥1 capability with `scope = 'backstage'`
- `BackstageGuard` enforces `session_type === 'backstage'` on every admin API endpoint
- The default Admin role ships with 21 backstage-scoped + 9 customer-scoped capabilities; Member ships with 9 customer-scoped ones; Guest ships with 4 customer-scoped ones

### Capability Scopes
| Scope | Meaning | Guard chain on API endpoint |
|-------|---------|----------------------------|
| `'backstage'` | Requires admin dashboard | `JwtAuthGuard → BackstageGuard → CapabilityGuard` |
| `'customer'` | Available in customer-facing experience | `JwtAuthGuard → CapabilityGuard` (no BackstageGuard) |

Current counts: **40 backstage** + **12 customer** = **52 total capabilities** (role.manage FR-003; registration.configure + registration.approve FR-004; account.delete.limited + account.delete.any added for admin delete panel).

**Backstage additions (post-Phase 15):** `system.appearance` (Owner-only; gates `PATCH /settings/appearance`), `digital.deliver` (Admin+Owner; gates token extend/regenerate/admin-grant).

**`system.configure` replaced by four granular atoms (all Owner-only):**

| Capability | Gates |
|---|---|
| `system.configure.general` | `PATCH /settings/general` (general.* + identity.* keys), `POST /settings/favicon` |
| `system.configure.email` | `PATCH /settings/email` (email.* keys), `POST /settings/test-email` |
| `system.configure.payments` | `PATCH /settings/payments` (payment.* keys), `POST /payments/verify/stripe`, `POST /payments/verify/paypal` |
| `system.configure.storage` | `PATCH /settings/storage` (storage.* keys), `POST /settings/test-storage` |

`GET /settings` requires any one of the four. Each PATCH endpoint also filters the request body to its key namespace (server-side), so cross-domain writes are impossible even if the frontend sends extra keys. `system.appearance` remains a separate atom so it can be delegated to Admins independently.

**Customer capabilities** (all scope: `'customer'`):

| Capability | Guest | Member | Admin | Description |
|-----------|:-----:|:------:|:-----:|-------------|
| `comment.article` | ❌ | ✅ | ✅ | Post article comment |
| `review.article` | ❌ | ✅ | ✅ | Post article review |
| `comment.product` | ❌ | ✅ | ✅ | Post product comment |
| `review.product` | ❌ | ✅ | ✅ | Post product review |
| `comment.edit.own` | ❌ | ✅ | ✅ | Edit own comments |
| `comment.delete.own` | ❌ | ✅ | ✅ | Delete own comments |
| `checkout.guest` | ✅ | ✅ | ✅ | Checkout without account |
| `purchase.physical` | ✅ | ✅ | ✅ | Buy physical products |
| `purchase.digital` | ✅ | ✅ | ✅ | Buy digital products |
| `purchase.service` | ✅ | ✅ | ✅ | Buy service products |

Guest capabilities are enforced via the virtual `guest` role in `RoleCapability`. `CapabilityGuard` routes null-user requests to `guestHasAnyCapability()` instead of returning false. Purchase caps are enforced in `OrdersService.createFromCart()`.

The 4 comment/review creation capabilities (`comment.article`, `review.article`, `comment.product`, `review.product`) use a runtime check inside `CommentsService.create()` — the required capability is derived from request context (`isReview` + target type), not a static decorator.

### `session_type` in JWT
Every access and refresh token carries `session_type: 'customer' | 'backstage'`. The JWT strategy exposes it on `req.user.session_type`. Token refresh propagates the type automatically — the stored `RefreshToken` DB row records `session_type` and re-embeds it in the new pair.

## Coding Conventions

### Backend (NestJS)
- DTOs with class-validator for input validation
- Guards for authorization: `JwtAuthGuard`, `BackstageGuard`, `CapabilityGuard` (see Session Architecture above)
- `@RequiresCapability()` decorator for static capability checks; runtime checks in service for context-dependent capabilities
- `RolesGuard` exists but is no longer used in any controller — do not add new usages
- Prisma for database (no raw SQL)
- Consistent API response format

### Database
- UUIDs for primary keys
- created_at/updated_at on all tables
- Soft deletes (deleted_at) where appropriate
- JSONB for flexible content fields

### Security
- Server-side validation always
- bcrypt cost 12 for passwords
- httpOnly, secure, SameSite cookies
- Sanitize HTML (DOMPurify ready)

## Test Users (Seeded)

- **Owner**: owner@aecms.local / Admin123!@#
- **Admin**: admin@aecms.local / Admin123!@#
- **Member**: member@aecms.local / Member123!@#

## Common Commands

```bash
# ── Starting the app (preferred — handles cold AND warm restarts) ──
bash start-dev.sh
# Cold start (new Codespace): starts Docker containers, runs migrations, seeds DB, starts both servers
# Warm start (same session):  skips seed if users already exist, restarts NestJS + Next.js only

# Logs (after start-dev.sh)
tail -f /tmp/backend.log /tmp/frontend.log

# ── Manual startup (if needed individually) ──
cd backend && npm run start:dev   # backend only (DB must already be running)
cd frontend && npm run dev        # frontend only

# ── Tests ──
npm run test          # Unit tests
npm run test:e2e      # E2E tests (require Docker)

# ── Database ──
npx prisma migrate dev --name migration_name
npx prisma db seed    # runs all 5 seed scripts (users + content)
npx prisma generate

# ── Docker (postgres + redis only — docker-compose full build is broken in Codespaces) ──
docker start aecms-postgres aecms-redis        # restart existing containers
docker run -d --name aecms-postgres ...        # see start-dev.sh for full command
docker logs aecms-postgres

# ── Docker cache maintenance (run regularly to preserve storage) ──
docker system prune -af --volumes  # Remove all unused data
docker builder prune -af           # Clear build cache
```

## Storage Management

**IMPORTANT**: Keep Codespaces storage clean to avoid running out of space. Run these periodically and before/after major work:
```bash
# Docker (biggest culprit)
docker system prune -af --volumes && docker builder prune -af

# npm caches
npm cache clean --force
cd backend && npm cache clean --force
cd ../frontend && npm cache clean --force

# Check usage
docker system df
df -h /
```

If disk is >80% full, also clear build artifacts:
```bash
rm -rf backend/dist frontend/.next
```

## Feature Requests

Small, self-contained features that don't constitute major phase-level work live here. Each feature gets a single document that combines synopsis, status, discussion, design guide, completion report, and testing guide.

- `docs/feature-requests/FEATURE_REQUESTS.md` - Index of all FRs with status
- `docs/feature-requests/_TEMPLATE.md` - Document template for all feature requests
- `docs/feature-requests/` - One file per feature (FR-NNN-kebab-name.md)

## Bug Queue

Known bugs, planned fixes, and fix history. One file per bug.

- `docs/bugs/BUGS.md` - Index of all bugs with status and severity
- `docs/bugs/_TEMPLATE.md` - Document template for bug reports
- `docs/bugs/` - One file per bug (BUG-NNN-kebab-description.md)

**Status values:** `draft` → `accepted` → `in-planning` → `in-dev` → `in-testing` → `deployed` (or `deferred` / `rejected`)

**Naming:** FR-001, FR-002, … — sequential, permanent. Rejected/deferred FRs keep their number.

**What goes here vs. a Phase:** Use an FR for focused additions that don't require schema redesigns, new modules, or multi-sprint planning. If it introduces a new Prisma model, a new NestJS module, or touches more than ~5 files in a coordinated way, it probably warrants a Phase instead.

**Lifecycle note (per IMPORTANT note below):** After implementing a feature request, fill in the Completion Report and Testing Guide sections of its FR doc, then set status to `deployed`.

## Phase Documentation

- `docs/IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `docs/phases/PHASE_1_COMPLETION_REPORT.md` - Auth & database details
- `docs/phases/PHASE_2_COMPLETION_REPORT.md` - RBAC system details
- `docs/phases/PHASE_3_COMPLETION_REPORT.md` - Content management details
- `docs/phases/PHASE_4_COMPLETION_REPORT.md` - Ecommerce core details
- `docs/phases/PHASE_5_COMPLETION_REPORT.md` - Payments integration details
- `docs/phases/PHASE_5_PLAN.md` - Payments human configuration requirements
- `docs/phases/PHASE_6_COMPLETION_REPORT.md` - Frontend implementation details
- `docs/phases/PHASE_6B_COMPLETION_REPORT.md` - Comments & AI moderation details
- `docs/phases/PHASE_7_COMPLETION_REPORT.md` - Digital products details
- `docs/phases/PHASE_8_COMPLETION_REPORT.md` - Domain aliasing & email verification
- `docs/phases/PHASE_9_COMPLETION_REPORT.md` - User testing progress and bugs found
- `docs/phases/PHASE_9_BACKSTAGE_COMPLETION.md` - Customer/backstage session bifurcation details
- `docs/phases/BACKSTAGE_REFACTOR_PLAN.md` - Full implementation plan with completion checklist
- `docs/TESTING_GUIDE.md` - Full testing guide including Phase 13 manual sequence, Stripe/PayPal setup
- `docs/phases/PHASE_10A_COMPLETION_REPORT.md` - MediaGallery widget, media schema normalization
- `docs/phases/PHASE_10B_COMPLETION_REPORT.md` - TipTap JSON migration, inline widget nodes
- `docs/phases/PHASE_11_PLAN.md` - Pages: widget-composed page builder, dual-size widget system
- `docs/phases/PHASE_11_COMPLETION_REPORT.md` - Phase 11 implementation details
- `docs/phases/PHASE_12_PLAN.md` - Audit trail, transaction logging, content version history
- `docs/phases/PHASE_12_COMPLETION_REPORT.md` - Phase 12 implementation details
- `docs/phases/PHASE_13_COMPLETION_REPORT.md` - Phase 13 QA results, capability refactor, bug fixes
- `docs/phases/PHASE_14_COMPLETION_REPORT.md` - Phase 14 digital delivery, Kindle wizard, name fields
- `docs/phases/PHASE_15_COMPLETION_REPORT.md` - Phase 15 admin settings: SiteSettings, ISM (KeyProvider/LocalKeyProvider), settings UI
- `docs/phases/PHASE_16_COMPLETION_REPORT.md` - Phase 16 nav menus: articles route, dynamic header, catch-all pages
- `docs/phases/PHASE_16_PLAN.md` - Navigation menus: dynamic nav, page hierarchy, catch-all routing
- `docs/phases/PHASE_17_PLAN.md` - Alternate domain capture: redirect and transparent proxy options
- `docs/phases/PHASE_18_PLAN.md` - Substack integration widget: RSS feed preview with height fade and CTA
- `docs/phases/PHASE_19_PLAN.md` - ♻️ Merged into Phase 21 (redirect doc)
- `docs/phases/PHASE_19_COMPLETION_REPORT.md` - ♻️ Merged into Phase 21; redirect stub with goal-to-outcome table
- `docs/phases/PHASE_20_PLAN.md` - Themes and templates: color palettes, typography, backgrounds
- `docs/phases/PHASE_21_PLAN.md` - Deployability + live deployment plan (merged 19+21)
- `docs/phases/PHASE_21_COMPLETION_REPORT.md` - Phase 21 completion: wizard, CI/CD, Cloud Run, content migration, distribution prep
- `docs/phases/PHASE_22_PLAN.md` - Dependency upgrades & live-testing fixes (TipTap version alignment, GH Actions Node 20 deprecation)
- `docs/phases/PHASE_23_PLAN.md` - Mul Converter: AI-driven webpage ingestion → custom palette + page scaffold
- `docs/phases/PHASE_23_COMPLETION_REPORT.md` - Phase 23 completion: section schema, SectionEditor, Mul Converter pipeline, image gen, scroll transitions, SectionBackgroundPanel
- `docs/feature-requests/FR-010-pii-encryption.md` - PII Encryption at Rest: EncryptionService, UserAddress encrypted columns, backfill strategy for totp/OAuth/orders/users, IP hashing
- `docs/phases/PHASE_24_PLAN.md` - Sales tax: Stripe Tax integration, address book (encrypted), PayPal flat-rate, tax settings, reporting; paired with FR-010
- `docs/phases/PHASE_24_FR010_BUILD_ORDER.md` - Authoritative combined build order for Phase 24 + FR-010: 16 deploys, 5 two-pass backfill sequences, owner actions, Neon URL usage, external prerequisites
- `docs/phases/PHASE_25_PLAN.md` - Cloud SQL → Neon migration: ~$10/mo savings, one-line deploy change
- `docs/phases/PHASE_25_COMPLETION_REPORT.md` - Phase 25 completion: Cloud SQL → Neon operational migration, cost to $0
- `docs/phases/PHASE_26_PLAN.md` - SEO toolkit: 11 items, generateMetadata, JSON-LD, sitemap, robots, book fields
- `docs/phases/PHASE_26_COMPLETION_REPORT.md` - Phase 26 completion: full SEO layer, JSON-LD schemas, sitemap, robots.txt, book fields, Owner's Manual ch08
- `docs/phases/PHASE_27_PLAN.md` - Design Library: manual palette creation, page templates, export/import, Mul Converter integration
- `docs/prd/13-mul-converter.md` - Mul Converter PRD: full design spec (access control, data flow, AI provider abstraction, system prompt, custom palette system)
- `docs/prd/14-mobile-app.md` - Mobile App PRD (Phase 31): Expo/React Native app, discovery manifest, theme mapping, two distribution models, IAP compliance notes
- `docs/prd/15-seo-toolkit.md` - SEO Toolkit PRD (Phase 26): meta fields, OG tags, JSON-LD (Book/Article/Person/Service), sitemap, robots.txt, book ISBN/sameAs fields
- `docs/prd/16-design-library.md` - Design Library PRD (Phase 27): manual palettes, AecmsPalette/AecmsTemplate formats, template.manage capability, community sharing model
- `docs/prd/` - 16 PRD documents with full specifications

## Notes for Claude

- Prefer editing existing files over creating new ones
- Always read files before editing
- Use TypeScript strict mode
- Follow OWASP security practices
- Keep solutions simple (YAGNI)
- Run tests after changes: `npm run test && npm run build`
- Commit incrementally with descriptive messages
- **IMPORTANT**: After completing each phase, create a detailed completion report at `docs/phases/PHASE_X_COMPLETION_REPORT.md` following the format of previous reports (see Phase 2-4 reports for examples)
- **IMPORTANT**: After implementing a feature request, fill in the Completion Report and Testing Guide sections of its `docs/feature-requests/FR-NNN-*.md` file and set status to `deployed`
- **IMPORTANT**: This file (`CLAUDE.md`) is public — it is committed to the repo on all branches. Periodically review it for references to the owner's specific deployment (domain names, real URLs, personal names, book titles, business details) that should not be in a generic distributable codebase. Flag any such references to the owner for scrubbing before they accumulate.
- **IMPORTANT**: During theoretical or design discussions (architecture choices, platform comparisons, technology options, ecosystem questions), always use the WebSearch tool to verify information is current before answering. Don't rely solely on training data for fast-moving topics like hosting pricing, library versions, or ecosystem trends.

## Internal Secrets Manager (ISM)

The ISM is the subsystem that encrypts, stores, retrieves, decrypts, and serves the API keys and credentials needed by application components. Fully implemented as of Phase 15.

**Components:**
- `SiteSettings` DB table — key/value store; values are plaintext or AES-256-GCM ciphertexts (base64)
- `KeyProvider` interface — `encrypt(plaintext)` / `decrypt(ciphertext)`; extension point for Cloud KMS etc.
- `LocalKeyProvider` — current implementation; holds SEK in memory from `SETTINGS_ENCRYPTION_KEY` env var
- `SettingsService` — orchestrator: `set()`, `get()`, `getEffective()` (DB-over-env-var fallback), `getAll()` (redacts `_enc` values)
- `ENV_KEY_MAP` — maps ISM key names to fallback env var names

**Key-naming convention:** keys ending in `_enc` are automatically encrypted at rest.

**Consumer components** (call `getEffective()` lazily — no constructor-time reads):
- `SmtpEmailProvider` — reads all `email.*` keys
- `StripeProvider` — reads `payment.stripe_secret_key_enc`, `payment.stripe_webhook_secret_enc`
- `PayPalProvider` — reads `payment.paypal_client_id`, `payment.paypal_client_secret_enc`

**The SEK** (`SETTINGS_ENCRYPTION_KEY`) never enters the DB. Store it in your platform's secrets manager (Cloud Secret Manager, Railway/Render vault, etc.) or a `chmod 600` `.env` file. Losing it makes all ISM-stored secrets permanently unreadable.

**Key rotation** is prospective (Phase 21+): re-encrypt all `_enc` rows under a new SEK in a single DB transaction, then swap the SEK in external storage.

Full design: `docs/prd/05-security.md` → "Internal Secrets Manager (ISM)" section.

## External Storage Manager (ESM)

The ESM is the subsystem that stores, retrieves, and deletes binary files (uploaded media, digital product source files, system assets) via a provider-agnostic `StorageProvider` interface. The active provider is selected by `STORAGE_PROVIDER_TYPE` at startup; provider credentials are read lazily from the ISM so changes via Admin Settings take effect without restart.

**Providers:**
- `LocalStorageProvider` — filesystem under `uploads/`; default for dev and single-server deployments
- `GcsStorageProvider` — GCS protocol; covers Google Cloud Storage and any GCS-compatible endpoint; supports Workload Identity (Cloud Run) or service account JSON via ISM
- `S3StorageProvider` — S3 protocol; covers AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, MinIO, and any other S3-compatible service

**Two-bucket routing** (cloud providers): paths starting with `digital-products/` go to the private digital bucket (files always served through the backend, never directly); everything else goes to the public media bucket.

**Key files:**
| Component | Location |
|---|---|
| `StorageProvider` interface | `backend/src/storage/storage.interface.ts` |
| `GcsStorageProvider` | `backend/src/storage/gcs-storage.provider.ts` |
| `S3StorageProvider` | `backend/src/storage/s3-storage.provider.ts` |
| `StorageModule` (factory) | `backend/src/storage/storage.module.ts` |
| Test endpoint | `POST /settings/test-storage` (StorageController) |
| Admin Settings UI | File Storage tab in `/admin/settings` |

**ISM keys** (all under `storage.*` namespace; S3 secret and GCS credentials JSON are `_enc`-suffixed and encrypted at rest). Full key list: `docs/prd/05-security.md` → "External Storage Manager (ESM)" section.

## Payments Architecture Note

**Amazon Pay**: Do NOT add a separate Amazon Pay provider. Amazon Pay is exposed automatically by Stripe Checkout for eligible customers. A standalone `AmazonPayProvider` was built and then removed after this was discovered.

**Payment test mode** (`PAYMENT_TEST_MODE`) was removed entirely — use Stripe/PayPal sandbox keys for development testing. For local sandbox testing, run `stripe listen --forward-to localhost:4000/payments/webhooks/stripe` and set the printed `whsec_...` value as `STRIPE_WEBHOOK_SECRET` in `backend/.env`.
