# PRD 04: Technical Architecture

**Version:** 1.1
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the technical architecture, system design, infrastructure, and development practices for AECMS.

## Architecture Philosophy

### Core Principles
1. **Separation of Concerns**: Clear boundaries between frontend, backend, and data layers
2. **Scalability**: Horizontal scaling capability for growing traffic
3. **Maintainability**: Clean code, modular design, comprehensive documentation
4. **Performance**: Optimized for speed without sacrificing functionality
5. **Security**: Security-first approach at every layer
6. **Developer Experience**: Easy to set up, develop, and deploy

### Architecture Pattern
**Monolithic with Service-Oriented Structure**

For MVP and early growth, a well-structured monolith provides:
- Simpler deployment and operations
- Easier debugging and testing
- Lower infrastructure costs
- Faster development velocity

**Future Migration Path**: Design services with clear boundaries to enable microservices extraction if needed.

## Technology Stack

### Backend

#### Runtime & Framework
- **Node.js** (v20 LTS or later)
- **NestJS** (v10+)
  - TypeScript-first framework
  - Modular architecture with dependency injection
  - Built-in support for GraphQL, WebSockets, microservices
  - Extensive middleware ecosystem
  - Excellent testing support

#### Database
- **PostgreSQL** (v15+)
  - Primary relational database
  - JSONB for flexible content fields
  - Full-text search capabilities
  - Robust transaction support
  - Excellent performance and reliability

#### ORM/Database Client
- **Prisma**
  - Type-safe database client
  - Automatic migrations
  - Excellent developer experience
  - Auto-generated types
  - Query optimization

#### Caching
- **Redis** (v7+)
  - Session storage
  - Content caching
  - Rate limiting
  - Job queues (with BullMQ)

#### File Storage
- **Local Filesystem** (development)
- **AWS S3** or **compatible storage** (production)
  - Scalable object storage
  - CDN integration
  - Automatic backups

### Frontend

#### Framework
- **Next.js** (v14+ with App Router)
  - React-based framework
  - Server-side rendering (SSR)
  - Static site generation (SSG)
  - API routes
  - Built-in optimization
  - Image optimization
  - Font optimization

#### Language
- **TypeScript**
  - Type safety
  - Better IDE support
  - Fewer runtime errors

#### Styling
- **Tailwind CSS**
  - Utility-first CSS
  - Highly customizable
  - Excellent performance
  - Built-in responsive design
  - Dark mode support

#### UI Components
- **Radix UI** or **Headless UI**
  - Unstyled, accessible components
  - Full keyboard navigation
  - ARIA compliance
  - Composable primitives

#### Rich Text Editor
- **TipTap**
  - Modern, extensible editor
  - Built on ProseMirror
  - React components
  - Collaborative editing support (future)

#### State Management
- **React Context** + **SWR** or **TanStack Query**
  - Server state management
  - Automatic caching
  - Optimistic updates
  - Request deduplication

#### Forms
- **React Hook Form**
  - Performance-focused
  - Minimal re-renders
  - Built-in validation
  - Easy integration with UI libraries

### Authentication & Authorization

#### Strategy
- **JWT (JSON Web Tokens)** for stateless authentication
- **Refresh tokens** stored in httpOnly cookies
- **Access tokens** short-lived (15 minutes)
- **Refresh token rotation** for security

#### Implementation
- **Passport.js** with NestJS
  - Local strategy (username/password)
  - JWT strategy
  - OAuth strategies (future: Google, GitHub)

#### Authorization
- **RBAC (Role-Based Access Control)**
  - Roles: Super Admin, Admin, Editor, Customer
  - Permissions: Granular access control
  - Resource-based permissions

### Payment Integration

#### Primary: Stripe
- **stripe** npm package (backend)
- **@stripe/stripe-js** + **@stripe/react-stripe-js** (frontend)
- Stripe Elements for card inputs
- Payment Intents API
- Webhook handling

#### Secondary: PayPal
- **@paypal/checkout-server-sdk** (backend)
- PayPal JavaScript SDK (frontend)

### Email Service

#### Options
1. **SendGrid** (recommended for scale)
2. **AWS SES** (cost-effective)
3. **Mailgun**
4. **Postmark** (great for transactional)

#### Email Types
- Order confirmations
- Password resets
- Account notifications
- Marketing emails (future)

### DevOps & Infrastructure

