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
**Phase 2**: ✅ COMPLETE - Capability-based RBAC (27 capabilities, guards, decorators)
**Phase 3**: ✅ COMPLETE - Content Management (Media, Categories, Tags, Articles, Pages)
**Phase 4**: ✅ COMPLETE - Ecommerce Core (Products, Cart, Orders)
**Phase 5**: ✅ COMPLETE - Payments Module (Stripe, PayPal) - Configured
**Phase 6**: ✅ COMPLETE - Frontend (Next.js 16, React 19, Tailwind v4)
**Phase 6B**: ✅ COMPLETE - Comments & AI Moderation (OpenAI + profanity filter)
**Phase 7**: ✅ COMPLETE - Digital Products (Storage, Email, Downloads, Send to Kindle)
**Phase 8**: ✅ COMPLETE - Polish & Production (Domain Aliasing, Email Verification)
**Phase 9**: 🔄 IN PROGRESS - User Testing (structured manual QA, bug fixes)

**Test Status**: 90 frontend + 152 backend unit tests (all passing); 16 backend E2E tests (require Docker)
**API Endpoints**: 114 total (added POST /cart/validate)

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

- **User Roles**: Owner > Admin > Member > Guest
- **Auth Strategy**: Front door (persistent sessions), Back door (7-day + mandatory 2FA)
- **Visibility**: public, logged_in_only, admin_only
- **Granular Permissions**: Per-content author_can_edit/delete, admin_can_edit/delete flags
- **Products**: Separate from Articles, dual-nature (content + commerce fields)

## Coding Conventions

### Backend (NestJS)
- DTOs with class-validator for input validation
- Guards for authorization (JwtAuthGuard, CapabilityGuard, RolesGuard)
- `@RequiresCapability()` decorator for capability-based access
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
# Backend development
cd backend && npm run start:dev

# Run tests
npm run test          # Unit tests
npm run test:e2e      # E2E tests

# Database
npx prisma migrate dev --name migration_name
npx prisma db seed
npx prisma generate

# Docker
docker-compose up -d
docker-compose logs -f

# Docker cache maintenance (run regularly to preserve storage)
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
- `docs/TESTING_GUIDE.md` - Full testing guide including Phase 9 manual sequence
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

## Phase 5: Payments Integration (✅ CONFIGURED)

**Architecture** (simplified):
- **Stripe (Primary)**: Cards, Apple Pay, Google Pay, **and Amazon Pay** — all via Stripe Checkout. Amazon Pay is a native Stripe payment method; no separate backend provider is needed.
- **PayPal (Secondary)**: Alternative payment method for customers who prefer PayPal

**Implemented**:
- ✅ PaymentsModule with provider abstraction pattern
- ✅ StripeProvider - Payment Intents API, webhooks
- ✅ PayPalProvider - Orders API v2, OAuth2 tokens
- ✅ Test mode for development without API keys
- ✅ OptionalJwtAuthGuard for guest checkout

**Configuration Status**:
- ✅ Stripe sandbox keys configured (via Codespaces Secrets)
- ✅ PayPal sandbox keys configured (via Codespaces Secrets)

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
EMAIL_PROVIDER_TYPE=console  # Use 'smtp' in production
SMTP_HOST=smtp.example.com
SMTP_PORT=587
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

## Phase 9: User Testing (🔄 IN PROGRESS)

**Goal**: Structured manual QA of the full user journey, fixing bugs as they surface.

**Testing sequence** (see `docs/TESTING_GUIDE.md → Phase 9`):
1. ✅ Anonymous article browsing (category/tag filtering fixed)
2. ✅ Anonymous shop browsing (products recovered, service type added, images working)
3. ✅ Anonymous cart mechanics (NaN price fixed, stock validation added, session ID working)
4. Member login + browsing
5. Member cart mechanics
6. ✅ Checkout as member (shipping DTO fixed, order confirmation page built, flow verified)
7. Guest checkout
8. Admin back door — 2FA enrollment
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

**Deferred polish** (will fix as bugs surface during Phase 9):
- Loading skeletons and toast notifications
- Comment/review UI components (form, display, star input) — backend complete, no frontend yet
- Stripe Elements card UI (currently stubs via alert)
- Admin CRUD forms, image upload
- Responsive design improvements
- SEO and performance optimization
- WordPress migration scripts
