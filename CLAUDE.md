# AECMS Project - Claude Code Context

## Project Overview

**AECMS** (Advanced Ecommerce Content Management System) is a lightweight, host-agnostic CMS with integrated ecommerce capabilities, designed as a modern alternative to WordPress.

**Key Goals**:
- Personal CMS with ecommerce for low-traffic sites (few hits per month)
- Free or near-free hosting (optimized for free tiers)
- Host-agnostic design (easily deployable by friends on their own hosting)
- WordPress content migration capability
- No vendor lock-in

## Project Constraints

- **Traffic**: Very low (few hits per month)
- **Budget**: Free tier hosting and services preferred
- **Timeline**: No rush - quality over speed
- **Portability**: Must be easily deployable by non-technical friends
- **Migration**: WordPress.org content needs to be migrated via database export

## Technology Stack (Confirmed)

### Backend
- **Framework**: NestJS (Node.js with TypeScript)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Caching**: Redis
- **Language**: TypeScript

**Rationale**: NestJS provides structure and scalability beyond Express while maintaining Node.js familiarity.

### Frontend
- **Framework**: Next.js 14+ (React with App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI or Headless UI (unstyled, accessible)
- **Rich Text Editor**: TipTap
- **State Management**: React Context + SWR/TanStack Query
- **Forms**: React Hook Form
- **Language**: TypeScript

**Rationale**: Next.js SSR/SSG for SEO, excellent performance, and developer experience.

### Infrastructure (Host-Agnostic)
- **Deployment**: Docker Compose (portable, runs anywhere)
- **Frontend Hosting**: Vercel free tier (recommended) or Cloudflare Pages
- **Backend Hosting**: Railway free trial, Oracle Cloud free tier, or self-hosted VPS
- **Database**: Included with backend or Supabase free tier (500MB)
- **Redis**: Included with backend
- **File Storage**: Local filesystem (MVP), Cloudflare R2 10GB free (future)
- **CDN/SSL**: Cloudflare free tier

### Payments & Authentication
- **Primary Payment**: Stripe (Payment Intents API)
- **Secondary Payment**: PayPal
- **Authentication**: JWT with refresh tokens
- **OAuth Providers**: Google Sign-In, Apple Sign-In
- **Authorization**: Role-Based Access Control (RBAC)

## MVP Must-Have Features

### Content Management
- ✅ Articles (rich text HTML or Markdown, categories, tags, featured images)
- ✅ **Markdown Support**: Full Markdown for Admin+, limited Markdown for Members (no URLs/embeds)
- ✅ **External Media Embedding**: YouTube videos and X posts (Admin/Owner only)
- ✅ Pages (hierarchical, custom layouts)
- ✅ Media Library (upload, organize, optimize images)
- ✅ Categories (hierarchical)
- ✅ Tags (flat)
- ✅ SEO fields (meta title, description)
- ✅ Comments system (unified for articles and products)
- ✅ **AI Comment Moderation**:
  - OpenAI Moderation API (free) for hate speech, harassment, violence detection
  - Profanity bleeping system using bad-words library (fully redacted, no hints, click-to-reveal for readers)
  - Reactive moderation: post immediately, flag for human review
  - Admin notification for flagged comments
- ✅ Content visibility controls (public, logged-in-only, admin-only)
- ✅ **Granular Content Permissions (MVP)**:
  - Per-content permission flags (author_can_edit/delete, admin_can_edit/delete)
  - OR logic permission evaluation
  - Owner permissions always true (cannot be removed)
  - Admin/Owner can toggle permissions on specific articles/pages/products
- ✅ **Version Control for Articles (Optional, MVP)**:
  - OFF by default, enable per-article
  - Required for EULA and Privacy Policy
  - Track version history with change summaries
  - User acceptance tracking with IP and user agent
  - Force re-acceptance on legal document updates
- ✅ **Audit Trail (MVP)**:
  - Immutable, tamper-evident logging (blockchain-like chaining with checksums)
  - 7-year retention for legal compliance
  - 50+ event types tracked (user actions, ecommerce, content changes, admin actions)
  - Searchable, filterable, exportable (CSV)
  - Admin dashboard viewer

### Ecommerce
- ✅ Products (title, description, price, images, SKU)
- ✅ Product categories
- ✅ Stock tracking (simple in/out of stock)
- ✅ Shopping cart (session and persistent)
- ✅ Checkout flow (multi-step)
- ✅ Stripe integration (primary)
- ✅ PayPal integration (secondary)
- ✅ Amazon Pay integration (tertiary, 2.9% + $0.30, same as Stripe)
- ✅ Order management
- ✅ **Product dual display modes**:
  - **Full Product Page**: Standalone page at `/product/{slug}` with gallery, tabs, reviews, related products
  - **Embedded Product Widget**: Compact card in articles/pages with image, price, rating, add-to-cart
- ✅ **Product embedding in articles/pages**:
  - TipTap visual picker (Insert → Product)
  - Shortcode syntax: `[product id="uuid" display="card"]`
  - Markdown syntax: `!product[Name](slug)`
  - Display modes: card (default), inline (compact), grid (multiple)
  - Real-time stock and price updates
  - Functional add-to-cart within article
- ✅ **Digital Products - eBooks (MVP)**:
  - EPUB format support (max 16 MB)
  - Personalization/stamping with customer info (name, order number, purchase date)
  - Download delivery with secure tokens (7-day expiry, 5 download limit)
  - "Send to Kindle" email delivery via AWS SES
  - EPUB processing using adm-zip and jsdom libraries

### Display Infrastructure
- ✅ **Main Pane**: Primary content area
- ✅ **Sidebar**: Side content widgets
- ✅ **Simple Tiling**: Grid layouts for content/products
- ✅ **Carousels**: Sliding image/product carousels
- ✅ Widget system (article lists, product grids, galleries, custom HTML)
- ✅ Template selection:
  - Full-width (1 column)
  - Sidebar layouts (left or right)
  - **Split Comparison**: Full-screen 50/50 split, edge-to-edge, no gutter (for landing pages)
  - Grid layouts
  - Custom templates

### Authentication & Authorization
- ✅ **Front Door Login**: Header-mounted login for end-user experience (articles, shop, comments)
- ✅ **Back Door Login**: `/admin` URL for administrative access with mandatory 2FA
- ✅ **Google OAuth**: Sign in with Google (front door and back door)
- ✅ **Apple OAuth**: Sign in with Apple (front door and back door)
- ✅ **Email/password**: Traditional login (fallback)
- ✅ **2FA for Admin**: Mandatory TOTP/SMS for back-door logins
- ✅ **User Roles**: Owner (super-admin), Admin, Member, Guest
- ✅ **Capability-Based RBAC**: Extensible permission system, Owner can assign capabilities
- ✅ **Comments & Reviews**: Members can comment on articles and review products
- ✅ **Visibility Controls**: Public, logged-in-only, admin-only for articles and products
- ✅ **Guest Purchasing**: Checkout without account for products marked guest-purchaseable

### Admin Dashboard
- ✅ Content management (articles, pages, media)
- ✅ Shop management (products, orders)
- ✅ User management
- ✅ Site settings (logo, navigation, payment keys)

## Nice-to-Have (Post-MVP)
- Mobile responsive design (should be standard practice)
- **Writer Role**: Member with article creation capability (extensibility example, not MVP)
- Visual theme selector
- Content scheduling
- Product variants (size, color variations)
- Discount codes and promotions
- Email marketing integration
- Content versioning/revisions
- AI-powered content suggestions

## Explicitly Out of Scope (MVP)
- ❌ Multi-language support
- ❌ Variable products (sizes, colors)
- ❌ PDF/audiobook digital products (eBooks only in MVP)
- ❌ DRM encryption for eBooks
- ❌ Subscription products
- ❌ Gift cards / store credit
- ❌ Wholesale / bulk pricing
- ❌ Multi-currency support (USD only)
- ❌ Multi-tenancy (each deployment is single-tenant)
- ❌ GraphQL API (REST only)
- ❌ X (Twitter) OAuth (declined due to $100-200/month API cost)

## Key Architectural Decisions

1. **Container-Based Deployment**: Everything runs in Docker for maximum portability
2. **Monolithic with Service Boundaries**: Clean module separation for potential microservices extraction
3. **Free-Tier Optimization**: Minimize resource usage, optimize for low traffic
4. **Security First**: JWT auth, OAuth, Stripe for PCI compliance, no card data storage, 2FA for admin
5. **SEO-Focused**: Next.js SSR/SSG, proper meta tags, sitemap generation
6. **Host-Agnostic**: No vendor-specific features, works anywhere Docker runs
7. **Capability-Based RBAC**: Extensible permission framework for future features
8. **Dual Authentication**: Front door (user-facing) and back door (admin) with different security requirements
9. **Persistent Front-Door Logins**: No expiry until logout (user convenience)
10. **Time-Limited Back-Door Logins**: 7-day max + 2FA (admin security)
11. **Markdown Support**: Full for Admin+, limited for Members (security)
12. **External Media Embeds**: YouTube and X posts for Admin/Owner only
13. **Product Taxonomy**: Separate from Articles but parallel, dual-nature design (content + commerce)

## User Management Architecture

**See [PRD 09: User Management & Authentication](./docs/prd/09-user-management-auth.md) for comprehensive details**

### User Roles

1. **Owner** (Super-Admin)
   - All capabilities always enabled
   - Can assign/remove capabilities to/from other roles
   - Only Owners can create other Owners
   - First Owner must be seeded manually
   - Cannot delete themselves (prevent lockout)

2. **Admin**
   - Owner-configurable capabilities
   - Default: Create/edit articles (not pages), products, manage Members, moderate comments
   - Cannot: Manage system settings, payment config, or create Admins/Owners

3. **Member**
   - Standard logged-in user
   - Can: View logged-in content, purchase products, leave comments/reviews, manage own account
   - Cannot: Access admin interfaces or create content

4. **Guest**
   - Unauthenticated session
   - Can: View public content, purchase guest-purchaseable products
   - Cannot: Comment, review, or access logged-in-only content

### Capability System

- **Extensible Framework**: New capabilities can be added in future versions
- **Owner Control**: Owners can assign/remove capabilities from roles via admin UI
- **Capability Categories**: Content Management, Ecommerce, Users, System Configuration
- **Examples**: `article.create`, `product.edit`, `user.delete`, `system.configure`
- **Persists Customizations**: Role customizations preserved across updates

### Authentication Flows

**Front Door** (`/` - Header Login):
- Available to: All roles (Member, Admin, Owner)
- Login methods: Google OAuth, Apple OAuth, Email+Password
- Security: JWT tokens (15 min access, persistent refresh tokens)
- **Session Persistence**: Persistent per device, NO EXPIRY until explicit logout
- No 2FA required (user convenience prioritized)
- "Log Out All Devices" feature to revoke all refresh tokens
- Provides: End-user experience (browse, shop, comment, purchase)
- UI: Login button in header → Modal with all login options

**Back Door** (`/admin`):
- Available to: Admin and Owner only
- Login methods: Email+Password (primary), OAuth (optional)
- Security: JWT tokens (15 min access, 7-day max refresh tokens) + **mandatory 2FA** (TOTP or SMS)
- **Session Expiry**: 7-day rolling expiry or explicit logout
- Automatic logout on 30 minutes of inactivity
- Higher security for administrative access
- Provides: Administrative capabilities (content mgmt, user mgmt, system config)
- UI: Dedicated admin login page with 2FA verification

### Content Visibility

**Articles & Pages**:
- `public`: Visible to everyone (Guests included)
- `logged_in_only`: Visible to Members and above
- `admin_only`: Only visible in admin interface

**Products**:
- Same visibility options as articles
- Additional flag: `guest_purchaseable` (boolean)
  - `true`: Guests can purchase without account
  - `false`: Must be Member to purchase

**Comments & Reviews**:
- Per-article/product setting:
  - `disabled`: No comments allowed
  - `logged_in_only`: Members can comment, only logged-in can view
  - `public`: Members can comment, everyone can view

### 2FA Strategy

**Back Door (Admin/Owner)**:
- **Mandatory** for all back-door logins
- Primary: TOTP (Time-based One-Time Password) - FREE, uses authenticator apps
- Backup: SMS (low cost, ~$0.01 per SMS via Twilio/AWS SNS)
- Recovery codes: 10 single-use codes for emergency access
- Works with OAuth: OAuth + 2FA verification for admin access

**Front Door (Members)**:
- Optional (future feature, user-configurable)

**Costs**:
- TOTP: $0 (open-source libraries)
- SMS (optional backup): ~$1-5/month for low-traffic sites
- **No ongoing costs** if using TOTP only

## Development Approach

### Code Quality
- **TypeScript strict mode**: Type safety throughout
- **ESLint + Prettier**: Consistent code formatting
- **Conventional commits**: Semantic commit messages
- **Testing**: 80% backend coverage, 70% frontend coverage
- **Security**: OWASP Top 10 awareness, input validation, sanitization

### Git Workflow
- **Branch strategy**: main, develop, feature/*
- **Pull requests**: Required with code review
- **CI/CD**: GitHub Actions for testing and deployment

### Module Structure (NestJS)
```
src/modules/
├── auth/           # Authentication & authorization
├── users/          # User management
├── content/        # Articles, pages, media, categories, tags
├── commerce/       # Products, cart, orders, payments
└── settings/       # System configuration
```

### Frontend Structure (Next.js)
```
src/app/
├── (public)/       # Public pages (articles, products, shop)
├── (admin)/        # Admin dashboard
└── api/            # API routes (if needed)
```

## WordPress Migration

**Approach**: Direct database export and transformation
- Export WordPress MySQL database (mysqldump or phpMyAdmin)
- Parse WordPress tables (wp_posts, wp_terms, wp_postmeta)
- Transform to AECMS PostgreSQL schema
- Download media from wp-content/uploads
- Import into AECMS
- Generate URL redirect map for SEO

**Migration Script**: `scripts/migrate-wordpress/`
- Handles posts → articles
- Handles pages → pages
- Transforms categories and tags
- Downloads and re-uploads media
- Transforms shortcodes and WordPress-specific HTML

## Project Documentation Structure

```
docs/
├── prd/
│   ├── 00-master-prd.md              # Project overview
│   ├── 01-content-management.md      # Articles, media, categories, AI moderation
│   ├── 02-user-interface.md          # UI/UX specifications
│   ├── 03-ecommerce.md               # Shop, payments (Stripe, PayPal, Amazon Pay)
│   ├── 04-technical-architecture.md  # System design
│   ├── 05-security.md                # Security & compliance
│   ├── 06-deployment-hosting.md      # Deployment strategies
│   ├── 07-mvp-scope.md               # MVP definition
│   ├── 08-wordpress-migration.md     # Migration plan
│   ├── 09-user-management-auth.md    # Roles, capabilities, 2FA, front/back door
│   ├── 10-product-embedding.md       # Product display modes and embedding
│   ├── 11-digital-products-ebooks.md # eBook sales, personalization, Send to Kindle
│   └── 12-granular-permissions-audit.md # Content permissions, version control, audit trail
└── README.md
```

## Development Timeline

**Estimated**: ~17 weeks at moderate pace (no rush)

1. **Foundation** (Weeks 1-3): Infrastructure, Docker, authentication, OAuth
2. **Content Management** (Weeks 4-6): Articles, media, categories, tags
3. **Ecommerce Core** (Weeks 7-9): Products, cart, catalog
4. **Payments** (Weeks 10-11): Stripe, PayPal, orders
5. **Layout System** (Weeks 12-13): Widgets, templates, page builder
6. **Product Embedding** (Week 14): Embed products in content
7. **Polish & Testing** (Weeks 15-16): Testing, optimization, docs
8. **WordPress Migration** (Week 17): Migration script, content import

## Coding Conventions

### General
- Use TypeScript strict mode
- Prefer functional programming patterns
- Keep functions small and focused (single responsibility)
- Avoid over-engineering (YAGNI principle)
- Write self-documenting code (minimal comments needed)

### Backend (NestJS)
- Use DTOs with class-validator for input validation
- Use Guards for authorization
- Use Interceptors for cross-cutting concerns
- Use Prisma for database operations (no raw SQL unless necessary)
- Return consistent API response format

### Frontend (Next.js)
- Use Server Components by default, Client Components when needed
- Prefer Static Generation (SSG) over Server-Side Rendering (SSR)
- Use Next.js Image component for all images
- Implement proper loading and error states
- Mobile-first responsive design

### Database
- Use UUIDs for primary keys
- Include created_at and updated_at on all tables
- Use soft deletes where appropriate (deleted_at)
- Index frequently queried columns
- Use JSONB for flexible content fields

### Data Modeling

**Product vs Article Taxonomy**:
- **Products and Articles are SEPARATE entities** (not inheritance)
- Products have **dual nature**: content/display fields + commerce/transaction fields
- Both share common traits: comments, media, visibility, SEO
- MVP: Single Product table with both content and commerce fields
- Future: Can split to `product_content` + `product_commerce` if commerce complexity grows

**Rationale**:
- Clean separation of concerns (content vs commerce)
- Different query patterns and evolution paths
- Avoids nullable fields and schema bloat
- Easier to optimize and scale independently

**Shared Systems**:
- Comments (polymorphic: `article_id` or `product_id`)
- Media (many-to-many via junction tables)
- Visibility controls (same enum: public, logged_in_only, admin_only)
- SEO fields (meta title, description, Open Graph)

### Security
- Never trust client input
- Validate all inputs server-side
- Sanitize HTML content (DOMPurify)
- Use parameterized queries (Prisma handles this)
- Store passwords with bcrypt (cost factor 12)
- Use httpOnly, secure, SameSite cookies
- HTTPS everywhere

### Performance
- Implement caching (Redis) for published content
- Optimize images automatically
- Use CDN for static assets
- Lazy load non-critical components
- Paginate large lists
- Use database connection pooling

## Environment Variables

Key environment variables to configure:

```bash
# Application
NODE_ENV=production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/aecms
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=random-secret
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Storage
STORAGE_TYPE=local  # or s3, r2, b2
# S3-compatible settings if needed

# Email
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## Success Criteria

### Functional Requirements
- ✅ User can create and publish articles
- ✅ User can upload and manage media
- ✅ User can create and sell products
- ✅ Customer can browse and purchase products
- ✅ Payments process successfully (Stripe/PayPal)
- ✅ Products can be embedded in articles/pages
- ✅ Layouts support main pane, sidebar, tiles, carousels
- ✅ OAuth login works (Google/Apple)
- ✅ WordPress content migrated successfully

### Non-Functional Requirements
- ✅ Site loads in < 2 seconds
- ✅ Mobile-responsive across all pages
- ✅ Runs on free-tier hosting
- ✅ Zero payment security incidents
- ✅ Friends can deploy with documentation
- ✅ All data exportable (no vendor lock-in)

## Deployment Commands

### Local Development
```bash
# Backend
cd backend
npm install
cp .env.example .env
docker-compose up -d  # PostgreSQL + Redis
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Docker Compose (Full Stack)
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Database Operations
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Reset database (CAUTION: Deletes all data)
npx prisma migrate reset

# Seed database
npx prisma db seed

# Generate Prisma Client
npx prisma generate
```

## Common Tasks

### Creating a New Feature Module

1. Generate NestJS module: `nest g module feature-name`
2. Create service: `nest g service feature-name`
3. Create controller: `nest g controller feature-name`
4. Add DTOs in `dto/` folder
5. Add to database schema in `prisma/schema.prisma`
6. Create migration: `npx prisma migrate dev`
7. Write tests

### Adding a New API Endpoint

1. Create DTO for request validation
2. Add method to controller with decorators
3. Implement business logic in service
4. Add authorization guards if needed
5. Document in API docs
6. Write integration tests

### Adding a New Frontend Page

1. Create route in `app/` directory
2. Create page component
3. Add to navigation if needed
4. Implement data fetching (SWR/TanStack Query)
5. Add loading and error states
6. Test responsive design

## Troubleshooting

### Common Issues

**Docker containers won't start**:
- Check if ports are already in use: `lsof -i :3000`
- Check Docker daemon is running: `docker ps`
- View container logs: `docker-compose logs [service-name]`

**Database connection fails**:
- Verify DATABASE_URL in .env
- Check PostgreSQL is running: `docker-compose ps`
- Test connection: `psql $DATABASE_URL`

**Prisma migration fails**:
- Check database is accessible
- Review migration files in `prisma/migrations/`
- Reset if needed (development only): `npx prisma migrate reset`

**OAuth not working**:
- Verify client IDs and secrets in .env
- Check redirect URIs match in OAuth provider settings
- Ensure HTTPS in production (OAuth requires secure callback)

**Payment webhooks not receiving**:
- Use ngrok for local testing: `ngrok http 4000`
- Update webhook URL in Stripe/PayPal dashboard
- Verify webhook signature validation

## Reference Links

- **PRDs**: See `docs/prd/` for detailed specifications
- **NestJS Docs**: https://docs.nestjs.com
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Stripe Docs**: https://stripe.com/docs/api
- **Tailwind CSS**: https://tailwindcss.com/docs

## Notes for Claude

- Prefer editing existing files over creating new ones
- Always read files before editing them
- Use TypeScript strict mode for all new code
- Follow OWASP security best practices
- Optimize for the free tier (minimize resource usage)
- Keep solutions simple (avoid over-engineering)
- Test on mobile (responsive design is critical)
- Document complex logic with comments
- Write descriptive commit messages
- Consider deployment portability in all decisions

## Project Status

**Current Phase**: PRD Development (Complete)
**Next Phase**: Foundation Setup (Infrastructure, Docker, Authentication)

**Completed**:
- ✅ Project requirements gathering
- ✅ Technology stack decisions (NestJS + Next.js + PostgreSQL confirmed)
- ✅ Comprehensive PRD documentation (12 documents):
  - 00: Master PRD (updated with all decisions, Amazon Pay)
  - 01: Content Management (with comments, Markdown, external embeds, product embedding, AI moderation)
  - 02: User Interface & Experience
  - 03: Ecommerce & Payments (Stripe + PayPal + Amazon Pay, reviews system, dual display modes)
  - 04: Technical Architecture (product taxonomy, data modeling)
  - 05: Security & Compliance
  - 06: Deployment & Hosting (host-agnostic, free tier)
  - 07: MVP Scope & Priorities
  - 08: WordPress Migration
  - 09: User Management & Authentication (capability-based RBAC, 2FA, persistent logins)
  - 10: Product Embedding Architecture (dual display modes, TipTap integration)
  - 11: Digital Products - eBooks (EPUB, personalization, downloads, Send to Kindle)
  - 12: Granular Permissions & Audit Trail (content permissions, version control, logging)
- ✅ Hosting strategy defined
- ✅ WordPress migration plan
- ✅ User role hierarchy and capabilities defined (Owner, Admin, Member, Guest)
- ✅ Writer role documented for future extensibility (not MVP)
- ✅ Front door / back door authentication strategy
- ✅ Session persistence strategy (persistent front door, 7-day back door)
- ✅ 2FA strategy for admin access (TOTP + SMS)
- ✅ Comments and reviews system designed
- ✅ Content visibility controls defined
- ✅ Guest purchasing capability defined
- ✅ Markdown support defined (full for Admin+, limited for Members)
- ✅ External media embedding defined (YouTube, X posts for Admin+)
- ✅ Product vs Article taxonomy decided (separate entities, dual-nature products)
- ✅ Product dual display modes defined (full page vs embedded widget)
- ✅ Product embedding methods defined (TipTap picker, shortcode, Markdown)
- ✅ Product embed variants defined (card, inline, grid)
- ✅ eBook digital products designed (EPUB, personalization, Send to Kindle)
- ✅ Granular content permissions system defined (author/admin toggles, OR logic)
- ✅ Version control for legal documents (EULA, Privacy Policy)
- ✅ Audit trail logging system designed (50+ events, 7-year retention)
- ✅ AI comment moderation strategy (OpenAI API free, profanity bleeping)
- ✅ Amazon Pay integration planned (2.9% + $0.30, same as Stripe)
- ✅ eCommerce scope clarified (USD only, no subscriptions/gift cards/bulk pricing)
- ✅ CLAUDE.md created and maintained

**Key Architecture Decisions Made**:
- Front-door logins: Persistent per device, no expiry
- Back-door logins: 7-day max with mandatory 2FA
- Markdown: Full for Admin+, limited (no URLs/embeds) for Members
- External embeds: YouTube and X posts for Admin/Owner only
- Product taxonomy: Separate from Article, dual-nature (content + commerce)
- Writer role: Documented for future, demonstrates capability extensibility

**Next Steps**:
1. ✅ Review and approve PRDs (ALL QUESTIONS ANSWERED - READY FOR IMPLEMENTATION)
2. Set up project structure (backend/frontend/docker)
3. Initialize NestJS and Next.js applications
4. Configure Docker Compose
5. Set up database schema with Prisma (users, roles, capabilities, articles, products, comments, visibility)
6. Implement authentication (JWT + OAuth + 2FA + persistent sessions)
7. Implement rich text editor (TipTap with Markdown + external embeds)

---

## Key MVP Additions (2026-01-28)

### Digital Products - eBooks
- EPUB format support (max 16 MB)
- Personalization/stamping with customer information
- Secure download delivery with token expiry
- "Send to Kindle" email delivery feature
- AWS SES integration for email delivery (~$0.10/1,000 emails)

### Granular Permissions & Audit Trail
- Per-content permission flags separate from role capabilities
- Version control for legal documents (EULA, Privacy Policy)
- User acceptance tracking for legal compliance
- Comprehensive audit trail with 50+ event types
- Immutable logging with blockchain-like chaining
- 7-year retention for legal compliance

### AI Comment Moderation
- OpenAI Moderation API (free) for content flagging
- Profanity bleeping with click-to-reveal (bad-words library, fully redacted with no letter hints)
- Reactive moderation: post immediately, flag for review
- Admin notifications for flagged content

### Amazon Pay Integration
- Third payment option after Stripe and PayPal
- 2.9% + $0.30 pricing (same as Stripe)
- 300M+ Amazon accounts worldwide
- Trusted checkout experience with address autofill

### eCommerce Clarifications
- USD only (no multi-currency in MVP)
- No subscription products in MVP
- No wholesale/bulk pricing
- No gift cards/store credit

---

## Session History & Progress Tracking

### Session 1: PRD Planning (2026-01-28)
**Status**: ✅ Complete
**Accomplishments**:
- Created comprehensive PRD documentation (12 documents + master)
- Defined technology stack (NestJS + Next.js + PostgreSQL)
- Established capability-based RBAC architecture
- Documented all MVP features and scope
- Created IMPLEMENTATION_PLAN.md with phased approach
- Created CODESPACES_SETUP.md for cloud-based development

### Session 2: Codespaces Setup & Phase 0 Complete (2026-01-29)
**Status**: ✅ Complete (Awaiting Human Verification)
**Accomplishments**:
- ✅ Configured all GitHub Codespaces Secrets (10 required + placeholders for future phases)
- ✅ Verified environment variables loaded successfully
- ✅ Created `.env.example` documentation file
- ✅ Confirmed Docker, Docker Compose, Node.js v24.13.0 pre-installed
- ✅ Clarified Codespaces vs local development workflow
- ✅ Documented URL strategy for Codespaces environment
- ✅ Completed Phase 0: Project Foundation (autonomous, ~15 minutes)
  - Created complete project structure (backend, frontend, scripts)
  - Initialized NestJS with 45+ packages (Prisma, JWT, Passport, Redis, Bull)
  - Initialized Next.js 16 with 65+ packages (Tailwind, Radix UI, TipTap, SWR)
  - Configured Docker Compose (PostgreSQL 15 + Redis 7 + services)
  - Created multi-stage Dockerfiles with health checks
  - Implemented Codespaces URL auto-detection utility
  - Created validation scripts and comprehensive .gitignore
  - Generated detailed completion report

**Key Decisions**:
- **Development Environment**: GitHub Codespaces (cloud-based, web-based workflow)
- **URL Strategy**: Keep localhost in secrets, implement auto-detection for Codespaces
- **Phase 0 Prerequisites**: Already met (Docker, Node.js pre-installed in Codespaces)

---

## GitHub Codespaces Configuration Notes

### Environment Variables Strategy

**Current Setup (Phase 0-1)**:
All secrets configured in GitHub Codespaces Secrets at:
`https://github.com/WCCollier/AECMS/settings/secrets/codespaces`

**Required Secrets (Configured)**:
```
DB_PASSWORD         = [generated with openssl rand -base64 32]
JWT_SECRET          = [generated with openssl rand -base64 32]
JWT_EXPIRATION      = 15m
REFRESH_TOKEN_EXPIRATION = 7d
NODE_ENV            = development
APP_URL             = http://localhost:3000
API_URL             = http://localhost:4000
FRONTEND_URL        = http://localhost:3000
FRONTEND_ADMIN_URL  = http://localhost:3000/admin
REDIS_URL           = redis://redis:6379
```

**Placeholder Secrets (For Future Phases)**:
- OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_CLIENT_ID, APPLE_CLIENT_SECRET
- Payments: STRIPE_*, PAYPAL_*, AMAZON_PAY_*
- AI: OPENAI_API_KEY
- Email: AWS_SES_*

### URL Handling in Codespaces

**Challenge**: Codespaces generates dynamic URLs like:
- Frontend: `https://[codespace-name]-3000.app.github.dev`
- Backend: `https://[codespace-name]-4000.app.github.dev`

**Solution**: Auto-detection pattern implemented in Phase 0:
```typescript
// backend/src/config/environment.ts
export function getPublicUrl(defaultUrl: string, port: number): string {
  if (process.env.CODESPACES === 'true') {
    const codespace = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    return `https://${codespace}-${port}.${domain}`;
  }
  return defaultUrl;
}
```

**Benefits**:
- Works in any codespace (handles dynamic names)
- Falls back to localhost for local development
- No secret updates needed between environments
- Ready for OAuth callbacks in Phase 1

### Codespaces-Specific Environment Variables (Auto-provided)

GitHub Codespaces automatically provides:
```bash
CODESPACES=true
CODESPACE_NAME=[unique-name-hash]
GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=app.github.dev
```

These are used for auto-detection and URL construction.

---

## Resume Instructions for New Claude Instance

### Quick Start (If Resuming After Environment Migration)

1. **Verify Codespaces Secrets Still Loaded**:
   ```bash
   env | grep -E '(DB_PASSWORD|JWT_SECRET|NODE_ENV)' | cut -d= -f1 | sort
   ```
   Expected: 10+ environment variables listed

2. **Check Project Status**:
   ```bash
   cd /workspaces/AECMS
   ls -la
   # Look for: backend/, frontend/, docker-compose.yml
   ```

3. **Determine Current Phase**:
   - If `backend/` and `frontend/` exist → Phase 0 complete, check Phase 1 status
   - If only `docs/` exists → Phase 0 needs to run
   - Check `docker-compose ps` to see if services are running

4. **Review Recent Git Commits**:
   ```bash
   git log --oneline -10
   ```
   This shows what's been completed

5. **Read Session History** (above) to understand decisions made

6. **Ask Claude**: "What phase are we on and what's the next step?"

### Critical Context for New Claude Instance

- **Development Environment**: GitHub Codespaces (NOT local development)
- **All Secrets**: Configured in GitHub Codespaces Secrets (NOT .env files)
- **URL Strategy**: Auto-detection implemented (keeps localhost in secrets)
- **Docker**: Pre-installed in Codespaces (no Docker Desktop needed)
- **Implementation Plan**: Located at `/workspaces/AECMS/docs/IMPLEMENTATION_PLAN.md`
- **PRD Documentation**: Located at `/workspaces/AECMS/docs/prd/` (12 documents)

### If Services Are Running

```bash
# Check running containers
docker-compose ps

# View logs
docker-compose logs -f

# Access services (Codespaces will show forwarded URLs in Ports tab)
# Or use: gh codespace ports
```

### If Starting Fresh After Migration

1. All GitHub Codespaces Secrets persist (no need to reconfigure)
2. Clone repo in new codespace (secrets auto-inject)
3. Continue from wherever git history shows you left off
4. Claude can run validation scripts to verify phase completion

---

## Current Project Status

**Phase**: Phase 0 - Project Foundation
**Status**: ✅ COMPLETE (Awaiting Human Verification)
**Completed**: 2026-01-29 11:56 UTC
**Duration**: ~15 minutes (autonomous)

**Phase 0 Deliverables**:
- ✅ 0.1 Project structure (backend/, frontend/, scripts/)
- ✅ 0.2 Docker Compose configuration (PostgreSQL, Redis, services)
- ✅ 0.3 Backend initialization (NestJS with 45+ dependencies)
- ✅ 0.4 Frontend initialization (Next.js 16 with 65+ dependencies)
- ✅ 0.5 Dockerfiles (multi-stage builds for backend and frontend)
- ✅ 0.6 Validation scripts (automated testing and health checks)
- ✅ 0.7 Codespaces URL auto-detection utility
- ✅ 0.8 Comprehensive completion report generated

**What Was Built**:
- Complete NestJS backend with Prisma, JWT, Passport, Redis, Bull
- Complete Next.js 14 frontend with Tailwind, Radix UI, TipTap, SWR
- Docker Compose with PostgreSQL 15 + Redis 7 + multi-stage builds
- Codespaces URL auto-detection (seamless local/cloud development)
- Validation scripts and comprehensive .gitignore
- 45 backend packages + 65 frontend packages installed
- TypeScript strict mode configured throughout

**Human Verification Required**:
See `PHASE_0_COMPLETION_REPORT.md` for detailed checklist:
- [ ] Review completion report
- [ ] Start services: `docker-compose up -d`
- [ ] Verify health: `docker-compose ps`
- [ ] Test forwarded URLs (Ports tab in VS Code)
- [ ] Approve Phase 1 start

---

**Last Updated**: 2026-01-29
**Current Session**: codespaces-setup-phase0-start
**Previous Session**: aecms-prd-planning
**Next Milestone**: Phase 0 Complete → Phase 1 Database Schema & Authentication
