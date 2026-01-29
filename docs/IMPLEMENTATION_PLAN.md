# AECMS Implementation Plan

**Version:** 1.0
**Date:** 2026-01-29
**Status:** Implementation Roadmap
**Optimized for:** Agentic coding via Claude Code

## Overview

This document provides a comprehensive phased development plan for AECMS, optimized for implementation by Claude Code with automated testing and validation at each phase.

## Guiding Principles

1. **Incremental Development**: Each phase produces working, testable functionality
2. **Test-Driven**: Write tests before or alongside implementation
3. **Automated Validation**: Maximize what Claude Code can validate automatically
4. **Clear Dependencies**: Each phase builds on previous phases
5. **Database-First**: Define schema early, migrate incrementally
6. **API-First**: Backend APIs before frontend UI
7. **Security from Start**: Authentication and authorization in Phase 1

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

### Prerequisites
- Docker installed
- Node.js 20+ installed
- Git repository initialized

### Deliverables

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
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # Reusable components
│   │   ├── lib/             # Utilities, API clients
│   │   └── styles/          # Global styles, Tailwind
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

#### 0.2 Docker Compose Configuration
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: aecms
      POSTGRES_USER: aecms
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://aecms:${DB_PASSWORD}@postgres:5432/aecms
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    depends_on:
      - backend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
```

#### 0.3 Backend Initialization
```bash
# Initialize NestJS
npx @nestjs/cli new backend

# Install core dependencies
cd backend
npm install @nestjs/config @nestjs/swagger
npm install @prisma/client prisma
npm install class-validator class-transformer
npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken

# Initialize Prisma
npx prisma init
```

#### 0.4 Frontend Initialization
```bash
# Initialize Next.js
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir

# Install core dependencies
cd frontend
npm install swr axios
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @tiptap/react @tiptap/starter-kit
```

### Testing Strategy

**Validation Checklist (Claude Code can run):**
```bash
# Backend health check
cd backend
npm run build
npm run test

# Frontend health check
cd frontend
npm run build
npm run lint

# Docker compose check
docker-compose config
docker-compose up -d
docker-compose ps  # All services should be "running"

# Database connection check
docker exec aecms-postgres psql -U aecms -c "SELECT version();"

# Redis connection check
docker exec aecms-redis redis-cli ping  # Should return PONG
```

**Success Criteria:**
- ✅ All services start successfully
- ✅ Backend responds at `http://localhost:4000`
- ✅ Frontend responds at `http://localhost:3000`
- ✅ Database accepts connections
- ✅ Redis responds to ping
- ✅ `npm run build` succeeds for both backend and frontend

---

## Phase 1: Database Schema & Core Auth (Week 2-3)

### Prerequisites
- Phase 0 complete

### Deliverables

#### 1.1 Core Database Schema (Prisma)

**File: `backend/prisma/schema.prisma`**

Create initial schema with core models:
- User (with roles, OAuth, 2FA fields)
- Role & Capability tables
- EmailVerificationToken
- PasswordResetToken
- RefreshToken
- Session

**Migration:**
```bash
npx prisma migrate dev --name init_core_schema
npx prisma generate
```

#### 1.2 Authentication Module

