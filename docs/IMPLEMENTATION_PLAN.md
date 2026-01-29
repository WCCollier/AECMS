# AECMS Implementation Plan

**Version:** 2.0
**Date:** 2026-01-29
**Status:** Implementation Roadmap
**Optimized for:** Agentic coding via Claude Code with clear human/AI role division

## Overview

This document provides a comprehensive phased development plan for AECMS, optimized for implementation by Claude Code with **explicit markers** for what can be done autonomously vs what requires human intervention.

## Role Legend

Throughout this document, tasks are marked with the following prefixes:

- **🤖 [AUTONOMOUS]** - Claude Code can complete this task fully without human intervention
- **👤 [HUMAN REQUIRED]** - Requires human action (account creation, API keys, payment setup, etc.)
- **🤝 [HUMAN DECISION]** - Requires human choice, approval, or configuration preference
- **👁️ [HUMAN VERIFICATION]** - Claude can automate, but human should verify/test (especially UX, payment flows)

## Guiding Principles

1. **Incremental Development**: Each phase produces working, testable functionality
2. **Test-Driven**: Write tests before or alongside implementation
3. **Automated Validation**: Maximize what Claude Code can validate automatically
4. **Clear Dependencies**: Each phase builds on previous phases
5. **Database-First**: Define schema early, migrate incrementally
6. **API-First**: Backend APIs before frontend UI
7. **Security from Start**: Authentication and authorization in Phase 1
8. **Human-in-the-Loop**: Critical paths (payments, auth, security) require human verification

## Technology Stack

**Backend:**
- NestJS (Node.js + TypeScript)
- PostgreSQL 15+ (via Prisma ORM)
- Redis (caching + Bull/BullMQ message queue)
- Docker Compose

**Frontend:**
- Next.js 14+ (App Router)
- Tailwind CSS
- Radix UI / Headless UI
- TipTap (rich text editor)
- SWR or TanStack Query

**Testing:**
- Jest (unit tests)
- Supertest (API integration tests)
- Playwright (E2E tests)
- Prisma Test Environment (isolated DB per test suite)

**Development Tools:**
- TypeScript strict mode
- ESLint + Prettier
- Husky (git hooks)
- GitHub Actions (CI/CD)

---

## Phase 0: Project Foundation (Week 1)

### 👤 [HUMAN REQUIRED] Prerequisites Setup

Before Claude Code can begin development, you need to:

1. **Install Docker Desktop** (if not already installed)
   - macOS: https://docs.docker.com/desktop/install/mac-install/
   - Windows: https://docs.docker.com/desktop/install/windows-install/
   - Linux: https://docs.docker.com/desktop/install/linux-install/

2. **Verify Node.js 20+** is installed
   ```bash
   node --version  # Should be v20.x.x or higher
   ```

3. **Ensure GitHub repository is initialized** (already done for AECMS)

4. **Create `.env` file** in project root:
   ```bash
   # You'll need to generate a secure random string for JWT_SECRET
   # Run: openssl rand -base64 32

   DB_PASSWORD=your_secure_postgres_password
   JWT_SECRET=your_generated_jwt_secret
   JWT_EXPIRATION=15m
   REFRESH_TOKEN_EXPIRATION=7d
   NODE_ENV=development
   ```

**Estimated time:** 30 minutes to 1 hour (depending on Docker installation)

---

### 🤖 [AUTONOMOUS] Deliverables

Claude Code can create these automatically:

#### 0.1 Project Structure
```
aecms/
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/          # Shared utilities, guards, decorators
│   │   ├── database/        # Prisma schema, migrations, seeds
│   │   └── modules/         # Feature modules
│   ├── test/                # E2E tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── Dockerfile
├── frontend/
│   ├── app/                 # Next.js App Router
│   ├── components/          # Reusable components
│   ├── lib/                 # Utilities, API clients
│   ├── styles/              # Global styles, Tailwind
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── Dockerfile
├── scripts/
│   └── validate-phase.sh    # Automated validation script
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

#### 0.2 Docker Compose Configuration
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: aecms-postgres
    environment:
      POSTGRES_DB: aecms
      POSTGRES_USER: aecms
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aecms"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: aecms-redis
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: aecms-backend
    environment:
      DATABASE_URL: postgresql://aecms:${DB_PASSWORD}@postgres:5432/aecms
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: ${NODE_ENV}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - backend_uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: aecms-frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NODE_ENV: ${NODE_ENV}
    depends_on:
      - backend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next

volumes:
  postgres_data:
  redis_data:
  backend_uploads:
```

#### 0.3 Backend Initialization

**Commands Claude Code will run:**
```bash
# Initialize NestJS
npx @nestjs/cli new backend --package-manager npm --skip-git

# Install core dependencies
cd backend
npm install @nestjs/config @nestjs/swagger @nestjs/jwt @nestjs/passport
npm install @nestjs/throttler @nestjs/bull bull
npm install @prisma/client prisma
npm install class-validator class-transformer
npm install bcrypt passport passport-jwt passport-google-oauth20 passport-apple
npm install redis ioredis
npm install -D @types/bcrypt @types/passport-jwt @types/passport-google-oauth20

# Install testing dependencies
npm install -D @nestjs/testing supertest @types/supertest

# Initialize Prisma
npx prisma init

# Set up ESLint and Prettier
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
```

#### 0.4 Frontend Initialization

**Commands Claude Code will run:**
```bash
# Initialize Next.js
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --skip-git

# Install core dependencies
cd frontend
npm install swr axios zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select @radix-ui/react-toast
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
npm install react-hook-form
npm install lucide-react  # Icon library

# Install dev dependencies
npm install -D @playwright/test
```

#### 0.5 Dockerfiles

