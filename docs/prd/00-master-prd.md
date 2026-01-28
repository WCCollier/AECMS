# Master PRD: AECMS (Advanced Ecommerce Content Management System)

**Version:** 1.1
**Date:** 2026-01-27
**Status:** Technology Stack Approved - PRD In Review
**Key Decisions**: NestJS + Next.js (React) + PostgreSQL confirmed

## Executive Summary

AECMS is a lightweight, scalable Content Management System designed as a modern alternative to WordPress, with integrated ecommerce capabilities. The system prioritizes flexibility, security, and ease of use while maintaining the ability to scale for future feature expansion.

## Project Vision

Create a lightweight, host-agnostic CMS that combines content management with ecommerce functionality, offering:
- Intuitive content creation and management
- Flexible page layouts with embeddable products
- Secure, reliable ecommerce transactions (Stripe + PayPal)
- Portable, Docker-based deployment (runs anywhere)
- Optimized for low-traffic sites with free-tier hosting
- Easy for non-technical users to deploy their own instances
- Better performance and security than traditional WordPress installations
- WordPress content migration capability

## Core Objectives

1. **Content Management**: Enable easy creation and organization of articles, pages, and media with categories/tags
2. **Ecommerce Integration**: Provide secure, PCI-compliant payment processing with product embedding in content
3. **Display Infrastructure**: Support main pane, sidebar, tiling, and carousel layouts
4. **Authentication**: OAuth integration (Google, Apple) plus email/password fallback
5. **Host-Agnostic Design**: Docker Compose deployment that works on any hosting platform
6. **Free-Tier Optimization**: Minimize resource usage for low-traffic sites (few hits per month)
7. **Portability**: Friends can easily deploy their own copies on their preferred hosting
8. **Security**: Enterprise-grade security for content and transactions, no vendor lock-in

## Technology Stack (Approved)

### Backend: NestJS ✅
**Framework**: Node.js with NestJS + TypeScript

**Decision Rationale**:
- NestJS provides structure and scalability beyond Express
- TypeScript support for type safety throughout the application
- Built-in support for microservices if needed later
- Excellent module system for clean architecture
- Strong ecosystem for CMS and ecommerce needs
- Dependency injection and testability built-in
- Familiar patterns for developers with OOP background

### Frontend: Next.js 14+ (React) ✅
**Framework**: Next.js with React + TypeScript

**Decision Rationale**:
- Server-side rendering (SSR) for SEO-critical CMS pages
- Static site generation (SSG) for optimal performance
- React ecosystem for rich UI components and libraries
- App Router for modern routing and layouts
- Built-in image optimization
- Excellent developer experience with hot reload
- Large community and extensive documentation

### Database: PostgreSQL 15+ ✅
**Database**: PostgreSQL with Prisma ORM

**Decision Rationale**:
- Robust relational database ideal for structured CMS content
- JSONB support for flexible content fields when needed
- Excellent performance and proven reliability at scale
- ACID compliance critical for ecommerce transactions
- Strong full-text search capabilities built-in
- Mature ecosystem with excellent tooling
- Free and open-source with no vendor lock-in

### Ecommerce Payment Integration ✅
**Primary**: Stripe Payment Intents API
**Secondary**: PayPal Checkout
**Tertiary**: Amazon Pay

**Decision Rationale**:
- Industry-leading security and PCI DSS Level 1 compliance
- Excellent developer experience and comprehensive documentation
- Support for multiple payment methods (cards, wallets)
- Built-in fraud prevention (Stripe Radar)
- No card data touches our servers (tokenization)
- Lower development and maintenance burden vs. building from scratch
- PayPal provides buyer protection for users who prefer it
- Amazon Pay leverages 300M+ Amazon accounts with same 2.9% + $0.30 pricing