**Files to create:**
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/modules/auth/strategies/jwt-refresh.strategy.ts`
- `src/modules/auth/strategies/google.strategy.ts`
- `src/modules/auth/strategies/apple.strategy.ts`
- `src/modules/auth/guards/jwt-auth.guard.ts`
- `src/modules/auth/guards/roles.guard.ts`
- `src/modules/auth/decorators/current-user.decorator.ts`
- `src/modules/auth/decorators/roles.decorator.ts`
- `src/modules/auth/dto/register.dto.ts`
- `src/modules/auth/dto/login.dto.ts`

**API Endpoints to implement:**
```typescript
POST   /api/auth/register              // Email/password registration
POST   /api/auth/login                 // Email/password login
POST   /api/auth/refresh               // Refresh access token
POST   /api/auth/logout                // Logout (invalidate refresh token)
GET    /api/auth/me                    // Get current user
POST   /api/auth/verify-email          // Verify email with token
POST   /api/auth/resend-verification   // Resend verification email
POST   /api/auth/forgot-password       // Request password reset
POST   /api/auth/reset-password        // Reset password with token
POST   /api/auth/oauth/google          // Google OAuth login
POST   /api/auth/oauth/apple           // Apple OAuth login
```

#### 1.3 Users Module

**Files to create:**
- `src/modules/users/users.module.ts`
- `src/modules/users/users.service.ts`
- `src/modules/users/users.controller.ts`
- `src/modules/users/dto/create-user.dto.ts`
- `src/modules/users/dto/update-user.dto.ts`

**API Endpoints:**
```typescript
GET    /api/users                      // List users (Admin+)
GET    /api/users/:id                  // Get user by ID
POST   /api/users                      // Create user (Admin+)
PUT    /api/users/:id                  // Update user
DELETE /api/users/:id                  // Delete user (Admin+)
PUT    /api/users/:id/role             // Change user role (Owner only)
POST   /api/users/:id/force-password-reset  // Force password reset
```

### Testing Strategy

#### Unit Tests (Jest)

**File: `src/modules/auth/auth.service.spec.ts`**
```typescript
describe('AuthService', () => {
  it('should hash passwords with bcrypt cost 12', async () => {
    const password = 'Test123!@#$%^&*()_+'
    const hash = await authService.hashPassword(password)
    expect(hash).not.toBe(password)
    expect(await bcrypt.compare(password, hash)).toBe(true)
  })

  it('should validate password requirements', () => {
    expect(authService.validatePassword('short')).toBe(false)
    expect(authService.validatePassword('nouppercaseorspecial123')).toBe(false)
    expect(authService.validatePassword('NOLOWERORSPECIAL123')).toBe(false)
    expect(authService.validatePassword('ValidPass123!')).toBe(true)
  })

  it('should generate secure tokens', () => {
    const token = authService.generateSecureToken()
    expect(token.length).toBe(64) // 32 bytes hex = 64 chars
  })

  it('should create JWT with correct claims', async () => {
    const user = { id: '123', email: 'test@example.com', role: 'member' }
    const token = authService.createAccessToken(user)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    expect(decoded.sub).toBe(user.id)
    expect(decoded.email).toBe(user.email)
    expect(decoded.role).toBe(user.role)
  })
})
```

**File: `src/modules/users/users.service.spec.ts`**
```typescript
describe('UsersService', () => {
  it('should not allow duplicate emails', async () => {
    await usersService.create({ email: 'test@example.com', ... })
    await expect(
      usersService.create({ email: 'test@example.com', ... })
    ).rejects.toThrow('Email already exists')
  })

  it('should soft delete users', async () => {
    const user = await usersService.create({ ... })
    await usersService.delete(user.id)
    const deleted = await usersService.findById(user.id)
    expect(deleted.deleted_at).not.toBeNull()
  })
})
```

#### Integration Tests (Supertest)

**File: `test/auth.e2e-spec.ts`**
```typescript
describe('Auth (e2e)', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  describe('POST /auth/register', () => {
    it('should register new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'ValidPassword123!',
          displayName: 'New User'
        })
        .expect(201)
        .expect(res => {
          expect(res.body.email).toBe('newuser@example.com')
          expect(res.body.email_verified).toBe(false)
          expect(res.body.password_hash).toBeUndefined() // Not exposed
        })
    })

    it('should require valid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          displayName: 'Test'
        })
        .expect(400)
    })

    it('should require 16+ char password with uppercase and special', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          displayName: 'Test'
        })
        .expect(400)
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createVerifiedUser({ email: 'test@example.com', password: 'ValidPassword123!' })
    })

    it('should login with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!'
        })
        .expect(200)
        .expect(res => {
          expect(res.body.access_token).toBeDefined()
          expect(res.headers['set-cookie']).toBeDefined() // Refresh token cookie
        })
    })

    it('should not login with unverified email', async () => {
      await createUnverifiedUser({ email: 'unverified@example.com', password: 'ValidPassword123!' })

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'ValidPassword123!'
        })
        .expect(403)
        .expect(res => {
          expect(res.body.message).toContain('Email not verified')
        })
    })

    it('should rate limit after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      }

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPassword123!' })
        .expect(429) // Too Many Requests
    })
  })

  describe('POST /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const { user, token } = await createUnverifiedUserWithToken()

      return request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200)
        .then(async () => {
          const updated = await prisma.user.findUnique({ where: { id: user.id } })
          expect(updated.email_verified).toBe(true)
        })
    })

    it('should reject expired token', async () => {
      const { token } = await createExpiredVerificationToken()

      return request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('expired')
        })
    })
  })

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const { refreshToken } = await loginUser('test@example.com', 'ValidPassword123!')

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.access_token).toBeDefined()
          expect(res.body.access_token).not.toBe(oldAccessToken)
        })
    })

    it('should reject revoked refresh token', async () => {
      const { refreshToken } = await loginUser('test@example.com', 'ValidPassword123!')
      await revokeRefreshToken(refreshToken)

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401)
    })
  })
})
```

**File: `test/users.e2e-spec.ts`**
```typescript
describe('Users (e2e)', () => {
  let ownerToken: string
  let adminToken: string
  let memberToken: string

  beforeEach(async () => {
    await cleanDatabase()
    ownerToken = await createAndLoginUser({ role: 'owner' })
    adminToken = await createAndLoginUser({ role: 'admin' })
    memberToken = await createAndLoginUser({ role: 'member' })
  })

  describe('GET /users', () => {
    it('should allow Owner to list all users', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.length).toBeGreaterThan(0)
        })
    })

    it('should allow Admin to list all users', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    })

    it('should forbid Member from listing users', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403)
    })
  })

  describe('PUT /users/:id/role', () => {
    it('should allow Owner to promote Member to Admin', async () => {
      const member = await createUser({ role: 'member' })

      return request(app.getHttpServer())
        .put(`/users/${member.id}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'admin' })
        .expect(200)
        .then(async () => {
          const updated = await prisma.user.findUnique({ where: { id: member.id } })
          expect(updated.role).toBe('admin')
        })
    })

    it('should forbid Admin from promoting to Owner', async () => {
      const member = await createUser({ role: 'member' })

      return request(app.getHttpServer())
        .put(`/users/${member.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'owner' })
        .expect(403)
    })

    it('should log role change in audit trail', async () => {
      const member = await createUser({ role: 'member' })

      await request(app.getHttpServer())
        .put(`/users/${member.id}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'admin' })

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          event_type: 'user_role_changed',
          target_id: member.id
        }
      })

      expect(auditLog).toBeDefined()
      expect(auditLog.details.from).toBe('member')
      expect(auditLog.details.to).toBe('admin')
    })
  })
})
```

### Validation Checklist (Claude Code can run)

```bash
# Run all tests
cd backend
npm run test                    # Unit tests
npm run test:e2e                # Integration tests
npm run test:cov                # Coverage report (target: 80%+)

# Type checking
npm run build

# Linting
npm run lint

# Database checks
npx prisma validate             # Schema validation
npx prisma migrate status       # Migration status

# Manual API testing (optional)
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"ValidPassword123!","displayName":"Test User"}'
```

**Success Criteria:**
- ✅ All unit tests pass (100+ tests)
- ✅ All E2E tests pass (50+ scenarios)
- ✅ Test coverage ≥ 80% for auth and users modules
- ✅ Password hashing uses bcrypt cost 12
- ✅ JWT tokens expire in 15 minutes
- ✅ Refresh tokens work correctly (front door: persistent, back door: 7-day)
- ✅ Email verification required before login
- ✅ Rate limiting works (5 login attempts per 15 min)
- ✅ Role-based access control enforced
- ✅ Owner can promote Member to Admin
- ✅ Only Owner can promote to Owner
- ✅ Audit logs created for role changes

---

## Phase 2: Capability System & RBAC (Week 3-4)

### Prerequisites
- Phase 1 complete
- User roles working (Owner, Admin, Member, Guest)

### Deliverables

#### 2.1 Database Schema Updates

Add capability tables:
- Capability
- RoleCapability

**Migration:**
```bash
npx prisma migrate dev --name add_capabilities
```

#### 2.2 Capabilities Module

**Files to create:**
- `src/modules/capabilities/capabilities.module.ts`
- `src/modules/capabilities/capabilities.service.ts`
- `src/modules/capabilities/capabilities.controller.ts`
- `src/modules/capabilities/guards/capability.guard.ts`
- `src/modules/capabilities/decorators/require-capability.decorator.ts`
- `src/modules/capabilities/seeds/default-capabilities.seed.ts`

**API Endpoints:**
```typescript
GET    /api/capabilities                     // List all capabilities (Owner)
GET    /api/roles/:role/capabilities         // Get capabilities for role (Owner)
PUT    /api/roles/:role/capabilities         // Update role capabilities (Owner)
POST   /api/capabilities                     // Create new capability (Owner)
```

#### 2.3 Seed Default Capabilities

**File: `backend/prisma/seeds/capabilities.ts`**
```typescript
const defaultCapabilities = [
  // Content
  { key: 'article.create', name: 'Create Articles', category: 'Content' },
  { key: 'article.edit.own', name: 'Edit Own Articles', category: 'Content' },
  { key: 'article.edit.any', name: 'Edit Any Articles', category: 'Content' },
  { key: 'article.delete', name: 'Delete Articles', category: 'Content' },
  { key: 'page.create', name: 'Create Pages', category: 'Content' },
  { key: 'page.edit', name: 'Edit Pages', category: 'Content' },
  { key: 'media.upload', name: 'Upload Media', category: 'Content' },
  { key: 'media.delete', name: 'Delete Media', category: 'Content' },

  // Ecommerce
  { key: 'product.create', name: 'Create Products', category: 'Ecommerce' },
  { key: 'product.edit', name: 'Edit Products', category: 'Ecommerce' },
  { key: 'product.delete', name: 'Delete Products', category: 'Ecommerce' },
  { key: 'order.view.own', name: 'View Own Orders', category: 'Ecommerce' },
  { key: 'order.view.any', name: 'View All Orders', category: 'Ecommerce' },
  { key: 'order.manage', name: 'Manage Orders', category: 'Ecommerce' },
  { key: 'reports.export', name: 'Export Reports', category: 'Ecommerce' },

  // Users
  { key: 'user.create', name: 'Create Users', category: 'Users' },
  { key: 'user.edit.own', name: 'Edit Own Profile', category: 'Users' },
  { key: 'user.edit.any', name: 'Edit Any User', category: 'Users' },
  { key: 'user.delete', name: 'Delete Users', category: 'Users' },
  { key: 'users.promote', name: 'Promote to Admin', category: 'Users' },
  { key: 'users.promote.owner', name: 'Promote to Owner', category: 'Users' },
  { key: 'users.reset_password.member', name: 'Reset Member Passwords', category: 'Users' },
  { key: 'users.reset_password.admin', name: 'Reset Admin Passwords', category: 'Users' },

  // System
  { key: 'system.configure', name: 'Configure System', category: 'System' },
  { key: 'payment.configure', name: 'Configure Payments', category: 'System' },
  { key: 'capability.assign', name: 'Assign Capabilities', category: 'System' },

  // Comments
  { key: 'comment.create', name: 'Create Comments', category: 'Community' },
  { key: 'comment.edit.own', name: 'Edit Own Comments', category: 'Community' },
  { key: 'comment.delete.any', name: 'Delete Any Comment', category: 'Community' },
  { key: 'review.create', name: 'Create Reviews', category: 'Community' },
]

// Seed default role-capability mappings
const defaultRoleCapabilities = {
  owner: ['*'], // All capabilities
  admin: [
    'article.create', 'article.edit.any', 'article.delete',
    'product.create', 'product.edit', 'product.delete',
    'order.view.any', 'order.manage',
    'user.create', 'user.edit.any', 'user.delete',
    'users.reset_password.member',
    'comment.delete.any',
    'media.upload', 'media.delete',
  ],
  member: [
    'user.edit.own',
    'order.view.own',
    'comment.create', 'comment.edit.own',
    'review.create',
  ],
}
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/capabilities/capabilities.service.spec.ts`**
```typescript
describe('CapabilitiesService', () => {
  it('should return all capabilities for Owner', async () => {
    const owner = { role: 'owner' }
    const canEdit = await capabilitiesService.userHasCapability(owner, 'article.edit.any')
    expect(canEdit).toBe(true)
  })

  it('should check role capabilities for Admin', async () => {
    const admin = { role: 'admin' }
    const canEdit = await capabilitiesService.userHasCapability(admin, 'article.edit.any')
    const canConfigure = await capabilitiesService.userHasCapability(admin, 'system.configure')
    expect(canEdit).toBe(true)
    expect(canConfigure).toBe(false)
  })

  it('should allow Owner to assign capabilities', async () => {
    const capability = await capabilitiesService.create({ key: 'test.capability', ... })
    await capabilitiesService.assignToRole('admin', capability.id)
    const adminCaps = await capabilitiesService.getRoleCapabilities('admin')
    expect(adminCaps.find(c => c.key === 'test.capability')).toBeDefined()
  })
})
```

#### Integration Tests

**File: `test/capabilities.e2e-spec.ts`**
```typescript
describe('Capabilities (e2e)', () => {
  it('should prevent Admin from accessing Owner-only endpoints', () => {
    return request(app.getHttpServer())
      .post('/capabilities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'test.cap', name: 'Test', category: 'Test' })
      .expect(403)
  })

  it('should allow Owner to create new capability', () => {
    return request(app.getHttpServer())
      .post('/capabilities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ key: 'custom.capability', name: 'Custom', category: 'Custom' })
      .expect(201)
  })

  it('should allow Owner to assign capability to Admin role', async () => {
    const capability = await createCapability({ key: 'test.cap' })

    return request(app.getHttpServer())
      .put('/roles/admin/capabilities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ add: [capability.id] })
      .expect(200)
      .then(async () => {
        const roleCaps = await prisma.roleCapability.findMany({
          where: { role: 'admin', capability_id: capability.id }
        })
        expect(roleCaps.length).toBe(1)
      })
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test
npm run test:e2e

# Seed capabilities
npx prisma db seed

# Verify seeded data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM capabilities;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM role_capabilities;"

# Type checking
npm run build
```

**Success Criteria:**
- ✅ All tests pass
- ✅ 30+ capabilities seeded
- ✅ Owner has all capabilities
- ✅ Admin has default capabilities assigned
- ✅ Member has basic capabilities
- ✅ CapabilityGuard enforces permissions
- ✅ Owner can assign/remove capabilities
- ✅ Capability changes logged in audit trail

---

## Phase 3: Content Management (Week 4-6)

### Prerequisites
- Phase 2 complete
- Capability system working

### Deliverables

#### 3.1 Database Schema Updates

Add content tables:
- Article
- Page
- Category
- Tag
- Media
- ArticleCategory (junction)
- ArticleTag (junction)
- ArticleVersion (for version control)

**Migration:**
```bash
npx prisma migrate dev --name add_content_tables
```

#### 3.2 Articles Module

**API Endpoints:**
```typescript
GET    /api/articles                          // List articles (paginated, filtered)
GET    /api/articles/:slug                    // Get article by slug
POST   /api/articles                          // Create article (requires capability)
PUT    /api/articles/:id                      // Update article
DELETE /api/articles/:id                      // Delete article (soft delete)
POST   /api/articles/:id/publish              // Publish draft
GET    /api/articles/:id/versions             // Get version history
POST   /api/articles/:id/versions/:version/restore  // Restore version
```

#### 3.3 Media Module

**API Endpoints:**
```typescript
GET    /api/media                             // List media (paginated)
GET    /api/media/:id                         // Get media by ID
POST   /api/media/upload                      // Upload file (multipart/form-data)
DELETE /api/media/:id                         // Delete media file
```

#### 3.4 Categories & Tags Modules

**API Endpoints:**
```typescript
GET    /api/categories                        // List categories (hierarchical)
POST   /api/categories                        // Create category
PUT    /api/categories/:id                    // Update category
DELETE /api/categories/:id                    // Delete category

GET    /api/tags                              // List tags
POST   /api/tags                              // Create tag
PUT    /api/tags/:id                          // Update tag
DELETE /api/tags/:id                          // Delete tag
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/articles/articles.service.spec.ts`**
```typescript
describe('ArticlesService', () => {
  it('should generate unique slug from title', async () => {
    const slug1 = await articlesService.generateSlug('My Article Title')
    const slug2 = await articlesService.generateSlug('My Article Title')
    expect(slug1).toBe('my-article-title')
    expect(slug2).toBe('my-article-title-1') // Auto-increment on collision
  })

  it('should auto-save version when version control enabled', async () => {
    const article = await createArticle({ version_control_enabled: true })
    await articlesService.update(article.id, { content: 'Updated content' })

    const versions = await prisma.articleVersion.findMany({
      where: { article_id: article.id }
    })
    expect(versions.length).toBe(2) // Original + update
  })

  it('should not save version when version control disabled', async () => {
    const article = await createArticle({ version_control_enabled: false })
    await articlesService.update(article.id, { content: 'Updated content' })

    const versions = await prisma.articleVersion.findMany({
      where: { article_id: article.id }
    })
    expect(versions.length).toBe(0)
  })

  it('should sanitize HTML content', async () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    const clean = await articlesService.sanitizeContent(dirty)
    expect(clean).not.toContain('<script>')
    expect(clean).toContain('<p>Hello</p>')
  })
})
```

#### Integration Tests

**File: `test/articles.e2e-spec.ts`**
```typescript
describe('Articles (e2e)', () => {
  describe('POST /articles', () => {
    it('should create article with Admin capability', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Article',
          content: '<p>Content here</p>',
          status: 'draft',
          visibility: 'public'
        })
        .expect(201)
        .expect(res => {
          expect(res.body.slug).toBe('test-article')
          expect(res.body.author_id).toBeDefined()
        })
    })

    it('should forbid Member from creating article', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Test', content: '<p>Test</p>' })
        .expect(403)
    })

    it('should sanitize XSS in content', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'XSS Test',
          content: '<p>Hello</p><script>alert("xss")</script>'
        })
        .expect(201)
        .expect(res => {
          expect(res.body.content).not.toContain('<script>')
          expect(res.body.content).toContain('<p>Hello</p>')
        })
    })
  })

  describe('GET /articles', () => {
    beforeEach(async () => {
      await createArticle({ visibility: 'public', status: 'published' })
      await createArticle({ visibility: 'logged_in_only', status: 'published' })
      await createArticle({ visibility: 'admin_only', status: 'published' })
      await createArticle({ visibility: 'public', status: 'draft' })
    })

    it('should return only public published articles to Guest', () => {
      return request(app.getHttpServer())
        .get('/articles')
        .expect(200)
        .expect(res => {
          expect(res.body.length).toBe(1) // Only public published
        })
    })

    it('should return public + logged_in_only to Member', () => {
      return request(app.getHttpServer())
        .get('/articles')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.length).toBe(2)
        })
    })

    it('should return all articles to Admin', () => {
      return request(app.getHttpServer())
        .get('/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.length).toBe(4) // All articles
        })
    })
  })

  describe('Version Control', () => {
    it('should create version on update when enabled', async () => {
      const article = await createArticle({ version_control_enabled: true })

      await request(app.getHttpServer())
        .put(`/articles/${article.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'Updated content', change_summary: 'Fixed typo' })
        .expect(200)

      return request(app.getHttpServer())
        .get(`/articles/${article.id}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.length).toBe(2) // Original + update
          expect(res.body[0].change_summary).toBe('Fixed typo')
        })
    })
  })
})
```

**File: `test/media.e2e-spec.ts`**
```typescript
describe('Media (e2e)', () => {
  it('should upload image file', () => {
    return request(app.getHttpServer())
      .post('/media/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', './test/fixtures/test-image.jpg')
      .field('alt_text', 'Test image')
      .expect(201)
      .expect(res => {
        expect(res.body.mime_type).toBe('image/jpeg')
        expect(res.body.path).toBeDefined()
        expect(res.body.width).toBeGreaterThan(0)
        expect(res.body.height).toBeGreaterThan(0)
      })
  })

  it('should reject non-image files', () => {
    return request(app.getHttpServer())
      .post('/media/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', './test/fixtures/malicious.exe')
      .expect(400)
  })

  it('should reject files > 50MB', () => {
    return request(app.getHttpServer())
      .post('/media/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', './test/fixtures/large-file.jpg') // 51MB
      .expect(413) // Payload Too Large
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test
npm run test:e2e

# Test file upload (manual)
curl -X POST http://localhost:4000/api/media/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test-image.jpg" \
  -F "alt_text=Test image"

# Verify media storage
ls -la media/  # Check uploaded files exist

# Database checks
psql $DATABASE_URL -c "SELECT COUNT(*) FROM articles;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM media;"
```

**Success Criteria:**
- ✅ All tests pass (200+ tests total)
- ✅ Articles CRUD works
- ✅ Slug generation works (unique, URL-safe)
- ✅ HTML sanitization works (no XSS)
- ✅ Visibility controls enforced
- ✅ Version control works (optional per article)
- ✅ Media upload works (images, PDFs)
- ✅ File size limits enforced
- ✅ MIME type validation works
- ✅ Categories hierarchical structure works
- ✅ Tags flat structure works

---

## Phase 4: Ecommerce Core (Week 7-9)

### Prerequisites
- Phase 3 complete
- Content management working

### Deliverables

#### 4.1 Database Schema Updates

Add ecommerce tables:
- Product
- DigitalProductFile (for eBooks)
- ProductCategory (junction)
- Cart
- CartItem
- Order
- OrderItem
- Download (for digital products)

**Migration:**
```bash
npx prisma migrate dev --name add_ecommerce_tables
```

#### 4.2 Products Module

**API Endpoints:**
```typescript
GET    /api/products                          // List products (paginated)
GET    /api/products/:slug                    // Get product by slug
POST   /api/products                          // Create product
PUT    /api/products/:id                      // Update product
DELETE /api/products/:id                      // Delete product (soft delete)
POST   /api/products/:id/digital-files        // Upload digital product file
POST   /api/products/:id/test-personalization // Test eBook personalization
```

#### 4.3 Cart Module

**API Endpoints:**
```typescript
GET    /api/cart                              // Get current cart
POST   /api/cart/items                        // Add item to cart
PUT    /api/cart/items/:id                    // Update cart item quantity
DELETE /api/cart/items/:id                    // Remove item from cart
DELETE /api/cart                              // Clear cart
```

#### 4.4 Orders Module

**API Endpoints:**
```typescript
GET    /api/orders                            // List orders (own or all)
GET    /api/orders/:id                        // Get order details
POST   /api/orders                            // Create order (from cart)
PUT    /api/orders/:id/status                 // Update order status (Admin)
POST   /api/orders/:id/refund                 // Process refund (Admin)
GET    /api/orders/:id/download/:format       // Download digital product
POST   /api/orders/:id/send-to-kindle         // Send eBook to Kindle
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/products/products.service.spec.ts`**
```typescript
describe('ProductsService', () => {
  it('should calculate price with tax', () => {
    const product = { price: 100, tax_rate: 0.08 }
    const total = productsService.calculateTotalPrice(product)
    expect(total).toBe(108)
  })

  it('should check stock availability', async () => {
    const product = await createProduct({ stock_status: 'in_stock', stock_quantity: 5 })
    expect(await productsService.isAvailable(product.id, 3)).toBe(true)
    expect(await productsService.isAvailable(product.id, 10)).toBe(false)
  })
})
```

**File: `src/modules/cart/cart.service.spec.ts`**
```typescript
describe('CartService', () => {
  it('should calculate cart total', async () => {
    const cart = await createCart([
      { product_id: 'p1', quantity: 2, price: 10 },
      { product_id: 'p2', quantity: 1, price: 25 }
    ])
    const total = await cartService.calculateTotal(cart.id)
    expect(total).toBe(45) // (2 * 10) + (1 * 25)
  })

  it('should enforce max quantity per item', async () => {
    await expect(
      cartService.addItem(cartId, productId, 1000)
    ).rejects.toThrow('Maximum quantity exceeded')
  })
})
```

#### Integration Tests

**File: `test/products.e2e-spec.ts`**
```typescript
describe('Products (e2e)', () => {
  it('should create physical product', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Product',
        description: 'Description',
        price: 29.99,
        product_type: 'physical',
        stock_status: 'in_stock',
        visibility: 'public',
        guest_purchaseable: true
      })
      .expect(201)
  })

  it('should create digital product (eBook) with EPUB', async () => {
    const product = await createProduct({ product_type: 'digital' })

    return request(app.getHttpServer())
      .post(`/products/${product.id}/digital-files`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', './test/fixtures/test-book.epub')
      .field('format', 'epub')
      .expect(201)
      .expect(res => {
        expect(res.body.format).toBe('epub')
        expect(res.body.file_size_bytes).toBeGreaterThan(0)
      })
  })

  it('should test eBook personalization', async () => {
    const product = await createDigitalProduct({ format: 'epub' })

    return request(app.getHttpServer())
      .post(`/products/${product.id}/test-personalization`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'epub' })
      .expect(200)
      .expect(res => {
        expect(res.body.test_download_url).toBeDefined()
        expect(res.body.personalization_tested).toBe(true)
      })
  })
})
```

**File: `test/cart.e2e-spec.ts`**
```typescript
describe('Cart (e2e)', () => {
  let product1, product2

  beforeEach(async () => {
    product1 = await createProduct({ price: 10 })
    product2 = await createProduct({ price: 25 })
  })

  it('should add item to cart', () => {
    return request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ product_id: product1.id, quantity: 2 })
      .expect(201)
  })

  it('should get cart total', async () => {
    await addToCart(memberToken, product1.id, 2) // 2 * 10 = 20
    await addToCart(memberToken, product2.id, 1) // 1 * 25 = 25

    return request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect(res => {
        expect(res.body.total).toBe(45)
        expect(res.body.items.length).toBe(2)
      })
  })

  it('should support guest cart (session-based)', async () => {
    const agent = request.agent(app.getHttpServer())

    await agent
      .post('/cart/items')
      .send({ product_id: product1.id, quantity: 1 })
      .expect(201)

    return agent
      .get('/cart')
      .expect(200)
      .expect(res => {
        expect(res.body.items.length).toBe(1)
      })
  })
})
```

**File: `test/orders.e2e-spec.ts`**
```typescript
describe('Orders (e2e)', () => {
  it('should create order from cart', async () => {
    const product = await createProduct({ price: 29.99 })
    await addToCart(memberToken, product.id, 1)

    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        shipping_address: {
          name: 'Test User',
          address_line1: '123 Test St',
          city: 'Test City',
          postal_code: '12345',
          country: 'US'
        }
      })
      .expect(201)
      .expect(res => {
        expect(res.body.status).toBe('pending')
        expect(res.body.total).toBe(29.99)
      })
  })

  it('should prevent duplicate order creation', async () => {
    const order = await createOrder(memberToken)

    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(400)
      .expect(res => {
        expect(res.body.message).toContain('pending order')
      })
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test
npm run test:e2e

# Test product creation (manual)
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Product","price":29.99,"product_type":"physical"}'

# Database checks
psql $DATABASE_URL -c "SELECT COUNT(*) FROM products;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM orders;"
```

**Success Criteria:**
- ✅ All tests pass (300+ tests total)
- ✅ Products CRUD works
- ✅ Digital product file upload works
- ✅ eBook personalization testing works
- ✅ Cart operations work (add, update, remove, clear)
- ✅ Guest cart works (session-based)
- ✅ Member cart persists across sessions
- ✅ Order creation works
- ✅ Stock tracking works
- ✅ Price calculations correct
- ✅ Visibility controls enforced for products

---

## Phase 5: Payment Integration (Week 10-11)

### Prerequisites
- Phase 4 complete
- Order system working

### Deliverables

#### 5.1 Stripe Integration

**Files to create:**
- `src/modules/payments/stripe/stripe.service.ts`
- `src/modules/payments/stripe/stripe.controller.ts`
- `src/modules/payments/stripe/stripe-webhook.controller.ts`

**API Endpoints:**
```typescript
POST   /api/payments/stripe/create-intent     // Create Payment Intent
POST   /api/payments/stripe/webhook           // Stripe webhook endpoint
```

#### 5.2 PayPal Integration

**Files to create:**
- `src/modules/payments/paypal/paypal.service.ts`
- `src/modules/payments/paypal/paypal.controller.ts`
- `src/modules/payments/paypal/paypal-webhook.controller.ts`

**API Endpoints:**
```typescript
POST   /api/payments/paypal/create-order      // Create PayPal order
POST   /api/payments/paypal/capture           // Capture payment
POST   /api/payments/paypal/webhook           // PayPal webhook endpoint
```

#### 5.3 Amazon Pay Integration

**Files to create:**
- `src/modules/payments/amazon-pay/amazon-pay.service.ts`
- `src/modules/payments/amazon-pay/amazon-pay.controller.ts`
- `src/modules/payments/amazon-pay/amazon-pay-webhook.controller.ts`

**API Endpoints:**
```typescript
POST   /api/payments/amazon-pay/create-charge  // Create charge
POST   /api/payments/amazon-pay/webhook        // Amazon Pay webhook
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/payments/stripe/stripe.service.spec.ts`**
```typescript
describe('StripeService', () => {
  it('should create Payment Intent with correct amount', async () => {
    const order = await createOrder({ total: 29.99 })
    const intent = await stripeService.createPaymentIntent(order)
    expect(intent.amount).toBe(2999) // Cents
    expect(intent.currency).toBe('usd')
  })

  it('should verify webhook signature', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' })
    const signature = generateStripeSignature(payload)

    expect(() => {
      stripeService.verifyWebhookSignature(payload, signature)
    }).not.toThrow()
  })

  it('should reject invalid webhook signature', () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded' })
    const invalidSignature = 'invalid'

    expect(() => {
      stripeService.verifyWebhookSignature(payload, invalidSignature)
    }).toThrow('Invalid signature')
  })
})
```

#### Integration Tests

**File: `test/payments.e2e-spec.ts`**
```typescript
describe('Payments (e2e)', () => {
  describe('Stripe', () => {
    it('should create Payment Intent', async () => {
      const order = await createOrder(memberToken, { total: 29.99 })

      return request(app.getHttpServer())
        .post('/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ order_id: order.id })
        .expect(200)
        .expect(res => {
          expect(res.body.client_secret).toBeDefined()
          expect(res.body.amount).toBe(2999) // Cents
        })
    })

    it('should handle successful payment webhook', async () => {
      const order = await createOrder(memberToken)
      const payload = createStripeWebhookPayload('payment_intent.succeeded', {
        metadata: { order_id: order.id }
      })
      const signature = generateStripeSignature(payload)

      return request(app.getHttpServer())
        .post('/payments/stripe/webhook')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200)
        .then(async () => {
          const updated = await prisma.order.findUnique({ where: { id: order.id } })
          expect(updated.status).toBe('completed')
          expect(updated.payment_status).toBe('paid')
        })
    })

    it('should create audit log for payment', async () => {
      const order = await createOrder(memberToken)
      await triggerStripeWebhook('payment_intent.succeeded', order)

      const log = await prisma.auditLog.findFirst({
        where: {
          event_type: 'order_payment_succeeded',
          target_id: order.id
        }
      })

      expect(log).toBeDefined()
      expect(log.details.amount).toBe(order.total)
      expect(log.details.payment_provider).toBe('stripe')
    })
  })

  describe('PayPal', () => {
    it('should create PayPal order', async () => {
      const order = await createOrder(memberToken)

      return request(app.getHttpServer())
        .post('/payments/paypal/create-order')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ order_id: order.id })
        .expect(200)
        .expect(res => {
          expect(res.body.paypal_order_id).toBeDefined()
          expect(res.body.approval_url).toBeDefined()
        })
    })
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test:e2e

# Test Stripe webhook (use Stripe CLI)
stripe listen --forward-to localhost:4000/payments/stripe/webhook
stripe trigger payment_intent.succeeded

# Verify webhook handling
psql $DATABASE_URL -c "SELECT * FROM orders WHERE payment_status = 'paid';"
psql $DATABASE_URL -c "SELECT * FROM audit_logs WHERE event_type = 'order_payment_succeeded';"

# Manual payment test (requires Stripe test mode)
# Use test card: 4242 4242 4242 4242
```

**Success Criteria:**
- ✅ All tests pass
- ✅ Stripe Payment Intent creation works
- ✅ PayPal order creation works
- ✅ Amazon Pay charge creation works
- ✅ Webhook signature verification works (all providers)
- ✅ Order status updates on successful payment
- ✅ Payment failures handled gracefully
- ✅ Audit logs created for all payment events
- ✅ Idempotent webhook handling (no duplicate processing)

---

## Phase 6: Advanced Features (Week 12-13)

### Prerequisites
- Phase 5 complete
- Payment integration working

### Deliverables

#### 6.1 Comments & Reviews Module

**API Endpoints:**
```typescript
GET    /api/comments                           // List comments (filtered by entity)
POST   /api/comments                           // Create comment/review
PUT    /api/comments/:id                       // Update own comment
DELETE /api/comments/:id                       // Delete comment (own or admin)
POST   /api/comments/:id/moderate              // Moderate comment (Admin)
```

#### 6.2 AI Comment Moderation

**Files to create:**
- `src/modules/moderation/moderation.service.ts`
- `src/modules/moderation/moderation.processor.ts` (Bull queue)
- `src/modules/moderation/profanity-filter.ts`

#### 6.3 Granular Permissions

**Files to create:**
- `src/modules/content-permissions/content-permissions.service.ts`
- Extend Article/Product models with permission flags

#### 6.4 Audit Trail

**Files to create:**
- `src/modules/audit/audit.service.ts`
- `src/modules/audit/audit.interceptor.ts`
- `src/modules/audit/audit.controller.ts`

**API Endpoints:**
```typescript
GET    /api/audit-logs                         // List audit logs (Owner/Admin)
GET    /api/audit-logs/:id                     // Get specific log entry
POST   /api/audit-logs/export                  // Export logs as CSV
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/comments/comments.service.spec.ts`**
```typescript
describe('CommentsService', () => {
  it('should create comment on article', async () => {
    const article = await createArticle()
    const comment = await commentsService.create({
      entity_type: 'article',
      entity_id: article.id,
      user_id: memberId,
      content: 'Great article!'
    })
    expect(comment.entity_type).toBe('article')
    expect(comment.status).toBe('pending') // Awaiting moderation
  })

  it('should create review with rating', async () => {
    const product = await createProduct()
    const review = await commentsService.create({
      entity_type: 'product',
      entity_id: product.id,
      user_id: memberId,
      content: 'Love this product!',
      is_review: true,
      rating: 5
    })
    expect(review.rating).toBe(5)
  })
})
```

**File: `src/modules/moderation/moderation.service.spec.ts`**
```typescript
describe('ModerationService', () => {
  it('should flag profanity', async () => {
    const result = await moderationService.moderateText('This is f***ing terrible')
    expect(result.hasProfanity).toBe(true)
    expect(result.cleanedText).toContain('[profanity]')
  })

  it('should call OpenAI Moderation API', async () => {
    const result = await moderationService.moderateText('I hate you and want to hurt you')
    expect(result.flagged).toBe(true)
    expect(result.categories.hate).toBe(true)
  })

  it('should handle non-flagged content', async () => {
    const result = await moderationService.moderateText('This is a nice comment')
    expect(result.flagged).toBe(false)
    expect(result.hasProfanity).toBe(false)
  })
})
```

**File: `src/modules/audit/audit.service.spec.ts`**
```typescript
describe('AuditService', () => {
  it('should create tamper-evident log entry', async () => {
    const log1 = await auditService.create({ event_type: 'test_event_1', ... })
    const log2 = await auditService.create({ event_type: 'test_event_2', ... })

    expect(log2.previous_hash).toBe(log1.entry_hash)
  })

  it('should detect tampered log entry', async () => {
    const log = await auditService.create({ event_type: 'test' })
    await prisma.auditLog.update({
      where: { id: log.id },
      data: { details: { modified: true } } // Tamper with data
    })

    const isValid = await auditService.verifyLogIntegrity(log.id)
    expect(isValid).toBe(false)
  })
})
```

#### Integration Tests

**File: `test/comments.e2e-spec.ts`**
```typescript
describe('Comments (e2e)', () => {
  it('should allow Member to comment on article', async () => {
    const article = await createArticle({ comment_visibility: 'public' })

    return request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        entity_type: 'article',
        entity_id: article.id,
        content: 'Great article!'
      })
      .expect(201)
  })

  it('should not allow Guest to comment', async () => {
    const article = await createArticle()

    return request(app.getHttpServer())
      .post('/comments')
      .send({
        entity_type: 'article',
        entity_id: article.id,
        content: 'Test'
      })
      .expect(401)
  })

  it('should flag profanity-laden comment', async () => {
    const article = await createArticle()

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        entity_type: 'article',
        entity_id: article.id,
        content: 'This is f***ing terrible s***'
      })
      .expect(201)

    // Wait for async moderation
    await sleep(1000)

    const comment = await prisma.comment.findFirst({
      where: { entity_id: article.id },
      orderBy: { created_at: 'desc' }
    })

    expect(comment.flagged).toBe(true)
    expect(comment.content).not.toContain('f***')
    expect(comment.content).toContain('[profanity]')
  })
})
```

**File: `test/audit.e2e-spec.ts`**
```typescript
describe('Audit Logs (e2e)', () => {
  it('should log user login', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'ValidPassword123!' })

    const log = await prisma.auditLog.findFirst({
      where: { event_type: 'user_login' },
      orderBy: { timestamp: 'desc' }
    })

    expect(log).toBeDefined()
    expect(log.ip_address).toBeDefined()
    expect(log.user_agent).toBeDefined()
  })

  it('should log password change', async () => {
    await request(app.getHttpServer())
      .put('/users/me/password')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ old_password: 'Old123!', new_password: 'New123!' })

    const log = await prisma.auditLog.findFirst({
      where: { event_type: 'user_password_changed' },
      orderBy: { timestamp: 'desc' }
    })

    expect(log).toBeDefined()
  })

  it('should allow Owner to export audit logs', () => {
    return request(app.getHttpServer())
      .post('/audit-logs/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        start_date: '2026-01-01',
        end_date: '2026-01-31'
      })
      .expect(200)
      .expect(res => {
        expect(res.body.csv_data).toBeDefined()
        expect(res.body.csv_data).toContain('event_type')
      })
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test
npm run test:e2e

# Test AI moderation (requires OpenAI API key)
curl -X POST http://localhost:4000/api/comments \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_type":"article","entity_id":"...","content":"Test profanity"}'

# Check moderation queue
npm run queue:ui  # Bull Board dashboard

# Verify audit trail
psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"
psql $DATABASE_URL -c "SELECT event_type, COUNT(*) FROM audit_logs GROUP BY event_type;"
```

**Success Criteria:**
- ✅ All tests pass (400+ tests total)
- ✅ Comments CRUD works
- ✅ Reviews with ratings work
- ✅ Profanity filtering works (bad-words library)
- ✅ OpenAI moderation API integration works
- ✅ Comments flagged for review when AI detects issues
- ✅ Admin can approve/reject flagged comments
- ✅ Granular content permissions work
- ✅ Audit trail logs all events (50+ event types)
- ✅ Audit log integrity verification works
- ✅ CSV export works

---

## Phase 7: Digital Products & eBooks (Week 14-15)

### Prerequisites
- Phase 6 complete
- Orders and payments working

### Deliverables

#### 7.1 Digital Products Module

**Files to create:**
- `src/modules/digital-products/digital-products.service.ts`
- `src/modules/digital-products/digital-products.processor.ts` (Bull queue)
- `src/modules/digital-products/epub-personalizer.ts`
- `src/modules/digital-products/pdf-personalizer.ts`

#### 7.2 Kindle Devices Module

**API Endpoints:**
```typescript
GET    /api/kindle-devices                     // List user's Kindle devices
POST   /api/kindle-devices                     // Add Kindle device
PUT    /api/kindle-devices/:id                 // Update device
DELETE /api/kindle-devices/:id                 // Remove device
POST   /api/kindle-devices/:id/set-default     // Set as default
```

#### 7.3 Send to Kindle Module

**API Endpoints:**
```typescript
POST   /api/digital-products/send-to-kindle    // Send eBook to Kindle
```

### Testing Strategy

#### Unit Tests

**File: `src/modules/digital-products/epub-personalizer.spec.ts`**
```typescript
describe('EpubPersonalizer', () => {
  it('should personalize EPUB with customer info', async () => {
    const originalEpub = await fs.readFile('./test/fixtures/test-book.epub')
    const personalized = await epubPersonalizer.personalize(originalEpub, {
      customerName: 'John Doe',
      purchaseDate: new Date(),
      orderNumber: 'ORD-12345'
    })

    // Extract and verify content
    const zip = new AdmZip(personalized)
    const contentFiles = zip.getEntries().filter(e => e.entryName.includes('.xhtml'))
    const firstContent = contentFiles[0].getData().toString('utf8')

    expect(firstContent).toContain('John Doe')
    expect(firstContent).toContain('ORD-12345')
  })

  it('should preserve EPUB structure', async () => {
    const originalEpub = await fs.readFile('./test/fixtures/test-book.epub')
    const personalized = await epubPersonalizer.personalize(originalEpub, { ... })

    const zip = new AdmZip(personalized)
    expect(zip.getEntry('META-INF/container.xml')).toBeDefined()
    expect(zip.getEntry('mimetype')).toBeDefined()
  })
})
```

**File: `src/modules/digital-products/pdf-personalizer.spec.ts`**
```typescript
describe('PdfPersonalizer', () => {
  it('should add personalization page to PDF', async () => {
    const originalPdf = await fs.readFile('./test/fixtures/test-book.pdf')
    const personalized = await pdfPersonalizer.personalize(originalPdf, {
      customerName: 'John Doe',
      purchaseDate: new Date(),
      orderNumber: 'ORD-12345'
    })

    const pdf = await PDFDocument.load(personalized)
    expect(pdf.getPageCount()).toBe(originalPageCount + 1)

    const firstPage = pdf.getPages()[0]
    const text = await firstPage.getTextContent()
    expect(text).toContain('John Doe')
  })
})
```

#### Integration Tests

**File: `test/digital-products.e2e-spec.ts`**
```typescript
describe('Digital Products (e2e)', () => {
  describe('eBook Purchase Flow', () => {
    it('should complete eBook purchase and generate download', async () => {
      // Create digital product
      const product = await createDigitalProduct({
        format: 'epub',
        price: 9.99
      })

      // Add to cart and checkout
      await addToCart(memberToken, product.id, 1)
      const order = await createOrder(memberToken)

      // Trigger payment webhook
      await triggerStripeWebhook('payment_intent.succeeded', order)

      // Wait for personalization job
      await waitForJob('personalize-ebook', order.id)

      // Verify download link created
      const download = await prisma.download.findFirst({
        where: { order_id: order.id, format: 'epub' }
      })

      expect(download).toBeDefined()
      expect(download.token).toBeDefined()
      expect(download.expires_at).toBeInstanceOf(Date)
      expect(download.download_limit).toBe(5)
    })
  })

  describe('Download', () => {
    it('should download personalized EPUB', async () => {
      const { order, download } = await createCompletedEbookOrder()

      return request(app.getHttpServer())
        .get(`/downloads/${download.token}/epub`)
        .expect(200)
        .expect('Content-Type', 'application/epub+zip')
        .expect(res => {
          expect(res.body).toBeInstanceOf(Buffer)
          expect(res.body.length).toBeGreaterThan(0)
        })
    })

    it('should track download count', async () => {
      const { order, download } = await createCompletedEbookOrder()

      await request(app.getHttpServer())
        .get(`/downloads/${download.token}/epub`)

      const updated = await prisma.download.findUnique({ where: { id: download.id } })
      expect(updated.download_count).toBe(1)
    })

    it('should enforce download limit', async () => {
      const { order, download } = await createCompletedEbookOrder()

      // Download 5 times (limit)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get(`/downloads/${download.token}/epub`)
          .expect(200)
      }

      // 6th attempt should fail
      return request(app.getHttpServer())
        .get(`/downloads/${download.token}/epub`)
        .expect(403)
        .expect(res => {
          expect(res.body.message).toContain('Download limit reached')
        })
    })

    it('should reject expired download link', async () => {
      const { download } = await createExpiredDownload()

      return request(app.getHttpServer())
        .get(`/downloads/${download.token}/epub`)
        .expect(403)
        .expect(res => {
          expect(res.body.message).toContain('expired')
        })
    })
  })

  describe('Send to Kindle', () => {
    it('should send eBook to Kindle device', async () => {
      const device = await createKindleDevice(memberId, {
        friendly_name: 'My Kindle',
        kindle_email: 'test_kindle@kindle.com'
      })
      const { order } = await createCompletedEbookOrder(memberId)

      return request(app.getHttpServer())
        .post('/digital-products/send-to-kindle')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          order_id: order.id,
          kindle_device_id: device.id,
          format: 'epub'
        })
        .expect(200)
        .expect(res => {
          expect(res.body.message).toContain('sent to Kindle')
        })
    })

    it('should log Send to Kindle in audit trail', async () => {
      const device = await createKindleDevice(memberId)
      const { order } = await createCompletedEbookOrder(memberId)

      await sendToKindle(memberToken, order.id, device.id, 'epub')

      const log = await prisma.auditLog.findFirst({
        where: {
          event_type: 'ebook_sent_to_kindle',
          user_id: memberId
        }
      })

      expect(log).toBeDefined()
      expect(log.details.kindle_device_id).toBe(device.id)
      expect(log.details.format).toBe('epub')
    })
  })
})
```

### Validation Checklist

```bash
# Run tests
npm run test
npm run test:e2e

# Test EPUB personalization
node scripts/test-epub-personalization.js

# Test PDF personalization
node scripts/test-pdf-personalization.js

# Check message queue
npm run queue:ui

# Verify downloads
psql $DATABASE_URL -c "SELECT * FROM downloads WHERE download_count > 0;"
```

**Success Criteria:**
- ✅ All tests pass (450+ tests total)
- ✅ EPUB personalization works (adm-zip + jsdom)
- ✅ PDF personalization works (pdf-lib)
- ✅ Download token generation works
- ✅ Download limits enforced (5x per format)
- ✅ Download expiration works (7 days)
- ✅ Kindle device management works
- ✅ Send to Kindle works (AWS SES)
- ✅ Multiple format support works (EPUB + PDF)
- ✅ Personalization queue processes asynchronously

---

## Phase 8: Frontend Implementation (Week 16-18)

### Prerequisites
- All backend phases complete
- All APIs tested and working

### Deliverables

#### 8.1 Frontend Authentication

**Pages to create:**
- `/login` - Login modal/page
- `/register` - Registration flow
- `/verify-email` - Email verification
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset completion

#### 8.2 Public Pages

**Pages:**
- `/` - Homepage
- `/articles` - Article list
- `/articles/[slug]` - Article detail
- `/shop` - Product catalog
- `/product/[slug]` - Product detail
- `/cart` - Shopping cart
- `/checkout` - Checkout flow

#### 8.3 Admin Dashboard

**Pages:**
- `/admin` - Dashboard
- `/admin/articles` - Article management
- `/admin/products` - Product management
- `/admin/orders` - Order management
- `/admin/users` - User management
- `/admin/settings` - System settings

### Testing Strategy

#### E2E Tests (Playwright)

**File: `tests/e2e/auth.spec.ts`**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should register new user', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="email"]', 'newuser@example.com')
    await page.fill('[name="password"]', 'ValidPassword123!')
    await page.fill('[name="displayName"]', 'New User')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/verify-email')
    await expect(page.locator('text=Check your email')).toBeVisible()
  })

  test('should login existing user', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'ValidPassword123!')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/')
    await expect(page.locator('text=My Account')).toBeVisible()
  })

  test('should show validation errors', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="email"]', 'invalid-email')
    await page.fill('[name="password"]', 'short')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Invalid email')).toBeVisible()
    await expect(page.locator('text=Password must be at least 16 characters')).toBeVisible()
  })
})
```

**File: `tests/e2e/shopping.spec.ts`**
```typescript
test.describe('Shopping Flow', () => {
  test('should complete purchase', async ({ page }) => {
    // Browse products
    await page.goto('/shop')
    await expect(page.locator('.product-card')).toHaveCount.greaterThan(0)

    // Add to cart
    await page.click('.product-card:first-child')
    await page.click('button:has-text("Add to Cart")')
    await expect(page.locator('.cart-count')).toHaveText('1')

    // Go to cart
    await page.click('[href="/cart"]')
    await expect(page.locator('.cart-item')).toBeVisible()

    // Proceed to checkout
    await page.click('button:has-text("Checkout")')
    await expect(page).toHaveURL('/checkout')

    // Fill shipping info
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="address"]', '123 Test St')
    await page.fill('[name="city"]', 'Test City')
    await page.fill('[name="postal_code"]', '12345')

    // Enter payment (use Stripe test card)
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]')
    await stripeFrame.fill('[name="cardNumber"]', '4242424242424242')
    await stripeFrame.fill('[name="cardExpiry"]', '1234')
    await stripeFrame.fill('[name="cardCvc"]', '123')

    // Complete payment
    await page.click('button:has-text("Pay")')

    // Verify success
    await expect(page).toHaveURL(/\/orders\/.*/)
    await expect(page.locator('text=Order Completed')).toBeVisible()
  })

  test('should persist cart across sessions', async ({ page, context }) => {
    // Add item to cart
    await page.goto('/shop')
    await page.click('.product-card:first-child')
    await page.click('button:has-text("Add to Cart")')

    // Close and reopen browser
    await context.close()
    const newContext = await browser.newContext({ storageState: 'auth-state.json' })
    const newPage = await newContext.newPage()

    // Cart should persist
    await newPage.goto('/cart')
    await expect(newPage.locator('.cart-item')).toBeVisible()
  })
})
```

**File: `tests/e2e/admin.spec.ts`**
```typescript
test.describe('Admin Dashboard', () => {
  test.use({ storageState: 'admin-auth.json' })

  test('should create article', async ({ page }) => {
    await page.goto('/admin/articles')
    await page.click('button:has-text("New Article")')

    await page.fill('[name="title"]', 'Test Article')
    await page.fill('.tiptap-editor', '<p>Content here</p>')
    await page.click('button:has-text("Publish")')

    await expect(page.locator('text=Article published')).toBeVisible()
  })

  test('should upload media', async ({ page }) => {
    await page.goto('/admin/media')
    await page.setInputFiles('input[type="file"]', './test-image.jpg')

    await expect(page.locator('text=Upload successful')).toBeVisible()
    await expect(page.locator('img[alt="test-image.jpg"]')).toBeVisible()
  })

  test('should manage orders', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('.order-row')).toHaveCount.greaterThan(0)

    // Update order status
    await page.click('.order-row:first-child')
    await page.selectOption('[name="status"]', 'shipped')
    await page.click('button:has-text("Update")')

    await expect(page.locator('text=Order updated')).toBeVisible()
  })
})
```

### Validation Checklist

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run E2E tests
cd frontend
npx playwright test

# Run tests with UI
npx playwright test --ui

# Generate test report
npx playwright show-report

# Visual regression testing
npx playwright test --update-snapshots

# Accessibility testing
npm run test:a11y
```

