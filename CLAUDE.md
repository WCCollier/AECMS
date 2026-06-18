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

## Current Project Status

**Phase 0**: ✅ COMPLETE - Project foundation, Docker, NestJS/Next.js initialized
**Phase 1**: ✅ COMPLETE - Database schema (30+ models), JWT auth, tests passing
**Phase 2**: ✅ COMPLETE - Capability-based RBAC (44 capabilities, guards, decorators)
**Phase 3**: ✅ COMPLETE - Content Management (Media, Categories, Tags, Articles, Pages)
**Phase 4**: ✅ COMPLETE - Ecommerce Core (Products, Cart, Orders)
**Phase 5**: ✅ COMPLETE - Payments Module (Stripe, PayPal) - Configured
**Phase 6**: ✅ COMPLETE - Frontend (Next.js 16, React 19, Tailwind v4)
**Phase 6B**: ✅ COMPLETE - Comments & AI Moderation (OpenAI + profanity filter)
**Phase 7**: ✅ COMPLETE - Digital Products (Storage, Email, Downloads, Send to Kindle)
**Phase 8**: ✅ COMPLETE - Polish & Production (Domain Aliasing, Email Verification)
**Phase 9**: ✅ COMPLETE - User Testing (Steps 1–8 verified; Steps 9–11 superseded by Phase 13)
**Phase 13**: ✅ COMPLETE - Full-system QA: Admin CRUD (articles, products, pages), widget system, Stripe sandbox, audit log verified; PayPal E2E, version history restore, order management UI deferred
**Phase 10A**: ✅ COMPLETE - Widget System: MediaGallery hero carousel, media schema normalization
**Phase 10B**: ✅ COMPLETE - TipTap JSON migration + inline widget nodes (MediaCarousel, Callout, VideoEmbed, XEmbed)
**Phase 11**: ✅ COMPLETE - Pages: widget-composed page builder, dual-size widget system, ArticleEmbed/ProductEmbed/RichTextBox
**Phase 12**: ✅ COMPLETE - Audit trail, transaction logging, content version history
**Phase 14**: ✅ COMPLETE - Digital item delivery: personalization, downloads, Kindle wizard (2026-06-16)
**Phase 14 QA fixes** (2026-06-17): order status badge normalization, digital product UX polish, cart 403 fix, SKU/slug uniqueness hardening
**Phase 14 QA fixes, session 2** (2026-06-17): name field implementation — username at registration, first+last required at checkout
**Phase 15**: ✅ COMPLETE - Admin Settings: SiteSettings DB table, Internal Secrets Manager (ISM) with pluggable KeyProvider (AES-256-GCM), settings UI (General/Identity/Email/Payment tabs), audit logging (2026-06-17)
**Phase 16**: ✅ COMPLETE - Navigation menus: /latest→/articles rename, dynamic header nav from DB, catch-all [...slug] route, page hierarchy, admin nav fields (2026-06-17)
**Phase 17**: ✅ COMPLETE - Alternate domain capture: Next.js middleware 301 redirects from secondary domains; alias_type field for future proxy support (2026-06-17)
**Phase 18**: ✅ COMPLETE - RSS Feed widget: ExternalFeedsModule backend (Redis cache, SSRF validation), RssFeedWidget component, RssEmbed TipTap node (2026-06-17)
**Phase 19**: ♻️ MERGED INTO PHASE 21 - See PHASE_19_PLAN.md
**Phase 20**: ✅ COMPLETE - Themes and templates: 8 curated palettes, 5 font pairings, CSS variable injection in root layout, /admin/settings/appearance backstage UI (2026-06-17)
**Phase 20 post-fixes** (2026-06-18): pure CSS variable system (globals.css rewrite), instant client-side theme apply, AppearanceClient adminApi fix, Redis URL fix in start-dev.sh
**Phase 21**: 🚧 IN PROGRESS - Deployability + first live deployment (merged with Phase 19): SEED_PROFILE system, setup wizard, GcpKeyProvider, Dockerfiles, GitHub Actions CI/CD, Cloud Run, FvR content migration

