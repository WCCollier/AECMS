# PRD 07: MVP Scope & Priorities

**Version:** 1.0
**Date:** 2026-01-27
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the Minimum Viable Product (MVP) scope for AECMS based on stakeholder requirements. The MVP focuses on essential features for a personal CMS with ecommerce, optimized for free-tier hosting.

## Project Context

### Key Constraints
- **Traffic**: Very low (few hits per month)
- **Budget**: Free tier hosting and services
- **Timeline**: No rush, quality over speed
- **Portability**: Must be easily deployable by friends
- **Migration**: WordPress.org content to migrate

### User Base
- Primary: Single site owner/administrator
- Secondary: Friends running their own instances
- Tertiary: Site visitors and customers

## MVP Must-Have Features

### 1. Authentication & Authorization

**Social Sign-On (OAuth)**:
- ✅ Google Sign-In
- ✅ Apple Sign-In
- ✅ Email/Password (fallback)

**User Roles**:
- Admin (full access)
- Customer (view public content, make purchases)

**Security**:
- JWT-based authentication
- Secure password storage (bcrypt)
- Session management

### 2. Content Management (Articles)

**Article Features**:
- ✅ Create, edit, delete articles
- ✅ Rich text editor (TipTap)
- ✅ Featured images
- ✅ Categories (hierarchical)
- ✅ Tags (flat)
- ✅ Draft/Published status
- ✅ SEO fields (meta title, description)
- ✅ Slug management

**Article Display**:
- Article list/archive pages
- Single article pages
- Category archive pages
- Tag archive pages
- Search functionality

### 3. Media Management

**Media Library**:
- ✅ Upload images (JPEG, PNG, WebP)
- ✅ Upload documents (PDF)
- ✅ Image metadata (alt text, caption)
- ✅ Media browser/selector
- ✅ Automatic image optimization
- ✅ Thumbnail generation

**Storage**:
- Local filesystem (MVP)
- S3-compatible support (future)

### 4. Shop/Ecommerce

**Product Management**:
- ✅ Create, edit, delete products
- ✅ Product title, description, price
- ✅ Product images (multiple)
- ✅ Product categories
- ✅ Stock tracking (simple in/out of stock)
- ✅ SKU field

**Shopping Experience**:
- ✅ Product catalog page
- ✅ Product detail page
- ✅ Add to cart
- ✅ Shopping cart page
- ✅ Checkout flow

**Payment Processing**:
- ✅ Stripe integration (credit/debit cards)
- ✅ PayPal integration
- ✅ Order confirmation email
- ✅ Basic order management (admin)

**Product Embedding**:
- ✅ Embed products in articles (shortcode or component)
- ✅ Embed products in pages
- ✅ Product showcase widgets

### 5. Page & Layout System

**Page Management**:
- ✅ Create, edit, delete pages
- ✅ Page hierarchy (parent/child)
- ✅ Custom slugs
- ✅ Rich text content

**Display Infrastructure**:
- ✅ **Main Pane**: Primary content area
- ✅ **Sidebar**: Side content area (widgets)
- ✅ **Simple Tiling**: Grid layout for content/products
- ✅ **Carousels**: Sliding image/product carousels

**Widget/Pane Types**:
- Article list (latest, by category, by tag)
- Featured articles
- Product grid (latest, featured, by category)
- Product carousel
- Image gallery
- Custom HTML/text block
- Call-to-action block

**Layout System**:
- Template selection:
  - Full-width (1 column)
  - Sidebar layouts (left or right)
  - Split Comparison (full-screen 50/50 split, edge-to-edge)
  - Grid layouts
- Drag-and-drop widget placement (simple)
- Responsive by default

### 6. Admin Dashboard

**Dashboard Features**:
- Overview stats (articles, products, orders)
- Quick actions (new article, new product)
- Recent activity

**Admin Navigation**:
- Content (Articles, Pages, Media, Categories, Tags)
- Shop (Products, Orders, Categories)
- Users
- Settings

### 7. Site Settings

**General Settings**:
- Site title and tagline
- Logo upload
- Favicon upload
- Contact email
- Timezone

**Navigation Menus**:
- Primary navigation (header)
- Footer navigation
- Simple menu builder (drag-and-drop or list)

**Payment Settings**:
- Stripe API keys
- PayPal credentials

**OAuth Settings**:
- Google OAuth credentials
- Apple OAuth credentials

## MVP Nice-to-Have Features

### 1. Mobile Display Mode
**Status**: Should be standard (responsive design)
- Mobile-first CSS
- Touch-friendly interactions
- Hamburger menu on mobile
- Mobile-optimized checkout

**Note**: This should be part of core design, not an optional feature.