**Success Criteria:**
- ✅ All E2E tests pass (50+ scenarios)
- ✅ Authentication flows work
- ✅ Shopping cart works
- ✅ Checkout completes successfully
- ✅ Admin dashboard functional
- ✅ Article creation works (TipTap editor)
- ✅ Product management works
- ✅ Order management works
- ✅ Mobile responsive (tested on mobile viewports)
- ✅ Accessibility score ≥ 90 (Lighthouse)
- ✅ Performance score ≥ 85 (Lighthouse)

---

## Phase 9: WordPress Migration (Week 19)

### Prerequisites
- All phases complete
- System fully functional

### Deliverables

#### 9.1 Migration Script

**File: `scripts/migrate-wordpress/migrate.js`**

Implement migration as per PRD 08.

### Testing Strategy

**Test Migration:**
```bash
# Export WordPress database
mysqldump -u user -p wordpress > wordpress-dump.sql

# Run migration (dry run)
node scripts/migrate-wordpress/migrate.js \
  --wp-dump wordpress-dump.sql \
  --dry-run

# Review output
less migration-report.txt

# Run actual migration
node scripts/migrate-wordpress/migrate.js \
  --wp-dump wordpress-dump.sql \
  --media-path /path/to/wp-content/uploads

# Verify migration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM articles;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM media;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM comments;"
```

