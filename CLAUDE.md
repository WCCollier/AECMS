# AECMS Project - Claude Code Context

## Project Overview

**AECMS** (Advanced Ecommerce Content Management System) is a lightweight, host-agnostic CMS with integrated ecommerce capabilities, designed as a modern alternative to WordPress.

**Key Goals**: Personal CMS with ecommerce for low-traffic sites, free-tier hosting optimized, host-agnostic (Docker), WordPress migration capability, no vendor lock-in.

## Technology Stack

- **Backend**: NestJS + PostgreSQL 15 + Prisma + Redis + TypeScript
- **Frontend**: Next.js 14+ + Tailwind CSS + Radix UI + TipTap
- **Payments**: Stripe (primary), PayPal, Amazon Pay
- **Auth**: JWT + OAuth (Google, Apple) + 2FA for admin
- **Deployment**: Docker Compose (portable)

## Current Project Status

**Phase 0**: ✅ COMPLETE - Project foundation, Docker, NestJS/Next.js initialized
**Phase 1**: ✅ COMPLETE - Database schema (30+ models), JWT auth, tests passing
**Phase 2**: ✅ COMPLETE - Capability-based RBAC (27 capabilities, guards, decorators)
**Phase 3**: ✅ COMPLETE - Content Management (Media, Categories, Tags, Articles, Pages)
**Phase 4**: 🔄 IN PROGRESS - Ecommerce Core (Products, Cart, Orders)

**Test Status**: 42 unit tests passing, 16 E2E tests passing
**API Endpoints**: 31 total (Auth: 5, Capabilities: 7, Media: 6, Categories: 5, Tags: 5, Articles: 6, Pages: 7)

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
cd backend && npm run dev

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
```

## Phase Documentation

- `docs/IMPLEMENTATION_PLAN.md` - Full implementation roadmap
- `docs/PHASE_1_COMPLETION_REPORT.md` - Auth & database details
- `docs/PHASE_2_COMPLETION_REPORT.md` - RBAC system details
- `docs/PHASE_3_COMPLETION_REPORT.md` - Content management details
- `docs/prd/` - 12 PRD documents with full specifications

## Notes for Claude

- Prefer editing existing files over creating new ones
- Always read files before editing
- Use TypeScript strict mode
- Follow OWASP security practices
- Keep solutions simple (YAGNI)
- Run tests after changes: `npm run test && npm run build`
- Commit incrementally with descriptive messages

## Phase 4: Ecommerce Core (Current)

**Modules to implement**:
1. Products Module - CRUD, visibility, categories, stock tracking
2. Cart Module - Session-based and persistent carts
3. Orders Module - Checkout flow, status tracking

**Existing Schema** (from Phase 1):
- Product, ProductCategory, ProductMedia, ProductReview
- CartItem, Order, OrderItem, OrderStatusHistory
- Payment (Stripe, PayPal, Amazon Pay support)

**Capabilities Available**:
- product.create, product.edit, product.delete
- order.view.all, order.edit, order.refund
- review.moderate