#### Version Control
- **Git** with **GitHub**
- Branch strategy: main, develop, feature/*
- Pull request workflow
- Required code reviews

#### CI/CD
- **GitHub Actions**
  - Automated testing on PR
  - Linting and type checking
  - Build validation
  - Automated deployment

#### Hosting Options

**Option 1: Vercel (Recommended for Next.js)**
- Pros: Excellent Next.js integration, automatic scaling, global CDN
- Cons: Can be expensive at scale, vendor lock-in
- Best for: MVP and early growth

**Option 2: AWS**
- Frontend: CloudFront + S3 or Amplify
- Backend: ECS Fargate or EKS
- Database: RDS PostgreSQL
- Pros: Full control, predictable pricing at scale
- Cons: More complex setup and management

**Option 3: DigitalOcean**
- App Platform for Next.js
- Managed PostgreSQL
- Managed Redis
- Pros: Simple, affordable, good balance
- Cons: Less feature-rich than AWS

**Recommendation**: Start with Vercel for frontend + DigitalOcean for backend/database

#### Monitoring & Logging

**Application Monitoring:**
- **Sentry** for error tracking
- **LogRocket** or **FullStory** for session replay (optional)

**Infrastructure Monitoring:**
- **Prometheus** + **Grafana** (self-hosted)
- **Datadog** (managed service)
- **New Relic** (APM)

**Logging:**
- **Winston** (Node.js logging)
- Centralized logging: **Logtail**, **Papertrail**, or **CloudWatch**

#### Performance Monitoring
- **Core Web Vitals** tracking
- **Lighthouse CI** in pipeline
- **Vercel Analytics** or **Google Analytics 4**

## System Architecture

### High-Level Architecture

```
                         Internet
                            │
                            │
                   ┌────────▼────────┐
                   │   CDN/WAF       │
                   │  (Cloudflare)   │
                   └────────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
       ┌──────▼──────┐           ┌───────▼────────┐
       │   Frontend  │           │    Backend     │
       │  (Next.js)  │◄─────────►│   (NestJS)     │
       │   Vercel    │   API     │  DigitalOcean  │
       └─────────────┘           └────────┬───────┘
                                          │
                    ┌─────────────────────┼──────────────┐
                    │                     │              │
             ┌──────▼──────┐       ┌──────▼──────┐  ┌───▼───┐
             │  PostgreSQL │       │    Redis    │  │  S3   │
             │     RDS     │       │    Cache    │  │ Media │
             └─────────────┘       └─────────────┘  └───────┘
                                          │
                                   ┌──────▼──────┐
                                   │   BullMQ    │
                                   │  Job Queue  │
                                   └─────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────┐
│                   API Gateway                        │
│              (Authentication, Rate Limiting)         │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼────┐  ┌────▼─────┐  ┌──▼──────┐
│  Content   │  │   User   │  │Commerce │
│  Module    │  │  Module  │  │ Module  │
└──────┬─────┘  └────┬─────┘  └──┬──────┘
       │             │           │
       │   ┌─────────▼───────────┤
       │   │                     │
┌──────▼───▼──────┐    ┌─────────▼────────┐
│   Shared Libs   │    │  External APIs   │
│  (Utils, Auth)  │    │  (Stripe, AWS)   │
└─────────────────┘    └──────────────────┘
```

### Module Structure (NestJS)

```
src/
├── modules/
│   ├── auth/              # Authentication & authorization
│   ├── users/             # User management
│   ├── content/           # Articles, pages, media
│   │   ├── articles/
│   │   ├── pages/
│   │   ├── media/
│   │   ├── categories/
│   │   └── tags/
│   ├── commerce/          # Ecommerce functionality
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/
│   │   └── payments/
│   └── settings/          # System settings
├── common/                # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/                # Configuration
├── database/              # Database setup & migrations
└── main.ts               # Application entry point
```

### Frontend Structure (Next.js)

```
src/
├── app/                   # Next.js 14 App Router
│   ├── (public)/         # Public pages (articles, products)
│   ├── (admin)/          # Admin dashboard
│   ├── api/              # API routes (if needed)
│   └── layout.tsx        # Root layout
├── components/
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Layout components
│   ├── forms/            # Form components
│   └── admin/            # Admin-specific components
├── lib/
│   ├── api/              # API client functions
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── validations/      # Form validations
├── types/                # TypeScript types
└── styles/               # Global styles
```

## Data Architecture

### Database Design Principles

1. **Normalization**: Minimize data redundancy (3NF target)
2. **Indexing**: Strategic indexes on frequently queried columns
3. **JSONB Usage**: Flexible content fields (article content, product attributes)
4. **Soft Deletes**: Preserve data integrity with deleted_at timestamps
5. **UUID Primary Keys**: Enable distributed systems and avoid sequential ID exposure
6. **Timestamps**: created_at, updated_at on all tables

### Product vs Article Taxonomy

**Architectural Decision**: Products and Articles are **separate but parallel entities** with a **dual-nature design** for products.

#### Rationale

**Why NOT make Product a subset of Article:**
1. **Different Core Purposes**:
   - Articles: Content/information delivery (blogs, guides, news)
   - Products: Transactional commerce (buy, sell, inventory)

2. **Different Query Patterns**:
   - Articles: Full-text search, category browsing, date-based
   - Products: Price filtering, stock availability, cart operations

3. **Different Evolution Paths**:
   - Articles may add: revisions, co-authors, scheduled publishing
   - Products may add: variants (size/color), subscriptions, bundles, inventory tracking

4. **Cleaner Schema**:
   - Avoids nullable commerce fields on articles
   - Avoids content-heavy fields on simple products
   - Each entity optimized for its purpose

#### Product Dual-Nature Design

Products have two conceptual aspects unified in a single table:

**1. Content/Display Aspect** (front-end facing):
- `name`, `slug`, `description` (rich text with Markdown)
- `short_description` (for listings)
- `featured_image`, `image_gallery`
- `seo_title`, `seo_description`
- `visibility`, `comment_visibility`
- `average_rating`, `review_count`
- Published/unpublished status

**2. Commerce/Transaction Aspect** (back-end operations):
- `sku`, `barcode`
- `regular_price`, `sale_price`
- `stock_quantity`, `stock_status`
- `guest_purchaseable`
- `weight`, `dimensions` (for shipping)
- `tax_class`, `shipping_class`

#### Schema Structure

```typescript
// Separate entities sharing common traits
model Article {
  id                  String    @id @default(uuid())
  title               String
  slug                String    @unique
  content             String    // Rich text HTML or Markdown
  excerpt             String?
  visibility          Visibility
  comment_visibility  CommentVisibility
  author_id           String
  published_at        DateTime?
  // ... content-specific fields
}

model Product {
  id                  String    @id @default(uuid())
  name                String
  slug                String    @unique
  description         String    // Rich text HTML or Markdown
  short_description   String?
  visibility          Visibility
  comment_visibility  CommentVisibility
  guest_purchaseable  Boolean

  // Commerce fields (in same table for simplicity)
  sku                 String    @unique
  regular_price       Decimal
  sale_price          Decimal?
  stock_quantity      Int
  stock_status        StockStatus
  average_rating      Decimal?
  review_count        Int       @default(0)
  // ... commerce-specific fields

  // Relationships
  categories          ProductCategory[]
  reviews             Comment[]
  order_items         OrderItem[]
}
```

#### Shared Traits via Relationships

Both Articles and Products share:
- **Comments** (polymorphic): `article_id` or `product_id`
- **Media** (via junction tables): Many-to-many with media library
- **Visibility controls**: Same enum values
- **SEO fields**: Meta title, description, Open Graph

#### Benefits of This Approach

1. **Single Product Table** (MVP): Simple, performant, easy to query
2. **Clear Separation**: No confusion about what's content vs commerce
3. **Independent Scaling**: Can optimize each entity separately
4. **Shared Systems**: Comments, media, visibility work identically
5. **Future Flexibility**: Can split Product into `product_content` + `product_commerce` tables if commerce complexity grows (variants, bundles, subscriptions)

#### Migration Path (Future)

If commerce becomes complex (product variants, bundles, subscriptions):

```typescript
// Phase 2: Split into separate tables if needed
model ProductContent {
  id                  String    @id @default(uuid())
  name                String
  slug                String
  description         String
  visibility          Visibility
  // ... display fields
}

model ProductCommerce {
  id                  String    @id @default(uuid())
  content_id          String    @unique
  content             ProductContent
  sku                 String
  price               Decimal
  stock_quantity      Int
  // ... commerce fields
}
```

But for MVP, unified Product table is cleanest.

### Key Relationships

```
users ──1:N──> articles
users ──1:N──> media
articles ──N:M──> categories (junction: article_categories)
articles ──N:M──> tags (junction: article_tags)
products ──N:M──> product_categories
orders ──1:N──> order_items
orders ──N:1──> users (nullable for guest orders)
```

### Caching Strategy

#### What to Cache
- **Published articles**: 1 hour TTL
- **Product catalog**: 15 minutes TTL
- **Categories/tags**: 6 hours TTL
- **User sessions**: Session duration
- **API rate limiting**: Per-user, per-endpoint

#### Cache Invalidation
- **Time-based**: Automatic expiration with TTL
- **Event-based**: Invalidate on create/update/delete
- **Manual**: Admin "Clear Cache" button

#### Cache Keys Pattern
```
cms:article:{id}
cms:articles:list:{page}:{filters}
cms:product:{id}
cms:categories:tree
```

## API Design

### REST API Principles

1. **Resource-Oriented**: URLs represent resources
2. **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
3. **Status Codes**: Proper use of 2xx, 4xx, 5xx
4. **Versioning**: `/api/v1/` prefix
5. **Pagination**: Cursor or offset-based
6. **Filtering**: Query parameters for filtering/sorting
7. **Authentication**: Bearer token in Authorization header

### API Response Format

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Article Title",
    ...
  },
  "meta": {
    "timestamp": "2026-01-27T12:00:00Z"
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-01-27T12:00:00Z"
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Performance Optimization

### Backend Optimization
- **Database query optimization**: Use Prisma's query optimization
- **Eager loading**: Prevent N+1 queries
- **Connection pooling**: Optimize database connections
- **API response compression**: gzip/brotli
- **Rate limiting**: Prevent abuse

### Frontend Optimization
- **Code splitting**: Dynamic imports for routes
- **Image optimization**: Next.js Image component
- **Font optimization**: Next.js Font optimization
- **Lazy loading**: Defer non-critical components
- **Bundle analysis**: Monitor and optimize bundle size
- **Prefetching**: Prefetch critical resources

### Caching Layers
1. **Browser Cache**: Static assets (images, CSS, JS)
2. **CDN Cache**: Edge caching for global performance
3. **Application Cache**: Redis for frequently accessed data
4. **Database Cache**: PostgreSQL query cache

## Security Architecture

See [PRD 05: Security & Compliance](./05-security.md) for detailed security specifications.

### Security Layers

1. **Network Layer**: CDN with WAF (Cloudflare)
2. **Application Layer**: Input validation, authentication, authorization
3. **Data Layer**: Encryption at rest and in transit
4. **Payment Layer**: Stripe/PayPal PCI compliance

## Testing Strategy

### Backend Testing

**Unit Tests**
- Service logic
- Utility functions
- Validators
- Tool: Jest

**Integration Tests**
- API endpoints
- Database operations
- External service mocks
- Tool: Jest + Supertest

**E2E Tests**
- Critical user flows
- Tool: Playwright

**Target Coverage**: 80%

### Frontend Testing

**Unit Tests**
- Component logic
- Utility functions
- Tool: Jest + React Testing Library

**Integration Tests**
- Component interactions
- Form submissions
- Tool: React Testing Library

**E2E Tests**
- User workflows (checkout, content creation)
- Tool: Playwright

**Visual Regression**
- UI consistency
- Tool: Chromatic or Percy

**Target Coverage**: 70%

## Deployment Strategy

### Environments

1. **Development**: Local development
2. **Staging**: Pre-production testing
3. **Production**: Live environment

### Deployment Pipeline

```
Code Push → GitHub
    ↓
GitHub Actions
    ├─ Lint & Type Check
    ├─ Run Tests
    ├─ Build Application
    └─ Security Scan
    ↓
Deploy to Staging
    ↓
Manual Approval
    ↓
Deploy to Production
    ↓
Health Check
    ↓
Monitor & Alert
```

### Database Migrations

- **Prisma Migrate** for schema changes
- Applied automatically in deployment
- Rollback plan for each migration
- Test migrations on staging first

### Rollback Strategy

- Keep previous deployment artifacts
- Database migration rollback scripts
- Feature flags for gradual rollouts
- Blue-green deployment for zero downtime

## Scalability Plan

### Phase 1: Single Server (0-10k users)
- Single backend instance
- Single database instance
- Redis on same server
- Suitable for MVP

### Phase 2: Horizontal Scaling (10k-100k users)
- Multiple backend instances with load balancer
- Database connection pooling
- Separate Redis instance
- CDN for static assets

### Phase 3: Distributed Architecture (100k+ users)
- Auto-scaling backend instances
- Read replicas for database
- Redis cluster
- Separate job queue workers
- Full-text search with Elasticsearch

## Documentation Requirements

### Code Documentation
- JSDoc comments for public APIs
- README for each module
- Architecture Decision Records (ADRs)

### API Documentation
- OpenAPI/Swagger specification
- Auto-generated from code
- Postman collection

### User Documentation
- Admin user guide
- Developer setup guide
- Deployment guide

## Development Workflow

### Local Development Setup

```bash
# Backend
git clone <repo>
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

### Code Quality Tools

- **ESLint**: Linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting
- **commitlint**: Commit message convention

### Git Workflow

1. Create feature branch from `develop`
2. Develop and commit with conventional commits
3. Push and create pull request
4. CI checks pass
5. Code review and approval
6. Merge to `develop`
7. Release: Merge `develop` to `main`

## Dependencies & Third-Party Services

### Critical Dependencies
- Node.js runtime
- PostgreSQL database
- Redis cache
- S3-compatible storage
- Stripe API
- Email service

### Monitoring Dependencies
- Sentry for error tracking
- Analytics platform
- Uptime monitoring

## Open Questions & Answers

### Answered Questions ✅

1. ~~Should we use GraphQL instead of REST for more flexible queries?~~ → **REST** - Small app, keep it simple. REST is sufficient for query needs.

2. ~~Do we need real-time features (WebSockets) for admin dashboard?~~ → **NO WebSockets/real-time needed** - Low traffic site doesn't require real-time updates. However, **entity locking required** for concurrent editing (see [Entity Locking](#entity-locking-for-concurrent-editing) section below).

3. ~~Should we implement server-side rendering for all pages or use static generation where possible?~~ → **Server-Side Rendering (SSR)** - Traffic is low, no need to add complexity with ISR or heavy client-side rendering.

4. ~~Do we need multi-tenancy support from the start?~~ → **NO - Single-tenant only** (see Master PRD). Each deployment of AECMS implements a single website. No multi-tenancy support needed or planned.

5. ~~Should we use a message queue for async tasks?~~ → **YES - Use Bull/BullMQ (Redis-based)** (see [Message Queue Strategy](#message-queue-strategy) section below).

## Entity Locking for Concurrent Editing

### Problem

When multiple users (Admins/Owners) edit the same entity simultaneously, changes can conflict and overwrite each other, causing data loss.

### Solution: Optimistic Locking with Edit Session Tracking

**Approach**: Track active edit sessions and warn users if entity is being edited, but allow override if needed.

### Edit Session Tracking

**When user starts editing** (clicks "Edit" button):

1. Check if entity has active edit session
2. If locked by another user:
   - Show warning: "User X is currently editing this. Continue anyway?"
   - User can proceed (override) or cancel
3. Create edit session record:
   - Entity type and ID
   - User ID
   - Session start time
   - Last activity time (heartbeat)
4. Return entity data with current version number

**While editing** (heartbeat):

- Frontend sends heartbeat every 30 seconds
- Backend updates `last_activity` timestamp
- Keeps session alive

**Edit session timeout**:

- Sessions expire after **5 minutes of inactivity**
- Automatic cleanup via background job
- If user returns after timeout, check if entity was modified

**On save**:

1. Check entity version number (optimistic locking)
2. If version changed:
   - Show warning: "This entity was modified by User X at [time]. Your changes may conflict."
   - Options:
     - View current version
     - Overwrite anyway (dangerous)
     - Save as draft (if applicable)
     - Cancel and reload
3. If version unchanged:
   - Save changes
   - Increment version number
   - Delete edit session
4. Release lock

**On cancel/navigate away**:

- Delete edit session
- Release lock

### Database Schema

```typescript
model EditSession {
  id              String   @id @default(uuid())
  entity_type     String   // 'article', 'page', 'product', 'user'
  entity_id       String
  user_id         String
  user            User     @relation(fields: [user_id])
  started_at      DateTime @default(now())
  last_activity   DateTime @default(now())

  @@unique([entity_type, entity_id]) // Only one active session per entity
  @@index([entity_type, entity_id])
  @@index([last_activity]) // For cleanup query
}

// Add version field to entities
model Article {
  // ... existing fields
  version         Int      @default(1) // Incremented on each save
}

model Page {
  // ... existing fields
  version         Int      @default(1)
}

model Product {
  // ... existing fields
  version         Int      @default(1)
}
```

### Implementation Details

See full implementation examples in the code blocks above, including:
- API endpoints for session management
- Optimistic locking on save
- Background cleanup job for expired sessions
- Frontend React hooks for session management
- Local storage caching for draft recovery

### Edit Session Timeout & Recovery

**Scenario**: User starts editing, closes browser/tab, returns later.

**Solution**: Cache draft in browser localStorage

- Before unload, save current form state to localStorage
- On return, check for cached draft
- If entity version unchanged: restore draft
- If entity version changed: warn user and offer options

## Message Queue Strategy

### Overview

Use **Bull/BullMQ** (Redis-based message queue) for asynchronous background tasks.

### Why Message Queues?

**Problem**: Some operations are slow and shouldn't block HTTP requests:
- Email sending (SMTP can be slow, can fail and need retries)
- Image processing (thumbnails, compression, optimization)
- eBook personalization (EPUB modification, CPU intensive)
- Send to Kindle (external SMTP, can be slow)
- CSV report generation (large datasets)
- AI comment moderation (OpenAI API calls)

**Solution**: Put tasks in a queue, return immediately to user, process in background.

### Technology Choice: Bull/BullMQ ✅ **CONFIRMED**

**Why Bull/BullMQ**:
- ✅ Already using Redis for caching/sessions (no new infrastructure)
- ✅ Very lightweight (just npm install)
- ✅ Automatic retries with exponential backoff
- ✅ Built-in monitoring dashboard
- ✅ Perfect for low-traffic sites
- ✅ Industry standard for Node.js
- ✅ **Cost: $0** (uses existing Redis)

**Alternatives Considered**:

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Bull/BullMQ** | Lightweight, uses existing Redis, retries | Requires Redis | ✅ **CHOSEN** |
| Simple async functions | No dependencies | No retries, no monitoring | ❌ Too basic |
| RabbitMQ | Very robust, feature-rich | Separate service, overkill for MVP | ❌ Too heavy |
| AWS SQS | Managed, scalable | Vendor lock-in, costs money | ❌ Against project goals |
| PostgreSQL-based queue | No new service | Not ideal for high-volume | ⚠️ Backup option |

### Queue Types

**1. Email Queue** (High Priority)
- Order confirmations
- Password resets
- Email verification
- Admin notifications
- **Retry**: 3 attempts with exponential backoff (2s, 4s, 8s)

**2. Media Processing Queue** (Medium Priority)
- Image optimization
- Thumbnail generation
- Video processing (future)
- **Retry**: 2 attempts

**3. eBook Queue** (Medium Priority)
- EPUB personalization (can take 10-30 seconds)
- Send to Kindle
- **Retry**: 3 attempts

**4. Reports Queue** (Low Priority)
- CSV generation
- Analytics reports
- **Retry**: None (user can re-generate)

**5. Moderation Queue** (Low Priority)
- AI comment moderation (OpenAI API)
- **Retry**: 2 attempts

### Implementation Example

```typescript
// queue/index.ts
import Bull from 'bull'

export const emailQueue = new Bull('emails', {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
})

// Adding jobs (non-blocking)
@Post('/api/checkout/complete')
async completeOrder(@Body() orderData: OrderDto) {
  const order = await this.ordersService.create(orderData)

  // Queue email (returns immediately)
  await emailQueue.add('order-confirmation', {
    email: order.customer_email,
    orderId: order.id
  })

  return { success: true, orderId: order.id }
}

// Worker processes jobs in background
emailQueue.process('order-confirmation', async (job) => {
  const { email, orderId } = job.data
  await sendOrderConfirmationEmail(email, orderId)
})
```

### Monitoring Dashboard

Bull provides a web UI for monitoring:

```typescript
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(mediaQueue),
    new BullAdapter(ebookQueue)
  ],
  serverAdapter
})

app.use('/admin/queues', serverAdapter.getRouter())
// Access at: https://yourdomain.com/admin/queues (Owner only)
```

Dashboard shows:
- Active, waiting, completed, failed jobs
- Job details and retry history
- Performance metrics
- Manual job retry/deletion

### Performance

- **Cost**: $0 (uses existing Redis)
- **Throughput**: 1000+ jobs/minute
- **Overhead**: <10ms to add job to queue
- **Perfect** for low-traffic sites

## Success Metrics

### Performance Metrics
- API response time (p95) < 300ms
- Page load time (p75) < 2 seconds
- Time to first byte (TTFB) < 500ms
- Core Web Vitals: All "Good"

### Reliability Metrics
- Uptime: 99.9%
- Error rate < 0.1%
- Database connection success rate > 99.9%

### Scalability Metrics
- Support 10,000 concurrent users
- Handle 1,000 requests/second
- Database query time < 100ms (p95)