**Session 2026-06-18 improvements** (not phase-tracked):
- TipTap link insertion modal (Pages/Articles/Products/URL tabs, new-tab toggle, inline search)
- Nav header: hover-delay submenu fix, chevron pin/unpin, mobile handled separately
- RSS widget: Cloudflare proxy fallback via rss2json.com, styled card with header + fade CTA
- Page editor: drag-and-drop sibling nav reorder (PATCH /pages/reorder, @dnd-kit/sortable)
- Digital Library: Kindle button now shown for PDF downloads (with warning label)
- Backstage inactivity timeout: 30 min → 3 hours
- ISM: consumer wiring (SMTP/Stripe/PayPal lazy reads), favicon upload, homepage mode toggle
- ESM: GcsStorageProvider, S3StorageProvider, media.service migration, File Storage settings tab
- Payment test mode removed entirely (was a dev stub; Stripe/PayPal sandbox replaces it)
- Secrets migrated from .env to ISM via migration script

**Test Status**: 125 frontend + 190 backend unit tests (all passing); 16 backend E2E tests (require Docker)
**API Endpoints**: 138 total (+POST /settings/test-storage, +POST /settings/favicon)

## API Endpoint Summary

| Module | Endpoints |
|--------|-----------|
| Auth | 7 |
| Capabilities | 7 |
| Media | 6 |
| Categories | 5 |
| Tags | 5 |
| Articles | 6 |
| Pages | 7 |
| Products | 7 |
| Cart | 6 |
| Orders | 7 |
| Payments | 10 |
| Comments | 12 |
| Digital Products | 11 |
| Kindle | 7 |
| Domain Aliases | 10 |

## Key Architecture Decisions

- **User Roles**: Owner > Admin > Member > Guest (default shipped bundles, not architectural constraints)
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

Current counts: **35 backstage** + **12 customer** = **47 total capabilities**.

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

## Phase Documentation