**Success Criteria:**
- ✅ All WordPress posts migrated to articles
- ✅ All WordPress pages migrated to pages
- ✅ All categories migrated
- ✅ All tags migrated
- ✅ All media files downloaded and uploaded
- ✅ All approved comments migrated (with AI moderation)
- ✅ Redirect map generated for SEO
- ✅ No data loss
- ✅ Migration completes in < 1 hour for typical blog

---

## Phase 10: Production Deployment (Week 20)

### Prerequisites
- All phases complete
- All tests passing
- WordPress migration complete (if needed)

### Deliverables

#### 10.1 Production Environment Setup

**Infrastructure:**
```yaml
# docker-compose.prod.yml
services:
  backend:
    image: aecms/backend:latest
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  frontend:
    image: aecms/frontend:latest
    restart: always
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${API_URL}

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
```

#### 10.2 CI/CD Pipeline

**File: `.github/workflows/ci.yml`**
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd backend && npm ci

      - name: Run linter
        run: cd backend && npm run lint

      - name: Run type check
        run: cd backend && npm run build

      - name: Run unit tests
        run: cd backend && npm run test:cov

      - name: Run E2E tests
        run: cd backend && npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./backend/coverage

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run linter
        run: cd frontend && npm run lint

      - name: Run type check
        run: cd frontend && npm run build

      - name: Run Playwright tests
        run: cd frontend && npx playwright test

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        run: |
          # Deploy to your hosting platform
          # Examples: Railway, Vercel, VPS via SSH