**Backend Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
USER nestjs
EXPOSE 4000
CMD ["node", "dist/main"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

#### 0.6 Validation Script

**`scripts/validate-phase.sh`:**
```bash
#!/bin/bash
# Automated validation script that Claude Code can run after each phase

set -e  # Exit on any error

echo "🚀 Starting Phase Validation..."

# Backend validation
echo "📦 Validating Backend..."
cd backend
npm run build
npm run lint
npm run test
npx prisma validate
cd ..

# Frontend validation
echo "🎨 Validating Frontend..."
cd frontend
npm run build
npm run lint
cd ..

# Docker validation
echo "🐳 Validating Docker Compose..."
docker-compose config

# Security audit
echo "🔒 Running Security Audit..."
cd backend && npm audit --audit-level=moderate && cd ..
cd frontend && npm audit --audit-level=moderate && cd ..

# Test coverage check
echo "📊 Checking Test Coverage..."
cd backend
COVERAGE=$(npm run test:cov 2>&1 | grep "All files" | awk '{print $10}' | sed 's/%//')
if [ "$COVERAGE" -lt 80 ]; then
  echo "⚠️  Warning: Test coverage is below 80% ($COVERAGE%)"
else
  echo "✅ Test coverage: $COVERAGE%"
fi
cd ..

echo "✅ Phase Validation Complete!"
```

---

### 🤖 [AUTONOMOUS] Testing Strategy

**Validation Checklist (Claude Code runs automatically):**
```bash
# Make validation script executable
chmod +x scripts/validate-phase.sh

# Backend health check
cd backend
npm run build
npm run test

# Frontend health check
cd frontend
npm run build
npm run lint

# Docker compose validation
docker-compose config

# Start services
docker-compose up -d

# Wait for services to be healthy
sleep 10

# Check service status
docker-compose ps

# Database connection check
docker exec aecms-postgres psql -U aecms -c "SELECT version();"

# Redis connection check
docker exec aecms-redis redis-cli ping

# Backend health endpoint
curl http://localhost:4000/health || echo "Backend not responding yet (expected if not implemented)"

# Frontend health
curl http://localhost:3000 || echo "Frontend not responding yet (expected)"
```

---

### 👁️ [HUMAN VERIFICATION] Success Criteria

After Claude Code completes Phase 0, you should verify:

- ✅ All services start successfully (`docker-compose ps` shows all as "running")
- ✅ Backend responds at `http://localhost:4000` (visit in browser)
- ✅ Frontend responds at `http://localhost:3000` (visit in browser)
- ✅ Database accepts connections (check Docker logs)
- ✅ Redis responds to ping
- ✅ `npm run build` succeeds for both backend and frontend
- ✅ `.env.example` file exists with all required variables documented
- ✅ `.gitignore` excludes `.env`, `node_modules`, `dist`, `.next`

**Verification time:** 10-15 minutes

---

## Phase 1: Database Schema & Authentication (Weeks 2-3)

### 🤖 [AUTONOMOUS] 1.1 Prisma Schema Foundation

Claude Code will create the complete database schema in `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER MANAGEMENT & AUTHENTICATION
// ============================================================================

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  password_hash         String?   // Null for OAuth-only users
  first_name            String?
  last_name             String?
  avatar_url            String?
  role                  UserRole  @default(member)
  email_verified        Boolean   @default(false)
  email_verification_token String?
  email_verification_expires DateTime?
  password_reset_token  String?
  password_reset_expires DateTime?
  totp_secret           String?   // Encrypted TOTP secret
  totp_enabled          Boolean   @default(false)
  totp_backup_codes     String[]  // Encrypted recovery codes
  last_login_at         DateTime?
  last_login_ip         String?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime? // Soft delete

  // Relations
  oauth_accounts        OAuthAccount[]
  refresh_tokens        RefreshToken[]
  capabilities          UserCapability[]
  articles              Article[]
  comments              Comment[]
  product_reviews       ProductReview[]
  orders                Order[]
  cart_items            CartItem[]
  kindle_devices        KindleDevice[]
  audit_logs            AuditLog[]

  @@index([email])
  @@index([role])
  @@map("users")
}

enum UserRole {
  owner
  admin
  member
  guest
}

model OAuthAccount {
  id              String   @id @default(uuid())
  user_id         String
  provider        String   // 'google' | 'apple'
  provider_user_id String
  access_token    String?  // Encrypted
  refresh_token   String?  // Encrypted
  expires_at      DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([provider, provider_user_id])
  @@index([user_id])
  @@map("oauth_accounts")
}

model RefreshToken {
  id              String    @id @default(uuid())
  user_id         String
  token_hash      String    @unique
  device_info     String?   // User agent
  ip_address      String?
  expires_at      DateTime
  created_at      DateTime  @default(now())
  revoked_at      DateTime? // For "logout all devices"

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([token_hash])
  @@map("refresh_tokens")
}

// ============================================================================
// CAPABILITY-BASED RBAC
// ============================================================================

model Capability {
  id          String   @id @default(uuid())
  name        String   @unique // e.g., 'article.create', 'product.edit'
  category    String   // 'content', 'ecommerce', 'users', 'system'
  description String
  created_at  DateTime @default(now())

  user_capabilities UserCapability[]
  role_capabilities RoleCapability[]

  @@index([category])
  @@map("capabilities")
}

model UserCapability {
  id            String   @id @default(uuid())
  user_id       String
  capability_id String
  granted_by    String   // User ID of admin who granted this
  granted_at    DateTime @default(now())

  user       User       @relation(fields: [user_id], references: [id], onDelete: Cascade)
  capability Capability @relation(fields: [capability_id], references: [id], onDelete: Cascade)

  @@unique([user_id, capability_id])
  @@map("user_capabilities")
}

model RoleCapability {
  id            String   @id @default(uuid())
  role          UserRole
  capability_id String
  enabled       Boolean  @default(true)
  updated_at    DateTime @updatedAt

  capability Capability @relation(fields: [capability_id], references: [id], onDelete: Cascade)

  @@unique([role, capability_id])
  @@map("role_capabilities")
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

model Article {
  id                  String      @id @default(uuid())
  title               String
  slug                String      @unique
  content             String      @db.Text
  excerpt             String?
  featured_image_id   String?
  author_id           String
  status              ContentStatus @default(draft)
  visibility          ContentVisibility @default(public)
  published_at        DateTime?
  meta_title          String?
  meta_description    String?

  // Granular permissions (PRD 12)
  author_can_edit     Boolean     @default(true)
  author_can_delete   Boolean     @default(true)
  admin_can_edit      Boolean     @default(true)
  admin_can_delete    Boolean     @default(true)

  // Version control (optional)
  version_control_enabled Boolean @default(false)
  current_version     Int         @default(1)

  created_at          DateTime    @default(now())
  updated_at          DateTime    @updatedAt
  deleted_at          DateTime?

  author          User            @relation(fields: [author_id], references: [id])
  featured_image  MediaFile?      @relation("ArticleFeaturedImage", fields: [featured_image_id], references: [id])
  categories      ArticleCategory[]
  tags            ArticleTag[]
  media           ArticleMedia[]
  comments        Comment[]
  versions        ArticleVersion[]

  @@index([slug])
  @@index([author_id])
  @@index([status])
  @@index([visibility])
  @@index([published_at])
  @@map("articles")
}

enum ContentStatus {
  draft
  published
  archived
}

enum ContentVisibility {
  public
  logged_in_only
  admin_only
}

model ArticleVersion {
  id               String   @id @default(uuid())
  article_id       String
  version_number   Int
  title            String
  content          String   @db.Text
  change_summary   String?
  created_by       String
  created_at       DateTime @default(now())

  article Article @relation(fields: [article_id], references: [id], onDelete: Cascade)

  acceptances UserAcceptance[]

  @@unique([article_id, version_number])
  @@map("article_versions")
}

model UserAcceptance {
  id               String   @id @default(uuid())
  version_id       String
  user_id          String?  // Nullable for guest acceptance
  ip_address       String
  user_agent       String
  accepted_at      DateTime @default(now())

  version ArticleVersion @relation(fields: [version_id], references: [id], onDelete: Cascade)

  @@map("user_acceptances")
}

model Page {
  id                  String      @id @default(uuid())
  title               String
  slug                String      @unique
  content             String      @db.Text
  parent_id           String?
  template            String      @default("full-width")
  status              ContentStatus @default(draft)
  visibility          ContentVisibility @default(public)
  published_at        DateTime?
  meta_title          String?
  meta_description    String?

  // Granular permissions
  author_can_edit     Boolean     @default(true)
  author_can_delete   Boolean     @default(true)
  admin_can_edit      Boolean     @default(true)
  admin_can_delete    Boolean     @default(true)

  created_at          DateTime    @default(now())
  updated_at          DateTime    @updatedAt
  deleted_at          DateTime?

  parent   Page?  @relation("PageHierarchy", fields: [parent_id], references: [id])
  children Page[] @relation("PageHierarchy")

  @@index([slug])
  @@index([parent_id])
  @@map("pages")
}

model Category {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  description String?
  parent_id   String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  parent   Category? @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children Category[] @relation("CategoryHierarchy")
  articles ArticleCategory[]
  products ProductCategory[]

  @@index([slug])
  @@map("categories")
}

model Tag {
  id         String   @id @default(uuid())
  name       String
  slug       String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  articles ArticleTag[]
  products ProductTag[]

  @@index([slug])
  @@map("tags")
}

model ArticleCategory {
  article_id  String
  category_id String

  article  Article  @relation(fields: [article_id], references: [id], onDelete: Cascade)
  category Category @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([article_id, category_id])
  @@map("article_categories")
}

model ArticleTag {
  article_id String
  tag_id     String

  article Article @relation(fields: [article_id], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tag_id], references: [id], onDelete: Cascade)

  @@id([article_id, tag_id])
  @@map("article_tags")
}

model MediaFile {
  id            String   @id @default(uuid())
  filename      String
  original_name String
  mime_type     String
  size          Int      // bytes
  width         Int?
  height        Int?
  alt_text      String?
  caption       String?
  storage_path  String
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  article_featured Article[] @relation("ArticleFeaturedImage")
  article_media    ArticleMedia[]
  product_media    ProductMedia[]

  @@index([mime_type])
  @@map("media_files")
}

model ArticleMedia {
  article_id String
  media_id   String
  order      Int @default(0)

  article Article   @relation(fields: [article_id], references: [id], onDelete: Cascade)
  media   MediaFile @relation(fields: [media_id], references: [id], onDelete: Cascade)

  @@id([article_id, media_id])
  @@map("article_media")
}

// ============================================================================
// ECOMMERCE
// ============================================================================

model Product {
  id                  String      @id @default(uuid())
  name                String
  slug                String      @unique
  description         String      @db.Text
  short_description   String?
  price               Decimal     @db.Decimal(10, 2)
  sku                 String?     @unique
  stock_quantity      Int         @default(0)
  stock_status        StockStatus @default(in_stock)
  status              ContentStatus @default(draft)
  visibility          ContentVisibility @default(public)
  guest_purchaseable  Boolean     @default(false)

  // Product type
  product_type        ProductType @default(physical)

  // Granular permissions
  author_can_edit     Boolean     @default(true)
  author_can_delete   Boolean     @default(true)
  admin_can_edit      Boolean     @default(true)
  admin_can_delete    Boolean     @default(true)

  // SEO
  meta_title          String?
  meta_description    String?

  published_at        DateTime?
  created_at          DateTime    @default(now())
  updated_at          DateTime    @updatedAt
  deleted_at          DateTime?

  categories       ProductCategory[]
  tags             ProductTag[]
  media            ProductMedia[]
  reviews          ProductReview[]
  cart_items       CartItem[]
  order_items      OrderItem[]
  digital_files    DigitalProductFile[]

  @@index([slug])
  @@index([sku])
  @@index([product_type])
  @@map("products")
}

enum StockStatus {
  in_stock
  out_of_stock
  backorder
}

enum ProductType {
  physical
  digital
}

model DigitalProductFile {
  id                      String      @id @default(uuid())
  product_id              String
  format                  FileFormat
  file_id                 String      // References MediaFile
  personalization_tested  Boolean     @default(false)
  max_downloads           Int         @default(5)
  created_at              DateTime    @default(now())
  updated_at              DateTime    @updatedAt

  product  Product   @relation(fields: [product_id], references: [id], onDelete: Cascade)
  downloads DigitalDownload[]

  @@unique([product_id, format])
  @@map("digital_product_files")
}

enum FileFormat {
  epub
  pdf
}

model DigitalDownload {
  id                String   @id @default(uuid())
  digital_file_id   String
  order_id          String
  user_id           String?
  download_token    String   @unique
  download_count    Int      @default(0)
  max_downloads     Int      @default(5)
  expires_at        DateTime
  created_at        DateTime @default(now())
  last_downloaded_at DateTime?

  digital_file DigitalProductFile @relation(fields: [digital_file_id], references: [id])
  order        Order              @relation(fields: [order_id], references: [id])

  @@index([download_token])
  @@index([order_id])
  @@map("digital_downloads")
}

model KindleDevice {
  id            String    @id @default(uuid())
  user_id       String
  friendly_name String
  kindle_email  String
  is_default    Boolean   @default(false)
  last_used_at  DateTime?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("kindle_devices")
}

model ProductCategory {
  product_id  String
  category_id String

  product  Product  @relation(fields: [product_id], references: [id], onDelete: Cascade)
  category Category @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([product_id, category_id])
  @@map("product_categories")
}

model ProductTag {
  product_id String
  tag_id     String

  product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tag_id], references: [id], onDelete: Cascade)

  @@id([product_id, tag_id])
  @@map("product_tags")
}

model ProductMedia {
  product_id String
  media_id   String
  order      Int     @default(0)
  is_primary Boolean @default(false)

  product Product   @relation(fields: [product_id], references: [id], onDelete: Cascade)
  media   MediaFile @relation(fields: [media_id], references: [id], onDelete: Cascade)

  @@id([product_id, media_id])
  @@map("product_media")
}

// ============================================================================
// CART & ORDERS
// ============================================================================

model Cart {
  id         String   @id @default(uuid())
  session_id String?  @unique
  user_id    String?  @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  items CartItem[]

  @@map("carts")
}

model CartItem {
  id         String   @id @default(uuid())
  cart_id    String
  product_id String
  user_id    String?  // For logged-in users
  quantity   Int      @default(1)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  cart    Cart    @relation(fields: [cart_id], references: [id], onDelete: Cascade)
  product Product @relation(fields: [product_id], references: [id])
  user    User?   @relation(fields: [user_id], references: [id])

  @@unique([cart_id, product_id])
  @@map("cart_items")
}

model Order {
  id                String      @id @default(uuid())
  order_number      String      @unique
  user_id           String?
  email             String
  status            OrderStatus @default(pending)

  // Amounts
  subtotal          Decimal     @db.Decimal(10, 2)
  tax               Decimal     @db.Decimal(10, 2) @default(0)
  shipping          Decimal     @db.Decimal(10, 2) @default(0)
  total             Decimal     @db.Decimal(10, 2)

  // Payment
  payment_method    String      // 'stripe', 'paypal', 'amazon_pay'
  payment_intent_id String?
  paid_at           DateTime?

  // Shipping (null for digital-only orders)
  shipping_name     String?
  shipping_address  String?
  shipping_city     String?
  shipping_state    String?
  shipping_zip      String?
  shipping_country  String?

  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  user           User?            @relation(fields: [user_id], references: [id])
  items          OrderItem[]
  digital_downloads DigitalDownload[]

  @@index([order_number])
  @@index([user_id])
  @@index([status])
  @@map("orders")
}

enum OrderStatus {
  pending
  processing
  completed
  cancelled
  refunded
}

model OrderItem {
  id         String  @id @default(uuid())
  order_id   String
  product_id String
  quantity   Int
  price      Decimal @db.Decimal(10, 2) // Price at time of purchase

  order   Order   @relation(fields: [order_id], references: [id], onDelete: Cascade)
  product Product @relation(fields: [product_id], references: [id])

  @@map("order_items")
}

// ============================================================================
// COMMENTS & REVIEWS
// ============================================================================

model Comment {
  id                String        @id @default(uuid())
  article_id        String?
  user_id           String?       // Nullable for guest comments (future)
  author_name       String?       // For guest comments
  author_email      String?       // For guest comments
  content           String        @db.Text
  status            CommentStatus @default(pending)

  // AI Moderation
  moderation_status ModerationStatus @default(pending)
  moderation_flags  String[]      // Array of flags from OpenAI
  profanity_detected Boolean      @default(false)

  parent_id         String?       // For nested replies
  created_at        DateTime      @default(now())
  updated_at        DateTime      @updatedAt
  deleted_at        DateTime?

  article Article?  @relation(fields: [article_id], references: [id], onDelete: Cascade)
  user    User?     @relation(fields: [user_id], references: [id])
  parent  Comment?  @relation("CommentReplies", fields: [parent_id], references: [id])
  replies Comment[] @relation("CommentReplies")

  @@index([article_id])
  @@index([user_id])
  @@index([status])
  @@map("comments")
}

enum CommentStatus {
  pending
  approved
  rejected
  spam
}

enum ModerationStatus {
  pending
  approved
  flagged
  rejected
}

model ProductReview {
  id                String           @id @default(uuid())
  product_id        String
  user_id           String
  rating            Int              // 1-5
  title             String?
  content           String           @db.Text
  status            CommentStatus    @default(pending)

  // AI Moderation
  moderation_status ModerationStatus @default(pending)
  moderation_flags  String[]
  profanity_detected Boolean         @default(false)

  verified_purchase Boolean          @default(false)
  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt
  deleted_at        DateTime?

  product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [user_id], references: [id])

  @@index([product_id])
  @@index([user_id])
  @@map("product_reviews")
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

model AuditLog {
  id              String   @id @default(uuid())
  event_type      String   // e.g., 'user.login', 'article.create'
  user_id         String?
  ip_address      String?
  user_agent      String?
  resource_type   String?  // 'article', 'product', 'user', etc.
  resource_id     String?
  changes         Json?    // Before/after values
  metadata        Json?    // Additional context
  previous_hash   String?  // Hash of previous log entry (blockchain-like)
  entry_hash      String   // Hash of this entry
  created_at      DateTime @default(now())

  user User? @relation(fields: [user_id], references: [id])

  @@index([event_type])
  @@index([user_id])
  @@index([resource_type, resource_id])
  @@index([created_at])
  @@map("audit_logs")
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

model Setting {
  id         String   @id @default(uuid())
  key        String   @unique
  value      String   @db.Text
  encrypted  Boolean  @default(false) // For API keys
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("settings")
}
```

**Claude Code will then run:**
```bash
cd backend
npx prisma migrate dev --name initial_schema
npx prisma generate
```

---

### 👤 [HUMAN REQUIRED] 1.2 OAuth Provider Setup

Before authentication can work, you need to create OAuth applications:

#### Google OAuth Setup (15 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure consent screen (if not done):
   - User Type: External
   - App name: AECMS
   - User support email: your email
   - Developer contact: your email
6. Create OAuth Client ID:
   - Application type: Web application
   - Name: AECMS Development
   - Authorized redirect URIs:
     - `http://localhost:4000/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret**

#### Apple OAuth Setup (30 minutes) - **OPTIONAL for MVP**

Apple Sign In requires Apple Developer Program membership ($99/year). You can skip this for initial development.

If setting up:
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create Service ID for Sign in with Apple
4. Configure redirect URLs
5. Generate private key and note Key ID
6. Copy Service ID, Team ID, Key ID, and download private key

#### Update .env file

Add to your `.env`:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Apple OAuth (optional)
APPLE_CLIENT_ID=your_apple_service_id
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY_PATH=./secrets/apple-auth-key.p8

# Frontend URLs (for OAuth callbacks)
FRONTEND_URL=http://localhost:3000
FRONTEND_ADMIN_URL=http://localhost:3000/admin
```

---

### 🤖 [AUTONOMOUS] 1.3 Authentication Module Implementation

Claude Code will create complete authentication system:

**Files to create:**
- `backend/src/modules/auth/auth.module.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/strategies/jwt.strategy.ts`
- `backend/src/modules/auth/strategies/google.strategy.ts`
- `backend/src/modules/auth/strategies/apple.strategy.ts`
- `backend/src/modules/auth/guards/jwt-auth.guard.ts`
- `backend/src/modules/auth/guards/roles.guard.ts`
- `backend/src/modules/auth/guards/2fa.guard.ts`
- `backend/src/modules/auth/dto/*.dto.ts`
- `backend/src/modules/auth/auth.service.spec.ts` (100+ tests)

**Key features implemented:**
- ✅ Email/password registration with bcrypt (cost factor 12)
- ✅ Email verification with token expiry
- ✅ Login with JWT token generation
- ✅ Refresh token rotation (persistent for front door, 7-day for back door)
- ✅ Password reset flow
- ✅ Google OAuth integration
- ✅ Apple OAuth integration (if configured)
- ✅ TOTP 2FA setup and verification
- ✅ Role-based guards
- ✅ Session management
- ✅ "Logout all devices" functionality

**Example test (one of 100+):**
```typescript
describe('AuthService', () => {
  it('should reject passwords shorter than 16 characters', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'Short1!',  // Only 7 chars
      first_name: 'Test',
      last_name: 'User'
    }

    await expect(authService.register(dto))
      .rejects
      .toThrow('Password must be at least 16 characters')
  })

  it('should require at least one uppercase and one special character', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'thisisalowercasepassword',
      first_name: 'Test',
      last_name: 'User'
    }

    await expect(authService.register(dto))
      .rejects
      .toThrow('Password must contain at least one uppercase letter and one special character')
  })

  it('should hash passwords with bcrypt cost factor 12', async () => {
    const password = 'ValidPassword123!@#'
    const hash = await authService.hashPassword(password)

    expect(hash).not.toBe(password)
    expect(hash.startsWith('$2b$12$')).toBe(true)  // bcrypt cost 12
    expect(await bcrypt.compare(password, hash)).toBe(true)
  })

  it('should generate JWT with 15-minute expiration', async () => {
    const user = await createTestUser()
    const token = await authService.generateAccessToken(user)
    const decoded = jwt.decode(token) as any

    expect(decoded.sub).toBe(user.id)
    expect(decoded.email).toBe(user.email)
    expect(decoded.role).toBe(user.role)

    const expiresIn = decoded.exp - decoded.iat
    expect(expiresIn).toBe(15 * 60)  // 15 minutes in seconds
  })

  it('should create persistent refresh tokens for front-door login', async () => {
    const user = await createTestUser({ role: 'member' })
    const result = await authService.login(user, 'front-door')

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token_hash: hash(result.refreshToken) }
    })

    // No expiration for front-door (persistent until logout)
    expect(refreshToken.expires_at).toBeNull()
  })

  it('should create 7-day refresh tokens for back-door login', async () => {
    const user = await createTestUser({ role: 'admin' })
    const result = await authService.login(user, 'back-door')

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token_hash: hash(result.refreshToken) }
    })

    const expiresIn = refreshToken.expires_at.getTime() - Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000

    expect(expiresIn).toBeGreaterThan(sevenDays - 60000)  // Within 1 minute
    expect(expiresIn).toBeLessThan(sevenDays + 60000)
  })

  it('should enforce 2FA for back-door admin login', async () => {
    const admin = await createTestUser({
      role: 'admin',
      totp_enabled: true,
      totp_secret: 'encrypted_secret'
    })

    const result = await authService.login(admin, 'back-door')

    // Should return temp token requiring 2FA verification
    expect(result.requires2FA).toBe(true)
    expect(result.tempToken).toBeDefined()
    expect(result.accessToken).toBeUndefined()
  })
})
```

---

### 👁️ [HUMAN VERIFICATION] 1.4 Authentication Testing

After Claude Code implements authentication, you should manually test:

**Registration Flow (5 minutes):**
1. POST to `http://localhost:4000/api/auth/register`
2. Check email for verification link (if SMTP configured)
3. Verify user created in database: `docker exec aecms-postgres psql -U aecms -c "SELECT id, email, role FROM users;"`

**Login Flow (5 minutes):**
1. POST to `http://localhost:4000/api/auth/login`
2. Verify you receive `accessToken` and `refreshToken`
3. Try accessing protected endpoint with token

**OAuth Flow (10 minutes):**
1. Visit `http://localhost:4000/api/auth/google`
2. Complete Google OAuth flow
3. Verify redirect back to frontend with tokens
4. Check `oauth_accounts` table for linked account

**2FA Flow (15 minutes):**
1. Enable 2FA for an admin user
2. Try logging in via back door
3. Verify 2FA challenge is required
4. Complete 2FA with authenticator app (Google Authenticator, Authy, etc.)
5. Verify you receive full access token after valid TOTP

---

### 🤖 [AUTONOMOUS] 1.5 Users Module

Claude Code will create user management endpoints:

**Files to create:**
- `backend/src/modules/users/users.module.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/users/dto/*.dto.ts`
- `backend/src/modules/users/users.service.spec.ts` (50+ tests)

**Endpoints:**
- `GET /api/users` - List users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update current user profile

---

### 🤖 [AUTONOMOUS] Phase 1 Validation

Claude Code will run:
```bash
./scripts/validate-phase.sh

# Additional Phase 1 specific tests
cd backend
npm run test -- auth.service.spec.ts
npm run test -- users.service.spec.ts
npm run test:e2e -- auth.e2e-spec.ts

# Check test coverage
npm run test:cov

# Verify migrations
npx prisma migrate status
```

---

### 👁️ [HUMAN VERIFICATION] Phase 1 Complete

**Checklist (15 minutes):**
- ✅ Database schema deployed successfully
- ✅ All auth tests pass (≥100 tests)
- ✅ Registration works (email + password)
- ✅ Login works (returns JWT tokens)
- ✅ Google OAuth works (if configured)
- ✅ 2FA works for admin users
- ✅ Refresh token rotation works
- ✅ Password reset email sent (check logs if SMTP not configured)
- ✅ User profile endpoints work
- ✅ Role guards enforce access control
- ✅ Test coverage ≥80% for auth module

---

## Phase 2: Capability System (Week 3)

### 🤖 [AUTONOMOUS] 2.1 Capability Module Implementation

Claude Code will create the capability-based RBAC system:

**Files to create:**
- `backend/src/modules/capabilities/capabilities.module.ts`
- `backend/src/modules/capabilities/capabilities.service.ts`
- `backend/src/modules/capabilities/capabilities.controller.ts`
- `backend/src/modules/capabilities/guards/capability.guard.ts`
- `backend/src/modules/capabilities/decorators/requires-capability.decorator.ts`
- `backend/src/modules/capabilities/dto/*.dto.ts`
- `backend/src/modules/capabilities/capabilities.service.spec.ts` (30+ tests)

**Capabilities to seed:**
```typescript
const capabilities = [
  // Content Management
  { name: 'article.create', category: 'content', description: 'Create articles' },
  { name: 'article.edit.own', category: 'content', description: 'Edit own articles' },
  { name: 'article.edit.any', category: 'content', description: 'Edit any article' },
  { name: 'article.delete.own', category: 'content', description: 'Delete own articles' },
  { name: 'article.delete.any', category: 'content', description: 'Delete any article' },
  { name: 'article.publish', category: 'content', description: 'Publish articles' },

  { name: 'page.create', category: 'content', description: 'Create pages' },
  { name: 'page.edit', category: 'content', description: 'Edit pages' },
  { name: 'page.delete', category: 'content', description: 'Delete pages' },

  { name: 'media.upload', category: 'content', description: 'Upload media files' },
  { name: 'media.delete', category: 'content', description: 'Delete media files' },

  // Ecommerce
  { name: 'product.create', category: 'ecommerce', description: 'Create products' },
  { name: 'product.edit', category: 'ecommerce', description: 'Edit products' },
  { name: 'product.delete', category: 'ecommerce', description: 'Delete products' },
  { name: 'order.view.all', category: 'ecommerce', description: 'View all orders' },
  { name: 'order.edit', category: 'ecommerce', description: 'Edit orders' },
  { name: 'order.refund', category: 'ecommerce', description: 'Process refunds' },

  // Users
  { name: 'user.create', category: 'users', description: 'Create users' },
  { name: 'user.edit', category: 'users', description: 'Edit users' },
  { name: 'user.delete', category: 'users', description: 'Delete users' },
  { name: 'user.assign_role', category: 'users', description: 'Assign user roles' },
  { name: 'user.assign_capability', category: 'users', description: 'Assign capabilities' },

  // Comments & Reviews
  { name: 'comment.moderate', category: 'content', description: 'Moderate comments' },
  { name: 'review.moderate', category: 'ecommerce', description: 'Moderate reviews' },

  // System
  { name: 'system.configure', category: 'system', description: 'Configure system settings' },
  { name: 'system.view_audit', category: 'system', description: 'View audit logs' },
  { name: 'system.export_data', category: 'system', description: 'Export data (CSV)' },
]
```

**Default role capabilities (seed data):**
```typescript
// Admin default capabilities
const adminCapabilities = [
  'article.create', 'article.edit.any', 'article.publish',
  'product.create', 'product.edit', 'product.delete',
  'order.view.all', 'order.edit',
  'user.edit', 'comment.moderate', 'review.moderate',
]

// Member default capabilities
const memberCapabilities = [
  // Members can only view and purchase
]
```

**Endpoints:**
- `GET /api/capabilities` - List all capabilities
- `GET /api/capabilities/roles/:role` - Get capabilities for a role
- `POST /api/capabilities/roles/:role` - Assign capability to role (Owner only)
- `DELETE /api/capabilities/roles/:role/:capability` - Remove capability from role (Owner only)
- `POST /api/capabilities/users/:userId` - Assign capability to specific user (Owner only)
- `DELETE /api/capabilities/users/:userId/:capability` - Remove user capability (Owner only)

**Usage example:**
```typescript
@Controller('articles')
export class ArticlesController {
  @Post()
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('article.create')
  async create(@CurrentUser() user: User, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(user, dto)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('article.edit.any', 'article.edit.own')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto
  ) {
    // CapabilityGuard checks:
    // - If user has 'article.edit.any', allow
    // - Else if user has 'article.edit.own' AND is article author, allow
    // - Else deny
    return this.articlesService.update(user, id, dto)
  }
}
```

---

### 🤖 [AUTONOMOUS] 2.2 Database Seeding

Claude Code will create seed script:

**`backend/prisma/seed.ts`:**
```typescript
import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed capabilities
  const capabilities = [/* ... array from above ... */]

  for (const cap of capabilities) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: {},
      create: cap,
    })
  }

  console.log('✅ Capabilities seeded')

  // Seed default role capabilities
  const articleCreate = await prisma.capability.findUnique({ where: { name: 'article.create' } })
  // ... (assign capabilities to admin role)

  console.log('✅ Role capabilities seeded')

  // Create owner user (IMPORTANT: Change these credentials!)
  const ownerPassword = await bcrypt.hash('ChangeThisPassword1!', 12)

  await prisma.user.upsert({
    where: { email: 'owner@aecms.local' },
    update: {},
    create: {
      email: 'owner@aecms.local',
      password_hash: ownerPassword,
      first_name: 'System',
      last_name: 'Owner',
      role: UserRole.owner,
      email_verified: true,
    },
  })

  console.log('✅ Owner user created (owner@aecms.local / ChangeThisPassword1!)')
  console.log('⚠️  IMPORTANT: Change the owner password immediately!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Claude Code will run:**
```bash
cd backend
npx prisma db seed
```

---

### 👤 [HUMAN REQUIRED] 2.3 Change Default Owner Password

**CRITICAL SECURITY STEP:**

1. Log in as owner:
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "owner@aecms.local",
       "password": "ChangeThisPassword1!"
     }'
   ```

2. Use the access token to change password:
   ```bash
   curl -X PATCH http://localhost:4000/api/users/me/password \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "currentPassword": "ChangeThisPassword1!",
       "newPassword": "YourSecure16CharPassword!"
     }'
   ```

3. Enable 2FA for owner account:
   ```bash
   curl -X POST http://localhost:4000/api/auth/2fa/setup \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

4. Scan QR code with authenticator app and verify:
   ```bash
   curl -X POST http://localhost:4000/api/auth/2fa/verify \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "123456"
     }'
   ```

**Estimated time:** 10 minutes

---

### 👁️ [HUMAN VERIFICATION] Phase 2 Complete

**Checklist (10 minutes):**
- ✅ All capability tests pass (≥30 tests)
- ✅ Capabilities seeded in database
- ✅ Owner account created and password changed
- ✅ Owner 2FA enabled
- ✅ Admin role has default capabilities assigned
- ✅ Capability guards enforce permissions correctly
- ✅ Test endpoint access with different roles

**Test capability system:**
```bash
# As Owner, list all capabilities
curl http://localhost:4000/api/capabilities \
  -H "Authorization: Bearer OWNER_TOKEN"