- `docs/IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `docs/PHASE_1_COMPLETION_REPORT.md` - Auth & database details
- `docs/PHASE_2_COMPLETION_REPORT.md` - RBAC system details
- `docs/PHASE_3_COMPLETION_REPORT.md` - Content management details
- `docs/PHASE_4_COMPLETION_REPORT.md` - Ecommerce core details
- `docs/PHASE_5_COMPLETION_REPORT.md` - Payments integration details
- `docs/PHASE_5_PLAN.md` - Payments human configuration requirements
- `docs/PHASE_6_COMPLETION_REPORT.md` - Frontend implementation details
- `docs/PHASE_6B_COMPLETION_REPORT.md` - Comments & AI moderation details
- `docs/PHASE_7_COMPLETION_REPORT.md` - Digital products details
- `docs/PHASE_8_COMPLETION_REPORT.md` - Domain aliasing & email verification
- `docs/PHASE_9_COMPLETION_REPORT.md` - User testing progress and bugs found
- `docs/PHASE_9_BACKSTAGE_COMPLETION.md` - Customer/backstage session bifurcation details
- `docs/BACKSTAGE_REFACTOR_PLAN.md` - Full implementation plan with completion checklist
- `docs/TESTING_GUIDE.md` - Full testing guide including Phase 13 manual sequence, Stripe/PayPal setup
- `docs/PHASE_10A_COMPLETION_REPORT.md` - MediaGallery widget, media schema normalization
- `docs/PHASE_10B_COMPLETION_REPORT.md` - TipTap JSON migration, inline widget nodes
- `docs/PHASE_11_PLAN.md` - Pages: widget-composed page builder, dual-size widget system
- `docs/PHASE_11_COMPLETION_REPORT.md` - Phase 11 implementation details
- `docs/PHASE_12_PLAN.md` - Audit trail, transaction logging, content version history
- `docs/PHASE_12_COMPLETION_REPORT.md` - Phase 12 implementation details
- `docs/PHASE_13_COMPLETION_REPORT.md` - Phase 13 QA results, capability refactor, bug fixes
- `docs/PHASE_14_COMPLETION_REPORT.md` - Phase 14 digital delivery, Kindle wizard, name fields
- `docs/PHASE_15_COMPLETION_REPORT.md` - Phase 15 admin settings: SiteSettings, ISM (KeyProvider/LocalKeyProvider), settings UI
- `docs/PHASE_16_COMPLETION_REPORT.md` - Phase 16 nav menus: articles route, dynamic header, catch-all pages
- `docs/PHASE_16_PLAN.md` - Navigation menus: dynamic nav, page hierarchy, catch-all routing
- `docs/PHASE_17_PLAN.md` - Alternate domain capture: redirect and transparent proxy options
- `docs/PHASE_18_PLAN.md` - Substack integration widget: RSS feed preview with height fade and CTA
- `docs/PHASE_19_PLAN.md` - ♻️ Merged into Phase 21 (redirect doc)
- `docs/PHASE_20_PLAN.md` - Themes and templates: color palettes, typography, backgrounds
- `docs/PHASE_21_PLAN.md` - ⭐ CURRENT PHASE: Deployability + FvR live deployment (merged 19+21)
- `docs/prd/` - 12 PRD documents with full specifications

## Notes for Claude

- Prefer editing existing files over creating new ones
- Always read files before editing
- Use TypeScript strict mode
- Follow OWASP security practices
- Keep solutions simple (YAGNI)
- Run tests after changes: `npm run test && npm run build`
- Commit incrementally with descriptive messages
- **IMPORTANT**: After completing each phase, create a detailed completion report at `docs/PHASE_X_COMPLETION_REPORT.md` following the format of previous reports (see Phase 2-4 reports for examples)

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

## Phase 5: Payments Integration (✅ CONFIGURED)

**Architecture** (simplified):
- **Stripe (Primary)**: Cards, Apple Pay, Google Pay, **and Amazon Pay** — all via Stripe Checkout. Amazon Pay is a native Stripe payment method; no separate backend provider is needed.
- **PayPal (Secondary)**: Alternative payment method for customers who prefer PayPal

**Implemented**:
- ✅ PaymentsModule with provider abstraction pattern
- ✅ StripeProvider — Stripe Checkout Sessions, webhooks (`checkout.session.completed`)
- ✅ PayPalProvider — Orders API v2, OAuth2 tokens, capture on return
- ✅ Test mode (`PAYMENT_TEST_MODE=true`) for development without live API calls
- ✅ OptionalJwtAuthGuard for guest checkout
- ✅ `/checkout/success` — PayPal capture-on-return page
- ✅ `/checkout/cancel` — cancellation page (Stripe + PayPal)

**Configuration Status**:
- ✅ Stripe sandbox keys configured (via Codespaces Secrets)
- ✅ PayPal sandbox keys configured (via Codespaces Secrets)
- ⚠️ `PAYMENT_TEST_MODE=true` in backend `.env` — must be set to `false` for live sandbox testing
- ⚠️ `STRIPE_WEBHOOK_SECRET=PLACEHOLDER` — must be replaced with real value from `stripe listen`

**To enable live sandbox testing** (one-time setup per Codespace restart):
```bash
# 1. Set PAYMENT_TEST_MODE=false in backend/.env
# 2. Run the Stripe CLI listener in a separate terminal:
stripe listen --forward-to localhost:4000/payments/webhooks/stripe
# 3. Copy the whsec_... value it prints to STRIPE_WEBHOOK_SECRET in backend/.env
# 4. Restart the backend: kill the process and npm run start:dev again
```

**Do NOT add a separate Amazon Pay provider.** Amazon Pay is exposed automatically by Stripe Checkout for eligible customers. A standalone `AmazonPayProvider` was built and then removed after this was discovered.

**Secrets Management**:
- Development/Sandbox keys → Codespaces Secrets (current)
- Production keys → Production environment only (NOT in Codespaces)

## Phase 6: Frontend (✅ COMPLETE)

**Tech Stack**:
- Next.js 16 with App Router
- React 19
- Tailwind CSS v4
- SWR for data fetching
- Radix UI primitives

**Implemented**:
- ✅ API client with token refresh interceptors
- ✅ Auth context and SWR hooks
- ✅ UI components (Button, Input, Card)
- ✅ Layout components (Header, Footer)
- ✅ Auth pages (login, register)
- ✅ Shop pages (listing, detail, cart, checkout)
- ✅ Blog pages (listing, detail)
- ✅ Admin dashboard (products, articles, orders)
- ✅ 90 unit tests (Jest + React Testing Library)

## Phase 7: Digital Products (✅ COMPLETE)

**Implemented**:
- ✅ Storage Provider Abstraction (local filesystem, cloud-ready)
- ✅ Email Provider Abstraction (console dev, SMTP production)
- ✅ Digital Products Module (upload, download tokens, personalization)
- ✅ Send to Kindle Service (device management, file delivery)
- ✅ 46 new unit tests (121 total backend)

**Configuration**:
```env
# Storage
STORAGE_PROVIDER_TYPE=local
STORAGE_PATH=/app/uploads

