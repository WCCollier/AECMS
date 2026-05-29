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
**Phase 8**: 🔄 IN PROGRESS - Polish & Production (Domain Aliasing, Email Verification)

**Test Status**: 90 frontend + 144 backend unit tests (all passing); 16 backend E2E tests (require Docker)
**API Endpoints**: 112 total

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
| Comments | 11 |
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
- **Stripe (Primary)**: Cards, Apple Pay, Google Pay, Amazon Pay - all via Stripe Checkout
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
- ⏸️ AmazonPayProvider deprecated (Amazon Pay handled via Stripe Checkout)

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

## Phase 8: Polish & Production (🔄 IN PROGRESS)

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

**Remaining**:
1. Add loading skeletons and toast notifications
3. Implement CRUD forms in admin
4. Image upload in admin
5. Responsive design improvements
6. SEO and performance optimization
7. WordPress migration scripts
