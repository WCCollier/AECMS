# AECMS Development Handoff Notes

**Date**: 2026-01-29 18:27 UTC
**Session**: phase3-in-progress-media-complete
**API Funding Status**: Running low, preparing for Claude subscription migration

---

## Current Project Status

**✅ COMPLETE**:
- Phase 0: Project Foundation (Docker, NestJS, Next.js initialized)
- Phase 1: Database Schema & Authentication (JWT, OAuth ready, 30+ models)
- Phase 2: Capability System (RBAC with 27 capabilities, guards, decorators)
- Phase 3 (Partial): Media Module complete

**🔄 IN PROGRESS**:
- Phase 3: Content Management (4 of 5 modules remaining)

**⏳ PENDING**:
- Phase 3: Categories, Tags, Articles, Pages modules
- Phases 4-17: See docs/IMPLEMENTATION_PLAN.md

---

## What Works Right Now

### Backend Services (All Running ✓)
- **PostgreSQL 15** (Docker) - Database with 30+ tables
- **Redis 7** (Docker) - Caching layer
- **NestJS Backend** (port 4000) - API server
- **Next.js Frontend** (port 3000) - UI (basic)

### Authentication System ✓
- JWT with refresh tokens (15m access, 7d refresh)
- Register, login, refresh, logout, logout-all endpoints
- Unique token generation (jti claim)
- Password hashing (bcrypt cost 12)
- OAuth integration ready (Google/Apple)
- All tests passing: 42 unit + 16 E2E

### Authorization System ✓
- Capability-based RBAC
- 27 capabilities across 4 categories
- Role capabilities (Owner gets all, Admin gets 13, Member gets 0)
- User-specific capability assignments
- CapabilityGuard with OR logic
- RolesGuard for role checks
- @RequiresCapability, @Roles, @CurrentUser decorators

### Media Module ✓
- File upload with multer
- Image optimization with sharp
- Thumbnail generation (300x300)
- 6 API endpoints
- Capability guards applied
- **Compilation: 0 errors**

### Database
- 30+ models fully defined
- 3 test users seeded:
  - Owner: owner@aecms.local / Admin123!@#
  - Admin: admin@aecms.local / Admin123!@#
  - Member: member@aecms.local / Member123!@#
- All migrations applied successfully

---

## What's Next (Immediate Tasks)

### Task #27: Categories Module
**Status**: PENDING
**Files to Create**:
- `backend/src/categories/categories.module.ts`
- `backend/src/categories/categories.service.ts`
- `backend/src/categories/categories.controller.ts`
- `backend/src/categories/dto/*.dto.ts`
- Tests

**Requirements**:
- Hierarchical structure (parent-child)
- Slug generation
- 5 REST endpoints (GET, GET/:slug, POST, PATCH, DELETE)
- Apply capability guards
- See IMPLEMENTATION_PLAN.md line 1725-1741

### Task #28: Tags Module
**Status**: PENDING
**Files to Create**:
- `backend/src/tags/tags.module.ts`
- `backend/src/tags/tags.service.ts`
- `backend/src/tags/tags.controller.ts`
- `backend/src/tags/dto/*.dto.ts`
- Tests

**Requirements**:
- Flat structure (no hierarchy)
- Slug generation
- 5 REST endpoints
- Apply capability guards

### Task #29: Articles Module (CRITICAL - Core Functionality)
**Status**: PENDING
**Files to Create**:
- `backend/src/articles/articles.module.ts`
- `backend/src/articles/articles.service.ts`
- `backend/src/articles/articles.controller.ts`
- `backend/src/articles/dto/*.dto.ts`
- Unit tests (40+ tests)
- E2E tests

**Requirements**:
- Full CRUD operations
- Slug auto-generation
- Rich text content (HTML)
- Featured image integration (uses Media module)
- Categories and tags associations
- Status management (draft/published/archived)
- Visibility controls (public/logged_in_only/admin_only)
- **Granular permissions** (author_can_edit, admin_can_edit flags)
- SEO meta fields
- Full-text search (PostgreSQL)
- Pagination and filtering
- 7 REST endpoints
- **Permission evaluation logic** (see IMPLEMENTATION_PLAN.md line 1779-1795)

**Critical**: Article permission logic combines:
1. Role-based (Owner always can)
2. Content-level flags (author_can_edit, admin_can_edit)
3. Capability-based (article.edit.any, article.edit.own)
4. All evaluated with OR logic

### Task #30: Pages Module
**Status**: PENDING
Similar to Articles but:
- Hierarchical structure
- Template selection
- No categories/tags
- 5 endpoints

### Task #31: Documentation & Tests
**Status**: PENDING
- Write all missing tests (Media needs 25+ unit tests)
- Phase 3 completion report
- Update CLAUDE.md
- Commit all changes with detailed messages

---

## Key Files & Locations

### Documentation
- `docs/IMPLEMENTATION_PLAN.md` - Full 17-phase plan
- `docs/PHASE_1_COMPLETION_REPORT.md` - Phase 1 details
- `docs/PHASE_2_COMPLETION_REPORT.md` - Phase 2 details
- `docs/prd/*.md` - 12 PRD documents with all requirements
- `CLAUDE.md` - Project context and session history
- **THIS FILE** - Handoff notes

### Codebase Structure
```
backend/
├── prisma/
│   ├── schema.prisma (30+ models, 723 lines)
│   ├── migrations/ (3 migrations applied)
│   └── seed.ts (capabilities + 3 users)
├── src/
│   ├── auth/ (JWT, guards, decorators)
│   ├── capabilities/ (RBAC system)
│   ├── media/ (File upload - COMPLETE)
│   ├── config/ (Environment validation)
│   └── prisma/ (DB service)
└── test/ (16 E2E tests passing)
```