### 2. Visual Themes
**Status**: Future enhancement
- Theme selector in settings
- 2-3 pre-built themes (Light, Dark, Custom)
- Color scheme customization
- Typography options

**For MVP**: Single, clean, professional theme

## Explicitly Out of Scope (For MVP)

### Content Features
- ❌ Multi-language support
- ❌ Content versioning/revisions
- ❌ Workflow/approval system
- ❌ Commenting system
- ❌ Content scheduling (publish later)
- ❌ Content import/export (except WordPress migration script)

### Ecommerce Features
- ❌ Variable products (size, color variants)
- ❌ Digital/downloadable products
- ❌ Subscription products
- ❌ Coupon/discount codes
- ❌ Shipping calculation/zones
- ❌ Abandoned cart recovery
- ❌ Product reviews/ratings
- ❌ Inventory alerts
- ❌ Multi-currency support

### Advanced Features
- ❌ Email marketing integration
- ❌ Analytics dashboard (beyond basic stats)
- ❌ A/B testing
- ❌ Advanced SEO tools (sitemap/robots.txt are OK)
- ❌ Multi-user collaboration
- ❌ Custom user roles
- ❌ Activity logs/audit trail
- ❌ Two-factor authentication (MFA)

### Infrastructure
- ❌ Multi-tenancy
- ❌ White-label capability
- ❌ API rate limiting (beyond basic)
- ❌ GraphQL API (REST only)
- ❌ WebSocket/real-time features
- ❌ Advanced caching strategies
- ❌ CDN integration (beyond static hosting)

## Development Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Basic infrastructure and authentication

- [x] Project setup (NestJS backend, Next.js frontend)
- [ ] Docker Compose configuration
- [ ] Database schema design
- [ ] Authentication system (JWT)
- [ ] Google OAuth integration
- [ ] Apple OAuth integration
- [ ] User roles and permissions
- [ ] Admin dashboard shell

### Phase 2: Content Management (Weeks 4-6)
**Goal**: Articles and media working

- [ ] Article CRUD operations
- [ ] Rich text editor integration (TipTap)
- [ ] Media upload and management
- [ ] Category management
- [ ] Tag management
- [ ] Article list and detail pages (public)
- [ ] Search functionality
- [ ] SEO meta tags

### Phase 3: Ecommerce Core (Weeks 7-9)
**Goal**: Products and cart functional

- [ ] Product CRUD operations
- [ ] Product categories
- [ ] Shopping cart (session-based)
- [ ] Cart persistence (logged-in users)
- [ ] Product catalog page
- [ ] Product detail page
- [ ] Checkout flow (multi-step)

### Phase 4: Payment Integration (Weeks 10-11)
**Goal**: Stripe and PayPal working

- [ ] Stripe integration (Payment Intents)
- [ ] PayPal integration
- [ ] Order creation and management
- [ ] Order confirmation emails
- [ ] Admin order management
- [ ] Webhook handling (Stripe, PayPal)

### Phase 5: Layout & Display (Weeks 12-13)
**Goal**: Flexible page layouts and widgets

- [ ] Page management system
- [ ] Layout templates (main, sidebar, full-width)
- [ ] Widget/pane system architecture
- [ ] Article list widgets
- [ ] Product grid widgets
- [ ] Product carousel component
- [ ] Image gallery component
- [ ] Simple grid/tiling layouts
- [ ] Drag-and-drop widget placement

### Phase 6: Product Embedding (Week 14)
**Goal**: Products embeddable in content

- [ ] Product embed in articles (shortcode or component)
- [ ] Product embed in pages
- [ ] Product showcase widget
- [ ] Featured products widget

### Phase 7: Polish & Testing (Weeks 15-16)
**Goal**: Production-ready MVP

- [ ] Responsive design refinement
- [ ] Mobile testing and optimization
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation (user guide, setup guide)
- [ ] WordPress migration script
- [ ] Deployment documentation

### Phase 8: WordPress Migration (Week 17)
**Goal**: Import existing content

- [ ] WordPress database export
- [ ] Migration script (articles, media, categories)
- [ ] Data validation
- [ ] Media file migration
- [ ] URL redirect mapping (SEO)

**Estimated Total**: ~4 months (at moderate pace, no rush)

## Technical Specifications

### Database Schema (MVP)

**Core Tables**:
- users (id, email, name, password_hash, oauth_provider, role)
- articles (id, title, slug, content, excerpt, featured_image_id, author_id, status)
- pages (id, title, slug, content, template, parent_id)
- categories (id, name, slug, type [article/product], parent_id)
- tags (id, name, slug)
- media (id, filename, path, mime_type, size, alt_text)
- products (id, title, slug, description, price, stock_status, sku)
- orders (id, customer_id, total, status, stripe_payment_intent_id)
- order_items (id, order_id, product_id, quantity, price)
- carts (id, user_id, session_id, items [jsonb])
- settings (key, value)