```

### Testing Strategy

#### Production Smoke Tests

**File: `tests/smoke/production.spec.ts`**
```typescript
test.describe('Production Smoke Tests', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto(process.env.PRODUCTION_URL)
    await expect(page).toHaveTitle(/AECMS/)
    await expect(page.locator('header')).toBeVisible()
  })

  test('should have valid SSL certificate', async ({ page }) => {
    const response = await page.goto(process.env.PRODUCTION_URL)
    expect(response.securityDetails()).toBeTruthy()
  })

  test('should have correct security headers', async ({ page }) => {
    const response = await page.goto(process.env.PRODUCTION_URL)
    const headers = response.headers()
    expect(headers['strict-transport-security']).toBeDefined()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
  })

  test('should complete health checks', async ({ request }) => {
    const response = await request.get(`${process.env.PRODUCTION_URL}/api/health`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.database).toBe('connected')
    expect(data.redis).toBe('connected')
  })
})
```

### Validation Checklist

```bash
# Pre-deployment checks
npm run test            # All unit tests
npm run test:e2e        # All E2E tests
npm run test:security   # Security audit
npm audit               # Dependency audit

# Build for production
cd backend && npm run build
cd frontend && npm run build

# Deploy to staging
./scripts/deploy-staging.sh

# Run smoke tests on staging
PRODUCTION_URL=https://staging.aecms.com npx playwright test tests/smoke

