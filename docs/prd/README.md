# AECMS Project Requirement Documents

This directory contains the comprehensive Product Requirement Documents (PRDs) for the AECMS (Advanced Ecommerce Content Management System) project.

## Document Structure

### [00-master-prd.md](./00-master-prd.md) - Master PRD
The master document providing:
- Executive summary and project vision
- Technology stack recommendations
- High-level architecture
- Success metrics and risk assessment
- Links to all supporting PRDs

**Start here for project overview.**

### [01-content-management.md](./01-content-management.md) - Content Management
Detailed specifications for:
- Articles/posts with rich text editing
- Page management and custom layouts
- Categories and tagging system
- Media library and asset management
- Publishing workflows

### [02-user-interface.md](./02-user-interface.md) - User Interface & Experience
UI/UX requirements for:
- Public-facing website design
- Administrative dashboard
- Page builder and visual editor
- Design system and components
- Responsive and accessible design

### [03-ecommerce.md](./03-ecommerce.md) - Ecommerce & Payments
Ecommerce functionality including:
- Product management and catalog
- Shopping cart and checkout flow
- Stripe and PayPal integration
- Order management and fulfillment
- Customer accounts

### [04-technical-architecture.md](./04-technical-architecture.md) - Technical Architecture
Technical specifications for:
- System architecture and design patterns
- Backend (NestJS) and frontend (Next.js) structure
- Database design and caching strategy
- API design and performance optimization
- Testing, deployment, and scalability

### [05-security.md](./05-security.md) - Security & Compliance
Security requirements covering:
- Authentication and authorization (JWT, RBAC)
- Data protection and encryption
- Payment security (PCI DSS compliance)
- Infrastructure security
- GDPR, CCPA compliance
- Security monitoring and incident response

### [06-deployment-hosting.md](./06-deployment-hosting.md) - Deployment & Hosting
Deployment strategy for:
- Host-agnostic container-based architecture
- Free-tier hosting options
- Docker Compose setup
- Self-hosting vs managed services
- Backup and SSL strategies
- Easy deployment for friends

### [07-mvp-scope.md](./07-mvp-scope.md) - MVP Scope & Priorities
Defines the MVP including:
- Must-have vs nice-to-have features
- OAuth integration (Google/Apple)
- Product embedding in content
- Layout system (main pane, sidebar, tiles, carousels)
- Development phases and timeline
- Success criteria

### [08-wordpress-migration.md](./08-wordpress-migration.md) - WordPress Migration
Migration strategy for:
- WordPress database export and import
- Content transformation (posts → articles)
- Media file migration
- URL redirect mapping for SEO
- Migration script architecture
- Post-migration verification

### [09-user-management-auth.md](./09-user-management-auth.md) - User Management & Authentication
Comprehensive user system including:
- Role hierarchy (Owner, Admin, Member, Guest)
- Capability-based RBAC system
- Front door vs back door authentication
- 2FA for admin access (TOTP, SMS)
- OAuth integration (Google, Apple)
- Comments and reviews system
- Content visibility controls
- Guest purchasing capabilities

### [10-product-embedding.md](./10-product-embedding.md) - Product Embedding Architecture
Dual display modes for products:
- Full product pages (standalone, SEO optimized)
- Embedded product widgets (inline in articles/pages)
- Display variants (card, inline, grid)
- TipTap visual picker integration
- Shortcode and Markdown syntax
- Real-time stock and price updates
- Add-to-cart functionality within embeds
- Analytics and performance optimization

### [11-digital-products-ebooks.md](./11-digital-products-ebooks.md) - Digital Products (eBooks)
eBook digital product functionality:
- EPUB format support (max 16 MB)
- Personalization/stamping with customer info
- Download delivery with secure tokens
- "Send to Kindle" email delivery
- Purchase flow and order integration
- Download limits and expiration
- AWS SES integration for Kindle delivery
- Security and piracy mitigation

### [12-granular-permissions-audit.md](./12-granular-permissions-audit.md) - Granular Permissions & Audit Trail
Advanced permission and compliance features:
- Granular content permissions (per-article/page/product)
- Author and Admin permission toggles
- OR logic permission evaluation
- Version control for articles (optional, off by default)
- EULA and Privacy Policy version tracking
- User acceptance tracking for legal documents
- Comprehensive audit trail logging
- Immutable, tamper-evident logs
- 7-year retention for legal compliance
- Audit log viewer and export

## Technology Stack Summary

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL
- **Caching**: Redis
- **ORM**: Prisma
- **Language**: TypeScript

### Frontend
- **Framework**: Next.js 14+ (React)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI / Headless UI
- **Rich Text**: TipTap editor
- **Language**: TypeScript