### Additional Technologies (Approved)
- **ORM**: Prisma (type-safe database client for PostgreSQL)
- **Authentication**: JWT with refresh tokens
- **OAuth Providers**: Google Sign-In, Apple Sign-In
- **Authorization**: Role-Based Access Control (RBAC)
- **Caching**: Redis for sessions, content caching, and job queues
- **File Storage**: Local filesystem (MVP), S3-compatible storage (Cloudflare R2 for production)
- **Rich Text Editor**: TipTap (extensible, modern)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI or Headless UI (accessible, unstyled primitives)
- **Email**: SMTP provider (configurable)
- **Deployment**: Docker Compose (host-agnostic, portable)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (Next.js 14+ with React)              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Public Site  │  │ Admin Panel  │  │ Shop/Checkout   │  │
│  │ (SSR/SSG)    │  │ (Client)     │  │ (Client)        │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                         REST API
                              │
┌─────────────────────────────────────────────────────────────┐
│               Backend (NestJS with TypeScript)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Content  │  │   Auth   │  │   User   │  │  Commerce  │ │
│  │ Module   │  │  Module  │  │  Module  │  │   Module   │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
│                                                             │
│  Prisma ORM │ JWT Auth │ RBAC │ Payment Service            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼────────────────────┐
        │                     │                    │
   PostgreSQL              Redis          Stripe/PayPal APIs
   (Prisma)           (Cache/Sessions)    (PCI Compliant)
        │
    Media Storage
  (Local/R2/S3)