# Deploy to production
./scripts/deploy-production.sh

# Run smoke tests on production
PRODUCTION_URL=https://aecms.com npx playwright test tests/smoke

# Monitor for errors
./scripts/monitor-errors.sh
```

**Success Criteria:**
- ✅ All tests pass in CI/CD
- ✅ Code coverage ≥ 80%
- ✅ Build succeeds without warnings
- ✅ Security audit shows no critical issues
- ✅ Staging deployment successful
- ✅ Smoke tests pass on staging
- ✅ Production deployment successful
- ✅ Smoke tests pass on production
- ✅ SSL certificate valid
- ✅ Security headers present
- ✅ Performance metrics acceptable (Lighthouse)
- ✅ No errors in production logs (first 24 hours)

---

## Automated Testing Summary

### Test Coverage Goals

| Area | Unit Tests | Integration Tests | E2E Tests | Total Coverage |
|------|------------|-------------------|-----------|----------------|
| Authentication | 30+ | 20+ | 10+ | ≥ 85% |
| Users | 20+ | 15+ | 8+ | ≥ 80% |
| Capabilities | 15+ | 10+ | 5+ | ≥ 80% |
| Articles | 30+ | 20+ | 12+ | ≥ 85% |
| Products | 25+ | 18+ | 10+ | ≥ 85% |
| Cart | 15+ | 12+ | 8+ | ≥ 85% |
| Orders | 20+ | 15+ | 10+ | ≥ 85% |
| Payments | 25+ | 20+ | 8+ | ≥ 85% |
| Comments | 20+ | 15+ | 8+ | ≥ 80% |
| Digital Products | 25+ | 20+ | 12+ | ≥ 85% |
| Admin Dashboard | N/A | N/A | 25+ | ≥ 70% |
| **Total** | **225+** | **165+** | **116+** | **≥ 80%** |

### Claude Code Validation Commands

**Quick validation script for Claude to run:**
```bash
#!/bin/bash
# validate-phase.sh - Run by Claude Code after each phase