# As Admin, try to assign capability (should fail)
curl -X POST http://localhost:4000/api/capabilities/roles/admin \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability": "system.configure"}'
# Should return 403 Forbidden

# As Owner, assign capability to Admin role
curl -X POST http://localhost:4000/api/capabilities/roles/admin \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capability": "system.configure"}'
# Should succeed
```

---

## Phase 3: Content Management (Weeks 4-6)

### 🤖 [AUTONOMOUS] 3.1 Media Module

Claude Code will implement media upload and management:

**Files to create:**
- `backend/src/modules/media/media.module.ts`
- `backend/src/modules/media/media.service.ts`
- `backend/src/modules/media/media.controller.ts`
- `backend/src/modules/media/dto/*.dto.ts`
- `backend/src/modules/media/media.service.spec.ts` (25+ tests)

**Features:**
- ✅ File upload with multer (local filesystem MVP)
- ✅ Image optimization (sharp library)
- ✅ Thumbnail generation
- ✅ MIME type validation
- ✅ File size limits
- ✅ Alt text and caption support
- ✅ Pagination
- ✅ Search by filename

**Dependencies to install:**
```bash
npm install multer sharp
npm install -D @types/multer @types/sharp
```

**Endpoints:**
- `POST /api/media/upload` - Upload file(s)
- `GET /api/media` - List media files (paginated)
- `GET /api/media/:id` - Get media file details
- `PATCH /api/media/:id` - Update media metadata (alt text, caption)
- `DELETE /api/media/:id` - Delete media file
- `GET /api/media/:id/download` - Download original file

---

### 🤖 [AUTONOMOUS] 3.2 Categories & Tags Modules

Claude Code will implement taxonomy:

**Categories endpoints:**
- `GET /api/categories` - List all categories (hierarchical)
- `GET /api/categories/:slug` - Get category by slug
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

**Tags endpoints:**
- `GET /api/tags` - List all tags
- `GET /api/tags/:slug` - Get tag by slug
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

---

### 🤖 [AUTONOMOUS] 3.3 Articles Module

Claude Code will implement full article management:

**Files to create:**
- `backend/src/modules/articles/articles.module.ts`
- `backend/src/modules/articles/articles.service.ts`
- `backend/src/modules/articles/articles.controller.ts`
- `backend/src/modules/articles/dto/*.dto.ts`
- `backend/src/modules/articles/articles.service.spec.ts` (40+ tests)

**Features:**
- ✅ CRUD operations
- ✅ Slug generation
- ✅ Rich text content (HTML)
- ✅ Featured image
- ✅ Categories and tags association
- ✅ Status management (draft/published/archived)
- ✅ Visibility controls (public/logged_in_only/admin_only)
- ✅ Granular permissions (author_can_edit, admin_can_edit, etc.)
- ✅ SEO meta fields
- ✅ Pagination and filtering
- ✅ Full-text search (PostgreSQL)

**Endpoints:**
- `GET /api/articles` - List articles (public, paginated)
- `GET /api/articles/:slug` - Get article by slug
- `POST /api/articles` - Create article (requires capability)
- `PATCH /api/articles/:id` - Update article (permission check)
- `DELETE /api/articles/:id` - Delete article (permission check)
- `POST /api/articles/:id/publish` - Publish article
- `POST /api/articles/:id/archive` - Archive article

**Permission evaluation logic:**
```typescript
async canEdit(user: User, article: Article): Promise<boolean> {
  // 1. Owner always can
  if (user.role === 'owner') return true

  // 2. Check content-level flags (PRD 12)
  if (user.id === article.author_id && article.author_can_edit) return true
  if (user.role === 'admin' && article.admin_can_edit) return true

  // 3. Fall back to role capabilities (PRD 09)
  if (await user.hasCapability('article.edit.any')) return true
  if (await user.hasCapability('article.edit.own') && user.id === article.author_id) return true

  // 4. Deny
  return false
}
```

---

### 🤖 [AUTONOMOUS] 3.4 Article Versioning Module (Optional)

Claude Code will implement version control for articles:

**Features:**
- ✅ OFF by default, enable per-article
- ✅ Track version history with change summaries
- ✅ User acceptance tracking (for legal documents)
- ✅ IP address and user agent logging
- ✅ Force re-acceptance on version update

**Endpoints:**
- `GET /api/articles/:id/versions` - List versions
- `GET /api/articles/:id/versions/:version` - Get specific version
- `POST /api/articles/:id/versions/:version/accept` - Accept version (for legal docs)
- `GET /api/articles/:id/acceptance-status` - Check if user accepted current version

---

### 🤖 [AUTONOMOUS] 3.5 Pages Module

Similar to articles but for static pages:

**Differences from articles:**
- Hierarchical structure (parent/child)
- Template selection
- No categories/tags
- Cannot be embedded in other content

**Endpoints:**
- `GET /api/pages` - List all pages (tree structure)
- `GET /api/pages/:slug` - Get page by slug
- `POST /api/pages` - Create page
- `PATCH /api/pages/:id` - Update page
- `DELETE /api/pages/:id` - Delete page

---

### 🤖 [AUTONOMOUS] Phase 3 Validation

Claude Code will run:
```bash
./scripts/validate-phase.sh

# Additional Phase 3 specific tests
cd backend
npm run test -- media.service.spec.ts
npm run test -- articles.service.spec.ts
npm run test -- pages.service.spec.ts
npm run test:e2e -- content.e2e-spec.ts
```

---

### 👁️ [HUMAN VERIFICATION] Phase 3 Complete

**Checklist (20 minutes):**
- ✅ Media upload works (test image upload)
- ✅ Image optimization generates thumbnails
- ✅ Categories created (test hierarchical structure)
- ✅ Tags created
- ✅ Article CRUD works
- ✅ Article slug generation works
- ✅ Permission system works (test author_can_edit flag)
- ✅ Article visibility controls work
- ✅ Version control works for enabled articles
- ✅ Pages with parent/child hierarchy work
- ✅ Full-text search returns results
- ✅ Test coverage ≥80%

**Manual testing:**
```bash
# Upload an image
curl -X POST http://localhost:4000/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "alt_text=Test image"

# Create an article
curl -X POST http://localhost:4000/api/articles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Article",
    "content": "<p>This is the content...</p>",
    "status": "published",
    "visibility": "public"
  }'

# Verify article created
curl http://localhost:4000/api/articles/my-first-article
```

---

## Phase 4: Ecommerce Core (Weeks 7-9)

### 🤖 [AUTONOMOUS] 4.1 Products Module

Claude Code will implement product management:

**Files to create:**
- `backend/src/modules/products/products.module.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/products/products.controller.ts`
- `backend/src/modules/products/dto/*.dto.ts`
- `backend/src/modules/products/products.service.spec.ts` (50+ tests)

**Features:**
- ✅ CRUD operations
- ✅ Product type (physical/digital)
- ✅ Price management (Decimal type)
- ✅ Stock tracking
- ✅ SKU management
- ✅ Product images (via media module)
- ✅ Categories and tags
- ✅ Visibility controls
- ✅ Guest purchaseable flag
- ✅ SEO fields
- ✅ Granular permissions

**Endpoints:**
- `GET /api/products` - List products (public, paginated)
- `GET /api/products/:slug` - Get product by slug
- `POST /api/products` - Create product (requires capability)
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/stock` - Update stock quantity

---

### 🤖 [AUTONOMOUS] 4.2 Cart Module

Claude Code will implement shopping cart:

**Features:**
- ✅ Session-based carts (for guests)
- ✅ User-based carts (for logged-in users)
- ✅ Add/update/remove items
- ✅ Cart persistence
- ✅ Cart expiration (30 days inactive)

**Endpoints:**
- `GET /api/cart` - Get current cart
- `POST /api/cart/items` - Add item to cart
- `PATCH /api/cart/items/:productId` - Update quantity
- `DELETE /api/cart/items/:productId` - Remove item
- `DELETE /api/cart` - Clear cart

---

### 🤖 [AUTONOMOUS] 4.3 Product Reviews Module

Claude Code will implement review system:

**Features:**
- ✅ 1-5 star ratings
- ✅ Review title and content
- ✅ Verified purchase badge
- ✅ AI moderation (same as comments)
- ✅ Admin approval workflow

**Endpoints:**
- `GET /api/products/:productId/reviews` - List reviews
- `POST /api/products/:productId/reviews` - Create review (Member only)
- `PATCH /api/reviews/:id` - Update own review
- `DELETE /api/reviews/:id` - Delete own review
- `POST /api/reviews/:id/approve` - Approve review (Admin)
- `POST /api/reviews/:id/reject` - Reject review (Admin)

---

### 🤖 [AUTONOMOUS] Phase 4 Validation

```bash
./scripts/validate-phase.sh

cd backend
npm run test -- products.service.spec.ts
npm run test -- cart.service.spec.ts
npm run test -- reviews.service.spec.ts
```

---

### 👁️ [HUMAN VERIFICATION] Phase 4 Complete

**Checklist (15 minutes):**
- ✅ Product CRUD works
- ✅ Stock tracking updates correctly
- ✅ Cart operations work (add/update/remove)
- ✅ Cart persists for logged-in users
- ✅ Guest carts work with session
- ✅ Reviews can be created
- ✅ Reviews display verified purchase badge
- ✅ AI moderation flags inappropriate reviews
- ✅ Test coverage ≥80%

---

## Phase 5: Payment Integration (Weeks 10-11)

### 👤 [HUMAN REQUIRED] 5.1 Payment Provider Setup

Before Claude Code can implement payment integration, you need to create accounts:

#### Stripe Setup (15 minutes)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account (or sign in)
3. Navigate to "Developers" > "API keys"
4. Copy **Publishable key** and **Secret key** (use Test mode for development)
5. Navigate to "Developers" > "Webhooks"
6. Add endpoint: `http://localhost:4000/api/payments/stripe/webhook`
7. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
8. Copy **Webhook signing secret**

#### PayPal Setup (20 minutes)

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Create account or sign in
3. Go to "My Apps & Credentials"
4. Create a **Sandbox** app for testing
5. Copy **Client ID** and **Secret**
6. For production, create a live app later

#### Amazon Pay Setup (20 minutes) - **OPTIONAL**

1. Go to [Amazon Pay Merchant Portal](https://pay.amazon.com/)
2. Create merchant account
3. Complete seller verification (may take 1-2 days)
4. Navigate to "Integration" > "Integration Central"
5. Copy **Merchant ID**, **Public Key ID**, and **Private Key**

#### Update .env

Add to your `.env`:
```bash
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox  # or 'live' for production

# Amazon Pay (optional)
AMAZON_PAY_MERCHANT_ID=...
AMAZON_PAY_PUBLIC_KEY_ID=...
AMAZON_PAY_PRIVATE_KEY=...
AMAZON_PAY_REGION=us  # or 'eu', 'uk', 'jp'
AMAZON_PAY_SANDBOX=true
```

---

### 🤖 [AUTONOMOUS] 5.2 Payments Module Implementation

Claude Code will create complete payment integration:

**Files to create:**
- `backend/src/modules/payments/payments.module.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/src/modules/payments/payments.controller.ts`
- `backend/src/modules/payments/stripe/stripe.service.ts`
- `backend/src/modules/payments/paypal/paypal.service.ts`
- `backend/src/modules/payments/amazon/amazon.service.ts`
- `backend/src/modules/payments/dto/*.dto.ts`
- `backend/src/modules/payments/payments.service.spec.ts` (50+ tests)

**Dependencies to install:**
```bash
npm install stripe @paypal/checkout-server-sdk amazon-pay-api-sdk-nodejs
npm install -D @types/stripe
```

**Features:**
- ✅ Stripe Payment Intents API
- ✅ PayPal Orders API v2
- ✅ Amazon Pay integration
- ✅ Webhook handling with signature verification
- ✅ Idempotency (prevent duplicate charges)
- ✅ Refund processing
- ✅ Order status tracking

**Endpoints:**
- `POST /api/payments/create-intent` - Create payment intent (Stripe)
- `POST /api/payments/paypal/create-order` - Create PayPal order
- `POST /api/payments/paypal/capture-order` - Capture PayPal payment
- `POST /api/payments/amazon/create-session` - Create Amazon Pay session
- `POST /api/payments/stripe/webhook` - Stripe webhook handler
- `POST /api/payments/paypal/webhook` - PayPal webhook handler
- `POST /api/payments/refund` - Process refund (Admin only)

---

### 🤖 [AUTONOMOUS] 5.3 Orders Module

Claude Code will implement order management:

**Features:**
- ✅ Order creation from cart
- ✅ Order number generation
- ✅ Order status tracking
- ✅ Email notifications (order confirmation, shipping)
- ✅ Order history for users
- ✅ Admin order management

**Endpoints:**
- `POST /api/orders` - Create order from cart
- `GET /api/orders` - List own orders (or all for Admin)
- `GET /api/orders/:orderNumber` - Get order details
- `PATCH /api/orders/:id/status` - Update order status (Admin)

---

### 🤖 [AUTONOMOUS] 5.4 Checkout Flow Implementation

Claude Code will create multi-step checkout:

1. Cart review
2. Shipping information (for physical products)
3. Payment method selection
4. Order confirmation

**Endpoints:**
- `POST /api/checkout/initiate` - Start checkout from cart
- `POST /api/checkout/shipping` - Save shipping info
- `POST /api/checkout/payment` - Process payment
- `POST /api/checkout/complete` - Finalize order

---

### 👁️ [HUMAN VERIFICATION] 5.5 Payment Testing

**CRITICAL: Test all payment flows manually (45 minutes)**

#### Stripe Testing:

1. Add product to cart
2. Initiate checkout
3. Use Stripe test card: `4242 4242 4242 4242`
4. Verify payment succeeds
5. Check order created in database
6. Check webhook received and processed

**Stripe test cards:**
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

#### PayPal Testing:

1. Add product to cart
2. Select PayPal at checkout
3. Use PayPal sandbox account (create at PayPal Developer Dashboard)
4. Complete PayPal flow
5. Verify order created
6. Check webhook received

#### Refund Testing:

1. Create a test order
2. As Admin, process refund via API
3. Verify refund reflected in Stripe/PayPal dashboard
4. Verify order status updated to "refunded"

#### Edge Cases to Test:

- Payment declined (insufficient funds card)
- Payment abandoned (user closes window)
- Duplicate payment attempts (idempotency)
- Webhook failure and retry
- Stock depleted during checkout

---

### 👁️ [HUMAN VERIFICATION] Phase 5 Complete

**Checklist (45 minutes for thorough testing):**
- ✅ Stripe payment succeeds
- ✅ Stripe payment failure handled gracefully
- ✅ Stripe webhook received and processed
- ✅ PayPal payment succeeds
- ✅ PayPal webhook received
- ✅ Order created with correct amounts (subtotal, tax, shipping, total)
- ✅ Order confirmation email sent (check logs)
- ✅ Stock quantity decreased after purchase
- ✅ Refund processing works
- ✅ Duplicate payment prevention works (idempotency)
- ✅ Digital products create download tokens
- ✅ Test coverage ≥80%

---

## Phase 6: Advanced Features (Weeks 12-13)

### 🤖 [AUTONOMOUS] 6.1 Comments Module

Claude Code will implement commenting system:

**Features:**
- ✅ Comments on articles
- ✅ Nested replies (single level)
- ✅ Member-only commenting
- ✅ AI moderation (OpenAI Moderation API + profanity filter)
- ✅ Admin moderation queue
- ✅ Reactive moderation (post immediately, flag for review)

**Dependencies:**
```bash
npm install openai bad-words
npm install -D @types/bad-words
```

**Endpoints:**
- `GET /api/articles/:articleId/comments` - List comments
- `POST /api/articles/:articleId/comments` - Create comment (Member only)
- `POST /api/comments/:id/reply` - Reply to comment
- `PATCH /api/comments/:id` - Edit own comment
- `DELETE /api/comments/:id` - Delete own comment
- `GET /api/admin/comments/flagged` - List flagged comments (Admin)
- `POST /api/admin/comments/:id/approve` - Approve comment (Admin)
- `POST /api/admin/comments/:id/reject` - Reject comment (Admin)

---

### 👤 [HUMAN REQUIRED] 6.2 OpenAI API Key Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account or sign in
3. Navigate to "API keys"
4. Create new key
5. Copy key to `.env`:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

**Cost estimate:** OpenAI Moderation API is **FREE** for up to 1M requests/month

---

### 🤖 [AUTONOMOUS] 6.3 AI Moderation Service

Claude Code will implement:

**Files:**
- `backend/src/modules/moderation/moderation.module.ts`
- `backend/src/modules/moderation/moderation.service.ts`
- `backend/src/modules/moderation/profanity.service.ts`
- `backend/src/modules/moderation/moderation.service.spec.ts` (20+ tests)

**Features:**
- ✅ OpenAI Moderation API integration
- ✅ Profanity detection and bleeping (bad-words library)
- ✅ Fully redact profanity (no letter hints)
- ✅ Click-to-reveal for readers with warnings
- ✅ Flag aggregation (hate speech, harassment, sexual content, violence)
- ✅ Notification to admins for flagged content

**Moderation flow:**
```
User submits comment
  ↓
Check OpenAI Moderation API (async)
  ↓
Check profanity filter
  ↓
If flagged or profanity: mark for review, notify admin
  ↓
Post comment publicly (reactive moderation)
  ↓
Admin reviews and approves/rejects if needed
```

---

### 🤖 [AUTONOMOUS] 6.4 Audit Trail Module

Claude Code will implement immutable audit logging:

**Features:**
- ✅ 50+ event types tracked
- ✅ Blockchain-like chaining with checksums
- ✅ Immutable (no updates allowed)
- ✅ 7-year retention
- ✅ Searchable and filterable
- ✅ CSV export

**Event types to track:**
```typescript
const eventTypes = [
  // User actions
  'user.register', 'user.login', 'user.login.failed', 'user.logout',
  'user.password.reset', 'user.email.changed', 'user.2fa.enabled',
  'user.2fa.disabled', 'user.2fa.reset',

  // Content actions
  'article.create', 'article.update', 'article.delete', 'article.publish',
  'page.create', 'page.update', 'page.delete',
  'product.create', 'product.update', 'product.delete', 'product.stock.update',

  // Ecommerce actions
  'order.create', 'order.paid', 'order.shipped', 'order.completed', 'order.refunded',
  'cart.item.added', 'cart.item.removed',

  // Comments & Reviews
  'comment.create', 'comment.update', 'comment.delete', 'comment.flagged', 'comment.approved',
  'review.create', 'review.flagged', 'review.approved',

  // Admin actions
  'user.role.changed', 'user.capability.assigned', 'user.capability.removed',
  'comment.moderate', 'review.moderate',

  // System actions
  'system.config.changed', 'system.backup.created', 'system.restore.completed',
]
```

**Endpoints:**
- `GET /api/audit` - List audit logs (Admin/Owner only)
- `GET /api/audit/export` - Export audit logs as CSV (Admin/Owner only)
- `GET /api/audit/verify` - Verify audit trail integrity

**Blockchain-like chaining:**
```typescript
function createAuditEntry(event: AuditEvent): AuditLog {
  const previousEntry = await getLastAuditEntry()

  const entry = {
    ...event,
    previous_hash: previousEntry?.entry_hash || null,
    entry_hash: null, // Will be calculated
  }

  // Calculate hash of this entry (excludes entry_hash field)
  entry.entry_hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(entry))
    .digest('hex')

  return entry
}
```

---

### 🤖 [AUTONOMOUS] 6.5 Granular Permissions Implementation

Claude Code will implement per-content permission flags:

**Logic already in schema, now add UI controls:**

- Admin toggle switches for each article/page/product:
  - "Author can edit" (checkbox)
  - "Author can delete" (checkbox)
  - "Admins can edit" (checkbox)
  - "Admins can delete" (checkbox)

- Permission evaluation (already described in Phase 3)

**Endpoints:**
- `PATCH /api/articles/:id/permissions` - Update article permissions (Owner only)
- `PATCH /api/products/:id/permissions` - Update product permissions (Owner only)

---

### 👁️ [HUMAN VERIFICATION] Phase 6 Complete

**Checklist (20 minutes):**
- ✅ Comments can be posted on articles
- ✅ Comments with profanity are bleached
- ✅ OpenAI moderation flags inappropriate comments
- ✅ Admin receives notification for flagged comments
- ✅ Product reviews work similarly to comments
- ✅ Audit trail logs all events correctly
- ✅ Audit trail chain integrity verified
- ✅ Audit log export to CSV works
- ✅ Granular permission toggles work
- ✅ Permission evaluation respects content-level flags
- ✅ Test coverage ≥80%

**Test AI moderation:**
```bash
# Post comment with profanity
curl -X POST http://localhost:4000/api/articles/test-article/comments \
  -H "Authorization: Bearer MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "This is a damn good article!"}'

# Check comment is posted but profanity is bleached
curl http://localhost:4000/api/articles/test-article/comments
# Should show: "This is a **** good article!"

# Post comment with hate speech
curl -X POST http://localhost:4000/api/articles/test-article/comments \
  -H "Authorization: Bearer MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "[inappropriate content]"}'

# Check admin moderation queue
curl http://localhost:4000/api/admin/comments/flagged \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Should show flagged comment with OpenAI moderation flags
```

---

## Phase 7: Digital Products - eBooks (Week 14)

### 👤 [HUMAN REQUIRED] 7.1 AWS SES Setup for "Send to Kindle"

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to Amazon SES (Simple Email Service)
3. Verify your domain or email address
4. Request production access (if not already granted)
5. Create SMTP credentials
6. Add to `.env`:
   ```bash
   AWS_SES_REGION=us-east-1
   AWS_SES_ACCESS_KEY_ID=...
   AWS_SES_SECRET_ACCESS_KEY=...
   AWS_SES_FROM_EMAIL=noreply@yourdomain.com
   ```

**Cost estimate:** $0.10 per 1,000 emails (first 62,000 per month free with EC2)

**Time estimate:** 30 minutes (plus 1-2 days for production access approval)

---

### 🤖 [AUTONOMOUS] 7.2 Digital Products Module

Claude Code will implement eBook functionality:

**Dependencies:**
```bash
npm install adm-zip jsdom pdf-lib nodemailer
npm install -D @types/adm-zip @types/jsdom @types/nodemailer
npm install aws-sdk  # for SES
```

**Files to create:**
- `backend/src/modules/digital-products/digital-products.module.ts`
- `backend/src/modules/digital-products/digital-products.service.ts`
- `backend/src/modules/digital-products/digital-products.controller.ts`
- `backend/src/modules/digital-products/ebook-processor.service.ts`
- `backend/src/modules/digital-products/kindle.service.ts`
- `backend/src/modules/digital-products/dto/*.dto.ts`
- `backend/src/modules/digital-products/digital-products.service.spec.ts` (55+ tests)

**Features:**
- ✅ EPUB and PDF file upload
- ✅ eBook personalization/stamping (customer name, order number, date)
- ✅ Pre-publication personalization testing
- ✅ Download token generation (7-day expiry, 5 downloads per format)
- ✅ Download counter tracking
- ✅ Send to Kindle email delivery
- ✅ Kindle device management

**Endpoints:**
- `POST /api/digital-products/:productId/upload` - Upload EPUB/PDF (Admin)
- `POST /api/digital-products/:productId/test-personalization` - Test stamping (Admin)
- `GET /api/digital-products/download/:token` - Download eBook (user)
- `POST /api/digital-products/:productId/send-to-kindle` - Email to Kindle (user)
- `GET /api/users/me/kindle-devices` - List Kindle devices
- `POST /api/users/me/kindle-devices` - Add Kindle device
- `DELETE /api/users/me/kindle-devices/:id` - Remove Kindle device

**EPUB personalization logic:**
```typescript
async personalizeEpub(
  epubPath: string,
  customerName: string,
  orderNumber: string,
  purchaseDate: Date
): Promise<Buffer> {
  const zip = new AdmZip(epubPath)

  // Find content.opf or .html files
  const entries = zip.getEntries()

  for (const entry of entries) {
    if (entry.entryName.endsWith('.html') || entry.entryName.endsWith('.xhtml')) {
      let content = entry.getData().toString('utf8')

      // Inject personalization at beginning of first chapter
      const personalizationHTML = `
        <div style="page-break-after: always; text-align: center; padding: 2em;">
          <p><strong>This book belongs to:</strong></p>
          <p>${customerName}</p>
          <p><em>Purchased on ${purchaseDate.toLocaleDateString()}</em></p>
          <p><small>Order #${orderNumber}</small></p>
        </div>
      `

      // Insert after <body> tag
      content = content.replace('<body>', `<body>${personalizationHTML}`)

      zip.updateFile(entry, Buffer.from(content, 'utf8'))
      break  // Only personalize first content file
    }
  }

  return zip.toBuffer()
}
```

**PDF personalization logic:**
```typescript
async personalizePdf(
  pdfPath: string,
  customerName: string,
  orderNumber: string,
  purchaseDate: Date
): Promise<Buffer> {
  const existingPdfBytes = await fs.readFile(pdfPath)
  const pdfDoc = await PDFDocument.load(existingPdfBytes)

  // Create personalization page
  const page = pdfDoc.insertPage(0)  // Insert at beginning
  const { width, height } = page.getSize()
  const fontSize = 12

  page.drawText('This book belongs to:', {
    x: width / 2 - 60,
    y: height / 2 + 40,
    size: fontSize,
  })

  page.drawText(customerName, {
    x: width / 2 - (customerName.length * fontSize / 4),
    y: height / 2 + 20,
    size: fontSize + 4,
  })

  page.drawText(`Purchased on ${purchaseDate.toLocaleDateString()}`, {
    x: width / 2 - 70,
    y: height / 2 - 10,
    size: fontSize - 2,
  })

  page.drawText(`Order #${orderNumber}`, {
    x: width / 2 - 50,
    y: height / 2 - 30,
    size: fontSize - 4,
  })

  return Buffer.from(await pdfDoc.save())
}
```

---

### 👁️ [HUMAN VERIFICATION] 7.3 eBook Testing

**CRITICAL: Test eBook personalization manually (30 minutes)**

1. **Upload test EPUB:**
   ```bash
   curl -X POST http://localhost:4000/api/digital-products/PRODUCT_ID/upload \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -F "file=@/path/to/test.epub" \
     -F "format=epub"
   ```

2. **Test personalization:**
   ```bash
   curl -X POST http://localhost:4000/api/digital-products/PRODUCT_ID/test-personalization \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"format": "epub"}'
   ```
   Download the returned file and open in an eReader (Calibre, Apple Books, etc.)
   Verify personalization page appears at the beginning.

3. **Purchase product and test download:**
   - Complete checkout flow
   - Check order confirmation email for download link
   - Click download link
   - Verify personalized eBook downloads
   - Verify customer name, order number, and date are correct

4. **Test download limits:**
   - Download the eBook 5 times (per format)
   - Attempt 6th download
   - Verify error message: "Download limit exceeded"

5. **Test Kindle delivery:**
   - Add Kindle device to account
   - Click "Send to Kindle" for purchased eBook
   - Check Kindle email inbox
   - Verify email received with attachment
   - Verify eBook appears on Kindle device

6. **Test multi-format:**
   - Purchase product with both EPUB and PDF
   - Download EPUB (counter: 1/5 for EPUB)
   - Download PDF (counter: 1/5 for PDF)
   - Verify counters are independent

---

### 👁️ [HUMAN VERIFICATION] Phase 7 Complete

**Checklist (30 minutes):**
- ✅ EPUB upload works
- ✅ PDF upload works
- ✅ Personalization test creates readable eBook
- ✅ Personalization includes customer name, order number, date
- ✅ Download tokens work and expire after 7 days
- ✅ Download counter enforces limits (5 per format)
- ✅ Send to Kindle email delivery works
- ✅ Kindle device management works (add/remove/list)
- ✅ Multi-format products work with independent counters
- ✅ Test coverage ≥80%

---

## Phase 8: Frontend Application (Weeks 15-17)

### 🤖 [AUTONOMOUS] 8.1 Frontend Foundation

Claude Code will create Next.js application structure:

**Files to create:**
- `frontend/lib/api-client.ts` - API client with authentication
- `frontend/lib/auth-context.tsx` - Auth context provider
- `frontend/hooks/use-auth.ts` - Auth hook
- `frontend/hooks/use-cart.ts` - Cart hook
- `frontend/components/layout/header.tsx`
- `frontend/components/layout/footer.tsx`
- `frontend/components/ui/*.tsx` - Reusable UI components

**Install additional dependencies:**
```bash
cd frontend
npm install @headlessui/react @heroicons/react
npm install date-fns zod
npm install js-cookie
npm install -D @types/js-cookie
```

---

### 🤖 [AUTONOMOUS] 8.2 Public Pages

Claude Code will create public-facing pages:

**Pages to create:**
- `app/page.tsx` - Homepage
- `app/articles/page.tsx` - Articles list
- `app/articles/[slug]/page.tsx` - Article detail
- `app/shop/page.tsx` - Product catalog
- `app/shop/[slug]/page.tsx` - Product detail page
- `app/cart/page.tsx` - Shopping cart
- `app/checkout/page.tsx` - Checkout flow
- `app/login/page.tsx` - Login modal/page
- `app/register/page.tsx` - Registration

**Features:**
- ✅ Server-side rendering (SSR) for SEO
- ✅ Static generation (SSG) for published content
- ✅ Image optimization with next/image
- ✅ Responsive design (mobile-first)
- ✅ Loading states
- ✅ Error boundaries

---

### 🤖 [AUTONOMOUS] 8.3 Admin Dashboard

Claude Code will create admin interface:

**Pages to create:**
- `app/admin/page.tsx` - Dashboard overview
- `app/admin/login/page.tsx` - Admin login with 2FA
- `app/admin/articles/page.tsx` - Articles management
- `app/admin/articles/new/page.tsx` - Create article
- `app/admin/articles/[id]/edit/page.tsx` - Edit article
- `app/admin/products/page.tsx` - Products management
- `app/admin/products/new/page.tsx` - Create product
- `app/admin/products/[id]/edit/page.tsx` - Edit product
- `app/admin/orders/page.tsx` - Orders management
- `app/admin/orders/[id]/page.tsx` - Order detail
- `app/admin/users/page.tsx` - User management
- `app/admin/media/page.tsx` - Media library
- `app/admin/comments/page.tsx` - Comment moderation
- `app/admin/settings/page.tsx` - System settings

**Features:**
- ✅ Rich text editor (TipTap) for content
- ✅ Media picker for images
- ✅ Drag-and-drop file upload
- ✅ Form validation with React Hook Form
- ✅ Data tables with pagination, sorting, filtering
- ✅ Role-based UI visibility

---

### 🤖 [AUTONOMOUS] 8.4 Product Embedding in TipTap

Claude Code will create TipTap extension:

**Files:**
- `frontend/components/editor/product-picker.tsx`
- `frontend/components/editor/extensions/product-embed.ts`
- `frontend/components/product-embed.tsx` - Render embedded product

**Features:**
- ✅ TipTap command: "Insert → Product"
- ✅ Visual product picker modal
- ✅ Display modes: card, inline, grid
- ✅ Real-time price/stock updates
- ✅ Functional add-to-cart within article

---

### 🤖 [AUTONOMOUS] 8.5 E2E Tests with Playwright

Claude Code will create end-to-end tests:

**Test files:**
- `frontend/tests/auth.spec.ts` - Authentication flows
- `frontend/tests/articles.spec.ts` - Article browsing and reading
- `frontend/tests/shop.spec.ts` - Product browsing and cart
- `frontend/tests/checkout.spec.ts` - Complete checkout flow
- `frontend/tests/admin.spec.ts` - Admin dashboard operations

**Example E2E test:**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Checkout Flow', () => {
  test('guest can purchase product with Stripe', async ({ page }) => {
    // Navigate to shop
    await page.goto('http://localhost:3000/shop')

    // Click first product
    await page.click('[data-testid="product-card"]:first-child')

    // Add to cart
    await page.click('[data-testid="add-to-cart"]')

    // Go to cart
    await page.goto('http://localhost:3000/cart')

    // Verify item in cart
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1)

    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]')

    // Fill shipping info
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="address"]', '123 Test St')
    await page.fill('[name="city"]', 'Test City')
    await page.fill('[name="zip"]', '12345')
    await page.click('[data-testid="continue-to-payment"]')

    // Fill Stripe test card
    const stripeFrame = page.frameLocator('[name*="stripe"]')
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242')
    await stripeFrame.locator('[name="exp-date"]').fill('12/34')
    await stripeFrame.locator('[name="cvc"]').fill('123')
    await stripeFrame.locator('[name="postal"]').fill('12345')

    // Complete payment
    await page.click('[data-testid="complete-order"]')

    // Wait for confirmation
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible()

    // Verify order number displayed
    await expect(page.locator('[data-testid="order-number"]')).toContainText('ORD-')
  })

  test('member can login and see order history', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('[name="email"]', 'member@example.com')
    await page.fill('[name="password"]', 'MemberPassword123!')
    await page.click('[data-testid="login-submit"]')

    // Navigate to orders
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="my-orders"]')

    // Verify orders page
    await expect(page.locator('[data-testid="order-list"]')).toBeVisible()
  })

  test('admin can login with 2FA', async ({ page }) => {
    // Navigate to admin
    await page.goto('http://localhost:3000/admin')

    // Fill admin credentials
    await page.fill('[name="email"]', 'admin@example.com')
    await page.fill('[name="password"]', 'AdminPassword123!')
    await page.click('[data-testid="admin-login"]')

    // 2FA challenge should appear
    await expect(page.locator('[data-testid="2fa-challenge"]')).toBeVisible()

    // Note: Can't test actual TOTP without hardcoding secret or using test mode
    // In real test, you'd use a test TOTP generator
  })
})
```

**Run E2E tests:**
```bash
cd frontend
npx playwright test
```

---

### 🤝 [HUMAN DECISION] 8.6 Design and UX Review

While Claude Code can build functional UI, you should review:

**Areas for human input (1-2 hours):**
- Color scheme and branding
- Typography choices
- Layout preferences (sidebar vs no sidebar)
- Navigation structure
- Button styles and hover states
- Mobile responsive breakpoints
- Accessibility improvements (contrast, focus states)

**Process:**
1. Claude Code builds functional UI with basic Tailwind styling
2. You review in browser and provide feedback
3. Claude Code adjusts based on your preferences
4. Iterate until satisfied

---

### 👁️ [HUMAN VERIFICATION] Phase 8 Complete

**Checklist (1-2 hours for thorough testing):**

**Public Site:**
- ✅ Homepage loads and looks good
- ✅ Articles list displays
- ✅ Individual articles render correctly
- ✅ Shop displays products
- ✅ Product detail page shows all information
- ✅ Add to cart works
- ✅ Cart updates correctly (add/remove/update quantity)
- ✅ Checkout flow completes successfully
- ✅ Login/registration works
- ✅ OAuth login works (Google)
- ✅ Mobile responsive (test on phone or resize browser)

**Admin Dashboard:**
- ✅ Admin login with 2FA works
- ✅ Dashboard overview displays stats
- ✅ Create article with TipTap editor
- ✅ Upload media to article
- ✅ Embed product in article (TipTap picker)
- ✅ Create product with images
- ✅ View orders list
- ✅ Update order status
- ✅ Moderate flagged comments
- ✅ View audit logs
- ✅ Export audit logs to CSV
- ✅ Update system settings

**E2E Tests:**
- ✅ All Playwright tests pass (25+ tests)

**Performance:**
- ✅ Homepage loads in < 2 seconds
- ✅ Article pages load in < 1 second
- ✅ Product pages load in < 1 second
- ✅ Admin dashboard loads in < 2 seconds

---

## Phase 9: WordPress Migration (Week 18)

### 👤 [HUMAN REQUIRED] 9.1 WordPress Database Export

Before Claude Code can run migration:

1. Log into your WordPress site
2. Go to phpMyAdmin or use CLI:
   ```bash
   mysqldump -u username -p wordpress_db > wordpress-export.sql
   ```
3. Download the SQL file
4. Place it in `scripts/migrate-wordpress/wordpress-export.sql`

**Alternative:** Export via WordPress admin (Tools → Export), but database export is more comprehensive.

---

### 🤖 [AUTONOMOUS] 9.2 WordPress Migration Script

Claude Code will create migration tool:

**Files:**
- `scripts/migrate-wordpress/migrate.ts`
- `scripts/migrate-wordpress/parsers/posts.parser.ts`
- `scripts/migrate-wordpress/parsers/pages.parser.ts`
- `scripts/migrate-wordpress/parsers/categories.parser.ts`
- `scripts/migrate-wordpress/parsers/media.parser.ts`
- `scripts/migrate-wordpress/parsers/comments.parser.ts`
- `scripts/migrate-wordpress/transformers/html.transformer.ts`
- `scripts/migrate-wordpress/transformers/shortcode.transformer.ts`

**Features:**
- ✅ Parse WordPress SQL export
- ✅ Transform wp_posts → articles/pages
- ✅ Transform wp_terms → categories/tags
- ✅ Transform wp_comments → comments
- ✅ Download media from wp-content/uploads
- ✅ Transform WordPress shortcodes to AECMS equivalents
- ✅ Generate redirect map for SEO
- ✅ AI moderation for imported comments

**Run migration:**
```bash
cd scripts/migrate-wordpress
npm install
npm run migrate -- --sql-file=wordpress-export.sql --wp-url=https://oldsite.com
```

---

### 👁️ [HUMAN VERIFICATION] 9.3 Migration Validation

**Checklist (1 hour):**
- ✅ All articles imported (count matches)
- ✅ All pages imported with correct hierarchy
- ✅ Categories and tags imported
- ✅ Media files downloaded and linked
- ✅ Featured images set correctly
- ✅ Comments imported and moderated
- ✅ URLs in content transformed correctly
- ✅ Shortcodes converted
- ✅ Redirect map generated (`redirects.json`)

**Spot check articles:**
- Open 5-10 random articles
- Verify formatting looks correct
- Verify images display
- Verify links work
- Verify categories/tags assigned

---

## Phase 10: Production Deployment (Weeks 19-20)

### 🤖 [AUTONOMOUS] 10.1 CI/CD Pipeline

Claude Code will create GitHub Actions workflow:

**File:** `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run backend linter
        working-directory: ./backend
        run: npm run lint

      - name: Run backend tests
        working-directory: ./backend
        run: npm run test:cov

      - name: Install frontend dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run frontend linter
        working-directory: ./frontend
        run: npm run lint

      - name: Run frontend build
        working-directory: ./frontend
        run: npm run build

      - name: Run E2E tests
        working-directory: ./frontend
        run: npx playwright test

  docker:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: docker-compose build

      - name: Run Docker Compose
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Check services health
        run: docker-compose ps

      - name: Stop services
        run: docker-compose down
```

---

### 👤 [HUMAN REQUIRED] 10.2 Production Hosting Setup

Choose one of the following deployment options:

#### Option A: Railway (Recommended for MVP)

1. Go to [Railway.app](https://railway.app/)
2. Sign up with GitHub
3. Create new project
4. Deploy from GitHub repository
5. Add PostgreSQL database (free tier: 512 MB)
6. Add Redis (free tier: 100 MB)
7. Set environment variables in Railway dashboard
8. Deploy

**Cost:** Free for hobby projects, $5/month after free trial

#### Option B: Oracle Cloud (Free Tier Forever)

1. Create [Oracle Cloud account](https://www.oracle.com/cloud/free/)
2. Create VM instance (Always Free: 1GB RAM, 2 OCPUs)
3. Install Docker and Docker Compose
4. Clone repository
5. Set up environment variables
6. Run `docker-compose up -d`

**Cost:** Free forever (subject to Oracle Free Tier limits)

#### Option C: VPS (DigitalOcean, Linode, Vultr)

1. Create account
2. Create droplet/instance ($5-10/month)
3. SSH into server
4. Install Docker and Docker Compose
5. Clone repository
6. Set up environment variables
7. Run `docker-compose up -d`
8. Set up Nginx reverse proxy (optional)
9. Configure SSL with Let's Encrypt

**Cost:** $5-10/month

---

### 👤 [HUMAN REQUIRED] 10.3 Domain and SSL Setup

1. **Purchase domain** (if not already owned):
   - Namecheap, Google Domains, Cloudflare Registrar
   - Cost: $10-15/year

2. **Configure DNS** (at Cloudflare - free):
   - Add domain to Cloudflare
   - Point A records to your server IP
   - Enable Cloudflare proxy (orange cloud) for free SSL and DDoS protection

3. **Configure SSL**:
   - If using Cloudflare proxy: Automatic
   - If not using Cloudflare: Use Let's Encrypt with Certbot

---

### 🤖 [AUTONOMOUS] 10.4 Production Environment Configuration

Claude Code will create production configs:

**Files:**
- `docker-compose.prod.yml` - Production Docker Compose
- `backend/.env.production.example` - Production env template
- `frontend/.env.production.example` - Frontend production env
- `nginx.conf` - Nginx configuration (if self-hosting)

**Production optimizations:**
- Enable compression
- Set cache headers
- Rate limiting (Redis-backed)
- Security headers (Helmet.js)
- HTTPS-only cookies
- Production logging (Winston)

---

### 👁️ [HUMAN VERIFICATION] 10.5 Production Smoke Tests

**Critical tests to run on production (30 minutes):**

1. **Basic functionality:**
   - ✅ Homepage loads
   - ✅ Can browse articles
   - ✅ Can browse products
   - ✅ Can add to cart
   - ✅ Can register account
   - ✅ Can login (front door)
   - ✅ Admin login works (back door + 2FA)

2. **Payment processing (REAL MONEY - test carefully):**
   - ✅ Stripe production keys configured
   - ✅ Complete ONE test purchase with real card
   - ✅ Verify order created
   - ✅ Verify payment in Stripe dashboard
   - ✅ Verify order confirmation email received
   - ✅ IMMEDIATELY REFUND test order

3. **Security:**
   - ✅ HTTPS enabled (padlock in browser)
   - ✅ HTTP redirects to HTTPS
   - ✅ 2FA required for admin login
   - ✅ No sensitive data in browser console
   - ✅ API rate limiting works (try rapid requests)
   - ✅ SQL injection test fails (try `' OR '1'='1` in search)
   - ✅ XSS test fails (try `<script>alert('XSS')</script>` in comment)

4. **Performance:**
   - ✅ Google PageSpeed Insights score > 80
   - ✅ Homepage loads < 2 seconds
   - ✅ Images optimized and lazy-loaded
   - ✅ Mobile performance acceptable

5. **Monitoring:**
   - ✅ Error logging configured (logs visible in hosting dashboard)
   - ✅ Database backups enabled (check hosting provider settings)
   - ✅ Uptime monitoring configured (UptimeRobot or similar)

---

### 👁️ [HUMAN VERIFICATION] Phase 10 Complete

**Final Production Checklist:**

**Deployment:**
- ✅ GitHub Actions CI/CD passing
- ✅ Production environment deployed
- ✅ Domain configured and SSL enabled
- ✅ Database migrations run successfully
- ✅ Seed data loaded (owner account, capabilities)

**Configuration:**
- ✅ All environment variables set in production
- ✅ Stripe production keys configured
- ✅ PayPal production credentials configured
- ✅ OAuth production credentials (Google/Apple)
- ✅ AWS SES production access granted
- ✅ OpenAI API key configured

**Security:**
- ✅ Owner password changed from default
- ✅ Owner 2FA enabled
- ✅ Database password strong and unique
- ✅ JWT secret random and secure
- ✅ API key encryption key set
- ✅ HTTPS enforced
- ✅ Security headers configured
- ✅ Rate limiting enabled

**Functionality:**
- ✅ Public site works (articles, shop, cart, checkout)
- ✅ Authentication works (login, register, OAuth)
- ✅ Admin dashboard works (2FA required)
- ✅ Payments work (Stripe test completed and refunded)
- ✅ Email delivery works (order confirmations, Send to Kindle)
- ✅ Comments and reviews work with AI moderation
- ✅ Digital product downloads work
- ✅ Audit trail logging enabled

**Monitoring & Backups:**
- ✅ Database backups configured (daily recommended)
- ✅ Error logging configured
- ✅ Uptime monitoring configured
- ✅ Disk space alerts configured

**Documentation:**
- ✅ README.md updated with deployment instructions
- ✅ Environment variables documented in `.env.example`
- ✅ API documentation generated (Swagger UI accessible)

---

## 🎉 Project Complete!

**Total Duration:** 20 weeks (moderate pace)

**Total Test Coverage:**
- Backend: ≥80% (500+ tests)
- Frontend: ≥70% (100+ component tests)
- E2E: 25+ critical flow tests

**What Claude Code Built Autonomously:**
- ✅ Complete database schema (Prisma)
- ✅ Authentication system (JWT, OAuth, 2FA)
- ✅ Capability-based RBAC
- ✅ Content management (articles, pages, media)
- ✅ Ecommerce (products, cart, orders)
- ✅ Payment integration (Stripe, PayPal, Amazon Pay)
- ✅ Comments & reviews with AI moderation
- ✅ Audit trail logging
- ✅ Digital products (eBooks with personalization)
- ✅ Frontend application (Next.js)
- ✅ Admin dashboard (full-featured)
- ✅ WordPress migration script
- ✅ CI/CD pipeline
- ✅ 600+ automated tests
- ✅ Complete documentation

**What Required Human Intervention:**
- Account creation (OAuth providers, payment processors, AWS, OpenAI)
- API key configuration
- Domain and SSL setup
- Production deployment choices
- Design/UX review and preferences
- Final production smoke testing
- Payment testing with real money
- Security verification

---

## Maintenance & Next Steps

### 🤖 [AUTONOMOUS] Ongoing Development

Claude Code can continue to help with:
- Adding new features
- Bug fixes
- Performance optimizations
- Security updates
- Database migrations
- Test additions

### 👤 [HUMAN REQUIRED] Regular Maintenance

You should handle:
- Monitoring server health
- Reviewing audit logs (weekly)
- Moderating flagged comments
- Processing refunds
- Updating dependencies (monthly)
- Database backups verification (weekly)
- Security updates (as needed)
- Content creation and publishing

---

## Summary of Human Involvement

### Setup Phase (Phase 0-1):
- **~2 hours:** Install Docker, Node.js, generate secrets, create OAuth apps

### Authentication Phase (Phase 2):
- **~15 minutes:** Change default owner password, enable 2FA

### Payment Phase (Phase 5):
- **~1 hour:** Create Stripe, PayPal, Amazon Pay accounts
- **~45 minutes:** Test all payment flows thoroughly

### Digital Products Phase (Phase 7):
- **~30 minutes:** AWS SES setup
- **~30 minutes:** Test eBook personalization and Kindle delivery

### Frontend Phase (Phase 8):
- **~1-2 hours:** Review design, provide UX feedback
- **~1-2 hours:** Manual testing of all features

### Migration Phase (Phase 9):
- **~30 minutes:** Export WordPress database
- **~1 hour:** Validate migrated content

### Production Phase (Phase 10):
- **~2-3 hours:** Set up hosting, domain, SSL
- **~30 minutes:** Production smoke tests
- **~15 minutes:** Configure monitoring and backups

**Total Human Time:** ~10-15 hours over 20 weeks

**Claude Code Autonomous Time:** ~160-180 hours of development work

---

## Contact & Support

If you encounter issues during development:

1. Check error logs (Docker logs, browser console)
2. Verify environment variables are set correctly
3. Ensure all services are running (`docker-compose ps`)
4. Check database connectivity
5. Review test output for specific failures
6. Ask Claude Code to debug specific issues

For Claude Code questions: `/help`

---

**End of Implementation Plan v2.0**