All components run in Docker containers for host-agnostic deployment
```

## Key Features Overview

### Phase 1: Foundation (Weeks 1-3)
1. **Infrastructure**: Docker Compose setup for portability
2. **Authentication**: JWT with refresh tokens
3. **OAuth Integration**: Google Sign-In and Apple Sign-In
4. **Authorization**: Role-Based Access Control (Admin, Customer)
5. **Database**: PostgreSQL with Prisma ORM setup
6. **Caching**: Redis for sessions and content

### Phase 2: Content Management (Weeks 4-6)
1. **Articles**: Rich text editor (TipTap), draft/publish workflow
2. **Categories**: Hierarchical organization
3. **Tags**: Flat tagging system
4. **Media Library**: Upload, organize, optimize images
5. **Pages**: Hierarchical page structure
6. **SEO**: Meta title, description, sitemap generation

### Phase 3: Ecommerce Core (Weeks 7-9)
1. **Products**: Create/manage products with images, pricing, SKUs
2. **Product Categories**: Organize shop inventory
3. **Stock Tracking**: Simple in/out of stock management
4. **Shopping Cart**: Session and persistent cart
5. **Product Catalog**: Browse, filter, search products

### Phase 4: Payments & Orders (Weeks 10-11)
1. **Stripe Integration**: Payment Intents API, tokenization
2. **PayPal Integration**: PayPal Checkout
3. **Checkout Flow**: Multi-step, address, shipping, payment
4. **Order Management**: View, update, fulfill orders
5. **Customer Accounts**: Order history, saved addresses

### Phase 5: Display Infrastructure (Weeks 12-13)
1. **Main Pane**: Primary content display area
2. **Sidebar**: Secondary widget area
3. **Grid Tiling**: Product/article grid layouts
4. **Carousels**: Sliding image/product showcases
5. **Widget System**: Reusable content blocks
6. **Template System**: Full-width, sidebar-left, sidebar-right

### Phase 6: Product Embedding (Week 14)
1. **Embed in Articles**: Insert products within article content
2. **Embed in Pages**: Add products to landing pages
3. **Shortcode/Component**: Easy insertion syntax
4. **Styling Options**: Display variants (card, inline, grid)

### Phase 7: Polish & Testing (Weeks 15-16)
1. **Testing**: Unit, integration, end-to-end tests
2. **Performance**: Optimization, caching, image optimization
3. **Mobile Responsive**: All layouts work on mobile
4. **Documentation**: Setup guides, API docs, user manuals
5. **Bug Fixes**: Address issues found in testing

### Phase 8: WordPress Migration (Week 17)
1. **Migration Script**: Parse WordPress database export
2. **Content Transform**: Posts → Articles, Pages → Pages
3. **Media Download**: Pull wp-content/uploads files
4. **URL Redirects**: SEO-friendly redirect mapping
5. **Verification**: Ensure content integrity

### Post-MVP (Future Enhancements)
- **Writer Role**: Member with article creation capability (extensibility example)
- **External Media Sources**: Unsplash, Pexels integration for media library
- Visual theme selector
- Content scheduling
- Product variants (sizes, colors)
- Discount codes and promotions
- Email marketing integration
- Multi-language support
- Advanced analytics dashboard
- PDF and audiobook digital products
- DRM for digital products
- Subscription-based product access

**Note on Writer Role**: Documented in PRD 09 as an example of the capability system's extensibility. Not implemented in MVP. Implementation pending explicit approval. Demonstrates how Owners can create custom roles by assigning granular capabilities.

**MVP Digital Products**: eBook support included in MVP (PRD 11)
**MVP Permissions**: Granular content permissions and audit trail included in MVP (PRD 12)

## Success Metrics

- Page load time < 2 seconds
- 99.9% uptime for ecommerce transactions
- PCI DSS compliance achieved
- Admin operations completed in < 5 clicks
- Mobile-responsive across all features

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Payment security breach | Critical | Use established payment gateways, regular security audits |
| Scope creep | High | Phased approach with clear MVP definition |
| Performance at scale | Medium | Choose scalable tech stack, implement caching early |
| SEO performance | Medium | Next.js SSR/SSG, proper meta tags, sitemap generation |

## Project Timeline (Estimated Phases)

- **Phase 1 (MVP)**: Core CMS functionality
- **Phase 2**: Ecommerce integration
- **Phase 3**: Advanced features and optimization

## Key Decisions Confirmed

1. ✅ **Technology Stack**: NestJS + Next.js (React) + PostgreSQL + Redis
2. ✅ **Payments**: Stripe (primary) + PayPal (secondary) + Amazon Pay (tertiary) - integration approach, not building from scratch
3. ✅ **Traffic**: Very low traffic (few hits per month) - optimize for free tier
4. ✅ **Budget**: Free or near-free hosting required
5. ✅ **Multi-Tenancy**: Single tenant per installation; friends deploy their own copies
6. ✅ **Hosting**: Host-agnostic Docker Compose design for maximum portability
7. ✅ **Content Migration**: WordPress.org content via database export
8. ✅ **Timeline**: No rush - quality over speed
9. ✅ **OAuth**: Google and Apple Sign-In (X/Twitter declined due to $100-200/month API cost)

## Open Questions

### Content Management ✅
1. ~~Should we support Markdown in addition to rich text HTML?~~ → **Answered**: YES - Full Markdown for Admin+, limited for Members
2. ~~Should media library support external embeds?~~ → **Answered**: YES - YouTube and X posts for Admin+
3. ~~Do we need revision history/version control for articles?~~ → **Answered**: YES - Optional, off by default, required for EULA/Privacy Policy (PRD 12)
4. ~~Should media library support external media sources (Unsplash, Pexels integration)?~~ → **Answered**: YES - Post-MVP feature, will be implemented eventually

### User Management ✅ (See PRD 09, PRD 12)
5. ~~User roles and permissions?~~ → **Answered**: Owner, Admin, Member, Guest with capability-based RBAC
6. ~~Commenting system?~~ → **Answered**: Yes, with reviews as special comment type
7. ~~Content visibility controls?~~ → **Answered**: Public, logged-in-only, admin-only
8. ~~Front door login persistence?~~ → **Answered**: Persistent per device, no expiry until logout
9. ~~Future Writer role?~~ → **Documented**: Member with article creation capability (future implementation)
10. ~~Should comment moderation be automatic (AI-based) or manual queue?~~ → **Answered**: Hybrid - AI-based reactive moderation (OpenAI API free) + profanity bleeping + manual review queue (PRD 01)

### Technical Architecture ✅ (See PRD 04)
11. ~~Product vs Article taxonomy?~~ → **Answered**: Separate entities with dual-nature for products (content + commerce)

### Ecommerce ✅
12. ~~Do we need multi-currency support for ecommerce initially?~~ → **Answered**: NO - USD only for MVP
13. ~~Should we support subscription/recurring products in MVP or post-MVP?~~ → **Answered**: Post-MVP consideration
14. ~~Do we need wholesale/bulk pricing tiers?~~ → **Answered**: NO - Not needed
15. ~~Should we support gift cards or store credit?~~ → **Answered**: NO - Not needed

### Security & 2FA ✅ (See PRD 09)
16. ~~2FA for admin access?~~ → **Answered**: Yes, mandatory TOTP/SMS for back door
17. ~~OAuth for admin?~~ → **Answered**: Yes, with 2FA requirement

## Related Documents

- [PRD 01: Content Management](./01-content-management.md) - Articles, pages, media, categories, tags
- [PRD 02: User Interface & Experience](./02-user-interface.md) - UI/UX design and layouts
- [PRD 03: Ecommerce & Payments](./03-ecommerce.md) - Products, cart, checkout, payments
- [PRD 04: Technical Architecture](./04-technical-architecture.md) - System design and patterns
- [PRD 05: Security & Compliance](./05-security.md) - Security, PCI DSS, GDPR
- [PRD 06: Deployment & Hosting](./06-deployment-hosting.md) - Docker, free tier hosting, portability
- [PRD 07: MVP Scope & Priorities](./07-mvp-scope.md) - Must-haves vs nice-to-haves
- [PRD 08: WordPress Migration](./08-wordpress-migration.md) - Content migration strategy
- [PRD 09: User Management & Authentication](./09-user-management-auth.md) - Roles, capabilities, 2FA, front/back door auth
- [PRD 10: Product Embedding Architecture](./10-product-embedding.md) - Dual display modes, embedding in articles/pages
- [PRD 11: Digital Products - eBooks](./11-digital-products-ebooks.md) - EPUB sales, personalization, downloads, Send to Kindle
- [PRD 12: Granular Permissions & Audit Trail](./12-granular-permissions-audit.md) - Content permissions, version control, audit logging

## Decision Log

### Approved Decisions (2026-01-27)
- ✅ Backend framework: NestJS with TypeScript
- ✅ Frontend framework: Next.js 14+ with React and TypeScript
- ✅ Database: PostgreSQL 15+ with Prisma ORM
- ✅ Caching: Redis
- ✅ Payments: Stripe (primary) + PayPal (secondary)
- ✅ OAuth: Google Sign-In + Apple Sign-In
- ✅ Deployment: Docker Compose for host-agnostic portability
- ✅ Hosting strategy: Free-tier optimization (Vercel + Railway/Oracle Cloud)
- ✅ Architecture: Monolithic with clean service boundaries
- ✅ API: RESTful (GraphQL explicitly out of scope)

### Declined Options
- ❌ X (Twitter) OAuth - Cost prohibitive ($100-200/month API tier requirement)
- ❌ Multi-tenancy - Each installation is single tenant
- ❌ GraphQL API - REST only for MVP

## Next Steps

1. ✅ Complete PRD documentation (DONE)
2. ⏭️ Review and finalize open questions
3. ⏭️ Set up project repository structure
4. ⏭️ Initialize NestJS backend
5. ⏭️ Initialize Next.js frontend
6. ⏭️ Configure Docker Compose
7. ⏭️ Set up database schema with Prisma
8. ⏭️ Implement authentication foundation

---

**Document Status**: Draft - Technology stack approved, comprehensive PRDs completed
**Last Updated**: 2026-01-28
**Next Review**: After stakeholder feedback on PRDs