set -e  # Exit on error

echo "=== Phase Validation ==="
echo "Running validation checks..."

# Type checking
echo "1. Type checking..."
cd backend && npm run build
cd ../frontend && npm run build

# Linting
echo "2. Linting..."
cd ../backend && npm run lint
cd ../frontend && npm run lint

# Unit tests
echo "3. Unit tests..."
cd ../backend && npm run test

# Integration tests
echo "4. Integration tests..."
cd ../backend && npm run test:e2e

# Database checks
echo "5. Database validation..."
cd ../backend
npx prisma validate
npx prisma migrate status

# Security checks
echo "6. Security audit..."
npm audit --audit-level=moderate

# E2E tests (if frontend phase)
if [ -f "../frontend/playwright.config.ts" ]; then
  echo "7. E2E tests..."
  cd ../frontend && npx playwright test
fi

# Coverage report
echo "8. Coverage report..."
cd ../backend && npm run test:cov

echo ""
echo "=== Validation Complete ==="
echo "✅ All checks passed!"
```

**Usage by Claude Code:**
```bash
# After completing a phase
./scripts/validate-phase.sh

# If all checks pass, proceed to next phase
# If any checks fail, fix issues and re-run
```

---

## Estimated Timeline Summary

| Phase | Duration | Cumulative | Key Deliverables |
|-------|----------|------------|------------------|
| 0: Foundation | 1 week | 1 week | Project structure, Docker setup |
| 1: Auth & Users | 2 weeks | 3 weeks | JWT, OAuth, email verification, RBAC |
| 2: Capabilities | 1 week | 4 weeks | Capability system, permission guards |
| 3: Content | 2 weeks | 6 weeks | Articles, media, categories, tags |
| 4: Ecommerce | 3 weeks | 9 weeks | Products, cart, orders |
| 5: Payments | 2 weeks | 11 weeks | Stripe, PayPal, Amazon Pay |
| 6: Advanced | 2 weeks | 13 weeks | Comments, AI moderation, audit trail |
| 7: Digital Products | 2 weeks | 15 weeks | eBooks, personalization, Kindle |
| 8: Frontend | 3 weeks | 18 weeks | All public pages, admin dashboard |
| 9: Migration | 1 week | 19 weeks | WordPress migration script |
| 10: Production | 1 week | 20 weeks | CI/CD, deployment, monitoring |
| **Total** | **20 weeks** | **~5 months** | **Full MVP deployed** |

---

## Development Best Practices

### For Claude Code

1. **Read Before Writing**: Always read existing files before modifying
2. **Test-Driven**: Write tests first or alongside implementation
3. **Incremental Commits**: Commit after each logical unit of work
4. **Validation After Changes**: Run validation script after each phase
5. **Documentation**: Update comments and docs as you code
6. **Error Handling**: Implement comprehensive error handling
7. **Security First**: Validate all inputs, sanitize outputs
8. **Performance Conscious**: Use indexes, caching, pagination
9. **Type Safety**: Use TypeScript strict mode, avoid `any`
10. **Code Review**: Review generated code before committing

### Testing Philosophy

1. **Test Pyramid**: More unit tests, fewer integration tests, even fewer E2E tests
2. **Fast Feedback**: Unit tests should run in < 5 seconds
3. **Isolated Tests**: Each test should be independent
4. **Clear Assertions**: Test one thing per test
5. **Meaningful Names**: Test names describe what they test
6. **Edge Cases**: Test boundary conditions and error paths
7. **Coverage Goals**: Aim for ≥ 80% coverage, 100% on critical paths

---

## Success Metrics

### Technical Metrics
- ✅ Test coverage ≥ 80%
- ✅ Build time < 5 minutes
- ✅ Test suite runs in < 10 minutes
- ✅ Zero critical security vulnerabilities
- ✅ API response time < 500ms (p95)
- ✅ Page load time < 2 seconds
- ✅ Lighthouse performance score ≥ 85
- ✅ Lighthouse accessibility score ≥ 90

### Functional Metrics
- ✅ All PRD requirements implemented
- ✅ All user stories completed
- ✅ All API endpoints working
- ✅ All pages responsive
- ✅ Payment flows working
- ✅ Digital product delivery working
- ✅ WordPress migration successful

---

**Last Updated:** 2026-01-29
**Version:** 1.0
**Status:** Ready for Implementation