**Junction Tables**:
- article_categories
- article_tags
- product_categories

### API Endpoints (MVP)

**Auth**:
- POST /auth/login (email/password)
- POST /auth/oauth/google
- POST /auth/oauth/apple
- POST /auth/refresh
- POST /auth/logout

**Articles**:
- GET /articles (public, paginated)
- GET /articles/:slug (public)
- POST /articles (admin)
- PUT /articles/:id (admin)
- DELETE /articles/:id (admin)

**Products**:
- GET /products (public)
- GET /products/:slug (public)
- POST /products (admin)
- PUT /products/:id (admin)
- DELETE /products/:id (admin)

**Cart**:
- GET /cart
- POST /cart/items
- PUT /cart/items/:id
- DELETE /cart/items/:id

**Checkout**:
- POST /checkout/payment-intent (Stripe)
- POST /checkout/paypal-order
- POST /checkout/complete

**Orders**:
- GET /orders (user: own, admin: all)
- GET /orders/:id
- PUT /orders/:id (admin)

**Media**:
- GET /media (admin)
- POST /media (admin, multipart)
- DELETE /media/:id (admin)

**Pages**:
- GET /pages (public)
- GET /pages/:slug (public)
- POST /pages (admin)
- PUT /pages/:id (admin)
- DELETE /pages/:id (admin)

### Frontend Routes

**Public**:
- / (homepage)
- /articles (article list)
- /articles/:slug (article detail)
- /category/:slug (category archive)
- /tag/:slug (tag archive)
- /shop (product catalog)
- /product/:slug (product detail)
- /cart (shopping cart)
- /checkout (checkout flow)
- /pages/:slug (custom pages)
- /search

**Admin**:
- /admin (dashboard)
- /admin/articles
- /admin/articles/new
- /admin/articles/:id/edit
- /admin/products
- /admin/products/new
- /admin/products/:id/edit
- /admin/orders
- /admin/pages
- /admin/media
- /admin/users
- /admin/settings

## Success Criteria

### Functional
- ✅ User can create and publish articles
- ✅ User can upload and manage media
- ✅ User can create and sell products
- ✅ Customer can browse and purchase products
- ✅ Payments process successfully (Stripe/PayPal)
- ✅ Products can be embedded in articles/pages
- ✅ Layouts support main pane, sidebar, tiles, carousels
- ✅ OAuth login works (Google/Apple)
- ✅ WordPress content migrated successfully

### Non-Functional
- ✅ Site loads in < 2 seconds
- ✅ Mobile-responsive across all pages
- ✅ Runs on free-tier hosting
- ✅ Zero payment security incidents
- ✅ Friends can deploy with documentation
- ✅ All data exportable (no vendor lock-in)

### Performance Targets (Free Tier Optimized)
- Database: < 500MB (stay under free tier limits)
- Media storage: < 5GB (optimize images)
- API response time: < 500ms (acceptable for low traffic)
- Page load: < 2s on 3G connection

## Post-MVP Enhancements (Future)

### Version 1.1
- Content scheduling (publish date)
- Product variants (size, color)
- Discount codes
- Basic analytics dashboard

### Version 1.2
- Visual theme selector
- Custom theme builder
- Advanced page builder (more widgets)
- Content revisions

### Version 1.3
- Email marketing integration (Mailchimp, SendGrid)
- Product reviews and ratings
- Abandoned cart emails
- Multi-language support

### Version 2.0
- Multi-tenancy support
- White-label capability
- Advanced ecommerce (shipping zones, tax calculation)
- Mobile app (React Native)

## Documentation Deliverables

### User Documentation
1. **User Guide**: How to use admin panel
2. **Content Guide**: Creating articles and pages
3. **Shop Guide**: Managing products and orders

### Developer Documentation
1. **Setup Guide**: Local development setup
2. **Deployment Guide**: Production deployment
3. **API Documentation**: REST API reference
4. **Architecture Docs**: System design and decisions

### Migration Documentation
1. **WordPress Migration**: Step-by-step guide
2. **Data Export**: How to backup/export data
3. **Hosting Migration**: Moving between hosts

## Open Questions

1. Should we include a demo/seeded data for new installations?
2. Do you want product inventory management in MVP (or just in/out of stock)?
3. Should order emails include PDF invoice?
4. Do you need tax calculation (simple percentage or Stripe Tax)?
5. Should we include basic site analytics (page views, popular articles) in MVP?

## Approval

This MVP scope requires stakeholder approval before development begins.

**Approved by**: ___________________
**Date**: ___________________