### Environment Variables
- All secrets configured in GitHub Codespaces Secrets
- DATABASE_URL: URL-encoded, uses Prisma adapter
- JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION: configured
- Auto-detection for Codespaces URLs implemented

---

## Development Commands

### Start Services
```bash
# From project root
docker-compose up -d

# Backend (if not in Docker)
cd backend
npm run start:dev
```

### Database
```bash
cd backend
npx prisma migrate dev --name <migration_name>
npx prisma generate
npx prisma db seed
```

### Testing
```bash
cd backend
npm test                 # Unit tests (42 passing)
npm run test:e2e         # E2E tests (16 passing)
npm run test:cov         # Coverage report
```

### Build
```bash
cd backend
npm run build            # Compile TypeScript
```

---

## Important Patterns

### Creating a New Module
1. Generate module: `nest g module feature-name`
2. Create service, controller, DTOs
3. Add to AppModule imports
4. Apply capability guards to protected endpoints
5. Write unit tests (aim for 80% coverage)
6. Write E2E tests for critical flows
7. Update Prisma schema if needed
8. Create migration: `npx prisma migrate dev`
9. Commit with detailed message
10. Update CLAUDE.md

### Applying Capability Guards
```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard) // All routes require auth
export class ResourceController {
  @Post()
  @UseGuards(CapabilityGuard)
  @RequiresCapability('resource.create')
  async create() { }

  @Patch(':id')
  @UseGuards(CapabilityGuard)
  @RequiresCapability('resource.edit.any', 'resource.edit.own')
  async update() { }  // OR logic: needs ANY of the capabilities
}
```

### Granular Permissions (Articles)
Content-level flags take precedence:
```typescript
async canEdit(user: User, article: Article): Promise<boolean> {
  // 1. Owner always can
  if (user.role === 'owner') return true;

  // 2. Check content-level flags (PRD 12)
  if (user.id === article.author_id && article.author_can_edit) return true;
  if (user.role === 'admin' && article.admin_can_edit) return true;

  // 3. Fall back to capabilities (PRD 09)
  if (await this.capabilitiesService.userHasCapability(user.id, 'article.edit.any')) return true;
  if (await this.capabilitiesService.userHasCapability(user.id, 'article.edit.own') &&
      user.id === article.author_id) return true;

  // 4. Deny
  return false;
}
```

---

## Known Issues & Considerations

### None Currently
All Phase 0-2 and Media Module compile without errors.

### Watch Out For
1. **Prisma 7 Requirement**: Must use adapter pattern (already implemented)
2. **JWT Token Uniqueness**: Always include `jti` claim (already implemented)
3. **File Upload**: multer config needs `dest` or storage engine
4. **Sharp Import**: Must use default import, not namespace import
5. **Response Type**: Use `import type { Response }` for Express types

---

## Testing Strategy

### Unit Tests
- Mock Prisma service
- Test all service methods
- Aim for 80% coverage
- See `capabilities.service.spec.ts` as example (30 tests)

### E2E Tests
- Test full request/response cycle
- Use seeded test users
- Clean up data in `beforeAll`/`afterEach`
- See `auth.e2e-spec.ts` as example (16 tests)

---

## Git Workflow

### Commit Message Format
```
<type>(scope): <subject>

<detailed body explaining what and why>

- Bullet points for key changes
- Testing results
- Any important notes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Commit Frequently
- After each module completion
- After fixing compilation errors
- After running tests
- Before/after schema migrations
- When updating CLAUDE.md

### Push Regularly
User emphasized: **Push often for handoff continuity**

---

## Critical PRD References

### Content Permissions (PRD 12)
- `author_can_edit`, `author_can_delete` flags on content
- `admin_can_edit`, `admin_can_delete` flags on content
- OR logic: User can edit if ANY condition is true
- Owner permissions always true

### Capabilities (PRD 09)
- 27 capabilities defined
- Owner gets all (hardcoded)
- Admin gets 13 (seeded)
- Member gets 0 (seeded)
- Extensible system for future additions

### Visibility (PRD 01, 03)
- `public`: Everyone (including guests)
- `logged_in_only`: Members and above
- `admin_only`: Admin and Owner only

### Status (Articles/Pages)
- `draft`: Not published, author only
- `published`: Live, respects visibility
- `archived`: Hidden, admin access only

---

## If API Funding Runs Out

This document + CLAUDE.md + docs/ folder contain everything needed to continue.

**Priority Order for New Instance**:
1. Read CLAUDE.md (full project context)
2. Read THIS FILE (immediate next steps)
3. Review docs/IMPLEMENTATION_PLAN.md (Phase 3 details)
4. Check `git log` (recent commits)
5. Run tests to verify everything still works
6. Continue with Task #27 (Categories Module)

**Quick Verification**:
```bash
cd /workspaces/AECMS/backend
npm run build          # Should have 0 errors
npm test               # Should pass 42 tests
npm run test:e2e       # Should pass 16 tests
```

---

## Contact Points

**Repository**: https://github.com/WCCollier/AECMS
**Branch**: main
**Last Commit**: cca54b5 (2026-01-29 18:26 UTC)

---

**This handoff document will be updated as Phase 3 progresses.**

**Current Token Usage**: ~73k of 200k remaining
**Estimated Work Remaining in Phase 3**: 4 modules + tests + documentation
**Estimated Tokens Needed**: ~100k-120k (may need to pause and resume)

---

**Status**: READY FOR HANDOFF if needed, or READY TO CONTINUE if tokens permit