### Payments
- **Primary**: Stripe
- **Secondary**: PayPal
- **Tertiary**: Amazon Pay

### Infrastructure (Host-Agnostic)
- **Deployment**: Docker Compose (runs anywhere)
- **Frontend Hosting**: Vercel (free tier) or Cloudflare Pages
- **Backend Hosting**: Railway (free trial), Oracle Cloud (free tier), or self-hosted
- **Database**: PostgreSQL (Supabase free tier or self-hosted)
- **File Storage**: Local or S3-compatible (Cloudflare R2)
- **CDN/WAF**: Cloudflare (free tier)

## Development Phases

### Phase 1: Core CMS (MVP)
- User authentication
- Article and page management
- Media library
- Categories and tags
- Basic SEO features

### Phase 2: Ecommerce Foundation
- Product catalog
- Shopping cart
- Stripe integration
- Order management
- Customer accounts

### Phase 3: Advanced Features
- PayPal integration
- Advanced page builder
- Analytics dashboard
- Multi-language support
- Advanced SEO tools

## Using These Documents

### For Stakeholders
- Read the **Master PRD** for high-level overview
- Review specific PRDs for detailed requirements in your area of interest
- Use the "Open Questions" sections to provide feedback

### For Developers
- Start with **Technical Architecture** for system design
- Reference specific PRDs for feature requirements
- Follow the API specifications and database schemas
- Implement security requirements from **Security PRD**

### For Designers
- Review **User Interface & Experience PRD** for design requirements
- Reference mockups and component specifications
- Ensure WCAG AA accessibility compliance
- Follow the design system guidelines

### For Project Managers
- Use **Master PRD** for timeline and milestone planning
- Track open questions and decisions needed
- Monitor success metrics defined in each PRD
- Coordinate between different workstreams

## Document Status

All PRDs are currently in **Draft** status (v1.0-1.1) as of 2026-01-28.

### Next Steps
1. **Review**: Stakeholder review of all PRDs
2. **Clarify**: Answer open questions in each document
3. **Approve**: Get sign-off on requirements
4. **Refine**: Update based on feedback
5. **Implement**: Begin development with approved PRDs

## Providing Feedback

When reviewing these documents, please provide feedback on:
- **Missing requirements**: What's not covered?
- **Open questions**: Answers to questions listed in each PRD
- **Priorities**: What features are most important?
- **Constraints**: Technical, budget, or timeline limitations
- **Concerns**: Risks or issues not addressed

## Document Maintenance

These PRDs are living documents and should be updated as:
- Requirements change or become clearer
- Technical decisions are made
- New features are proposed
- Implementation reveals gaps or issues

### Version History
- **v1.1** (2026-01-28): Added PRD 11 (Digital Products), PRD 12 (Granular Permissions & Audit), Amazon Pay, AI moderation
- **v1.0** (2026-01-27): Initial draft of all PRDs

## Key Decisions Made

1. **Tech Stack**: NestJS + Next.js + PostgreSQL + Redis
2. **Payment Strategy**: Stripe (primary) + PayPal (secondary) + Amazon Pay (tertiary)
3. **Architecture**: Container-based, host-agnostic design with Docker
4. **Hosting**: Free-tier focus (Vercel + Railway/Oracle Cloud)
5. **Scale**: Optimized for low traffic (few hits per month)
6. **Security**: JWT authentication, OAuth (Google/Apple), Stripe for PCI compliance
7. **Deployment**: Docker Compose for portability
8. **Storage**: Local filesystem (MVP), S3-compatible (future)

## Key Decisions Confirmed

1. ✅ **Traffic**: Very low (few hits per month) - free tier optimization
2. ✅ **Budget**: Free or near-free hosting required
3. ✅ **Multi-tenancy**: Single tenant per installation, friends deploy own copies
4. ✅ **Migration**: WordPress.org content via database export
5. ✅ **Timeline**: No rush, quality over speed
6. ✅ **MVP Must-Haves**:
   - Articles with categories/tags
   - Media library
   - Shop items (embeddable in content)
   - Display layouts (main pane, sidebar, tiling, carousels)
   - Google/Apple OAuth sign-in
7. ✅ **Nice-to-Haves**:
   - Mobile responsive design (should be standard)
   - Visual themes (future)

## Related Documentation

- `docs/architecture/` - Detailed architecture diagrams (to be created)
- `docs/api/` - API documentation (to be created)
- `docs/setup/` - Development setup guides (to be created)
- `docs/deployment/` - Deployment procedures (to be created)

## Contact

For questions or clarifications about these PRDs, please contact the project stakeholders.

---

**Last Updated**: 2026-01-28
**Status**: Draft
**Version**: 1.1