# Email (for Send to Kindle)
# Codespaces testbed: EMAIL_PROVIDER_TYPE=smtp via Gmail (moriakul@gmail.com, app password in backend/.env)
# Production: EMAIL_PROVIDER_TYPE=smtp with a dedicated transactional address
EMAIL_PROVIDER_TYPE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=moriakul@gmail.com
```

**Frontend env** (`frontend/.env.local`):
```env
NEXT_PUBLIC_KINDLE_SENDER_EMAIL=moriakul@gmail.com  # shown to user in wizard Step 2
```

## Phase 8: Polish & Production (✅ COMPLETE)

**Implemented**:
- ✅ Domain Aliasing Module (Owner configurable route-domain mapping)
- ✅ Email Verification (required for new registrations)
- ✅ 23 new unit tests (144 total backend)

**Domain Aliasing Features**:
- DNS TXT record verification for domain ownership
- Admin UI endpoint for managing aliases
- Auto-activation on verification
- Owner-only access

**Email Verification Features**:
- Verification email sent on registration
- 24-hour token expiry
- Resend verification endpoint
- Login blocked until verified

## Phase 14 QA Fixes (2026-06-17)

**Bugs fixed during operational testing:**

- **Cart 403 on remove/decrement**: `cart.service.ts` `updateItem` and `removeItem` — `userId` now takes priority over `sessionId` in ownership check; sessionId check is skipped when user is authenticated. Old code threw 403 when the cart's stored `session_id` didn't match the header for a logged-in user's cart.
- **`personalizationEnabled` validation**: FormData sends strings; added `@Transform(({ value }) => value === 'true' || value === true)` before `@IsBoolean()` in `CreateDigitalFileDto` and `UpdateDigitalFileDto`.
- **Digital file format sync**: After uploading EPUB, the `uploadFormat` state stayed `'epub'` while the dropdown switched to PDF, so the file picker's `accept` filter was wrong. Fixed with `useEffect` that syncs state to first available format.
- **Digital file slot upsert**: Uploading a second file of the same format now replaces the existing record (resets `personalization_tested`) instead of throwing a conflict. Each existing file row has a Replace button.
- **New product redirect**: `ProductForm` now pushes to `/admin/products/${res.data.id}` on create so the admin lands on the edit page where Digital Files panel is visible.
- **DigitalFilesPanel layout**: Moved into `ProductForm`'s `lg:col-span-2` left column via a `mainExtra` prop. Orange border (`border-orange-500/50`) to distinguish it.
- **Digital product publish gate**: Backend blocks setting `status: published` on a digital product with zero source files (422 Unprocessable Entity).
- **Order status badge normalization**: `frontend/lib/orderStatus.ts` — single source of truth for all 7 status colors. Used in AdminOrdersClient, admin order detail, AdminDashboardClient, OrderConfirmationClient, AccountPageClient. Removed stale `'paid'` check in dashboard.

**Slug/SKU uniqueness hardening:**

- **Products — soft-delete mangles both fields**: On `remove()`, slug becomes `__DELETED__{ts}__{slug}` and SKU becomes `__DELETED__{ts}__{sku}`, freeing both unique DB slots immediately.
- **Products — reuse warning**: When `create()` or `update()` uses a slug or SKU that matches a deleted product's mangled value (`endsWith: '__${value}'` among `deleted_at: { not: null }`), the product is saved and a `warnings: string[]` field is included in the response. `ProductForm` shows an `alert()` before redirecting.
- **Products — uniqueness checks exclude deleted**: All slug/SKU checks in `create()`, `update()`, and `generateUniqueSku()` now use `findFirst({ deleted_at: null })` instead of `findUnique()`.
- **Articles & pages — slugs permanently reserved**: Slug is NOT mangled on soft-delete. If a new article/page uses a deleted record's slug, a `ConflictException` is thrown with message: *"The slug 'X' belongs to a deleted article/page. Choose a different title, or ask an administrator to restore the original."*

## Name Field Design (implemented 2026-06-17)

**Two distinct identity fields — different lifecycle:**

- **`username`** — public-facing social handle for comments, reviews, and future social features. Required at registration. Stored as `users.username` (unique, nullable for accounts created before this change). Shown with `@` prefix on Account page.
- **`first_name` + `last_name`** — legal/commercial identity for receipts, personalized files, and shipping. Optional at registration; **required at point of purchase** (prompted at checkout if missing). Back-filled to user record on first purchase so subsequent checkouts are pre-filled.

**Checkout name collection:**
- **Physical product checkout, guest**: Name fields shown on the Shipping Information step (goes on the package as `shipping_name`).
- **Digital/service checkout, guest**: Name + email shown on the Payment Method step.
- **Logged-in user, no name on file**: Name fields shown on the Payment Method step with a note that name is used for personalised files and receipts.
- **Logged-in user, name already on file**: No name prompt — pre-populated silently.

**Personalization priority chain** (in `digital-products.service.ts` `downloadFile()`):
1. Explicit `?customerName=` query param (admin/test use)
2. `order.customer_name` (set at checkout from first+last fields)
3. User record `first_name + last_name` (fallback for orders before this change)
4. `order.email` (last resort)

**DB migration**: `20260617200000_add_username_and_order_customer_name`
- `users.username VARCHAR UNIQUE` (nullable — existing accounts unaffected)
- `orders.customer_name VARCHAR` (resolved full name stored at checkout time)

**Seeded accounts** (owner, admin, member) have `username = NULL` — they will be prompted for a name on their first purchase.

## Phase 9: User Testing (🔄 IN PROGRESS)

**Goal**: Structured manual QA of the full user journey, fixing bugs as they surface.

**Testing sequence** (see `docs/TESTING_GUIDE.md → Phase 9`):
1. ✅ Anonymous article browsing (category/tag filtering fixed)
2. ✅ Anonymous shop browsing (products recovered, service type added, images working)
3. ✅ Anonymous cart mechanics (NaN price fixed, stock validation added, session ID working)
4. ✅ Member login + browsing
5. ✅ Member cart mechanics (anonymous cart merges on login; logout clears display)
6. ✅ Checkout as member (shipping DTO fixed, order confirmation page built, flow verified)
7. ✅ Guest checkout
8. ✅ Admin back door — session bifurcation + 2FA (fully verified)
9. Admin CRUD — articles
10. Admin CRUD — products
11. Admin orders

**Features added during Phase 9**:
- Service product type (`ProductType.service`, `StockStatus.available/unavailable`, nullable stock)
- 15 lesson products recovered from WordPress SQL dump + images
- American Shooter Hat seeded (physical, $24.99, 5 in stock) for quantifiable item testing
- Product feature parity with Articles: `author_id`, `compare_at_price`, comments support
- Product description renders TipTap HTML; Compare-at Price field in admin form
- Anonymous cart session ID (`x-session-id`) generated in `localStorage` and auto-injected
- Infinite scroll / paginated toggle (`ViewModeContext`, `ViewModeToggle`, `useSWRInfinite`)
- Virtual stock reservation system (`POST /cart/validate`, inline stock errors at 3 touch points)
- Order confirmation page (`/order-confirmation?order=:id`)
- Amazon Pay: standalone provider built, then removed — it is natively available through Stripe Checkout
- API Shape Audit (`docs/Shape_Audit.md`) — 9 items identified and resolved
- Unified Comment/Review system: `CommentRating` table, `ProductReview` dropped, verified purchase enforcement
- CartProduct partial type, Cart audit fields (user_id, session_id, created_at, updated_at) retained
- **Customer/backstage session bifurcation** — see Session Architecture section above
- 12 customer-scoped capabilities (comment/review/edit/delete + checkout + purchase types) — see capability table in Session Architecture section

**Deferred polish** (will fix as bugs surface during Phase 9):
- Loading skeletons and toast notifications
- Stripe Elements card UI (currently stubs via alert)
- Admin CRUD forms, image upload
- Responsive design improvements
- SEO and performance optimization
- WordPress migration scripts
